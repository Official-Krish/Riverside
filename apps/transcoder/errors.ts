export class WorkerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean,
  ) {
    super(message);
    this.name = "WorkerError";
  }
}

export class S3DownloadError extends WorkerError {
  constructor(key: string, cause?: string) {
    super(
      `Failed to download from S3: ${key}${cause ? ` — ${cause}` : ""}`,
      "S3_DOWNLOAD_ERROR",
      true,
    );
    this.name = "S3DownloadError";
  }
}

export class FFmpegEncodeError extends WorkerError {
  constructor(
    message: string,
    public readonly stderr: string,
  ) {
    super(`FFmpeg encoding failed: ${message}`, "FFMPEG_ENCODE_ERROR", false);
    this.name = "FFmpegEncodeError";
  }
}

export class S3UploadError extends WorkerError {
  constructor(prefix: string, cause?: string) {
    super(
      `Failed to upload to S3: ${prefix}${cause ? ` — ${cause}` : ""}`,
      "S3_UPLOAD_ERROR",
      true,
    );
    this.name = "S3UploadError";
  }
}

export class DurationProbeError extends WorkerError {
  constructor(path: string, cause?: string) {
    super(
      `Failed to probe duration for ${path}${cause ? ` — ${cause}` : ""}`,
      "DURATION_PROBE_ERROR",
      false,
    );
    this.name = "DurationProbeError";
  }
}

export class InvalidPayloadError extends WorkerError {
  constructor(raw: string) {
    super(
      `Invalid transcode payload: ${raw.slice(0, 200)}`,
      "INVALID_PAYLOAD",
      false,
    );
    this.name = "InvalidPayloadError";
  }
}

export class ConfigError extends WorkerError {
  constructor(message: string) {
    super(`Configuration error: ${message}`, "CONFIG_ERROR", false);
    this.name = "ConfigError";
  }
}

export function toWorkerError(err: unknown): WorkerError {
  if (err instanceof WorkerError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new WorkerError(message, "UNKNOWN_ERROR", false);
}
