import asyncio

async def get_visible_text(page):
    try:
        data = await page.evaluate('''() => {
            const isVisible = (elem) => {
                if (!elem) return false;
                const style = window.getComputedStyle(elem);
                return style.display !== 'none' && 
                       style.visibility !== 'hidden' && 
                       style.opacity !== '0' && 
                       elem.offsetWidth > 0 && 
                       elem.offsetHeight > 0;
            };

            const headings = new Set();
            document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
                if (isVisible(el)) {
                    const text = el.innerText.trim();
                    if (text) headings.add(text);
                }
            });

            const buttons = new Set();
            document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]').forEach(el => {
                if (isVisible(el)) {
                    const text = (el.innerText || el.value || '').trim();
                    if (text && text.length < 100) buttons.add(text);
                }
            });

            const bodyTexts = new Set();
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while ((node = walker.nextNode())) {
                const parent = node.parentElement;
                if (parent && isVisible(parent)) {
                    const text = node.nodeValue.trim();
                    if (text && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) {
                        bodyTexts.add(text);
                    }
                }
            }
            
            return {
                headings: Array.from(headings),
                buttons: Array.from(buttons),
                visible_text_sample: Array.from(bodyTexts).join(' ').substring(0, 2000).trim()
            };
        }''')
        return data
    except Exception:
        return {"headings": [], "buttons": [], "visible_text_sample": ""}

async def scroll_page(page):
    try:
        prev_height = await page.evaluate('document.body.scrollHeight')
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
        
        try:
            await page.wait_for_timeout(2000)
            await page.wait_for_load_state('domcontentloaded', timeout=2000)
        except Exception:
            pass
            
        new_height = await page.evaluate('document.body.scrollHeight')
        
        return {"new_content": new_height > prev_height}
    except Exception:
        return {"new_content": False}

async def get_visual_layout(page):
    """
    Extracts the visual layout of the page, including bounding boxes for 
    headings and text blocks, to help the model understand spatial context.
    """
    try:
        data = await page.evaluate('''() => {
            const layout = [];
            
            // Extract all text-bearing elements with their coordinates
            const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div, li, td');
            
            elements.forEach(el => {
                const rect = el.getBoundingClientRect();
                const text = el.innerText.trim();
                
                // Only keep visible elements with meaningful text
                if (text && rect.width > 0 && rect.height > 0 && text.length < 500) {
                    const style = window.getComputedStyle(el);
                    layout.push({
                        text: text,
                        tag: el.tagName,
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                        fontSize: style.fontSize,
                        fontWeight: style.fontWeight,
                        color: style.color
                    });
                }
            });
            
            // Sort by Y position then X position
            return layout.sort((a, b) => (a.y - b.y) || (a.x - b.x));
        }''')
        return data
    except Exception as e:
        print(f"[WARNING] Layout extraction failed: {e}")
        return []

async def click_element(page, text):
    try:
        clean_text = text.strip()
        if not clean_text or len(clean_text) > 100:
            return {"clicked": None}

        for exact in [True, False]:
            for role in ["button", "link"]:
                try:
                    locator = page.get_by_role(role, name=clean_text, exact=exact)
                    count = await locator.count()
                    for i in range(count):
                        loc = locator.nth(i)
                        if await loc.is_visible():
                            await loc.scroll_into_view_if_needed(timeout=2000)
                            clicked_text = await loc.inner_text()
                            await loc.click(timeout=3000)
                            return {"clicked": clicked_text.strip()}
                except Exception:
                    continue

        return {"clicked": None}
    except Exception:
        return {"clicked": None}

async def get_category_links(page):
    """
    Identifies links that likely lead to category pages or menu sections.
    Looks for links in nav bars, sidebars, or with specific text.
    """
    try:
        links = await page.evaluate('''() => {
            const results = [];
            const seen = new Set();
            const currentOrigin = window.location.origin;
            
            // Keywords that suggest a category/menu/product page
            const catRegex = /category|menu|section|product|type|kind|shop|catalogue|item|list|category/i;
            
            // Keywords to explicitly avoid
            const blockRegex = /about|story|contact|history|location|privacy|terms|cart|account|login|signup|news|blog|event|career|job|help|faq|policy/i;
            
            document.querySelectorAll('a').forEach(a => {
                const href = a.href;
                const text = a.innerText.trim();
                
                if (href && text && !seen.has(href) && href.startsWith(currentOrigin) && href !== window.location.href + '#' && href !== window.location.href) {
                    const isNav = a.closest('nav') || a.closest('.nav') || a.closest('.navigation') || a.closest('.sidebar') || a.closest('.menu-container');
                    const hasKeyword = catRegex.test(href) || catRegex.test(text);
                    const isBlocked = blockRegex.test(href) || blockRegex.test(text);
                    
                    // High probability if it's in nav or has keywords, AND not blocked
                    if (!isBlocked && ((isNav && text.length < 30) || (hasKeyword && text.length < 40))) {
                        results.push({ href, text });
                        seen.add(href);
                    }
                }
            });
            return results;
        }''')
        return links
    except Exception as e:
        print(f"[WARNING] Link discovery failed: {e}")
        return []
