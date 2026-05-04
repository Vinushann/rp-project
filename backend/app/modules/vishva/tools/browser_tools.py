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
