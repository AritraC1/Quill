// Generate the email template for OTP verification
export function otpEmailTemplate(code: string) {
    return {
      subject: 'Your Quill verification code',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Your verification code</h2>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px;">${code}</p>
          <p>This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
        </div>
      `,
    };
  }