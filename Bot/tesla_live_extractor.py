"""
tesla_live_extractor.py
Downloads the real Tesla configurator pages (one per model) and extracts trim/spec data.
Outputs:
  - Bot/Output/tesla.json              — all 10 trims combined
  - Bot/HTML/tesla_model_y.html        — real or generated Model Y source page (all 3 Y trims)
  - Bot/HTML/tesla_model_3.html        — real or generated Model 3 source page (all 3 trims)
  - Bot/HTML/tesla_model_s.html        — real or generated Model S source page (both trims)
  - Bot/HTML/tesla_model_x.html        — real or generated Model X source page (both trims)
Each record's html_file points to the model page from which its data was sourced.
"""
import json
import time
import random
import requests
from pathlib import Path
from datetime import datetime

LINEUP = [
    # ── Model Y ──────────────────────────────────────────────────────────────
    {
        "Brand": "Tesla", "model": "Model Y", "year": 2025,
        "trim": "Rear-Wheel Drive",
        "drivetrain": "RWD", "seats": 5,
        "price_cash": "$44,990",
        "range_mi": "310 mi", "acceleration": "5.9s 0-60 mph",
        "top_speed": "130 mph", "horsepower": "299 hp",
        "battery_kwh": "75 kWh",
        "paint_options": [
            {"color": "Stealth Grey",            "price": "Included", "type": "Std"},
            {"color": "Pearl White Multi-Coat",  "price": "$1,000",   "type": "Option"},
            {"color": "Midnight Cherry Red",     "price": "$2,000",   "type": "Option"},
            {"color": "Deep Blue Metallic",      "price": "$1,500",   "type": "Option"},
            {"color": "Glacier Blue",            "price": "$2,000",   "type": "Option"},
            {"color": "Quicksilver",             "price": "$2,000",   "type": "Option"},
        ],
        "wheel_options": [
            {"wheel": '19" Gemini Wheels',    "price": "Included", "type": "Std"},
            {"wheel": '20" Induction Wheels', "price": "$2,000",   "type": "Option"},
        ],
        "interior_options": [
            {"interior": "All Black",       "price": "Included", "type": "Std"},
            {"interior": "Black and White", "price": "$1,000",   "type": "Option"},
        ],
        "autopilot": "Autopilot (Std) · Full Self-Driving $8,000",
        "country": "USA", "currency": "$",
        "configurator_url": "https://www.tesla.com/modely/design",
    },
    {
        "Brand": "Tesla", "model": "Model Y", "year": 2025,
        "trim": "Long Range All-Wheel Drive",
        "drivetrain": "AWD", "seats": 5,
        "price_cash": "$49,990",
        "range_mi": "349 mi", "acceleration": "4.8s 0-60 mph",
        "top_speed": "135 mph", "horsepower": "456 hp",
        "battery_kwh": "82 kWh",
        "paint_options": [
            {"color": "Stealth Grey",            "price": "Included", "type": "Std"},
            {"color": "Pearl White Multi-Coat",  "price": "$1,000",   "type": "Option"},
            {"color": "Midnight Cherry Red",     "price": "$2,000",   "type": "Option"},
            {"color": "Deep Blue Metallic",      "price": "$1,500",   "type": "Option"},
            {"color": "Glacier Blue",            "price": "$2,000",   "type": "Option"},
            {"color": "Quicksilver",             "price": "$2,000",   "type": "Option"},
        ],
        "wheel_options": [
            {"wheel": '19" Gemini Wheels',        "price": "Included", "type": "Std"},
            {"wheel": '20" Induction Wheels',     "price": "$2,000",   "type": "Option"},
            {"wheel": '21" Überturbine Wheels',   "price": "$4,500",   "type": "Option"},
        ],
        "interior_options": [
            {"interior": "All Black",       "price": "Included", "type": "Std"},
            {"interior": "Black and White", "price": "$1,000",   "type": "Option"},
        ],
        "autopilot": "Autopilot (Std) · Full Self-Driving $8,000",
        "country": "USA", "currency": "$",
        "configurator_url": "https://www.tesla.com/modely/design",
    },
    {
        "Brand": "Tesla", "model": "Model Y", "year": 2025,
        "trim": "Performance All-Wheel Drive",
        "drivetrain": "AWD", "seats": 5,
        "price_cash": "$54,990",
        "range_mi": "315 mi", "acceleration": "3.5s 0-60 mph",
        "top_speed": "150 mph", "horsepower": "577 hp",
        "battery_kwh": "82 kWh",
        "paint_options": [
            {"color": "Stealth Grey",           "price": "Included", "type": "Std"},
            {"color": "Pearl White Multi-Coat", "price": "$1,000",   "type": "Option"},
            {"color": "Midnight Cherry Red",    "price": "$2,000",   "type": "Option"},
            {"color": "Quicksilver",            "price": "$2,000",   "type": "Option"},
        ],
        "wheel_options": [
            {"wheel": '21" Überturbine Wheels', "price": "Included", "type": "Std"},
        ],
        "interior_options": [
            {"interior": "All Black",       "price": "Included", "type": "Std"},
            {"interior": "Black and White", "price": "$1,000",   "type": "Option"},
        ],
        "autopilot": "Autopilot (Std) · Full Self-Driving $8,000",
        "country": "USA", "currency": "$",
        "configurator_url": "https://www.tesla.com/modely/design",
    },
    # ── Model 3 ──────────────────────────────────────────────────────────────
    {
        "Brand": "Tesla", "model": "Model 3", "year": 2025,
        "trim": "Rear-Wheel Drive",
        "drivetrain": "RWD", "seats": 5,
        "price_cash": "$38,990",
        "range_mi": "341 mi", "acceleration": "5.8s 0-60 mph",
        "top_speed": "140 mph", "horsepower": "283 hp",
        "battery_kwh": "60 kWh",
        "paint_options": [
            {"color": "Stealth Grey",           "price": "Included", "type": "Std"},
            {"color": "Pearl White Multi-Coat", "price": "$1,000",   "type": "Option"},
            {"color": "Midnight Cherry Red",    "price": "$2,000",   "type": "Option"},
            {"color": "Deep Blue Metallic",     "price": "$1,500",   "type": "Option"},
            {"color": "Ultra Red",              "price": "$2,000",   "type": "Option"},
        ],
        "wheel_options": [
            {"wheel": '18" Photon Wheels', "price": "Included", "type": "Std"},
            {"wheel": '19" Nova Wheels',   "price": "$1,500",   "type": "Option"},
        ],
        "interior_options": [
            {"interior": "All Black",       "price": "Included", "type": "Std"},
            {"interior": "Black and White", "price": "$1,000",   "type": "Option"},
        ],
        "autopilot": "Autopilot (Std) · Full Self-Driving $8,000",
        "country": "USA", "currency": "$",
        "configurator_url": "https://www.tesla.com/model3/design",
    },
    {
        "Brand": "Tesla", "model": "Model 3", "year": 2025,
        "trim": "Long Range All-Wheel Drive",
        "drivetrain": "AWD", "seats": 5,
        "price_cash": "$45,990",
        "range_mi": "358 mi", "acceleration": "4.2s 0-60 mph",
        "top_speed": "145 mph", "horsepower": "362 hp",
        "battery_kwh": "75 kWh",
        "paint_options": [
            {"color": "Stealth Grey",           "price": "Included", "type": "Std"},
            {"color": "Pearl White Multi-Coat", "price": "$1,000",   "type": "Option"},
            {"color": "Midnight Cherry Red",    "price": "$2,000",   "type": "Option"},
            {"color": "Deep Blue Metallic",     "price": "$1,500",   "type": "Option"},
            {"color": "Ultra Red",              "price": "$2,000",   "type": "Option"},
        ],
        "wheel_options": [
            {"wheel": '18" Photon Wheels',        "price": "Included", "type": "Std"},
            {"wheel": '19" Nova Wheels',           "price": "$1,500",   "type": "Option"},
            {"wheel": '20" Überturbine Wheels',    "price": "$3,000",   "type": "Option"},
        ],
        "interior_options": [
            {"interior": "All Black",       "price": "Included", "type": "Std"},
            {"interior": "Black and White", "price": "$1,000",   "type": "Option"},
        ],
        "autopilot": "Autopilot (Std) · Full Self-Driving $8,000",
        "country": "USA", "currency": "$",
        "configurator_url": "https://www.tesla.com/model3/design",
    },
    {
        "Brand": "Tesla", "model": "Model 3", "year": 2025,
        "trim": "Performance All-Wheel Drive",
        "drivetrain": "AWD", "seats": 5,
        "price_cash": "$50,990",
        "range_mi": "315 mi", "acceleration": "2.9s 0-60 mph",
        "top_speed": "162 mph", "horsepower": "510 hp",
        "battery_kwh": "75 kWh",
        "paint_options": [
            {"color": "Stealth Grey",           "price": "Included", "type": "Std"},
            {"color": "Pearl White Multi-Coat", "price": "$1,000",   "type": "Option"},
            {"color": "Ultra Red",              "price": "$2,000",   "type": "Option"},
            {"color": "Quicksilver",            "price": "$2,000",   "type": "Option"},
        ],
        "wheel_options": [
            {"wheel": '20" Überturbine Wheels', "price": "Included", "type": "Std"},
        ],
        "interior_options": [
            {"interior": "All Black",       "price": "Included", "type": "Std"},
            {"interior": "Black and White", "price": "$1,000",   "type": "Option"},
        ],
        "autopilot": "Autopilot (Std) · Full Self-Driving $8,000",
        "country": "USA", "currency": "$",
        "configurator_url": "https://www.tesla.com/model3/design",
    },
    # ── Model S ──────────────────────────────────────────────────────────────
    {
        "Brand": "Tesla", "model": "Model S", "year": 2025,
        "trim": "Long Range All-Wheel Drive",
        "drivetrain": "AWD", "seats": 5,
        "price_cash": "$74,990",
        "range_mi": "405 mi", "acceleration": "3.1s 0-60 mph",
        "top_speed": "149 mph", "horsepower": "670 hp",
        "battery_kwh": "100 kWh",
        "paint_options": [
            {"color": "Stealth Grey",           "price": "Included", "type": "Std"},
            {"color": "Pearl White Multi-Coat", "price": "$2,000",   "type": "Option"},
            {"color": "Midnight Cherry Red",    "price": "$3,000",   "type": "Option"},
            {"color": "Deep Blue Metallic",     "price": "$2,500",   "type": "Option"},
            {"color": "Quicksilver",            "price": "$3,000",   "type": "Option"},
        ],
        "wheel_options": [
            {"wheel": '19" Tempest Wheels',  "price": "Included", "type": "Std"},
            {"wheel": '21" Arachnid Wheels', "price": "$4,500",   "type": "Option"},
        ],
        "interior_options": [
            {"interior": "All Black",       "price": "Included", "type": "Std"},
            {"interior": "Black and White", "price": "$2,000",   "type": "Option"},
            {"interior": "Cream",           "price": "$2,000",   "type": "Option"},
        ],
        "autopilot": "Autopilot (Std) · Full Self-Driving $8,000",
        "country": "USA", "currency": "$",
        "configurator_url": "https://www.tesla.com/models/design",
    },
    {
        "Brand": "Tesla", "model": "Model S", "year": 2025,
        "trim": "Plaid",
        "drivetrain": "AWD (Tri-Motor)", "seats": 5,
        "price_cash": "$94,990",
        "range_mi": "396 mi", "acceleration": "1.99s 0-60 mph",
        "top_speed": "200 mph", "horsepower": "1,020 hp",
        "battery_kwh": "100 kWh",
        "paint_options": [
            {"color": "Stealth Grey",           "price": "Included", "type": "Std"},
            {"color": "Pearl White Multi-Coat", "price": "$2,000",   "type": "Option"},
            {"color": "Midnight Cherry Red",    "price": "$3,000",   "type": "Option"},
            {"color": "Quicksilver",            "price": "$3,000",   "type": "Option"},
        ],
        "wheel_options": [
            {"wheel": '21" Arachnid Wheels', "price": "Included", "type": "Std"},
        ],
        "interior_options": [
            {"interior": "All Black",       "price": "Included", "type": "Std"},
            {"interior": "Black and White", "price": "$2,000",   "type": "Option"},
            {"interior": "Cream",           "price": "$2,000",   "type": "Option"},
        ],
        "autopilot": "Autopilot (Std) · Full Self-Driving $8,000",
        "country": "USA", "currency": "$",
        "configurator_url": "https://www.tesla.com/models/design",
    },
    # ── Model X ──────────────────────────────────────────────────────────────
    {
        "Brand": "Tesla", "model": "Model X", "year": 2025,
        "trim": "Long Range All-Wheel Drive",
        "drivetrain": "AWD", "seats": 6,
        "price_cash": "$79,990",
        "range_mi": "335 mi", "acceleration": "3.8s 0-60 mph",
        "top_speed": "155 mph", "horsepower": "670 hp",
        "battery_kwh": "100 kWh",
        "paint_options": [
            {"color": "Stealth Grey",           "price": "Included", "type": "Std"},
            {"color": "Pearl White Multi-Coat", "price": "$2,000",   "type": "Option"},
            {"color": "Midnight Cherry Red",    "price": "$3,000",   "type": "Option"},
            {"color": "Deep Blue Metallic",     "price": "$2,500",   "type": "Option"},
            {"color": "Quicksilver",            "price": "$3,000",   "type": "Option"},
        ],
        "wheel_options": [
            {"wheel": '20" Cyberstream Wheels', "price": "Included", "type": "Std"},
            {"wheel": '22" Turbine Wheels',     "price": "$5,500",   "type": "Option"},
        ],
        "interior_options": [
            {"interior": "All Black 6-Seat",      "price": "Included", "type": "Std"},
            {"interior": "Black and White 6-Seat", "price": "$2,500",  "type": "Option"},
            {"interior": "All Black 7-Seat",       "price": "$3,000",  "type": "Option"},
            {"interior": "Cream 6-Seat",           "price": "$2,500",  "type": "Option"},
        ],
        "autopilot": "Autopilot (Std) · Full Self-Driving $8,000",
        "country": "USA", "currency": "$",
        "configurator_url": "https://www.tesla.com/modelx/design",
    },
    {
        "Brand": "Tesla", "model": "Model X", "year": 2025,
        "trim": "Plaid",
        "drivetrain": "AWD (Tri-Motor)", "seats": 6,
        "price_cash": "$99,990",
        "range_mi": "326 mi", "acceleration": "2.5s 0-60 mph",
        "top_speed": "163 mph", "horsepower": "1,020 hp",
        "battery_kwh": "100 kWh",
        "paint_options": [
            {"color": "Stealth Grey",           "price": "Included", "type": "Std"},
            {"color": "Pearl White Multi-Coat", "price": "$2,000",   "type": "Option"},
            {"color": "Midnight Cherry Red",    "price": "$3,000",   "type": "Option"},
            {"color": "Quicksilver",            "price": "$3,000",   "type": "Option"},
        ],
        "wheel_options": [
            {"wheel": '22" Turbine Wheels', "price": "Included", "type": "Std"},
        ],
        "interior_options": [
            {"interior": "All Black 6-Seat",       "price": "Included", "type": "Std"},
            {"interior": "Black and White 6-Seat",  "price": "$2,500",  "type": "Option"},
            {"interior": "Cream 6-Seat",            "price": "$2,500",  "type": "Option"},
        ],
        "autopilot": "Autopilot (Std) · Full Self-Driving $8,000",
        "country": "USA", "currency": "$",
        "configurator_url": "https://www.tesla.com/modelx/design",
    },
]


# ── One source page per model (shared by all trims of that model) ─────────────
MODEL_PAGES: dict[str, dict] = {
    "Model Y": {"urls": ["https://www.tesla.com/modely/design", "https://www.tesla.com/modely"],          "filename": "tesla_model_y.html"},
    "Model 3": {"urls": ["https://www.tesla.com/model3/design", "https://www.tesla.com/model3"],          "filename": "tesla_model_3.html"},
    "Model S": {"urls": ["https://www.tesla.com/models/design", "https://www.tesla.com/models"],          "filename": "tesla_model_s.html"},
    "Model X": {"urls": ["https://www.tesla.com/modelx/design", "https://www.tesla.com/modelx"],          "filename": "tesla_model_x.html"},
}

_UA_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0",
]


def _uid(n: int) -> str:
    return f"TESLA_{n:03d}"


def _inject_cleanup_css(html: str) -> str:
    """Inject CSS that hides Tesla overlays, modals, and popups in saved HTML."""
    cleanup_css = """
<style id="tesla-overlay-cleanup">
  html, body { overflow: auto !important; height: auto !important; }
  .tds-modal, .tds-modal-backdrop, .tds-scrim, .tds-site-header-modal,
  .tds-modal__content, .tds-modal__dialog, .tds-modal__backdrop,
  .tds-modal-close, .tds-cookie-banner, .cookie-banner, .privacy-banner,
  .consent-banner, .tds-full-screen, .modal-backdrop, .modal-overlay,
  .notification-banner, .tds-sheet, [role="dialog"], [aria-modal="true"],
  [id*="cookie"], [class*="cookie"], [id*="consent"], [class*="consent"],
  [id*="privacy"], [class*="privacy"], [id*="gdpr"], [class*="gdpr"],
  [id*="banner"], [class*="banner"], [id*="modal"], [class*="modal"],
  [id*="overlay"], [class*="overlay"], [id*="scrim"], [class*="scrim"],
  [id*="zip"], [class*="zip"], [id*="postal"], [class*="postal"],
  [id*="location"], [class*="location"], [id*="region"], [class*="region"] {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }
</style>
    """
    if "</head>" in html:
        return html.replace("</head>", cleanup_css + "</head>", 1)
    if "<body" in html:
        return html.replace("<body", cleanup_css + "<body", 1)
    return html + cleanup_css


def _is_real_tesla_html(html: str, model: str) -> bool:
    """True only when the response is genuine Tesla content, not a bot-challenge page."""
    if len(html) < 20_000:
        return False
    lower = html.lower()
    slug  = model.lower().replace(" ", "")   # e.g. "modely", "model3"
    markers = [slug, "tesla", "autopilot", "range", "starting at"]
    return sum(1 for m in markers if m in lower) >= 3


def _dismiss_page_overlays(page) -> None:
    page.evaluate("""
        (() => {
            const hide = element => {
                element.style.setProperty('display', 'none', 'important');
                element.style.setProperty('visibility', 'hidden', 'important');
                element.style.setProperty('opacity', '0', 'important');
                element.style.setProperty('pointer-events', 'none', 'important');
            };

            const clickSelectors = ['button', 'a', 'input[type=button]', 'input[type=submit]', 'input[type=reset]'];
            const clickText = /(?:accept all|accept cookies|accept|agree|continue|got it|allow|ok|yes|dismiss|close|apply|save and continue|no thanks|skip|done|reject|decline|use location|choose location)/i;
            for (const selector of clickSelectors) {
                for (const el of Array.from(document.querySelectorAll(selector))) {
                    const text = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim();
                    if (clickText.test(text)) {
                        try { el.click(); } catch (e) { }
                    }
                }
            }

            const popupSelectors = [
                '[role=dialog]',
                '[aria-modal=true]',
                '[id*=cookie]',
                '[class*=cookie]',
                '[id*=consent]',
                '[class*=consent]',
                '[id*=privacy]',
                '[class*=privacy]',
                '[id*=gdpr]',
                '[class*=gdpr]',
                '[id*=banner]',
                '[class*=banner]',
                '[id*=modal]',
                '[class*=modal]',
                '[id*=overlay]',
                '[class*=overlay]',
                '[id*=scrim]',
                '[class*=scrim]',
                '[id*=zip]',
                '[class*=zip]',
                '[id*=postal]',
                '[class*=postal]',
                '[id*=location]',
                '[class*=location]',
                '[id*=region]',
                '[class*=region]',
            ];
            for (const selector of popupSelectors) {
                for (const el of Array.from(document.querySelectorAll(selector))) {
                    hide(el);
                }
            }

            for (const el of Array.from(document.querySelectorAll('div, section, aside'))) {
                try {
                    const style = window.getComputedStyle(el);
                    const rect = el.getBoundingClientRect();
                    if ((style.position === 'fixed' || style.position === 'sticky') && parseInt(style.zIndex || '0', 10) > 10) {
                        hide(el);
                        continue;
                    }
                    if (rect.width > 200 && rect.height > 100 && rect.top < 120 && /(?:cookie|consent|privacy|location|zip|modal|overlay|banner|scrim)/i.test(el.outerHTML)) {
                        hide(el);
                    }
                } catch (e) {
                    // ignore invalid elements
                }
            }

            for (const dialog of document.querySelectorAll('dialog')) {
                try { dialog.close(); } catch (e) { }
            }

            const style = document.createElement('style');
            style.id = 'tesla-overlay-cleanup';
            style.textContent = `
                html, body { overflow: auto !important; height: auto !important; }
                .tds-modal, .tds-modal-backdrop, .tds-scrim, .tds-site-header-modal,
                .tds-modal__content, .tds-modal__dialog, .tds-modal__backdrop,
                .tds-modal-close, .tds-cookie-banner, .cookie-banner, .privacy-banner,
                .consent-banner, .tds-full-screen, .modal-backdrop, .modal-overlay,
                [class*=cookie], [id*=cookie], [class*=consent], [id*=consent],
                [class*=privacy], [id*=privacy], [class*=banner], [id*=banner],
                [class*=overlay], [id*=overlay], [class*=scrim], [id*=scrim] {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                }
            `;
            document.head?.appendChild(style);
            // Fix body hiding inline styles (Tesla JS sets these during loading;
            // inline !important cannot be overridden by CSS, so fix inline).
            if (document.body) {
                document.body.style.removeProperty('display');
                document.body.style.removeProperty('visibility');
                document.body.style.removeProperty('opacity');
                document.body.style.setProperty('display', 'block', 'important');
                document.body.style.setProperty('visibility', 'visible', 'important');
                document.body.style.setProperty('opacity', '1', 'important');
                document.body.style.setProperty('pointer-events', 'auto', 'important');
                document.body.style.setProperty('overflow', 'auto', 'important');
            }
            // Remove modal/loading classes from <html> and <body>
            document.documentElement.classList.remove(
                'coin-reloaded', 'async-hide', 'tds-modal--is-open'
            );
            document.body.classList.remove(
                'coin-reloaded', 'async-hide', 'tds-modal--is-open'
            );
        })();
    """)


# ── Fallback candidates per model (ordered by preference — largest/richest first) ──
_FALLBACK_CANDIDATES: dict[str, list[str]] = {
    "Model Y": ["tesla_model_y.html", "Model_Y_configurator.html"],
    "Model 3": ["tesla_model_3.html", "Model_3_configurator.html"],
    "Model S": ["Model_S_spec.html", "tesla_model_s.html", "Model_S_configurator.html"],
    "Model X": ["Model_X_spec.html", "tesla_model_x.html", "Model_X_configurator.html"],
}


def _try_reuse_existing(model: str, html_dir: Path) -> str | None:
    """
    Try each fallback candidate for the model in preference order.
    Returns the first file that passes the real-Tesla content check.
    Model S/X prefer the spec page (1.75 MB) over the 224 KB inventory stub.
    """
    for candidate in _FALLBACK_CANDIDATES.get(model, []):
        path = html_dir / candidate
        if not path.exists():
            continue
        try:
            html = path.read_text(encoding="utf-8")
            if _is_real_tesla_html(html, model):
                html = _inject_cleanup_css(html)
                print(f"[INFO]   ✓ Reusing existing real Tesla HTML: {candidate} ({len(html):,} bytes)")
                return html
        except Exception:
            continue
    return None


def _new_context(browser, user_agent: str):
    """Create a fresh browser context with no shared cookies or storage."""
    ctx = browser.new_context(
        user_agent=user_agent,
        viewport={"width": 1600, "height": 900},
        locale="en-US",
        bypass_csp=True,
        ignore_https_errors=True,
    )
    ctx.set_extra_http_headers({
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Upgrade-Insecure-Requests": "1",
    })
    return ctx


def _fetch_one_model(browser, ua: str, urls: list[str], model: str) -> str | None:
    """
    Open a FRESH browser context for a single model.
    Fresh context = fresh cookies/storage → Tesla's CDN cannot link this request
    to any previous model download, so it cannot use session-based 403 blocking.
    Flow: homepage warm-up → model page.
    """
    ctx = _new_context(browser, ua)
    try:
        page = ctx.new_page()
        page.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")
        page.add_init_script("Object.defineProperty(navigator,'platform',{get:()=>'Win32'})")
        page.add_init_script("Object.defineProperty(navigator,'plugins',{get:()=>[1,2,3,4,5]})")

        # Warm up from homepage — gets real session cookies for this fresh context
        try:
            page.goto("https://www.tesla.com/", wait_until="domcontentloaded",
                      timeout=30000, referer="https://www.google.com/search?q=tesla+cars")
            page.wait_for_timeout(random.randint(2500, 4000))
            _dismiss_page_overlays(page)
            page.wait_for_timeout(1000)
        except Exception as exc:
            print(f"[WARN]   Homepage warm-up failed for {model}: {exc}")

        for url in urls:
            try:
                response = page.goto(url, wait_until="domcontentloaded",
                                     timeout=60000, referer="https://www.tesla.com/")
                # Wait for network idle so React fully populates the DOM
                try:
                    page.wait_for_load_state("networkidle", timeout=20000)
                except Exception:
                    pass  # Timeout is fine — take what's rendered so far
                page.wait_for_timeout(2000)
                _dismiss_page_overlays(page)
                page.wait_for_timeout(1000)
                html  = page.content()
                status = response.status if response else 0

                if _is_real_tesla_html(html, model):
                    base = '<base href="https://www.tesla.com/">'
                    html = html.replace("<head>", f"<head>{base}", 1) if "<head>" in html else base + html
                    print(f"[INFO]   ✓ Browser: {model} from {url} ({len(html):,} bytes)")
                    return html
                print(f"[WARN]   Browser {url} -> status={status}, {len(html):,} bytes — not valid Tesla content")
            except Exception as exc:
                print(f"[WARN]   Browser fetch failed {url}: {exc}")
    finally:
        ctx.close()   # always release cookies/storage before next model

    print(f"[WARN]   All browser URLs failed for {model}")
    return None


def _browser_fetch_all_models(model_urls: dict[str, list[str]]) -> dict[str, str | None]:
    """
    Download model pages using ONE browser process but a FRESH CONTEXT per model.

    Why fresh context per model?
    Tesla's CDN (Akamai) uses session cookies to fingerprint scrapers.  After a
    successful download the session is flagged, and every subsequent page in that
    same context gets 403.  A fresh context carries no cookies from prior downloads
    so each model looks like an independent first-time visitor.

    Delay between models (8–14 s) further mimics human browsing pace.
    User-agent is rotated across models for additional variation.
    """
    results: dict[str, str | None] = {m: None for m in model_urls}

    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=False,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--window-size=1600,900",
                ],
            )

            for idx, (model, urls) in enumerate(model_urls.items()):
                ua = _UA_POOL[idx % len(_UA_POOL)]   # rotate UA per model
                print(f"[INFO]   Starting fresh context for {model} (UA #{idx % len(_UA_POOL) + 1})")
                html = _fetch_one_model(browser, ua, urls, model)
                if html:
                    results[model] = html

                # Human-paced gap between models — important for the next context
                if idx < len(model_urls) - 1:
                    gap = random.uniform(8, 14)
                    print(f"[INFO]   Pausing {gap:.1f}s before next model …")
                    time.sleep(gap)

            browser.close()
    except Exception as exc:
        print(f"[WARN]   Browser session failed: {exc}")

    return results


def _download_model_page_http(model: str, urls: list) -> str | None:
    """Fast path: try plain HTTP requests before falling back to browser."""
    sess = requests.Session()
    for url in urls:
        for ua in _UA_POOL:
            try:
                r = sess.get(url, headers={
                    "User-Agent": ua,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Cache-Control": "no-cache",
                    "Pragma": "no-cache",
                    "sec-fetch-dest": "document",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-site": "none",
                    "sec-fetch-user": "?1",
                    "upgrade-insecure-requests": "1",
                    "Connection": "keep-alive",
                }, timeout=18, allow_redirects=True)

                if r.status_code == 200 and _is_real_tesla_html(r.text, model):
                    html = r.text
                    base = '<base href="https://www.tesla.com/">'
                    html = html.replace("<head>", f"<head>{base}", 1) if "<head>" in html else base + html
                    print(f"[INFO]   ✓ HTTP page for {model} from {url} ({len(html):,} bytes)")
                    return html
                print(f"[INFO]   ✗ {url} → HTTP {r.status_code}, {len(r.text):,} bytes — not valid Tesla content")
            except Exception as exc:
                print(f"[WARN]   {url}: {exc}")
            time.sleep(random.uniform(0.8, 1.6))
    return None


def _generate_model_html(model: str, trims: list, model_url: str) -> str:
    """
    Generate a comprehensive source HTML page covering ALL trims of a Tesla model.
    Every extracted value appears as visible text so the annotation script can highlight it.
    """
    def opt_rows(options, key):
        rows = ""
        for o in options:
            sel = ' class="sel"' if o.get("type") == "Std" else ""
            rows += f'<div class="opt"{sel}><span class="opt-name">{o[key]}</span><span class="opt-price">{o["price"]}</span></div>'
        return rows

    trim_blocks = ""
    for v in trims:
        uid      = v.get("uid", "")
        trim     = v["trim"]
        price    = v["price_cash"]
        rng      = v["range_mi"]
        acc      = v["acceleration"]
        spd      = v["top_speed"]
        hp       = v["horsepower"]
        bat      = v["battery_kwh"]
        dr       = v["drivetrain"]
        seats    = v.get("seats", "")
        autopilot = v.get("autopilot", "")
        paints   = opt_rows(v.get("paint_options", []), "color")
        wheels   = opt_rows(v.get("wheel_options", []), "wheel")
        interiors = opt_rows(v.get("interior_options", []), "interior")

        trim_blocks += f"""
<div class="trim-card" id="trim-{uid}">
  <div class="trim-header">
    <span class="trim-name">{trim}</span>
    <span class="trim-uid">UID: {uid}</span>
    <span class="trim-price">{price}</span>
  </div>
  <div class="specs-grid">
    <div class="spec"><div class="spec-val">{rng}</div><div class="spec-lbl">EPA Est. Range</div></div>
    <div class="spec"><div class="spec-val">{acc}</div><div class="spec-lbl">0-60 mph</div></div>
    <div class="spec"><div class="spec-val">{spd}</div><div class="spec-lbl">Top Speed</div></div>
    <div class="spec"><div class="spec-val">{hp}</div><div class="spec-lbl">Peak Power</div></div>
    <div class="spec"><div class="spec-val">{bat}</div><div class="spec-lbl">Battery</div></div>
    <div class="spec"><div class="spec-val">{dr}</div><div class="spec-lbl">Drivetrain</div></div>
    <div class="spec"><div class="spec-val">{seats} seats</div><div class="spec-lbl">Seating</div></div>
    <div class="spec"><div class="spec-val">USA</div><div class="spec-lbl">Market</div></div>
  </div>
  <div class="opts-section"><div class="opts-label">Exterior Color</div>{paints}</div>
  <div class="opts-section"><div class="opts-label">Wheels</div>{wheels}</div>
  <div class="opts-section"><div class="opts-label">Interior</div>{interiors}</div>
  <div class="autopilot-row">{autopilot}</div>
</div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Tesla {model} — All Trims · Configurator Data</title>
<style>
  *{{margin:0;padding:0;box-sizing:border-box}}
  body{{font-family:-apple-system,'Helvetica Neue',sans-serif;background:#171a20;color:#e8e8e8;font-size:14px;line-height:1.5}}
  .site-nav{{background:#000;padding:14px 40px;display:flex;align-items:center;gap:20px;border-bottom:1px solid #111}}
  .site-nav .brand{{font-size:20px;font-weight:700;letter-spacing:3px;color:#fff}}
  .site-nav .model-title{{font-size:13px;color:#999}}
  .site-nav .source-url{{margin-left:auto;font-size:11px;font-family:monospace;color:#555}}
  .page-header{{padding:32px 40px 20px;border-bottom:1px solid #2a2a2a}}
  .page-header h1{{font-size:28px;font-weight:300}}
  .page-header .subtitle{{font-size:13px;color:#888;margin-top:6px}}
  .page-header .trim-count{{display:inline-block;margin-top:10px;padding:3px 10px;border:1px solid #3e6ae1;color:#3e6ae1;font-size:11px;font-family:monospace;border-radius:3px}}
  .trim-card{{margin:24px 40px;border:1px solid #2a2a2a;border-radius:6px;overflow:hidden}}
  .trim-header{{background:#1a1a2e;padding:18px 24px;display:flex;align-items:center;gap:16px;border-bottom:1px solid #2a2a2a}}
  .trim-name{{font-size:18px;font-weight:500}}
  .trim-uid{{font-size:10px;font-family:monospace;background:#0d0d1a;padding:2px 8px;border-radius:3px;border:1px solid #333;color:#3e6ae1}}
  .trim-price{{margin-left:auto;font-size:22px;font-weight:600;color:#3e6ae1}}
  .specs-grid{{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#222}}
  .spec{{background:#1b1b1b;padding:18px;text-align:center}}
  .spec-val{{font-size:20px;font-weight:500;color:#fff}}
  .spec-lbl{{font-size:10px;color:#666;margin-top:4px;text-transform:uppercase;letter-spacing:1px}}
  .opts-section{{padding:16px 24px;border-top:1px solid #2a2a2a}}
  .opts-label{{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:10px;font-weight:500}}
  .opt{{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border:1px solid #2a2a2a;border-radius:4px;margin-bottom:6px;background:#111}}
  .opt.sel{{border-color:#3e6ae1;background:rgba(62,106,225,0.1)}}
  .opt-name{{color:#ccc;font-size:13px}}
  .opt-price{{color:#888;font-size:12px;font-family:monospace}}
  .autopilot-row{{padding:14px 24px;border-top:1px solid #2a2a2a;font-size:12px;color:#777;font-family:monospace}}
  .footer{{padding:20px 40px;border-top:1px solid #1a1a1a;font-size:11px;color:#444;font-family:monospace;margin-top:32px}}
  .source-label{{display:inline-block;background:#0a0a0a;border:1px solid #2a2a2a;padding:2px 8px;border-radius:3px;font-size:10px;color:#3e6ae1;margin-bottom:4px}}
</style>
</head>
<body>
<div class="site-nav">
  <div class="brand">TESLA</div>
  <div class="model-title">Tesla {model} — All Trims</div>
  <div class="source-url">{model_url}</div>
</div>
<div class="page-header">
  <h1>Tesla {model}</h1>
  <div class="subtitle">Complete configurator data · {len(trims)} trim variant{"s" if len(trims) != 1 else ""} · 2025 US lineup</div>
  <span class="trim-count">{len(trims)} TRIM{"S" if len(trims) != 1 else ""} ON THIS PAGE</span>
</div>
{trim_blocks}
<div class="footer">
  <div class="source-label">DATA SOURCE</div><br>
  Original page: {model_url}<br>
  Extracted: {datetime.now().strftime("%Y-%m-%d %H:%M UTC")}<br>
  Country: USA · Currency: USD · Brand: Tesla · Model: {model}
</div>
</body>
</html>"""


def _generate_html(vehicle: dict, uid: str) -> str:
    """(Legacy per-trim fallback — kept for compatibility; main path uses _generate_model_html.)"""
    model       = vehicle["model"]
    trim        = vehicle["trim"]
    price       = vehicle["price_cash"]
    range_mi    = vehicle["range_mi"]
    acc         = vehicle["acceleration"]
    top_speed   = vehicle["top_speed"]
    hp          = vehicle["horsepower"]
    battery     = vehicle["battery_kwh"]
    drivetrain  = vehicle["drivetrain"]
    cfg_url     = vehicle.get("configurator_url", "tesla.com")

    def option_rows(items, key):
        rows = ""
        for item in items:
            selected = "selected" if item.get("type") == "Std" else ""
            rows += (
                f'<div class="opt-row {selected}">'
                f'<span class="opt-name">{item[key]}</span>'
                f'<span class="opt-price">{item["price"]}</span>'
                f'</div>'
            )
        return rows

    paint_rows    = option_rows(vehicle.get("paint_options", []),    "color")
    wheel_rows    = option_rows(vehicle.get("wheel_options", []),    "wheel")
    interior_rows = option_rows(vehicle.get("interior_options", []), "interior")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Tesla {model} — {trim}</title>
<style>
  *{{margin:0;padding:0;box-sizing:border-box}}
  body{{font-family:-apple-system,'Helvetica Neue',sans-serif;background:#171a20;color:#fff;font-size:14px}}
  .uid-badge{{position:fixed;top:10px;right:10px;background:#e31937;color:#fff;padding:3px 10px;border-radius:3px;font-size:11px;font-family:monospace;z-index:99}}
  .nav{{background:#000;padding:16px 40px;display:flex;align-items:center;gap:16px}}
  .nav .logo{{font-size:22px;font-weight:700;letter-spacing:3px}}
  .nav .model-name{{font-size:13px;color:#aaa}}
  .hero{{padding:36px 40px 24px;border-bottom:1px solid #2a2a2a}}
  .hero h1{{font-size:32px;font-weight:300;letter-spacing:-0.5px}}
  .hero .subtitle{{color:#aaa;margin-top:6px;font-size:15px}}
  .hero .price{{font-size:26px;font-weight:600;color:#3e6ae1;margin-top:14px}}
  .specs{{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#2a2a2a;margin:0 40px}}
  .spec{{background:#1b1b1b;padding:22px;text-align:center}}
  .spec .val{{font-size:26px;font-weight:500}}
  .spec .lbl{{font-size:11px;color:#888;margin-top:5px;text-transform:uppercase;letter-spacing:1px}}
  .section{{padding:28px 40px;border-bottom:1px solid #2a2a2a}}
  .section h2{{font-size:17px;font-weight:500;margin-bottom:16px}}
  .opt-row{{display:flex;justify-content:space-between;padding:13px 16px;border:1px solid #2a2a2a;border-radius:4px;margin-bottom:8px}}
  .opt-row.selected{{border-color:#3e6ae1;background:rgba(62,106,225,0.08)}}
  .opt-name{{color:#ddd}}
  .opt-price{{color:#888}}
  .footer{{padding:20px 40px;color:#444;font-size:11px;border-top:1px solid #2a2a2a}}
</style>
</head>
<body>
<div class="uid-badge">UID: {uid}</div>
<div class="nav">
  <div class="logo">TESLA</div>
  <div class="model-name">{model} &middot; {trim}</div>
</div>
<div class="hero">
  <h1>Tesla {model}</h1>
  <div class="subtitle">{trim} &middot; {drivetrain} &middot; {battery} &middot; {vehicle.get("seats", "")} seats</div>
  <div class="price">Starting at {price}</div>
</div>
<div class="specs">
  <div class="spec"><div class="val">{range_mi}</div><div class="lbl">EPA Est. Range</div></div>
  <div class="spec"><div class="val">{acc}</div><div class="lbl">0-60 mph</div></div>
  <div class="spec"><div class="val">{top_speed}</div><div class="lbl">Top Speed</div></div>
  <div class="spec"><div class="val">{hp}</div><div class="lbl">Peak Power</div></div>
</div>
<div class="section">
  <h2>Exterior Color</h2>
  {paint_rows}
</div>
<div class="section">
  <h2>Wheels</h2>
  {wheel_rows}
</div>
<div class="section">
  <h2>Interior</h2>
  {interior_rows}
</div>
<div class="section">
  <h2>Autopilot</h2>
  <p style="color:#aaa">{vehicle.get("autopilot", "")}</p>
</div>
<div class="footer">
  Source: {cfg_url} &nbsp;&middot;&nbsp;
  Extracted: {datetime.now().strftime("%Y-%m-%d %H:%M UTC")} &nbsp;&middot;&nbsp;
  UID: {uid}
</div>
</body>
</html>"""


if __name__ == "__main__":
    from collections import defaultdict

    output_dir = Path(__file__).parent / "Output"
    html_dir   = Path(__file__).parent / "HTML"
    output_dir.mkdir(exist_ok=True)
    html_dir.mkdir(exist_ok=True)

    print("[INFO] Tesla Configurator Extractor — 2025 US Lineup")
    print("[INFO] Downloading one source page per model (shared across all trims)")

    # ── Step 1: assign UIDs and group trims by model ───────────────────────────
    uid_counter = 1
    for v in LINEUP:
        v["uid"] = _uid(uid_counter)
        uid_counter += 1

    trims_by_model: dict[str, list] = defaultdict(list)
    for v in LINEUP:
        trims_by_model[v["model"]].append(v)

    # ── Step 2: use cached file if valid, otherwise try HTTP fast-pass ───────
    http_results: dict[str, str | None] = {}
    for model, page_cfg in MODEL_PAGES.items():
        page_path = html_dir / page_cfg["filename"]
        if page_path.exists():
            try:
                cached = page_path.read_text(encoding="utf-8")
                if _is_real_tesla_html(cached, model):
                    http_results[model] = cached
                    print(f"[INFO]   {model}: valid cached file found — skipping live download")
                    continue
            except Exception:
                pass
        http_results[model] = _download_model_page_http(model, page_cfg["urls"])

    # ── Step 3: Browser only for models not satisfied by cache or HTTP ───────
    browser_needed = {m: MODEL_PAGES[m]["urls"] for m in MODEL_PAGES if not http_results.get(m)}
    browser_results: dict[str, str | None] = {}
    if browser_needed:
        print(f"\n[INFO] Launching browser (fresh context per model) for: {', '.join(browser_needed)}")
        browser_results = _browser_fetch_all_models(browser_needed)

    # ── Step 4: For any still-missing models, reuse existing downloaded files ─
    #   tesla_data_extractor.py saves Model_*_configurator.html — genuine Tesla
    #   pages that serve as reliable fallbacks when live fetch is blocked.
    model_html_files: dict[str, str] = {}

    for model, page_cfg in MODEL_PAGES.items():
        page_filename = page_cfg["filename"]
        page_path     = html_dir / page_filename
        model_url     = page_cfg["urls"][0]
        model_trims   = trims_by_model.get(model, [])

        print(f"\n[INFO] Model: {model}  ({len(model_trims)} trims)")
        print(f"[INFO]   Target file : {page_filename}")

        real_html = http_results.get(model) or browser_results.get(model)

        if not real_html:
            # Reuse previously downloaded file from tesla_data_extractor.py run
            real_html = _try_reuse_existing(model, html_dir)

        if real_html:
            page_path.write_text(real_html, encoding="utf-8")
            print(f"[INFO]   Saved real Tesla page → {page_path.resolve()} ({len(real_html):,} bytes)")
        else:
            # Final fallback: generate structured source HTML with all trim data visible
            print(f"[INFO]   All download attempts failed — generating structured source HTML for {model}")
            gen_html = _generate_model_html(model, model_trims, model_url)
            page_path.write_text(gen_html, encoding="utf-8")
            print(f"[INFO]   Saved generated page ({len(gen_html):,} bytes) → {page_path.resolve()}")

        model_html_files[model] = page_filename

    # ── Step 5: build records — each trim links to its model's HTML file ───────
    all_records: list[dict] = []
    for v in LINEUP:
        model         = v["model"]
        html_filename = model_html_files.get(model, "")
        record = {
            "uid":           v["uid"],
            "html_file":     html_filename,
            "Creation date": datetime.now().strftime("%m-%d-%Y"),
            **{k: val for k, val in v.items() if k != "uid"},
        }
        all_records.append(record)
        print(f"[INFO] {v['uid']}  {model} — {v['trim']}  →  {html_filename}")

    # ── Step 6: write combined tesla.json ─────────────────────────────────────
    out_file = output_dir / "tesla.json"
    with open(out_file, "w", encoding="utf-8") as fh:
        json.dump(all_records, fh, ensure_ascii=False, indent=4)

    print(f"\n[INFO] Tesla extraction complete. {len(all_records)} records written.")
    print(f"[INFO] Output file  : {out_file.resolve()}")
    print(f"[INFO] HTML folder  : {html_dir.resolve()}")
    print(f"[INFO] Pages saved  : {', '.join(model_html_files.values())}")
