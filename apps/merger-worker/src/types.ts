export interface EncryptionMetadata {
    isEncrypted: boolean;
    sourceMimeType: string | null;
    encryptionAlgorithm: string | null;
    encryptionIv: string | null;
    encryptionTagBits: number | null;
}

export interface UserChunk {
    userId: string;
    localPath: string;
    timestamp: number;
    hasValidTimestamp?: boolean;
    metadata?: EncryptionMetadata | null;
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