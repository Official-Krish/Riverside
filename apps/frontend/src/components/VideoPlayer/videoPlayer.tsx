/* eslint-disable react-hooks/exhaustive-deps */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import Hls, { Level } from "hls.js";
import {
  FullscreenExitIcon,
  FullscreenEnterIcon,
  PauseIcon,
  PipIcon,
  PlayIcon,
  SeekBackIcon,
  SeekForwardIcon,
  SettingsIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeOffIcon,
  ControlBtn,
} from "./icons";
import { fmt, resolveThumbnailUrl, toSec } from "./helpers";
import { SLIDER_STYLE } from "./SliderStyle";
import type { HLSPlayerProps, Thumbnail } from "./types";

export default function HLSPlayer({
  src,
  poster,
  thumbnailVtt,
  className = "",
}: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);

  // HLS state
  const [levels, setLevels] = useState<Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Volume
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);

  // Quality menu
  const [showQuality, setShowQuality] = useState(false);

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);

  // UI visibility
  const [controlsVisible, setControlsVisible] = useState(true);

  // Thumbnails
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);

  // Seeking state (for track fill)
  const seekBarRef = useRef<HTMLInputElement | null>(null);
  const seekTrackRef = useRef<HTMLDivElement | null>(null);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [seekTrackWidth, setSeekTrackWidth] = useState(0);

  // Style injection
  useEffect(() => {
    const id = "hls-player-styles";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = SLIDER_STYLE;
      document.head.appendChild(style);
    }
  }, []);

  // HLS setup
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls({ startLevel: -1 });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => setLevels(hls.levels));
      hls.on(Hls.Events.LEVEL_SWITCHED, (_, d) => setCurrentLevel(d.level));
      hls.on(Hls.Events.FRAG_LOADING, () => setIsBuffering(true));
      hls.on(Hls.Events.FRAG_BUFFERED, () => setIsBuffering(false));
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [src]);

  // VTT parser
  useEffect(() => {
    if (!thumbnailVtt) return;

    fetch(thumbnailVtt)
      .then((r) => r.text())
      .then((text) => {
        const lines = text.replace(/\r\n/g, "\n").split("\n");
        const parsed: Thumbnail[] = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          // Time line: "00:00:00.000 --> 00:00:05.000"
          if (!line.includes("-->")) continue;

          const [startStr, endStr] = line.split("-->").map((s) => s.trim());
          const urlLine = lines[i + 1]?.trim();
          if (!urlLine) continue;

          const start = toSec(startStr);
          const end = toSec(endStr);
          if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
            continue;

          const hashIdx = urlLine.lastIndexOf("#xywh=");
          if (hashIdx === -1) continue;

          const rawUrl = urlLine.slice(0, hashIdx);
          const [x, y, w, h] = urlLine
            .slice(hashIdx + 6)
            .split(",")
            .map(Number);

          if ([x, y, w, h].some((value) => Number.isNaN(value))) continue;

          const url = resolveThumbnailUrl(rawUrl, thumbnailVtt);
          parsed.push({ start, end, url, x, y, w, h });
        }

        setThumbnails(parsed);
      })
      .catch(console.error);
  }, [thumbnailVtt]);

  //  Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useLayoutEffect(() => {
    const updateSeekTrackWidth = () => {
      setSeekTrackWidth(seekTrackRef.current?.clientWidth ?? 0);
    };

    updateSeekTrackWidth();
    window.addEventListener("resize", updateSeekTrackWidth);
    return () => window.removeEventListener("resize", updateSeekTrackWidth);
  }, []);

  //  Controls auto-hide
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setControlsVisible(false);
      }
    }, 3000);
  }, []);

  // HotKeys
  //  Video event handlers ─
  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setProgress(v.currentTime);
    setDuration(v.duration || 0);

    // update buffered
    if (v.buffered.length > 0) {
      setBuffered(v.buffered.end(v.buffered.length - 1));
    }
  };

  const onPlay = () => setIsPlaying(true);
  const onPause = () => {
    setIsPlaying(false);
    setControlsVisible(true);
  };
  const onEnded = () => {
    setIsPlaying(false);
    setControlsVisible(true);
  };
  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
    setVolume(v.volume);
  };

  //  Controls
  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }

  function seek(value: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = value;
    setProgress(value);
  }

  function seekRelative(delta: number) {
    const v = videoRef.current;
    if (!v) return;
    const next = Math.max(0, Math.min(v.duration, v.currentTime + delta));
    v.currentTime = next;
    setProgress(next);
  }

  function changeVolume(val: number) {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
    setVolume(val);
    setIsMuted(val === 0);
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    const next = !v.muted;
    v.muted = next;
    setIsMuted(next);
    if (!next && volume === 0) {
      v.volume = 0.5;
      setVolume(0.5);
    }
  }

  function changeQuality(level: number) {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = level;
    setCurrentLevel(level);
    setShowQuality(false);
  }

  function cycleSpeed() {
    const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const idx = rates.indexOf(playbackRate);
    const next = rates[(idx + 1) % rates.length];
    if (videoRef.current) videoRef.current.playbackRate = next;
    setPlaybackRate(next);
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  async function togglePip() {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await v.requestPictureInPicture();
    }
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const v = videoRef.current;
      if (!v) return;
      const active = document.activeElement as HTMLElement;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable)
      ) {
        return;
      }

      // Only if player is focused
      if (!containerRef.current?.contains(active)) return;

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;

        case "arrowright":
          seekRelative(10);
          break;

        case "arrowleft":
          seekRelative(-10);
          break;

        case "arrowup":
          e.preventDefault();
          changeVolume(Math.min(1, volume + 0.1));
          break;

        case "arrowdown":
          e.preventDefault();
          changeVolume(Math.max(0, volume - 0.1));
          break;

        case "m":
          toggleMute();
          break;

        case "f":
          toggleFullscreen();
          break;

        case "l":
          seekRelative(10);
          break;

        case "j":
          seekRelative(-10);
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [volume]);

  //  Thumbnail lookup
  const currentThumb =
    thumbnails.find(
      (t) => hoverTime !== null && hoverTime >= t.start && hoverTime < t.end,
    ) ?? null;

  const thumbnailLeft =
    currentThumb && seekTrackWidth > 0
      ? Math.max(
          8,
          Math.min(
            hoverX - currentThumb.w / 2,
            seekTrackWidth - currentThumb.w - 8,
          ),
        )
      : 0;

  //  Seek bar fill percentage
  const progressPct = duration > 0 ? (progress / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const volumePct = isMuted ? 0 : volume * 100;

  const VolumeIcon =
    isMuted || volume === 0
      ? VolumeOffIcon
      : volume < 0.5
        ? VolumeLowIcon
        : VolumeHighIcon;

  const qualityLabel =
    currentLevel === -1
      ? "Auto"
      : levels[currentLevel]
        ? `${levels[currentLevel].height}p`
        : "Auto";

  const handleClick = () => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    clickTimeoutRef.current = setTimeout(() => {}, 200);
  };

  const handleDoubleClick = () => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    toggleFullscreen();
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={`relative select-none outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-black ${className}`}
      style={{
        background: "#000",
        borderRadius: isFullscreen ? 0 : 12,
        overflow: "hidden",
      }}
      onMouseMove={resetHideTimer}
      onMouseEnter={resetHideTimer}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseLeave={() => {
        setShowVolume(false);
        setShowQuality(false);
      }}
    >
      {/*  Video  */}
      <video
        ref={videoRef}
        poster={poster}
        style={{
          width: "100%",
          display: "block",
          maxHeight: isFullscreen ? "100vh" : undefined,
        }}
        onTimeUpdate={onTimeUpdate}
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
        onLoadedMetadata={onLoadedMetadata}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onCanPlayThrough={() => setIsBuffering(false)}
      />

      {isBuffering && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white shadow-[0_0_20px_rgba(255,255,255,0.3)]" />
        </div>
      )}

      {/*  Controls overlay  */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: controlsVisible
            ? "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)"
            : "transparent",
          transition: "opacity 0.3s",
          opacity: controlsVisible ? 1 : 0,
          pointerEvents: controlsVisible ? "auto" : "none",
        }}
      >
        {/*  Seek bar area  */}
        <div style={{ padding: "0 16px", position: "relative" }}>
          {/* Thumbnail preview */}
          {currentThumb && hoverTime !== null && (
            <div
              style={{
                position: "absolute",
                bottom: 28,
                left: thumbnailLeft,
                pointerEvents: "none",
                zIndex: 10,
              }}
            >
              <div
                style={{
                  width: currentThumb.w,
                  height: currentThumb.h,
                  backgroundImage: `url(${currentThumb.url})`,
                  backgroundPosition: `-${currentThumb.x}px -${currentThumb.y}px`,
                  backgroundSize: "auto",
                  borderRadius: 6,
                  border: "2px solid rgba(255,255,255,0.8)",
                  overflow: "hidden",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
                }}
              />
              <div
                style={{
                  color: "#fff",
                  fontSize: 11,
                  textAlign: "center",
                  marginTop: 4,
                  fontFamily: "monospace",
                  fontWeight: 600,
                  textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                }}
              >
                {fmt(hoverTime)}
              </div>
            </div>
          )}

          {/* Buffered + progress track */}
          <div
            ref={seekTrackRef}
            style={{ position: "relative", height: 3, marginBottom: 8 }}
          >
            {/* Buffered */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(255,255,255,0.25)",
                borderRadius: 9999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${bufferedPct}%`,
                  background: "rgba(255,255,255,0.4)",
                  borderRadius: 9999,
                  transition: "width 0.3s",
                }}
              />
            </div>
            {/* Progress */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 9999,
                overflow: "hidden",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  background: "#fff",
                  borderRadius: 9999,
                }}
              />
            </div>
            {/* Seek input (transparent, on top) */}
            <input
              ref={seekBarRef}
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={progress}
              className="hls-range"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                opacity: 0,
                cursor: "pointer",
                zIndex: 5,
              }}
              onChange={(e) => seek(Number(e.target.value))}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                setHoverTime(Math.max(0, Math.min(duration, pct * duration)));
                setHoverX(e.clientX - rect.left);
              }}
              onMouseLeave={() => setHoverTime(null)}
            />

            {/* Visible seek thumb on track */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: `calc(${progressPct}% - 6px)`,
                width: 13,
                height: 13,
                borderRadius: "50%",
                background: "#fff",
                boxShadow: "0 0 4px rgba(0,0,0,0.5)",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                zIndex: 4,
              }}
            />
          </div>
        </div>

        {/*  Controls row  */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 14px 12px",
            gap: 4,
          }}
        >
          {/* Left group */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Play/pause */}
            <ControlBtn
              onClick={togglePlay}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </ControlBtn>

            {/* Seek back 10s */}
            <ControlBtn onClick={() => seekRelative(-10)} title="Rewind 10s">
              <SeekBackIcon />
            </ControlBtn>

            {/* Seek forward 10s */}
            <ControlBtn onClick={() => seekRelative(10)} title="Forward 10s">
              <SeekForwardIcon />
            </ControlBtn>

            {/* Volume */}
            <div style={{ position: "relative" }}>
              <ControlBtn
                onClick={toggleMute}
                onMouseEnter={() => setShowVolume(true)}
                title="Volume"
              >
                <VolumeIcon />
              </ControlBtn>

              {showVolume && (
                <div
                  onMouseEnter={() => setShowVolume(true)}
                  onMouseLeave={() => setShowVolume(false)}
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 8px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(20,20,20,0.95)",
                    backdropFilter: "blur(12px)",
                    borderRadius: 10,
                    padding: "12px 10px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    zIndex: 50,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {/* Volume percentage */}
                  <span
                    style={{
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 600,
                      fontFamily: "monospace",
                    }}
                  >
                    {Math.round(isMuted ? 0 : volume * 100)}%
                  </span>

                  {/* Vertical slider track */}
                  <div style={{ position: "relative", width: 3, height: 80 }}>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(255,255,255,0.2)",
                        borderRadius: 9999,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: `${volumePct}%`,
                        background: "#fff",
                        borderRadius: 9999,
                      }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={isMuted ? 0 : volume}
                      className="hls-vol-range"
                      style={{
                        position: "absolute",
                        inset: 0,
                        opacity: 0,
                        cursor: "pointer",
                        zIndex: 5,
                      }}
                      onChange={(e) => changeVolume(Number(e.target.value))}
                    />
                    {/* thumb indicator */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: `calc(${volumePct}% - 6px)`,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: "#fff",
                        boxShadow: "0 0 4px rgba(0,0,0,0.5)",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Time display */}
            <span
              style={{
                color: "#fff",
                fontSize: 12,
                fontFamily: "monospace",
                fontWeight: 500,
                marginLeft: 4,
                letterSpacing: "0.02em",
                opacity: 0.9,
              }}
            >
              {fmt(progress)} / {fmt(duration)}
            </span>
          </div>

          {/* Right group */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {/* Playback speed */}
            <ControlBtn
              onClick={cycleSpeed}
              title="Playback speed"
              style={{ minWidth: 36 }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "monospace",
                }}
              >
                {playbackRate}×
              </span>
            </ControlBtn>

            {/* Quality selector */}
            <div style={{ position: "relative" }}>
              <ControlBtn
                onClick={() => {
                  setShowQuality((v) => !v);
                  setShowVolume(false);
                }}
                title="Quality"
                style={{ minWidth: 40 }}
              >
                <SettingsIcon />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    marginLeft: 3,
                    fontFamily: "monospace",
                  }}
                >
                  {qualityLabel}
                </span>
              </ControlBtn>

              {showQuality && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 8px)",
                    right: 0,
                    background: "rgba(18,18,18,0.97)",
                    backdropFilter: "blur(16px)",
                    borderRadius: 10,
                    padding: "6px 0",
                    minWidth: 120,
                    zIndex: 50,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    style={{
                      padding: "6px 14px 8px",
                      fontSize: 10,
                      color: "rgba(255,255,255,0.45)",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      fontFamily: "sans-serif",
                    }}
                  >
                    Quality
                  </div>
                  {[
                    { label: "Auto", value: -1 },
                    ...levels.map((l, i) => ({
                      label: `${l.height}p`,
                      value: i,
                    })),
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => changeQuality(opt.value)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        padding: "8px 14px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color:
                          currentLevel === opt.value
                            ? "#fff"
                            : "rgba(255,255,255,0.65)",
                        fontSize: 13,
                        fontFamily: "sans-serif",
                        fontWeight: currentLevel === opt.value ? 600 : 400,
                        gap: 8,
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(255,255,255,0.07)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "none")
                      }
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background:
                            currentLevel === opt.value ? "#fff" : "transparent",
                          border: "1.5px solid rgba(255,255,255,0.4)",
                          flexShrink: 0,
                        }}
                      />
                      {opt.label}
                      {opt.value !== -1 && levels[opt.value] && (
                        <span
                          style={{
                            marginLeft: "auto",
                            fontSize: 10,
                            opacity: 0.4,
                            fontFamily: "monospace",
                          }}
                        >
                          {Math.round(levels[opt.value].bitrate / 1000)}k
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* PiP */}
            {"pictureInPictureEnabled" in document && (
              <ControlBtn onClick={togglePip} title="Picture in Picture">
                <PipIcon />
              </ControlBtn>
            )}

            {/* Fullscreen */}
            <ControlBtn
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <FullscreenExitIcon /> : <FullscreenEnterIcon />}
            </ControlBtn>
          </div>
        </div>
      </div>
    </div>
  );
}
