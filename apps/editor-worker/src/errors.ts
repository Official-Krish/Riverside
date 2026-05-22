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

export class SourceNotFoundError extends WorkerError {
  constructor(path: string) {
    super(`Source file not found: ${path}`, "SOURCE_NOT_FOUND", false);
    this.name = "SourceNotFoundError";
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

export class StorageError extends WorkerError {
  constructor(message: string) {
    super(`Storage operation failed: ${message}`, "STORAGE_ERROR", true);
    this.name = "StorageError";
  }
}

export class ProgressUpdateError extends WorkerError {
  constructor(message: string) {
    super(`Progress update failed: ${message}`, "PROGRESS_UPDATE_ERROR", true);
    this.name = "ProgressUpdateError";
  }
}

export class ProjectNotFoundError extends WorkerError {
  constructor(projectId: string) {
    super(`Project not found: ${projectId}`, "PROJECT_NOT_FOUND", false);
    this.name = "ProjectNotFoundError";
  }
}

export class NoVideoClipsError extends WorkerError {
  constructor() {
    super("No video clips found in project", "NO_VIDEO_CLIPS", false);
    this.name = "NoVideoClipsError";
  }
}

export class InvalidPartFileError extends WorkerError {
  constructor(path: string, reason: string) {
    super(`Invalid part file ${path}: ${reason}`, "INVALID_PART_FILE", false);
    this.name = "InvalidPartFileError";
  }
}

export class CrossfadeConcatError extends WorkerError {
  constructor(message: string) {
    super(
      `Crossfade concat failed: ${message}`,
      "CROSSFADE_CONCAT_ERROR",
      false,
    );
    this.name = "CrossfadeConcatError";
  }
}

export class OverlayBurnError extends WorkerError {
  constructor(message: string) {
    super(`Overlay burn-in failed: ${message}`, "OVERLAY_BURN_ERROR", false);
    this.name = "OverlayBurnError";
  }
}

export function toWorkerError(err: unknown): WorkerError {
  if (err instanceof WorkerError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new WorkerError(message, "UNKNOWN_ERROR", false);
}
