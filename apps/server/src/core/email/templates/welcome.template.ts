export function welcomeEmailTemplate() {
    return {
        subject: "Welcome to Quill!",
        html: `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <title>Welcome to Quill</title>
                </head>

                <body style="
                    margin: 0;
                    padding: 0;
                    background-color: #f5f5f5;
                    font-family: Arial, sans-serif;
                    color: #333333;
                ">
                    <div style="
                        max-width: 480px;
                        margin: 40px auto;
                        padding: 32px;
                        background-color: #ffffff;
                        border-radius: 12px;
                    ">
                        <h1 style="
                            margin: 0 0 16px;
                            color: #111111;
                        ">
                            Welcome to Quill!
                        </h1>

                        <p style="
                            font-size: 16px;
                            line-height: 1.6;
                        ">
                            Thanks for creating your account. We're excited
                            to have you with us.
                        </p>

                        <p style="
                            font-size: 16px;
                            line-height: 1.6;
                        ">
                            Your email has been successfully verified, and
                            you're all set to start using Quill.
                        </p>

                        <div style="margin: 28px 0;">
                            <a
                                href="https://quill.com"
                                style="
                                    display: inline-block;
                                    padding: 12px 24px;
                                    background-color: #111111;
                                    color: #ffffff;
                                    text-decoration: none;
                                    border-radius: 8px;
                                    font-weight: bold;
                                "
                            >
                                Get Started
                            </a>
                        </div>

                        <p style="
                            font-size: 14px;
                            line-height: 1.5;
                            color: #777777;
                        ">
                            If you have any questions, feel free to reach out
                            to our support team.
                        </p>

                        <p style="
                            margin-top: 24px;
                            font-size: 14px;
                            color: #777777;
                        ">
                            — The Quill Team
                        </p>
                    </div>
                </body>
            </html>
        `,
    };
}
