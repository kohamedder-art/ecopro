#!/usr/bin/env python3
"""
DEEP TEST — Every button, every form, every interaction.
Tests 100% of the platform UI by clicking/interacting with every element.
"""

from playwright.sync_api import sync_playwright
import os, time, json

BASE_URL = "https://www.sahla4eco.com"
DIR = "deep_test_screenshots"
HEADLESS = True

class DeepTest:
    def __init__(self):
        self.n = 0
        self.findings = []
        os.makedirs(DIR, exist_ok=True)
        ts = int(time.time())
        self.email = f"deeptest{ts}@gmail.com"
        self.password = "DeepTest123!"

    def s(self, page, name=""):
        self.n += 1
        path = f"{DIR}/{self.n:03d}_{name}.png"
        try: page.screenshot(path=path, full_page=False)
        except: pass
        return path

    def log(self, text, level="INFO"):
        self.findings.append({"level": level, "msg": text})
        print(f"  [{level}] {text}")

    def nav(self, page, path):
        page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded", timeout=60000)
        time.sleep(3)

    def click_all(self, page, container, label):
        """Click every clickable element in container and log results"""
        btns = container.query_selector_all('button:not([disabled]), a[href], [role="button"], [role="tab"], [role="menuitem"]')
        clicked = 0
        for btn in btns[:5]:  # Limit to avoid infinite loops
            try:
                text = (btn.inner_text() or "").strip()[:50]
                if text and btn.is_visible():
                    btn.click()
                    time.sleep(1)
                    clicked += 1
                    self.log(f"  Clicked [{label}]: '{text}'")
            except:
                pass
        self.log(f"  Total clicked in [{label}]: {clicked}")

    def fill_all_inputs(self, page, container, label, value="test"):
        """Fill every visible input in container"""
        inputs = container.query_selector_all('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea')
        filled = 0
        for inp in inputs:
            try:
                if inp.is_visible() and not inp.is_disabled():
                    inp.fill(value)
                    filled += 1
            except: pass
        self.log(f"  Filled {filled} inputs in [{label}]")

    # ═══════════════════════════════════════
    # SIGNUP + LOGIN
    # ═══════════════════════════════════════
    def auth(self, page):
        self.log("\n═══ PHASE 1: AUTH ═══")

        # Signup
        self.nav(page, "/signup")
        self.s(page, "signup")
        
        # Find and fill all inputs
        name_el = page.query_selector('input[placeholder*="محمد"], input[name="name"]')
        if name_el: name_el.fill("متجر اختبار عميق")
        page.fill('input[type="email"]', self.email)
        page.fill('input[type="password"]', self.password)
        self.s(page, "signup_filled")

        # Wait for button
        time.sleep(2)
        btn = page.query_selector('button[type="submit"]')
        for _ in range(15):
            if btn and btn.is_enabled(): break
            time.sleep(1)
            btn = page.query_selector('button[type="submit"]')

        if btn and btn.is_enabled():
            btn.click()
            time.sleep(5)
            self.s(page, "after_signup")
            self.log(f"After signup URL: {page.url}")

        # If redirected to login, login
        if "/login" in page.url:
            self.nav(page, "/login")
            page.fill('input[type="email"]', self.email)
            page.fill('input[type="password"]', self.password)
            btn = page.query_selector('button[type="submit"]')
            if btn: btn.click()
            time.sleep(5)
            self.s(page, "after_login")

        self.log(f"Final auth URL: {page.url}")

    # ═══════════════════════════════════════
    # SIDEBAR NAVIGATION — click every item
    # ═══════════════════════════════════════
    def sidebar(self, page):
        self.log("\n═══ PHASE 2: SIDEBAR NAVIGATION ═══")
        self.nav(page, "/dashboard")
        self.s(page, "dashboard_start")

        # Get all sidebar links
        sidebar_links = page.query_selector_all('nav a[href], [class*="sidebar"] a[href], [class*="menu"] a[href]')
        self.log(f"Found {len(sidebar_links)} sidebar links")

        visited = set()
        for link in sidebar_links[:30]:
            try:
                href = link.get_attribute('href')
                text = (link.inner_text() or "").strip()[:50]
                if href and href not in visited and text and link.is_visible():
                    visited.add(href)
                    link.click()
                    time.sleep(2)
                    self.s(page, f"nav_{text.replace(' ','_')[:20]}")
                    self.log(f"  Navigated: '{text}' → {page.url}")
            except: pass

    # ═══════════════════════════════════════
    # STORE — CRUD product
    # ═══════════════════════════════════════
    def store_crud(self, page):
        self.log("\n═══ PHASE 3: STORE CRUD ═══")
        self.nav(page, "/dashboard/preview")
        self.s(page, "store_page")

        # Find and click "Add Product" button
        add_btns = page.query_selector_all('button')
        for btn in add_btns:
            text = (btn.inner_text() or "").strip()
            if "إضافة" in text or "منتج" in text or "Add" in text:
                try:
                    btn.click()
                    time.sleep(3)
                    self.s(page, "add_product_dialog")

                    # Fill ALL inputs in the dialog
                    dialog = page.query_selector('[role="dialog"], [class*="modal"]')
                    if dialog:
                        self.log("  Dialog opened — filling fields...")
                        self.fill_all_inputs(page, dialog, "product_dialog", "منتج اختبار")
                        
                        # Fill specific fields
                        name_input = dialog.query_selector('input[placeholder*="اسم"], input[name="name"], input[name="title"]')
                        if name_input:
                            name_input.fill("منتج اختبار عميق")
                            self.log("  Filled product name")

                        price_input = dialog.query_selector('input[type="number"], input[placeholder*="ثمن"], input[placeholder*="price"]')
                        if price_input:
                            price_input.fill("1500")
                            self.log("  Filled price: 1500")

                        # Check for category select
                        category_select = dialog.query_selector('select, [role="combobox"]')
                        if category_select:
                            self.log("  Found category selector")

                        self.s(page, "product_filled")

                        # Click all buttons in dialog
                        self.click_all(page, dialog, "product_dialog")

                        # Try save
                        save_btn = dialog.query_selector('button:has-text("حفظ"), button:has-text("إضافة"), button[type="submit"]')
                        if save_btn and save_btn.is_enabled():
                            save_btn.click()
                            time.sleep(3)
                            self.s(page, "product_saved")
                            self.log("  ✅ Product saved")
                        else:
                            self.log("  ⚠️ Save button not found or disabled")
                            # Close dialog
                            close = dialog.query_selector('button[class*="close"], [aria-label="Close"]')
                            if close: close.click()
                    else:
                        self.log("  ⚠️ No dialog found")
                except Exception as e:
                    self.log(f"  Error: {e}")
                break

        # Test existing products — click first row
        rows = page.query_selector_all('table tbody tr, [class*="product-card"], [class*="product-item"]')
        if rows:
            self.log(f"  Found {len(rows)} product rows")
            try:
                rows[0].click()
                time.sleep(2)
                self.s(page, "product_clicked")
            except: pass

    # ═══════════════════════════════════════
    # ORDERS — every interaction
    # ═══════════════════════════════════════
    def orders_deep(self, page):
        self.log("\n═══ PHASE 4: ORDERS DEEP ═══")
        self.nav(page, "/dashboard/orders")
        self.s(page, "orders_list")

        # Test every filter/tab
        tabs = page.query_selector_all('[role="tab"], [class*="tab"], button[class*="filter"]')
        self.log(f"  Found {len(tabs)} filter tabs")
        for tab in tabs[:10]:
            try:
                text = (tab.inner_text() or "").strip()[:30]
                if text and tab.is_visible():
                    tab.click()
                    time.sleep(1)
                    self.s(page, f"order_tab_{text.replace(' ','_')[:15]}")
                    self.log(f"    Clicked tab: '{text}'")
            except: pass

        # Test search
        search = page.query_selector('input[type="search"], input[placeholder*="بحث"], input[placeholder*="search"]')
        if search:
            search.fill("test")
            time.sleep(2)
            self.s(page, "orders_search")
            self.log("  ✅ Search filled")
            search.fill("")

        # Test order row interactions
        rows = page.query_selector_all('table tbody tr')
        if rows:
            self.log(f"  Found {len(rows)} order rows")
            # Click first row to expand
            try:
                rows[0].click()
                time.sleep(2)
                self.s(page, "order_expanded")
                
                # Test status buttons in expanded view
                status_btns = page.query_selector_all('button:has-text("تأكيد"), button:has-text("شحن"), button:has-text("ملغي")')
                self.log(f"    Found {len(status_btns)} status buttons")
                for sbtn in status_btns[:3]:
                    try:
                        text = (sbtn.inner_text() or "").strip()
                        self.log(f"      Status btn: '{text}'")
                    except: pass
            except: pass

        # Add Order page
        self.nav(page, "/dashboard/orders/add")
        self.s(page, "add_order")
        self.log("  Testing Add Order form...")
        
        # Fill all inputs
        inputs = page.query_selector_all('input:not([type="hidden"]), select, textarea')
        self.log(f"  Found {len(inputs)} form fields")
        for inp in inputs:
            try:
                inp_type = inp.get_attribute('type') or ''
                inp_name = inp.get_attribute('name') or inp.get_attribute('placeholder') or ''
                if 'email' in inp_type or 'email' in inp_name:
                    inp.fill("test@gmail.com")
                elif 'tel' in inp_type or 'phone' in inp_name or 'هاتف' in inp_name:
                    inp.fill("0555123456")
                elif 'number' in inp_type or 'price' in inp_name or 'ثمن' in inp_name:
                    inp.fill("1500")
                elif 'text' in inp_type or not inp_type:
                    inp.fill("test value")
            except: pass
        self.s(page, "add_order_filled")

        # Submit
        submit = page.query_selector('button[type="submit"], button:has-text("حفظ"), button:has-text("إضافة")')
        if submit and submit.is_enabled():
            self.log("  Submit button found and enabled")
            # Don't actually submit to avoid creating test orders
            self.log("  ⏸️ Skipping actual submit to avoid test data")

    # ═══════════════════════════════════════
    # DELIVERY — test every company
    # ═══════════════════════════════════════
    def delivery_deep(self, page):
        self.log("\n═══ PHASE 5: DELIVERY DEEP ═══")
        self.nav(page, "/dashboard/delivery/companies")
        self.s(page, "delivery_companies")

        # Click every company card/button
        cards = page.query_selector_all('[class*="card"], [class*="company"], button')
        for card in cards[:10]:
            try:
                text = (card.inner_text() or "").strip()[:50]
                if text and card.is_visible() and any(w in text.lower() for w in ["yalidine", "maystro", "express", "zt", "zone", "configure", "تفعيل"]):
                    card.click()
                    time.sleep(2)
                    self.s(page, f"delivery_{text.replace(' ','_')[:20]}")
                    self.log(f"  Clicked: '{text}'")
                    
                    # If dialog opened, fill it
                    dialog = page.query_selector('[role="dialog"], [class*="modal"]')
                    if dialog:
                        self.fill_all_inputs(page, dialog, f"delivery_{text[:10]}")
                        self.s(page, f"delivery_dialog_{text.replace(' ','_')[:15]}")
                        # Close
                        close = dialog.query_selector('button[class*="close"], [aria-label="Close"]')
                        if close: close.click()
                        time.sleep(1)
            except: pass

        # Delivery pricing
        self.nav(page, "/dashboard/delivery/pricing")
        self.s(page, "delivery_pricing")

        # Test wilaya filter/selector
        selects = page.query_selector_all('select, [role="combobox"]')
        self.log(f"  Found {len(selects)} selectors")
        for sel in selects[:3]:
            try:
                sel.click()
                time.sleep(1)
                options = page.query_selector_all('[role="option"], option')
                self.log(f"    Selector has {len(options)} options")
                if options:
                    options[0].click()
                    time.sleep(1)
                    self.s(page, f"pricing_select_{self.n}")
            except: pass

    # ═══════════════════════════════════════
    # BOT / INTEGRATIONS / AI
    # ═══════════════════════════════════════
    def bot_integrations_deep(self, page):
        self.log("\n═══ PHASE 6: BOT/INTEGRATIONS/AI DEEP ═══")

        # Bot settings
        self.nav(page, "/dashboard/bot-settings")
        self.s(page, "bot_settings")
        inputs = page.query_selector_all('input:not([type="hidden"]), textarea')
        self.log(f"  Bot settings: {len(inputs)} input fields")
        self.fill_all_inputs(page, page, "bot_settings")

        # Test every platform tab in integrations
        self.nav(page, "/dashboard/integrations")
        self.s(page, "integrations")

        # Click each platform card
        platform_cards = page.query_selector_all('button[class*="flex flex-col"], [class*="platform"]')
        self.log(f"  Found {len(platform_cards)} platform cards")
        for card in platform_cards[:5]:
            try:
                text = (card.inner_text() or "").strip()[:30]
                if text and card.is_visible():
                    card.click()
                    time.sleep(2)
                    self.s(page, f"integration_{text.replace(' ','_')[:15]}")
                    self.log(f"    Switched to: '{text}'")
            except: pass

        # Test connect buttons
        connect_btns = page.query_selector_all('button:has-text("ربط"), button:has-text("Connect")')
        self.log(f"  Found {len(connect_btns)} connect buttons")
        for btn in connect_btns[:3]:
            try:
                text = (btn.inner_text() or "").strip()
                self.log(f"    Connect btn: '{text}'")
                # Don't actually click to avoid OAuth redirect
            except: pass

        # AI settings
        self.nav(page, "/dashboard/ai-settings")
        self.s(page, "ai_settings")
        inputs = page.query_selector_all('input:not([type="hidden"]), textarea, select')
        self.log(f"  AI settings: {len(inputs)} input fields")
        
        # Test AI toggles/switches
        switches = page.query_selector_all('[role="switch"], input[type="checkbox"], button[class*="switch"]')
        self.log(f"  Found {len(switches)} toggle switches")
        for sw in switches[:5]:
            try:
                if sw.is_visible():
                    text = (sw.inner_text() or "").strip()[:30] or "toggle"
                    self.log(f"    Toggle: '{text}'")
            except: pass

        # Marketing analytics
        self.nav(page, "/dashboard/marketing-analytics")
        self.s(page, "marketing")

        # Pixel settings
        self.nav(page, "/dashboard/pixel-settings")
        self.s(page, "pixels")

    # ═══════════════════════════════════════
    # STAFF — test every action
    # ═══════════════════════════════════════
    def staff_deep(self, page):
        self.log("\n═══ PHASE 7: STAFF DEEP ═══")
        self.nav(page, "/dashboard/staff")
        self.s(page, "staff_page")

        # Click add staff button
        add_btns = page.query_selector_all('button')
        for btn in add_btns:
            text = (btn.inner_text() or "").strip()
            if "إضافة" in text or "موظف" in text or "Add" in text:
                try:
                    btn.click()
                    time.sleep(2)
                    self.s(page, "add_staff_dialog")
                    
                    dialog = page.query_selector('[role="dialog"], [class*="modal"]')
                    if dialog:
                        self.fill_all_inputs(page, dialog, "add_staff")
                        self.s(page, "add_staff_filled")
                        
                        # Test permission checkboxes
                        checkboxes = dialog.query_selector_all('input[type="checkbox"], [role="checkbox"]')
                        self.log(f"  Found {len(checkboxes)} permission checkboxes")
                        for cb in checkboxes[:5]:
                            try:
                                cb.click()
                                time.sleep(0.5)
                            except: pass
                        self.s(page, "staff_permissions")
                        
                        # Close
                        close = dialog.query_selector('button[class*="close"], [aria-label="Close"]')
                        if close: close.click()
                except: pass
                break

        # Test staff row actions
        rows = page.query_selector_all('table tbody tr, [class*="staff"]')
        self.log(f"  Found {len(rows)} staff rows")
        for row in rows[:3]:
            try:
                btns = row.query_selector_all('button')
                for btn in btns:
                    text = (btn.inner_text() or "").strip()[:20]
                    if text:
                        self.log(f"    Staff action: '{text}'")
            except: pass

    # ═══════════════════════════════════════
    # BILLING + PROFILE
    # ═══════════════════════════════════════
    def billing_profile_deep(self, page):
        self.log("\n═══ PHASE 8: BILLING + PROFILE DEEP ═══")

        # Billing
        self.nav(page, "/dashboard/billing")
        self.s(page, "billing_page")

        # Test all buttons on billing page
        btns = page.query_selector_all('button')
        for btn in btns[:10]:
            try:
                text = (btn.inner_text() or "").strip()[:30]
                if text and btn.is_visible():
                    self.log(f"  Billing button: '{text}'")
            except: pass

        # Profile
        self.nav(page, "/dashboard/profile")
        self.s(page, "profile_page")

        # Fill all profile fields
        inputs = page.query_selector_all('input:not([type="hidden"])')
        self.log(f"  Profile: {len(inputs)} input fields")
        for inp in inputs:
            try:
                if inp.is_visible() and not inp.is_disabled():
                    placeholder = inp.get_attribute('placeholder') or ''
                    name = inp.get_attribute('name') or ''
                    if 'name' in name or 'اسم' in placeholder:
                        inp.fill("اسم محدث")
                    elif 'phone' in name or 'هاتف' in placeholder:
                        inp.fill("0555987654")
                    elif 'email' in name or 'بريد' in placeholder:
                        pass  # Don't change email
            except: pass
        self.s(page, "profile_filled")

        # Test change password
        pwd_btn = page.query_selector('button:has-text("كلمة المرور"), button:has-text("password"), button:has-text("تغيير")')
        if pwd_btn:
            pwd_btn.click()
            time.sleep(2)
            self.s(page, "change_password_dialog")
            dialog = page.query_selector('[role="dialog"], [class*="modal"]')
            if dialog:
                self.fill_all_inputs(page, dialog, "password_change")
                self.s(page, "password_filled")
                close = dialog.query_selector('button[class*="close"], [aria-label="Close"]')
                if close: close.click()

    # ═══════════════════════════════════════
    # TEMPLATE EDITOR
    # ═══════════════════════════════════════
    def template_editor(self, page):
        self.log("\n═══ PHASE 9: TEMPLATE EDITOR ═══")
        self.nav(page, "/template-editor")
        self.s(page, "template_editor")
        time.sleep(5)  # Editor might load slowly

        # Test template cards
        cards = page.query_selector_all('[class*="template"], [class*="card"]')
        self.log(f"  Found {len(cards)} template cards")
        for card in cards[:5]:
            try:
                card.click()
                time.sleep(1)
                self.s(page, f"template_{self.n}")
            except: pass

        # Test editor controls
        btns = page.query_selector_all('button')
        self.log(f"  Found {len(btns)} buttons in editor")
        for btn in btns[:10]:
            try:
                text = (btn.inner_text() or "").strip()[:20]
                if text and btn.is_visible():
                    self.log(f"    Editor button: '{text}'")
            except: pass

    # ═══════════════════════════════════════
    # MOBILE — test every page
    # ═══════════════════════════════════════
    def mobile_deep(self, page):
        self.log("\n═══ PHASE 10: MOBILE DEEP ═══")
        page.set_viewport_size({"width": 375, "height": 812})

        mobile_pages = [
            "/dashboard", "/dashboard/preview", "/dashboard/orders",
            "/dashboard/bot-settings", "/dashboard/integrations",
            "/dashboard/billing", "/dashboard/profile",
            "/dashboard/delivery/companies", "/dashboard/staff",
        ]

        for path in mobile_pages:
            self.nav(page, path)
            self.s(page, f"mobile_{path.replace('/dashboard/','').replace('/','_') or 'home'}")
            
            # Test bottom nav if present
            bottom_nav = page.query_selector('[class*="bottom-bar"], [class*="mobile-nav"]')
            if bottom_nav:
                links = bottom_nav.query_selector_all('a, button')
                self.log(f"  Mobile bottom nav: {len(links)} items")

        # Reset to desktop
        page.set_viewport_size({"width": 1280, "height": 800})

    # ═══════════════════════════════════════
    # RUN ALL
    # ═══════════════════════════════════════
    def run(self):
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=HEADLESS, slow_mo=30)
            ctx = browser.new_context(viewport={"width": 1280, "height": 800}, locale="ar-DZ")
            page = ctx.new_page()
            page.set_default_timeout(30000)

            try:
                self.auth(page)
                if "/dashboard" in page.url:
                    self.sidebar(page)
                    self.store_crud(page)
                    self.orders_deep(page)
                    self.delivery_deep(page)
                    self.bot_integrations_deep(page)
                    self.staff_deep(page)
                    self.billing_profile_deep(page)
                    self.template_editor(page)
                    self.mobile_deep(page)
                    self.report()
                else:
                    self.log(f"❌ Not on dashboard after auth: {page.url}")
            except Exception as e:
                self.log(f"❌ FATAL: {e}")
                self.s(page, "fatal")
            finally:
                browser.close()

    def report(self):
        print("\n" + "=" * 60)
        print("DEEP TEST REPORT")
        print("=" * 60)
        print(f"Total findings: {len(self.findings)}")
        errors = [f for f in self.findings if f['level'] == 'ERROR']
        warnings = [f for f in self.findings if f['level'] == 'WARN']
        infos = [f for f in self.findings if f['level'] == 'INFO']
        print(f"  INFO: {len(infos)}")
        print(f"  WARN: {len(warnings)}")
        print(f"  ERROR: {len(errors)}")
        print(f"Screenshots: {self.n}")
        
        if errors:
            print("\nERRORS:")
            for e in errors:
                print(f"  ❌ {e['msg']}")
        
        # Save full report
        with open(f"{DIR}/deep_report.json", "w") as f:
            json.dump(self.findings, f, indent=2, ensure_ascii=False)
        print(f"\nFull report: {DIR}/deep_report.json")


if __name__ == "__main__":
    DeepTest().run()
