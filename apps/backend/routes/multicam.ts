import express from "express";
import { authMiddleware } from "../utils/authMiddleware";
import { prisma } from "@repo/db/client";
import {
  CreateMulticamProjectSchema,
  SaveMulticamLayoutSchema,
  BatchSaveFramingSchema,
  BatchSavePrioritySchema,
} from "@repo/types";
import {
  seedMulticamProject,
  buildParticipantManifest,
  generateAutoCutSegments,
} from "../utils/multicam.service";
import { toPublicRecordingLink } from "../utils/storage";

const multicamRouter = express.Router();

multicamRouter.post("/init", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const parseData = CreateMulticamProjectSchema.safeParse(req.body);

  if (!userId) {
    return res.status(400).json({ message: "Missing fields" });
  }
  if (!parseData.success) {
    return res.status(400).json({
      message: "Invalid request body",
      errors: parseData.error.errors,
    });
  }

  try {
    const { meetingId } = parseData.data;

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        roomId: true,
        userId: true,
        finalRecording: { select: { id: true } },
      },
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    const isHost = meeting.userId === userId;
    const isParticipant = !!(await prisma.meetingParticipant.findFirst({
      where: { meetingId, userId },
    }));

    if (!isHost && !isParticipant) {
      return res
        .status(403)
        .json({ message: "You do not have access to this meeting" });
    }

    const projectId = await seedMulticamProject(
      meetingId,
      meeting.roomId,
      userId,
      meeting.finalRecording?.id ?? null,
    );

    const sources = await buildParticipantManifest(meetingId);

    return res.status(201).json({
      projectId,
      layout: null,
      sources,
    });
  } catch (error) {
    console.error("Error initializing multicam project:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

multicamRouter.get("/projects/:projectId", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const projectId = req.params.projectId as string;

  if (!userId || !projectId) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    const project = await prisma.editorProject.findFirst({
      where: { id: projectId, ownerId: userId, sourceMode: "MULTITRACK" },
      include: {
        tracks: {
          include: { clips: true },
          orderBy: { order: "asc" },
        },
        overlays: true,
        assets: true,
        meeting: {
          include: {
            finalRecording: true,
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ message: "Multicam project not found" });
    }

    const [layouts, framings, priorities, sources, speakerTimelines] =
      await Promise.all([
        prisma.multicamLayout.findMany({
          where: { projectId },
          include: { segments: { orderBy: { timelineStartMs: "asc" } } },
        }),
        prisma.participantFraming.findMany({ where: { projectId } }),
        prisma.cameraPriority.findMany({
          where: { projectId },
          orderBy: { priority: "desc" },
        }),
        buildParticipantManifest(project.meetingId),
        prisma.speakerTimeline.findMany({
          where: { meetingId: project.meetingId },
          orderBy: { startMs: "asc" },
        }),
      ]);

    return res.status(200).json({
      project: {
        ...project,
        assets: project.assets.map((a) => ({
          ...a,
          url: toPublicRecordingLink(a.url),
          waveformUrl: a.waveformUrl
            ? toPublicRecordingLink(a.waveformUrl)
            : null,
          thumbUrl: a.thumbUrl ? toPublicRecordingLink(a.thumbUrl) : null,
        })),
      },
      layouts,
      framings,
      priorities,
      sources,
      speakerTimelines,
    });
  } catch (error) {
    console.error("Error fetching multicam project:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

multicamRouter.put(
  "/projects/:projectId/layouts/:layoutId",
  authMiddleware,
  async (req, res) => {
    const userId = req.userId;
    const projectId = req.params.projectId as string;
    const layoutId = req.params.layoutId as string;
    const parseData = SaveMulticamLayoutSchema.safeParse(req.body);

    if (!userId || !projectId || !layoutId) {
      return res.status(400).json({ message: "Missing fields" });
    }
    if (!parseData.success) {
      return res.status(400).json({
        message: "Invalid request body",
        errors: parseData.error.errors,
      });
    }

    try {
      const project = await prisma.editorProject.findFirst({
        where: { id: projectId, ownerId: userId },
      });
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { segments, ...layoutData } = parseData.data;

      await prisma.$transaction(async (tx) => {
        await tx.multicamLayout.update({
          where: { id: layoutId },
          data: {
            name: layoutData.name,
            viewMode: layoutData.viewMode,
            rows: layoutData.rows,
            cols: layoutData.cols,
          },
        });

        await tx.multicamSegment.deleteMany({ where: { layoutId } });

        if (segments.length > 0) {
          await tx.multicamSegment.createMany({
            data: segments.map((seg, i) => ({
              layoutId,
              participantKey: seg.participantKey,
              timelineStartMs: seg.timelineStartMs,
              durationMs: seg.durationMs,
              transition: seg.transition ?? "cut",
              order: i,
            })),
          });
        }
      });

      const updatedLayout = await prisma.multicamLayout.findUnique({
        where: { id: layoutId },
        include: { segments: { orderBy: { timelineStartMs: "asc" } } },
      });

      return res.status(200).json({ layout: updatedLayout });
    } catch (error) {
      console.error("Error saving layout:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

multicamRouter.post(
  "/projects/:projectId/layouts",
  authMiddleware,
  async (req, res) => {
    const userId = req.userId;
    const projectId = req.params.projectId as string;
    const parseData = SaveMulticamLayoutSchema.safeParse(req.body);

    if (!userId || !projectId) {
      return res.status(400).json({ message: "Missing fields" });
    }
    if (!parseData.success) {
      return res.status(400).json({
        message: "Invalid request body",
        errors: parseData.error.errors,
      });
    }

    try {
      const project = await prisma.editorProject.findFirst({
        where: { id: projectId, ownerId: userId },
      });
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { segments, ...layoutData } = parseData.data;

      const layout = await prisma.$transaction(async (tx) => {
        const layout = await tx.multicamLayout.create({
          data: {
            projectId,
            name: layoutData.name,
            viewMode: layoutData.viewMode,
            rows: layoutData.rows,
            cols: layoutData.cols,
          },
        });

        if (segments.length > 0) {
          await tx.multicamSegment.createMany({
            data: segments.map((seg, i) => ({
              layoutId: layout.id,
              participantKey: seg.participantKey,
              timelineStartMs: seg.timelineStartMs,
              durationMs: seg.durationMs,
              transition: seg.transition ?? "cut",
              order: i,
            })),
          });
        }

        return layout;
      });

      const fullLayout = await prisma.multicamLayout.findUnique({
        where: { id: layout.id },
        include: { segments: { orderBy: { timelineStartMs: "asc" } } },
      });

      return res.status(201).json({ layout: fullLayout });
    } catch (error) {
      console.error("Error creating layout:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

multicamRouter.put(
  "/projects/:projectId/framings",
  authMiddleware,
  async (req, res) => {
    const userId = req.userId;
    const projectId = req.params.projectId as string;
    const parseData = BatchSaveFramingSchema.safeParse(req.body);

    if (!userId || !projectId) {
      return res.status(400).json({ message: "Missing fields" });
    }
    if (!parseData.success) {
      return res.status(400).json({
        message: "Invalid request body",
        errors: parseData.error.errors,
      });
    }

    try {
      const project = await prisma.editorProject.findFirst({
        where: { id: projectId, ownerId: userId },
      });
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      for (const f of parseData.data.framings) {
        await prisma.participantFraming.upsert({
          where: {
            projectId_participantKey: {
              projectId,
              participantKey: f.participantKey,
            },
          },
          update: {
            cropX: f.cropX ?? null,
            cropY: f.cropY ?? null,
            cropW: f.cropW ?? null,
            cropH: f.cropH ?? null,
            zoom: f.zoom,
          },
          create: {
            projectId,
            participantKey: f.participantKey,
            cropX: f.cropX ?? null,
            cropY: f.cropY ?? null,
            cropW: f.cropW ?? null,
            cropH: f.cropH ?? null,
            zoom: f.zoom,
          },
        });
      }

      const framings = await prisma.participantFraming.findMany({
        where: { projectId },
      });
      return res.status(200).json({ framings });
    } catch (error) {
      console.error("Error saving framings:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

multicamRouter.put(
  "/projects/:projectId/priorities",
  authMiddleware,
  async (req, res) => {
    const userId = req.userId;
    const projectId = req.params.projectId as string;
    const parseData = BatchSavePrioritySchema.safeParse(req.body);

    if (!userId || !projectId) {
      return res.status(400).json({ message: "Missing fields" });
    }
    if (!parseData.success) {
      return res.status(400).json({
        message: "Invalid request body",
        errors: parseData.error.errors,
      });
    }

    try {
      const project = await prisma.editorProject.findFirst({
        where: { id: projectId, ownerId: userId },
      });
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      for (const cp of parseData.data.priorities) {
        await prisma.cameraPriority.upsert({
          where: {
            projectId_participantKey: {
              projectId,
              participantKey: cp.participantKey,
            },
          },
          update: { priority: cp.priority, alwaysVisible: cp.alwaysVisible },
          create: {
            projectId,
            participantKey: cp.participantKey,
            priority: cp.priority,
            alwaysVisible: cp.alwaysVisible,
          },
        });
      }

      const priorities = await prisma.cameraPriority.findMany({
        where: { projectId },
        orderBy: { priority: "desc" },
      });
      return res.status(200).json({ priorities });
    } catch (error) {
      console.error("Error saving priorities:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

multicamRouter.get(
  "/meetings/:meetingId/speakers",
  authMiddleware,
  async (req, res) => {
    const userId = req.userId;
    const meetingId = req.params.meetingId as string;

    if (!userId || !meetingId) {
      return res.status(400).json({ message: "Missing fields" });
    }

    try {
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        select: { userId: true },
      });
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      const isOwner = meeting.userId === userId;
      const isParticipant = !!(await prisma.meetingParticipant.findFirst({
        where: { meetingId, userId },
      }));

      if (!isOwner && !isParticipant) {
        return res.status(403).json({ message: "Access denied" });
      }

      const speakerTimelines = await prisma.speakerTimeline.findMany({
        where: { meetingId },
        orderBy: { startMs: "asc" },
      });

      return res.status(200).json({ speakerTimelines });
    } catch (error) {
      console.error("Error fetching speaker timelines:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

multicamRouter.post(
  "/projects/:projectId/auto-cut",
  authMiddleware,
  async (req, res) => {
    const userId = req.userId;
    const projectId = req.params.projectId as string;

    if (!userId || !projectId) {
      return res.status(400).json({ message: "Missing fields" });
    }

    try {
      const project = await prisma.editorProject.findFirst({
        where: { id: projectId, ownerId: userId },
      });
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const segments = await generateAutoCutSegments(projectId);

      return res.status(201).json({
        segments,
        message: `Generated ${segments.length} auto-cut segments`,
      });
    } catch (error) {
      console.error("Error generating auto-cut segments:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

export default multicamRouter;
