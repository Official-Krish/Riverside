export type Meeting = {
  roomName: string;
  roomId: string;
  isHost: boolean;
  participants: string[];
};

export type User = {
  name: string;
  email: string;
  avatarUrl: string | null;
  googleId: string | null;
  githubUsername: string | null;
  createdAt: string;
  updatedAt: string;
  hostedMeetings: Meeting[];
};
