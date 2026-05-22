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

export class ChunkDownloadError extends WorkerError {
  constructor(userId: string, cause?: string) {
    super(
      `Failed to download chunks for user ${userId}${cause ? ` — ${cause}` : ""}`,
      "CHUNK_DOWNLOAD_ERROR",
      true,
    );
    this.name = "ChunkDownloadError";
  }
}

export class FFmpegMergeError extends WorkerError {
  constructor(
    message: string,
    public readonly stderr: string,
  ) {
    super(`FFmpeg merge failed: ${message}`, "FFMPEG_MERGE_ERROR", false);
    this.name = "FFmpegMergeError";
  }
}

export class S3UploadError extends WorkerError {
  constructor(prefix: string, cause?: string) {
    super(
      `Failed to upload merged result to S3: ${prefix}${cause ? ` — ${cause}` : ""}`,
      "S3_UPLOAD_ERROR",
      true,
    );
    this.name = "S3UploadError";
  }
}

export class GridBuildError extends WorkerError {
  constructor(message: string) {
    super(`Grid video build failed: ${message}`, "GRID_BUILD_ERROR", false);
    this.name = "GridBuildError";
  }
}

export class DecryptionError extends WorkerError {
  constructor(userId: string, cause?: string) {
    super(
      `Failed to decrypt chunks for user ${userId}${cause ? ` — ${cause}` : ""}`,
      "DECRYPTION_ERROR",
      false,
    );
    this.name = "DecryptionError";
  }
}

export class MeetingNotFoundError extends WorkerError {
  constructor(meetingId: string) {
    super(`Meeting not found: ${meetingId}`, "MEETING_NOT_FOUND", false);
    this.name = "MeetingNotFoundError";
  }
}

export function toWorkerError(err: unknown): WorkerError {
  if (err instanceof WorkerError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new WorkerError(message, "UNKNOWN_ERROR", false);
}
