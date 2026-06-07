import { useState } from "react";
import { multicamApi } from "../api";
import { Film, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  meetingId: string;
  roomId: string;
  onConverted: (projectId: string) => void;
}

export function ConvertToMulticam({ meetingId, roomId, onConverted }: Props) {
  const [converting, setConverting] = useState(false);

  const handleConvert = async () => {
    setConverting(true);
    try {
      const result = await multicamApi.init(meetingId, roomId);
      toast.success("Multicam project created");
      onConverted(result.projectId);
    } catch {
      toast.error("Failed to create multicam project");
    } finally {
      setConverting(false);
    }
  };

  return (
    <button
      onClick={handleConvert}
      disabled={converting}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer disabled:opacity-50"
      style={{
        background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
        color: "#fff",
        boxShadow: "0 2px 8px rgba(168,85,247,0.3)",
      }}
    >
      {converting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Film className="h-4 w-4" />
      )}
      {converting ? "Converting..." : "Multicam Editing"}
    </button>
  );
}
