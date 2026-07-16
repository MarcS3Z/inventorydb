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

export async function sendMail({ to, subject, text, html, from } = {}) {
  if (!to || !subject) {
    throw new Error("to and subject are required");
  }

  return transporter.sendMail({
    from: from || process.env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
}

export { transporter };
