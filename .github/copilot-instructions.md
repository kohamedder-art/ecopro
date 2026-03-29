# EcoPro Platform Guidelines

**IMPORTANT: Before starting ANY task, read the specific documentation in `docs/`:**
* **General Architecture & Rules:** `docs/AGENTS.md` and `docs/PLATFORM_OVERVIEW.md`
* **Template/Theme Edits:** `docs/TEMPLATE_EDITS_REFERENCE.md` (Mandatory for UI/Theme/Template tasks)

## Code Style
* **Database Access:** NEVER create a local database. Only use the Render PostgreSQL database.
* **Component Styling:** Use Tailwind CSS with Radix UI components (found in `client/components/ui/`).
* **Design System:** Follow the compact "Bento-box" glassmorphic UI tokens in `design_system.md` (`h-10` inputs, `rounded-[24px]` major panels, etc.).

## Architecture
* **Frontend:** React 18 + Vite (`client/`).
* **Backend:** Express + TypeScript (`server/`).
* **Auth Boundaries:** JWT with `role`/`user_type` fields via `HttpOnly` cookies. Roles include `admin`, `client` (store owner), and `staff` (client manager).
* **Admin Chat System:** Pages at `/platform-admin/chat` use API `/api/chat/*`. Messages use `metadata.fileUrl` and `metadata.isImage` for attachments.

## Build and Test
* **Development:** `pnpm dev` (runs Vite client on `5173` & nodemon/tsx server on `8080` concurrently).
* **Build:** `pnpm build` (builds both client and server).
* **Start Production:** `pnpm start` (runs `node dist/server/node-build.cjs`).
* **Test:** `pnpm test` (checks Vitest suite).

## Conventions
* **Do It Yourself:** As an AI, NEVER ask the user to do anything manual. You must execute all commands and file edits yourself.
* **Store Rule:** One client/seller = one storefront. The admin account (`admin@ecopro.com`) has no store.
* **No Database Migrations for Templates:** Adding a new design template requires zero DB changes; add the React component directly to `client/components/templates/`.
* **NEW TEMPLATE CREATION:** Before creating or adding ANY new storefront template, you MUST first read `.github/skills/create-template/SKILL.md` and follow EVERY step and the final checklist. No exceptions. This file contains the complete requirements (delivery, cart, orders, checkout, RTL, contentEditable, colors, registration, etc.). Missing any step = broken template.
