import { Resend } from 'resend';

/**
 * Resend email client singleton
 * Used for sending contractor reminders and invoice status notifications
 */

let resendInstance: Resend | null = null;

/**
 * Get the Resend client instance
 * @throws {Error} If RESEND_API_KEY is not configured
 */
export function getResendClient(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey === 're_your_resend_api_key_here') {
      throw new Error('RESEND_API_KEY is not configured. Set it in your environment variables.');
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}
