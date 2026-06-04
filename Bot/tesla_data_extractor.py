"""
tesla_data_extractor.py  —  Tesla configurator bot
===================================================
Enumerates known Tesla models and trims from MODEL_ENGINES, writes one HITL
record per trim to Output/tesla.json.  All records include configurator_url so
the HITL left panel always shows the live Tesla configurator page via the
backend proxy — no HTML is downloaded or stored.
"""
import os
import json
from pathlib import Path
from datetime import datetime


# ── Paths ─────────────────────────────────────────────────────────────────────
BOT_DIR    = Path(__file__).parent
OUTPUT_DIR = BOT_DIR / "Output"

# ── Model / trim definitions ───────────────────────────────────────────────────
MODEL_ENGINES: dict[str, list[str]] = {
    "Model Y": ["Rear-Wheel Drive", "Long Range All-Wheel Drive", "Performance All-Wheel Drive"],
    "Model 3": ["Rear-Wheel Drive", "Long Range All-Wheel Drive", "Performance All-Wheel Drive"],
    "Model S": ["Long Range All-Wheel Drive", "Plaid"],
    "Model X": ["Long Range All-Wheel Drive", "Plaid"],
}

# Live Tesla URLs per model — (spec/overview page, configurator/design page)
MODEL_URLS: dict[str, tuple[str, str]] = {
    "Model Y": ("https://www.tesla.com/modely",  "https://www.tesla.com/modely/design"),
    "Model 3": ("https://www.tesla.com/model3",  "https://www.tesla.com/model3/design"),
    "Model S": ("https://www.tesla.com/models",  "https://www.tesla.com/models/design"),
    "Model X": ("https://www.tesla.com/modelx",  "https://www.tesla.com/modelx/design"),
}


# ── Main ───────────────────────────────────────────────────────────────────────

MAX_RECORDS = 3

if __name__ == '__main__':
    OUTPUT_DIR.mkdir(exist_ok=True)

    uid = 1
    all_records = []

    for model, engines in MODEL_ENGINES.items():
        if len(all_records) >= MAX_RECORDS:
            break
        technical_data_link, configurator_link = MODEL_URLS[model]
        print(f"\n[INFO] --- {model} ---")

        for engine in engines:
            if len(all_records) >= MAX_RECORDS:
                break
            print(f'[INFO]   {uid:03} : {model} — {engine}  →  {configurator_link}')

            record = {
                'uid':              f'TESLA_{uid:03}',
                'Creation date':    datetime.now().strftime('%m-%d-%Y'),
                'Brand':            'Tesla',
                'Country':          'USA',
                'Currency':         '$',
                'Price date':       datetime.now().strftime('%m-%d-%Y'),
                'model':            model,
                'configurator_url': configurator_link,
                'Configurator Page Link':   configurator_link,
                'Technical Data Page Link': technical_data_link,
                'trim': {
                    'name':  engine,
                    'price': '',
                    'type':  'Option',
                    'feature_details': {},
                },
                'pricing': {
                    'cash':    {'price': ''},
                    'lease':   {'price': '', 'Down Payment': '', 'Term': '', 'Annual Miles': ''},
                    'finance': {'price': '', 'Down Payment': '', 'Term': '', 'Est APR%': ''},
                },
                'Range (est.)':           '',
                'Range (est.)_Converted': '',
                '0-60 mph':               '',
                'Top Speed':              '',
                'Top Speed_Converted':    '',
                'Technical Data':         {},
            }

            indiv_path = OUTPUT_DIR / f'{model} {engine}.json'
            with open(str(indiv_path), 'w', encoding='utf-8') as fh:
                json.dump(record, fh, ensure_ascii=False, indent=4)

            all_records.append(record)
            uid += 1

    combined_path = OUTPUT_DIR / 'tesla.json'
    with open(str(combined_path), 'w', encoding='utf-8') as fh:
        json.dump(all_records, fh, ensure_ascii=False, indent=4)

    print(f'\n[INFO] Extraction complete. {len(all_records)} records written (limit: {MAX_RECORDS}).')
    print(f'[INFO] Combined output : {combined_path.resolve()}')
