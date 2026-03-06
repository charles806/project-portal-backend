import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import prisma from '../config/database';

const router = Router();

router.use(authenticateToken);

router.get('/', async (req: AuthRequest, res, next) => {
    try {
        const userId = req.user!.userId;
        const { workspaceId } = req.query;

        if (!workspaceId) {
            return res.status(400).json({ error: 'workspaceId is required' });
        }

        // Verify user has access to workspace
        const hasAccess = await prisma.workspaceMember.findFirst({
            where: {
                workspaceId: workspaceId as string,
                userId
            }
        });

        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const projects = await prisma.project.findMany({
            where: { workspaceId: workspaceId as string },
            include: {
                milestones: true
            },
            orderBy: { createdAt: 'desc' }
        });

        // Map to frontend shape (Prisma schema missing fields)
        const formattedProjects = projects.map(p => ({
            ...p,
            team: [],
            tags: [],
            client: 'General Client',
            dueDate: p.endDate || p.createdAt
        }));

        res.json(formattedProjects);
    } catch (error: any) {
        console.error('[Project GET] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/v1/projects/:id - Get single project
router.get('/:id', async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const projectId = req.params.id as string;

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                workspace: true,
                milestones: true
            }
        });

        if (!project) {
            return res.status(404).json({ error: 'Not found' });
        }

        // Verify user has access
        const hasAccess = await prisma.workspaceMember.findFirst({
            where: {
                workspaceId: project.workspaceId,
                userId
            }
        });

        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Map to frontend shape
        const formattedProject = {
            ...project,
            team: [],
            tags: [],
            client: 'General Client',
            dueDate: project.endDate || project.createdAt
        };

        res.json(formattedProject);
    } catch (error: any) {
        console.error('[Project GET ID] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/v1/projects - Create project
router.post('/', async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const { workspaceId, name, description } = req.body;

        if (!workspaceId || !name) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify user has access
        const hasAccess = await prisma.workspaceMember.findFirst({
            where: { workspaceId: workspaceId as string, userId }
        });

        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const project = await prisma.project.create({
            data: {
                workspaceId: workspaceId as string,
                name,
                description: description || '',
                status: req.body.status || 'active',
                priority: req.body.priority || 'medium',
                progress: req.body.progress || 0,
                startDate: req.body.startDate ? new Date(req.body.startDate) : new Date(),
                endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
                budget: req.body.budget ? parseFloat(req.body.budget) : 0,
                spent: req.body.spent ? parseFloat(req.body.spent) : 0,
            }
        });

        res.status(201).json(project);
    } catch (error: any) {
        console.error('[Project POST] Error:', error);
        res.status(400).json({ error: error.message });
    }
});

// PATCH /api/v1/projects/:id - Update project
router.patch('/:id', async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const projectId = req.params.id as string;

        const existingProject = await prisma.project.findUnique({
            where: { id: projectId }
        });

        if (!existingProject) {
            return res.status(404).json({ error: 'Not found' });
        }

        // Verify access
        const hasAccess = await prisma.workspaceMember.findFirst({
            where: {
                workspaceId: existingProject.workspaceId,
                userId
            }
        });

        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const project = await prisma.project.update({
            where: { id: projectId },
            data: req.body
        });

        res.json(project);
    } catch (error: any) {
        console.error('[Project PATCH] Error:', error);
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/v1/projects/:id - Delete project
router.delete('/:id', async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const projectId = req.params.id as string;

        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });

        if (!project) {
            return res.status(404).json({ error: 'Not found' });
        }

        // Verify access (admin or owner)
        const member = await prisma.workspaceMember.findFirst({
            where: {
                workspaceId: project.workspaceId,
                userId,
                role: { in: ['owner', 'admin'] }
            }
        });

        if (!member) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await prisma.project.delete({
            where: { id: projectId }
        });

        res.status(204).send();
    } catch (error: any) {
        console.error('[Project DELETE] Error:', error);
        res.status(400).json({ error: error.message });
    }
});

export default router;