import { Router, RequestHandler } from 'express';

const router = Router();

function htmlPage(params: { title: string; body: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(params.title)}</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;line-height:1.6;margin:0;background:#0b1220;color:#e5e7eb}
    a{color:#60a5fa}
    .wrap{max-width:900px;margin:0 auto;padding:28px 16px}
    h1,h2{line-height:1.25}
    .card{background:#0f172a;border:1px solid rgba(148,163,184,.25);border-radius:12px;padding:18px}
    .muted{color:#94a3b8;font-size:14px}
    ul{padding-left:18px}
    code{background:rgba(148,163,184,.15);padding:2px 6px;border-radius:6px}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      ${params.body}
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const privacyPolicy: RequestHandler = (_req, res) => {
  const companyName = process.env.COMPANY_NAME || 'Sahla4Eco';
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@sahla4eco.com';
  const baseUrl = process.env.BASE_URL || 'https://sahla4eco.com';

  const body = `
    <h1>Privacy Policy</h1>
    <p class="muted">Last updated: ${new Date().toISOString().slice(0, 10)}</p>

    <p>
      This Privacy Policy describes how <strong>${escapeHtml(companyName)}</strong> ("we", "us") collects, uses,
      and shares information when you use our platform, including storefront pages and messaging features.
    </p>

    <h2>Information we collect</h2>
    <ul>
      <li><strong>Order information:</strong> name, phone number, shipping address, and order details provided at checkout.</li>
      <li><strong>Storefront usage:</strong> basic analytics events (for example, page views) to improve performance and reporting.</li>
      <li><strong>Messaging identifiers:</strong> when you choose to connect Messenger/Telegram, we store the identifier required to message you (e.g. PSID/chat_id) and your phone number for matching.</li>
    </ul>

    <h2>How we use information</h2>
    <ul>
      <li>Process and fulfill orders placed on storefronts.</li>
      <li>Send transactional notifications (order confirmations and updates) when enabled by the store owner.</li>
      <li>Improve the platform, security, and reliability.</li>
    </ul>

    <h2>Sharing</h2>
    <p>
      We share order information with the relevant store owner so they can fulfill your order.
      We do not sell personal data.
    </p>

    <h2>Data retention</h2>
    <p>
      We retain order and messaging linkage data for as long as needed to provide the service and comply with legal obligations.
    </p>

    <h2>Your choices</h2>
    <ul>
      <li>You can choose not to connect messaging platforms.</li>
      <li>You can request deletion of your data: see <a href="${escapeHtml(baseUrl)}/data-deletion">Data Deletion Instructions</a>.</li>
    </ul>

    <h2>Contact</h2>
    <p>
      If you have questions, contact us at <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a>.
    </p>

    <p class="muted">Related: <a href="${escapeHtml(baseUrl)}/terms">Terms of Service</a></p>
  `;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(htmlPage({ title: `${companyName} Privacy Policy`, body }));
};

const terms: RequestHandler = (_req, res) => {
  const companyName = process.env.COMPANY_NAME || 'Sahla4Eco';
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@sahla4eco.com';
  const body = `
    <h1>Terms of Service</h1>
    <p class="muted">Last updated: ${new Date().toISOString().slice(0, 10)}</p>

    <p>
      These Terms govern use of <strong>${escapeHtml(companyName)}</strong>. By using the service, you agree to these Terms.
    </p>

    <h2>Service</h2>
    <ul>
      <li>We provide tools for storefronts, orders, and optional messaging notifications.</li>
      <li>The service may change over time; we may add or remove features.</li>
    </ul>

    <h2>Store owners</h2>
    <ul>
      <li>You are responsible for your products, pricing, fulfillment, and customer support.</li>
      <li>You must comply with applicable laws and platform rules.</li>
    </ul>

    <h2>Customers</h2>
    <ul>
      <li>You agree to provide accurate order information.</li>
      <li>Orders are fulfilled by the store owner; disputes should be addressed with the store owner where possible.</li>
    </ul>

    <h2>Contact</h2>
    <p>Questions: <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a></p>
  `;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(htmlPage({ title: `${companyName} Terms of Service`, body }));
};

const dataDeletion: RequestHandler = (_req, res) => {
  const companyName = process.env.COMPANY_NAME || 'Sahla4Eco';
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@sahla4eco.com';

  const body = `
    <h1>Data Deletion Instructions</h1>
    <p class="muted">Last updated: ${new Date().toISOString().slice(0, 10)}</p>

    <p>
      To request deletion of your personal data from <strong>${escapeHtml(companyName)}</strong>, email
      <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a> with:
    </p>
    <ul>
      <li>Your phone number used at checkout</li>
      <li>The store name (if known)</li>
      <li>Any relevant order ID(s)</li>
    </ul>

    <p>
      We will verify the request and process it within a reasonable timeframe.
    </p>
  `;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(htmlPage({ title: `${companyName} Data Deletion`, body }));
};

router.get('/privacy-policy', privacyPolicy);
router.get('/terms', terms);
router.get('/data-deletion', dataDeletion);

export default router;
