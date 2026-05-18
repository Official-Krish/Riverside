/* eslint-disable */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "../../../https";
import {
  emptyIssueDraft,
  getIssueDraft,
  githubReposQueryKey,
  type Issue,
  type IssueDraft,
  type IssueDrafts,
  type RepoItem,
} from "./issueActions.shared";
import { toast } from "sonner";

export function useIssueActionsQueries({
  isOpen,
  prefillCmd,
  initialRepo,
}: {
  isOpen: boolean;
  prefillCmd?: string;
  initialRepo?: string;
}) {
  const [selectedRepo, setSelectedRepo] = useState("");
  const [drafts, setDrafts] = useState<IssueDrafts>({});
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

  const issuesQueryKey = ["github", "issues", selectedRepo] as const;

  const issuesQuery = useQuery<Issue[]>({
    queryKey: issuesQueryKey,
    queryFn: async () => {
      const res = await http.get("/github/issues", {
        params: { repo: selectedRepo },
      });
      return res.data.issues || res.data || [];
    },
    enabled: Boolean(selectedRepo && isOpen),
    retry: false,
  });

  useEffect(() => {
    if (!isOpen || !reposQuery.data?.length) return;

    if (initialRepo) {
      const matchingInitialRepo = reposQuery.data.find(
        (item) => item.full_name === initialRepo,
      );

      if (matchingInitialRepo) {
        setSelectedRepo(matchingInitialRepo.full_name);
        return;
      }
    }

    const repoFromCommand = prefillCmd?.split(/\s+/)[0];
    const matchingRepo = repoFromCommand
      ? reposQuery.data.find((item) => item.full_name === repoFromCommand)
      : undefined;

    setSelectedRepo(
      matchingRepo?.full_name || reposQuery.data[0].full_name || "",
    );
  }, [initialRepo, isOpen, prefillCmd, reposQuery.data]);

  const updateDraft = (
    issueNumber: number,
    key: keyof IssueDraft,
    value: string,
  ) => {
    setDrafts((current) => ({
      ...current,
      [issueNumber]: {
        ...getIssueDraft(current, issueNumber),
        [key]: value,
      },
    }));
  };

  const commentMutation = useMutation({
    mutationFn: async ({
      issueNumber,
      comment,
    }: {
      issueNumber: number;
      comment: string;
    }) =>
      http.post("/github/issue/comment", {
        repo: selectedRepo,
        issueNumber,
        comment,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: issuesQueryKey });
      toast.success("Comment added successfully");
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (issueNumber: number) =>
      http.patch("/github/issue/update", {
        repo: selectedRepo,
        issueNumber,
        state: "closed",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: issuesQueryKey });
      toast.success("Issue closed successfully");
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({
      issueNumber,
      assignees,
    }: {
      issueNumber: number;
      assignees: string[];
    }) =>
      http.post("/github/issue/assign", {
        repo: selectedRepo,
        issueNumber,
        assignees,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: issuesQueryKey });
      toast.success("Assignees updated successfully");
    },
  });

  const labelsMutation = useMutation({
    mutationFn: async ({
      issueNumber,
      labels,
    }: {
      issueNumber: number;
      labels: string[];
    }) =>
      http.post("/github/issue/labels", {
        repo: selectedRepo,
        issueNumber,
        labels,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: issuesQueryKey });
      toast.success("Labels updated successfully");
    },
  });

  const doComment = (issueNumber: number) => {
    const comment = getIssueDraft(drafts, issueNumber).comment.trim();
    if (!comment) return;

    commentMutation.mutate({ issueNumber, comment });
    updateDraft(issueNumber, "comment", emptyIssueDraft.comment);
    toast.success("Comment added successfully");
  };

  const doClose = (issueNumber: number) => closeMutation.mutate(issueNumber);

  const doAssign = (issueNumber: number) => {
    const assignees = getIssueDraft(drafts, issueNumber)
      .assignees.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!assignees.length) return;

    assignMutation.mutate({ issueNumber, assignees });
    updateDraft(issueNumber, "assignees", emptyIssueDraft.assignees);
    toast.success("Assignees updated successfully");
  };

  const doLabels = (issueNumber: number) => {
    const labels = getIssueDraft(drafts, issueNumber)
      .labels.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!labels.length) return;

    labelsMutation.mutate({ issueNumber, labels });
    updateDraft(issueNumber, "labels", emptyIssueDraft.labels);
    toast.success("Labels updated successfully");
  };

  return {
    selectedRepo,
    setSelectedRepo,
    reposQuery,
    issuesQuery,
    drafts,
    updateDraft,
    doComment,
    doClose,
    doAssign,
    doLabels,
    actionError:
      commentMutation.error ||
      closeMutation.error ||
      assignMutation.error ||
      labelsMutation.error,
    isCommentPending: commentMutation.isPending,
    isClosePending: closeMutation.isPending,
    isAssignPending: assignMutation.isPending,
    isLabelsPending: labelsMutation.isPending,
    issuesQueryKey,
  };
}
