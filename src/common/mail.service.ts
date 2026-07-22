import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  public initTransporter() {
    const user = process.env.MAIL_USER || 'phamvantra1301@gmail.com';
    const pass = process.env.MAIL_PASS;

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.MAIL_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user,
          pass,
        },
      });
      this.logger.log(`Mail Transporter initialized for ${user}`);
    } else {
      this.logger.warn(
        'MAIL_PASS is not set in .env. Email will be logged to console in dev mode.',
      );
    }
  }

  async sendOtpEmail(to: string, otp: string): Promise<boolean> {
    const from =
      process.env.MAIL_FROM ||
      `"WMS Logistics Pro" <${process.env.MAIL_USER || 'phamvantra1301@gmail.com'}>`;
    const subject = `[WMS Pro] Mã xác thực OTP khôi phục mật khẩu: ${otp}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #1e293b; margin: 0;">WMS Logistics Pro</h2>
          <p style="color: #64748b; font-size: 13px;">Hệ thống Quản lý Vận tải & Bưu cục</p>
        </div>
        <div style="padding: 20px; background-color: #f8fafc; border-radius: 8px; text-align: center;">
          <p style="color: #334155; font-size: 14px; margin-bottom: 10px;">Mã OTP khôi phục mật khẩu của bạn là:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2563eb; margin: 15px 0;">
            ${otp}
          </div>
          <p style="color: #94a3b8; font-size: 12px;">Mã này có hiệu lực trong vòng <strong>10 phút</strong>. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
        </div>
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 20px;">
          Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.
        </p>
      </div>
    `;

    this.logger.log(`[OTP EMAIL] Prepared OTP ${otp} for ${to}`);

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from,
          to,
          subject,
          html,
        });
        this.logger.log(`Email sent successfully to ${to}`);
        return true;
      } catch (error) {
        this.logger.error(`Failed to send email to ${to}`, error);
        return false;
      }
    } else {
      this.logger.log(
        `[DEV MODE - SIMULATED EMAIL] To: ${to} | Subject: ${subject} | OTP: ${otp}`,
      );
      return true;
    }
  }
}
