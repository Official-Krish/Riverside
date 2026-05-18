export type VideoTrackLike = {
  attach?: (element: HTMLVideoElement) => void;
  detach?: (element: HTMLVideoElement) => void;
};

export type MeetingTile = {
  id: string;
  title: string;
  subtitle?: string;
  track: VideoTrackLike | null;
  participantId?: string;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isScreenSharing?: boolean;
  isLocal?: boolean;
};

export type FocusedTiles = {
  selected: MeetingTile;
  others: MeetingTile[];
};

export type RemoteAudioTrackItem = {
  id: string;
  track: unknown;
};

export type MeetingParticipant = {
  id: string;
  displayName: string;
};

export type MeetingParticipantState = {
  id: string;
  name: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isLocal?: boolean;
};

export type MeetingConnectionState =
  | "idle"
  | "loading-lib"
  | "connecting"
  | "connected"
  | "failed";
