/**
 * Facebook / Instagram OAuth Routes
 *
 * Flow:
 *  1. GET  /api/facebook/auth-url       → returns Facebook Login URL
 *  2. GET  /api/facebook/callback        → Facebook redirects here with ?code=
 *  3. GET  /api/facebook/status          → connection status for current client
 *  4. GET  /api/facebook/pages           → list pages available after OAuth (for page picker)
 *  5. POST /api/facebook/select-page     → store selected page token
 *  6. POST /api/facebook/disconnect      → revoke & remove tokens
 */

import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../utils/database";
import { encryptData, decryptData } from "../utils/encryption";
import crypto from "crypto";
import { getCookieOptions } from "../utils/auth-cookies";

const router = Router();

// ─── Env (read lazily — dotenv hasn't loaded yet when this module is imported) ──
function getFbAppId() { return String(process.env.FB_APP_ID || "").trim(); }
function getFbAppSecret() { return String(process.env.FB_APP_SECRET || "").trim(); }
function getFbRedirectUri() {
  return String(process.env.FB_OAUTH_REDIRECT_URI || "").trim() ||
    `${process.env.PUBLIC_URL || "http://localhost:8080"}/api/facebook/callback`;
}

const SCOPES = [
  "pages_messaging",
  "pages_manage_metadata",
  "pages_read_engagement",
  "pages_read_user_content",
  "instagram_basic",
  "instagram_manage_messages",
].join(",");

// ─── Helpers ────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const clientId = (req as any).user?.id;
  if (!clientId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function getClientId(req: Request): number {
  return Number((req as any).user?.id);
}

async function graphGet(url: string): Promise<any> {
  const resp = await fetch(url);
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Graph API ${resp.status}: ${body}`);
  }
  return resp.json();
}

// ─── 1. Auth URL ────────────────────────────────────────────────
router.get("/auth-url", requireAuth, (_req: Request, res: Response) => {
  if (!getFbAppId() || !getFbAppSecret()) {
    return res.status(503).json({ error: "Facebook OAuth not configured" });
  }

  const state = crypto.randomBytes(20).toString("hex");

  // Save state in httpOnly cookie for CSRF protection
  const { isProduction, sameSite, domain } = getCookieOptions();
  res.cookie("fb_oauth_state", state, {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    domain,
    path: "/",
    maxAge: 10 * 60 * 1000, // 10 min
  });

  const url =
    `https://www.facebook.com/v21.0/dialog/oauth?` +
    `client_id=${encodeURIComponent(getFbAppId())}` +
    `&redirect_uri=${encodeURIComponent(getFbRedirectUri())}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&state=${encodeURIComponent(state)}` +
    `&response_type=code`;

  return res.json({ url });
});

// ─── 2. Callback ────────────────────────────────────────────────
router.get("/callback", async (req: Request, res: Response) => {
  try {
    const { code, state, error: fbError } = req.query;

    if (fbError) {
      console.error("[FB OAuth] Facebook returned error:", fbError);
      return res.redirect("/dashboard/bot-settings?fb=error");
    }

    if (!code || !state) {
      return res.redirect("/dashboard/bot-settings?fb=error");
    }

    // Verify CSRF state
    const savedState = (req as any).cookies?.fb_oauth_state;
    if (!savedState || savedState !== String(state)) {
      console.error("[FB OAuth] State mismatch");
      return res.redirect("/dashboard/bot-settings?fb=error");
    }

    // Clear state cookie
    res.clearCookie("fb_oauth_state", { path: "/" });

    // Exchange code for short-lived user token
    const tokenData = await graphGet(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
        `client_id=${getFbAppId()}` +
        `&redirect_uri=${encodeURIComponent(getFbRedirectUri())}` +
        `&client_secret=${getFbAppSecret()}` +
        `&code=${encodeURIComponent(String(code))}`
    );

    if (!tokenData.access_token) {
      console.error("[FB OAuth] No access_token in response:", tokenData);
      return res.redirect("/dashboard/bot-settings?fb=error");
    }

    // Exchange for long-lived user token (~60 days)
    const longLived = await graphGet(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
        `grant_type=fb_exchange_token` +
        `&client_id=${getFbAppId()}` +
        `&client_secret=${getFbAppSecret()}` +
        `&fb_exchange_token=${encodeURIComponent(tokenData.access_token)}`
    );

    const userAccessToken = longLived.access_token || tokenData.access_token;
    const expiresIn = longLived.expires_in || 5184000; // default 60 days

    // Get user info
    const me = await graphGet(
      `https://graph.facebook.com/v21.0/me?access_token=${userAccessToken}`
    );

    // Get user's pages
    const pagesData = await graphGet(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${userAccessToken}`
    );

    const pages = (pagesData.data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      accessToken: p.access_token,
      instagramId: p.instagram_business_account?.id || null,
    }));

    // Extract client_id from the JWT cookie — we need to identify the user
    // Since callback is unauthenticated (redirect from Facebook), we use a temp cookie
    // Actually, the user should be logged in already. Let's check the auth cookie.
    const clientId = (req as any).user?.id;

    if (!clientId) {
      // Store the token data temporarily in a secure cookie for the frontend to complete
      const tempData = JSON.stringify({
        fbUserId: me.id,
        userAccessToken,
        expiresIn,
        pages,
      });
      const { isProduction, sameSite, domain } = getCookieOptions();
      res.cookie("fb_oauth_temp", encryptData(tempData), {
        httpOnly: true,
        secure: isProduction,
        sameSite,
        domain,
        path: "/",
        maxAge: 5 * 60 * 1000, // 5 min
      });

      return res.redirect("/dashboard/bot-settings?fb=select-page");
    }

    // If only 1 page, auto-select it
    if (pages.length === 1) {
      const page = pages[0];
      await savePageToken(clientId, me.id, userAccessToken, expiresIn, page);
      return res.redirect("/dashboard/bot-settings?fb=connected");
    }

    // Multiple pages → store temp data, redirect to page picker
    const tempData = JSON.stringify({
      fbUserId: me.id,
      userAccessToken,
      expiresIn,
      pages,
    });
    const { isProduction, sameSite, domain } = getCookieOptions();
    res.cookie("fb_oauth_temp", encryptData(tempData), {
      httpOnly: true,
      secure: isProduction,
      sameSite,
      domain,
      path: "/",
      maxAge: 5 * 60 * 1000,
    });

    return res.redirect("/dashboard/bot-settings?fb=select-page");
  } catch (err: any) {
    console.error("[FB OAuth] Callback error:", err?.message || err);
    return res.redirect("/dashboard/bot-settings?fb=error");
  }
});

// ─── 3. Status ──────────────────────────────────────────────────
router.get("/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const clientId = getClientId(req);
    const result = await pool.query(
      `SELECT page_id, page_name, instagram_account_id, instagram_username,
              token_expires_at, is_active, updated_at
       FROM facebook_tokens WHERE client_id = $1`,
      [clientId]
    );

    // If we have an active per-client facebook_tokens row, return its details.
    if (result.rows.length && result.rows[0].is_active) {
      const row = result.rows[0];
      return res.json({
        connected: true,
        pageId: row.page_id,
        pageName: row.page_name,
        instagramConnected: !!row.instagram_account_id,
        instagramUsername: row.instagram_username || null,
        tokenExpiresAt: row.token_expires_at,
        updatedAt: row.updated_at,
      });
    }

    // No active per-client token — fall back to bot_settings. This covers
    // the case where the server uses a platform/shared Page (env-based token)
    // or the owner has saved a Page ID in bot_settings.
    try {
      const botRes = await pool.query(
        `SELECT fb_page_id, fb_page_access_token, messenger_enabled, updated_at
         FROM bot_settings WHERE client_id = $1 LIMIT 1`,
        [clientId]
      );

      if (botRes.rows.length) {
        const s = botRes.rows[0];
        const fbPageId = s.fb_page_id ? String(s.fb_page_id).trim() : '';

        const platformFbId = String(process.env.PLATFORM_FB_PAGE_ID || '').trim();
        const platformToken = String(process.env.PLATFORM_FB_PAGE_ACCESS_TOKEN || '').trim();
        const platformAvailable = !!platformFbId && !!platformToken;

        // Consider connected if the store has a Page ID saved, or if the server
        // is using the platform shared Page.
        const usingPlatform = platformAvailable && (!fbPageId || fbPageId === platformFbId);

        // Check Instagram: platform-level env vars, or client's own facebook_tokens row
        const platformIgId = String(process.env.PLATFORM_INSTAGRAM_PAGE_ID || '').trim();
        const platformIgToken = String(process.env.PLATFORM_INSTAGRAM_ACCESS_TOKEN || '').trim();
        const platformIgAvailable = !!platformIgId && !!platformIgToken;
        // Also check if client has their own Instagram via facebook_tokens
        let clientIgConnected = false;
        try {
          const igCheck = await pool.query(
            `SELECT instagram_account_id FROM facebook_tokens WHERE client_id = $1 AND is_active = TRUE AND instagram_account_id IS NOT NULL AND instagram_account_id != '' LIMIT 1`,
            [clientId]
          );
          clientIgConnected = igCheck.rows.length > 0;
        } catch { /* table might not exist */ }
        const igConnected = clientIgConnected || (usingPlatform && platformIgAvailable);

        if (fbPageId || usingPlatform) {
          return res.json({
            connected: true,
            // Hide the platform Page ID to avoid exposing env-level identifiers.
            pageId: usingPlatform ? null : (fbPageId || null),
            pageName: null,
            instagramConnected: igConnected,
            instagramUsername: null,
            tokenExpiresAt: null,
            updatedAt: s.updated_at || null,
          });
        }
      }
    } catch (err) {
      // Best-effort fallback — ignore and return disconnected below.
      console.warn('[FB OAuth] bot_settings lookup failed in /status:', err);
    }

    return res.json({ connected: false });
  } catch (err: any) {
    console.error("[FB OAuth] Status error:", err?.message);
    return res.status(500).json({ error: "Failed to check Facebook status" });
  }
});

// ─── 4. Pages (from temp cookie after callback) ─────────────────
router.get("/pages", requireAuth, async (req: Request, res: Response) => {
  try {
    const tempCookie = (req as any).cookies?.fb_oauth_temp;
    if (!tempCookie) {
      return res.status(400).json({ error: "No pending Facebook authorization" });
    }

    const tempData = JSON.parse(decryptData(tempCookie));
    return res.json({
      pages: (tempData.pages || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        hasInstagram: !!p.instagramId,
      })),
    });
  } catch (err: any) {
    console.error("[FB OAuth] Pages error:", err?.message);
    return res.status(400).json({ error: "Invalid or expired authorization" });
  }
});

// ─── 5. Select Page ─────────────────────────────────────────────
router.post("/select-page", requireAuth, async (req: Request, res: Response) => {
  try {
    const clientId = getClientId(req);
    const { pageId } = req.body;

    if (!pageId || typeof pageId !== "string") {
      return res.status(400).json({ error: "pageId is required" });
    }

    const tempCookie = (req as any).cookies?.fb_oauth_temp;
    if (!tempCookie) {
      return res.status(400).json({ error: "No pending Facebook authorization" });
    }

    const tempData = JSON.parse(decryptData(tempCookie));
    const page = (tempData.pages || []).find((p: any) => p.id === pageId);
    if (!page) {
      return res.status(400).json({ error: "Page not found in authorized pages" });
    }

    await savePageToken(
      clientId,
      tempData.fbUserId,
      tempData.userAccessToken,
      tempData.expiresIn,
      page
    );

    // Clear temp cookie
    res.clearCookie("fb_oauth_temp", { path: "/" });

    return res.json({
      success: true,
      pageName: page.name,
      instagramConnected: !!page.instagramId,
    });
  } catch (err: any) {
    console.error("[FB OAuth] Select page error:", err?.message);
    return res.status(500).json({ error: "Failed to save page connection" });
  }
});

// ─── 6. Disconnect ──────────────────────────────────────────────
router.post("/disconnect", requireAuth, async (req: Request, res: Response) => {
  try {
    const clientId = getClientId(req);

    // Get the token to revoke
    const existing = await pool.query(
      `SELECT user_access_token_encrypted FROM facebook_tokens WHERE client_id = $1`,
      [clientId]
    );

    if (existing.rows.length) {
      try {
        const token = decryptData(existing.rows[0].user_access_token_encrypted);
        // Revoke the token on Facebook's side
        await fetch(
          `https://graph.facebook.com/v21.0/me/permissions?access_token=${token}`,
          { method: "DELETE" }
        );
      } catch {
        // Best-effort revocation
      }
    }

    await pool.query(`DELETE FROM facebook_tokens WHERE client_id = $1`, [clientId]);

    // Also clear the fb_page_id/fb_page_access_token in bot_settings if they match
    // so the messenger route doesn't use stale tokens
    await pool.query(
      `UPDATE bot_settings SET fb_page_id = '', fb_page_access_token = '', updated_at = NOW()
       WHERE client_id = $1`,
      [clientId]
    );

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[FB OAuth] Disconnect error:", err?.message);
    return res.status(500).json({ error: "Failed to disconnect Facebook" });
  }
});

// ─── Save helper ────────────────────────────────────────────────

async function savePageToken(
  clientId: number,
  fbUserId: string,
  userAccessToken: string,
  expiresIn: number,
  page: { id: string; name: string; accessToken: string; instagramId?: string | null }
) {
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  // Fetch Instagram username if connected
  let igUsername: string | null = null;
  if (page.instagramId) {
    try {
      const igData = await graphGet(
        `https://graph.facebook.com/v21.0/${page.instagramId}?fields=username&access_token=${page.accessToken}`
      );
      igUsername = igData.username || null;
    } catch {
      // Non-critical
    }
  }

  const encUserToken = encryptData(userAccessToken);
  const encPageToken = encryptData(page.accessToken);

  await pool.query(
    `INSERT INTO facebook_tokens
       (client_id, fb_user_id, user_access_token_encrypted, page_id, page_name,
        page_access_token_encrypted, instagram_account_id, instagram_username,
        scopes, token_expires_at, is_active, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, NOW())
     ON CONFLICT (client_id) DO UPDATE SET
       fb_user_id = $2,
       user_access_token_encrypted = $3,
       page_id = $4,
       page_name = $5,
       page_access_token_encrypted = $6,
       instagram_account_id = $7,
       instagram_username = $8,
       scopes = $9,
       token_expires_at = $10,
       is_active = TRUE,
       last_refreshed_at = NOW(),
       updated_at = NOW()`,
    [
      clientId,
      fbUserId,
      encUserToken,
      page.id,
      page.name,
      encPageToken,
      page.instagramId || null,
      igUsername,
      SCOPES,
      expiresAt,
    ]
  );

  // Also update bot_settings so the messenger route picks up the new OAuth token
  await pool.query(
    `UPDATE bot_settings
     SET fb_page_id = $2,
         fb_page_access_token = $3,
         messenger_enabled = TRUE,
         updated_at = NOW()
     WHERE client_id = $1`,
    [clientId, page.id, page.accessToken]
  );
}

export default router;
