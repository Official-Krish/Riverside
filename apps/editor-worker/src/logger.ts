export type LogLevel = "info" | "warn" | "error" | "debug";

export function log(
  level: LogLevel,
  msg: string,
  meta?: Record<string, unknown>,
) {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    worker: "editor-worker",
    msg,
    ...meta,
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}
