import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import re


def _normalize_url(url: str) -> str:
    """Convert a Google Maps place URL to a search URL for reliable loading.
    
    Google Maps strips place data parameters in automated browsers, causing
    the place panel not to load. Using a search URL forces Google to resolve
    the place via search, which works reliably.
    """
    # Extract place name from URL path: /maps/place/Some+Place+Name/@...
    match = re.search(r'/maps/place/([^/@]+)', url)
    if match:
        place_name = match.group(1).replace('+', ' ').replace('%20', ' ')
        return f"https://www.google.com/maps/search/{match.group(1)}"
    # If it's already a search URL or unrecognized format, use as-is
    return url


def _get_chrome_version() -> int:
    """Detect installed Chrome major version."""
    import subprocess
    try:
        out = subprocess.check_output(
            ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "--version"],
            stderr=subprocess.DEVNULL, text=True
        )
        ver = re.search(r'(\d+)\.', out)
        return int(ver.group(1)) if ver else None
    except Exception:
        return None


def scrape_google_reviews(url: str, max_reviews: int):
    options = uc.ChromeOptions()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-notifications")
    options.add_argument("--lang=en-US")

    chrome_ver = _get_chrome_version()
    driver = uc.Chrome(options=options, use_subprocess=True,
                       **({"version_main": chrome_ver} if chrome_ver else {}))
    extracted_data = []

    try:
        # Normalize URL to search format for reliable loading
        search_url = _normalize_url(url)
        print(f"Scraping {search_url} for {max_reviews} reviews...")
        driver.get(search_url)
        time.sleep(8)

        # Click the "Reviews" tab
        reviews_tab_clicked = False
        reviews_tab_xpaths = [
            "//button[@role='tab' and contains(., 'Review')]",
            "//button[contains(@aria-label, 'Reviews') or contains(@aria-label, 'reviews')]",
            "//div[@role='tablist']//button[contains(., 'Review')]",
        ]
        for xpath in reviews_tab_xpaths:
            try:
                reviews_tab = WebDriverWait(driver, 8).until(
                    EC.element_to_be_clickable((By.XPATH, xpath))
                )
                reviews_tab.click()
                reviews_tab_clicked = True
                print(f"Clicked Reviews tab")
                time.sleep(4)
                break
            except:
                continue

        if not reviews_tab_clicked:
            print("Note: Could not click Reviews tab")

        # Find scrollable reviews container
        scrollable_div = None

        # CSS class selectors (Google's obfuscated classes)
        for selector in [
            'div.m6QErb.DxyBCb.kA9KIf.dS8AEf',
            'div.m6QErb.DxyBCb.kA9KIf',
            'div.m6QErb.DxyBCb',
            'div.m6QErb[tabindex]',
        ]:
            try:
                scrollable_div = WebDriverWait(driver, 3).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                )
                print(f"Found scrollable container: {selector}")
                break
            except:
                continue

        # JS fallback: find scrollable panel by overflow style
        if scrollable_div is None:
            try:
                scrollable_div = driver.execute_script("""
                    var divs = document.querySelectorAll('div');
                    for (var d of divs) {
                        var style = window.getComputedStyle(d);
                        if ((style.overflowY === 'auto' || style.overflowY === 'scroll')
                            && d.scrollHeight > d.clientHeight + 100
                            && d.querySelectorAll('span.wiI7pd').length > 0) {
                            return d;
                        }
                    }
                    return null;
                """)
                if scrollable_div:
                    print("Found scrollable container via JS fallback")
            except:
                pass

        # Ancestor of a review element
        if scrollable_div is None:
            try:
                rev_el = driver.find_element(By.CSS_SELECTOR, 'span.wiI7pd')
                scrollable_div = driver.execute_script("""
                    var el = arguments[0];
                    while (el.parentElement) {
                        el = el.parentElement;
                        var style = window.getComputedStyle(el);
                        if ((style.overflowY === 'auto' || style.overflowY === 'scroll')
                            && el.scrollHeight > el.clientHeight) {
                            return el;
                        }
                    }
                    return null;
                """, rev_el)
                if scrollable_div:
                    print("Found scrollable container via review ancestor")
            except:
                pass

        if scrollable_div is None:
            print("WARNING: Could not find scrollable container")

        # Scroll to load reviews
        if scrollable_div:
            scrolls = int(max_reviews / 4) + 3
            for i in range(scrolls):
                driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight", scrollable_div)
                time.sleep(1.5)
        else:
            for i in range(5):
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight)")
                time.sleep(1.5)

        # Expand truncated reviews
        try:
            more_buttons = driver.find_elements(By.CSS_SELECTOR, "button.w8nwRe.kyuRq")
            if not more_buttons:
                more_buttons = driver.find_elements(By.XPATH, "//button[contains(@aria-label, 'See more')]")
            if not more_buttons:
                more_buttons = driver.find_elements(By.XPATH, "//button[contains(text(), 'More')]")
            print(f"Expanding {len(more_buttons)} long reviews...")
            for btn in more_buttons:
                try:
                    driver.execute_script("arguments[0].click();", btn)
                except:
                    pass
            time.sleep(1)
        except Exception as e:
            print(f"Note: More buttons error: {e}")

        # Extract review text
        review_elements = driver.find_elements(By.CSS_SELECTOR, 'span.wiI7pd')

        if not review_elements:
            for sel in ['div.MyEned span', '[data-review-id] span', '.review-full-text']:
                review_elements = driver.find_elements(By.CSS_SELECTOR, sel)
                if review_elements:
                    print(f"Found reviews via fallback: {sel}")
                    break

        for i, elem in enumerate(review_elements):
            if i >= max_reviews:
                break
            text = elem.text.strip().replace("\n", " ")
            if text:
                extracted_data.append(text)

        print(f"Extracted {len(extracted_data)} reviews")

    except Exception as e:
        print(f"Scraping Error: {e}")
    finally:
        driver.quit()

    return extracted_data