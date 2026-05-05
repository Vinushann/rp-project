"""
Google Maps Review Scraper
==========================
Uses undetected-chromedriver to bypass Google's bot detection and
extract real customer reviews from Google Maps.

The implementation:
1. Launches Chrome via undetected-chromedriver (patches ChromeDriver
   to avoid navigator.webdriver detection, TLS fingerprint checks, etc.)
2. Navigates to the Google Maps place URL.
3. Clicks the "Reviews" tab (multiple selector fallbacks).
4. Sorts by "Newest" for the freshest reviews.
5. Scrolls the review pane until the desired number of reviews is loaded.
6. Expands every truncated review ("More" button).
7. Extracts review text via multiple strategies:
   - data-review-id containers + known text selectors
   - JavaScript-based innerText extraction (fallback)
   - aria-label based extraction (last resort)

Returns a dict: { "is_demo": False, "reviews": [str, ...], "note": str }.
Never returns demo/fake data — raises exceptions on failure.
"""

from __future__ import annotations

import os
import re
import time
import logging
from typing import List, Optional

import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    TimeoutException,
    StaleElementReferenceException,
    ElementClickInterceptedException,
    WebDriverException,
    NoSuchElementException,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Selectors — each list is tried in order; first match wins.
# ---------------------------------------------------------------------------

# Containers for individual reviews (most → least specific)
REVIEW_CONTAINER_SELECTORS = [
    "div[data-review-id]",          # most stable — keyed by unique review id
    "div.jftiEf.fontBodyMedium",    # review card class (2024-2025)
    "div[jsaction*='reviewFeedCard']",  # jsaction-based
]

# Text spans inside a review container
REVIEW_TEXT_SELECTORS = [
    "span.wiI7pd",                  # primary review text class
    "div.MyEned span",              # alternate structure
    "span[data-expandable-section]", # expandable reviews
]

# Buttons to open the "Reviews" tab.
# Order: most specific (text match) → least specific (jsaction).
# All selectors below MUST be verified by checking the button text/aria contains
# "review" before clicking — Google Maps tab order varies (Overview/Menu/Reviews/About
# vs Overview/Reviews/About) so positional selectors like data-tab-index are unreliable.
REVIEWS_TAB_XPATH_SELECTORS = [
    # Tab button whose visible text is exactly "Reviews"
    "//button[@role='tab' and (normalize-space(.)='Reviews' or normalize-space(.)='reviews')]",
    # Any tab whose text contains the word Reviews and a review count like "(123)"
    "//button[@role='tab'][.//div[contains(normalize-space(.), 'Reviews')]]",
    # Generic button with text Reviews (fallback)
    "//button[normalize-space(.)='Reviews']",
]
REVIEWS_TAB_SELECTORS = [
    "button[aria-label*='Reviews']",
    "button[aria-label*='reviews']",
    "button[jsaction*='pane.rating.moreReviews']",
    "button[jsaction*='pane.reviewChart.moreReviews']",
]

# Scrollable pane containing reviews
SCROLLABLE_PANE_SELECTORS = [
    "div[role='feed']",
    "div.m6QErb.DxyBCb.kA9KIf.dS8AEf",
    "div.m6QErb.DxyBCb",
    "div.m6QErb",
]

# "More" button to expand truncated review text
MORE_BUTTON_SELECTORS = [
    "button.w8nwRe.kyuRq",          # standard More button
    "button.w8nwRe",                 # broader fallback
    "a.review-more-link",            # alternate
]

# Sort menu selectors
SORT_BUTTON_SELECTORS = [
    "button[aria-label='Sort reviews']",
    "button[aria-label*='Sort']",
    "button[data-value='Sort']",
]


# ---------------------------------------------------------------------------
# Driver setup
# ---------------------------------------------------------------------------

def _get_chrome_version() -> Optional[int]:
    """Auto-detect the installed Chrome major version."""
    import subprocess
    import platform

    try:
        if platform.system() == "Windows":
            # Try registry first (most reliable on Windows)
            import winreg
            for key_path in [
                r"SOFTWARE\Google\Chrome\BLBeacon",
                r"SOFTWARE\WOW6432Node\Google\Chrome\BLBeacon",
            ]:
                try:
                    key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path)
                    version, _ = winreg.QueryValueEx(key, "version")
                    winreg.CloseKey(key)
                    major = int(version.split(".")[0])
                    logger.info("Detected Chrome version %d from registry", major)
                    return major
                except Exception:
                    continue

            # Fallback: try to run chrome --version
            paths = [
                r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            ]
            for path in paths:
                try:
                    result = subprocess.run(
                        [path, "--version"],
                        capture_output=True, text=True, timeout=5
                    )
                    match = re.search(r"(\d+)\.", result.stdout)
                    if match:
                        return int(match.group(1))
                except Exception:
                    continue
        else:
            # Linux/Mac
            for cmd in ["google-chrome", "chromium-browser", "chrome"]:
                try:
                    result = subprocess.run(
                        [cmd, "--version"],
                        capture_output=True, text=True, timeout=5
                    )
                    match = re.search(r"(\d+)\.", result.stdout)
                    if match:
                        return int(match.group(1))
                except Exception:
                    continue
    except Exception as e:
        logger.debug("Chrome version detection failed: %s", e)

    return None


def _build_driver() -> uc.Chrome:
    """
    Create an undetected Chrome instance with a persistent profile.
    undetected-chromedriver automatically:
      - Patches the chromedriver binary
      - Removes navigator.webdriver flag
      - Randomises CDP fingerprints

    We use a persistent user-data-dir so that Google's consent cookies
    are preserved across runs, preventing the "limited view" restriction.
    """
    import tempfile

    options = uc.ChromeOptions()

    # Run non-headless so Google Maps renders the full DOM.
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-notifications")
    options.add_argument("--disable-popup-blocking")
    options.add_argument("--window-size=1400,1000")
    # Force English UI so our English-language selectors match.
    options.add_argument("--lang=en-US")
    options.add_experimental_option(
        "prefs", {"intl.accept_languages": "en-US,en"}
    )

    # Use a persistent profile directory so cookies/consent persist
    profile_dir = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), ".chrome_profile"
    )
    os.makedirs(profile_dir, exist_ok=True)
    options.add_argument(f"--user-data-dir={profile_dir}")

    # Auto-detect Chrome version to avoid version mismatch
    chrome_version = _get_chrome_version()
    if chrome_version:
        print(f"  Detected Chrome version: {chrome_version}")
        driver = uc.Chrome(options=options, version_main=chrome_version)
    else:
        print("  Could not detect Chrome version, letting UC auto-detect...")
        driver = uc.Chrome(options=options)

    return driver


# ---------------------------------------------------------------------------
# Consent / cookie banner dismissal + "limited view" bypass
# ---------------------------------------------------------------------------

def _set_google_consent_cookies(driver) -> None:
    """
    Set Google consent cookies to bypass the consent screen and avoid
    the 'limited view of Google Maps' restriction.
    This pre-warms the browser with a visit to google.com first.
    """
    try:
        # Navigate to google.com to establish the domain for cookies
        driver.get("https://www.google.com")
        time.sleep(2)

        # Set the SOCS consent cookie (opts out of consent screen)
        # This is the standard Google consent cookie format
        driver.add_cookie({
            "name": "SOCS",
            "value": "CAISHAgCEhJnd3NfMjAyNDA1MDItMF9SQzIaAmVuIAEaBgiA_ZS2Bg",
            "domain": ".google.com",
            "path": "/",
        })
        # Set CONSENT cookie as well
        driver.add_cookie({
            "name": "CONSENT",
            "value": "PENDING+987",
            "domain": ".google.com",
            "path": "/",
        })
        print("  Google consent cookies set")
    except Exception as e:
        logger.debug("Could not set consent cookies: %s", e)


def _dismiss_consent(driver) -> None:
    """Click the cookie / consent banner if it appears."""
    consent_labels = [
        "Accept all", "I agree", "Reject all",
        "Alle akzeptieren", "Tout accepter",
    ]
    for label in consent_labels:
        try:
            xpath = (
                f"//button[.//span[normalize-space()='{label}'] "
                f"or normalize-space()='{label}']"
            )
            buttons = driver.find_elements(By.XPATH, xpath)
            for btn in buttons:
                if btn.is_displayed():
                    btn.click()
                    time.sleep(1)
                    return
        except Exception:
            continue


def _dismiss_limited_view(driver) -> None:
    """Dismiss the 'You're seeing a limited view' banner and sign-in prompt."""
    try:
        # Check for "limited view" notice
        body_text = driver.find_element(By.TAG_NAME, "body").text
        if "limited view" in body_text.lower():
            print("  Detected 'limited view' — attempting to dismiss...")
            # Try clicking "Sign in" to dismiss the banner (Google sometimes
            # shows full content after dismissing the overlay)
            # Or try closing any overlays
            close_btns = driver.find_elements(
                By.CSS_SELECTOR,
                "button[aria-label='Close'], button[aria-label='Dismiss'], "
                "button.VfPpkd-Bz112c-LgbsSe"
            )
            for btn in close_btns:
                try:
                    if btn.is_displayed():
                        btn.click()
                        time.sleep(1)
                except Exception:
                    continue

            # Also try the "Learn more" link's parent dismissal
            learn_more = driver.find_elements(
                By.XPATH, "//a[contains(text(), 'Learn more')]"
            )
            for link in learn_more:
                try:
                    parent = link.find_element(By.XPATH, "./..")
                    # Try to hide the limited view banner via JS
                    driver.execute_script(
                        "arguments[0].style.display='none';", parent
                    )
                except Exception:
                    pass
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Reviews tab navigation
# ---------------------------------------------------------------------------

def _review_feed_present(driver) -> bool:
    """Check whether the Reviews feed has rendered (i.e. the tab is actually active)."""
    try:
        # The reviews feed has role='feed' once the Reviews tab is selected
        feeds = driver.find_elements(By.CSS_SELECTOR, "div[role='feed']")
        if feeds:
            return True
        # Fallback: look for review containers
        for sel in REVIEW_CONTAINER_SELECTORS:
            if driver.find_elements(By.CSS_SELECTOR, sel):
                return True
    except Exception:
        pass
    return False


def _click_element_safely(driver, elem) -> bool:
    """Scroll to and click an element, falling back to JS click. Returns True if click succeeded."""
    try:
        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", elem)
        time.sleep(0.3)
        try:
            elem.click()
        except (ElementClickInterceptedException, WebDriverException):
            driver.execute_script("arguments[0].click();", elem)
        return True
    except (StaleElementReferenceException, WebDriverException):
        return False


def _is_reviews_button(elem) -> bool:
    """Verify a candidate element actually opens the Reviews tab.
    Must contain the word "review" in its label OR text — and must NOT be a
    secondary control like 'Sort reviews', 'Write a review', or 'More reviews'."""
    try:
        aria = (elem.get_attribute("aria-label") or "").strip().lower()
        text = (elem.text or "").strip().lower()
    except StaleElementReferenceException:
        return False

    # Disqualify secondary review controls
    blocklist = ["sort", "write a review", "more reviews", "filter", "search reviews"]
    for bad in blocklist:
        if bad in aria or bad in text:
            return False

    # Must mention "review" somewhere
    return "review" in aria or "review" in text


def _click_reviews_tab(driver) -> bool:
    """Activate the Reviews tab in the place sidebar.
    Returns True only if the click successfully navigated to the Reviews tab
    (verified by the review feed being present afterwards)."""
    # Strategy A: XPath-based text matching (most reliable across locales/layouts)
    for xpath in REVIEWS_TAB_XPATH_SELECTORS:
        try:
            elements = driver.find_elements(By.XPATH, xpath)
            for elem in elements:
                if not _is_reviews_button(elem):
                    continue
                if not _click_element_safely(driver, elem):
                    continue
                time.sleep(2.5)
                if _review_feed_present(driver):
                    logger.info("Clicked Reviews tab via XPath: %s", xpath)
                    return True
        except Exception:
            continue

    # Strategy B: CSS selectors with strict label verification
    for selector in REVIEWS_TAB_SELECTORS:
        try:
            elements = driver.find_elements(By.CSS_SELECTOR, selector)
            for elem in elements:
                if not _is_reviews_button(elem):
                    continue
                if not _click_element_safely(driver, elem):
                    continue
                time.sleep(2.5)
                if _review_feed_present(driver):
                    logger.info("Clicked Reviews tab via CSS: %s", selector)
                    return True
        except Exception:
            continue

    return False


def _try_sort_newest(driver) -> None:
    """Try to sort reviews by 'Newest' for better freshness."""
    try:
        for selector in SORT_BUTTON_SELECTORS:
            btns = driver.find_elements(By.CSS_SELECTOR, selector)
            if btns:
                driver.execute_script("arguments[0].click();", btns[0])
                time.sleep(1.5)
                break
        else:
            # Try the generic sort/filter menu button
            menu_btns = driver.find_elements(
                By.CSS_SELECTOR, "button[aria-label*='Sort'], button[data-value='Sort']"
            )
            if menu_btns:
                driver.execute_script("arguments[0].click();", menu_btns[0])
                time.sleep(1.5)

        # Look for "Newest" option in the sort menu
        newest_options = driver.find_elements(
            By.XPATH,
            "//*[contains(@data-index, '1') or contains(text(), 'Newest') or contains(text(), 'newest')]"
        )
        for opt in newest_options:
            txt = (opt.text or "").lower()
            if "newest" in txt or "recent" in txt:
                driver.execute_script("arguments[0].click();", opt)
                time.sleep(2)
                logger.info("Sorted reviews by Newest")
                return
    except Exception as e:
        logger.debug("Could not sort by newest: %s", e)


# ---------------------------------------------------------------------------
# Scrolling
# ---------------------------------------------------------------------------

def _find_scrollable_pane(driver) -> Optional[object]:
    """Locate the scrollable review pane using multiple selectors."""
    for selector in SCROLLABLE_PANE_SELECTORS:
        try:
            panes = driver.find_elements(By.CSS_SELECTOR, selector)
            for pane in panes:
                # Must be visible and have scroll capability
                height = driver.execute_script(
                    "return arguments[0].scrollHeight", pane
                )
                if height and height > 200:
                    return pane
        except Exception:
            continue
    return None


def _count_reviews(driver) -> int:
    """Count currently loaded review containers."""
    for selector in REVIEW_CONTAINER_SELECTORS:
        count = len(driver.find_elements(By.CSS_SELECTOR, selector))
        if count > 0:
            return count
    return 0


def _scroll_reviews_pane(driver, target_count: int, min_scrolls: int = 3) -> None:
    """Scroll the reviews feed until `target_count` review containers are loaded.

    Key design points:
    - Google Maps pre-loads ~20 containers on page open, so we must NOT exit
      just because current_count >= target on the very first check. We enforce a
      minimum of `min_scrolls` scroll rounds to push past the pre-loaded batch.
    - Stagnation detection resets whenever new containers appear, so we keep
      scrolling as long as the list is still growing.
    """
    pane = _find_scrollable_pane(driver)
    if pane is None:
        logger.warning("No scrollable review pane found — falling back to body scroll")

    def _do_scroll():
        try:
            if pane is not None:
                driver.execute_script(
                    "arguments[0].scrollTop = arguments[0].scrollHeight;", pane
                )
            else:
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        except WebDriverException:
            pass

    # Always do at least min_scrolls rounds so we scroll past the pre-loaded batch
    for _ in range(min_scrolls):
        _do_scroll()
        time.sleep(1.5)

    last_count = _count_reviews(driver)
    stagnant_rounds = 0
    max_rounds = min(target_count * 3, 150)

    for i in range(max_rounds):
        current = _count_reviews(driver)
        print(f"  Scroll round {i+1}: {current}/{target_count} containers loaded")

        if current >= target_count:
            logger.info("Reached target: %d/%d reviews loaded", current, target_count)
            return

        if current == last_count:
            stagnant_rounds += 1
            if stagnant_rounds >= 8:
                logger.info(
                    "No new reviews after %d stagnant rounds (have %d/%d)",
                    stagnant_rounds, current, target_count,
                )
                return
        else:
            stagnant_rounds = 0

        last_count = current
        _do_scroll()
        time.sleep(1.5)


# ---------------------------------------------------------------------------
# Expand truncated reviews
# ---------------------------------------------------------------------------

def _expand_truncated_reviews(driver) -> None:
    """Click every visible 'More' button so review text is not cut off."""
    for selector in MORE_BUTTON_SELECTORS:
        try:
            buttons = driver.find_elements(By.CSS_SELECTOR, selector)
            for btn in buttons:
                try:
                    driver.execute_script("arguments[0].click();", btn)
                except Exception:
                    continue
            if buttons:
                time.sleep(0.5)
        except Exception:
            continue


# ---------------------------------------------------------------------------
# Text extraction — multiple strategies
# ---------------------------------------------------------------------------

def _extract_via_containers(driver, max_reviews: int) -> List[str]:
    """Strategy 1: Find review containers, then extract text spans inside them."""
    texts: List[str] = []
    seen = set()

    for container_sel in REVIEW_CONTAINER_SELECTORS:
        containers = driver.find_elements(By.CSS_SELECTOR, container_sel)
        if not containers:
            continue

        logger.info(
            "Found %d containers with selector: %s",
            len(containers), container_sel
        )

        for container in containers:
            if len(texts) >= max_reviews:
                break

            text = ""
            # Try each text selector
            for text_sel in REVIEW_TEXT_SELECTORS:
                try:
                    spans = container.find_elements(By.CSS_SELECTOR, text_sel)
                    if spans:
                        text = " ".join(
                            s.text.strip() for s in spans if s.text.strip()
                        ).strip()
                        if text:
                            break
                except (StaleElementReferenceException, NoSuchElementException):
                    continue

            # Fallback: use JavaScript to get innerText of the container
            if not text:
                try:
                    raw = driver.execute_script(
                        "return arguments[0].innerText;", container
                    )
                    if raw:
                        # The container text includes reviewer name, date, stars etc.
                        # We try to extract just the review body by looking for
                        # the longest paragraph.
                        lines = [
                            l.strip() for l in raw.split("\n")
                            if l.strip() and len(l.strip()) > 20
                        ]
                        if lines:
                            text = max(lines, key=len)
                except Exception:
                    pass

            if text and len(text) > 10 and text not in seen:
                seen.add(text)
                texts.append(text)

        if texts:
            break  # Found reviews with this container selector

    return texts


def _extract_via_javascript(driver, max_reviews: int) -> List[str]:
    """
    Strategy 2: Use JavaScript to find all review text elements directly.
    This bypasses Selenium's element-finding which can miss dynamically
    rendered content.
    """
    js_script = """
    const results = [];
    const seen = new Set();

    // Strategy A: known text selectors
    const selectors = ['span.wiI7pd', 'div.MyEned span', 'span[data-expandable-section]'];
    for (const sel of selectors) {
        const elems = document.querySelectorAll(sel);
        for (const el of elems) {
            const text = el.innerText?.trim();
            if (text && text.length > 15 && !seen.has(text)) {
                seen.add(text);
                results.push(text);
                if (results.length >= arguments[0]) return results;
            }
        }
        if (results.length > 0) return results;
    }

    // Strategy B: review containers → longest text child
    const containerSels = ['div[data-review-id]', 'div.jftiEf'];
    for (const cSel of containerSels) {
        const containers = document.querySelectorAll(cSel);
        for (const c of containers) {
            const spans = c.querySelectorAll('span');
            let best = '';
            for (const s of spans) {
                const t = s.innerText?.trim();
                if (t && t.length > best.length) best = t;
            }
            if (best && best.length > 15 && !seen.has(best)) {
                seen.add(best);
                results.push(best);
                if (results.length >= arguments[0]) return results;
            }
        }
        if (results.length > 0) return results;
    }

    return results;
    """
    try:
        texts = driver.execute_script(js_script, max_reviews)
        return texts if texts else []
    except Exception as e:
        logger.debug("JS extraction failed: %s", e)
        return []


def _extract_via_aria(driver, max_reviews: int) -> List[str]:
    """
    Strategy 3 (last resort): Find elements with aria-label containing
    review-like content patterns.
    """
    texts = []
    seen = set()
    try:
        # Google Maps sometimes puts review text in aria-label of star containers
        elems = driver.find_elements(
            By.XPATH,
            "//div[@aria-label and string-length(@aria-label) > 50]"
        )
        for el in elems:
            if len(texts) >= max_reviews:
                break
            label = el.get_attribute("aria-label") or ""
            # Filter: must look like a review (contains sentence-like text)
            if len(label) > 30 and "." in label and label not in seen:
                seen.add(label)
                texts.append(label)
    except Exception as e:
        logger.debug("Aria extraction failed: %s", e)
    return texts


def _extract_review_texts(driver, max_reviews: int) -> List[str]:
    """
    Master extraction function — tries multiple strategies in order
    of reliability.
    """
    # Strategy 1: Container-based extraction
    texts = _extract_via_containers(driver, max_reviews)
    if texts:
        logger.info("Strategy 1 (containers) extracted %d reviews", len(texts))
        return texts[:max_reviews]

    # Strategy 2: JavaScript-based extraction
    texts = _extract_via_javascript(driver, max_reviews)
    if texts:
        logger.info("Strategy 2 (JavaScript) extracted %d reviews", len(texts))
        return texts[:max_reviews]

    # Strategy 3: Aria-label extraction
    texts = _extract_via_aria(driver, max_reviews)
    if texts:
        logger.info("Strategy 3 (aria-label) extracted %d reviews", len(texts))
        return texts[:max_reviews]

    return []


# ---------------------------------------------------------------------------
# Scroll the main place panel (for pages without a Reviews tab)
# ---------------------------------------------------------------------------

def _scroll_place_panel(driver) -> None:
    """For place pages without a dedicated Reviews tab, scroll the side panel
    to load inline reviews."""
    try:
        sidebars = driver.find_elements(
            By.CSS_SELECTOR, "div.m6QErb[aria-label]"
        )
        target = None
        for sb in sidebars:
            label = (sb.get_attribute("aria-label") or "").lower()
            if label and "result" not in label:
                target = sb
                break
        if target is None and sidebars:
            target = sidebars[0]
        if target is None:
            return
        for _ in range(8):
            driver.execute_script(
                "arguments[0].scrollTop = arguments[0].scrollHeight;", target
            )
            time.sleep(1.0)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def _wait_for_place_panel(driver, timeout: int = 12) -> bool:
    """Wait for the Google Maps place panel to FULLY load.
    Returns True when the place name heading (h1) is visible - this confirms
    we're on an actual place page, not just a map with a stub sidebar."""
    # We specifically need h1 (place name) to confirm a place is loaded
    place_name_selectors = [
        "h1.DUwDvf",                # standard place name heading
        "h1.fontHeadlineLarge",      # alternate place name
        "h1[data-attrid]",           # another variant
        "div.tAiQdd h1",             # nested in container
    ]
    try:
        WebDriverWait(driver, timeout).until(
            lambda d: any(
                len(d.find_elements(By.CSS_SELECTOR, sel)) > 0
                and d.find_elements(By.CSS_SELECTOR, sel)[0].text.strip()
                for sel in place_name_selectors
            )
        )
        # Log the place name we found
        for sel in place_name_selectors:
            elems = driver.find_elements(By.CSS_SELECTOR, sel)
            if elems and elems[0].text.strip():
                print(f"  Place identified: {elems[0].text.strip()}")
                break
        return True
    except TimeoutException:
        return False


def _extract_place_name_from_url(url: str) -> str:
    """Extract the place name from a Google Maps URL.
    E.g. 'https://www.google.com/maps/place/Shangri-La+Colombo/@6.9,...'
    returns 'Shangri-La Colombo'."""
    match = re.search(r'/place/([^/@?]+)', url)
    if match:
        name = match.group(1)
        # URL-decode: replace + with space, handle %XX
        from urllib.parse import unquote_plus
        return unquote_plus(name)
    return ""


def _search_for_place(driver, place_name: str) -> bool:
    """Use the Google Maps search box to search for the place by name.
    Returns True if a place result was opened."""
    if not place_name:
        return False

    print(f"  Searching Google Maps for: {place_name}")
    try:
        # Find the search box
        search_selectors = [
            "input#searchboxinput",
            "input[aria-label='Search Google Maps']",
            "input[name='q']",
        ]
        search_box = None
        for sel in search_selectors:
            elems = driver.find_elements(By.CSS_SELECTOR, sel)
            if elems:
                search_box = elems[0]
                break

        if not search_box:
            print("  Could not find search box")
            return False

        # Clear and type the place name
        search_box.click()
        time.sleep(0.5)
        search_box.clear()
        time.sleep(0.3)
        search_box.send_keys(place_name)
        time.sleep(0.5)
        search_box.send_keys(Keys.RETURN)
        time.sleep(4)

        # Check if we landed on a place page directly
        if _wait_for_place_panel(driver, timeout=8):
            return True

        # If we got search results instead, click the first one
        return _handle_search_results(driver)

    except Exception as e:
        print(f"  Search failed: {e}")
        return False


def _handle_search_results(driver) -> bool:
    """If the URL landed on a search results page instead of a single place,
    click the first result to navigate to a place page.
    Returns True if a result was clicked."""
    try:
        result_selectors = [
            "a.hfpxzc",              # place result link
            "div.Nv2PK a",           # result card link
            "a[href*='/maps/place/']", # any link to a place
        ]
        for sel in result_selectors:
            results = driver.find_elements(By.CSS_SELECTOR, sel)
            if results:
                driver.execute_script("arguments[0].click();", results[0])
                time.sleep(3)
                print("  Clicked first search result to navigate to place")
                return True
    except Exception:
        pass
    return False


def _build_reviews_direct_url(url: str) -> Optional[str]:
    """
    Transform a Google Maps place URL so it opens directly on the Reviews tab.

    Google Maps interprets a `!9m1!1b1` segment inside the `data=` parameter as
    "open this place's reviews tab". This bypasses the need to find and click
    the Reviews tab in the DOM (which can fail if the limited-view banner
    blocks interaction or the tab order changes).

    Returns a transformed URL, or None if the input URL is not a place URL we
    can confidently rewrite.
    """
    if "/maps/place/" not in url:
        return None

    # If the URL already targets reviews, leave it alone
    if "!9m1!1b1" in url:
        return url

    try:
        # Split off the query string (?entry=ttu&g_ep=...) — preserve it
        if "?" in url:
            base, query = url.split("?", 1)
            query = "?" + query
        else:
            base, query = url, ""

        # The data= segment looks like: data=!4m14!1m7!3m6!...
        # Insert !9m1!1b1 immediately after `data=` so it applies to the place node.
        # Pattern: /data=!Nm... -> /data=!9m1!1b1!Nm...
        if "/data=" in base:
            new_base = re.sub(
                r"(/data=)(!\d+m\d+)",
                r"\g<1>!9m1!1b1\g<2>",
                base,
                count=1,
            )
            if new_base != base:
                return new_base + query

        # No /data= segment — append one
        sep = "" if base.endswith("/") else "/"
        return f"{base}{sep}data=!9m1!1b1{query}"
    except Exception:
        return None


def _clean_review_text(text: str) -> str:
    """Clean up extracted review text, removing common noise patterns."""
    if not text:
        return ""
    # Remove common Google Maps UI text fragments
    noise_patterns = [
        r"^Map\s*·",
        r"Use arrow keys",
        r"Get details about",
        r"pressing its corresponding",
        r"^Directions$",
        r"^Save$",
        r"^Share$",
        r"^Nearby$",
        r"^Send to",
        r"^Photos?$",
        r"^Overview$",
        r"^Reviews?$",
        r"^About$",
        r"^More info$",
        r"^\d+ reviews?$",
        r"^\d+\.\d+ stars?$",
        r"^Like$",
        r"^Reply$",
        r"^Report$",
        r"^\d+ (?:days?|weeks?|months?|years?) ago$",
        r"^[A-Z][a-z]+ [A-Z][a-z]+$",  # Looks like just a name (2 words)
        r"^Local Guide\s*·",
        r"^Owner's response",
        r"^Response from the owner",
    ]
    for pattern in noise_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return ""
    return text.strip()


def scrape_google_reviews(url: str, max_reviews: int) -> dict:
    """
    Scrape real reviews from a Google Maps place URL.

    Args:
        url: A Google Maps place URL.
        max_reviews: Maximum number of reviews to scrape.

    Returns:
        {
          "is_demo": False,
          "reviews": [str, ...],
          "note": str,
        }

    Raises:
        RuntimeError: When no reviews could be extracted after all strategies.
    """
    print(f"Scraping {url} for up to {max_reviews} reviews...")
    driver = None
    try:
        driver = _build_driver()

        # Always load the original URL first. The `!9m1!1b1` rewrite was tried
        # as a fast-path but empirically triggers Google's limited-view layout
        # (which hides the Reviews tab entirely). The direct-reviews URL is
        # kept only as a last-resort fallback if clicking the tab fails.
        direct_url = _build_reviews_direct_url(url)
        driver.get(url)

        # Wait for page load
        try:
            WebDriverWait(driver, 15).until(
                lambda d: d.execute_script("return document.readyState") == "complete"
            )
        except TimeoutException:
            pass
        time.sleep(4)

        _dismiss_consent(driver)

        # Wait for the place panel (with h1 name) to fully load
        panel_loaded = _wait_for_place_panel(driver, timeout=10)
        print(f"  Place panel loaded: {panel_loaded}")

        if not panel_loaded:
            # The URL didn't resolve to a place page. Try two strategies:
            # 1. Click a search result if we're on a results page
            clicked_result = _handle_search_results(driver)
            if clicked_result:
                panel_loaded = _wait_for_place_panel(driver, timeout=8)
                print(f"  Place panel loaded after clicking result: {panel_loaded}")

            # 2. Extract place name from URL and search for it
            if not panel_loaded:
                place_name = _extract_place_name_from_url(url)
                if place_name:
                    searched = _search_for_place(driver, place_name)
                    if searched:
                        panel_loaded = _wait_for_place_panel(driver, timeout=8)
                        print(f"  Place panel loaded after search: {panel_loaded}")

        # ---- Navigate to Reviews ----
        # Always click the Reviews tab if we can find one. Don't trust
        # `_review_feed_present` as a "we're already there" signal — the
        # Overview tab also shows a small reviews preview feed, but only
        # the dedicated Reviews tab has the full scrollable list.
        clicked = _click_reviews_tab(driver)
        print(f"  Reviews tab clicked: {clicked}")

        if not clicked:
            # Some pages embed reviews inline — scroll the side panel
            _scroll_place_panel(driver)
            time.sleep(2)
            # Retry after panel hydration
            clicked = _click_reviews_tab(driver)
            print(f"  Reviews tab clicked (retry): {clicked}")

        # If the click failed but a feed is visible (e.g. Overview preview),
        # accept it — we'll extract whatever reviews are loaded.
        if not clicked and _review_feed_present(driver):
            clicked = True
            print(f"  Reviews tab not clicked but feed is present — proceeding")

        # Last resort: navigate to the direct-reviews URL. This forces
        # the tab open even if the click verification kept failing, at
        # the cost of sometimes triggering limited-view.
        if not clicked and direct_url and direct_url != url:
            print(f"  Falling back to direct-reviews URL navigation")
            driver.get(direct_url)
            time.sleep(4)
            clicked = _review_feed_present(driver)
            print(f"  Review feed present after direct-URL fallback: {clicked}")

        time.sleep(2)

        # Try to sort by Newest (best effort)
        if clicked:
            _try_sort_newest(driver)

        # ---- Scroll to load reviews ----
        # Request 3× the target — Google pre-loads ~20 containers so if the
        # user wants 20 reviews, _count_reviews() already returns 20 and the
        # old code exited immediately. Tripling the target forces enough scroll
        # rounds to surface the requested number of extractable reviews.
        _scroll_reviews_pane(driver, max_reviews * 3, min_scrolls=max(3, max_reviews // 5))

        # ---- Expand truncated reviews ----
        _expand_truncated_reviews(driver)

        # ---- Extract review texts ----
        raw_reviews = _extract_review_texts(driver, max_reviews * 2)  # get extra to filter

        # Clean and filter reviews
        reviews = []
        seen = set()
        for text in raw_reviews:
            cleaned = _clean_review_text(text)
            if cleaned and len(cleaned) > 15 and cleaned not in seen:
                seen.add(cleaned)
                reviews.append(cleaned)
                if len(reviews) >= max_reviews:
                    break

        if reviews:
            print(f"Extracted {len(reviews)} real reviews")
            return {
                "is_demo": False,
                "reviews": reviews,
                "note": (
                    f"Successfully scraped {len(reviews)} reviews."
                    if len(reviews) >= max_reviews
                    else f"Found {len(reviews)} reviews (fewer than the requested {max_reviews} - "
                         f"the place may have fewer reviews available)."
                ),
            }

        # If we get here, all extraction strategies failed
        # Take a diagnostic screenshot for debugging
        try:
            import os
            debug_dir = os.path.dirname(os.path.abspath(__file__))
            screenshot_path = os.path.join(debug_dir, "debug_screenshot.png")
            driver.save_screenshot(screenshot_path)
            print(f"Debug screenshot saved to: {screenshot_path}")
        except Exception:
            pass

        # Log page state for debugging
        try:
            body_text = driver.find_element(By.TAG_NAME, "body").text
            print(f"Page body text length: {len(body_text)} chars")
            print(f"Page title: {driver.title}")
            if body_text:
                print(f"Body preview: {body_text[:500]}")
        except Exception:
            pass

        raise RuntimeError(
            "Could not extract any reviews from the provided URL. "
            "Possible reasons: the place has no reviews, the URL is invalid, "
            "or Google Maps changed its DOM structure. "
            "Try using a URL that directly opens a place with reviews."
        )

    except RuntimeError:
        # Re-raise our own errors
        raise
    except Exception as exc:
        print(f"Scraping error: {exc}")
        import traceback
        traceback.print_exc()
        raise RuntimeError(
            f"Scraper error: {exc}. "
            f"Make sure Google Chrome is installed and the URL is a valid Google Maps place link."
        ) from exc
    finally:
        if driver is not None:
            try:
                driver.quit()
            except Exception:
                pass
            print("Browser closed")
