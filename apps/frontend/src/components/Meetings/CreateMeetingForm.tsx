import { Lock, Mail, UserPlus, Users, X } from "lucide-react";

type CreateMeetingFormProps = {
  formId: string;
  roomName: string;
  passcode: string;
  inviteEmail: string;
  invites: string[];
  onRoomNameChange: (value: string) => void;
  onPasscodeChange: (value: string) => void;
  onInviteEmailChange: (value: string) => void;
  onAddInvite: () => void;
  onRemoveInvite: (email: string) => void;
  onSubmit: () => void;
};

export function CreateMeetingForm({
  formId,
  roomName,
  passcode,
  inviteEmail,
  invites,
  onRoomNameChange,
  onPasscodeChange,
  onInviteEmailChange,
  onAddInvite,
  onRemoveInvite,
  onSubmit,
}: CreateMeetingFormProps) {
  return (
    <form
      id={formId}
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="space-y-1.5">
        <p className="text-[12px] font-medium text-[#c8a870]/70">Room name</p>
        <div className="relative">
          <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={roomName}
            onChange={(event) => onRoomNameChange(event.target.value)}
            placeholder="team-sync-room"
            className="w-full rounded-xl border border-input bg-card px-4 py-3 pl-10 text-sm text-foreground outline-none transition focus:border-[#f5a623]/45 focus:ring-2 focus:ring-[#f5a623]/20"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[12px] font-medium text-[#c8a870]/70">
          Passcode (optional)
        </p>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={passcode}
            onChange={(event) => onPasscodeChange(event.target.value)}
            placeholder="Set room passcode (Minimum 4 Characters)"
            className="w-full rounded-xl border border-input bg-card px-4 py-3 pl-10 text-sm text-foreground outline-none transition focus:border-[#f5a623]/45 focus:ring-2 focus:ring-[#f5a623]/20"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[12px] font-medium text-[#c8a870]/70">
          Invite participants
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={inviteEmail}
              onChange={(event) => onInviteEmailChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onAddInvite();
                }
              }}
              placeholder="participant@email.com"
              className="w-full rounded-xl border border-input bg-card px-4 py-3 pl-10 text-sm text-foreground outline-none transition focus:border-[#f5a623]/45 focus:ring-2 focus:ring-[#f5a623]/20"
            />
          </div>
          <button
            type="button"
            onClick={onAddInvite}
            className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground transition hover:bg-secondary"
          >
            <UserPlus className="h-4 w-4" />
          </button>
        </div>

        {invites.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {invites.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs text-foreground"
              >
                {email}
                <button
                  type="button"
                  onClick={() => onRemoveInvite(email)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </form>
  );
}
