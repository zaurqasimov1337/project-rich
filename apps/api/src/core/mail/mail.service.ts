import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly devMode: boolean;

  constructor(config: ConfigService) {
    this.from = config.get('MAIL_FROM') ?? 'no-reply@edusphere.local';

    const host = config.get<string>('SMTP_HOST') ?? 'localhost';
    const user = config.get<string>('SMTP_USER');
    // A real SMTP relay is only assumed when credentials are set, or the host is
    // an external server. Pointing at localhost with no auth means the dev
    // Mailpit catcher — which isn't running here — so fall back to a transport
    // that "sends" successfully and logs the message instead of failing.
    this.devMode = !user && (host === 'localhost' || host === '127.0.0.1' || host === '');

    if (this.devMode) {
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
      this.logger.warn(
        'MailService running in DEV mode (no real SMTP). Emails are logged, not delivered. ' +
          'Set SMTP_HOST/SMTP_USER/SMTP_PASS for real delivery.',
      );
    } else {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(config.get('SMTP_PORT') ?? 587),
        secure: Number(config.get('SMTP_PORT') ?? 587) === 465,
        auth: user ? { user, pass: config.get('SMTP_PASS') } : undefined,
      });
    }
  }

  async send(to: string, subject: string, text: string, html?: string): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text, html });
      if (this.devMode) {
        this.logger.log(`[DEV MAIL] to=${to} subject="${subject}" — logged (not delivered)`);
      }
    } catch (err) {
      this.logger.error(`Mail to ${to} failed: ${(err as Error).message}`);
      throw err;
    }
  }
}
