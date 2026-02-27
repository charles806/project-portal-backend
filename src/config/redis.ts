import Redis from 'ioredis';

let redis: Redis | null = null;


if (process.env.REDIS_URL && process.env.REDIS_URL !== 'redis://default:hbWisEqnAXHuadHamkDvwhcORQsgDOxq@switchback.proxy.rlwy.net:41214') {
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        console.error('Redis connection failed after 3 retries');
        return null;
      }
      return Math.min(times * 200, 2000);
    },
  });

  redis.on('connect', () => console.log('✓ Redis connected'));
  redis.on('error', (err) => console.error('Redis error:', err.message));
} else {
  console.log('⚠ Redis disabled (no REDIS_URL configured)');
}

export default redis;