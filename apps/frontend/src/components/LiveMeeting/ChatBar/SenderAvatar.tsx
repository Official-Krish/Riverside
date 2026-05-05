import { senderIndex, AVATAR_GRADIENTS, AVATAR_TEXT } from "./meetingChatSidebar.shared";

export function SenderAvatar({ name, size = "lg" }: { name: string; size?: "sm" | "lg" }) {
  const index = senderIndex(name);
  const dim = size === "sm" ? "size-6 text-[10px]" : "size-8 text-[12px]";
  return (
    <span
      className={`inline-flex ${dim} shrink-0 items-center justify-center rounded-full bg-linear-to-br ${AVATAR_GRADIENTS[index]} ${AVATAR_TEXT[index]} font-extrabold`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export default SenderAvatar;
