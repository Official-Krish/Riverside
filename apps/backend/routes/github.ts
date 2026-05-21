import express from "express";
import axios from "axios";
import qs from "querystring";
import { authMiddleware } from "../utils/authMiddleware";
import { prisma } from "@repo/db/client";
import {
  AssignGithubIssueSchema,
  CreateGithubIssueCommentSchema,
  CreateGithubIssueSchema,
  CreateGithubLabelSchema,
  GetAllGithubIssuesSchema,
  UpdateGithubIssueSchema,
} from "@repo/types";
import jwt from "jsonwebtoken";

const GithubRouter = express.Router();

const CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GITHUB_REDIRECT_URI!;

function resolveGithubRepo(repo: string, owner?: string | null) {
  const [repoOwner, repoName] = repo.includes("/")
    ? repo.split("/")
    : [owner, repo];
  return { repoOwner, repoName };
}

GithubRouter.get("/", (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(400).json({ error: "Missing token" });
  }
  const params = qs.stringify({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "repo",
    state: token as string,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

GithubRouter.get("/callback", async (req, res) => {
  const code = req.query.code as string;
  const state = req.query.state as string;

  try {
    const decoded = jwt.verify(state, process.env.JWT_SECRET!, {
      algorithms: ["HS256"],
    });

    // Extract user ID from the decoded token
    const userId = (decoded as any).userId;

    const tokenRes = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      },
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    const access_token = tokenRes.data.access_token;
    const userRes = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const user = userRes.data;

    if (user) {
      const response = await prisma.user.update({
        where: { id: userId, isVerified: true },
        data: {
          githubToken: access_token,
          githubUsername: user.login,
        },
      });
      if (!response) {
        return res
          .status(404)
          .json({ error: "User not found or not verified" });
      }
      res.redirect(`${process.env.FRONTEND_URL}/profile`);
    } else {
      res.status(400).json({ error: "Failed to fetch user info" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "OAuth failed" });
  }
});

GithubRouter.post("/webhook", async (req, res) => {
  const event = req.headers["x-github-event"] as string;

  try {
    switch (event) {
      case "issues": {
        const action = req.body.action;
        const issue = req.body.issue;

        if (action === "opened") {
          // TODO: push to meeting
          console.log("New issue:", issue.title);
        }

        if (action === "closed") {
          console.log("Issue closed:", issue.title);
        }

        break;
      }

      case "issue_comment": {
        const comment = req.body.comment;

        console.log("New comment:", comment.body);

        break;
      }

      default:
        console.log("Unhandled event:", event);
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Webhook handling failed" });
  }
});

GithubRouter.get("/user", authMiddleware, async (req, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId, isVerified: true },
      select: { githubToken: true },
    });

    if (!user || !user.githubToken) {
      return res
        .status(404)
        .json({ error: "GitHub access token not found for user" });
    }

    const { data } = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${user.githubToken}` },
    });

    res.status(200).json({ githubUser: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch GitHub user info" });
  }
});

GithubRouter.get("/repos", authMiddleware, async (req, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId, isVerified: true },
      select: { githubToken: true },
    });

    if (!user || !user.githubToken) {
      return res
        .status(404)
        .json({ error: "GitHub access token not found for user" });
    }

    const { data } = await axios.get("https://api.github.com/user/repos", {
      headers: { Authorization: `Bearer ${user.githubToken}` },
    });
    const filtered = data.filter((repo: any) => repo.permissions.push);

    res.status(200).json({ githubRepos: filtered });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch GitHub repos" });
  }
});

GithubRouter.post("/create/issue", authMiddleware, async (req, res) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  const { title, body, owner, repo } = CreateGithubIssueSchema.parse(req.body);

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId, isVerified: true },
      select: { githubToken: true, githubUsername: true },
    });

    if (!user || !user.githubToken) {
      return res.status(404).json({ error: "GitHub access token not found" });
    }

    const { repoOwner, repoName } = resolveGithubRepo(
      repo,
      owner || user.githubUsername,
    );

    const { data } = await axios.post(
      `https://api.github.com/repos/${repoOwner}/${repoName}/issues`,
      { title, body },
      {
        headers: {
          Authorization: `Bearer ${user.githubToken}`,
          Accept: "application/vnd.github+json",
        },
      },
    );

    res.status(200).json({ issue: data });
  } catch (err: any) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to create GitHub issue" });
  }
});

GithubRouter.get("/issues", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const { owner, repo } = GetAllGithubIssuesSchema.parse(req.query);

  if (!userId || !repo) {
    return res.status(400).json({ error: "Missing params" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId, isVerified: true },
      select: { githubToken: true, githubUsername: true },
    });

    if (!user || !user.githubToken) {
      return res.status(404).json({ error: "GitHub access token not found" });
    }

    const { repoOwner, repoName } = resolveGithubRepo(
      repo,
      owner || user.githubUsername,
    );

    const { data } = await axios.get(
      `https://api.github.com/repos/${repoOwner}/${repoName}/issues`,
      {
        headers: {
          Authorization: `Bearer ${user?.githubToken}`,
        },
      },
    );

    res.status(200).json({ issues: data });
  } catch (err: any) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch issues" });
  }
});

GithubRouter.post("/issue/comment", authMiddleware, async (req, res) => {
  const userId = req.userId;

  const { owner, repo, issueNumber, comment } =
    CreateGithubIssueCommentSchema.parse(req.body);
  if (!repo || !issueNumber || !comment) {
    return res.status(400).json({ error: "Missing params" });
  }

  if (!userId) {
    return res.status(400).json({ error: "User ID required" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId, isVerified: true },
      select: { githubToken: true, githubUsername: true },
    });

    if (!user || !user.githubToken) {
      return res.status(404).json({ error: "GitHub access token not found" });
    }

    const { repoOwner, repoName } = resolveGithubRepo(
      repo,
      owner || user.githubUsername,
    );

    const { data } = await axios.post(
      `https://api.github.com/repos/${repoOwner}/${repoName}/issues/${issueNumber}/comments`,
      { body: comment },
      {
        headers: {
          Authorization: `Bearer ${user?.githubToken}`,
        },
      },
    );

    res.status(200).json({ message: "Comment added", comment: data });
  } catch (err: any) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

GithubRouter.patch("/issue/update", authMiddleware, async (req, res) => {
  const userId = req.userId;

  const { owner, repo, issueNumber, state, title, body } =
    UpdateGithubIssueSchema.parse(req.body);
  if (!repo || !issueNumber) {
    return res.status(400).json({ error: "Missing params" });
  }

  if (!userId) {
    return res.status(400).json({ error: "Not authenticated" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId, isVerified: true },
      select: { githubToken: true, githubUsername: true },
    });

    if (!user || !user.githubToken) {
      return res.status(404).json({ error: "GitHub access token not found" });
    }

    const { repoOwner, repoName } = resolveGithubRepo(
      repo,
      owner || user.githubUsername,
    );

    const { data } = await axios.patch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/issues/${issueNumber}`,
      { state, title, body },
      {
        headers: {
          Authorization: `Bearer ${user?.githubToken}`,
        },
      },
    );

    res.status(200).json({ message: "Issue updated", issue: data });
  } catch (err: any) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to update issue" });
  }
});

GithubRouter.post("/issue/assign", authMiddleware, async (req, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(400).json({ error: "Not authenticated" });
  }

  const { owner, repo, issueNumber, assignees } = AssignGithubIssueSchema.parse(
    req.body,
  );

  if (!repo || !issueNumber || !assignees) {
    return res.status(400).json({ error: "Missing params" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId, isVerified: true },
      select: { githubToken: true, githubUsername: true },
    });

    if (!user || !user.githubToken) {
      return res.status(404).json({ error: "GitHub access token not found" });
    }

    const { repoOwner, repoName } = resolveGithubRepo(
      repo,
      owner || user.githubUsername,
    );

    const { data } = await axios.post(
      `https://api.github.com/repos/${repoOwner}/${repoName}/issues/${issueNumber}/assignees`,
      { assignees },
      {
        headers: {
          Authorization: `Bearer ${user?.githubToken}`,
        },
      },
    );

    res.status(200).json({ message: "Users assigned", assignees: data });
  } catch (err: any) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to assign users" });
  }
});

GithubRouter.post("/issue/labels", authMiddleware, async (req, res) => {
  const userId = req.userId;

  const { owner, repo, issueNumber, labels } = CreateGithubLabelSchema.parse(
    req.body,
  );

  if (!userId) {
    return res.status(400).json({ error: "User ID required" });
  }
  if (!repo || !issueNumber || !labels) {
    return res.status(400).json({ error: "Missing params" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId, isVerified: true },
      select: { githubToken: true, githubUsername: true },
    });
    if (!user || !user.githubToken) {
      return res.status(404).json({ error: "GitHub access token not found" });
    }

    const { repoOwner, repoName } = resolveGithubRepo(
      repo,
      owner || user.githubUsername,
    );

    const { data } = await axios.post(
      `https://api.github.com/repos/${repoOwner}/${repoName}/issues/${issueNumber}/labels`,
      { labels },
      {
        headers: {
          Authorization: `Bearer ${user?.githubToken}`,
        },
      },
    );

    res.status(200).json({ message: "Labels added", labels: data });
  } catch (err: any) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to add labels" });
  }
});

GithubRouter.get("/filtered-repos", authMiddleware, async (req, res) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(400).json({ error: "User ID required" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId, isVerified: true },
      select: { githubToken: true },
    });
    if (!user || !user.githubToken) {
      return res.status(404).json({ error: "GitHub access token not found" });
    }

    const { data } = await axios.get("https://api.github.com/user/repos", {
      headers: {
        Authorization: `Bearer ${user?.githubToken}`,
      },
    });

    const filtered = data.filter((repo: any) => repo.permissions.push);

    res.status(200).json({ message: "Filtered repos", repos: filtered });
  } catch (err: any) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch repos" });
  }
});

export default GithubRouter;
