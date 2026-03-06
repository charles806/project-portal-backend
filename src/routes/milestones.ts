import { Router, Response, NextFunction } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { UnauthorizedError, BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';

const router = Router();

router.use(authenticateToken);

// GET /api/v1/projects/:projectId/milestones - Get all milestones for project
router.get('/:projectId/milestones', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    const userId = req.user.userId;
    const { projectId } = req.params;

    // Verify user has access to project
    const project = await prisma.project.findUnique({
      where: { id: projectId as string },
      include: { workspace: true }
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const hasAccess = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: project.workspaceId,
        userId
      }
    });

    if (!hasAccess) {
      throw new ForbiddenError('Access denied');
    }

    const milestones = await prisma.milestone.findMany({
      where: { projectId: projectId as string },
      orderBy: { dueDate: 'asc' }
    });

    res.json(milestones);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/milestones/:id - Get single milestone
router.get('/milestones/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const milestone = await prisma.milestone.findUnique({
      where: { id: id as string },
      include: {
        project: {
          include: { workspace: true }
        }
      }
    });

    if (!milestone) {
      throw new NotFoundError('Milestone not found');
    }

    // Verify access
    const hasAccess = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: milestone.project.workspaceId,
        userId
      }
    });

    if (!hasAccess) {
      throw new ForbiddenError('Access denied');
    }

    res.json(milestone);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/projects/:projectId/milestones - Create milestone
router.post('/:projectId/milestones', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { projectId } = req.params;
    const { title, description, dueDate, status, assignee } = req.body;

    if (!title || !dueDate) {
      throw new BadRequestError('Missing required fields');
    }

    // Verify project exists and user has access
    const project = await prisma.project.findUnique({
      where: { id: projectId as string }
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const hasAccess = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: project.workspaceId,
        userId
      }
    });

    if (!hasAccess) {
      throw new ForbiddenError('Access denied');
    }

    const milestone = await prisma.milestone.create({
      data: {
        projectId: projectId as string,
        title,
        description: description || null,
        dueDate: new Date(dueDate),
        status: status || 'pending',
        assignee: assignee || null
      }
    });

    res.status(201).json(milestone);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/milestones/:id - Update milestone
router.patch('/milestones/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Get milestone and check access
    const existingMilestone = await prisma.milestone.findUnique({
      where: { id: id as string },
      include: {
        project: true
      }
    });

    if (!existingMilestone) {
      throw new NotFoundError('Milestone not found');
    }

    const hasAccess = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: existingMilestone.project.workspaceId,
        userId
      }
    });

    if (!hasAccess) {
      throw new ForbiddenError('Access denied');
    }

    const updateData = { ...req.body };
    if (updateData.dueDate) {
      updateData.dueDate = new Date(updateData.dueDate);
    }

    const milestone = await prisma.milestone.update({
      where: { id: id as string },
      data: updateData
    });

    res.json(milestone);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/milestones/:id - Delete milestone
router.delete('/milestones/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const milestone = await prisma.milestone.findUnique({
      where: { id: id as string },
      include: {
        project: true
      }
    });

    if (!milestone) {
      throw new NotFoundError('Milestone not found');
    }

    // Verify access (member can delete)
    const hasAccess = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: milestone.project.workspaceId,
        userId
      }
    });

    if (!hasAccess) {
      throw new ForbiddenError('Access denied');
    }

    await prisma.milestone.delete({
      where: { id: id as string }
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;