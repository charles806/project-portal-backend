import { Router } from 'express';
import prisma from '../config/database';
import redis from '../config/redis';

const router = Router();

router.get('/', async (req, res) => {
    try {
        // Check DB
        await prisma.$queryRaw`SELECT 1`;

        // Check Redis
        await redis.ping();

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                database: 'connected',
                redis: 'connected',
            },
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

export default router;