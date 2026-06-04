"""
generate_hitl_html.py
Generates rich Tesla-styled HITL source pages from tesla.json for all 4 models.
Overwrites the existing tesla_model_*.html files so the HITL LHS shows real data
instead of a blank React shell.
"""
import json
from pathlib import Path
from datetime import datetime
from collections import defaultdict

BOT_DIR  = Path(__file__).parent
HTML_DIR = BOT_DIR / "HTML"
HTML_DIR.mkdir(exist_ok=True)

tesla = json.loads((BOT_DIR / "Output" / "tesla.json").read_text(encoding="utf-8"))

by_model = defaultdict(list)
for r in tesla:
    by_model[r["model"]].append(r)

MODEL_TO_FILE = {
    "Model Y": "tesla_model_y.html",
    "Model 3": "tesla_model_3.html",
    "Model S": "tesla_model_s.html",
    "Model X": "tesla_model_x.html",
}

def build_page(model: str, trims: list) -> str:
    slug = model.lower().replace(" ", "")
    cfg_url = f"https://www.tesla.com/{slug}/design"

    trim_blocks = ""
    for v in trims:
        trim_val = v.get("trim", "")
        name  = trim_val.get("name", str(trim_val)) if isinstance(trim_val, dict) else str(trim_val)
        price = (trim_val.get("price", "") if isinstance(trim_val, dict) else "") or v.get("price_cash", "")
        rng   = v.get("Range (est.)", "") or v.get("range_mi", "")
        rng_c = v.get("Range (est.)_Converted", "")
        acc   = v.get("0-60 mph", "") or v.get("acceleration", "")
        spd   = v.get("Top Speed", "") or v.get("top_speed", "")
        spd_c = v.get("Top Speed_Converted", "")
        tech  = v.get("Technical Data", {}) if isinstance(v.get("Technical Data"), dict) else {}
        hp    = tech.get("Performance Peak Power", "") or v.get("horsepower", "")
        bat   = tech.get("Performance Battery", "")   or v.get("battery_kwh", "")
        dr    = tech.get("Performance Drivetrain", "") or v.get("drivetrain", "")
        uid   = v.get("uid", "")
        paint = v.get("PAINT", v.get("paint_options", []))

        def opt_row(o, key):
            nm = o.get(key, o.get("color", o.get("interior_type", "?")))
            pr = o.get("price", "")
            sel = " sel" if o.get("type") == "Std" else ""
            return f'<div class="opt{sel}"><span class="on">{nm}</span><span class="op">{pr}</span></div>'

        paints_html = "".join(opt_row(p, "color") for p in paint[:6])
        rng_conv  = f'<div class="cv">{rng_c}</div>' if rng_c else ""
        spd_conv  = f'<div class="cv">{spd_c}</div>'  if spd_c else ""

        trim_blocks += f"""
<div class="tc" id="{uid}">
  <div class="th">
    <span class="tn">{name}</span>
    <span class="tb">UID: {uid}</span>
    <span class="tp">{price}</span>
  </div>
  <div class="sg">
    <div class="sp"><div class="sv">{rng}</div>{rng_conv}<div class="sl">EPA Range</div></div>
    <div class="sp"><div class="sv">{acc}</div><div class="sl">0-60 mph</div></div>
    <div class="sp"><div class="sv">{spd}</div>{spd_conv}<div class="sl">Top Speed</div></div>
    <div class="sp"><div class="sv">{hp}</div><div class="sl">Peak Power</div></div>
    <div class="sp"><div class="sv">{bat}</div><div class="sl">Battery</div></div>
    <div class="sp"><div class="sv">{dr}</div><div class="sl">Drivetrain</div></div>
  </div>
  <div class="os"><div class="ol">Exterior Color</div>{paints_html}</div>
</div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<base href="https://www.tesla.com/">
<title>Tesla {model} — Configurator Data</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;background:#171a20;color:#e8e8e8;font-size:14px;line-height:1.5}}
.nav{{background:#000;padding:14px 40px;display:flex;align-items:center;gap:16px;border-bottom:1px solid #111}}
.nav .logo{{font-size:20px;font-weight:700;letter-spacing:3px;color:#fff}}
.nav .mn{{font-size:12px;color:#888}}
.nav .src{{margin-left:auto;font-size:10px;font-family:monospace;color:#555}}
.ph{{padding:28px 40px 20px;border-bottom:1px solid #222}}
.ph h1{{font-size:28px;font-weight:300;letter-spacing:-.5px}}
.ph .sub{{font-size:13px;color:#888;margin-top:6px}}
.ph .tc-count{{display:inline-block;margin-top:10px;padding:3px 10px;border:1px solid #3e6ae1;color:#3e6ae1;font-size:11px;font-family:monospace;border-radius:3px}}
.tc{{margin:24px 40px;border:1px solid #2a2a2a;border-radius:6px;overflow:hidden}}
.th{{background:#1a1a2e;padding:18px 24px;display:flex;align-items:center;gap:16px;border-bottom:1px solid #2a2a2a}}
.tn{{font-size:18px;font-weight:500}}
.tb{{font-size:10px;font-family:monospace;background:#0d0d1a;padding:2px 8px;border-radius:3px;border:1px solid #333;color:#3e6ae1}}
.tp{{margin-left:auto;font-size:22px;font-weight:600;color:#3e6ae1}}
.sg{{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#222}}
.sp{{background:#1b1b1b;padding:18px;text-align:center}}
.sv{{font-size:20px;font-weight:500;color:#fff}}
.cv{{font-size:11px;color:#3e6ae1;margin-top:2px;font-family:monospace}}
.sl{{font-size:10px;color:#666;margin-top:4px;text-transform:uppercase;letter-spacing:1px}}
.os{{padding:16px 24px;border-top:1px solid #2a2a2a}}
.ol{{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#555;margin-bottom:10px;font-weight:500}}
.opt{{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border:1px solid #2a2a2a;border-radius:4px;margin-bottom:6px;background:#111}}
.opt.sel{{border-color:#3e6ae1;background:rgba(62,106,225,.1)}}
.on{{color:#ccc;font-size:13px}}.op{{color:#888;font-size:12px;font-family:monospace}}
.ft{{padding:18px 40px;border-top:1px solid #1a1a1a;font-size:10px;color:#444;font-family:monospace;margin-top:28px}}
.ft a{{color:#3e6ae1;text-decoration:none}}
</style>
</head>
<body>
<div class="nav">
  <div class="logo">TESLA</div>
  <div class="mn">Tesla {model} — All Trims · Configurator Data</div>
  <div class="src">{cfg_url}</div>
</div>
<div class="ph">
  <h1>Tesla {model}</h1>
  <div class="sub">2025 US lineup · {len(trims)} trim variant{"s" if len(trims) != 1 else ""} · Extracted {datetime.now().strftime("%Y-%m-%d")}</div>
  <span class="tc-count">{len(trims)} TRIM{"S" if len(trims) != 1 else ""}</span>
</div>
{trim_blocks}
<div class="ft">
  Source: <a href="{cfg_url}">{cfg_url}</a> · Country: USA · Currency: USD · Brand: Tesla
</div>
</body>
</html>"""


for model, trims in by_model.items():
    filename = MODEL_TO_FILE.get(model)
    if not filename:
        continue
    page = build_page(model, trims)
    out = HTML_DIR / filename
    out.write_text(page, encoding="utf-8")
    print(f"  {model:12s} -> {filename}  ({len(page):,} bytes, {len(trims)} trims)")

print("\nDone. All 4 model HTML files updated.")
