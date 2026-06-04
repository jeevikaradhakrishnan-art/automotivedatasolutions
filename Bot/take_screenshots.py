"""
take_screenshots.py
Opens a real Chromium browser, navigates to each Tesla model page on tesla.com,
waits for full React render, and saves a JPEG screenshot to Bot/HTML/.

These screenshots are served as the HITL LHS — showing the real Tesla website.
Uses the same fresh-context-per-model strategy as the main bot to avoid 403s.
"""
import time
import random
from pathlib import Path
from playwright.sync_api import sync_playwright

BOT_DIR  = Path(__file__).parent
HTML_DIR = BOT_DIR / "HTML"
HTML_DIR.mkdir(exist_ok=True)

MODELS = [
    {"name": "Model Y",  "url": "https://www.tesla.com/modely/design",  "out": "Model Y_screenshot.jpg"},
    {"name": "Model 3",  "url": "https://www.tesla.com/model3/design",  "out": "Model 3_screenshot.jpg"},
    {"name": "Model S",  "url": "https://www.tesla.com/models/design",  "out": "Model S_screenshot.jpg"},
    {"name": "Model X",  "url": "https://www.tesla.com/modelx/design",  "out": "Model X_screenshot.jpg"},
]

UA_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
]

DISMISS_JS = """
(() => {
    const hide = el => {
        el.style.setProperty('display','none','important');
        el.style.setProperty('visibility','hidden','important');
    };
    // Click accept/dismiss buttons
    const clickRe = /accept|agree|continue|got it|allow|dismiss|close|reject|no thanks|skip/i;
    for (const sel of ['button','a','[role=button]']) {
        for (const el of document.querySelectorAll(sel)) {
            const t = (el.innerText||el.getAttribute('aria-label')||'').trim();
            if (clickRe.test(t)) try { el.click(); } catch(e) {}
        }
    }
    // Hide modals / overlays / banners
    for (const sel of [
        '[role=dialog]','[aria-modal=true]','[class*=cookie]','[class*=consent]',
        '[class*=modal]','[class*=overlay]','[class*=scrim]','[class*=banner]',
        '[id*=cookie]','[id*=consent]','[id*=zip]','[id*=postal]','[id*=location]'
    ]) {
        document.querySelectorAll(sel).forEach(hide);
    }
    // Fix body hiding inline styles (Tesla JS sets these during loading;
    // inline !important cannot be overridden by CSS, so fix inline).
    if (document.body) {
        document.body.style.removeProperty('display');
        document.body.style.removeProperty('visibility');
        document.body.style.removeProperty('opacity');
        document.body.style.setProperty('display', 'block', 'important');
        document.body.style.setProperty('visibility', 'visible', 'important');
        document.body.style.setProperty('opacity', '1', 'important');
    }
    document.documentElement.classList.remove('coin-reloaded', 'async-hide', 'tds-modal--is-open');
    document.body.classList.remove('coin-reloaded', 'async-hide', 'tds-modal--is-open');
})();
"""


def take_screenshot(browser, url: str, out_path: Path, ua: str) -> bool:
    """Fresh browser context → homepage warm-up → model page → screenshot."""
    ctx = browser.new_context(
        user_agent=ua,
        viewport={"width": 1440, "height": 900},
        locale="en-US",
        bypass_csp=True,
        ignore_https_errors=True,
    )
    ctx.set_extra_http_headers({
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Upgrade-Insecure-Requests": "1",
    })
    try:
        page = ctx.new_page()
        page.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")
        page.add_init_script("Object.defineProperty(navigator,'platform',{get:()=>'Win32'})")
        page.add_init_script("Object.defineProperty(navigator,'plugins',{get:()=>[1,2,3,4,5]})")

        # Warm up from homepage
        try:
            page.goto("https://www.tesla.com/", wait_until="domcontentloaded",
                      timeout=30000, referer="https://www.google.com/search?q=tesla+cars")
            page.wait_for_timeout(random.randint(2000, 3500))
            page.evaluate(DISMISS_JS)
        except Exception:
            pass

        # Navigate to model page
        resp = page.goto(url, wait_until="domcontentloaded", timeout=60000,
                         referer="https://www.tesla.com/")
        status = resp.status if resp else 0

        # Wait for React to fully render (networkidle)
        try:
            page.wait_for_load_state("networkidle", timeout=25000)
        except Exception:
            pass
        page.wait_for_timeout(3000)

        # Dismiss overlays, force visibility
        page.evaluate(DISMISS_JS)
        page.wait_for_timeout(1000)

        # Check we got a real page (not 403/error)
        body_text = page.locator("body").inner_text()
        if len(body_text) < 100 or "Access Denied" in body_text:
            print(f"  [FAIL] {url} -> status={status}, body too small or access denied")
            return False

        page.screenshot(
            path=str(out_path),
            type="jpeg",
            quality=90,
            full_page=False,
        )
        size = out_path.stat().st_size
        print(f"  [OK]   {url.split('/')[-2]} -> {out_path.name}  ({size:,} bytes, HTTP {status})")
        return size > 50_000   # reject tiny (solid black) screenshots

    except Exception as exc:
        print(f"  [FAIL] {url}: {exc}")
        return False
    finally:
        ctx.close()


if __name__ == "__main__":
    print("[INFO] Tesla Real-Website Screenshot Tool")
    print("[INFO] Opening browser — fresh context per model\n")

    taken: dict[str, bool] = {}

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--window-size=1440,900",
            ],
        )

        for idx, m in enumerate(MODELS):
            out_path = HTML_DIR / m["out"]
            print(f"[INFO] Model {idx+1}/4: {m['name']}  ({m['url']})")

            ua = UA_POOL[idx % len(UA_POOL)]
            ok = take_screenshot(browser, m["url"], out_path, ua)
            taken[m["name"]] = ok

            if not ok:
                print(f"  [WARN] Screenshot failed for {m['name']} — black screen would show")

            if idx < len(MODELS) - 1:
                gap = random.uniform(8, 14)
                print(f"[INFO] Pausing {gap:.1f}s before next model …\n")
                time.sleep(gap)

        browser.close()

    print("\n[INFO] Results:")
    for name, ok in taken.items():
        print(f"  {name:12s}: {'OK' if ok else 'FAILED'}")

    ok_count = sum(taken.values())
    print(f"\n[INFO] {ok_count}/{len(MODELS)} screenshots taken successfully")
    if ok_count < len(MODELS):
        print("[INFO] Failed models will show the structured data page in HITL instead")
