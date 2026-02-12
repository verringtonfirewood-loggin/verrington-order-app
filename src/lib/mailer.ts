import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || "465");
const SMTP_SECURE = String(process.env.SMTP_SECURE || "true") === "true";

const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";

const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER;
const ADMIN_NOTIFY_TO = process.env.ADMIN_NOTIFY_TO || "";

function getTransport() {
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error("Missing SMTP_USER/SMTP_PASS env vars");
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function getAppBaseUrl() {
  const explicit = process.env.APP_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`.replace(/\/+$/, "");

  return "http://localhost:3000";
}

function esc(s: unknown) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailShell(args: { title: string; preheader?: string; bodyHtml: string }) {
  const pre = args.preheader ? esc(args.preheader) : "";
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(args.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${pre}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e8eaee;">
          <tr>
            <td style="padding:18px 20px;background:#111;color:#fff;">
              <div style="font-size:14px;opacity:0.9;">Verrington Firewood</div>
              <div style="font-size:20px;font-weight:800;margin-top:4px;">${esc(args.title)}</div>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 20px;color:#111;">
              ${args.bodyHtml}
            </td>
          </tr>

          <tr>
            <td style="padding:14px 20px;background:#fafafa;color:#555;font-size:12px;line-height:1.5;">
              <div>Keeping You Warm All Year Round</div>
              <div style="margin-top:6px;">If you have any questions, reply to this email.</div>
            </td>
          </tr>
        </table>

        <div style="max-width:600px;width:100%;color:#777;font-size:11px;line-height:1.4;margin-top:10px;padding:0 10px;">
          You’re receiving this email because an order was placed with Verrington Firewood.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function kvRow(label: string, value: string) {
  return `
  <tr>
    <td style="padding:8px 0;color:#666;font-size:12px;width:140px;vertical-align:top;">${esc(label)}</td>
    <td style="padding:8px 0;color:#111;font-size:13px;font-weight:600;vertical-align:top;">${esc(value)}</td>
  </tr>`;
}

export async function sendAdminNewOrderEmail(args: {
  orderId: string;
  createdAt?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string | null;
  postcode?: string | null;
  totalPence?: number | null;
  status?: string | null;
  items: { name: string; quantity: number; pricePence?: number | null }[];
}) {
  if (!ADMIN_NOTIFY_TO) throw new Error("Missing ADMIN_NOTIFY_TO env var");

  const transport = getTransport();
  const appUrl = getAppBaseUrl();

  const total =
    typeof args.totalPence === "number"
      ? `£${(args.totalPence / 100).toFixed(2)}`
      : "—";

  const subject = `New order ${args.postcode ? `(${args.postcode}) ` : ""}#${args.orderId.slice(0, 8)}`;

  const linesText = args.items.map((i) => {
    const unit = typeof i.pricePence === "number" ? ` @ £${(i.pricePence / 100).toFixed(2)}` : "";
    return `- ${i.name} x${i.quantity}${unit}`;
  });

  const text = `New order received

Order ID: ${args.orderId}
Created: ${args.createdAt || "—"}
Status: ${(args.status || "pending").toUpperCase()}

Customer:
- Name: ${args.customerName || "—"}
- Phone: ${args.customerPhone || "—"}
- Email: ${args.customerEmail || "—"}
- Postcode: ${args.postcode || "—"}

Items:
${linesText.join("\n")}

Total: ${total}

Admin:
${appUrl}/admin/orders/${args.orderId}
`;

  const itemsHtml = args.items
    .map((i) => {
      const unit =
        typeof i.pricePence === "number"
          ? ` <span style="color:#666;font-weight:400;">@ £${(i.pricePence / 100).toFixed(2)}</span>`
          : "";
      return `<tr>
        <td style="padding:10px 0;border-top:1px solid #eee;">${esc(i.name)}</td>
        <td style="padding:10px 0;border-top:1px solid #eee;text-align:right;font-variant-numeric:tabular-nums;">x${esc(i.quantity)}</td>
        <td style="padding:10px 0;border-top:1px solid #eee;text-align:right;white-space:nowrap;">${unit}</td>
      </tr>`;
    })
    .join("");

  const bodyHtml = `
    <div style="font-size:13px;line-height:1.6;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
        ${kvRow("Order ID", args.orderId)}
        ${kvRow("Created", args.createdAt || "—")}
        ${kvRow("Status", String(args.status || "pending").toUpperCase())}
        ${kvRow("Customer", args.customerName || "—")}
        ${kvRow("Phone", args.customerPhone || "—")}
        ${kvRow("Email", args.customerEmail || "—")}
        ${kvRow("Postcode", args.postcode || "—")}
      </table>

      <div style="margin-top:14px;font-weight:800;">Items</div>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;font-size:13px;">
        ${itemsHtml || `<tr><td style="padding:10px 0;border-top:1px solid #eee;">—</td></tr>`}
        <tr>
          <td style="padding:12px 0;border-top:2px solid #111;font-weight:900;">Total</td>
          <td style="padding:12px 0;border-top:2px solid #111;"></td>
          <td style="padding:12px 0;border-top:2px solid #111;text-align:right;font-weight:900;white-space:nowrap;">${esc(total)}</td>
        </tr>
      </table>

      <div style="margin-top:16px;">
        <a href="${esc(appUrl)}/admin/orders/${esc(args.orderId)}"
           style="display:inline-block;padding:10px 14px;background:#111;color:#fff;border-radius:10px;text-decoration:none;font-weight:800;">
          Open in Admin
        </a>
      </div>
    </div>
  `;

  const html = emailShell({
    title: "New order received",
    preheader: `Order #${args.orderId.slice(0, 8)} ${args.postcode ? `(${args.postcode})` : ""}`,
    bodyHtml,
  });

  await transport.sendMail({
    from: MAIL_FROM,
    to: ADMIN_NOTIFY_TO,
    subject,
    text,
    html,
  });
}
export async function sendCustomerConfirmationEmail(args: {
  to: string;
  orderId: string;
  customerName?: string;
  postcode?: string;
  items: { name: string; quantity: number }[];
  totalPence?: number;
}) {
  const transport = getTransport();

  const total =
    typeof args.totalPence === "number"
      ? `£${(args.totalPence / 100).toFixed(2)}`
      : "—";

  const subject = `We’ve received your order (#${args.orderId.slice(0, 8)})`;

  const linesText = args.items.map((i) => `- ${i.name} x${i.quantity}`);

  const text = `Hi ${args.customerName || "there"},

Thanks for your order with Verrington Firewood.

Order reference: ${args.orderId.slice(0, 8)}
Postcode: ${args.postcode || "—"}

Items:
${linesText.join("\n")}

Total: ${total}

We’ll be in touch shortly to confirm delivery timing.

Verrington Firewood
`;

  const itemsHtml = args.items
    .map(
      (i) => `<tr>
        <td style="padding:8px 0;border-top:1px solid #eee;">${esc(i.name)}</td>
        <td style="padding:8px 0;border-top:1px solid #eee;text-align:right;">x${esc(i.quantity)}</td>
      </tr>`
    )
    .join("");

  const bodyHtml = `
    <p>Hi ${esc(args.customerName || "there")},</p>
    <p>Thanks for your order with <b>Verrington Firewood</b>. We’ll be in touch shortly to confirm delivery timing.</p>

    <table width="100%" cellpadding="0" cellspacing="0">
      ${kvRow("Order ref", args.orderId.slice(0, 8))}
      ${kvRow("Postcode", args.postcode || "—")}
    </table>

    <h3 style="margin-top:16px;">Items</h3>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${itemsHtml}
      <tr>
        <td style="padding-top:12px;font-weight:700;">Total</td>
        <td style="padding-top:12px;text-align:right;font-weight:700;">${esc(total)}</td>
      </tr>
    </table>
  `;

  const html = emailShell({
    title: "Order received",
    preheader: `Order #${args.orderId.slice(0, 8)} received`,
    bodyHtml,
  });

  await transport.sendMail({
    from: MAIL_FROM,
    to: args.to,
    subject,
    text,
    html,
  });
}

export async function sendCustomerStatusUpdateEmail(args: {
  to: string;
  orderId: string;
  customerName?: string;
  postcode?: string;
  status: string;
}) {
  const transport = getTransport();

  const s = String(args.status || "").toLowerCase();

  const subjectMap: Record<string, string> = {
    paid: `Payment received (#${args.orderId.slice(0, 8)})`,
    "out-for-delivery": `Out for delivery today (#${args.orderId.slice(0, 8)})`,
    delivered: `Delivered ✅ (#${args.orderId.slice(0, 8)})`,
    cancelled: `Order cancelled (#${args.orderId.slice(0, 8)})`,
  };

  const headlineMap: Record<string, string> = {
    paid: "Payment received",
    "out-for-delivery": "Out for delivery",
    delivered: "Delivered",
    cancelled: "Order cancelled",
  };

  const subject =
    subjectMap[s] || `Order update (#${args.orderId.slice(0, 8)})`;
  const headline = headlineMap[s] || "Order update";

  const text = `Hi ${args.customerName || "there"},

${headline} for your Verrington Firewood order.

Order reference: ${args.orderId.slice(0, 8)}
Postcode: ${args.postcode || "—"}
Status: ${s.toUpperCase()}

If you have any questions, reply to this email.

Verrington Firewood
`;

  await transport.sendMail({
    from: MAIL_FROM,
    to: args.to,
    subject,
    text,
  });
}
