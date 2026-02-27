import { Router } from 'express';
import prisma from '../config/database';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Protect all project routes
router.use(requireAuth);

// GET all projects
router.get('/', async (req, res) => {
    try {
        const projects = await prisma.project.findMany({
            orderBy: { createdAt: 'desc' },
        });
        res.json(projects);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET single project
router.get('/:id', async (req, res) => {
    try {
        const project = await prisma.project.findUnique({
            where: { id: req.params.id },
        });
        if (!project) return res.status(404).json({ error: 'Not found' });
        res.json(project);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST create project
router.post('/', async (req, res) => {
    try {
        const project = await prisma.project.create({
            data: {
                name: req.body.name,
                client: req.body.client,
                description: req.body.description,
                status: req.body.status || 'planning',
                progress: req.body.progress || 0,
                dueDate: req.body.dueDate || 'TBD',
                budget: req.body.budget || '$0',
                spent: req.body.spent || '$0',
                tags: req.body.tags || [],
            },
        });
        res.status(201).json(project);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// PATCH update project
router.patch('/:id', async (req, res) => {
    try {
        const project = await prisma.project.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json(project);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE project
router.delete('/:id', async (req, res) => {
    try {
        await prisma.project.delete({
            where: { id: req.params.id },
        });
        res.status(204).send();
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

export default router;