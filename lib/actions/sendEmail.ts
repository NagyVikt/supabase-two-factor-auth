import nodemailer from 'nodemailer'

type Options = {
  to: string
  subject: string
  html: string
}

export default async function sendEmail(opts: Options) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { rejectUnauthorized: false },
  })

  await transporter.sendMail({
    from: `"${process.env.APP_NAME || 'Your App'}" <${process.env.MFA_EMAIL_FROM}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  })
}
