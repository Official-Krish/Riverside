import type { Overlay, ClipTransition } from "../../types";
import { TransitionRenderer } from "../../transitions/TransitionRenderer";

export interface RenderState {
  stretchX: number;
  stretchY: number;
  offsetX: number;
  offsetY: number;
  trimStart: number; // seconds
  trimEnd: number; // seconds
  videoAlpha: number;
  // Transition support
  activeTransition?: {
    type: ClipTransition;
    progress: number; // 0-1
    position?: "start" | "end"; // Whether this is a clip start or end transition
    sourceVideo?: HTMLVideoElement;
    targetVideo?: HTMLVideoElement;
  };
}

export interface RenderOverlay {
  overlay: Overlay;
  timelineTimeMs: number;
}

// Global transition renderer (shared across frames)
let transitionRenderer: TransitionRenderer | null = null;

/**
 * Starts a requestAnimationFrame render loop that draws the video onto
 * the canvas with transform state applied, plus composites text overlays.
 *
 * Returns a `stop()` function to cancel the loop.
 */
export function startRenderLoop(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  getState: () => RenderState,
  getOverlays?: () => RenderOverlay[],
  onFrame?: (videoTimeMs: number) => void
): () => void {
  let animId = 0;
  let running = true;

  // Initialize transition renderer once
  if (!transitionRenderer) {
    transitionRenderer = new TransitionRenderer(canvas);
  }

  function render() {
    if (!running) return;

    const state = getState();
    const {
      stretchX,
      stretchY,
      offsetX,
      offsetY,
      trimStart,
      trimEnd,
      videoAlpha,
      activeTransition,
    } = state;

    // Trim enforcement
    if (trimStart > 0 && video.currentTime < trimStart) {
      video.currentTime = trimStart;
    }
    if (trimEnd > 0 && video.currentTime > trimEnd) {
      video.pause();
    }

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Handle transition rendering
    if (activeTransition && transitionRenderer) {
      const { type, progress, sourceVideo, targetVideo } = activeTransition;

      // Convert ClipTransition to Transition format for the renderer
      const transition = {
        id: "active",
        type: type.type,
        category: "basic" as const,
        name: type.type,
        durationMs: type.durationMs,
        position: "between" as const,
        easing: type.easing,
        direction: type.direction,
        borderWidth: type.borderWidth,
        borderColor: type.borderColor,
        reverse: type.reverse,
      };

      // For single-clip start transitions: fade from black to video
      // For single-clip end transitions: fade from video to black
      if (!sourceVideo && !targetVideo) {
        // Single-clip transition — determine if video is source or target
        if (activeTransition.position === "start") {
          // Start transition: video is FADING IN → video is the target
          transitionRenderer.render(null, video, transition, progress);
        } else {
          // End transition: video is FADING OUT → video is the source
          transitionRenderer.render(video, null, transition, progress);
        }
      } else {
        // Multi-clip transition with explicit source/target
        transitionRenderer.render(
          sourceVideo ?? video,
          targetVideo ?? null,
          transition,
          progress
        );
      }
    } else {
      // Normal rendering without transition
      ctx.save();
      ctx.globalAlpha = videoAlpha;
      const drawW = canvas.width * stretchX;
      const drawH = canvas.height * stretchY;
      const drawX = (canvas.width - drawW) / 2 + offsetX;
      const drawY = (canvas.height - drawH) / 2 + offsetY;

      ctx.drawImage(video, drawX, drawY, drawW, drawH);
      ctx.restore();
    }

    // Draw overlays
    if (getOverlays) {
      const items = getOverlays();
      const currentTimeMs = video.currentTime * 1000;
      for (const item of items) {
        drawTextOverlay(ctx, item.overlay, canvas.width, canvas.height, currentTimeMs);
      }
    }

    // Report frame time
    onFrame?.(video.currentTime * 1000);

    animId = requestAnimationFrame(render);
  }

  render();

  return () => {
    running = false;
    cancelAnimationFrame(animId);
  };
}

/**
 * Draw a single frame on the canvas (used for seek/pause states).
 */
export function drawSingleFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  state: RenderState,
  overlays?: RenderOverlay[]
) {
  const { stretchX, stretchY, offsetX, offsetY, videoAlpha, activeTransition } = state;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Handle transition rendering
  if (activeTransition && transitionRenderer) {
    const { type, progress, sourceVideo, targetVideo } = activeTransition;

    const transition = {
      id: "active",
      type: type.type,
      category: "basic" as const,
      name: type.type,
      durationMs: type.durationMs,
      position: "between" as const,
      easing: type.easing,
      direction: type.direction,
      borderWidth: type.borderWidth,
      borderColor: type.borderColor,
      reverse: type.reverse,
    };

    if (!sourceVideo && !targetVideo) {
      // Single-clip transition — determine if video is source or target
      if (activeTransition.position === "start") {
        transitionRenderer.render(null, video, transition, progress);
      } else {
        transitionRenderer.render(video, null, transition, progress);
      }
    } else {
      transitionRenderer.render(
        sourceVideo ?? video,
        targetVideo ?? null,
        transition,
        progress
      );
    }
  } else {
    ctx.save();
    ctx.globalAlpha = videoAlpha;
    const drawW = canvas.width * stretchX;
    const drawH = canvas.height * stretchY;
    const drawX = (canvas.width - drawW) / 2 + offsetX;
    const drawY = (canvas.height - drawH) / 2 + offsetY;
    ctx.drawImage(video, drawX, drawY, drawW, drawH);
    ctx.restore();
  }

  if (overlays) {
    const currentTimeMs = video.currentTime * 1000;
    for (const item of overlays) {
      drawTextOverlay(ctx, item.overlay, canvas.width, canvas.height, currentTimeMs);
    }
  }
}

/**
 * Render a text overlay onto the canvas using the 2D context.
 */
function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: Overlay,
  canvasW: number,
  canvasH: number,
  currentTimeMs: number = 0
) {
  const { content, transform, style } = overlay;
  const text = content.text;
  if (!text) return;

  // Calculate animation state
  const animState = calculateOverlayAnimation(overlay, currentTimeMs);
  if (!animState.shouldRender) return;

  const scaleX = canvasW / 1280;
  const scaleY = canvasH / 720;

  ctx.save();
  ctx.scale(scaleX, scaleY);

  ctx.globalAlpha = animState.alpha;
  ctx.translate(animState.offsetX, animState.offsetY);
  if (animState.scale !== 1) {
    ctx.scale(animState.scale, animState.scale);
  }

  const fontSize = style?.fontSize || 24;
  const fontFamily = style?.fontFamily || "Inter, system-ui, sans-serif";
  const fontWeight = style?.fontWeight === "bold" ? "bold" : "normal";
  const fontStyle = style?.fontStyle === "italic" ? "italic" : "normal";
  const color = style?.color || "#ffffff";
  const textAlign = style?.textAlign || "left";
  const lineHeight = style?.lineHeight || 1.2;
  const letterSpacing = style?.letterSpacing || 0;
  const underline = Boolean(style?.underline);
  const strike = Boolean(style?.strikeThrough);
  const strokeWidth = Number(style?.strokeWidth || 0);
  const strokeColor = style?.strokeColor || "#000000";
  const maxWidth = style?.maxWidth || null;

  // Background style from new structure
  const bgStyle = style?.background;
  const bgColor = bgStyle?.color || "#000000";
  const bgOpacity = bgStyle?.opacity ?? 0;
  const bgRadius = bgStyle?.radius ?? 6;
  const bgPaddingX = bgStyle?.paddingX ?? 8;
  const bgPaddingY = bgStyle?.paddingY ?? 4;

  // Prepare lines (support explicit newlines + optional soft wrapping)
  const rawLines = String(text).split("\n");

  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textAlign = textAlign as CanvasTextAlign;
  ctx.textBaseline = "top";

  const wrappedLines =
    maxWidth && maxWidth > 0
      ? rawLines.flatMap((line) => wrapLine(ctx, line, maxWidth, letterSpacing))
      : rawLines;

  // background box
  if (bgOpacity > 0) {
    // compute width by longest line
    let widest = 0;
    for (const ln of wrappedLines) {
      const m = ctx.measureText(ln).width + (letterSpacing * Math.max(0, ln.length - 1));
      if (m > widest) widest = m;
    }
    const bgX = transform.x - bgPaddingX;
    const bgY = transform.y - bgPaddingY;
    const bgW = widest + bgPaddingX * 2;
    const bgH = wrappedLines.length * (fontSize * lineHeight) + bgPaddingY * 2;

    ctx.save();
    ctx.globalAlpha = bgOpacity;
    ctx.fillStyle = bgColor;
    if (bgRadius > 0) {
      const r = bgRadius;
      // rounded rect
      roundRect(ctx, bgX, bgY, bgW, bgH, r);
      ctx.fill();
    } else {
      ctx.fillRect(bgX, bgY, bgW, bgH);
    }
    ctx.restore();
  }

  // shadow
  if (style?.textShadow) {
    if (typeof style.textShadow === "boolean") {
      if (style.textShadow) {
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
      }
    } else {
      ctx.shadowColor = style.textShadow.color || "rgba(0,0,0,0.6)";
      ctx.shadowBlur = Number(style.textShadow.blur ?? 4);
      ctx.shadowOffsetX = Number(style.textShadow.x ?? 1);
      ctx.shadowOffsetY = Number(style.textShadow.y ?? 1);
    }
  }

  // stroke/outline
  if (strokeWidth > 0) {
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = strokeColor;
  }

  // Render lines with optional letter spacing
  let y = transform.y;
  for (const ln of wrappedLines) {
    if (letterSpacing && letterSpacing !== 0) {
      let x = transform.x;
      // adjust starting x for alignment
      if (textAlign === "center") {
        const totalW = measureTextWithLetterSpacing(ctx, ln, letterSpacing);
        x = transform.x - totalW / 2;
      } else if (textAlign === "right") {
        const totalW = measureTextWithLetterSpacing(ctx, ln, letterSpacing);
        x = transform.x - totalW;
      }
      for (let i = 0; i < ln.length; i++) {
        const ch = ln[i];
        if (strokeWidth > 0) ctx.strokeText(ch, x, y);
        ctx.fillText(ch, x, y);
        x += ctx.measureText(ch).width + letterSpacing;
      }
    } else {
      if (strokeWidth > 0) ctx.strokeText(ln, transform.x, y);
      ctx.fillText(ln, transform.x, y);
    }

    // underline
    if (underline) {
      const metrics = ctx.measureText(ln);
      let lineX = transform.x;
      if (textAlign === "center") lineX = transform.x - metrics.width / 2;
      if (textAlign === "right") lineX = transform.x - metrics.width;
      const underlineY = y + fontSize + 2;
      ctx.fillRect(lineX, underlineY, metrics.width, Math.max(1, Math.round(fontSize * 0.06)));
    }

    // strike-through
    if (strike) {
      const metrics = ctx.measureText(ln);
      let lineX = transform.x;
      if (textAlign === "center") lineX = transform.x - metrics.width / 2;
      if (textAlign === "right") lineX = transform.x - metrics.width;
      const strikeY = y + fontSize * 0.45;
      ctx.fillRect(lineX, strikeY, metrics.width, Math.max(1, Math.round(fontSize * 0.06)));
    }

    y += fontSize * lineHeight;
  }

  ctx.restore();
}

function wrapLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  letterSpacing: number
) {
  if (!text) return [""];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const next = `${current} ${words[i]}`;
    const nextWidth = measureTextWithLetterSpacing(ctx, next, letterSpacing);
    if (nextWidth <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

function measureTextWithLetterSpacing(ctx: CanvasRenderingContext2D, text: string, letterSpacing: number) {
  let w = 0;
  for (const ch of text) {
    w += ctx.measureText(ch).width + letterSpacing;
  }
  return w - letterSpacing;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Calculate animation state based on current time
 */
export function calculateOverlayAnimation(
  overlay: Overlay,
  currentTimeMs: number
): { offsetX: number; offsetY: number; alpha: number; scale: number; shouldRender: boolean } {
  const anim = overlay.animation;
  if (!anim || anim.type === "none") {
    return { offsetX: 0, offsetY: 0, alpha: 1, scale: 1, shouldRender: true };
  }

  const startMs = overlay.timelineStartMs;
  const animStartMs = startMs + (anim.delayMs || 0);
  const animEndMs = animStartMs + anim.durationMs;
  const endMs = startMs + overlay.durationMs;
  const exitStartMs = endMs - anim.durationMs;

  if (currentTimeMs < animStartMs) {
    return { offsetX: 0, offsetY: 0, alpha: 0, scale: 1, shouldRender: false };
  }

  if (currentTimeMs >= animStartMs && currentTimeMs < animEndMs) {
    const progress = (currentTimeMs - animStartMs) / anim.durationMs;
    const easedProgress = easeOutCubic(Math.min(1, Math.max(0, progress)));
    return applyAnimationTransform(anim.type, easedProgress, 1);
  }

  if (currentTimeMs >= animEndMs && currentTimeMs < exitStartMs) {
    return { offsetX: 0, offsetY: 0, alpha: 1, scale: 1, shouldRender: true };
  }

  if (currentTimeMs >= exitStartMs && currentTimeMs < endMs && anim.direction === "both") {
    const exitProgress = (currentTimeMs - exitStartMs) / anim.durationMs;
    const easedProgress = easeOutCubic(Math.min(1, Math.max(0, exitProgress)));
    return applyAnimationTransform(anim.type, easedProgress, 0);
  }

  return { offsetX: 0, offsetY: 0, alpha: 0, scale: 1, shouldRender: false };
}

function applyAnimationTransform(type: string, progress: number, direction: 1 | 0): { offsetX: number; offsetY: number; alpha: number; scale: number; shouldRender: boolean } {
  const p = direction === 1 ? progress : (1 - progress);
  
  switch (type) {
    case "fade-in":
      return { offsetX: 0, offsetY: 0, alpha: p, scale: 1, shouldRender: true };
    case "slide-in":
    case "slide-left":
      return { offsetX: (1 - p) * -200, offsetY: 0, alpha: 1, scale: 1, shouldRender: true };
    case "slide-right":
      return { offsetX: (1 - p) * 200, offsetY: 0, alpha: 1, scale: 1, shouldRender: true };
    case "slide-up":
      return { offsetX: 0, offsetY: (1 - p) * -100, alpha: 1, scale: 1, shouldRender: true };
    case "slide-down":
      return { offsetX: 0, offsetY: (1 - p) * 100, alpha: 1, scale: 1, shouldRender: true };
    case "scale-in":
      return { offsetX: 0, offsetY: 0, alpha: 1, scale: 0.5 + p * 0.5, shouldRender: true };
    case "bounce": {
      const bounce = Math.sin(p * Math.PI * 2) * (1 - p) * 50;
      return { offsetX: 0, offsetY: bounce, alpha: 1, scale: 1, shouldRender: true };
    }
    case "typewriter":
      return { offsetX: 0, offsetY: 0, alpha: 1, scale: 1, shouldRender: true };
    default:
      return { offsetX: 0, offsetY: 0, alpha: 1, scale: 1, shouldRender: true };
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
