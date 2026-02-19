import nodemailer from 'nodemailer';

const RECIPIENT = process.env.FEEDBACK_RECIPIENT || 'isolapaul100@gmail.com';

function base64ToBuffer(dataUrl: string) {
  const matches = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!matches) return { mime: 'application/octet-stream', buffer: Buffer.from('') };
  const mime = matches[1];
  const base64 = matches[2];
  return { mime, buffer: Buffer.from(base64, 'base64') };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, attachments = [] } = body || {};

    // Ensure SMTP config
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !port || !user || !pass) {
      console.error('Missing SMTP configuration');
      return new Response(JSON.stringify({ error: 'SMTP not configured. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS.' }), { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const mailAttachments = attachments.map((a: any) => {
      const { mime, buffer } = base64ToBuffer(a.dataUrl);
      return {
        filename: a.filename || 'image.jpg',
        content: buffer,
        contentType: mime,
      };
    });

    const info = await transporter.sendMail({
      from: user,
      to: RECIPIENT,
      subject: `SpotOn Feedback`,
      text: message || '(empty message)',
      attachments: mailAttachments,
    });

    console.log('Feedback sent', info.messageId);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
}
