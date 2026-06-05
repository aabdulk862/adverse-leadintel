import nodemailer from "nodemailer";

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("Missing SMTP_HOST, SMTP_USER, or SMTP_PASS in environment.");
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return _transporter;
}

/**
 * Sends an outreach email to a single opportunity.
 * @param {{ to: string, subject: string, html: string, from?: string }} opts
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function sendEmail({ to, subject, html, from }) {
  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: from || process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    return { data: { messageId: info.messageId }, error: null };
  } catch (err) {
    return { data: null, error: { message: err.message, code: "SEND_ERROR" } };
  }
}

/**
 * Verifies SMTP connection is valid.
 * @returns {Promise<{ data: boolean, error: object|null }>}
 */
export async function verifyConnection() {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    return { data: true, error: null };
  } catch (err) {
    return { data: false, error: { message: err.message, code: "SMTP_VERIFY_ERROR" } };
  }
}
