import Queue from 'bull';
import redis from '../config/redis';

// Email job queue (will use in Week 2-3)
export const emailQueue = new Queue('email', process.env.REDIS_URL!);

// Process email jobs
emailQueue.process(async (job) => {
  const { to, subject, body } = job.data;
  console.log(`Sending email to ${to}: ${subject}`);
  // Actual email sending logic goes here (Week 2)
  return { success: true };
});

emailQueue.on('completed', (job) => {
  console.log(`Email job ${job.id} completed`);
});

emailQueue.on('failed', (job, err) => {
  console.error(`Email job ${job?.id} failed:`, err);
});