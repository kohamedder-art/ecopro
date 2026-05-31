#!/usr/bin/env python3
"""
SYSTEMATIC DEEP TEST
Create account → Login → Test EVERY page → Fix issues → Report
"""

from playwright.sync_api import sync_playwright
import time, os, json

BASE = "https://www.sahla4eco.com"
DIR = "deep_test_screenshots"
os.makedirs(DIR, exist_ok=True)

class SystematicTest:
    def __init__(self):
        self.n = 0
        self.issues = []
        self.ts = int(time.time())
        self.email = f"sys{self.ts}@gmail.com"
        self.pwd = "SystemTest123!"
        self.logged_in = False
        self.page = None

    def shot(self, name=""):
        self.n += 1
        path = f"{DIR}/{self.n:03d}_{name}.png"
        try: self.page.screenshot(path=path, full_page=False)
        except: pass
        return path

    def log(self, text, level="INFO"):
        icon = {"INFO": "ℹ️", "PASS": "✅", "FAIL": "❌", "WARN": "⚠️"}
        print(f"  {icon.get(level, '•')} [{level}] {text}")
        if level == "FAIL":
            self.issues.append(text)

    def nav(self, path):
        self.page.goto(f"{BASE}{path}", wait_until="domcontentloaded", timeout=60000)
        time.sleep(4)

    def is_logged_in(self):
        body = self.page.inner_text("body") or ""
        return any(w in body for w in ["لوحة التحكم", "الرئيسية", "Dashboard", "مرحباً بك"])

    def check_element(self, selector, desc, action=None):
        """Check if element exists, optionally interact"""
        el = self.page.query_selector(selector)
        if el:
            if action == "click":
                try:
                    el.click()
                    time.sleep(1)
                    self.log(f"{desc}: exists → clicked", "PASS")
                except:
                    self.log(f"{desc}: exists but click failed", "FAIL")
            elif action == "fill":
                try:
                    el.fill("test value")
                    self.log(f"{desc}: exists → filled", "PASS")
                except:
                    self.log(f"{desc}: exists but fill failed", "FAIL")
            else:
                self.log(f"{desc}: exists", "PASS")
            return True
        else:
            self.log(f"{desc}: NOT FOUND", "FAIL")
            return False

    def count_elements(self, selector, desc):
        try:
            els = self.page.query_selector_all(selector)
            self.log(f"{desc}: {len(els)} found", "PASS" if len(els) > 0 else "FAIL")
            return els
        except:
            self.log(f"{desc}: context destroyed", "WARN")
            return []

    # ═══════════════════════════════════════
    # STEP 0: CREATE ACCOUNT
    # ═══════════════════════════════════════
    def create_account(self):
        print("\n" + "=" * 60)
        print("STEP 0: CREATE ACCOUNT")
        print("=" * 60)

        self.nav("/signup")
        self.shot("signup")

        # Fill all fields
        name = self.page.query_selector('input[placeholder*="محمد"]')
        if name: name.fill("متجر اختبار عميق")

        self.page.fill('input[type="email"]', self.email)
        self.page.fill('input[type="password"]', self.pwd)
        time.sleep(2)

        # Wait for submit
        btn = self.page.query_selector('button[type="submit"]')
        for _ in range(15):
            if btn and btn.is_enabled(): break
            time.sleep(1)
            btn = self.page.query_selector('button[type="submit"]')

        if btn and btn.is_enabled():
            btn.click()
            time.sleep(6)
            
            # Check if logged in (SPA may not update URL)
            if self.is_logged_in():
                self.logged_in = True
                self.log("Account created and logged in", "PASS")
                return
            
            # If not on dashboard, try login
            print("  Signup didn't reach dashboard, trying login...")
            self.nav("/login")
            time.sleep(3)
            
            email_input = self.page.query_selector('input[type="email"], input[name="email"]')
            pwd_input = self.page.query_selector('input[type="password"]')
            
            if email_input and pwd_input:
                email_input.fill(self.email)
                pwd_input.fill(self.pwd)
                time.sleep(1)
                btn = self.page.query_selector('button[type="submit"]')
                if btn: btn.click()
                time.sleep(5)
                
                if self.is_logged_in():
                    self.logged_in = True
                    self.log("Logged in after retry", "PASS")
                else:
                    self.log(f"Login failed: {self.page.url}", "FAIL")
            else:
                self.log("Login inputs not found", "FAIL")
        else:
            self.log("Submit button never enabled", "FAIL")

    # ═══════════════════════════════════════
    # TEST PAGE: Generic page test
    # ═══════════════════════════════════════
    def test_page(self, path, name, checks=None):
        print(f"\n--- {name} ---")
        try:
            self.nav(path)
        except:
            self.log(f"Navigation failed for {path}", "WARN")
            return ""
        self.shot(name.replace(" ", "_").lower())

        body = self.page.inner_text("body") or ""
        self.log(f"Content: {len(body)} chars", "PASS" if len(body) > 100 else "FAIL")

        # Count interactive elements
        inputs = self.count_elements('input:not([type="hidden"])', "Inputs")
        btns = self.count_elements('button', "Buttons")
        links = self.count_elements('a[href]', "Links")
        selects = self.count_elements('select, [role="combobox"]', "Selects")

        # Run custom checks
        if checks:
            for desc, selector, action in checks:
                self.check_element(selector, desc, action)

        return body

    # ═══════════════════════════════════════
    # STEP 1: DASHBOARD HOME
    # ═══════════════════════════════════════
    def test_dashboard(self):
        print("\n" + "=" * 60)
        print("STEP 1: DASHBOARD HOME")
        print("=" * 60)

        body = self.test_page("/dashboard", "Dashboard Home", [
            ("Sidebar nav", "nav a[href]", None),
            ("Stats section", "[class*='card'], [class*='stat']", None),
            ("Orders link in sidebar", "a[href*='orders']", None),
            ("Settings link in sidebar", "a[href*='settings'], a[href*='bot']", None),
        ])

        # Check sidebar items specifically
        sidebar_items = self.page.query_selector_all('nav a[href*="dashboard"], nav a[href*="staff"], nav a[href*="billing"]')
        self.log(f"Dashboard sidebar items: {len(sidebar_items)}", "PASS" if len(sidebar_items) > 5 else "WARN")

    # ═══════════════════════════════════════
    # STEP 2: STORE / PRODUCTS
    # ═══════════════════════════════════════
    def test_store(self):
        print("\n" + "=" * 60)
        print("STEP 2: STORE / PRODUCTS")
        print("=" * 60)

        self.test_page("/dashboard/preview", "Store Management", [
            ("Add product button", "button:has-text('إضافة'), button:has-text('منتج')", "click"),
        ])

        # Check if dialog opened
        time.sleep(2)
        dialog = self.page.query_selector('[role="dialog"], [class*="modal"]')
        if dialog:
            self.log("Product dialog opened", "PASS")
            inputs = dialog.query_selector_all('input, textarea')
            self.log(f"Dialog has {len(inputs)} inputs", "PASS" if len(inputs) > 0 else "FAIL")

            # Fill product form
            for inp in inputs:
                try:
                    t = inp.get_attribute('type') or ''
                    ph = inp.get_attribute('placeholder') or ''
                    if 'text' in t or not t:
                        if 'اسم' in ph or 'name' in ph.lower() or 'عنوان' in ph:
                            inp.fill('منتج اختبار عميق')
                        elif 'وصف' in ph or 'desc' in ph.lower():
                            inp.fill('هذا وصف المنتج الاختباري')
                    elif 'number' in t:
                        inp.fill('1500')
                except: pass

            self.shot("product_dialog_filled")

            # Click through all tabs
            tabs = dialog.query_selector_all('button, [role="tab"]')
            for tab in tabs:
                txt = (tab.inner_text() or "").strip()[:30]
                if txt and any(w in txt for w in ["سعر", "مخزون", "نوع", "عرض", "حالة", "Stock", "Variant"]):
                    try:
                        tab.click()
                        time.sleep(1)
                        self.shot(f"product_tab_{txt[:10]}")
                        self.log(f"Tab clicked: {txt}", "PASS")
                    except: pass

            # Close dialog
            close = dialog.query_selector('button:has-text("إغلاق"), button:has-text("Cancel"), [aria-label="Close"]')
            if close: close.click()
            time.sleep(1)
        else:
            self.log("No product dialog found", "FAIL")

    # ═══════════════════════════════════════
    # STEP 3: STOCK
    # ═══════════════════════════════════════
    def test_stock(self):
        print("\n" + "=" * 60)
        print("STEP 3: STOCK MANAGEMENT")
        print("=" * 60)
        self.test_page("/dashboard/stock", "Stock Management")

    # ═══════════════════════════════════════
    # STEP 4: IMAGES
    # ═══════════════════════════════════════
    def test_images(self):
        print("\n" + "=" * 60)
        print("STEP 4: IMAGE MANAGER")
        print("=" * 60)
        self.test_page("/dashboard/images", "Image Manager", [
            ("Upload button", "button:has-text('رفع'), input[type='file']", None),
        ])

    # ═══════════════════════════════════════
    # STEP 5: ORDERS
    # ═══════════════════════════════════════
    def test_orders(self):
        print("\n" + "=" * 60)
        print("STEP 5: ORDERS")
        print("=" * 60)

        self.test_page("/dashboard/orders", "Orders List", [
            ("Filter tabs", "[role='tab'], [class*='tab']", None),
            ("Search input", "input[type='search'], input[placeholder*='بحث']", "fill"),
            ("New order button", "button:has-text('إضافة'), a[href*='add']", None),
        ])

        # Test Add Order
        self.test_page("/dashboard/orders/add", "Add Order", [
            ("Customer name input", "input[name*='name'], input[placeholder*='اسم']", "fill"),
            ("Phone input", "input[type='tel'], input[name*='phone'], input[placeholder*='هاتف']", "fill"),
            ("Address input", "input[name*='address'], input[placeholder*='عنوان']", "fill"),
            ("Submit button", "button[type='submit']", None),
        ])

        # Test Chat Orders
        self.test_page("/dashboard/orders/chat", "Chat Orders")

    # ═══════════════════════════════════════
    # STEP 6: TRACKING
    # ═══════════════════════════════════════
    def test_tracking(self):
        print("\n" + "=" * 60)
        print("STEP 6: ORDER TRACKING")
        print("=" * 60)
        self.test_page("/dashboard/tracking", "Order Tracking")

    # ═══════════════════════════════════════
    # STEP 7: DELIVERY
    # ═══════════════════════════════════════
    def test_delivery(self):
        print("\n" + "=" * 60)
        print("STEP 7: DELIVERY")
        print("=" * 60)

        self.test_page("/dashboard/delivery/companies", "Delivery Companies")
        self.test_page("/dashboard/delivery/pricing", "Delivery Pricing", [
            ("Wilaya selector", "select, [role='combobox']", None),
        ])

    # ═══════════════════════════════════════
    # STEP 8: BOT SETTINGS
    # ═══════════════════════════════════════
    def test_bots(self):
        print("\n" + "=" * 60)
        print("STEP 8: BOT SETTINGS")
        print("=" * 60)
        self.test_page("/dashboard/bot-settings", "Bot Settings")

    # ═══════════════════════════════════════
    # STEP 9: INTEGRATIONS
    # ═══════════════════════════════════════
    def test_integrations(self):
        print("\n" + "=" * 60)
        print("STEP 9: INTEGRATIONS")
        print("=" * 60)

        body = self.test_page("/dashboard/integrations", "Integrations", [
            ("Connect button", "button:has-text('ربط'), button:has-text('Connect')", None),
        ])

        # Click each platform card
        platform_cards = self.page.query_selector_all('button[class*="flex"][class*="flex-col"]')
        for card in platform_cards[:5]:
            try:
                txt = (card.inner_text() or "").strip()[:30]
                if txt and card.is_visible():
                    card.click()
                    time.sleep(2)
                    self.shot(f"integration_{txt[:15]}")
                    self.log(f"Platform tab: {txt}", "PASS")
            except: pass

    # ═══════════════════════════════════════
    # STEP 10: AI SETTINGS
    # ═══════════════════════════════════════
    def test_ai(self):
        print("\n" + "=" * 60)
        print("STEP 10: AI SETTINGS")
        print("=" * 60)

        self.test_page("/dashboard/ai-settings", "AI Settings", [
            ("AI toggle", "[role='switch'], input[type='checkbox']", None),
            ("Save button", "button:has-text('حفظ'), button[type='submit']", None),
        ])

        # Check toggles
        toggles = self.page.query_selector_all('[role="switch"], input[type="checkbox"]')
        self.log(f"AI toggles found: {len(toggles)}", "PASS" if len(toggles) > 0 else "WARN")

    # ═══════════════════════════════════════
    # STEP 11: MARKETING
    # ═══════════════════════════════════════
    def test_marketing(self):
        print("\n" + "=" * 60)
        print("STEP 11: MARKETING ANALYTICS")
        print("=" * 60)
        self.test_page("/dashboard/marketing-analytics", "Marketing Analytics")
        self.test_page("/dashboard/pixel-settings", "Pixel Settings")

    # ═══════════════════════════════════════
    # STEP 12: STAFF
    # ═══════════════════════════════════════
    def test_staff(self):
        print("\n" + "=" * 60)
        print("STEP 12: STAFF MANAGEMENT")
        print("=" * 60)

        self.test_page("/dashboard/staff", "Staff Management", [
            ("Add staff button", "button:has-text('إضافة'), button:has-text('موظف')", "click"),
        ])

        # Check dialog
        time.sleep(2)
        dialog = self.page.query_selector('[role="dialog"], [class*="modal"]')
        if dialog:
            inputs = dialog.query_selector_all('input')
            checkboxes = dialog.query_selector_all('input[type="checkbox"], [role="checkbox"]')
            self.log(f"Staff dialog: {len(inputs)} inputs, {len(checkboxes)} checkboxes", "PASS")
            close = dialog.query_selector('button:has-text("إغلاق"), [aria-label="Close"]')
            if close: close.click()

    # ═══════════════════════════════════════
    # STEP 13: BILLING
    # ═══════════════════════════════════════
    def test_billing(self):
        print("\n" + "=" * 60)
        print("STEP 13: BILLING")
        print("=" * 60)
        self.test_page("/dashboard/billing", "Billing", [
            ("Payment button", "button:has-text('دفع'), button:has-text('اشتراك'), a[href*='payment']", None),
        ])

    # ═══════════════════════════════════════
    # STEP 14: PROFILE
    # ═══════════════════════════════════════
    def test_profile(self):
        print("\n" + "=" * 60)
        print("STEP 14: PROFILE")
        print("=" * 60)

        self.test_page("/dashboard/profile", "Profile", [
            ("Name input", "input[placeholder*='اسم'], input[name*='name']", "fill"),
            ("Phone input", "input[type='tel'], input[name*='phone']", "fill"),
            ("Save button", "button:has-text('حفظ'), button[type='submit']", None),
            ("Change password", "button:has-text('كلمة المرور'), button:has-text('password')", "click"),
        ])

    # ═══════════════════════════════════════
    # STEP 15: ALERTS
    # ═══════════════════════════════════════
    def test_alerts(self):
        print("\n" + "=" * 60)
        print("STEP 15: ALERTS")
        print("=" * 60)
        self.test_page("/dashboard/alerts", "Alerts")

    # ═══════════════════════════════════════
    # STEP 16: TEMPLATE EDITOR
    # ═══════════════════════════════════════
    def test_template_editor(self):
        print("\n" + "=" * 60)
        print("STEP 16: TEMPLATE EDITOR")
        print("=" * 60)

        self.test_page("/template-editor", "Template Editor", [
            ("Publish button", "button:has-text('نشر'), button:has-text('Publish')", None),
            ("Layout controls", "button:has-text('تخطيط'), button:has-text('Layout')", None),
        ])

        # Click template cards
        cards = self.page.query_selector_all('[class*="template"], [class*="card"]')
        for card in cards[:3]:
            try:
                card.click()
                time.sleep(1)
                self.shot(f"template_card_{self.n}")
            except: pass

    # ═══════════════════════════════════════
    # STEP 17: MOBILE RESPONSIVE
    # ═══════════════════════════════════════
    def test_mobile(self):
        print("\n" + "=" * 60)
        print("STEP 17: MOBILE RESPONSIVE")
        print("=" * 60)

        self.page.set_viewport_size({"width": 375, "height": 812})

        pages = [
            "/dashboard", "/dashboard/preview", "/dashboard/orders",
            "/dashboard/bot-settings", "/dashboard/integrations",
            "/dashboard/billing", "/dashboard/profile",
            "/dashboard/delivery/companies", "/dashboard/staff",
        ]

        for path in pages:
            self.nav(path)
            name = path.replace("/dashboard/", "").replace("/", "_") or "home"
            self.shot(f"mobile_{name}")

            body = self.page.inner_text("body") or ""
            self.log(f"Mobile {name}: {len(body)} chars", "PASS" if len(body) > 100 else "FAIL")

            # Check bottom nav
            bottom = self.page.query_selector('[class*="bottom"], [class*="mobile-nav"]')
            if bottom:
                items = bottom.query_selector_all('a, button')
                self.log(f"  Bottom nav: {len(items)} items", "PASS")

        self.page.set_viewport_size({"width": 1280, "height": 800})

    # ═══════════════════════════════════════
    # REPORT
    # ═══════════════════════════════════════
    def report(self):
        print("\n" + "=" * 60)
        print("FINAL REPORT")
        print("=" * 60)
        print(f"Screenshots taken: {self.n}")
        print(f"Issues found: {len(self.issues)}")
        if self.issues:
            print("\nISSUES:")
            for i, issue in enumerate(self.issues, 1):
                print(f"  {i}. {issue}")
        else:
            print("\n✅ NO ISSUES FOUND — ALL PAGES PASS!")

        with open(f"{DIR}/systematic_report.json", "w") as f:
            json.dump({"screenshots": self.n, "issues": self.issues}, f, indent=2, ensure_ascii=False)

    # ═══════════════════════════════════════
    # RUN ALL
    # ═══════════════════════════════════════
    def run(self):
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=False, slow_mo=100)
            ctx = browser.new_context(viewport={"width": 1280, "height": 800}, locale="ar-DZ")
            self.page = ctx.new_page()
            self.page.set_default_timeout(30000)

            try:
                self.create_account()

                if self.logged_in:
                    self.test_dashboard()
                    self.test_store()
                    self.test_stock()
                    self.test_images()
                    self.test_orders()
                    self.test_tracking()
                    self.test_delivery()
                    self.test_bots()
                    self.test_integrations()
                    self.test_ai()
                    self.test_marketing()
                    self.test_staff()
                    self.test_billing()
                    self.test_profile()
                    self.test_alerts()
                    self.test_template_editor()
                    self.test_mobile()

                self.report()
            except Exception as e:
                print(f"\n❌ FATAL: {e}")
                self.shot("fatal")
            finally:
                browser.close()


if __name__ == "__main__":
    SystematicTest().run()
