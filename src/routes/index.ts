import { Router } from 'express';
import healthRouter from './health';
import projectsRouter from './project';

const router = Router();

router.use('/health', healthRouter);
router.use('/projects', projectsRouter);

export default router;