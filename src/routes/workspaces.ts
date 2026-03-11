import { Router, NextFunction, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { UnauthorizedError, ForbiddenError, NotFoundError, BadRequestError } from '../utils/errors';

const router = Router();

// All routes require auth
router.use(authenticateToken);

// GET Request : Get all user's workspaces
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    const userId = req.user.userId;

    const workspaces = await prisma.workspace.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } }
        ]
      },
      include: {
        members: true,
        _count: {
          select: { projects: true, members: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(workspaces);
  } catch (error: any) {
    console.error('[Workspaces GET] Error:', error);
    next(error);
  }
});

// GET Request : Get a specfic workspace by Id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const workspace = await prisma.workspace.findFirst({
      where: {
        id: id as string,
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } }
        ]
      },
      include: {
        members: true,
        projects: {
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: { projects: true, members: true }
        }
      }
    });

    if (!workspace) {
      throw new NotFoundError('Workspace not found');
    }

    res.json(workspace);
  } catch (error) {
    next(error);
  }
});

// POST - Create workspace
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { name } = req.body;

    if (!name) {
      throw new BadRequestError('Workspace name is required');
    }

    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Check if slug exists and append suffix if needed
    const existingWorkspace = await prisma.workspace.findUnique({
      where: { slug }
    });

    if (existingWorkspace) {
      slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    // Transaction to create workspace and owner member
    const result = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name,
          slug,
          ownerId: userId
        }
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: 'owner'
        }
      });

      return workspace;
    });

    res.status(201).json(result);
  } catch (error: any) {
    if (error.code === 'P2002') {
      next(new BadRequestError('Workspace name or slug already taken. Please try a different name.'));
    } else {
      next(error);
    }
  }
});

// PATCH  Update workspace
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { name } = req.body;

    // Check if user is owner or admin
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: id as string,
        userId,
        role: { in: ['owner', 'admin'] }
      }
    });

    if (!membership) {
      throw new ForbiddenError('Only workspace owner or admin can update');
    }

    const updateData: any = {};
    if (name) {
      let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const existingWorkspace = await prisma.workspace.findUnique({
        where: { slug }
      });
      if (existingWorkspace && existingWorkspace.id !== id) {
        slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
      }
      updateData.name = name;
      updateData.slug = slug;
    }

    const workspace = await prisma.workspace.update({
      where: { id: id as string },
      data: updateData,
      include: {
        members: true,
        _count: {
          select: { projects: true, members: true }
        }
      }
    });

    res.json(workspace);
  } catch (error) {
    next(error);
  }
});

// DELETE  - Delete workspace 
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Check if user is owner
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: id as string,
        ownerId: userId
      }
    });

    if (!workspace) {
      throw new ForbiddenError('Only workspace owner can delete');
    }

    await prisma.workspace.delete({
      where: { id: id as string }
    });

    res.status(204).send();
  } catch (error: any) {
    console.error('[Workspaces DELETE] Error:', error);
    next(error);
  }
});

export default router;