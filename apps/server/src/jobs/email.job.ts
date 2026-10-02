import { Worker } from "bullmq";
import { otpEmailTemplate } from "../core/email/templates/otp.template";
import EmailService from "../core/email/email.service";
import redisConfig from "../core/config/redis.config";

interface OtpEmailJobData {
    type: 'otp';
    to: string;
    code: string;
}

type EmailJobData = OtpEmailJobData;

const emailService = new EmailService();
export const emailWorker = new Worker<EmailJobData> (
    "email",
    async (job) => {
        if (job.data.type === 'otp') {
            otpEmailTemplate(job.data.code);
            await emailService.sendOtpEmail(job.data.to, job.data.code);
        }
    },
    {
        connection: redisConfig,
        concurrency: 10,
    }
);