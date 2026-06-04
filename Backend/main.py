import os
import sys
import csv
import io
import json
import glob
import uuid
import threading
from datetime import datetime
from pathlib import Path
from typing import AsyncGenerator, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response

app = FastAPI(title="Automotive Data Solutions Bot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BOT_DIR = Path(__file__).parent.parent / "Bot"

BOTS: dict[str, dict] = {
    "bmw-configurator": {
        "name": "BMW Configurator",
        "script": "BMW_Data_Collector.py",
        "output_file": "bmw.json",
        "description": "Scrapes BMW UK configurator API for full pricing & options data",
    },
    "tesla-configurator": {
        "name": "Tesla Configurator",
        "script": "tesla_data_extractor.py",
        "output_file": "tesla.json",
        "description": "Downloads real Tesla configurator pages and extracts Model Y, 3, S & X trim data",
    },
}

# ── In-memory state ────────────────────────────────────────────────────────────

_state: dict[str, dict] = {
    bot_id: {"status": "idle", "logs": [], "output": [], "exit_code": None}
    for bot_id in BOTS
}
_locks: dict[str, threading.Lock] = {bot_id: threading.Lock() for bot_id in BOTS}

# Jobs store: job_id -> job dict
_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _append_log(bot_id: str, line: str) -> None:
    with _locks[bot_id]:
        _state[bot_id]["logs"].append(line)
        if len(_state[bot_id]["logs"]) > 2000:
            _state[bot_id]["logs"] = _state[bot_id]["logs"][-2000:]


def _hitl_fields_tesla(record: dict) -> list[dict]:
    """
    Build HITL field list from a tesla_data_extractor.py output record.
    Also handles tesla_live_extractor.py flat format as fallback.
    """
    trim = record.get("trim", {})
    trim_name  = trim.get("name",  "") if isinstance(trim, dict) else str(trim)
    trim_price = trim.get("price", "") if isinstance(trim, dict) else ""

    # Fallback to flat-format fields (tesla_live_extractor.py)
    trim_price = trim_price or record.get("price_cash", "")

    # pricing dict (original script has cash/lease/finance breakdown)
    pricing    = record.get("pricing", {}) if isinstance(record.get("pricing"), dict) else {}
    cash_price = (pricing.get("cash") or {}).get("price", "") or trim_price
    lease      = pricing.get("lease", {})  or {}
    finance    = pricing.get("finance", {}) or {}

    # Technical Data dict (original script populates this from spec-page tabs)
    tech = record.get("Technical Data", {}) if isinstance(record.get("Technical Data"), dict) else {}

    # Specs — original script fields first, live-extractor flat fields as fallback
    range_val  = record.get("Range (est.)",           "") or record.get("range_mi",    "")
    range_conv = record.get("Range (est.)_Converted", "")
    accel      = record.get("0-60 mph",               "") or record.get("acceleration", "")
    top_spd    = record.get("Top Speed",              "") or record.get("top_speed",    "")
    top_conv   = record.get("Top Speed_Converted",    "")
    country    = record.get("Country",  "") or record.get("country",  "USA")
    currency   = record.get("Currency", "") or record.get("currency", "$")
    price_date = record.get("Price date", "") or record.get("Creation date", "")
    uid_val    = record.get("uid", "") or record.get("UID", "")

    # Technical Data values — original script nests under "Performance ..." prefix
    def _td(key: str) -> str:
        return tech.get(f"Performance {key}", "") or tech.get(key, "")

    peak_pwr   = _td("Peak Power")   or record.get("horsepower",  "")
    battery    = _td("Battery")      or record.get("battery_kwh", "")
    drivetrain = _td("Drivetrain")   or record.get("drivetrain",  "")

    fields = [
        # ── Vehicle identity ────────────────────────────────────────────────
        {"group": "vehicle",  "name": "Brand",      "value": record.get("Brand", "Tesla"), "confidence": 100},
        {"group": "vehicle",  "name": "model",      "value": record.get("model", ""),      "confidence": 100},
        {"group": "vehicle",  "name": "trim",       "value": trim_name,                    "confidence": 100},
        # ── Pricing ─────────────────────────────────────────────────────────
        {"group": "pricing",  "name": "Cash price", "value": cash_price,                   "confidence": 98},
        {"group": "pricing",  "name": "Currency",   "value": currency,                     "confidence": 100},
        {"group": "pricing",  "name": "Price date", "value": price_date,                   "confidence": 100},
        # ── Specs ────────────────────────────────────────────────────────────
        {"group": "specs",    "name": "Range (est.)",           "value": range_val,        "confidence": 95},
        {"group": "specs",    "name": "Range (est.)_Converted", "value": range_conv,       "confidence": 95},
        {"group": "specs",    "name": "0-60 mph",               "value": accel,            "confidence": 95},
        {"group": "specs",    "name": "Top Speed",              "value": top_spd,          "confidence": 90},
        {"group": "specs",    "name": "Top Speed_Converted",    "value": top_conv,         "confidence": 90},
        {"group": "specs",    "name": "Peak Power",             "value": peak_pwr,         "confidence": 88},
        {"group": "specs",    "name": "Battery",                "value": battery,          "confidence": 88},
        {"group": "specs",    "name": "Drivetrain",             "value": drivetrain,       "confidence": 88},
        # ── Location / meta ──────────────────────────────────────────────────
        {"group": "location", "name": "Country",    "value": country,                      "confidence": 100},
        {"group": "meta",     "name": "UID",        "value": uid_val,                      "confidence": 100},
    ]

    # Lease breakdown (original script extracts these)
    if lease.get("price"):
        fields += [
            {"group": "lease", "name": "Lease price",         "value": lease.get("price", ""),         "confidence": 92},
            {"group": "lease", "name": "Lease down payment",  "value": lease.get("Down Payment", ""),  "confidence": 90},
            {"group": "lease", "name": "Lease term",          "value": lease.get("Term", ""),          "confidence": 90},
            {"group": "lease", "name": "Lease annual miles",  "value": lease.get("Annual Miles", ""),  "confidence": 90},
        ]
    # Finance breakdown
    if finance.get("price"):
        fields += [
            {"group": "finance", "name": "Finance price",        "value": finance.get("price", ""),          "confidence": 92},
            {"group": "finance", "name": "Finance down payment", "value": finance.get("Down Payment", ""),   "confidence": 90},
            {"group": "finance", "name": "Finance term",         "value": finance.get("Term", ""),           "confidence": 90},
            {"group": "finance", "name": "Est APR",              "value": finance.get("Est APR%", ""),       "confidence": 88},
        ]

    return fields


def _hitl_fields_bmw(record: dict) -> list[dict]:
    fields = [
        {"group": "vehicle",  "name": "Brand",       "value": record.get("Brand", ""),      "confidence": 100},
        {"group": "vehicle",  "name": "Name",        "value": record.get("Name", ""),       "confidence": 100},
        {"group": "vehicle",  "name": "Derivative",  "value": record.get("Derivative", ""), "confidence": 100},
        {"group": "vehicle",  "name": "Model Code",  "value": record.get("Model Code", ""), "confidence": 100},
        {"group": "vehicle",  "name": "Series",      "value": record.get("Series", ""),     "confidence": 100},
        {"group": "vehicle",  "name": "Body Style",  "value": record.get("Body Style", ""), "confidence": 100},
        {"group": "vehicle",  "name": "Fuel Type",   "value": record.get("Fuel Type", ""),  "confidence": 100},
        {"group": "vehicle",  "name": "Drive Type",  "value": record.get("Drive Type", ""), "confidence": 100},
        {"group": "vehicle",  "name": "Doors",       "value": str(record.get("Doors", "")), "confidence": 100},
        {"group": "pricing",  "name": "Price",       "value": str(record.get("Price", "")), "confidence": 90},
        {"group": "pricing",  "name": "Currency",    "value": record.get("Currency", ""),   "confidence": 100},
        {"group": "location", "name": "Country",     "value": record.get("Country", ""),    "confidence": 100},
    ]
    # Add engine power if present
    if record.get("Engine Power"):
        fields.append({"group": "specs", "name": "Engine Power", "value": str(record.get("Engine Power", "")), "confidence": 95})
    return fields


def _build_hitl_items(bot_id: str, records: list[dict], job_id: str) -> list[dict]:
    items = []
    for record in records:
        uid       = record.get("uid", str(uuid.uuid4())[:8])
        html_file = record.get("html_file", "")

        if bot_id == "tesla-configurator":
            fields = _hitl_fields_tesla(record)
            trim = record.get("trim", {})
            trim_name = trim.get("name", str(trim)) if isinstance(trim, dict) else str(trim)
            record_name = f"{record.get('Brand', 'Tesla')} {record.get('model', '')} — {trim_name}"
            summary     = record_name
            detail      = f"Verify trim specs, pricing and options for {record_name} against the downloaded Tesla configurator page."
        else:
            fields      = _hitl_fields_bmw(record)
            record_name = record.get("Name", uid)
            summary     = record_name
            detail      = f"Verify extracted attributes for {record_name} against the BMW configurator source page."

        items.append({
            "id":          str(uuid.uuid4()),
            "jobId":       job_id,
            "uid":         uid,
            "htmlFile":    html_file,
            "recordName":  record_name,
            "summary":     summary,
            "detail":      detail,
            "fields":      fields,
            "confidence":  90,
            "status":      "pending",
            "createdAt":   datetime.now().isoformat(),
            "previewKind": "html",
        })
    return items


def _run_bot_thread(bot_id: str, job_id: Optional[str] = None, use_cached: bool = False) -> None:
    cfg         = BOTS[bot_id]
    script_path = BOT_DIR / cfg["script"]
    output_dir  = BOT_DIR / "Output"
    output_dir.mkdir(exist_ok=True)

    pre_existing = set(glob.glob(str(output_dir / "*.json")))
    exit_code    = -1
    output_records: list[dict] = []

    single_file = output_dir / cfg.get("output_file", "")

    try:
        # ── Fast path: load from already-downloaded output without re-running the script ──
        if use_cached and single_file.exists():
            _append_log(bot_id, f"[INFO] Loading cached output for {cfg['name']} (skipping scrape) ...")
            _append_log(bot_id, f"[INFO] Cached file: {single_file}")
            try:
                data = json.loads(single_file.read_text(encoding="utf-8"))
                output_records = data if isinstance(data, list) else [data]
                exit_code = 0
                _append_log(bot_id, f"[INFO] Loaded {len(output_records)} records from cache.")
            except Exception as exc:
                _append_log(bot_id, f"[ERROR] Could not read cached file: {exc}")
                exit_code = -1
        else:
            # ── Normal path: run the scraper script ──────────────────────────────────────
            _append_log(bot_id, f"[INFO] Starting {cfg['name']} ...")
            _append_log(bot_id, f"[INFO] Script: {script_path}")

            try:
                import subprocess as _sp
                env = os.environ.copy()
                env["PYTHONIOENCODING"] = "utf-8"
                proc = _sp.Popen(
                    [sys.executable, "-u", str(script_path)],
                    cwd=str(BOT_DIR),
                    stdout=_sp.PIPE,
                    stderr=_sp.STDOUT,
                    text=True,
                    encoding="utf-8",
                    bufsize=1,
                    env=env,
                )
                for raw_line in proc.stdout:       # type: ignore[union-attr]
                    _append_log(bot_id, raw_line.rstrip())
                proc.wait()
                exit_code = proc.returncode
            except Exception as exc:
                _append_log(bot_id, f"[ERROR] Failed to start process: {exc}")
                exit_code = -1

            # Read the bot's canonical single-file output
            if single_file.exists():
                try:
                    data = json.loads(single_file.read_text(encoding="utf-8"))
                    if isinstance(data, list):
                        output_records = data
                    elif isinstance(data, dict):
                        output_records = [data]
                except Exception as exc:
                    _append_log(bot_id, f"[WARN] Could not read {single_file.name}: {exc}")
            else:
                post_existing = set(glob.glob(str(output_dir / "*.json")))
                for fp in sorted(post_existing - pre_existing):
                    try:
                        raw = json.loads(Path(fp).read_text(encoding="utf-8"))
                        fn  = Path(fp).name
                        if isinstance(raw, list):
                            for rec in raw:
                                output_records.append({"_source_file": fn, **(rec if isinstance(rec, dict) else {"value": rec})})
                        elif isinstance(raw, dict):
                            output_records.append({"_source_file": fn, **raw})
                    except Exception as exc:
                        _append_log(bot_id, f"[WARN] Could not read {fp}: {exc}")

        final_status = "completed" if exit_code == 0 else "error"
        _append_log(bot_id, f"[INFO] Bot finished — exit {exit_code}, status: {final_status}, records: {len(output_records)}")

        with _locks[bot_id]:
            _state[bot_id]["status"]    = final_status
            _state[bot_id]["exit_code"] = exit_code
            _state[bot_id]["output"]    = output_records

        # Update job store
        if job_id:
            try:
                hitl_items = _build_hitl_items(bot_id, output_records, job_id)
            except Exception as exc:
                _append_log(bot_id, f"[WARN] HITL build failed: {exc}")
                hitl_items = []
            job_status = "review" if output_records else ("error" if exit_code != 0 else "completed")
            with _jobs_lock:
                if job_id in _jobs:
                    _jobs[job_id].update({
                        "status":       job_status,
                        "finishedAt":   datetime.now().isoformat(),
                        "records":      output_records,
                        "hitlItems":    hitl_items,
                        "rowsProduced": len(output_records),
                        "reviewTotal":  len(hitl_items),
                        "exitCode":     exit_code,
                    })

    finally:
        # Guarantee the bot never stays stuck in "running" regardless of any exception
        with _locks[bot_id]:
            if _state[bot_id].get("status") == "running":
                _state[bot_id]["status"]    = "error"
                _state[bot_id]["exit_code"] = exit_code
        if job_id:
            with _jobs_lock:
                if job_id in _jobs and _jobs[job_id].get("status") == "running":
                    _jobs[job_id]["status"]     = "error"
                    _jobs[job_id]["finishedAt"] = datetime.now().isoformat()


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "service": "Automotive Data Solutions Bot API", "docs": "/docs"}


# ── Bot endpoints ──────────────────────────────────────────────────────────────

@app.get("/api/bots")
def list_bots():
    result = []
    for bot_id, cfg in BOTS.items():
        with _locks[bot_id]:
            st = _state[bot_id]
        result.append({
            "id":           bot_id,
            "name":         cfg["name"],
            "description":  cfg["description"],
            "status":       st["status"],
            "log_count":    len(st["logs"]),
            "output_count": len(st["output"]),
        })
    return result


@app.post("/api/bots/{bot_id}/reset")
def reset_bot(bot_id: str):
    """Force-reset a bot that is stuck in 'running' state."""
    if bot_id not in BOTS:
        raise HTTPException(status_code=404, detail=f"Bot '{bot_id}' not found")
    with _locks[bot_id]:
        _state[bot_id] = {"status": "idle", "logs": [], "output": [], "exit_code": None}
    return {"ok": True, "bot_id": bot_id, "status": "idle"}


@app.post("/api/bots/{bot_id}/run")
def run_bot(bot_id: str, force: bool = False, use_cached: bool = False):
    if bot_id not in BOTS:
        raise HTTPException(status_code=404, detail=f"Bot '{bot_id}' not found")

    with _locks[bot_id]:
        current_status = _state[bot_id]["status"]
        if current_status == "running":
            if not force:
                raise HTTPException(status_code=409, detail="Bot is already running. Pass ?force=true to override.")
            # force=true: reset the stale state and proceed
            _state[bot_id] = {"status": "running", "logs": [], "output": [], "exit_code": None}
        else:
            _state[bot_id] = {"status": "running", "logs": [], "output": [], "exit_code": None}

    # Create job immediately so the frontend can track it
    job_id  = str(uuid.uuid4())
    started = datetime.now().isoformat()
    with _jobs_lock:
        _jobs[job_id] = {
            "id":           job_id,
            "botId":        bot_id,
            "source":       BOTS[bot_id]["name"],
            "status":       "running",
            "startedAt":    started,
            "finishedAt":   None,
            "records":      [],
            "hitlItems":    [],
            "rowsProduced": 0,
            "reviewTotal":  0,
            "exitCode":     None,
        }

    thread = threading.Thread(target=_run_bot_thread, args=(bot_id, job_id, use_cached), daemon=True)
    thread.start()

    return {"ok": True, "bot_id": bot_id, "job_id": job_id, "status": "running", "use_cached": use_cached}


@app.get("/api/bots/{bot_id}/status")
def bot_status(bot_id: str, last_n: int = 100):
    if bot_id not in BOTS:
        raise HTTPException(status_code=404, detail=f"Bot '{bot_id}' not found")
    with _locks[bot_id]:
        st = _state[bot_id]
        return {
            "id":          bot_id,
            "status":      st["status"],
            "exit_code":   st["exit_code"],
            "log_count":   len(st["logs"]),
            "recent_logs": st["logs"][-last_n:],
            "output_count":len(st["output"]),
        }


@app.get("/api/bots/{bot_id}/stream")
async def stream_logs(bot_id: str):
    if bot_id not in BOTS:
        raise HTTPException(status_code=404, detail=f"Bot '{bot_id}' not found")

    import asyncio

    async def event_generator() -> AsyncGenerator[str, None]:
        sent_index = 0
        while True:
            with _locks[bot_id]:
                logs   = _state[bot_id]["logs"]
                status = _state[bot_id]["status"]
                new_lines = logs[sent_index:]
                sent_index += len(new_lines)

            for line in new_lines:
                yield f"data: {line.replace(chr(10), ' ')}\n\n"

            if status not in ("running", "idle") and sent_index >= len(logs):
                yield f"event: done\ndata: {status}\n\n"
                break

            await asyncio.sleep(0.3)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/bots/{bot_id}/output")
def bot_output(bot_id: str):
    if bot_id not in BOTS:
        raise HTTPException(status_code=404, detail=f"Bot '{bot_id}' not found")
    with _locks[bot_id]:
        return {
            "bot_id":  bot_id,
            "status":  _state[bot_id]["status"],
            "records": _state[bot_id]["output"],
            "count":   len(_state[bot_id]["output"]),
        }


# ── Job endpoints ──────────────────────────────────────────────────────────────

@app.get("/api/jobs")
def list_jobs():
    with _jobs_lock:
        return list(_jobs.values())


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    with _jobs_lock:
        if job_id not in _jobs:
            raise HTTPException(status_code=404, detail="Job not found")
        return _jobs[job_id]


@app.patch("/api/jobs/{job_id}/hitl/{item_id}")
def update_hitl_item(job_id: str, item_id: str, status: str = Query(...)):
    with _jobs_lock:
        if job_id not in _jobs:
            raise HTTPException(status_code=404, detail="Job not found")
        job = _jobs[job_id]
        for item in job.get("hitlItems", []):
            if item["id"] == item_id:
                item["status"]   = status
                item["reviewer"] = "Reviewer"
                # Refresh job review counters
                approved = sum(1 for h in job["hitlItems"] if h["status"] == "approved")
                rejected = sum(1 for h in job["hitlItems"] if h["status"] == "rejected")
                job["reviewApproved"] = approved
                job["reviewRejected"] = rejected
                return {"ok": True, "status": status}
        raise HTTPException(status_code=404, detail="HITL item not found")


@app.post("/api/jobs/{job_id}/submit-review")
def submit_review(job_id: str):
    with _jobs_lock:
        if job_id not in _jobs:
            raise HTTPException(status_code=404, detail="Job not found")
        job   = _jobs[job_id]
        items = job.get("hitlItems", [])
        approved = sum(1 for h in items if h["status"] == "approved")
        rejected = sum(1 for h in items if h["status"] == "rejected")
        job["status"]          = "completed" if approved > 0 else "failed"
        job["reviewApproved"]  = approved
        job["reviewRejected"]  = rejected
        job["finishedAt"]      = datetime.now().isoformat()
        return {"ok": True, "status": job["status"], "approved": approved, "rejected": rejected}


@app.get("/api/jobs/{job_id}/download")
def download_job(job_id: str, format: str = Query(default="json")):
    with _jobs_lock:
        if job_id not in _jobs:
            raise HTTPException(status_code=404, detail="Job not found")
        job     = _jobs[job_id]
        records = job.get("records", [])
        bot_id  = job.get("botId", "bot")

    if format.lower() == "csv":
        if not records:
            return Response("", media_type="text/csv")
        # Flatten to scalar columns only for CSV
        flat_keys: list[str] = []
        seen: set[str] = set()
        for r in records:
            for k in r.keys():
                if k not in seen and not isinstance(r[k], (dict, list)):
                    seen.add(k)
                    flat_keys.append(k)

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=flat_keys, extrasaction="ignore")
        writer.writeheader()
        for r in records:
            writer.writerow({k: r.get(k, "") for k in flat_keys})

        fname = f"{bot_id}_{job_id[:8]}.csv"
        return Response(
            output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{fname}"'},
        )
    else:
        fname = f"{bot_id}_{job_id[:8]}.json"
        return Response(
            json.dumps(records, indent=2, ensure_ascii=False),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{fname}"'},
        )


# ── HTML file serving (for HITL source preview) ────────────────────────────────

import re as _re

_VISIBILITY_FIX = """<style id="_hitl_visibility">
/*
  Tesla's JS sets display:none/visibility:hidden/opacity:0 on <body> during loading.
  Those are stripped from the inline style attribute directly below (CSS cannot beat
  inline !important).  This stylesheet is a backstop for class-based hiding rules.
*/
html, body {
    display: block !important;
    overflow: auto !important;
    height: auto !important;
    pointer-events: auto !important;
}
html, html body, html body * {
    opacity: 1 !important;
    visibility: visible !important;
}
/* Show the real configurator containers */
#__next, .group-section--container, .option-widget--container,
.tds-site-wrapper, .tds-page-wrapper, .tcl-page,
[data-group-id], [class*="group-block"], [class*="specs-block"] {
    display: block !important;
    opacity: 1 !important;
    visibility: visible !important;
}
/* Kill overlays / modals / banners */
.tds-modal, .tds-modal-backdrop, .tds-scrim, .tds-site-header-modal,
[role="dialog"], [aria-modal="true"],
[id*="cookie"], [class*="cookie"],
[id*="consent"], [class*="consent"],
[id*="banner"]:not([class*="notification-banner"]),
[class*="overlay"], [class*="scrim"] {
    display: none !important;
    visibility: hidden !important;
}
</style>"""


def _fix_inline_style(style: str) -> str:
    """Remove Tesla's JS-injected hiding properties from an inline style string."""
    style = _re.sub(r'\bdisplay\s*:\s*none\s*(!important)?\s*;?\s*',      '', style, flags=_re.I)
    style = _re.sub(r'\bvisibility\s*:\s*hidden\s*(!important)?\s*;?\s*', '', style, flags=_re.I)
    style = _re.sub(r'\bopacity\s*:\s*0\s*(!important)?\s*;?\s*',         '', style, flags=_re.I)
    return style.strip().rstrip(';')


def _strip_scripts(html: str) -> str:
    """
    1. Remove executable <script> blocks (keep JSON/LD+JSON data).
    2. Strip Tesla's JS-loading classes (coin-reloaded, async-hide, tds-modal--is-open).
    3. FIX <body> inline style: Tesla sets display:none/visibility:hidden/opacity:0
       as inline !important during page load — these CANNOT be overridden by CSS,
       so we must edit the attribute directly.
    4. Inject CSS backstop for class-based hiding.
    """
    def _keep_script(m: _re.Match) -> str:
        tag_open = m.group(1)
        if _re.search(r'\btype=["\']application/(json|ld\+json)["\']', tag_open, _re.I):
            return m.group(0)
        return ""

    # Strip executable scripts
    html = _re.sub(
        r'(<script\b[^>]*>).*?</script>',
        _keep_script,
        html,
        flags=_re.DOTALL | _re.IGNORECASE,
    )
    # Strip noscript fallbacks
    html = _re.sub(
        r'<noscript\b[^>]*>.*?</noscript>',
        '',
        html,
        flags=_re.DOTALL | _re.IGNORECASE,
    )

    # Remove Tesla's JS-loading/modal classes from the entire document.
    html = _re.sub(r'\bcoin-reloaded\b\s*',     '', html)
    html = _re.sub(r'\basync-hide\b\s*',         '', html)
    html = _re.sub(r'\btds-modal--is-open\b\s*', '', html)

    # KEY FIX: Tesla's JS sets display:none !important; visibility:hidden !important;
    # opacity:0 !important as INLINE STYLES on <body>.  Inline !important beats any
    # stylesheet rule — we must patch the attribute itself.
    html = _re.sub(
        r'(<body\b[^>]*\bstyle=")([^"]*)"',
        lambda m: m.group(1) + _fix_inline_style(m.group(2)) + '"',
        html,
        count=1,
        flags=_re.IGNORECASE,
    )
    # Same fix for <html> element (rare but defensive)
    html = _re.sub(
        r'(<html\b[^>]*\bstyle=")([^"]*)"',
        lambda m: m.group(1) + _fix_inline_style(m.group(2)) + '"',
        html,
        count=1,
        flags=_re.IGNORECASE,
    )

    # Inject visibility fix into <head> so content is always shown
    if '</head>' in html:
        html = html.replace('</head>', _VISIBILITY_FIX + '</head>', 1)
    elif '<body' in html:
        html = html.replace('<body', _VISIBILITY_FIX + '<body', 1)
    else:
        html = _VISIBILITY_FIX + html

    return html


@app.get("/api/html/{filename}")
def serve_html(filename: str):
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    html_path = BOT_DIR / "HTML" / filename
    if not html_path.exists():
        raise HTTPException(status_code=404, detail=f"HTML file not found: {filename}")

    content = html_path.read_text(encoding="utf-8")
    content = _strip_scripts(content)
    return Response(content=content, media_type="text/html")
