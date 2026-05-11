import { sanitizeDrawtext, normalizeHexColor, rgbaColor } from "./utils";

function applyTextTransform(text: string, transform: string): string {
  switch (transform) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "capitalize":
      return text.replace(/\b\w/g, (c) => c.toUpperCase());
    default:
      return text;
  }
}

export function buildOverlayFilter(overlays: any[], timelineOffsetMs = 0, stageWidth = 1280, stageHeight = 720): string | null {
  if (!overlays?.length) return null;

  const sortedOverlays = [...overlays].sort((a, b) => {
    const zA = Number.isFinite(a?.zIndex) ? a.zIndex : 0;
    const zB = Number.isFinite(b?.zIndex) ? b.zIndex : 0;
    if (zA !== zB) return zA - zB;
    return (a?.timelineStartMs ?? 0) - (b?.timelineStartMs ?? 0);
  });

  const filters: string[] = [];

  for (const o of sortedOverlays) {
    let text = o.content?.text ?? "";
    
    // Apply text transform
    const textTransform = o.style?.textTransform || "none";
    text = applyTextTransform(text, textTransform);
    
    text = sanitizeDrawtext(text);
    text = text.replace(/\r?\n/g, "\\n");
    if (!text) continue;

    const style = o.style ?? {};
    const transform = o.transform ?? {};
    const bgStyle = style.background ?? {};

    const positionX = Number.isFinite(transform.x) ? transform.x : 100;
    const positionY = Number.isFinite(transform.y) ? transform.y : 100;
    const fontSize = Number.isFinite(style.fontSize) ? style.fontSize : 24;
    const fontFamily = style.fontFamily || "sans-serif";
    const fontWeight = style.fontWeight === "bold" ? ":bold" : "";
    const fontStyle = style.fontStyle === "italic" ? ":italic" : "";
    const letterSpacing = Number(style.letterSpacing) || 0;
    const lineHeight = Number(style.lineHeight) || 1.2;
    const textAlign = style.textAlign || "left";

    const start = ((o.timelineStartMs - timelineOffsetMs) / 1000).toFixed(2);
    const end = ((o.timelineStartMs + o.durationMs - timelineOffsetMs) / 1000).toFixed(2);

    const animation = o.animation;
    const startMs = o.timelineStartMs + (animation?.delayMs ?? 0);
    const animationDurationMs = Number.isFinite(animation?.durationMs) ? animation.durationMs : 500;
    const animType = animation?.type || "none";

    // Calculate alpha expression for animations
    let alphaExpr: string | null = null;
    if (animType !== "none") {
      const animStartSec = (startMs / 1000).toFixed(2);
      const animEndSec = ((startMs + animationDurationMs) / 1000).toFixed(2);
      
      if (animType === "fade-in" || animType === "scale-in" || animType === "bounce") {
        alphaExpr = `if(lt(t,${animStartSec}),0,if(lt(t,${animEndSec}),((t-${animStartSec})/${(animationDurationMs / 1000).toFixed(2)}),1))`;
      } else if (animType === "slide-in" || animType === "slide-left" || animType === "slide-right" || 
                 animType === "slide-up" || animType === "slide-down") {
        alphaExpr = `if(lt(t,${animStartSec}),0,if(lt(t,${animEndSec}),((t-${animStartSec})/${(animationDurationMs / 1000).toFixed(2)}),1))`;
      }
    }

    // Text color - check for gradient (note: FFmpeg doesn't support gradient, fallback to solid)
    let color = normalizeHexColor(style.color, "ffffff");
    const hasGradient = style.gradient?.enabled && style.gradient?.color1 && style.gradient?.color2;
    if (hasGradient) {
      color = normalizeHexColor(style.gradient.color1, "ffffff");
    }

    // Background box
    const bgEnabled = bgStyle.opacity > 0 && bgStyle.color;
    const bgColor = bgEnabled ? rgbaColor(bgStyle.color, bgStyle.opacity, "000000") : null;
    const bgRadius = Number(bgStyle.radius) || 0;
    const bgPaddingX = Number(bgStyle.paddingX) || 8;
    const bgPaddingY = Number(bgStyle.paddingY) || 4;

    // Horizontal position based on alignment
    let xExpr: string;
    if (textAlign === "center") {
      xExpr = `(${stageWidth} - text_w) / 2`;
    } else if (textAlign === "right") {
      xExpr = `${stageWidth} - text_w - ${bgPaddingX}`;
    } else {
      xExpr = `${positionX}`;
    }

    // Vertical position with line height consideration
    const verticalY = `${positionY}`;

    const styleParts: string[] = [
      `fontsize=${fontSize}`,
      `fontcolor=0x${color}`,
      `x='${xExpr}'`,
      `y='${verticalY}'`,
      `font=${fontFamily}${fontWeight}${fontStyle}`,
      `enable='between(t,${start},${end})'`,
    ];

    // Letter spacing (FFmpeg supports this via text_spacing)
    if (letterSpacing !== 0) {
      styleParts.push(`text_spacing=${letterSpacing}`);
    }

    // Background box
    if (bgColor) {
      styleParts.push(`box=1`, `boxcolor=${bgColor}`, `boxborderw=${bgPaddingX}`);
    }

    // Enhanced text shadow
    if (style.textShadow) {
      if (typeof style.textShadow === "boolean" && style.textShadow) {
        styleParts.push(`shadowx=2`, `shadowy=2`, `shadowcolor=0x00000099`);
      } else if (typeof style.textShadow === "object") {
        const sx = Number(style.textShadow.x ?? 2);
        const sy = Number(style.textShadow.y ?? 2);
        const sColor = normalizeHexColor(style.textShadow.color, "000000");
        const sAlpha = Number(style.textShadow.opacity ?? 0.66);
        const sBlur = Number(style.textShadow.blur ?? 0);
        styleParts.push(`shadowx=${sx}`, `shadowy=${sy}`, `shadowcolor=0x${sColor}${Math.round(Math.max(0, Math.min(1, sAlpha)) * 255).toString(16).padStart(2, '0')}`);
        if (sBlur > 0) {
          styleParts.push(`shadowblur=${sBlur}`);
        }
      }
    }

    // Stroke / outline
    if (Number.isFinite(style.strokeWidth) && style.strokeWidth > 0) {
      const sw = Number(style.strokeWidth || 0);
      const sc = normalizeHexColor(style.strokeColor, "000000");
      styleParts.push(`borderw=${sw}`, `bordercolor=0x${sc}`);
    }

    // Animation alpha
    if (alphaExpr) {
      styleParts.push(`alpha='${alphaExpr}'`);
    }

    filters.push(`drawtext=text='${text}':${styleParts.join(":")}`);
  }

  return filters.length ? filters.join(",") : null;
}