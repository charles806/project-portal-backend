import { Router } from 'express';
import redis from '../config/redis';

const router = Router();

router.get('/', async (req, res) => {
  let redisStatus = 'disabled';
  if (redis) {
    try {
      await redis.ping();
      redisStatus = 'connected';
    } catch {
      redisStatus = 'disconnected';
    }
  }

  res.json({
    status: 'healthy',
    services: {
      api: 'running',
      redis: redisStatus,
    },
  });
});

export default router;