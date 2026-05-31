#!/usr/bin/env python3
"""
Platform test automation script
Tests the platform UI as a new user would discover it.
"""

from playwright.sync_api import sync_playwright
import sys
import time
import os

def test_platform_ui():
    """
    Test the platform UI by navigating through key pages as a new user
    """
    # ===== CONFIGURATION =====
    # Change this to your actual platform URL
    BASE_URL = "https://sahla4eco.com"  # Live production platform
    
    # For local testing, use:
    # BASE_URL = "http://localhost:5173"  # Vite dev server
    # BASE_URL = "http://localhost:8080"  # Express server
    
    HEADLESS = False  # Set to True for headless mode (no GUI)
    SCREENSHOT_DIR = "platform_test_screenshots"
    # ===== END CONFIGURATION =====
    
    # Create screenshot directory
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=HEADLESS)
        context = browser.new_context(
            viewport={'width': 1280, 'height': 720}
        )
        page = context.new_page()
        
        try:
            print(f"Testing platform at {BASE_URL}")
            
            # Test 1: Navigate to homepage
            print("\n1. Testing homepage access...")
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60000)
            time.sleep(5)
            page.screenshot(path=f"{SCREENSHOT_DIR}/01_homepage.png")
            print(f"   ✓ Homepage loaded: {page.url}")
            
            # Check if we're redirected to login (if not authenticated)
            current_url = page.url
            print(f"   Current URL: {current_url}")
            
            # Test 2: Navigate to login page
            print("\n2. Testing login page...")
            login_url = f"{BASE_URL}/login"
            page.goto(login_url, wait_until="domcontentloaded", timeout=60000)
            time.sleep(5)
            page.screenshot(path=f"{SCREENSHOT_DIR}/02_login_page.png")
            print("   ✓ Login page loaded")
            
            # Check for login form elements
            email_input = page.query_selector('input[name="email"], input[type="email"]')
            password_input = page.query_selector('input[name="password"], input[type="password"]')
            if email_input and password_input:
                print("   ✓ Login form fields found")
            else:
                print("   ⚠ Login form fields not found with common selectors")
            
            # Test 3: Navigate to signup page
            print("\n3. Testing signup page...")
            signup_url = f"{BASE_URL}/signup"
            page.goto(signup_url, wait_until="domcontentloaded", timeout=60000)
            time.sleep(5)
            page.screenshot(path=f"{SCREENSHOT_DIR}/03_signup_page.png")
            print("   ✓ Signup page loaded")
            
            # Test 4: Navigate to pricing page
            print("\n4. Testing pricing page...")
            pricing_url = f"{BASE_URL}/pricing"
            page.goto(pricing_url, wait_until="domcontentloaded", timeout=60000)
            time.sleep(5)
            page.screenshot(path=f"{SCREENSHOT_DIR}/04_pricing_page.png")
            print("   ✓ Pricing page loaded")
            
            # Test 5: Test responsive design - mobile view
            print("\n5. Testing responsive design...")
            page.set_viewport_size({"width": 375, "height": 667})  # iPhone size
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60000)
            time.sleep(5)
            page.screenshot(path=f"{SCREENSHOT_DIR}/05_mobile_view.png")
            print("   ✓ Mobile view tested")
            
            # Reset to desktop
            page.set_viewport_size({"width": 1280, "height": 720})
            
            # Test 6: Check navigation elements
            print("\n6. Testing navigation elements...")
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60000)
            time.sleep(5)
            
            # Look for common navigation elements
            nav_selectors = [
                'nav',
                '.navbar',
                '[data-testid="nav"]',
                'header',
                '.header'
            ]
            
            nav_found = False
            for selector in nav_selectors:
                if page.query_selector(selector):
                    print(f"   ✓ Navigation element found: {selector}")
                    nav_found = True
                    break
            
            if not nav_found:
                print("   ⚠ No common navigation elements found")
            
            page.screenshot(path=f"{SCREENSHOT_DIR}/06_navigation.png")
            
            print(f"\n✓ Platform UI test completed! Screenshots saved in '{SCREENSHOT_DIR}/'")
            print("  Review the screenshots to see how the platform appears to new users.")
            
        except Exception as e:
            print(f"Error during platform test: {e}")
            # Take screenshot on error for debugging
            try:
                page.screenshot(path=f"{SCREENSHOT_DIR}/error.png")
                print("Error screenshot saved")
            except:
                pass
            raise
            
        finally:
            # Keep browser open for a moment to see final state, then close
            print("\nKeeping browser open for 10 seconds for manual inspection...")
            time.sleep(10)
            browser.close()

if __name__ == "__main__":
    test_platform_ui()