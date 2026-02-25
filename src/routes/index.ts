import { Router } from 'express';
import healthRouter from './health';
// Import other route modules here

const router = Router();

router.use('/health', healthRouter);
// router.use('/workspaces', workspaceRouter); // Week 2
// router.use('/projects', projectRouter);     // Week 2

export default router;