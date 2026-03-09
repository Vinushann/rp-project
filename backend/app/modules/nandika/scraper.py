from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import time

def scrape_google_reviews(url: str, max_reviews: int):
    options = webdriver.ChromeOptions()
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-notifications")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    extracted_data = []
    
    try:
        print(f"Scraping {url} for {max_reviews} reviews...")
        driver.get(url)
        time.sleep(4)

        # Click the "Reviews" tab to ensure we're in the reviews panel
        try:
            reviews_tab = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(@aria-label, 'Reviews') or contains(@aria-label, 'reviews')]"))
            )
            reviews_tab.click()
            time.sleep(3)
        except Exception as e:
            print(f"Note: Could not click Reviews tab (may already be on reviews): {e}")

        # Find the scrollable reviews container using multiple fallback selectors
        scrollable_div = None
        scroll_selectors = [
            'div.m6QErb.DxyBCb.kA9KIf.dS8AEf',                # Original selector
            'div.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde',         # Variant
            'div.m6QErb.DxyBCb.kA9KIf',                        # Shorter variant
            'div.m6QErb.DxyBCb',                                # Even shorter
            'div.m6QErb[tabindex]',                             # With tabindex attribute
        ]
        
        for selector in scroll_selectors:
            try:
                scrollable_div = WebDriverWait(driver, 5).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                )
                print(f"Found scrollable container with selector: {selector}")
                break
            except:
                continue

        # Last resort: find any scrollable div that contains review text
        if scrollable_div is None:
            try:
                scrollable_div = driver.find_element(By.XPATH, 
                    "//div[contains(@class, 'm6QErb') and contains(@class, 'DxyBCb')]"
                )
                print("Found scrollable container via XPath fallback")
            except:
                # Try to find any element that contains review spans
                try:
                    review_span = driver.find_element(By.CSS_SELECTOR, 'span.wiI7pd')
                    scrollable_div = review_span.find_element(By.XPATH, 
                        "ancestor::div[contains(@class, 'm6QErb')]"
                    )
                    print("Found scrollable container via ancestor of review text")
                except:
                    print("WARNING: Could not find scrollable container, will try extracting reviews without scrolling")

        # 1. SCROLLING (Load the reviews)
        if scrollable_div:
            scrolls = int(max_reviews / 4) + 3
            for i in range(scrolls):
                driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight", scrollable_div)
                time.sleep(1.5)
        else:
            # Fallback: scroll the page itself
            for i in range(5):
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight)")
                time.sleep(1.5)

        # 2. CLICK "MORE" BUTTONS to expand truncated reviews
        try:
            more_buttons = driver.find_elements(By.CSS_SELECTOR, "button.w8nwRe.kyuRq")
            if not more_buttons:
                more_buttons = driver.find_elements(By.XPATH, "//button[contains(@aria-label, 'See more')]")
            if not more_buttons:
                more_buttons = driver.find_elements(By.XPATH, "//button[contains(text(), 'More')]")
            print(f"Expanding {len(more_buttons)} long reviews...")
            for btn in more_buttons:
                driver.execute_script("arguments[0].click();", btn)
            time.sleep(1)
        except Exception as e:
            print(f"Note: No 'More' buttons clicked or error: {e}")

        # 3. EXTRACTION - try multiple selectors for review text
        review_elements = driver.find_elements(By.CSS_SELECTOR, 'span.wiI7pd')
        
        if not review_elements:
            # Fallback selectors
            for sel in ['div.MyEned span', 'div[data-review-id] span.wiI7pd', '.review-full-text']:
                review_elements = driver.find_elements(By.CSS_SELECTOR, sel)
                if review_elements:
                    print(f"Found reviews using fallback selector: {sel}")
                    break
        
        for i, elem in enumerate(review_elements):
            if i >= max_reviews:
                break
            text = elem.text.strip()
            text = text.replace("\n", " ")
            
            if text:
                extracted_data.append(text)
        
        print(f"Extracted {len(extracted_data)} reviews")
                
    except Exception as e:
        print(f"Scraping Error: {e}")
    finally:
        driver.quit()
        
    return extracted_data