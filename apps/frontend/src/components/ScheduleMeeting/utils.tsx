import { Bell } from "lucide-react";
import { FaDiscord, FaSlack } from "react-icons/fa";
import { SiGmail } from "react-icons/si";

export type NotificationType = "GMAIL" | "SLACK" | "DISCORD";

export interface NotificationOption {
  id: NotificationType | null;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  glow: string;
}

export const NOTIFICATION_OPTIONS: NotificationOption[] = [
  {
    id: null,
    label: "None",
    description: "No external notification",
    icon: <Bell className="size-3.5" />,
    color: "text-[#6b5c35]",
    glow: "",
  },
  {
    id: "GMAIL",
    label: "Email",
    description: "Send email invitations",
    icon: <SiGmail className="size-3.5" />,
    color: "text-[#ea4335]",
    glow: "shadow-[0_0_16px_rgba(234,67,53,0.25)]",
  },
  {
    id: "SLACK",
    label: "Slack",
    description: "DM invitees via Slack bot",
    icon: <FaSlack className="size-3.5" />,
    color: "text-[#4a154b]",
    glow: "shadow-[0_0_16px_rgba(74,21,75,0.35)]",
  },
  {
    id: "DISCORD",
    label: "Discord",
    description: "Post to Discord webhook",
    icon: <FaDiscord className="size-3.5" />,
    color: "text-[#5865f2]",
    glow: "shadow-[0_0_16px_rgba(88,101,242,0.3)]",
  },
];

export interface NotificationSelectorProps {
  notificationType: NotificationType | null;
  setNotificationType: (type: NotificationType | null) => void;
  slackBotToken: string;
  setSlackBotToken: (token: string) => void;
  slackUserId: string;
  setSlackUserId: (id: string) => void;
  discordWebhookUrl: string;
  setDiscordWebhookUrl: (url: string) => void;
}
