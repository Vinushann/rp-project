async def is_menu_visible(page) -> bool:
    return await page.evaluate('''() => {
        const text = document.body.innerText.toLowerCase();
        
        // Look for common currency symbols or price patterns
        const priceRegex = /(?:rs\.?|lkr|\\$|€|£)\\s*\\d+(?:[.,]\\d{2})?|\\d+\\s*(?:lkr|rs)/gi;
        const prices = text.match(priceRegex);
        const hasPrices = prices && prices.length >= 3;
        
        // Check for headings
        const headings = document.querySelectorAll('h1, h2, h3, h4, .category, .title');
        let visibleHeadings = 0;
        headings.forEach(h => {
            if (h.offsetWidth > 0 && h.offsetHeight > 0) visibleHeadings++;
        });
        
        // Check for lists or grid containers
        const lists = document.querySelectorAll('ul, ol, .menu, .grid, .list');
        let visibleContainers = 0;
        lists.forEach(l => {
            if (l.offsetWidth > 0 && l.offsetHeight > 0) visibleContainers++;
        });
        
        // Ensure menu structure is present and looks sufficiently loaded
        return (hasPrices && visibleHeadings >= 1 && visibleContainers >= 1) || (prices && prices.length >= 10);
    }''')


async def extract_visible_sections(page) -> dict:
    sections = await page.evaluate('''() => {
        const isVisible = (elem) => {
            if (!elem) return false;
            const style = window.getComputedStyle(elem);
            return style.display !== 'none' && 
                   style.visibility !== 'hidden' && 
                   style.opacity !== '0' && 
                   elem.offsetWidth > 0 && 
                   elem.offsetHeight > 0;
        };

        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, strong'));
        const extractedSections = [];

        headings.forEach(heading => {
            if (!isVisible(heading)) return;
            const headingText = heading.innerText.trim();
            if (!headingText || headingText.length > 60) return; // Ignore long texts
            
            // Ignore nav, footer, ads
            if (heading.closest('nav, footer, .footer, .nav, header, aside')) return;

            const items = new Set();
            
            // Find nearby content
            let current = heading;
            let limit = 0;
            while(current && limit < 4) {
                const parent = current.parentElement;
                if (!parent) break;
                
                // Search for list items
                const lists = parent.querySelectorAll('ul, ol');
                if (lists.length > 0) {
                    lists.forEach(list => {
                        if (!isVisible(list)) return;
                        Array.from(list.querySelectorAll('li')).forEach(li => {
                            if (isVisible(li)) {
                                let text = li.innerText.replace(/\\s+/g, ' ').trim();
                                if (text && text.length > 3 && text.length < 200) items.add(text);
                            }
                        });
                    });
                    if (items.size > 0) break;
                }
                
                // Search for generic block items if no list
                if (items.size === 0) {
                    const children = parent.children;
                    for (const child of children) {
                        if (child === heading) continue;
                        if (isVisible(child)) {
                            let text = child.innerText.replace(/\\s+/g, ' ').trim();
                            // Check if block has multiple lines (name, desc, price)
                            if (text && text.length > 3 && text.length < 300) {
                                // Exclude big paragraphs
                                if (!text.includes('\\n') && text.length > 150) continue; 
                                items.add(text);
                            }
                        }
                    }
                }
                
                if (items.size > 0) break;
                
                current = parent;
                limit++;
            }
            
            if (items.size > 0) {
                extractedSections.push({
                    heading: headingText,
                    items: Array.from(items)
                });
            }
        });

        // Deduplicate sections by heading
        const uniqueSections = [];
        const seenHeadings = new Set();
        for (const sec of extractedSections) {
            if (!seenHeadings.has(sec.heading)) {
                seenHeadings.add(sec.heading);
                uniqueSections.push(sec);
            }
        }

        return { sections: uniqueSections };
    }''')
    
    return sections
