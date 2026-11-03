import { env } from "../config/env";
import { resend } from "./resend.client";
import { InternalServerError } from "../errors";
import { otpEmailTemplate } from "./templates/otp.template";
import { welcomeEmailTemplate } from "./templates/welcome.template";

interface DigestPost {
  id: string;
  title: string;
  authorName: string;
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character]!;
  });

const clientUrl = (path: string): string => new URL(path, env.CLIENT_URL).toString();

class EmailService {
  // Generic email sender used to send emails through Resend
  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      // Send the email using the configured sender address and recipient
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

  // Generate the OTP email template and send the verification code to the recipient
  async sendOtpEmail(to: string, code: string): Promise<void> {
    const { subject, html } = otpEmailTemplate(code);

    await this.sendEmail(to, subject, html, "Failed to send OTP email");
  }

  // Generate and send a welcome email to a newly registered user
  async sendWelcomeEmail(to: string): Promise<void> {
    const { subject, html } = welcomeEmailTemplate();

    await this.sendEmail(to, subject, html, "Failed to send welcome email");
  }

  async sendNewFollowerEmail(
    to: string,
    followerName: string,
  ): Promise<void> {
    const name = escapeHtml(followerName);
    const settingsUrl = escapeHtml(
      clientUrl("/settings?section=notifications"),
    );
    const subjectName = followerName.replace(/[\r\n]/g, " ").slice(0, 100);
    await this.sendEmail(
      to,
      `${subjectName} followed you on Quill`,
      `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2>You have a new follower</h2>
        <p>${name} is now following your writing on Quill.</p>
        <p><a href="${settingsUrl}">Manage email preferences</a></p>
      </div>`,
      "Failed to send new-follower email",
    );
  }

  async sendWeeklyDigestEmail(
    to: string,
    recipientName: string,
    posts: DigestPost[],
  ): Promise<void> {
    const name = escapeHtml(recipientName);
    const settingsUrl = escapeHtml(
      clientUrl("/settings?section=notifications"),
    );
    const postList = posts
      .map(
        (post) =>
          `<li><a href="${escapeHtml(clientUrl(`/blog/${encodeURIComponent(post.id)}`))}">${escapeHtml(post.title)}</a> by ${escapeHtml(post.authorName)}</li>`,
      )
      .join("");
    await this.sendEmail(
      to,
      "Your weekly Quill reading digest",
      `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2>Your week in writing</h2>
        <p>Hello ${name}, here are the latest stories from writers you follow:</p>
        <ul>${postList}</ul>
        <p><a href="${settingsUrl}">Manage email preferences</a></p>
      </div>`,
      "Failed to send weekly digest",
    );
  }
}

export default EmailService;
