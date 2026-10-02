import { env } from "../config/env";
import { resend } from "./resend.client";
import { InternalServerError } from "../errors";
import { otpEmailTemplate } from "./templates/otp.template";
import { welcomeEmailTemplate } from "./templates/welcome.template";

class EmailService {
  // Generic email sender
  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      const { error } = await resend.emails.send({
        from: env.EMAIL_FROM,
        to: [to],
        subject,
        html,
      });

      if (error) {
        throw new InternalServerError(error.message);
      }
    } catch (error) {
      if (error instanceof InternalServerError) {
        throw error;
      }

      throw new InternalServerError(errorMessage);
    }
  }

  // Send OTP Email
  async sendOtpEmail(to: string, code: string): Promise<void> {
    const { subject, html } = otpEmailTemplate(code);

    await this.sendEmail(to, subject, html, "Failed to send OTP email");
  }

  // Send Welcome Email
  async sendWelcomeEmail(to: string): Promise<void> {
    const { subject, html } = welcomeEmailTemplate();

    await this.sendEmail(to, subject, html, "Failed to send welcome email");
  }
}

export default EmailService;
