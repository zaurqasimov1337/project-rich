import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.from = config.get('MAIL_FROM') ?? 'no-reply@edusphere.local';
    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST') ?? 'localhost',
      port: Number(config.get('SMTP_PORT') ?? 1025),
      secure: false,
      auth: config.get('SMTP_USER')
        ? { user: config.get('SMTP_USER'), pass: config.get('SMTP_PASS') }
        : undefined,
    });
  }

  async send(to: string, subject: string, text: string, html?: string): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text, html });
    } catch (err) {
      this.logger.error(`Mail to ${to} failed: ${(err as Error).message}`);
      throw err;
    }
  }
}
