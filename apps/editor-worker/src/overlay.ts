import { sanitizeDrawtext, normalizeHexColor, rgbaColor } from "./utils";

export function buildOverlayFilter(overlays: any[], timelineOffsetMs = 0, stageWidth = 1280, stageHeight = 720): string | null {
  if (!overlays?.length) return null;

  const sortedOverlays = [...overlays].sort((a, b) => {
    const zA = Number.isFinite(a?.zIndex) ? a.zIndex : 0;
    const zB = Number.isFinite(b?.zIndex) ? b.zIndex : 0;
    if (zA !== zB) return zA - zB;
    return (a?.timelineStartMs ?? 0) - (b?.timelineStartMs ?? 0);
  });

  const filters = sortedOverlays
    .map((o) => {
      let text = sanitizeDrawtext(o.content?.text ?? "");
      // Ensure literal newlines are represented as escaped \n for ffmpeg drawtext
      text = text.replace(/\r?\n/g, "\\n");
      if (!text) return null;

      const style = o.style ?? {};
      const transform = o.transform ?? {};
      const positionX = Number.isFinite(transform.x) ? transform.x : 100;
      const positionY = Number.isFinite(transform.y) ? transform.y : 100;
      const fontSize = Number.isFinite(style.fontSize) ? style.fontSize : 24;
      const startMs = o.timelineStartMs + (o.animation?.delayMs ?? 0);
      const animationDurationMs = Number.isFinite(o.animation?.durationMs) ? o.animation.durationMs : 0;
      const start = ((o.timelineStartMs - timelineOffsetMs) / 1000).toFixed(2);
      const end = ((o.timelineStartMs + o.durationMs - timelineOffsetMs) / 1000).toFixed(2);

      const xExpr = style.textAlign === "center"
        ? `(${stageWidth} - text_w) / 2`
        : style.textAlign === "right"
          ? `${stageWidth} - text_w - 24`
          : `${positionX}`;

      const verticalY = `${positionY}`;
      const color = normalizeHexColor(style.color, "ffffff");
      const boxEnabled = style.backgroundColor || style.backgroundOpacity !== undefined;
      const boxColor = boxEnabled
        ? rgbaColor(style.backgroundColor, style.backgroundOpacity ?? 1, "000000")
        : null;
      const alphaExpr = o.animation && o.animation.type !== "none"
        ? `if(lt(t,${(startMs / 1000).toFixed(2)}),0,if(lt(t,${((startMs + animationDurationMs) / 1000).toFixed(2)}),((t-${(startMs / 1000).toFixed(2)})/${Math.max(0.1, animationDurationMs / 1000).toFixed(2)}),1))`
        : null;

      const styleParts = [
        `fontsize=${fontSize}`,
        `fontcolor=0x${color}`,
        `x='${xExpr}'`,
        `y='${verticalY}'`,
        `enable='between(t,${start},${end})'`,
      ];

      if (boxColor) {
        styleParts.push(`box=1`, `boxcolor=${boxColor}`);
      }

      if (style.textShadow) {
        const sx = Number(style.textShadow.x ?? 2);
        const sy = Number(style.textShadow.y ?? 2);
        const sColor = normalizeHexColor(style.textShadow.color, "000000");
        const sAlpha = Number(style.textShadow.opacity ?? 0.66);
        styleParts.push(`shadowx=${sx}`, `shadowy=${sy}`, `shadowcolor=0x${sColor}${Math.round(Math.max(0, Math.min(1, sAlpha)) * 255).toString(16).padStart(2, '0')}`);
      }

      // Stroke / outline support
      if (Number.isFinite(style.strokeWidth) && style.strokeWidth > 0) {
        const sw = Number(style.strokeWidth || 0);
        const sc = normalizeHexColor(style.strokeColor, "000000");
        styleParts.push(`borderw=${sw}`, `bordercolor=0x${sc}`);
      }


      if (alphaExpr) {
        styleParts.push(`alpha='${alphaExpr}'`);
      }

      // Enable text alignment by horizontal position expressions for drawtext
      if (style.textAlign === "center") {
        // already using center expression above
      }

      return `drawtext=text='${text}':${styleParts.join(":")}`;
    })
    .filter(Boolean);

  return filters.length ? filters.join(",") : null;
}
