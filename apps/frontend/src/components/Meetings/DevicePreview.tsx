import { Camera, ShieldCheck } from "lucide-react";
import type { RefObject } from "react";

type DevicePreviewProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  previewError: string | null;
};

export function DevicePreview({ videoRef, previewError }: DevicePreviewProps) {
  return (
    <div className="rounded-[1.5rem] border border-[#f5a623]/12 bg-background/40 p-4 sm:p-5">
      <div className="relative aspect-video overflow-hidden rounded-xl border border-[#f5a623]/10 bg-black/35">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full scale-x-[-1] object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/65 via-transparent to-black/10" />

        {previewError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-full border border-white/10 bg-white/6 text-[#f5c86a]">
              <Camera className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#fff5de]">
                Camera preview unavailable
              </p>
              <p className="mt-1 text-xs leading-5 text-[#d0b27a]/78">
                Allow camera and microphone access, then refresh this page to
                continue your setup.
              </p>
            </div>
          </div>
        ) : (
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-4 py-3 text-xs text-[#fff5de]/78">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1">
              <ShieldCheck className="size-3.5 text-[#f5c86a]" />
              Local preview - nothing uploads until you join
            </span>
          </div>
        )}
      </div>

      {previewError ? (
        <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {previewError}
        </p>
      ) : null}
    </div>
  );
}
