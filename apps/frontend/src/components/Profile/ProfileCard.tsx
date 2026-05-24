import { useRef, useState } from "react";
import { getInitials } from "./helpers";
import type { User } from "./types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "@/https";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Camera, Upload } from "lucide-react";

const fallbackName = "User";

export const ProfileCard = ({ user, dark }: { user: User; dark: boolean }) => {
  const userName = user.name?.trim() || fallbackName;
  const [nameInput, setNameInput] = useState(userName);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();

  const handleSaveMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await http.post("/user/update-profile", { name });
      return response.data;
    },
    onSuccess: () => {
      toast.success("Profile updated successfully");
      setEditing(false);
      setSaving(false);
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
    onError: (error) => {
      toast.error("Failed to update profile");
      console.error("Update profile failed:", error);
      setSaving(false);
    },
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("avatar", file);
      const response = await http.post<{ avatarUrl: string }>(
        "/user/avatar/upload",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return response.data.avatarUrl;
    },
    onSuccess: () => {
      toast.success("Avatar updated");
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
    onError: (error) => {
      toast.error("Failed to upload avatar");
      console.error("Avatar upload failed:", error);
    },
  });

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    avatarMutation.mutate(file);
  };

  const startEditing = () => {
    setNameInput(userName);
    setEditing(true);
  };

  return (
    <motion.div
      className={`rounded-[28px] border p-6 transition-colors shadow-[0_18px_56px_rgba(0,0,0,0.28)] ${dark ? "border-white/10 bg-[linear-gradient(180deg,rgba(20,20,20,0.96),rgba(12,12,12,0.96))]" : "bg-white border-zinc-200"}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0 overflow-hidden">
          <div className="group relative shrink-0">
            <div className="absolute -inset-1 rounded-[26px] bg-[radial-gradient(circle_at_top,rgba(245,166,35,0.24),transparent_72%)] blur-sm opacity-80" />
            <div className="relative rounded-[24px] bg-[linear-gradient(135deg,rgba(245,166,35,0.35),rgba(255,255,255,0.04))] p-1 shadow-[0_0_0_1px_rgba(245,166,35,0.12)]">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group/avatar relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,#ffd166,#f5a623)] text-xl font-bold tracking-tight text-black shadow-[0_18px_32px_rgba(245,166,35,0.26)] select-none"
              >
                {user.avatarUrl && user.avatarUrl !== "null" ? (
                  <img
                    src={user.avatarUrl}
                    alt={`${userName} avatar`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{getInitials(userName)}</span>
                )}
                <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0.38))] opacity-0 transition-opacity duration-200 group-hover/avatar:opacity-100" />
                <span className="absolute bottom-2 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-black/10 bg-white/80 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-black opacity-0 shadow-[0_10px_20px_rgba(0,0,0,0.12)] transition-all duration-200 group-hover/avatar:opacity-100">
                  <Upload className="size-3" />
                  Photo
                </span>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`absolute -right-1 -bottom-1 inline-flex size-8 cursor-pointer items-center justify-center rounded-full border shadow-[0_12px_20px_rgba(0,0,0,0.24)] transition-all ${dark ? "border-white/10 bg-[#141414] text-amber-200 hover:border-amber-400/30" : "border-zinc-200 bg-white text-amber-600 hover:border-amber-400"}`}
            >
              <Camera className="size-3.5" />
            </button>
          </div>
          <div className="min-w-0 overflow-hidden">
            <motion.div
              layout
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="overflow-hidden"
            >
              {editing ? (
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className={`w-56 border-b-2 border-amber-500 bg-transparent pb-1 text-2xl font-semibold outline-none sm:text-3xl ${dark ? "text-white" : "text-zinc-900"}`}
                  autoFocus
                />
              ) : (
                <div
                  className={`truncate text-2xl font-semibold tracking-tight sm:text-3xl ${dark ? "text-white" : "text-zinc-900"}`}
                >
                  {userName}
                </div>
              )}
            </motion.div>
            <div
              className={`mt-1 truncate text-sm ${dark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              {user.email || ""}
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400/18 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
              Free plan
            </div>
          </div>
        </div>
        {/* floating edit removed — replaced with full-width control at the bottom */}
      </div>
      {editing ? (
        <motion.div
          className="pt-3 flex flex-col gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <button
            onClick={() => {
              setEditing(false);
              setNameInput(userName);
            }}
            className={`w-full cursor-pointer rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors ${
              dark
                ? "border-white/10 text-zinc-400 hover:border-white/15 hover:text-zinc-200"
                : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
            }`}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setSaving(true);
              handleSaveMutation.mutate(nameInput);
            }}
            disabled={saving}
            className="w-full cursor-pointer rounded-xl bg-[linear-gradient(135deg,#ffd166,#f5a623)] px-3.5 py-2 text-sm font-semibold text-black shadow-[0_12px_24px_rgba(245,166,35,0.18)] transition-all hover:brightness-105 disabled:opacity-60"
          >
            {saving ? "Saving\u2026" : "Save"}
          </button>
        </motion.div>
      ) : (
        <div className="pt-4">
          <button
            onClick={startEditing}
            className={`w-full cursor-pointer rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
              dark
                ? "border-white/10 text-zinc-300 hover:border-amber-400/30 hover:bg-amber-400/10 hover:text-amber-100"
                : "border-zinc-200 text-zinc-500 hover:border-amber-400 hover:text-amber-500"
            }`}
          >
            Edit profile
          </button>
        </div>
      )}
    </motion.div>
  );
};
