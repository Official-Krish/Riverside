export function buildMeetingLivePath(args: {
  roomId: string;
  name: string;
  role: "host" | "guest";
  recordingState?: boolean;
  micId?: string;
  cameraId?: string;
  initialMicOff?: boolean;
  initialVideoOff?: boolean;
}) {
  const params = new URLSearchParams({
    name: args.name || (args.role === "host" ? "Host" : "Guest"),
    role: args.role,
  });

  if (args.recordingState) {
    params.set("recordingState", "true");
  }

  if (args.micId) {
    params.set("micId", args.micId);
  }

  if (args.cameraId) {
    params.set("cameraId", args.cameraId);
  }

  if (args.initialMicOff) {
    params.set("micOff", "true");
  }

  if (args.initialVideoOff) {
    params.set("videoOff", "true");
  }

  return `/meeting/live/${args.roomId}?${params.toString()}`;
}
