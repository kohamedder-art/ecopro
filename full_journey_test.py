#!/usr/bin/env python3
"""
Full Client Journey Test
Creates a new account, completes onboarding, tests every dashboard feature.
"""

from playwright.sync_api import sync_playwright
import os
import time

BASE_URL = "https://www.sahla4eco.com"
HEADLESS = True
SCREENSHOT_DIR = "full_journey_screenshots"
SLOW_MO = 50

class JourneyTest:
    def __init__(self):
        self.n = 0
        os.makedirs(SCREENSHOT_DIR, exist_ok=True)
        # Generate unique test data (must be Gmail for this platform)
        ts = int(time.time())
        self.email = f"sahlatest{ts}@gmail.com"
        self.password = "TestPass123!"
        self.name = "متجر اختبار تلقائي"
        self.phone = "0555123456"
        self.log(f"Test account: {self.email}")

    def log(self, text):
        print(text)

    def shot(self, page, name):
        self.n += 1
        path = f"{SCREENSHOT_DIR}/{self.n:03d}_{name}.png"
        try:
            page.screenshot(path=path, full_page=False)
        except:
            pass
        return path

    def nav(self, page, path, wait=3):
        url = f"{BASE_URL}{path}"
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        time.sleep(wait)
        return url

    def run(self):
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=HEADLESS, slow_mo=SLOW_MO)
            ctx = browser.new_context(viewport={"width": 1280, "height": 800}, locale="ar-DZ")
            page = ctx.new_page()

            try:
                self.signup(page)
                self.onboarding(page)
                self.dashboard(page)
                self.store(page)
                self.stock(page)
                self.images(page)
                self.orders(page)
                self.chat_orders(page)
                self.tracking(page)
                self.delivery(page)
                self.bots(page)
                self.integrations(page)
                self.ai_settings(page)
                self.marketing(page)
                self.staff(page)
                self.billing(page)
                self.profile(page)
                self.alerts(page)
                self.log("\n✅ ALL PHASES COMPLETE")
            except Exception as e:
                self.log(f"\n❌ FATAL: {e}")
                self.shot(page, "fatal_error")
            finally:
                browser.close()

    # ═══════════════════════════════════════════
    # SIGNUP
    # ═══════════════════════════════════════════
    def signup(self, page):
        self.log("\n═══ SIGNUP ═══")
        self.nav(page, "/signup")
        self.shot(page, "signup_page")

        # Fill form — name field first (Arabic placeholder: محمد بن ملان)
        name_selectors = [
            'input[placeholder*="محمد"]',
            'input[name="name"]',
            'input[name="username"]',
            'input[name="full_name"]',
            'input[placeholder*="اسم"]',
            'input[placeholder*="Name"]',
        ]
        for sel in name_selectors:
            el = page.query_selector(sel)
            if el:
                el.fill(self.name)
                self.log(f"  Filled name via: {sel}")
                break

        page.fill('input[type="email"], input[name="email"]', self.email)
        page.fill('input[type="password"]', self.password)

        self.shot(page, "signup_filled")

        # Submit — wait for button to become enabled (validation)
        self.shot(page, "signup_filled")
        self.log("  Waiting for validation...")
        time.sleep(2)

        btn = page.query_selector('button[type="submit"]')
        if btn:
            # Wait for button to be enabled
            for i in range(10):
                if btn.is_enabled():
                    break
                time.sleep(1)
                btn = page.query_selector('button[type="submit"]')
            
            if btn and btn.is_enabled():
                btn.click()
                self.log("  Submitting signup...")
                time.sleep(5)
                self.shot(page, "after_signup")
            else:
                self.log("  ⚠️ Submit button still disabled after waiting")
                self.shot(page, "signup_button_disabled")

            # Check where we ended up
            url = page.url
            self.log(f"  Current URL: {url}")

            if "/login" in url:
                self.log("  → Redirected to login (may need email verification)")
                # Try logging in directly
                self.login_direct(page)
            elif "/dashboard" in url or "/app" in url or "/onboarding" in url:
                self.log("  → Logged in successfully")
            else:
                self.log(f"  → Unknown state, URL: {url}")
                # Try login anyway
                self.login_direct(page)

    def login_direct(self, page):
        """Login with the test credentials we just created"""
        self.log("\n═══ DIRECT LOGIN ═══")
        self.nav(page, "/login")
        self.shot(page, "login_for_login")

        page.fill('input[type="email"], input[name="email"]', self.email)
        page.fill('input[type="password"]', self.password)
        self.shot(page, "login_filled")

        btn = page.query_selector('button[type="submit"]')
        if btn:
            btn.click()
            time.sleep(5)
            self.shot(page, "after_login")
            self.log(f"  URL after login: {page.url}")

    # ═══════════════════════════════════════════
    # ONBOARDING
    # ═══════════════════════════════════════════
    def onboarding(self, page):
        self.log("\n═══ ONBOARDING ═══")
        url = page.url

        # If not on onboarding, try navigating there
        if "/onboarding" not in url:
            self.nav(page, "/onboarding")
            time.sleep(2)

        self.shot(page, "onboarding_page")

        # Check if there's a form to fill
        inputs = page.query_selector_all('input:not([type="hidden"])')
        self.log(f"  Found {len(inputs)} input fields")

        # Try to fill store name if present
        store_name_input = page.query_selector('input[placeholder*="متجر"], input[placeholder*="store"], input[name="store_name"], input[name="company_name"]')
        if store_name_input:
            store_name_input.fill("متجر اختبار تلقائي")
            self.log("  Filled store name")

        # Try phone
        phone_input = page.query_selector('input[type="tel"], input[name="phone"], input[placeholder*="هاتف"], input[placeholder*="phone"]')
        if phone_input:
            phone_input.fill(self.phone)
            self.log("  Filled phone")

        self.shot(page, "onboarding_filled")

        # Look for submit/next button
        btn = page.query_selector('button[type="submit"], button:has-text("التالي"), button:has-text("حفظ"), button:has-text("ابدأ")')
        if btn:
            btn.click()
            time.sleep(3)
            self.shot(page, "onboarding_submitted")
            self.log(f"  URL after submit: {page.url}")

    # ═══════════════════════════════════════════
    # DASHBOARD
    # ═══════════════════════════════════════════
    def dashboard(self, page):
        self.log("\n═══ DASHBOARD ═══")
        self.nav(page, "/dashboard")
        self.shot(page, "dashboard_home")

        # Check for key elements
        body = page.inner_text("body") or ""
        checks = {
            "Has stats": any(w in body for w in ["إجمالي", "الإيرادات", "الطلبات", "revenue", "orders"]),
            "Has sidebar": page.query_selector('nav, [class*="sidebar"]') is not None,
            "Shows numbers": any(c.isdigit() for c in body[:500]),
        }
        for name, passed in checks.items():
            self.log(f"  {'✅' if passed else '❌'} {name}")

    # ═══════════════════════════════════════════
    # STORE / PRODUCTS
    # ═══════════════════════════════════════════
    def store(self, page):
        self.log("\n═══ STORE / PRODUCTS ═══")
        self.nav(page, "/dashboard/preview")
        self.shot(page, "store_management")

        body = page.inner_text("body") or ""
        self.log(f"  Page has content: {len(body)} chars")

        # Try to click "Add Product" button
        add_btn = page.query_selector('button:has-text("إضافة"), button:has-text("منتج"), button:has-text("إضافة منتج")')
        if add_btn:
            self.log("  Found add product button — clicking...")
            add_btn.click()
            time.sleep(3)
            self.shot(page, "add_product_dialog")

            # Check if dialog/form opened
            dialog = page.query_selector('[role="dialog"], [class*="modal"], [class*="dialog"]')
            if dialog:
                self.log("  ✅ Product dialog opened")
                # Try to fill product name
                name_input = page.query_selector('input[placeholder*="اسم"], input[name="name"], input[name="title"]')
                if name_input:
                    name_input.fill("منتج اختبار تلقائي")
                    self.log("  ✅ Filled product name")
                self.shot(page, "add_product_filled")

                # Close dialog
                close = page.query_selector('[role="dialog"] button:has-text("إغلاق"), [role="dialog"] button[class*="close"], [aria-label="Close"]')
                if close:
                    close.click()
                    time.sleep(1)
            else:
                self.log("  ⚠️ No dialog found after clicking add")

    def stock(self, page):
        self.log("\n═══ STOCK ═══")
        self.nav(page, "/dashboard/stock")
        self.shot(page, "stock_management")
        body = page.inner_text("body") or ""
        self.log(f"  Page has content: {len(body)} chars")

    def images(self, page):
        self.log("\n═══ IMAGES ═══")
        self.nav(page, "/dashboard/images")
        self.shot(page, "image_manager")
        body = page.inner_text("body") or ""
        self.log(f"  Page has content: {len(body)} chars")

    # ═══════════════════════════════════════════
    # ORDERS
    # ═══════════════════════════════════════════
    def orders(self, page):
        self.log("\n═══ ORDERS ═══")
        self.nav(page, "/dashboard/orders")
        self.shot(page, "orders_list")

        body = page.inner_text("body") or ""
        checks = {
            "Shows orders content": any(w in body for w in ["طلب", "الطلبات", "order", " ORD "]),
            "Has table or list": page.query_selector('table, [class*="order"]') is not None,
        }
        for name, passed in checks.items():
            self.log(f"  {'✅' if passed else '❌'} {name}")

        # Add order
        self.nav(page, "/dashboard/orders/add")
        self.shot(page, "add_order")

        inputs = page.query_selector_all('input:not([type="hidden"]), select, textarea')
        self.log(f"  Add order form has {len(inputs)} fields")

    def chat_orders(self, page):
        self.log("\n═══ CHAT ORDERS ═══")
        self.nav(page, "/dashboard/orders/chat")
        self.shot(page, "chat_orders")
        body = page.inner_text("body") or ""
        self.log(f"  Page has content: {len(body)} chars")

    def tracking(self, page):
        self.log("\n═══ ORDER TRACKING ═══")
        self.nav(page, "/dashboard/tracking")
        self.shot(page, "order_tracking")
        body = page.inner_text("body") or ""
        self.log(f"  Page has content: {len(body)} chars")

    # ═══════════════════════════════════════════
    # DELIVERY
    # ═══════════════════════════════════════════
    def delivery(self, page):
        self.log("\n═══ DELIVERY COMPANIES ═══")
        self.nav(page, "/dashboard/delivery/companies")
        self.shot(page, "delivery_companies")
        body = page.inner_text("body") or ""
        has_companies = any(w in body for w in ["yalidine", "maystro", "express", "Yalidine", "شركة", "توصيل"])
        self.log(f"  {'✅' if has_companies else '❌'} Shows delivery companies")

        self.log("\n═══ DELIVERY PRICING ═══")
        self.nav(page, "/dashboard/delivery/pricing")
        self.shot(page, "delivery_pricing")
        body = page.inner_text("body") or ""
        has_pricing = any(w in body for w in ["ولاية", "wilaya", "تسعيرة", "ثمن"])
        self.log(f"  {'✅' if has_pricing else '❌'} Shows pricing data")

    # ═══════════════════════════════════════════
    # BOT / INTEGRATIONS / AI
    # ═══════════════════════════════════════════
    def bots(self, page):
        self.log("\n═══ BOT SETTINGS ═══")
        self.nav(page, "/dashboard/bot-settings")
        self.shot(page, "bot_settings")
        body = page.inner_text("body") or ""
        has_bot = any(w in body for w in ["whatsapp", "telegram", "بوت", "البوت"])
        self.log(f"  {'✅' if has_bot else '❌'} Shows bot providers")

    def integrations(self, page):
        self.log("\n═══ INTEGRATIONS ═══")
        self.nav(page, "/dashboard/integrations")
        self.shot(page, "integrations")
        body = page.inner_text("body") or ""
        has_platforms = any(w in body for w in ["facebook", "instagram", "Facebook", "Instagram", "ربط"])
        self.log(f"  {'✅' if has_platforms else '❌'} Shows platforms")

        # Check connect buttons
        connect_btns = page.query_selector_all('button:has-text("ربط"), button:has-text("Connect")')
        self.log(f"  Found {len(connect_btns)} connect buttons")

    def ai_settings(self, page):
        self.log("\n═══ AI SETTINGS ═══")
        self.nav(page, "/dashboard/ai-settings")
        self.shot(page, "ai_settings")
        body = page.inner_text("body") or ""
        has_ai = any(w in body for w in ["ذكاء", "AI", "المساعد", "رد تلقائي"])
        self.log(f"  {'✅' if has_ai else '❌'} Shows AI config")

    def marketing(self, page):
        self.log("\n═══ MARKETING ANALYTICS ═══")
        self.nav(page, "/dashboard/marketing-analytics")
        self.shot(page, "marketing_analytics")
        body = page.inner_text("body") or ""
        self.log(f"  Page has content: {len(body)} chars")

    # ═══════════════════════════════════════════
    # STAFF
    # ═══════════════════════════════════════════
    def staff(self, page):
        self.log("\n═══ STAFF MANAGEMENT ═══")
        self.nav(page, "/dashboard/staff")
        self.shot(page, "staff_management")
        body = page.inner_text("body") or ""
        has_staff = any(w in body for w in ["موظف", "staff", "إضافة", "دخول"])
        self.log(f"  {'✅' if has_staff else '❌'} Shows staff page")

    # ═══════════════════════════════════════════
    # BILLING + PROFILE
    # ═══════════════════════════════════════════
    def billing(self, page):
        self.log("\n═══ BILLING ═══")
        self.nav(page, "/dashboard/billing")
        self.shot(page, "billing")
        body = page.inner_text("body") or ""
        has_billing = any(w in body for w in ["اشتراك", "الباقة", "subscription", "دج", "فواتير"])
        self.log(f"  {'✅' if has_billing else '❌'} Shows billing info")

    def profile(self, page):
        self.log("\n═══ PROFILE ═══")
        self.nav(page, "/dashboard/profile")
        self.shot(page, "profile")
        body = page.inner_text("body") or ""
        has_profile = any(w in body for w in ["الاسم", "البريد", "الهاتف", "name", "email"])
        self.log(f"  {'✅' if has_profile else '❌'} Shows profile info")

    def alerts(self, page):
        self.log("\n═══ ALERTS ═══")
        self.nav(page, "/dashboard/alerts")
        self.shot(page, "alerts")
        body = page.inner_text("body") or ""
        self.log(f"  Page has content: {len(body)} chars")


if __name__ == "__main__":
    test = JourneyTest()
    test.run()
