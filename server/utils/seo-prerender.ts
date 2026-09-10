/**
 * Static pre-rendered pages for crawlers (Google verification, SEO).
 * The SPA shell is empty without JS, so bots see nothing. For a small set
 * of public pages we return real static HTML with the same content users get.
 */

const SHELL = (title: string, body: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Sahla4Eco</title>
<meta name="description" content="Sahla4Eco — Algeria's Smart Ecommerce Automation Platform. Sell, manage, and deliver with ease.">
</head>
<body>
<main>${body}</main>
<p><a href="https://www.sahla4eco.com/">Sahla4Eco</a> · <a href="https://www.sahla4eco.com/privacy">Privacy</a> · <a href="https://www.sahla4eco.com/terms">Terms</a></p>
</body>
</html>`;

const HOME_BODY = `
<h1>Sahla4Eco — Algeria's Smart Ecommerce Platform</h1>
<p>Sahla4Eco (sahla4eco.com) lets anyone in Algeria open an online store in minutes: mobile-first storefronts with 8 templates, cash-on-delivery orders across all 58 wilayas, delivery-company integrations, Telegram/Messenger/WhatsApp order bots, an AI store assistant, pixel tracking and staff management. $7/month after a 30-day free trial. No login is required to browse this page or any public store.</p>
<h2>What you can do</h2>
<ul>
<li>Create a storefront and customize colors, templates and banners</li>
<li>Receive cash-on-delivery orders with wilaya/commune delivery pricing</li>
<li>Connect delivery companies (Yalidine, Maystro, Noest and more)</li>
<li>Chat with customers through Telegram, Messenger and WhatsApp bots</li>
<li>Export orders to Google Sheets</li>
</ul>`;

const PRIVACY_BODY = `
<h1>Privacy Policy</h1>
<p>Last updated: September 10, 2026. Sahla4Eco (sahla4eco.com) is an Algerian e-commerce platform. This policy explains what data we collect and why.</p>
<h2>1. Account data</h2>
<p>When you create an account (including Google Sign-In) we store your name, email address and avatar. Google Sign-In shares only your basic profile (name, email, avatar) with us.</p>
<h2>2. Google Sheets access</h2>
<p>If you connect your Google account for order export, we request the spreadsheets scope to write your store orders into spreadsheets you choose. We never read unrelated files. You can revoke access anytime in your Google Account settings or by disconnecting in the dashboard.</p>
<h2>3. Order data</h2>
<p>When customers place orders we collect name, phone number, delivery address (wilaya, commune), ordered products and payment/delivery details, and share them with the store owner and the chosen delivery company to fulfill the order.</p>
<h2>4. Messaging identifiers</h2>
<p>When you opt in to order notifications we store messaging identifiers (Telegram chat id, Messenger PSID) to send order status updates.</p>
<h2>5. Cookies</h2>
<p>We use strictly necessary cookies for login sessions, store selection and CSRF protection. No advertising cookies.</p>
<h2>6. Retention and rights</h2>
<p>Order and account data is kept while your account is active. You may request access, correction or deletion of your personal data at any time via the dashboard or by contacting us.</p>
<h2>7. Contact</h2>
<p>Questions: sahla4eco@gmail.com</p>`;

const TERMS_BODY = `
<h1>Terms of Service</h1>
<p>Last updated: September 10, 2026. These Terms govern use of Sahla4Eco.</p>
<h2>Service</h2>
<p>We provide tools for storefronts, orders, and optional messaging notifications. Features may change over time.</p>
<h2>Store owners</h2>
<p>You are responsible for your products, pricing, fulfillment, and customer support, and must comply with applicable laws and platform rules.</p>
<h2>Customers</h2>
<p>You agree to provide accurate order information. Orders are fulfilled by the store owner.</p>
<h2>Contact</h2>
<p>Questions: sahla4eco@gmail.com</p>`;

const PAGES: Record<string, { title: string; body: string }> = {
  '/': { title: "Algeria's Smart Ecommerce Platform", body: HOME_BODY },
  '/privacy': { title: 'Privacy Policy', body: PRIVACY_BODY },
  '/terms': { title: 'Terms of Service', body: TERMS_BODY },
};

const BOT_UA = /googlebot|adsbot-google|apis-google|mediapartners-google|google-site-verification|bingbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|ia_archiver/i;

/** Static HTML for crawlers on public pages, or null to serve the SPA. */
export function prerenderForBot(path: string, userAgent: string): string | null {
  if (!BOT_UA.test(String(userAgent || ''))) return null;
  const page = PAGES[path.replace(/\/+$/, '') || '/'];
  if (!page) return null;
  return SHELL(page.title, page.body);
}
