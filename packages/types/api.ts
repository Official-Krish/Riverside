export type LoginResponse = {
  message: string;
  token: string;
  name?: string | null;
};

export type UserProfile = {
  id: string;
  name?: string | null;
  email?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserProfileResponse = {
  message: string;
  user: UserProfile;
};

export type SignupResponse = {
  message: string;
  token: string;
};

export type CreateMeetingResponse = {
  roomId: string;
  passcode: string;
  name?: string | null;
  id: string;
};

export type ScheduleMeetingResponse = {
  id: string;
  title: string;
  startTime: string;
};

export type JoinMeetingResponse = {
  roomId: string;
  meetingId: string;
  isHost: boolean;
  recordingState: "IDLE" | "RECORDING" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED";
};

export type ServerPublicKeyResponse = {
  algorithm: "RSA-OAEP-256";
  publicKey: JsonWebKey;
};

export type RegisterWrappedCekRequest = {
  wrappedCek: number[];
};

export type RegisterWrappedCekResponse = {
  message: string;
  meetingId: string;
  participantId: string;
};

export type MeetingSchedule = {
  id: string;
  title: string;
  isHost: boolean;
  description?: string | null;
  startTime: string;
  isRecurring: boolean;
  recurrenceRule?: string | null;
  participantCount: number;
};

export type FinalRecording = {
  id: string;
  meetingId: string;
  videoLink: string;
  audioLink?: string | null;
  visibleToEmails: string[];
  generatedAt: string;
};

export type RecordingVisibilityParticipant = {
  id: string;
  name?: string | null;
  email?: string | null;
};

export type RecordingVisibilityResponse = {
  meetingId: string;
  hostEmail?: string | null;
  visibleToEmails: string[];
  participants: RecordingVisibilityParticipant[];
};

export type RecordingStatusResponse = {
  meetingId: string;
  isHost: boolean;
  isRecording: boolean;
  recordingState: "IDLE" | "RECORDING" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED";
  recordingStartedAt?: string | null;
  recordingStoppedAt?: string | null;
  processingStartedAt?: string | null;
  processingEndedAt?: string | null;
  isEnded: boolean;
  recordingLimit?: {
    recordingsUsed: number;
    recordingsLimit: number;
    remainingRecordings: number;
  };
};

export type RecordingPageParticipant = {
  email?: string | null;
};

export type RecordingPageResponse = {
  id: string;
  meetingId: string;
  roomName?: string | null;
  isHost: boolean;
  recordingState?: "IDLE" | "RECORDING" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED";
  hostEmail?: string | null;
  userEmail?: string | null;
  canViewRecording: boolean;
  canEditRecording: boolean;
  visibleToEmails: string[];
  startedAt?: string | null;
  endedAt?: string | null;
  finalVideoUrl?: string | null;
  hlsManifestUrl?: string | null;
  hlsThumbnailVttUrl?: string | null;
  hlsPosterUrl?: string | null;
  participants: {
    email?: string | null;
    role: string;
  }[];
  recordingLimit?: {
    recordingsUsed: number;
    recordingsLimit: number;
    remainingRecordings: number;
  };
};

export type RecordingLimitCheckResponse = {
  recordingsUsed: number;
  recordingsLimit: number;
  remainingRecordings: number;
  allowed: boolean;
};

export type MeetingDetails = {
  id: string;
  roomId: string;
  passcode: string | null;
  roomName: string | null;
  isEnded: boolean;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  recordingStartedAt: string | null;

  isHost: boolean;

  participants: {
    id: string;
    name?: string | null;
    email?: string | null;
    role: "HOST" | "CO_HOST" | "PARTICIPANT";
    joinedAt: string;
    leftAt?: string | null;
  }[];

  recordingState: "IDLE" | "RECORDING" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED";
  processingStartedAt: string | null;
  processingEndedAt: string | null;

  finalRecording?: {
    id: string;
    meetingId: string;
    videoLink?: string;
    audioLink?: string | null;
    visibleToEmails: string[];
    generatedAt: string;
  } | null;
};

export type GetAllMeetingsResponse = {
  meetings: MeetingDetails[];
  schedules: MeetingSchedule[];
};

export type RemoveVisibleEmailRequest = {
  meetingId: string;
  visibleToEmails: string[];
}

export type GoogleAuthResponse = {
  name: string;
  token: string;
  message: string;
}

export type ChatMessageSender = {
  participantId: string;
  displayName: string;
};

export type RealtimeChatMessage = {
  id: string;
  type: "chat-message" | "system";
  roomId: string;
  text: string;
  timestamp: number;
  sender: ChatMessageSender;
  reactions?: ChatReaction[];
};

export type ChatReaction = {
  emoji: string;
  count: number;
  reactors: string[]; // participantIds who added this reaction
};

export type ChatReactionPayload = {
  type: "reaction";
  roomId: string;
  messageId: string;
  emoji: string;
  participantId: string;
  displayName: string;
  action: "add" | "remove"; // add or remove the reaction
  timestamp: number;
};

export type TypingStatePayload = {
  type: "typing-state";
  roomId: string;
  participantId: string;
  displayName: string;
  isTyping: boolean;
};

export type PresenceState = {
  participantId: string;
  displayName: string;
  isOnline: boolean;
  lastSeen: number;
};

export type ChatPresencePayload = {
  type: "presence";
  roomId: string;
  participantId: string;
  displayName: string;
  isOnline: boolean;
  timestamp: number;
};
