import { Queue } from 'bullmq';
import redisConfig from '../core/config/redis.config';

export const emailQueue = new Queue('email', { connection: redisConfig });