#!/usr/bin/env python3
"""
Browser automation boilerplate script
Opens a website, fills a form, and clicks a submit button.
"""

from playwright.sync_api import sync_playwright
import sys
import time

def automate_website():
    """
    Main automation function - customize the URL, selectors, and values below
    """
    # ===== CUSTOMIZE THESE VALUES FOR YOUR USE CASE =====
    TARGET_URL = "https://example.com/login"  # Change to your target website
    
    # Form field selectors and values
    FORM_FIELDS = {
        "input[name='username']": "your_username_here",  # Change selector and value
        "input[name='password']": "your_password_here",  # Change selector and value
        # Add more fields as needed:
        # "input[name='email']": "user@example.com",
        # "textarea[name='message']": "Hello World",
    }
    
    # Submit button selector
    SUBMIT_BUTTON_SELECTOR = "button[type='submit']"  # Change as needed
    
    # Whether to run in headless mode (True for no GUI, False for visible browser)
    HEADLESS = False
    # ===== END CUSTOMIZATION =====
    
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=HEADLESS)
        page = browser.new_page()
        
        try:
            print(f"Navigating to {TARGET_URL}...")
            page.goto(TARGET_URL, wait_until="networkidle")
            print("Page loaded successfully")
            
            # Fill form fields
            print("Filling form fields...")
            for selector, value in FORM_FIELDS.items():
                print(f"  Filling {selector} with '{value}'")
                page.fill(selector, value)
                time.sleep(0.5)  # Small delay between fields
            
            # Click submit button
            print(f"Clicking submit button: {SUBMIT_BUTTON_SELECTOR}")
            page.click(SUBMIT_BUTTON_SELECTOR)
            
            # Wait for navigation or result
            print("Waiting for response...")
            page.wait_for_load_state("networkidle")
            time.sleep(2)  # Additional wait to see result
            
            # Optional: Take a screenshot
            page.screenshot(path="result.png")
            print("Screenshot saved as result.png")
            
            print("Automation completed successfully!")
            
        except Exception as e:
            print(f"Error during automation: {e}")
            # Take screenshot on error for debugging
            try:
                page.screenshot(path="error.png")
                print("Error screenshot saved as error.png")
            except:
                pass
            raise
            
        finally:
            # Keep browser open for a moment to see result, then close
            print("Closing browser in 5 seconds...")
            time.sleep(5)
            browser.close()

if __name__ == "__main__":
    automate_website()