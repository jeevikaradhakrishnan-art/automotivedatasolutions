"""
tesla_data_extractor.py  —  Original Tesla configurator bot
============================================================
Parsing logic is exactly as originally written.

Additions (marked NEW):
  1. _ensure_html_files()  — downloads real Tesla pages via a single Playwright
     browser session and saves them as the filenames this script expects:
       HTML/{model} Spec Data.html
       HTML/{model}_{engine}.html   (one per trim, sharing the model's page)
     Falls back to existing Model_*_configurator.html / tesla_model_*.html files
     already present in Bot/HTML/.
  2. html_file + uid added to every output record.
  3. Combined Output/tesla.json written at the end (backend reads this for HITL).
"""
import requests
import os
import time
import random
from pathlib import Path
from bs4 import BeautifulSoup
import json
import re
from datetime import datetime
from urllib.parse import urljoin


# ── Paths ─────────────────────────────────────────────────────────────────────
BOT_DIR    = Path(__file__).parent
HTML_DIR   = BOT_DIR / "HTML"
CACHE_DIR  = BOT_DIR / "Cache"
OUTPUT_DIR = BOT_DIR / "Output"

BASE_URL = "https://www.tesla.com"

# Engines (trims) per model — used to name the per-trim HTML files
MODEL_ENGINES: dict[str, list[str]] = {
    "Model Y": ["Rear-Wheel Drive", "Long Range All-Wheel Drive", "Performance All-Wheel Drive"],
    "Model 3": ["Rear-Wheel Drive", "Long Range All-Wheel Drive", "Performance All-Wheel Drive"],
    "Model S": ["Long Range All-Wheel Drive", "Plaid"],
    "Model X": ["Long Range All-Wheel Drive", "Plaid"],
}

# Fallback candidates ordered by preference — largest/richest file first.
# Model S/X prefer the spec page (1.75 MB) over the 224 KB inventory stub.
_FALLBACK_CANDIDATES: dict[str, list[str]] = {
    "Model Y": ["tesla_model_y.html", "Model_Y_configurator.html"],
    "Model 3": ["tesla_model_3.html", "Model_3_configurator.html"],
    "Model S": ["Model_S_spec.html", "tesla_model_s.html", "Model_S_configurator.html"],
    "Model X": ["Model_X_spec.html", "tesla_model_x.html", "Model_X_configurator.html"],
}

_UA_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0",
]


# ── NEW: HTML file setup ───────────────────────────────────────────────────────

def _is_real_tesla_page(html: str, model: str) -> bool:
    if len(html) < 20_000:
        return False
    lower = html.lower()
    slug  = model.lower().replace(" ", "")
    hits  = sum(1 for m in [slug, "tesla", "autopilot", "range", "starting at"] if m in lower)
    return hits >= 3


def _inject_base(html: str) -> str:
    base = f'<base href="{BASE_URL}/">'
    if "<head>" in html:
        return html.replace("<head>", f"<head>{base}", 1)
    return base + html


def _dismiss_overlays(page) -> None:
    page.evaluate("""
    (() => {
        const hide = el => {
            el.style.setProperty('display','none','important');
            el.style.setProperty('visibility','hidden','important');
            el.style.setProperty('opacity','0','important');
            el.style.setProperty('pointer-events','none','important');
        };
        const clickText = /accept all|accept cookies|agree|continue|got it|allow|dismiss|close|reject|decline/i;
        for (const sel of ['button','a','input[type=button]','input[type=submit]']) {
            for (const el of document.querySelectorAll(sel)) {
                const t = (el.innerText||el.value||el.getAttribute('aria-label')||'').trim();
                if (clickText.test(t)) try { el.click(); } catch(e){}
            }
        }
        for (const sel of ['[role=dialog]','[aria-modal=true]','[id*=cookie]','[class*=cookie]',
            '[id*=consent]','[class*=consent]','[id*=modal]','[class*=modal]',
            '[id*=overlay]','[class*=overlay]','[id*=scrim]','[class*=scrim]',
            '[id*=zip]','[id*=postal]','[id*=location]','[id*=region]']) {
            for (const el of document.querySelectorAll(sel)) hide(el);
        }
        const style = document.createElement('style');
        style.textContent = `html,body{overflow:auto!important;height:auto!important}
            .tds-modal,.tds-scrim,.tds-modal-backdrop,[class*=cookie],[class*=consent],
            [class*=overlay],[class*=scrim],[class*=modal]{display:none!important}`;
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
            document.body.style.setProperty('pointer-events','auto','important');
            document.body.style.setProperty('overflow','auto','important');
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


def _ensure_html_files() -> None:
    """
    Download one real Tesla page per model and create the HTML files the script
    needs:  {model} Spec Data.html  and  {model}_{engine}.html.

    Priority order:
      1. Reuse an existing real Tesla file (ordered: largest/richest first).
      2. Playwright — FRESH CONTEXT per model (new cookies each time so Tesla's
         CDN cannot link models via session fingerprinting and issue 403s).
      3. Placeholder HTML as last resort.
    """
    HTML_DIR.mkdir(exist_ok=True)

    model_urls_map = {
        "Model Y": ["https://www.tesla.com/modely/design", "https://www.tesla.com/modely"],
        "Model 3": ["https://www.tesla.com/model3/design", "https://www.tesla.com/model3"],
        "Model S": ["https://www.tesla.com/models/design", "https://www.tesla.com/models"],
        "Model X": ["https://www.tesla.com/modelx/design", "https://www.tesla.com/modelx"],
    }

    needed: dict[str, bool] = {}
    for model, engines in MODEL_ENGINES.items():
        spec_file    = HTML_DIR / f"{model} Spec Data.html"
        engine_files = [HTML_DIR / f"{model}_{eng}.html" for eng in engines]
        if any(not f.exists() for f in [spec_file] + engine_files):
            needed[model] = True

    if not needed:
        print("[INFO] All required HTML files present — skipping download.")
        return

    print(f"[INFO] Need to set up HTML files for: {', '.join(needed)}")

    def _write_model_files(model: str, html: str) -> None:
        spec_path = HTML_DIR / f"{model} Spec Data.html"
        if not spec_path.exists():
            spec_path.write_text(html, encoding="utf-8")
        for eng in MODEL_ENGINES[model]:
            eng_path = HTML_DIR / f"{model}_{eng}.html"
            if not eng_path.exists():
                eng_path.write_text(html, encoding="utf-8")

    still_needed: list[str] = []

    # ── Step 1: reuse existing files (prefer largest valid file per model) ─────
    for model in list(needed.keys()):
        reuse_html = None
        for candidate in _FALLBACK_CANDIDATES.get(model, []):
            p = HTML_DIR / candidate
            if not p.exists():
                continue
            try:
                html = p.read_text(encoding="utf-8")
                if _is_real_tesla_page(html, model):
                    reuse_html = html
                    print(f"[INFO]   {model}: reusing {candidate} ({len(html):,} bytes)")
                    break
            except Exception:
                continue

        if reuse_html:
            _write_model_files(model, reuse_html)
        else:
            still_needed.append(model)

    if not still_needed:
        return

    # ── Step 2: Playwright with FRESH CONTEXT per model ───────────────────────
    # A shared context accumulates session cookies; after the first successful
    # download Tesla's CDN flags it and returns 403 for subsequent pages.
    # A fresh context starts with no cookies — each model looks like a new visitor.
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=False,
                args=["--disable-blink-features=AutomationControlled",
                      "--disable-dev-shm-usage", "--no-sandbox",
                      "--disable-setuid-sandbox", "--window-size=1600,900"],
            )

            # Snapshot the list so mutations during iteration are safe
            models_to_fetch = list(still_needed)
            succeeded: list[str] = []

            for idx, model in enumerate(models_to_fetch):
                ua = _UA_POOL[idx % len(_UA_POOL)]
                print(f"[INFO]   Browser: fresh context for {model} (UA #{idx % len(_UA_POOL) + 1})")

                ctx = browser.new_context(
                    user_agent=ua, viewport={"width": 1600, "height": 900},
                    locale="en-US", bypass_csp=True, ignore_https_errors=True,
                )
                ctx.set_extra_http_headers({
                    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Upgrade-Insecure-Requests": "1",
                })
                page = ctx.new_page()
                page.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")
                page.add_init_script("Object.defineProperty(navigator,'platform',{get:()=>'Win32'})")
                page.add_init_script("Object.defineProperty(navigator,'plugins',{get:()=>[1,2,3,4,5]})")

                fetched_html = None
                try:
                    # Homepage warm-up for this fresh session
                    page.goto("https://www.tesla.com/", wait_until="domcontentloaded",
                              timeout=30000, referer="https://www.google.com/search?q=tesla+cars")
                    page.wait_for_timeout(random.randint(2500, 4000))
                    _dismiss_overlays(page)

                    for url in model_urls_map.get(model, []):
                        try:
                            resp = page.goto(url, wait_until="domcontentloaded",
                                             timeout=60000, referer="https://www.tesla.com/")
                            # Wait for network idle so React fully populates the DOM
                            try:
                                page.wait_for_load_state("networkidle", timeout=20000)
                            except Exception:
                                pass
                            page.wait_for_timeout(2000)
                            _dismiss_overlays(page)
                            page.wait_for_timeout(1000)
                            html = page.content()
                            if _is_real_tesla_page(html, model):
                                fetched_html = _inject_base(html)
                                print(f"[INFO]   ✓ Browser: {model} ({len(fetched_html):,} bytes) from {url}")
                                break
                            print(f"[WARN]   Browser {url} → {len(html):,} bytes — not valid Tesla content")
                        except Exception as exc:
                            print(f"[WARN]   Browser fetch {url}: {exc}")
                except Exception as exc:
                    print(f"[WARN]   Context error for {model}: {exc}")
                finally:
                    ctx.close()   # release cookies/storage before next model

                if fetched_html:
                    _write_model_files(model, fetched_html)
                    succeeded.append(model)

                # Pause between models — only if more models remain
                if idx < len(models_to_fetch) - 1:
                    gap = random.uniform(8, 14)
                    print(f"[INFO]   Pausing {gap:.1f}s before next model …")
                    time.sleep(gap)

            # Remove successfully fetched models from the still-needed list
            for m in succeeded:
                if m in still_needed:
                    still_needed.remove(m)

            browser.close()
    except Exception as exc:
        print(f"[WARN]   Browser session error: {exc}")

    # ── Step 3: placeholder HTML for any models that could not be downloaded ───
    for model in still_needed:
        print(f"[WARN]   {model}: download failed — writing placeholder HTML")
        placeholder = (
            f'<!DOCTYPE html><html><head><meta charset="UTF-8">'
            f'<base href="https://www.tesla.com/"><title>Tesla {model}</title></head>'
            f'<body style="font-family:sans-serif;background:#171a20;color:#eee;padding:40px">'
            f'<h1 style="color:#e31937">Tesla {model}</h1>'
            f'<p>Source page could not be downloaded. '
            f'Run the bot with an active internet connection.</p></body></html>'
        )
        _write_model_files(model, placeholder)


# ── Original parsing helpers (unchanged) ──────────────────────────────────────

def regex_match(regex, content):
    match = re.search(regex, content, flags=re.I)
    if match:
        return match.group(1)
    return ''


def miles_2_km(value):
    clean_value = re.sub(r'[^\d.]', '', value)
    if not clean_value:
        return '0'
    clean_value = int(clean_value) if '.' not in clean_value else float(clean_value)
    return str(round(clean_value * 1.60934, 1))


def hp_2_kw(value):
    clean_value = re.sub(r'[^\d.]', '', value)
    if not clean_value:
        return '0'
    clean_value = int(clean_value) if '.' not in clean_value else float(clean_value)
    return str(round(clean_value * 0.7457, 1))


def lbs_2_kg(value):
    clean_value = re.sub(r'[^\d.]', '', value)
    if not clean_value:
        return '0'
    clean_value = int(clean_value) if '.' not in clean_value else float(clean_value)
    return str(round(clean_value * 0.453592, 1))


# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    HTML_DIR.mkdir(exist_ok=True)
    CACHE_DIR.mkdir(exist_ok=True)
    OUTPUT_DIR.mkdir(exist_ok=True)

    # NEW: download / set up HTML files before parsing begins
    _ensure_html_files()

    tesla_menus = json.load(open(str(CACHE_DIR / 'tesla_menus.json'), 'r', encoding='utf-8'))
    uid = 1
    home_url = 'https://www.tesla.com/models'

    all_records = []   # NEW: accumulates every trim for combined tesla.json

    for model_block in tesla_menus['centerLinks'][0]['panel']['products']:
        model = model_block['title']
        if model == 'Inventory':
            continue

        print(f"\n[INFO] ─── {model} ───")
        technical_data_link = urljoin(home_url, model_block['links'][0]['href'])
        configurator_link   = urljoin(home_url, model_block['links'][1]['href'])

        # ── Parse spec page (gives us tech data for every engine tab) ─────────
        spec_file = str(HTML_DIR / f'{model} Spec Data.html')
        try:
            with open(spec_file, 'r', encoding='utf-8') as fh:
                content = fh.read()
        except FileNotFoundError:
            print(f"[WARN]   Spec file missing: {spec_file} — skipping {model}")
            continue

        technical_data = {}
        soup  = BeautifulSoup(content, 'html.parser')
        soup1 = BeautifulSoup(content, 'html.parser')

        for engine_block in soup.find_all('button', attrs={'class': 'tds-tab tcl-tab-list__tab'}):
            engine_name = engine_block.get_text().strip()
            engine_name = re.sub(r'(?:AWD|^Model \w$)', 'All-Wheel Drive', engine_name, flags=re.I)
            engine_name = re.sub(r'RWD', 'Rear-Wheel Drive', engine_name, flags=re.I)
            engine_name = re.sub(r'Performance\b', 'Performance All-Wheel Drive', engine_name, flags=re.I)
            engine_name = re.sub(r'Model \w\s+', '', engine_name, flags=re.I).strip()
            technical_data[engine_name] = {}
            engine_id = engine_block.get('id')
            engine_spec_block = soup1.find('section', attrs={'aria-labelledby': engine_id})
            if engine_spec_block:
                for spec_row in engine_spec_block.find_all('div', attrs={'class': 'tcl-specs-table__row'}):
                    row_header = spec_row.find('h4').get_text().strip()
                    for tcl_spec_block in spec_row.find_all('div', attrs={'class': 'tcl-spec'}):
                        try:
                            spec_key   = tcl_spec_block.find('h6').get_text().strip()
                            spec_value = tcl_spec_block.find('div').get_text().strip()
                            technical_data[engine_name][f'{row_header} {spec_key}'] = spec_value
                            if spec_key in ['Range (EPA est.)', 'Top Speed', 'Range (est.)']:
                                technical_data[engine_name][f'{row_header} {spec_key}_Converted'] = f'{miles_2_km(spec_value)} kph'
                            elif spec_key in ['Peak Power']:
                                technical_data[engine_name][f'{row_header} {spec_key}_Converted'] = f'{hp_2_kw(spec_value)} kW'
                            elif spec_key in ['Weight (Curb Mass)', 'Towing', 'Weight']:
                                technical_data[engine_name][f'{row_header} {spec_key}_Converted'] = f'{lbs_2_kg(spec_value)} kg'
                        except Exception:
                            pass

        # If spec page had no engine tabs, seed from MODEL_ENGINES so the loop below still runs
        if not technical_data:
            for eng in MODEL_ENGINES.get(model, []):
                technical_data[eng] = {}

        # ── Parse per-engine configurator file ────────────────────────────────
        for engine in list(technical_data.keys()):
            print(f'[INFO]   {uid} : engine : {engine}')
            output_json = {
                'Creation date': datetime.now().strftime('%m-%d-%Y'),
                'UID': f'{uid:03}',
                'Country': 'USA',
                'Brand': 'Tesla',
            }

            # NEW: the html_file for this HITL record
            html_filename = f'{model}_{engine}.html'
            engine_html_path = str(HTML_DIR / html_filename)

            try:
                with open(engine_html_path, 'r', encoding='utf-8') as fh:
                    content = fh.read()
            except FileNotFoundError:
                print(f"[WARN]   Engine file missing: {engine_html_path} — skipping")
                uid += 1
                continue

            soup = BeautifulSoup(content, 'html.parser')
            groups_data = soup.find_all('div', attrs={'class': 'group-section--container'})

            for group_data in groups_data:
                group_header = group_data.get('data-group-id')

                if group_header == 'BATTERY_AND_DRIVE':
                    try:
                        model_name = group_data.find('h1').get_text().strip()
                    except Exception:
                        model_name = model
                    engine_block = group_data.find('div', attrs={'data-id-selected': 'true'})
                    if not engine_block:
                        model_name = model
                        engine_name_parsed = engine
                        base_price = ''
                        lease_price = lease_down_payment = lease_term = lease_annual_miles = ''
                        finance_price = finance_down_payment = finance_term = est_apr = ''
                        range_est = top_speed = acceleration = ''
                    else:
                        try:
                            engine_name_parsed = engine_block.find('span', attrs={'class': 'tds-label-title tds-o-label-title'}).get_text().strip()
                        except Exception:
                            try:
                                engine_name_parsed = engine_block.find('div', attrs={'class': 'trim-option-title tds-flex-item tds-text--h6'}).get_text().strip()
                            except Exception:
                                engine_name_parsed = engine
                        try:
                            base_price = engine_block.find('p', attrs={'data-id': re.compile(r'price$')}).get_text().strip()
                        except Exception:
                            try:
                                base_price = engine_block.find('div', attrs={'class': re.compile(r'trim-option-price')}).get_text().strip()
                            except Exception:
                                base_price = ''

                        # Lease data
                        try:
                            lease_block = group_data.find('div', attrs={'class': 'Lease'})
                            lease_sel = lease_block.find('div', attrs={'data-id-selected': 'true'})
                            try:
                                lease_price = re.sub(r'\s\s+', ' ', lease_sel.find('p', attrs={'data-id': re.compile(r'price$')}).get_text().strip())
                            except Exception:
                                lease_price = re.sub(r'\s\s+', ' ', lease_sel.find('div', attrs={'class': re.compile(r'trim-option-price')}).get_text().strip())
                            lease_payment = lease_block.find('div', attrs={'class': re.compile(r'finance-disclaimer')}).get_text().strip()
                            lease_down_payment = re.sub(r'\s\s+', ' ', regex_match(r'\$([\d\,\.]+?)\s*down', lease_payment))
                            lease_term         = re.sub(r'\s\s+', ' ', regex_match(r'(\d+\s*months)', lease_payment))
                            lease_annual_miles = re.sub(r'\s\s+', ' ', regex_match(r'([\d\,]+?\s*miles)', lease_payment))
                        except Exception:
                            lease_price = lease_down_payment = lease_term = lease_annual_miles = ''

                        # Finance data
                        try:
                            finance_block = group_data.find('div', attrs={'class': 'Finance'})
                            finance_sel = finance_block.find('div', attrs={'data-id-selected': 'true'})
                            try:
                                finance_price = re.sub(r'\s\s+', ' ', finance_sel.find('p', attrs={'data-id': re.compile(r'price$')}).get_text().strip())
                            except Exception:
                                finance_price = re.sub(r'\s\s+', ' ', finance_sel.find('div', attrs={'class': re.compile(r'trim-option-price')}).get_text().strip())
                            finance_payment    = finance_block.find('div', attrs={'class': re.compile(r'finance-disclaimer')}).get_text().strip()
                            finance_down_payment = re.sub(r'\s\s+', ' ', regex_match(r'\$([\d\,\.]+?)\s*(?:\(\d+\%\)\s*)?down', finance_payment))
                            finance_term       = re.sub(r'\s\s+', ' ', regex_match(r'(\d+\s*months)', finance_payment))
                            est_apr            = re.sub(r'\s\s+', ' ', regex_match(r'([\d\,\.]+?\%\s*APR)', finance_payment))
                        except Exception:
                            finance_price = finance_down_payment = finance_term = est_apr = ''

                        # Specs
                        try:
                            spec_data_block = group_data.find('div', attrs={'class': 'group-block specs-block tds--vertical_padding'})
                            range_est   = spec_data_block.find('div', attrs={'data-id': 'range'}).get_text().strip()
                            acceleration = spec_data_block.find('div', attrs={'data-id': 'acceleration'}).get_text().strip()
                            try:
                                top_speed = spec_data_block.find('div', attrs={'data-id': 'top-speed'}).get_text().strip()
                            except Exception:
                                top_speed = ''
                        except Exception:
                            range_est = top_speed = acceleration = ''

                    output_json['model'] = model_name
                    output_json['Configurator Page Link']   = configurator_link
                    output_json['Technical Data Page Link'] = technical_data_link
                    output_json['Currency']   = '$'
                    output_json['Price date'] = datetime.now().strftime('%m-%d-%Y')
                    output_json['trim'] = {
                        'name': engine_name_parsed or engine,
                        'price': base_price,
                        'type': 'Option',
                        'feature_details': {},
                    }
                    output_json['pricing'] = {
                        'cash':    {'price': base_price},
                        'lease':   {'price': lease_price,   'Down Payment': lease_down_payment,
                                    'Term': lease_term,     'Annual Miles': lease_annual_miles},
                        'finance': {'price': finance_price, 'Down Payment': finance_down_payment,
                                    'Term': finance_term,   'Est APR%': est_apr},
                    }
                    output_json['Range (est.)']           = re.sub(r'\s\s+', ' ', range_est)
                    output_json['Range (est.)_Converted'] = miles_2_km(re.sub(r'\s\s+', ' ', range_est)) + ' kph'
                    if top_speed:
                        output_json['Top Speed']           = re.sub(r'\s\s+', ' ', top_speed)
                        output_json['Top Speed_Converted'] = miles_2_km(re.sub(r'\s\s+', ' ', top_speed)) + ' kph'
                    output_json['0-60 mph']        = re.sub(r'\s\s+', ' ', acceleration)
                    output_json['Technical Data']  = technical_data.get(engine, {})

                    for add_features in soup.find_all('div', attrs={'class': 'text-loader tds-text_color--30 group--options_dynamic_disclaimer tds-text--left tds-text--regular--container'}):
                        if add_features.find('h2'):
                            header = add_features.find('h2').get_text().strip()
                            output_json['trim'][header] = [li.get_text().strip() for li in add_features.find_all('li')]

                elif group_header in ['PAINT', 'WHEELS', 'PACKAGES', 'INTERIOR']:
                    output_json[group_header] = []
                    group_child_blocks = group_data.find_all('div', attrs={'class': re.compile(r'group--child-container group')})
                    colors_block = (
                        group_child_blocks[0].find_all('div', attrs={'class': re.compile(r'observer-placeholder tds-option--type tds-option--(?:circular|square)')})
                        if group_child_blocks else
                        group_data.find_all('div', attrs={'class': re.compile(r'observer-placeholder tds-option--type tds-option--(?:circular|square)')})
                    )
                    std_flag = 0
                    for color_block in colors_block:
                        try:
                            color_name  = color_block.find('title').get_text().strip()
                            color_price = regex_match(r'\s+\-\s+(\S+)$', color_block.find('input').get('aria-label'))
                            color_type  = 'Option'
                            if color_price.lower() == 'included':
                                color_type  = 'Std'
                                color_price = '0'
                                std_flag   += 1
                            if std_flag > 1 and color_price == '0':
                                color_type = 'NCO'
                            if group_header in ['PAINT', 'PACKAGES']:
                                output_json[group_header].append({'color': color_name, 'price': color_price, 'type': color_type})
                            elif group_header in ['WHEELS', 'INTERIOR']:
                                output_json[group_header].append({f'{group_header.lower()}_type': color_name, 'price': color_price, 'type': color_type})
                        except Exception:
                            pass

                    if len(group_child_blocks) == 2:
                        h2 = group_child_blocks[1].find('h2')
                        if h2 and h2.get_text().strip().lower() == 'steering wheel':
                            output_json['STEERING_WHEEL'] = []
                            sw_blocks = group_child_blocks[1].find_all('div', attrs={'class': 'observer-placeholder tds-option--type tds-option--circular'})
                            std_flag = 0
                            for sw in sw_blocks:
                                try:
                                    n = sw.find('title').get_text().strip()
                                    p = regex_match(r'\s+\-\s+(\S+)$', sw.find('input').get('aria-label'))
                                    t = 'Option'
                                    if p.lower() == 'included':
                                        t = 'Std'; p = '0'; std_flag += 1
                                    if std_flag > 1 and p == '0':
                                        t = 'NCO'
                                    output_json['STEERING_WHEEL'].append({'steering_type': n, 'price': p, 'type': t})
                                except Exception:
                                    pass

            # ── Feature details (original logic, unchanged) ────────────────────
            feature_block = soup.find('dialog', attrs={'id': 'STD_FEATURES'})
            if feature_block:
                if feature_block.find('div', attrs={'id': 'featureGroup-RANGE_AND_PERFORMANCE'}):
                    rp = feature_block.find('div', attrs={'id': 'featureGroup-RANGE_AND_PERFORMANCE'})
                    output_json['trim']['feature_details']['range_and_performance'] = {}
                    group_items = rp.find('div', attrs={'class': 'tds-flex tds-flex-gutters'})
                    for gi in group_items.find_all('div', attrs={'class': re.compile(r'tds-flex-item')}):
                        header = gi.find('li').get_text().strip()
                        value  = regex_match(f'<td[^>]*?>\\s*{engine}\\s*<\\/td>\\s*<td[^>]*?>\\s*([\\w\\W]+?)\\s*<\\/td>', gi.prettify())
                        output_json['trim']['feature_details']['range_and_performance'][header] = value
                        if header == 'Top Speed':
                            output_json['trim']['feature_details']['range_and_performance'][f'{header}_Converted'] = f'{miles_2_km(value)} kph'
                        elif header == 'Estimated Range':
                            output_json['trim']['feature_details']['range_and_performance'][f'{header}_Converted'] = (
                                miles_2_km(regex_match(r'(\d+)\s+\-', value)) + ' - ' +
                                miles_2_km(regex_match(r'\-\s+(\d+)', value)) + ' kph'
                            )
                for fg in feature_block.find_all('div', attrs={'class': re.compile(r'feature-copy-container')}):
                    try:
                        fh_text = fg.find('h3').get_text().strip()
                        fv_text = fg.find('div', attrs={'class': re.compile(r'feature-description')}).get_text().strip()
                        output_json['trim']['feature_details'][fh_text] = fv_text
                    except Exception:
                        pass

            # ── Interior features ──────────────────────────────────────────────
            interior_dlg = soup.find('dialog', attrs={'id': 'INTERIOR_FEATURES'})
            if interior_dlg:
                for fg in interior_dlg.find_all('div', attrs={'class': re.compile(r'(?:feature-copy-container|carousel-modal--panel-content)')}):
                    try:
                        fh_text = fg.find('h3').get_text().strip()
                        if fh_text == 'Interior Features':
                            output_json['Interior Features'] = {}
                            for sub in fg.find_all('div', attrs={'class': 'text-loader tds-text_color--30 tds--vertical_padding tds-text--caption--container'}):
                                sh = sub.find('h4').get_text().strip()
                                output_json['Interior Features'][sh] = [li.get_text().strip() for li in sub.find_all('li')]
                        elif fh_text == 'Connectivity Packages':
                            output_json[fh_text] = {}
                            for tr in fg.find('tbody').find_all('tr'):
                                td = tr.find_all('td')
                                if td:
                                    if re.search('tds-text--medium', str(td[0])):
                                        header = re.sub(r'\s\s+', ' ', td[0].get_text().strip())
                                        output_json[fh_text][header] = {}
                                        continue
                                    sub_header = re.sub(r'\s\s+', ' ', td[0].get_text().strip())
                                    std_v = 'Yes' if re.search('stroke="#12BB00"', str(td[1])) else 'No'
                                    prm_v = 'Yes' if re.search('stroke="#12BB00"', str(td[2])) else 'No'
                                    output_json[fh_text][header][sub_header] = {'Standard': std_v, 'Premium': prm_v}
                        else:
                            output_json[fh_text] = fg.find('div', attrs={'class': re.compile(r'feature-description')}).get_text().strip()
                    except Exception:
                        pass

            # ── Price block ───────────────────────────────────────────────────
            pb = soup.find('div', attrs={'class': 'price-block'})
            if pb:
                output_json['Pricing Details'] = {}
                for li in pb.find_all('li'):
                    try:
                        if li.find('div', attrs={'class': 'label left'}):
                            lbl = re.sub(r'\s\s+', ' ', re.sub(r'\n+', ' ', li.find('div', attrs={'class': 'label left'}).get_text().strip()))
                            prc = li.find('span', attrs={'class': 'value'}).get_text().strip()
                            output_json['Pricing Details'][lbl] = prc
                        else:
                            spans = li.find_all('span')
                            output_json['Pricing Details'][spans[0].get_text().strip()] = spans[1].get_text().strip()
                    except Exception:
                        pass

            # ── NEW: attach uid + html_file ────────────────────────────────────
            output_json['uid']       = f'TESLA_{uid:03}'
            output_json['html_file'] = html_filename   # real Tesla page shown on HITL LHS

            # Write individual trim file (original behaviour)
            trim_name  = output_json.get('trim', {}).get('name', engine) if isinstance(output_json.get('trim'), dict) else engine
            model_name = output_json.get('model', model)
            indiv_path = OUTPUT_DIR / f'{model_name} {trim_name}.json'
            with open(str(indiv_path), 'w', encoding='utf-8') as fh:
                json.dump(output_json, fh, ensure_ascii=False, indent=4)

            all_records.append(output_json)
            print(f'[INFO]   TESLA_{uid:03}  {model_name} — {trim_name}  →  {html_filename}')
            uid += 1

    # ── NEW: write combined tesla.json for the backend / HITL ─────────────────
    combined_path = OUTPUT_DIR / 'tesla.json'
    with open(str(combined_path), 'w', encoding='utf-8') as fh:
        json.dump(all_records, fh, ensure_ascii=False, indent=4)

    print(f'\n[INFO] Extraction complete. {len(all_records)} records written.')
    print(f'[INFO] Combined output : {combined_path.resolve()}')
    print(f'[INFO] HTML folder     : {HTML_DIR.resolve()}')
