import * as path from "node:path";
import { executeFFmpeg, ffmpegBin } from "./ffmpeg";
import { type MergerConfig, type ProcessedUser, type GridDimensions } from "./types";

export function calculateGridDimensions(count: number): GridDimensions {
    if (count === 1) return { rows: 1, cols: 1 };
    if (count === 2) return { rows: 1, cols: 2 };
    if (count <= 4) return { rows: 2, cols: 2 };
    if (count <= 6) return { rows: 2, cols: 3 };
    if (count <= 9) return { rows: 3, cols: 3 };

    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    return { rows, cols };
}



async function createSingleUserVideo(user: ProcessedUser, outputPath: string, config: MergerConfig, log: (message: string) => void): Promise<void> {
    const label = `createGridVideo[single-user]`;
    const targetDuration = Math.max(1, user.duration);
    const tpadFilter = user.leadingPaddingSeconds > 0.1
        ? `,tpad=start_mode=add:start_duration=${user.leadingPaddingSeconds}:color=black`
        : "";
    const audioDelayMs = Math.max(0, Math.round(user.leadingPaddingSeconds * 1000));
    const filter = `[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2${tpadFilter}[video_out]${user.hasAudio && audioDelayMs > 0 ? `;[0:a]adelay=${audioDelayMs}:all=1[audio_out]` : ""}`;

    const args = [
        "-y", "-i", user.videoPath,
        "-filter_complex", filter,
        "-map", "[video_out]",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
    ];

    if (user.hasAudio) {
        args.push(
            "-map", audioDelayMs > 0 ? "[audio_out]" : "0:a",
            "-c:a", "aac",
            "-b:a", config.audioBitrate,
            "-ar", "48000",
        );
    } else {
        args.push("-an");
    }

    args.push(
        "-t", targetDuration.toString(),
        "-r", config.frameRate.toString(),
        outputPath,
    );

    await executeFFmpeg(ffmpegBin, args, 600000, `${label}:single-user`, log);
}

async function createMultiUserVideo(users: ProcessedUser[], outputPath: string, config: MergerConfig, log: (message: string) => void): Promise<void> {
    const label = `createGridVideo[${users.length}-users]`;
    const { rows, cols } = calculateGridDimensions(users.length);
    const targetDuration = Math.max(...users.map(u => u.duration));
    const outputWidth = 1920;
    const outputHeight = 1080;

    const tileWidth = Math.floor(outputWidth / cols);
    const tileHeight = Math.floor(outputHeight / rows);

    const inputs: string[] = [];
    let filter = "";

    for (let i = 0; i < users.length; i++) {
        const user = users[i]!;
        const trailingPaddingSeconds = Math.max(0, targetDuration - user.duration);
        const tpadOptions = [
            user.leadingPaddingSeconds > 0.1
                ? `start_mode=add:start_duration=${user.leadingPaddingSeconds}:color=black`
                : "",
            trailingPaddingSeconds > 0.1
                ? `stop_mode=clone:stop_duration=${trailingPaddingSeconds}`
                : "",
        ].filter(Boolean);

        inputs.push("-i", user.videoPath);
        filter += `[${i}:v]scale=${tileWidth}:${tileHeight}:force_original_aspect_ratio=decrease,pad=${tileWidth}:${tileHeight}:(ow-iw)/2:(oh-ih)/2${tpadOptions.length > 0 ? `,tpad=${tpadOptions.join(":")}` : ""},drawbox=x=0:y=0:w=iw:h=ih:color=#1f2937@0.6:t=2[v${i}];`;
    }

    const layout: string[] = [];
    for (let i = 0; i < users.length; i++) {
        const x = (i % cols) * tileWidth;
        const y = Math.floor(i / cols) * tileHeight;
        layout.push(`${x}_${y}`);
    }

    filter += `${Array.from({ length: users.length }, (_, i) => `[v${i}]`).join("")}xstack=inputs=${users.length}:layout=${layout.join("|")}:fill=black[video];`;
    filter += `[video]scale=${outputWidth}:${outputHeight}:flags=lanczos[video_out];`;

    const audioInputs = users.map((user, idx) => (user.hasAudio ? idx : -1)).filter((idx) => idx >= 0);

    let audioMap: string[] = [];
    if (audioInputs.length > 0) {
        const audioLabels: string[] = [];
        for (const inputIndex of audioInputs) {
            const user = users[inputIndex]!;
            const delayMs = Math.max(0, Math.round(user.leadingPaddingSeconds * 1000));
            const trailingPaddingSeconds = Math.max(0, targetDuration - user.duration);
            const audioFilters = [
                delayMs > 0 ? `adelay=${delayMs}:all=1` : "",
                trailingPaddingSeconds > 0.1 ? `apad=pad_dur=${trailingPaddingSeconds}` : "",
            ].filter(Boolean);

            if (audioFilters.length > 0) {
                filter += `[${inputIndex}:a]${audioFilters.join(",")}[a${inputIndex}];`;
                audioLabels.push(`[a${inputIndex}]`);
            } else {
                audioLabels.push(`[${inputIndex}:a]`);
            }
        }
        filter += `${audioLabels.join("")}amix=inputs=${audioInputs.length}:duration=longest:normalize=0[audio]`;
        audioMap = ["-map", "[audio]"];
    } else {
        inputs.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
        audioMap = ["-map", `${users.length}:a`];
    }

    await executeFFmpeg(ffmpegBin, [
        "-y",
        ...inputs,
        "-filter_complex", filter,
        "-map", "[video_out]",
        ...audioMap,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", config.audioBitrate,
        "-ar", "48000",
        "-t", targetDuration.toString(),
        "-r", config.frameRate.toString(),
        outputPath,
    ], 900000, `${label}:xstack`, log);
}

export async function createGridVideo(
    users: ProcessedUser[],
    tempDir: string,
    config: MergerConfig,
    log: (message: string) => void
): Promise<string> {
    const outputPath = path.join(tempDir, "output", "meeting_grid_recording.mp4");

    if (users.length === 1) {
        await createSingleUserVideo(users[0]!, outputPath, config, log);
    } else {
        await createMultiUserVideo(users, outputPath, config, log);
    }

    return outputPath;
}