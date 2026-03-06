import { Router, Response, NextFunction } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';

const router = Router();

router.use(authenticateToken);

// GET /api/v1/workspaces/:workspaceId/members - Get all members
router.get('/:workspaceId/members', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { workspaceId } = req.params;

    // Verify user has access to workspace
    const hasAccess = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: workspaceId as string,
        userId
      }
    });

    if (!hasAccess) {
      throw new ForbiddenError('Access denied');
    }

    // Get all members with user details
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: workspaceId as string },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            username: true,
          }
        }
      },
      orderBy: { joinedAt: 'asc' }
    });

    const formattedMembers = members.map(m => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      user: m.user
    }));

    res.json(formattedMembers);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/workspaces/:workspaceId/members - Invite member (by email)
router.post('/:workspaceId/members', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { workspaceId } = req.params;
    const { email, role = 'member' } = req.body;

    if (!email) {
      throw new BadRequestError('Email is required');
    }

    // Verify user is admin or owner
    const requester = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: workspaceId as string,
        userId,
        role: { in: ['owner', 'admin'] }
      }
    });

    if (!requester) {
      throw new ForbiddenError('Only admins and owners can invite members');
    }

    // Find user by email locally
    const invitedUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!invitedUser) {
      throw new NotFoundError('User not found. They must sign up first.');
    }

    // Check if already a member
    const existing = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: workspaceId as string,
        userId: invitedUser.id
      }
    });

    if (existing) {
      throw new BadRequestError('User is already a member');
    }

    // Add member
    const member = await prisma.workspaceMember.create({
      data: {
        workspaceId: workspaceId as string,
        userId: invitedUser.id,
        role: role as string
      }
    });

    res.status(201).json({
      id: member.id,
      userId: member.userId,
      role: member.role,
      joinedAt: member.joinedAt,
      user: {
        firstName: invitedUser.firstName,
        lastName: invitedUser.lastName,
        email: invitedUser.email,
        username: invitedUser.username
      }
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/workspaces/:workspaceId/members/:memberId - Update member role
router.patch('/:workspaceId/members/:memberId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { workspaceId, memberId } = req.params;
    const { role } = req.body;

    if (!role || !['admin', 'member'].includes(role)) {
      throw new BadRequestError('Invalid role');
    }

    // Verify requester is owner
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId as string, ownerId: userId }
    });

    if (!workspace) {
      throw new ForbiddenError('Only workspace owner can change roles');
    }

    // Cannot change owner's role
    const targetMember = await prisma.workspaceMember.findUnique({
      where: { id: memberId as string }
    });

    if (!targetMember) {
      throw new NotFoundError('Member not found');
    }

    if (targetMember.role === 'owner') {
      throw new BadRequestError('Cannot change owner role');
    }

    const member = await prisma.workspaceMember.update({
      where: { id: memberId as string },
      data: { role }
    });

    res.json(member);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/workspaces/:workspaceId/members/:memberId - Remove member
router.delete('/:workspaceId/members/:memberId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { workspaceId, memberId } = req.params;

    // Get member to be removed
    const memberToRemove = await prisma.workspaceMember.findUnique({
      where: { id: memberId as string }
    });

    if (!memberToRemove) {
      throw new NotFoundError('Member not found');
    }

    // Check if removing self or if requester is admin/owner
    const isSelf = memberToRemove.userId === userId;

    if (!isSelf) {
      const requester = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: workspaceId as string,
          userId,
          role: { in: ['owner', 'admin'] }
        }
      });

      if (!requester) {
        throw new ForbiddenError('Access denied');
      }
    }

    // Cannot remove owner
    if (memberToRemove.role === 'owner') {
      throw new BadRequestError('Cannot remove workspace owner');
    }

    await prisma.workspaceMember.delete({
      where: { id: memberId as string }
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;