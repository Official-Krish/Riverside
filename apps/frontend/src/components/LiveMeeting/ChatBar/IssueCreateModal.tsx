/* eslint-disable */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, X } from "lucide-react";
import { http } from "../../../https";

type GithubIssue = { title?: string; html_url?: string };
type RepoItem = {
  name: string;
  full_name: string;
  owner?: { login: string };
  permissions?: { push?: boolean };
};

const githubReposQueryKey = ["github", "repos"] as const;

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { error?: string } } })
      .response;
    return response?.data?.error || fallback;
  }

  if (error instanceof Error) return error.message;
  return fallback;
}

export function IssueCreateModal({
  isOpen,
  onClose,
  prefillTitle,
  initialRepo,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  prefillTitle?: string;
  initialRepo?: string;
  onCreated?: (issue: GithubIssue) => void;
}) {
  const [selectedRepo, setSelectedRepo] = useState("");
  const [title, setTitle] = useState(prefillTitle || "");
  const [body, setBody] = useState("");
  const queryClient = useQueryClient();

  const reposQuery = useQuery<RepoItem[]>({
    queryKey: githubReposQueryKey,
    queryFn: async () => {
      const res = await http.get("/github/repos");
      return res.data.githubRepos || res.data.repos || [];
    },
    enabled: isOpen,
    retry: false,
  });

  useEffect(() => {
    setTitle(prefillTitle || "");
  }, [prefillTitle]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialRepo) {
      setSelectedRepo(initialRepo);
      return;
    }

    if (reposQuery.data && reposQuery.data.length > 0) {
      const first = reposQuery.data[0];
      setSelectedRepo(first.full_name || "");
    }
  }, [initialRepo, isOpen, reposQuery.data]);

  const createMutation = useMutation({
    mutationFn: async (payload: {
      repo: string;
      title: string;
      body: string;
    }) => {
      const res = await http.post("/github/create/issue", payload);
      return res.data.issue || res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: githubReposQueryKey });
      onCreated?.(data);
      onClose();
    },
  });

  const handleCreate = () => {
    if (!selectedRepo || !title.trim()) return;
    createMutation.mutate({ repo: selectedRepo, title: title.trim(), body });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-[520px] rounded-xl border border-[#f5a623]/12 bg-[#0d0b08] p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#fff5de]">
            Create GitHub Issue
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg border border-white/8 bg-white/4 text-[#c8a870]/70 transition hover:bg-white/8 cursor-pointer"
            aria-label="Close issue modal"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {reposQuery.isLoading ? (
            <div className="text-sm text-[#c8a870]/50">
              Loading repositories…
            </div>
          ) : reposQuery.isError ? (
            <div className="rounded border border-[#f5a623]/8 bg-[#f5a623]/5 p-3 text-sm text-[#f5a623]/80">
              {getErrorMessage(
                reposQuery.error,
                "GitHub is not connected. Connect GitHub in your profile first.",
              )}
              <div className="mt-2">
                <a href="/profile" className="text-sm text-[#f5a623] underline">
                  Open profile
                </a>
              </div>
            </div>
          ) : (reposQuery.data?.length || 0) === 0 ? (
            <div className="rounded border border-[#f5a623]/8 bg-[#f5a623]/5 p-3 text-sm text-[#f5a623]/80">
              No repositories with issue creation access were found for this
              GitHub account.
            </div>
          ) : (
            <>
              <label className="text-sm text-[#c8a870]/70">Repository</label>
              <select
                className="w-full rounded border border-white/10 bg-black/30 px-2 py-2 text-sm text-[#fff5de] outline-none focus:border-[#f5a623]/40"
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
              >
                {reposQuery.data?.map((r: RepoItem) => (
                  <option key={r.full_name} value={r.full_name}>
                    {r.full_name}
                  </option>
                ))}
              </select>

              <label className="text-sm text-[#c8a870]/70">Title</label>
              <input
                className="w-full rounded border border-white/10 bg-black/30 px-2 py-2 text-sm text-[#fff5de] outline-none placeholder:text-[#c8a870]/30 focus:border-[#f5a623]/40"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Issue title"
              />

              <label className="text-sm text-[#c8a870]/70">Body</label>
              <textarea
                className="w-full resize-none rounded border border-white/10 bg-black/30 px-2 py-2 text-sm text-[#fff5de] outline-none placeholder:text-[#c8a870]/30 focus:border-[#f5a623]/40"
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What should be fixed or built?"
              />
            </>
          )}
          {createMutation.isError && (
            <div className="rounded border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
              {getErrorMessage(
                createMutation.error,
                "Failed to create GitHub issue.",
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-white/5 px-3 py-2 text-sm text-[#fff5de] transition hover:bg-white/10 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={
              createMutation.isPending ||
              reposQuery.isError ||
              !title.trim() ||
              !selectedRepo
            }
            className="inline-flex items-center gap-2 rounded bg-[#f5a623] px-3 py-2 text-sm font-semibold text-black transition hover:bg-[#ffbd4a] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {createMutation.isPending && (
              <LoaderCircle className="size-4 animate-spin" />
            )}
            {createMutation.isPending ? "Creating…" : "Create Issue"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default IssueCreateModal;
