/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useRef } from "react";

export function AudioTrackSink({ track }: { track: any }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!track || !audioRef.current) {
      return;
    }

    try {
      track.attach(audioRef.current);
      const maybePromise = audioRef.current.play?.();
      if (maybePromise && typeof maybePromise.catch === "function") {
        maybePromise.catch(() => {
          // Autoplay can be blocked until the browser considers this tab user-activated.
        });
      }
    } catch {
      // no-op
    }

    return () => {
      try {
        track.detach(audioRef.current);
      } catch {
        // no-op
      }
    };
  }, [track]);

  return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
}
