/**
 * Transition Renderer
 * Handles canvas-based transition effects between video clips
 * Similar to professional NLE applications (Premiere Pro, Final Cut, DaVinci Resolve)
 */

import type { Transition, TransitionEasing } from "./types";

export class TransitionRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not get 2D context from canvas");
    }
    this.ctx = ctx;
  }

  /**
   * Apply easing function to progress value
   */
  private applyEasing(progress: number, easing: TransitionEasing): number {
    switch (easing) {
      case "linear":
        return progress;
      case "ease-in":
        return progress * progress;
      case "ease-out":
        return progress * (2 - progress);
      case "ease-in-out":
        return progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
      default:
        return progress;
    }
  }

  /**
   * Render a transition between two video sources
   * @param sourceVideo - The outgoing video element
   * @param targetVideo - The incoming video element
   * @param transition - Transition configuration
   * @param progress - Transition progress (0-1)
   */
  render(
    sourceVideo: HTMLVideoElement | null,
    targetVideo: HTMLVideoElement | null,
    transition: Transition,
    progress: number
  ): void {
    const { width, height } = this.canvas;
    const easedProgress = this.applyEasing(progress, transition.easing);

    // Clear canvas
    this.ctx.clearRect(0, 0, width, height);

    // Handle cut transition (instant)
    if (transition.type === "cut") {
      if (progress >= 0.5 && targetVideo) {
        this.ctx.drawImage(targetVideo, 0, 0, width, height);
      } else if (sourceVideo) {
        this.ctx.drawImage(sourceVideo, 0, 0, width, height);
      }
      return;
    }

    // Route to specific transition renderer
    switch (transition.type) {
      // Basic transitions
      case "fade":
        this.renderFade(sourceVideo, targetVideo, easedProgress);
        break;
      case "cross-dissolve":
        this.renderCrossDissolve(sourceVideo, targetVideo, easedProgress);
        break;
      case "dip-to-black":
        this.renderDipToBlack(sourceVideo, targetVideo, easedProgress);
        break;

      // Slide transitions
      case "slide-left":
      case "slide-right":
      case "slide-up":
      case "slide-down":
        this.renderSlide(sourceVideo, targetVideo, transition, easedProgress);
        break;

      // Push transitions
      case "push-left":
      case "push-right":
      case "push-up":
      case "push-down":
        this.renderPush(sourceVideo, targetVideo, transition, easedProgress);
        break;

      // Wipe transitions
      case "wipe-left":
      case "wipe-right":
      case "wipe-top":
      case "wipe-bottom":
        this.renderLinearWipe(sourceVideo, targetVideo, transition, easedProgress);
        break;
      case "wipe-clock":
        this.renderClockWipe(sourceVideo, targetVideo, easedProgress);
        break;
      case "wipe-radial":
        this.renderRadialWipe(sourceVideo, targetVideo, easedProgress);
        break;

      // Shape wipes
      case "circle-open":
      case "circle-close":
        this.renderCircleWipe(sourceVideo, targetVideo, transition, easedProgress);
        break;
      case "diamond-open":
      case "diamond-close":
        this.renderDiamondWipe(sourceVideo, targetVideo, transition, easedProgress);
        break;
      case "square-open":
      case "square-close":
        this.renderSquareWipe(sourceVideo, targetVideo, transition, easedProgress);
        break;

      // Special transitions
      case "blur":
        this.renderBlur(sourceVideo, targetVideo, easedProgress);
        break;
      case "zoom-in":
        this.renderZoomIn(sourceVideo, targetVideo, easedProgress);
        break;
      case "zoom-out":
        this.renderZoomOut(sourceVideo, targetVideo, easedProgress);
        break;
      case "gradient-left":
      case "gradient-right":
      case "gradient-top":
      case "gradient-bottom":
        this.renderGradientWipe(sourceVideo, targetVideo, transition, easedProgress);
        break;

      default:
        // Fallback to cross-dissolve
        this.renderCrossDissolve(sourceVideo, targetVideo, easedProgress);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Basic Transitions
  // ──────────────────────────────────────────────────────────────────────────

  private renderFade(
    source: HTMLVideoElement | null,
    target: HTMLVideoElement | null,
    progress: number
  ): void {
    const { width, height } = this.canvas;

    // Draw black background
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, width, height);

    if (progress < 0.5) {
      // Fade out to black
      const fadeProgress = progress * 2;
      if (source) {
        this.ctx.globalAlpha = 1 - fadeProgress;
        this.ctx.drawImage(source, 0, 0, width, height);
      }
    } else {
      // Fade in from black
      const fadeProgress = (progress - 0.5) * 2;
      if (target) {
        this.ctx.globalAlpha = fadeProgress;
        this.ctx.drawImage(target, 0, 0, width, height);
      }
    }
    this.ctx.globalAlpha = 1;
  }

  private renderCrossDissolve(
    source: HTMLVideoElement | null,
    target: HTMLVideoElement | null,
    progress: number
  ): void {
    const { width, height } = this.canvas;

    if (source) {
      this.ctx.globalAlpha = 1 - progress;
      this.ctx.drawImage(source, 0, 0, width, height);
    }
    if (target) {
      this.ctx.globalAlpha = progress;
      this.ctx.drawImage(target, 0, 0, width, height);
    }
    this.ctx.globalAlpha = 1;
  }

  private renderDipToBlack(
    source: HTMLVideoElement | null,
    target: HTMLVideoElement | null,
    progress: number
  ): void {
    const { width, height } = this.canvas;

    if (progress < 0.5) {
      // Fade source to black
      const fadeProgress = progress * 2;
      if (source) {
        this.ctx.globalAlpha = 1 - fadeProgress;
        this.ctx.drawImage(source, 0, 0, width, height);
      }
    } else if (progress > 0.5) {
      // Fade in target from black
      const fadeProgress = (progress - 0.5) * 2;
      if (target) {
        this.ctx.globalAlpha = fadeProgress;
        this.ctx.drawImage(target, 0, 0, width, height);
      }
    }
    this.ctx.globalAlpha = 1;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Slide Transitions
  // ──────────────────────────────────────────────────────────────────────────

  private renderSlide(
    source: HTMLVideoElement | null,
    target: HTMLVideoElement | null,
    transition: Transition,
    progress: number
  ): void {
    const { width, height } = this.canvas;
    const direction = transition.direction || "left";

    let sourceX = 0, sourceY = 0;
    let targetX = 0, targetY = 0;

    switch (direction) {
      case "left":
        sourceX = width * progress;
        targetX = -width * (1 - progress);
        break;
      case "right":
        sourceX = -width * progress;
        targetX = width * (1 - progress);
        break;
      case "top":
        sourceY = height * progress;
        targetY = -height * (1 - progress);
        break;
      case "bottom":
        sourceY = -height * progress;
        targetY = height * (1 - progress);
        break;
    }

    if (target) {
      this.ctx.drawImage(target, targetX, targetY, width, height);
    }
    if (source) {
      this.ctx.drawImage(source, sourceX, sourceY, width, height);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Push Transitions
  // ──────────────────────────────────────────────────────────────────────────

  private renderPush(
    source: HTMLVideoElement | null,
    target: HTMLVideoElement | null,
    transition: Transition,
    progress: number
  ): void {
    const { width, height } = this.canvas;
    const direction = transition.direction || "left";

    let sourceOffset = 0;
    let targetOffset = 0;

    switch (direction) {
      case "left":
        sourceOffset = width * progress;
        targetOffset = -width + (width * progress);
        break;
      case "right":
        sourceOffset = -width * progress;
        targetOffset = width - (width * progress);
        break;
      case "top":
        sourceOffset = height * progress;
        targetOffset = -height + (height * progress);
        break;
      case "bottom":
        sourceOffset = -height * progress;
        targetOffset = height - (height * progress);
        break;
    }

    if (target) {
      this.ctx.drawImage(target, targetOffset, direction === "left" || direction === "right" ? 0 : targetOffset, width, height);
    }
    if (source) {
      this.ctx.drawImage(source, sourceOffset, direction === "left" || direction === "right" ? 0 : sourceOffset, width, height);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Linear Wipe Transitions
  // ──────────────────────────────────────────────────────────────────────────

  private renderLinearWipe(
    source: HTMLVideoElement | null,
    target: HTMLVideoElement | null,
    transition: Transition,
    progress: number
  ): void {
    const { width, height } = this.canvas;
    const direction = transition.direction || "left";

    // Draw target first (revealed area)
    if (target) {
      this.ctx.save();
      this.ctx.beginPath();

      switch (direction) {
        case "left":
          this.ctx.rect(0, 0, width * progress, height);
          break;
        case "right":
          this.ctx.rect(width * (1 - progress), 0, width * progress, height);
          break;
        case "top":
          this.ctx.rect(0, 0, width, height * progress);
          break;
        case "bottom":
          this.ctx.rect(0, height * (1 - progress), width, height * progress);
          break;
      }

      this.ctx.clip();
      this.ctx.drawImage(target, 0, 0, width, height);
      this.ctx.restore();
    }

    // Draw source (remaining area)
    if (source) {
      this.ctx.save();
      this.ctx.beginPath();

      switch (direction) {
        case "left":
          this.ctx.rect(width * progress, 0, width * (1 - progress), height);
          break;
        case "right":
          this.ctx.rect(0, 0, width * (1 - progress), height);
          break;
        case "top":
          this.ctx.rect(0, height * progress, width, height * (1 - progress));
          break;
        case "bottom":
          this.ctx.rect(0, 0, width, height * (1 - progress));
          break;
      }

      this.ctx.clip();
      this.ctx.drawImage(source, 0, 0, width, height);
      this.ctx.restore();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Clock Wipe
  // ──────────────────────────────────────────────────────────────────────────

  private renderClockWipe(
    source: HTMLVideoElement | null,
    target: HTMLVideoElement | null,
    progress: number
  ): void {
    const { width, height } = this.canvas;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.max(width, height) / 2;

    // Draw target (wiped area)
    if (target) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.moveTo(centerX, centerY);
      this.ctx.arc(centerX, centerY, radius, -Math.PI / 2, (-Math.PI / 2) + (2 * Math.PI * progress), false);
      this.ctx.closePath();
      this.ctx.clip();
      this.ctx.drawImage(target, 0, 0, width, height);
      this.ctx.restore();
    }

    // Draw source (remaining area)
    if (source) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.moveTo(centerX, centerY);
      this.ctx.arc(centerX, centerY, radius, (-Math.PI / 2) + (2 * Math.PI * progress), (-Math.PI / 2) + (2 * Math.PI), false);
      this.ctx.closePath();
      this.ctx.clip();
      this.ctx.drawImage(source, 0, 0, width, height);
      this.ctx.restore();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Radial Wipe
  // ──────────────────────────────────────────────────────────────────────────

  private renderRadialWipe(
    source: HTMLVideoElement | null,
    target: HTMLVideoElement | null,
    progress: number
  ): void {
    const { width, height } = this.canvas;
    const centerX = width / 2;
    const centerY = height / 2;

    // Draw target (expanding circle)
    if (target) {
      this.ctx.save();
      this.ctx.beginPath();
      const currentRadius = Math.max(width, height) * progress;
      this.ctx.arc(centerX, centerY, currentRadius, 0, 2 * Math.PI);
      this.ctx.clip();
      this.ctx.drawImage(target, 0, 0, width, height);
      this.ctx.restore();
    }

    // Draw source (outside circle)
    if (source) {
      this.ctx.save();
      this.ctx.beginPath();
      const currentRadius = Math.max(width, height) * progress;
      this.ctx.rect(0, 0, width, height);
      this.ctx.arc(centerX, centerY, currentRadius, 0, 2 * Math.PI, true);
      this.ctx.clip();
      this.ctx.drawImage(source, 0, 0, width, height);
      this.ctx.restore();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Shape Wipes
  // ──────────────────────────────────────────────────────────────────────────

  private renderCircleWipe(
    source: HTMLVideoElement | null,
    target: HTMLVideoElement | null,
    transition: Transition,
    progress: number
  ): void {
    const { width, height } = this.canvas;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.sqrt(width * width + height * height) / 2;
    const isOpen = transition.type === "circle-open";

    const currentRadius = isOpen ? maxRadius * progress : maxRadius * (1 - progress);

    if (target) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, currentRadius, 0, 2 * Math.PI);
      this.ctx.clip();
      this.ctx.drawImage(target, 0, 0, width, height);
      this.ctx.restore();
    }

    if (source) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(0, 0, width, height);
      this.ctx.arc(centerX, centerY, currentRadius, 0, 2 * Math.PI, true);
      this.ctx.clip();
      this.ctx.drawImage(source, 0, 0, width, height);
      this.ctx.restore();
    }
  }

  private renderDiamondWipe(
    source: HTMLVideoElement | null,
    target: HTMLVideoElement | null,
    transition: Transition,
    progress: number
  ): void {
    const { width, height } = this.canvas;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxSize = Math.max(width, height);
    const isOpen = transition.type === "diamond-open";

    const currentSize = isOpen ? maxSize * progress : maxSize * (1 - progress);

    if (target) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.moveTo(centerX, centerY - currentSize);
      this.ctx.lineTo(centerX + currentSize, centerY);
      this.ctx.lineTo(centerX, centerY + currentSize);
      this.ctx.lineTo(centerX - currentSize, centerY);
      this.ctx.closePath();
      this.ctx.clip();
      this.ctx.drawImage(target, 0, 0, width, height);
      this.ctx.restore();
    }

    if (source) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(0, 0, width, height);
      this.ctx.moveTo(centerX, centerY - currentSize);
      this.ctx.lineTo(centerX + currentSize, centerY);
      this.ctx.lineTo(centerX, centerY + currentSize);
      this.ctx.lineTo(centerX - currentSize, centerY);
      this.ctx.closePath();
      this.ctx.clip("evenodd");
      this.ctx.drawImage(source, 0, 0, width, height);
      this.ctx.restore();
    }
  }

  private renderSquareWipe(
    source: HTMLVideoElement | null,
    target: HTMLVideoElement | null,
    transition: Transition,
    progress: number
  ): void {
    const { width, height } = this.canvas;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxSize = Math.max(width, height);
    const isOpen = transition.type === "square-open";

    const currentSize = isOpen ? maxSize * progress : maxSize * (1 - progress);

    if (target) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(centerX - currentSize, centerY - currentSize, currentSize * 2, currentSize * 2);
      this.ctx.clip();
      this.ctx.drawImage(target, 0, 0, width, height);
      this.ctx.restore();
    }

    if (source) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(0, 0, width, height);
      this.ctx.rect(centerX - currentSize, centerY - currentSize, currentSize * 2, currentSize * 2);
      this.ctx.clip("evenodd");
      this.ctx.drawImage(source, 0, 0, width, height);
      this.ctx.restore();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Special Transitions
  // ──────────────────────────────────────────────────────────────────────────

  private renderBlur(
    source: HTMLVideoElement | null,
    target: HTMLVideoElement | null,
    progress: number
  ): void {
    const { width, height } = this.canvas;

    // Apply blur to source during first half, then reveal target
    if (progress < 0.5) {
      const blurAmount = progress * 40; // Max 20px blur
      if (source) {
        this.ctx.filter = `blur(${blurAmount}px)`;
        this.ctx.drawImage(source, 0, 0, width, height);
        this.ctx.filter = "none";
      }
    } else {
      const blurAmount = (1 - progress) * 40;
      if (target) {
        this.ctx.filter = `blur(${blurAmount}px)`;
        this.ctx.drawImage(target, 0, 0, width, height);
        this.ctx.filter = "none";
      }
    }
  }

  private renderZoomIn(
    source: HTMLVideoElement | null,
    target: HTMLVideoElement | null,
    progress: number
  ): void {
    const { width, height } = this.canvas;
    const scale = 1 + progress * 0.5; // Zoom from 1x to 1.5x

    if (target) {
      this.ctx.save();
      this.ctx.translate(width / 2, height / 2);
      this.ctx.scale(scale, scale);
      this.ctx.drawImage(target, -width / 2, -height / 2, width, height);
      this.ctx.restore();
    }

    if (source && progress < 1) {
      this.ctx.globalAlpha = 1 - progress;
      this.ctx.drawImage(source, 0, 0, width, height);
      this.ctx.globalAlpha = 1;
    }
  }

  private renderZoomOut(
    source: HTMLVideoElement | null,
    target: HTMLVideoElement | null,
    progress: number
  ): void {
    const { width, height } = this.canvas;
    const scale = 1.5 - progress * 0.5; // Zoom from 1.5x to 1x

    if (source && progress < 0.5) {
      this.ctx.save();
      this.ctx.translate(width / 2, height / 2);
      this.ctx.scale(scale, scale);
      this.ctx.drawImage(source, -width / 2, -height / 2, width, height);
      this.ctx.restore();
    }

    if (target) {
      this.ctx.globalAlpha = progress;
      this.ctx.drawImage(target, 0, 0, width, height);
      this.ctx.globalAlpha = 1;
    }
  }

  private renderGradientWipe(
    source: HTMLVideoElement | null,
    target: HTMLVideoElement | null,
    transition: Transition,
    progress: number
  ): void {
    const { width, height } = this.canvas;
    const direction = transition.direction || "left";

    let clipRect: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: width, h: height };
    let gradientRect: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: width, h: height };
    let gradientStart = 0;
    let gradientEnd = 0;

    switch (direction) {
      case "left":
        clipRect = { x: width * (1 - progress), y: 0, w: width, h: height };
        gradientRect = { x: 0, y: 0, w: width, h: height };
        gradientStart = width * (1 - progress);
        gradientEnd = width * (1 - progress) + width * progress;
        break;
      case "right":
        clipRect = { x: 0, y: 0, w: width * (1 - progress), h: height };
        gradientRect = { x: 0, y: 0, w: width, h: height };
        gradientStart = width * progress;
        gradientEnd = width - width * progress;
        break;
      case "top":
        clipRect = { x: 0, y: height * (1 - progress), w: width, h: height };
        gradientRect = { x: 0, y: 0, w: width, h: height };
        gradientStart = height * (1 - progress);
        gradientEnd = height * (1 - progress) + height * progress;
        break;
      case "bottom":
        clipRect = { x: 0, y: 0, w: width, h: height * (1 - progress) };
        gradientRect = { x: 0, y: 0, w: width, h: height };
        gradientStart = height * progress;
        gradientEnd = height - height * progress;
        break;
    }

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(clipRect.x, clipRect.y, clipRect.w, clipRect.h);
    this.ctx.clip();

    const gradient = this.ctx.createLinearGradient(
      direction === "left" || direction === "right" ? gradientStart : 0,
      direction === "top" || direction === "bottom" ? gradientStart : 0,
      direction === "left" || direction === "right" ? gradientEnd : width,
      direction === "top" || direction === "bottom" ? gradientEnd : height
    );
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.5, "rgba(0,0,0,0.3)");
    gradient.addColorStop(1, "rgba(0,0,0,1)");

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(gradientRect.x, gradientRect.y, gradientRect.w, gradientRect.h);

    if (target) {
      this.ctx.drawImage(target, 0, 0, width, height);
    }

    if (source) {
      this.ctx.globalAlpha = 1 - progress;
      this.ctx.drawImage(source, 0, 0, width, height);
      this.ctx.globalAlpha = 1;
    }

    this.ctx.restore();

    if (source) {
      this.ctx.save();
      this.ctx.beginPath();
      let remainingRect: { x: number; y: number; w: number; h: number };
      switch (direction) {
        case "left":
          remainingRect = { x: 0, y: 0, w: width * (1 - progress), h: height };
          break;
        case "right":
          remainingRect = { x: width * (1 - progress), y: 0, w: width * progress, h: height };
          break;
        case "top":
          remainingRect = { x: 0, y: 0, w: width, h: height * (1 - progress) };
          break;
        case "bottom":
          remainingRect = { x: 0, y: height * (1 - progress), w: width, h: height * progress };
          break;
        default:
          remainingRect = { x: 0, y: 0, w: width * (1 - progress), h: height };
      }
      this.ctx.rect(remainingRect.x, remainingRect.y, remainingRect.w, remainingRect.h);
      this.ctx.clip();
      this.ctx.drawImage(source, 0, 0, width, height);
      this.ctx.restore();
    }
  }
}
