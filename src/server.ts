import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';
import prisma from './config/database';
import redis from './config/redis';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());
app.use(authMiddleware);

// Routes
app.use('/api/v1', routes);

// Error handling
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections...');
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
});