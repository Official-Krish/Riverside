import { sanitizeDrawtext, normalizeHexColor } from "./utils";

function applyTextTransform(text: string, transform: string): string {
  switch (transform) {
    case "uppercase": return text.toUpperCase();
    case "lowercase": return text.toLowerCase();
    case "capitalize": return text.replace(/\b\w/g, (c) => c.toUpperCase());
    default: return text;
  }
}

function buildSingleOverlayFilter(o: any, timelineOffsetMs = 0): string | null {
  let text = o.content?.text ?? "";
  if (!text) return null;

  const textTransform = o.style?.textTransform || "none";
  text = applyTextTransform(text, textTransform);
  text = sanitizeDrawtext(text).replace(/\r?\n/g, "\\n");
  if (!text) return null;

  const style = o.style ?? {};
  const transform = o.transform ?? {};

  const positionX = Number.isFinite(transform.x) ? transform.x : 100;
  const positionY = Number.isFinite(transform.y) ? transform.y : 100;
  const fontSize = Number.isFinite(style.fontSize) ? style.fontSize : 24;

  // FIX 1: Take only the first font name from a CSS font-family stack
  const rawFont = style.fontFamily || "sans-serif";
  const fontFamily = rawFont.split(",")[0].trim().replace(/['"]/g, "");

  const fontWeight = style.fontWeight === "bold" ? ":bold" : "";
  const fontStyle = style.fontStyle === "italic" ? ":italic" : "";
  const letterSpacing = Number(style.letterSpacing) || 0;
  const textAlign = style.textAlign || "left";

  const startSec = ((o.timelineStartMs - timelineOffsetMs) / 1000).toFixed(3);
  const endSec = ((o.timelineStartMs + o.durationMs - timelineOffsetMs) / 1000).toFixed(3);

  let xValue: string;
  if (textAlign === "center") {
    xValue = `(w-text_w)/2`;
  } else if (textAlign === "right") {
    xValue = `w-text_w-${positionX}`;
  } else {
    xValue = `${positionX}`;
  }

  const parts: string[] = [
    `fontsize=${fontSize}`,
    `fontcolor=0x${normalizeHexColor(style.color, "ffffff")}`,
    `x=${xValue}`,
    `y=${positionY}`,
    `font=${fontFamily}${fontWeight}${fontStyle}`,  // single clean font name
  ];

  if (letterSpacing !== 0) parts.push(`text_spacing=${letterSpacing}`);

  const bgStyle = style.background ?? {};
  const bgEnabled = bgStyle.opacity > 0 && bgStyle.color;
  if (bgEnabled) {
    const alphaHex = Math.round(Math.max(0, Math.min(1, bgStyle.opacity ?? 1)) * 255)
      .toString(16).padStart(2, "0");
    parts.push(`box=1`);
    parts.push(`boxcolor=0x${normalizeHexColor(bgStyle.color, "000000")}${alphaHex}`);
    parts.push(`boxborderw=${Number(bgStyle.paddingX) || 8}`);
  }

  if (style.textShadow) {
    let sx = 2, sy = 2, sColor = "000000", sAlpha = 0.66, sBlur = 0;
    if (typeof style.textShadow === "object") {
      sx = Number(style.textShadow.x ?? 2);
      sy = Number(style.textShadow.y ?? 2);
      sColor = normalizeHexColor(style.textShadow.color, "000000");
      sAlpha = Number(style.textShadow.opacity ?? 0.66);
      sBlur = Number(style.textShadow.blur ?? 0);
    }
    const sAlphaHex = Math.round(sAlpha * 255).toString(16).padStart(2, "0");
    parts.push(`shadowx=${sx}`, `shadowy=${sy}`, `shadowcolor=0x${sColor}${sAlphaHex}`);
    if (sBlur > 0) parts.push(`shadowblur=${sBlur}`);
  }

  if (Number.isFinite(style.strokeWidth) && style.strokeWidth > 0) {
    const sc = normalizeHexColor(style.strokeColor, "000000");
    parts.push(`borderw=${style.strokeWidth}`, `bordercolor=0x${sc}`);
  }

  const animation = o.animation;
  let alphaExpr: string | null = null;
  if (animation && animation.type !== "none") {
    const animStartMs = o.timelineStartMs + (animation.delayMs ?? 0);
    const animDurationSec = (Number(animation.durationMs) || 500) / 1000;
    const animStartSec = (animStartMs / 1000).toFixed(3);
    const animEndSec = (animStartMs / 1000 + animDurationSec).toFixed(3);
    // FIX 2 (alpha expr): commas inside expressions must be escaped when
    // the whole filter is later joined with commas as a filter chain
    alphaExpr = `if(lt(t\\,${animStartSec})\\,0\\,if(lt(t\\,${animEndSec})\\,(t-${animStartSec})/${animDurationSec}\\,1))`;
  }

  if (alphaExpr) parts.push(`alpha='${alphaExpr}'`);

  // FIX 2 (enable): no surrounding single quotes; escape internal commas
  return `drawtext=text='${text}':${parts.join(":")}:enable=between(t\\,${startSec}\\,${endSec})`;
}

export function buildOverlayFilter(
  overlays: any[],
  timelineOffsetMs = 0,
): string | null {
  if (!overlays?.length) return null;

  const sorted = [...overlays]
    .filter(o => o.content?.text)
    .sort((a, b) => {
      const za = a?.zIndex ?? 0;
      const zb = b?.zIndex ?? 0;
      if (za !== zb) return za - zb;
      return (a?.timelineStartMs ?? 0) - (b?.timelineStartMs ?? 0);
    });

  const filters = sorted
    .map(o => buildSingleOverlayFilter(o, timelineOffsetMs))
    .filter(Boolean) as string[];

  return filters.length ? filters.join(",") : null;
}