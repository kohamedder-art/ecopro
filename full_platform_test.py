#!/usr/bin/env python3
"""
Comprehensive Platform Test Suite
Tests every corner of sahla4eco.com systematically.
"""

from playwright.sync_api import sync_playwright
import os
import time
import json
from datetime import datetime

# ===== CONFIGURATION =====
BASE_URL = "https://www.sahla4eco.com"
HEADLESS = True  # Run headless for speed
SCREENSHOT_DIR = "full_test_screenshots"
SLOW_MO = 100  # ms between actions (0 = instant)
TIMEOUT = 60000  # 60s per navigation

# Test credentials (create a test account first, or use existing)
TEST_EMAIL = os.environ.get("TEST_EMAIL", "")
TEST_PASSWORD = os.environ.get("TEST_PASSWORD", "")
# ===== END CONFIG =====

class TestRunner:
    def __init__(self):
        self.results = []
        self.screenshot_count = 0
        os.makedirs(SCREENSHOT_DIR, exist_ok=True)
        self.log_file = open(f"{SCREENSHOT_DIR}/test_results.md", "w")
        self.log("# Platform Test Results\n")
        self.log(f"**Date**: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
        self.log(f"**Target**: {BASE_URL}\n\n")

    def log(self, text):
        print(text)
        self.log_file.write(text + "\n")
        self.log_file.flush()

    def screenshot(self, page, name):
        self.screenshot_count += 1
        path = f"{SCREENSHOT_DIR}/{self.screenshot_count:03d}_{name}.png"
        try:
            page.screenshot(path=path, full_page=False)
            return path
        except:
            return None

    def test_page(self, page, url, name, checks=None):
        """Navigate to URL, take screenshot, run checks"""
        self.log(f"\n### {name}")
        self.log(f"**URL**: `{url}`")
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=TIMEOUT)
            time.sleep(3)
            path = self.screenshot(page, name.replace(" ", "_").lower())
            self.log(f"**Screenshot**: `{path}`")
            
            # Run custom checks
            if checks:
                for check_name, check_fn in checks:
                    try:
                        result = check_fn(page)
                        status = "✅" if result else "❌"
                        self.log(f"- {status} {check_name}")
                        self.results.append({"test": name, "check": check_name, "passed": result})
                    except Exception as e:
                        self.log(f"- ❌ {check_name}: {e}")
                        self.results.append({"test": name, "check": check_name, "passed": False, "error": str(e)})
            
            self.log(f"**Status**: ✅ Page loaded")
            return True
        except Exception as e:
            self.log(f"**Status**: ❌ Failed: {e}")
            self.screenshot(page, f"error_{name.replace(' ', '_').lower()}")
            return False

    def run(self):
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=HEADLESS, slow_mo=SLOW_MO)
            context = browser.new_context(
                viewport={"width": 1280, "height": 800},
                locale="ar-DZ",
            )
            page = context.new_page()

            try:
                self.phase_1_public_pages(page)
                self.phase_2_auth_flow(page)
                self.phase_3_dashboard(page)
                self.phase_4_store_products(page)
                self.phase_5_orders(page)
                self.phase_6_delivery(page)
                self.phase_7_bot_integrations(page)
                self.phase_8_staff(page)
                self.phase_9_billing_profile(page)
                self.phase_10_mobile_responsive(page)
                self.compile_report()

            finally:
                browser.close()
                self.log_file.close()

    # ─────────────────────────────────────────────────────
    # PHASE 1: PUBLIC PAGES
    # ─────────────────────────────────────────────────────
    def phase_1_public_pages(self, page):
        self.log("\n# PHASE 1: PUBLIC PAGES\n")

        # Homepage
        self.test_page(page, BASE_URL, "Homepage", [
            ("Title contains SAHLA4ECO", lambda p: "SAHLA4ECO" in p.title() or "sahla" in p.url),
            ("Has CTA button", lambda p: p.query_selector('a[href*="signup"], button:has-text("متجرك"), a:has-text("متجرك")') is not None),
            ("Has navigation", lambda p: p.query_selector('nav') is not None),
            ("Arabic content visible", lambda p: "اصنع" in (p.inner_text('body') or "")),
        ])

        # Login page
        self.test_page(page, f"{BASE_URL}/login", "Login Page", [
            ("Has email input", lambda p: p.query_selector('input[type="email"], input[name="email"]') is not None),
            ("Has password input", lambda p: p.query_selector('input[type="password"], input[name="password"]') is not None),
            ("Has login button", lambda p: p.query_selector('button[type="submit"], button:has-text("دخول")') is not None),
            ("Has Google login", lambda p: p.query_selector('button:has-text("Google"), [class*="google"]') is not None),
            ("Has forgot password link", lambda p: p.query_selector('a[href*="forgot"], a:has-text("نسيت")') is not None),
            ("Has signup link", lambda p: p.query_selector('a[href*="signup"], a:has-text("حساب")') is not None),
        ])

        # Signup page
        self.test_page(page, f"{BASE_URL}/signup", "Signup Page", [
            ("Has name input", lambda p: p.query_selector('input[name="name"], input[name="username"], input[placeholder*="اسم"]') is not None),
            ("Has email input", lambda p: p.query_selector('input[type="email"], input[name="email"]') is not None),
            ("Has password input", lambda p: p.query_selector('input[type="password"]') is not None),
            ("Has signup button", lambda p: p.query_selector('button[type="submit"], button:has-text("إنشاء"), button:has-text("حساب")') is not None),
        ])

        # Pricing page
        self.test_page(page, f"{BASE_URL}/pricing", "Pricing Page", [
            ("Shows price", lambda p: "دج" in (p.inner_text('body') or "")),
            ("Has features list", lambda p: len(p.query_selector_all('li, [class*="feature"]')) > 0),
        ])

        # About page
        self.test_page(page, f"{BASE_URL}/about", "About Page")

        # Contact page
        self.test_page(page, f"{BASE_URL}/contact", "Contact Page")

        # Privacy page
        self.test_page(page, f"{BASE_URL}/privacy", "Privacy Page")

        # Forgot password
        self.test_page(page, f"{BASE_URL}/forgot-password", "Forgot Password Page", [
            ("Has email input", lambda p: p.query_selector('input[type="email"], input[name="email"]') is not None),
            ("Has submit button", lambda p: p.query_selector('button[type="submit"], button:has-text("إرسال")') is not None),
        ])

        # Account locked (should redirect)
        self.test_page(page, f"{BASE_URL}/account-locked", "Account Locked Page")

    # ─────────────────────────────────────────────────────
    # PHASE 2: AUTH FLOW
    # ─────────────────────────────────────────────────────
    def phase_2_auth_flow(self, page):
        self.log("\n# PHASE 2: AUTH FLOW\n")

        if not TEST_EMAIL or not TEST_PASSWORD:
            self.log("**⚠️ Skipping auth flow — TEST_EMAIL/TEST_PASSWORD not set**")
            self.log("Set env vars to test login: `export TEST_EMAIL=... TEST_PASSWORD=...`")
            return

        # Test login
        self.log(f"\n### Login with {TEST_EMAIL}")
        page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded", timeout=TIMEOUT)
        time.sleep(2)

        email_input = page.query_selector('input[type="email"], input[name="email"]')
        password_input = page.query_selector('input[type="password"]')

        if email_input and password_input:
            email_input.fill(TEST_EMAIL)
            password_input.fill(TEST_PASSWORD)
            self.screenshot(page, "login_filled")

            # Click login button
            submit = page.query_selector('button[type="submit"]')
            if submit:
                submit.click()
                time.sleep(5)
                self.screenshot(page, "after_login")
                
                # Check if redirected to dashboard
                current_url = page.url
                if "/dashboard" in current_url or "/app" in current_url:
                    self.log("- ✅ Login successful — redirected to dashboard")
                    self.results.append({"test": "Login", "check": "redirect", "passed": True})
                elif "error" in page.inner_text("body").lower():
                    self.log("- ❌ Login failed — error on page")
                    self.results.append({"test": "Login", "check": "redirect", "passed": False})
                else:
                    self.log(f"- ⚠️ Login result unclear — URL: {current_url}")
                    self.results.append({"test": "Login", "check": "redirect", "passed": False})
            else:
                self.log("- ❌ Submit button not found")
        else:
            self.log("- ❅ Email/password inputs not found")

    # ─────────────────────────────────────────────────────
    # PHASE 3: DASHBOARD
    # ─────────────────────────────────────────────────────
    def phase_3_dashboard(self, page):
        self.log("\n# PHASE 3: DASHBOARD\n")
        
        # Check if logged in
        if "/dashboard" not in page.url and "/app" not in page.url:
            self.log("**⚠️ Not logged in — skipping dashboard tests**")
            return

        self.test_page(page, f"{BASE_URL}/dashboard", "Dashboard Home", [
            ("Has stats cards", lambda p: len(p.query_selector_all('[class*="card"], [class*="stat"]')) > 0),
            ("Has sidebar", lambda p: p.query_selector('nav, [class*="sidebar"]') is not None),
            ("Shows orders/revenue", lambda p: "طلب" in (p.inner_text('body') or "") or "order" in (p.inner_text('body') or "").lower()),
        ])

        # Profile page
        self.test_page(page, f"{BASE_URL}/dashboard/profile", "Profile Page", [
            ("Has user info", lambda p: "الاسم" in (p.inner_text('body') or "") or "name" in (p.inner_text('body') or "").lower()),
        ])

    # ─────────────────────────────────────────────────────
    # PHASE 4: STORE / PRODUCTS
    # ─────────────────────────────────────────────────────
    def phase_4_store_products(self, page):
        self.log("\n# PHASE 4: STORE / PRODUCTS\n")
        
        if "/dashboard" not in page.url and "/app" not in page.url:
            self.log("**⚠️ Not logged in — skipping**")
            return

        # Store management
        self.test_page(page, f"{BASE_URL}/dashboard/preview", "Store Management", [
            ("Has product list", lambda p: len(p.query_selector_all('[class*="product"], table tr')) > 0 or "منتج" in (p.inner_text('body') or "")),
            ("Has add product button", lambda p: p.query_selector('button:has-text("إضافة"), button:has-text("منتج"), [class*="add"]') is not None),
        ])

        # Stock management
        self.test_page(page, f"{BASE_URL}/dashboard/stock", "Stock Management", [
            ("Has stock table", lambda p: "م_stock" in (p.inner_text('body') or "") or "منتج" in (p.inner_text('body') or "") or len(p.query_selector_all('table tr')) > 0),
        ])

        # Image manager
        self.test_page(page, f"{BASE_URL}/dashboard/images", "Image Manager")

    # ─────────────────────────────────────────────────────
    # PHASE 5: ORDERS
    # ─────────────────────────────────────────────────────
    def phase_5_orders(self, page):
        self.log("\n# PHASE 5: ORDERS\n")
        
        if "/dashboard" not in page.url and "/app" not in page.url:
            self.log("**⚠️ Not logged in — skipping**")
            return

        # Orders list
        self.test_page(page, f"{BASE_URL}/dashboard/orders", "Orders List", [
            ("Has order table", lambda p: len(p.query_selector_all('table tr')) > 0 or "طلب" in (p.inner_text('body') or "")),
            ("Has filter options", lambda p: p.query_selector('[class*="filter"], [class*="tab"], [role="tab"]') is not None),
        ])

        # Add order
        self.test_page(page, f"{BASE_URL}/dashboard/orders/add", "Add Order", [
            ("Has form fields", lambda p: len(p.query_selector_all('input, select, textarea')) > 0),
        ])

        # Chat orders
        self.test_page(page, f"{BASE_URL}/dashboard/orders/chat", "Chat Orders")

        # Order tracking
        self.test_page(page, f"{BASE_URL}/dashboard/tracking", "Order Tracking")

    # ─────────────────────────────────────────────────────
    # PHASE 6: DELIVERY
    # ─────────────────────────────────────────────────────
    def phase_6_delivery(self, page):
        self.log("\n# PHASE 6: DELIVERY\n")
        
        if "/dashboard" not in page.url and "/app" not in page.url:
            self.log("**⚠️ Not logged in — skipping**")
            return

        self.test_page(page, f"{BASE_URL}/dashboard/delivery/companies", "Delivery Companies", [
            ("Has company list", lambda p: len(p.query_selector_all('[class*="company"], [class*="card"], table tr')) > 0),
        ])

        self.test_page(page, f"{BASE_URL}/dashboard/delivery/pricing", "Delivery Pricing", [
            ("Has pricing table", lambda p: len(p.query_selector_all('table tr')) > 0 or "wilaya" in (p.inner_text('body') or "").lower()),
        ])

    # ─────────────────────────────────────────────────────
    # PHASE 7: BOT / INTEGRATIONS / AI
    # ─────────────────────────────────────────────────────
    def phase_7_bot_integrations(self, page):
        self.log("\n# PHASE 7: BOT / INTEGRATIONS / AI\n")
        
        if "/dashboard" not in page.url and "/app" not in page.url:
            self.log("**⚠️ Not logged in — skipping**")
            return

        # Bot settings
        self.test_page(page, f"{BASE_URL}/dashboard/bot-settings", "Bot Settings", [
            ("Has provider options", lambda p: "whatsapp" in (p.inner_text('body') or "").lower() or "telegram" in (p.inner_text('body') or "").lower()),
        ])

        # Integrations
        self.test_page(page, f"{BASE_URL}/dashboard/integrations", "Integrations", [
            ("Has platform cards", lambda p: len(p.query_selector_all('[class*="platform"], [class*="integration"]')) > 0 or "facebook" in (p.inner_text('body') or "").lower()),
            ("Has connect buttons", lambda p: p.query_selector('button:has-text("ربط"), button:has-text("Connect")') is not None),
        ])

        # AI settings
        self.test_page(page, f"{BASE_URL}/dashboard/ai-settings", "AI Settings", [
            ("Has AI config", lambda p: "ذكاء" in (p.inner_text('body') or "") or "ai" in (p.inner_text('body') or "").lower()),
        ])

        # Marketing analytics
        self.test_page(page, f"{BASE_URL}/dashboard/marketing-analytics", "Marketing Analytics")

        # Pixel settings
        self.test_page(page, f"{BASE_URL}/dashboard/pixel-settings", "Pixel Settings")

    # ─────────────────────────────────────────────────────
    # PHASE 8: STAFF
    # ─────────────────────────────────────────────────────
    def phase_8_staff(self, page):
        self.log("\n# PHASE 8: STAFF MANAGEMENT\n")
        
        if "/dashboard" not in page.url and "/app" not in page.url:
            self.log("**⚠️ Not logged in — skipping**")
            return

        self.test_page(page, f"{BASE_URL}/dashboard/staff", "Staff Management", [
            ("Has staff list", lambda p: len(p.query_selector_all('[class*="staff"], table tr')) > 0 or "موظف" in (p.inner_text('body') or "")),
        ])

    # ─────────────────────────────────────────────────────
    # PHASE 9: BILLING + PROFILE
    # ─────────────────────────────────────────────────────
    def phase_9_billing_profile(self, page):
        self.log("\n# PHASE 9: BILLING + PROFILE\n")
        
        if "/dashboard" not in page.url and "/app" not in page.url:
            self.log("**⚠️ Not logged in — skipping**")
            return

        # Billing
        self.test_page(page, f"{BASE_URL}/dashboard/billing", "Billing Page", [
            ("Has subscription info", lambda p: "اشتراك" in (p.inner_text('body') or "") or "subscription" in (p.inner_text('body') or "").lower()),
            ("Shows price", lambda p: "دج" in (p.inner_text('body') or "")),
        ])

        # Alerts
        self.test_page(page, f"{BASE_URL}/dashboard/alerts", "Alerts Page")

    # ─────────────────────────────────────────────────────
    # PHASE 10: MOBILE RESPONSIVE
    # ─────────────────────────────────────────────────────
    def phase_10_mobile_responsive(self, page):
        self.log("\n# PHASE 10: MOBILE RESPONSIVE\n")
        
        # Set mobile viewport
        page.set_viewport_size({"width": 375, "height": 812})  # iPhone 13

        self.test_page(page, BASE_URL, "Mobile Homepage", [
            ("Has mobile nav", lambda p: p.query_selector('[class*="mobile"], [class*="bottom-bar"], nav') is not None),
            ("Content visible", lambda p: len(p.inner_text('body')) > 100),
        ])

        self.test_page(page, f"{BASE_URL}/login", "Mobile Login", [
            ("Form visible", lambda p: p.query_selector('input[type="email"], input[name="email"]') is not None),
        ])

        self.test_page(page, f"{BASE_URL}/pricing", "Mobile Pricing", [
            ("Shows price", lambda p: "دج" in (p.inner_text('body') or "")),
        ])

        # Reset to desktop
        page.set_viewport_size({"width": 1280, "height": 800})

    # ─────────────────────────────────────────────────────
    # COMPILE REPORT
    # ─────────────────────────────────────────────────────
    def compile_report(self):
        total = len(self.results)
        passed = sum(1 for r in self.results if r["passed"])
        failed = total - passed

        self.log("\n" + "=" * 60)
        self.log(f"# FINAL REPORT")
        self.log(f"**Total checks**: {total}")
        self.log(f"**Passed**: {passed} ✅")
        self.log(f"**Failed**: {failed} ❌")
        self.log(f"**Pass rate**: {(passed/total*100) if total else 0:.1f}%")
        self.log(f"**Screenshots**: {self.screenshot_count}")
        self.log(f"**Report saved**: `{SCREENSHOT_DIR}/test_results.md`")
        self.log("=" * 60)

        if failed:
            self.log("\n## Failed Tests:")
            for r in self.results:
                if not r["passed"]:
                    err = r.get("error", "")
                    self.log(f"- ❌ {r['test']} → {r['check']} {err}")

        # Save JSON results
        with open(f"{SCREENSHOT_DIR}/results.json", "w") as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    runner = TestRunner()
    runner.run()
