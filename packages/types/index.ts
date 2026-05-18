import z from "zod";

export * from "./api";

export const SignupSchema = z.object({
  name: z.string().min(2),
  email: z.string().min(5).email().includes("@"),
  password: z
    .string()
    .min(8)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    ),
});

export const LoginSchema = z.object({
  email: z.string().min(5).email().includes("@"),
  password: z
    .string()
    .min(8)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    ),
});

export const CreateMeetingSchema = z.object({
  roomName: z.string().min(2),
  invitedParticipants: z.array(z.string().email().includes("@")).optional(),
  passcode: z.string().min(4).optional(),
});

const BaseSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().optional(),
  invitedParticipants: z.array(z.string().email()).optional(),
});

export const ScheduleMeetingSchema = BaseSchema.extend({
  notificationType: z.enum(["GMAIL", "SLACK", "DISCORD"]).optional(),
  slackBotToken: z.string().optional(),
  slackUserId: z.string().optional(),
  discordWebhookUrl: z.string().url().optional(),
}).superRefine((data, ctx) => {
  if (data.notificationType === "SLACK") {
    if (!data.slackBotToken || !data.slackUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Slack credentials required",
      });
    }
  }

  if (data.notificationType === "DISCORD") {
    if (!data.discordWebhookUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Discord webhook URL required",
      });
    }
  }
});

export const putRecordingVisibilitySchema = z.object({
  visibleToEmails: z.array(z.string().email().includes("@")),
});

export const workerRecordingStatusSchema = z.object({
  meetingId: z.string(),
  status: z.enum(["PROCESSING", "READY", "FAILED"]),
  finalPath: z.string().optional(),
  version: z.string().optional(),
});

export const removeRecordingVisibilitySchema = z.object({
  email: z.string().email().includes("@"),
});

export const googleAuthSchema = z.object({
  idToken: z
    .string()
    .regex(
      /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/,
      "Invalid JWT format",
    ),
});

export const notificationReadSchema = z.object({
  notificationIds: z.array(z.string()).min(1),
});

export const baseSchema = z.object({
  type: z.enum([
    "MEETING_INVITE",
    "MEETING_REMINDER",
    "RECORDING_REQUEST",
    "RECORDING_READY",
    "RECORDING_FAILED",
    "RECORDING_REQUEST_APPROVED",
    "RECORDING_REQUEST_DENIED",
    "OTHER",
  ]),
});

export const schemas = {
  MEETING_INVITE: z.object({
    roomId: z.string(),
    invitedUserId: z.string(),
  }),

  MEETING_REMINDER: z.object({
    roomId: z.string(),
    scheduledAt: z.string(),
  }),

  RECORDING_REQUEST: z.object({
    roomId: z.string(),
  }),

  RECORDING_READY: z.object({
    roomId: z.string(),
  }),

  RECORDING_FAILED: z.object({
    roomId: z.string(),
    reason: z.string().optional(),
  }),

  RECORDING_REQUEST_APPROVED: z.object({
    roomId: z.string(),
    notificationId: z.string(),
  }),

  RECORDING_REQUEST_DENIED: z.object({
    roomId: z.string(),
    notificationId: z.string(),
  }),

  OTHER: z.object({
    message: z.string(),
  }),
};

export const CreateEditorProjectSchema = z.object({
  meetingId: z.string(),
  sourceMode: z.enum(["FINAL", "MULTITRACK"]),
});

export const SaveEditorProjectSchema = z.object({
  tracks: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["VIDEO", "AUDIO", "TEXT"]),
      order: z.number(),
      visible: z.boolean(),
      muted: z.boolean(),
      volume: z.number(),
      clips: z.array(
        z.object({
          id: z.string().optional(),
          sourceAssetId: z.string(),
          sourceStartMs: z.number(),
          timelineStartMs: z.number(),
          durationMs: z.number(),
          name: z.string().optional(),
          audioMode: z.enum(["replace", "layer"]).optional(),
          preset: z
            .enum([
              "zoom-pop",
              "shake",
              "glitch",
              "cinematic-bars",
              "vhs",
              "chromakey",
              "intro-template",
              "meme-format",
              "podcast-layout",
              "lower-third",
              "cta-button",
              "chapter-title",
            ])
            .nullable()
            .optional(),
          presetConfig: z.any().optional(),
          effects: z.any().optional(),
          // Transition metadata stored as JSON
          transitionStart: z.any().optional(),
          transitionEnd: z.any().optional(),
          // Deprecated, kept for backwards compat
          transitionIn: z.enum(["fade", "cut"]).optional(),
          transitionOut: z.enum(["fade", "cut"]).optional(),
        }),
      ),
    }),
  ),
  overlays: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["TEXT"]),
      content: z.any(),
      timelineStartMs: z.number(),
      durationMs: z.number(),
      transform: z.any(),
      style: z.any(),
      zIndex: z.number().optional(),
      animation: z.any().optional(),
    }),
  ),
  durationMs: z.number(),
  fps: z.number(),
  width: z.number(),
  height: z.number(),
});

export const CreateGithubIssueSchema = z.object({
  title: z.string().min(2),
  body: z.string().optional(),
  repo: z.string().regex(/^[\w-]+\/[\w-]+$/, "Invalid repository format"),
  owner: z.string().min(2).optional(),
});

export const GetAllGithubIssuesSchema = z.object({
  repo: z.string().regex(/^[\w-]+\/[\w-]+$/, "Invalid repository format"),
  owner: z.string().min(2).optional(),
});

export const CreateGithubIssueCommentSchema = z.object({
  repo: z.string().regex(/^[\w-]+\/[\w-]+$/, "Invalid repository format"),
  issueNumber: z.number().int().positive(),
  owner: z.string().min(2).optional(),
  comment: z.string().min(1),
});

export const UpdateGithubIssueSchema = z.object({
  repo: z.string().regex(/^[\w-]+\/[\w-]+$/, "Invalid repository format"),
  issueNumber: z.number().int().positive(),
  owner: z.string().min(2).optional(),
  title: z.string().min(2).optional(),
  body: z.string().optional(),
  state: z.enum(["open", "closed"]).optional(),
});

export const AssignGithubIssueSchema = z.object({
  repo: z.string().regex(/^[\w-]+\/[\w-]+$/, "Invalid repository format"),
  issueNumber: z.number().int().positive(),
  owner: z.string().min(2).optional(),
  assignees: z.array(z.string().min(2)).min(1),
});

export const CreateGithubLabelSchema = z.object({
  repo: z.string().regex(/^[\w-]+\/[\w-]+$/, "Invalid repository format"),
  owner: z.string().min(2).optional(),
  issueNumber: z.number().int().positive(),
  labels: z.array(z.string().min(2)).min(1),
});

export const StoreGithubDataSchema = z.object({
  access_token: z.string(),
  githubUsername: z.string(),
});
