import { Lock, Users } from "lucide-react";

type JoinMeetingFormProps = {
  formId: string;
  meetingId: string;
  passcode: string;
  onMeetingIdChange: (value: string) => void;
  onPasscodeChange: (value: string) => void;
  onSubmit: () => void;
};

export function JoinMeetingForm({
  formId,
  meetingId,
  passcode,
  onMeetingIdChange,
  onPasscodeChange,
  onSubmit,
}: JoinMeetingFormProps) {
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
        <p className="text-[12px] font-medium text-[#c8a870]/70">Meeting ID</p>
        <div className="relative">
          <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={meetingId}
            onChange={(event) => onMeetingIdChange(event.target.value)}
            placeholder="meeting id"
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
            placeholder="Room passcode"
            className="w-full rounded-xl border border-input bg-card px-4 py-3 pl-10 text-sm text-foreground outline-none transition focus:border-[#f5a623]/45 focus:ring-2 focus:ring-[#f5a623]/20"
          />
        </div>
      </div>
    </form>
  );
}
