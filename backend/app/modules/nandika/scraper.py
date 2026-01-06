from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time

def scrape_google_reviews(url: str, max_reviews: int):
    options = webdriver.ChromeOptions()
    # options.add_argument("--headless") # Keep commented out for debugging
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    extracted_data = []
    
    try:
        print(f"Scraping {url} for {max_reviews} reviews...")
        driver.get(url)
        time.sleep(3) 

        # 1. SCROLLING (Load the reviews)
        scrollable_div = driver.find_element(By.CSS_SELECTOR, 'div.m6QErb.DxyBCb.kA9KIf.dS8AEf')
        # Scroll enough times to load the requested number of reviews
        # (Roughly 1 scroll per 4 reviews)
        scrolls = int(max_reviews / 4) + 2
        
        for _ in range(scrolls):
            driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight", scrollable_div)
            time.sleep(1.5)

        # 2. CLICK "MORE" BUTTONS (The Fix)
        # We find all buttons that say "More" and click them to expand the text
        try:
            more_buttons = driver.find_elements(By.CSS_SELECTOR, "button.w8nwRe.kyuRq")
            print(f"Expanding {len(more_buttons)} long reviews...")
            for btn in more_buttons:
                # Use JavaScript click because standard click can be intercepted
                driver.execute_script("arguments[0].click();", btn)
            time.sleep(1) # Wait for text to expand
        except Exception as e:
            print(f"Note: No 'More' buttons clicked or error: {e}")

        # 3. EXTRACTION
        review_elements = driver.find_elements(By.CSS_SELECTOR, 'span.wiI7pd')
        
        for i, elem in enumerate(review_elements):
            if i >= max_reviews:
                break
            text = elem.text.strip()
            # Clean up newlines for cleaner output
            text = text.replace("\n", " ")
            
            if text:
                extracted_data.append(text)
                
    except Exception as e:
        print(f"Scraping Error: {e}")
    finally:
        driver.quit()
        
    return extracted_data