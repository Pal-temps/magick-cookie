import nodemailer from "nodemailer";
import type { EmailAccount, SendEmailInput } from "../../domain/email/email.entity";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  selfSigned?: boolean;
}

export class SmtpConnector {
  async sendEmail(
    account: EmailAccount,
    password: string,
    input: SendEmailInput,
  ): Promise<{ messageId: string }> {
    const transporter = this.createTransport({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpSecure,
      username: account.username,
      password,
      selfSigned: account.selfSigned,
    });

    const info = await transporter.sendMail({
      from: `${account.label} <${account.email}>`,
      to: input.to.join(", "),
      cc: input.cc?.join(", "),
      subject: input.subject,
      text: input.bodyText,
      html: input.bodyHtml,
    });

    return { messageId: info.messageId };
  }

  async testConnection(config: SmtpConfig): Promise<boolean> {
    const transporter = this.createTransport(config);
    try {
      await transporter.verify();
      return true;
    } catch {
      return false;
    }
  }

  private createTransport(config: SmtpConfig) {
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: config.password,
      },
      tls: {
        rejectUnauthorized: !config.selfSigned,
      },
    });
  }
}
