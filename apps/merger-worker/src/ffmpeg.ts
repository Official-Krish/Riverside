import { spawn } from "node:child_process";
import * as path from "node:path";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { getEnv, getEnvNumber } from "./config";

export const ffmpegBin: string = getEnv("FFMPEG_PATH", ffmpegStatic || "ffmpeg");
export const ffprobeBin: string = getEnv("FFPROBE_PATH", ffprobeStatic.path || "ffprobe");

export async function executeFFmpeg(
    ffmpegPath: string,
    args: string[],
    timeoutMs: number = 600000,
    label: string = "FFmpeg",
    log: (message: string) => void
): Promise<void> {
    const startTime = Date.now();
    let progressLines = 0;
    let lastProgressAt = Date.now();

    await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn(ffmpegPath, args);
        let stderr = "";
        let timeoutHandle: NodeJS.Timeout | null = null;
        let resolved = false;

        const waitForExit = (): Promise<void> =>
            new Promise((res) => {
                if (ffmpeg.exitCode !== null) {
                    res();
                    return;
                }
                ffmpeg.once("close", () => res());
                setTimeout(res, 3000);
            });

        const cleanup = async () => {
            if (timeoutHandle) clearTimeout(timeoutHandle);
            if (ffmpeg.exitCode === null) {
                ffmpeg.kill("SIGTERM");
                await Promise.race([
                    waitForExit(),
                    new Promise<void>((res) => setTimeout(res, 1000)),
                ]);
                if (ffmpeg.exitCode === null) {
                    ffmpeg.kill("SIGKILL");
                    await waitForExit();
                }
            }
            ffmpeg.removeAllListeners();
        };

        const doResolve = async (error?: Error) => {
            if (resolved) return;
            resolved = true;
            await cleanup();
            const duration = Date.now() - startTime;
            if (error) {
                log(`[${label}] Failed after ${duration}ms: ${error.message}`);
                reject(error);
            } else {
                log(`[${label}] Completed successfully in ${duration}ms (${progressLines} progress lines)`);
                resolve();
            }
        };

        const resetTimeout = () => {
            if (timeoutHandle) clearTimeout(timeoutHandle);
            timeoutHandle = setTimeout(() => {
                const idleFor = Date.now() - lastProgressAt;
                log(`[${label}] No FFmpeg progress for ${idleFor}ms, killing process...`);
                if (progressLines === 0) {
                    log(`[${label}] WARNING: No FFmpeg output received - process may be stuck`);
                }
                doResolve(new Error(`FFmpeg stalled after ${idleFor}ms without progress`));
            }, timeoutMs);
        };

        resetTimeout();

        ffmpeg.stderr.on("data", (data) => {
            const output = data.toString();
            stderr += output;
            if (output.includes("frame=") || output.includes("error") || output.includes("Error") || output.includes("FAILED")) {
                progressLines++;
                lastProgressAt = Date.now();
                resetTimeout();
            }
        });

        ffmpeg.on("close", (code) => {
            if (resolved) return;
            if (code === 0) {
                doResolve();
                return;
            }
            doResolve(new Error(`FFmpeg failed with code ${code}: ${stderr.substring(0, 200)}`));
        });

        ffmpeg.on("error", (error) => {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                doResolve(new Error(`ffmpeg binary not found. Checked path: ${ffmpegPath}`));
                return;
            }
            doResolve(error);
        });
    });
}

export async function getVideoDuration(
    videoPath: string,
    ffprobePath: string,
    log: (message: string) => void
): Promise<number> {
    const label = `getVideoDuration[${path.basename(videoPath)}]`;
    return await new Promise<number>((resolve, reject) => {
        const ffprobe = spawn(ffprobePath, [
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            videoPath,
        ]);

        let stdout = "";
        let timeoutHandle: NodeJS.Timeout | null = null;

        const cleanup = () => {
            if (timeoutHandle) clearTimeout(timeoutHandle);
            ffprobe.removeAllListeners();
            ffprobe.kill("SIGTERM");
        };

        timeoutHandle = setTimeout(() => {
            cleanup();
            reject(new Error(`FFprobe timeout for ${videoPath}`));
        }, 30000);

        ffprobe.stdout.on("data", (data) => {
            stdout += data.toString();
        });

        ffprobe.on("close", (code) => {
            cleanup();
            if (code === 0) {
                const duration = parseFloat(stdout.trim());
                resolve(duration);
                return;
            }
            log(`[${label}] Failed with code ${code}`);
            reject(new Error(`FFprobe failed with code ${code}`));
        });

        ffprobe.on("error", (error) => {
            cleanup();
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                reject(new Error(`ffprobe binary not found. Checked path: ${ffprobePath}`));
                return;
            }
            reject(error);
        });
    });
}

export async function hasAudioStream(
    videoPath: string,
    ffprobePath: string,
    log: (message: string) => void
): Promise<boolean> {
    const label = `hasAudioStream[${path.basename(videoPath)}]`;
    return await new Promise<boolean>((resolve, reject) => {
        const ffprobe = spawn(ffprobePath, [
            "-v",
            "error",
            "-select_streams",
            "a",
            "-show_entries",
            "stream=codec_type",
            "-of",
            "csv=p=0",
            videoPath,
        ]);

        let stdout = "";
        let timeoutHandle: NodeJS.Timeout | null = null;

        const cleanup = () => {
            if (timeoutHandle) clearTimeout(timeoutHandle);
            ffprobe.removeAllListeners();
            ffprobe.kill("SIGTERM");
        };

        timeoutHandle = setTimeout(() => {
            cleanup();
            reject(new Error(`FFprobe timeout for ${videoPath}`));
        }, 30000);

        ffprobe.stdout.on("data", (data) => {
            stdout += data.toString();
        });

        ffprobe.on("close", (code) => {
            cleanup();
            if (code === 0) {
                const hasAudio = stdout.trim().length > 0;
                resolve(hasAudio);
                return;
            }
            log(`[${label}] Failed with code ${code}`);
            reject(new Error(`FFprobe failed with code ${code}`));
        });

        ffprobe.on("error", (error) => {
            cleanup();
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                reject(new Error(`ffprobe binary not found. Checked path: ${ffprobePath}`));
                return;
            }
            reject(error);
        });
    });
}