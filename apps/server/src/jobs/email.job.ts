import { Worker } from "bullmq";
import { otpEmailTemplate } from "../core/email/templates/otp.template";
import EmailService from "../core/email/email.service";
import redisConfig from "../core/config/redis.config";

// Defines the structure of an OTP email job's data
interface OtpEmailJobData {
  type: "otp";
  to: string;
  code: string;
}

// Defines the supported email job data types
type EmailJobData = OtpEmailJobData;

// Creates an instance of the email service to handle email delivery
const emailService = new EmailService();

// Creates a BullMQ worker to process email jobs from the "email" queue.
export const emailWorker = new Worker<EmailJobData>(
  "email",
  async (job) => {
    // Processes the job only if it is an OTP email request
    if (job.data.type === "otp") {
      otpEmailTemplate(job.data.code);
      await emailService.sendOtpEmail(job.data.to, job.data.code);
    }
  },
  {
    connection: redisConfig, // Uses Redis to connect to the BullMQ queue
    concurrency: 10, // Processes up to 10 jobs concurrently
  },
);
