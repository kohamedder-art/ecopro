# Pixel System Architecture

There are **two completely separate pixel systems**. Do NOT confuse them.

---

## 1. PLATFORM PIXELS (Sahla4Eco admin side)
- **Scope:** sahla4eco.com (homepage, platform-admin, platform pages)
- **Controlled by:** Sahla4Eco platform admins via admin panel
- **Data source:** `platform_settings` table → key `pixel_config`
- **Frontend code:** `client/lib/pixel.ts` + `client/components/PixelManager.tsx`
- **Backend code:** `server/routes/pixels.ts` → `pixelRelayHandler`
- **API endpoint:** `/api/platform/pixel-config`
- **Current pixel IDs:** `1308696358033663` and `1293886202234390`
- **This is what we are currently fixing.**

### Platform pixel config format (DB):
```json
[{"platform":"facebook","pixel_id":"1308696358033663","enabled":true,"access_token":"..."}, ...]
```

---

## 2. STORE PIXELS (store owner side)
- **Scope:** store subdomains (store-name.sahla4eco.com) and /store/slug pages
- **Controlled by:** Each store owner in their store settings
- **Data source:** `client_pixel_settings` table
- **Frontend code:** `client/components/storefront/PixelScripts.tsx`
- **Backend code:** `server/routes/pixels.ts` → store-specific pixel handling
- **API endpoint:** `/api/pixels/config/:slug`
- **NOT what we are currently working on.**

### Store pixel config fields (DB):
- `facebook_pixel_id`, `facebook_access_token`
- `is_facebook_enabled`, `tiktok_pixel_id`, `is_tiktok_enabled`

---

## Key Files
| File | Purpose |
|------|---------|
| `client/lib/pixel.ts` | **Shared pixel logic** — init SDK, track events, relay to CAPI |
| `client/components/PixelManager.tsx` | **Platform pixel manager** — loads platform/store config, fires PageView |
| `client/components/storefront/PixelScripts.tsx` | **Store pixel handling** — storefront events only |
| `server/routes/pixels.ts` | **Backend** — pixelRelayHandler (CAPI), proxy, tracking |
| `server/index.ts` | **Server HTML** — inline storefront pixel code (targetSlug-gated) |
| `index.html` | **Static HTML** — was hardcoded with platform pixels (now removed) |

## Current Status
- ✅ CAPI relay working (`events_received: 1`)
- ✅ `fbc`/`fbp` cookies included in CAPI
- ✅ `event_id` matching between browser pixel and CAPI
- ✅ Hardcoded pixel code removed from `index.html` (was causing duplicate events)
- ⚠️ Events still not showing in Facebook Events Manager
- ❓ Need to regenerate access tokens with `ads_management` scope
