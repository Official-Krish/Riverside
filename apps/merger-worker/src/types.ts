export interface UserChunk {
    userId: string;
    localPath: string;
    timestamp: number;
}

export interface ProcessedUser {
    userId: string;
    videoPath: string;
    duration: number;
    hasAudio: boolean;
    joinTimestamp: number;
    leadingPaddingSeconds: number;
}

export interface FailedUser {
    userId: string;
    estimatedDuration: number;
    joinTimestamp: number;
}

export interface MergerConfig {
    frameRate: number;
    audioBitrate: string;
    maxConcurrentUserJobs: number;
}

export interface GridDimensions {
    rows: number;
    cols: number;
}