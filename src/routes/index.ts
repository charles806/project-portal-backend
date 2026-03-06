import { Router } from 'express';
import healthRouter from './health';
import workspacesRouter from './workspaces';
import projectsRouter from './project';
import membersRouter from './members';
import milestonesRouter from './milestones';

const router = Router();

router.use('/health', healthRouter);
router.use('/workspaces', workspacesRouter);
router.use('/workspaces', membersRouter);
router.use('/projects', projectsRouter);
router.use('/projects', milestonesRouter);
router.use('/', milestonesRouter);

export default router;