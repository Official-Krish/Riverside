import * as fs from "node:fs/promises";
import * as path from "node:path";
import { executeFFmpeg, ffmpegBin } from "./ffmpeg";
import { type MergerConfig, type UserChunk } from "./types";

export function escapeConcatFilePath(filePath: string): string {
    return filePath.replace(/'/g, "'\\''");
}

async function hasWebmHeader(filePath: string): Promise<boolean> {
    const file = await fs.open(filePath, "r");
    try {
        const header = Buffer.alloc(4);
        const { bytesRead } = await file.read(header, 0, header.length, 0);
        return bytesRead === header.length && header.equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    } finally {
        await file.close();
    }
}

async function shouldConcatenateWebmFragments(chunks: UserChunk[]): Promise<boolean> {
    if (chunks.length < 2 || !chunks.every((chunk) => chunk.localPath.toLowerCase().endsWith(".webm"))) {
        return false;
    }
    const firstChunk = chunks[0];
    if (!firstChunk) {
        return false;
    }
    const firstHasHeader = await hasWebmHeader(firstChunk.localPath);
    if (!firstHasHeader) {
        return false;
    }
    for (let i = 1; i < chunks.length; i++) {
        const hasHeader = await hasWebmHeader(chunks[i]!.localPath);
        if (hasHeader) {
            return false;
        }
    }
    return true;
}

async function concatenateChunksBytewise(chunks: UserChunk[], outputPath: string): Promise<void> {
    const output = await fs.open(outputPath, "w");
    try {
        for (const chunk of chunks) {
            await output.writeFile(await fs.readFile(chunk.localPath));
        }
    } finally {
        await output.close();
    }
}

const VIDEO_FILTER = "scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2";

function buildEncodeArgs(input: string, output: string, frameRate: number, label: string): string[] {
    return [
        "-y",
        "-i", input,
        "-c:v", "libx264",
        "-preset", "fast",
        "-pix_fmt", "yuv420p",
        "-vf", VIDEO_FILTER,
        "-r", frameRate.toString(),
        output,
    ];
}

export async function createUserVideo(
    userId: string,
    chunks: UserChunk[],
    tempDir: string,
    config: MergerConfig,
    log: (message: string) => void
): Promise<string | null> {
    const outputVideo = path.join(tempDir, "videos", `${userId}.mp4`);
    const startTime = Date.now();
    const label = `createUserVideo[${userId}]`;

    try {
        if (chunks.length === 1) {
            await executeFFmpeg(ffmpegBin, buildEncodeArgs(chunks[0]!.localPath, outputVideo, config.frameRate, label), 300000, `${label}:encode-single`, log);
            return outputVideo;
        }

        const userTmp = path.join(tempDir, "videos", `${userId}-tmp`);
        await fs.mkdir(userTmp, { recursive: true });

        if (await shouldConcatenateWebmFragments(chunks)) {
            const combinedWebmPath = path.join(userTmp, "combined.webm");
            await concatenateChunksBytewise(chunks, combinedWebmPath);
            await executeFFmpeg(ffmpegBin, buildEncodeArgs(combinedWebmPath, outputVideo, config.frameRate, label), 600000, `${label}:encode-webm-fragments`, log);
            return outputVideo;
        }

        const fileListPath = path.join(userTmp, "filelist.txt");
        const fileListContent = chunks.map(c => `file '${escapeConcatFilePath(c.localPath)}'`).join("\n");
        await fs.writeFile(fileListPath, fileListContent);

        await executeFFmpeg(ffmpegBin, [
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", fileListPath,
            "-c:v", "libx264",
            "-preset", "fast",
            "-pix_fmt", "yuv420p",
            "-vf", VIDEO_FILTER,
            "-r", config.frameRate.toString(),
            outputVideo,
        ], 600000, `${label}:concat`, log);

        return outputVideo;
    } catch (error) {
        const elapsed = Date.now() - startTime;
        log(`[${label}] Failed after ${elapsed}ms: ${error}`);
        return null;
    }
}

export async function createBlackPlaceholderVideo(
    userId: string,
    duration: number,
    tempDir: string,
    config: MergerConfig,
    log: (message: string) => void
): Promise<string> {
    const label = `createBlackPlaceholderVideo[${userId}]`;
    const safeDuration = Math.max(1, Math.ceil(duration));
    const outputVideo = path.join(tempDir, "videos", `${userId}_placeholder.mp4`);
    await executeFFmpeg(ffmpegBin, [
        "-y",
        "-f", "lavfi",
        "-i", `color=c=black:s=640x480:r=${config.frameRate}`,
        "-t", safeDuration.toString(),
        "-c:v", "libx264",
        "-preset", "fast",
        "-pix_fmt", "yuv420p",
        outputVideo,
    ], 300000, label, log);
    return outputVideo;
}