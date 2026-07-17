import nodemailer from "nodemailer";

const smtpPort = Number(process.env.SMTP_PORT) || 465;
const smtpSecure =
  process.env.SMTP_SECURE === undefined
    ? smtpPort === 465
    : process.env.SMTP_SECURE === "true";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function verifySmtp() {
  await transporter.verify();
}

export async function sendMail({ to, subject, text, html, from, replyTo } = {}) {
  if (!to || !subject) {
    throw new Error("to and subject are required");
  }

  const smtpFrom = process.env.SMTP_FROM;

  return transporter.sendMail({
    // Header From can be the signed-in user; SMTP auth stays SMTP_USER / SMTP_PASSWORD.
    from: from || smtpFrom,
    replyTo: replyTo || undefined,
    // Keep envelope/return-path on the SES-verified automator identity when From differs.
    envelope:
      from && smtpFrom && from !== smtpFrom
        ? { from: smtpFrom, to }
        : undefined,
    to,
    subject,
    text,
    html,
  });
}

export { transporter };
