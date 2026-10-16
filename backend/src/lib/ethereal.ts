import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';

let cachedTransporter: Transporter | null = null;
let cachedAccount: { user: string; pass: string; web?: string } | null = null;

export async function getTransporter(): Promise<Transporter> {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  if (env.ETHEREAL_USER && env.ETHEREAL_PASS) {
    cachedAccount = {
      user: env.ETHEREAL_USER,
      pass: env.ETHEREAL_PASS,
    };
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: env.ETHEREAL_USER,
        pass: env.ETHEREAL_PASS,
      },
    });
    console.log(`📧 Configured Ethereal transporter with provided credentials for ${env.ETHEREAL_USER}`);
    return cachedTransporter;
  }

  // Automatically create a new Ethereal test account if credentials are not in env
  try {
    const testAccount = await nodemailer.createTestAccount();
    cachedAccount = {
      user: testAccount.user,
      pass: testAccount.pass,
      web: testAccount.web,
    };

    console.log('✉️  Created new Ethereal test account:');
    console.log(`   User: ${testAccount.user}`);
    console.log(`   Pass: ${testAccount.pass}`);
    console.log(`   Web:  ${testAccount.web}`);

    cachedTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    return cachedTransporter;
  } catch (err: any) {
    console.error('❌ Failed to create Ethereal test account:', err.message);
    throw err;
  }
}

export function getPreviewUrl(info: any): string | false {
  return nodemailer.getTestMessageUrl(info);
}

export function getCachedAccount() {
  return cachedAccount;
}
