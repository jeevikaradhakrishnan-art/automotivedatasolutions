import copy
from pathvalidate import sanitize_filename
from datetime import date, datetime
import json
import urllib.parse
import base64
import requests
import os
import re
from urllib.parse import urljoin
from bs4 import BeautifulSoup
import random
import time
from urllib3.exceptions import InsecureRequestWarning
import urllib3
from collections import defaultdict
# Suppress only the single warning from urllib3 needed.
urllib3.disable_warnings(InsecureRequestWarning)


bmw_config_data = {}
try:
    with open('bmw_config.json', 'r') as f:
        bmw_config_data = json.load(f)
except FileNotFoundError:
    print("bmw_config.json file not found.")

current_date = date.today().strftime("%Y-%m-%d")

# Mapping codes to readable strings
drive_type_map = {"AR": "All-wheel drive", "HR": "Rear-wheel drive", "VR": "Front-wheel drive"}
fuel_type_map = {"E": "Electric", "P": "Petrol", "D": "Diesel", "H": "Hybrid"}
steering_map = {"RL": "Right-hand", "LL": "Left-hand"}

def mpg_to_l_per_100km(mpg): return round(282.48 / mpg, 2) if mpg != 0 else 0
def mi_to_km(miles): return round(miles * 1.60934, 2)
def mi_per_kwh_to_kwh_per_100km(val): return round(62.137119 / val, 2)
def mph_to_kmph(mph): return round(mph * 1.60934, 2)
def minutes_to_hours(minutes): return round(minutes * 0.01667, 2)
def time_str_to_hours(time_str):
    match = re.match(r'(\d+):(\d+)', time_str.strip())
    if match:
        h, m = map(int, match.groups())
        return round(h + m / 60, 2)
    return None

unit_patterns = [
    (re.compile(r'\bmi\s*/\s*kWh\b', re.IGNORECASE), mi_per_kwh_to_kwh_per_100km, "kWh/100km"),
    (re.compile(r'\bmpg\b', re.IGNORECASE), mpg_to_l_per_100km, "l/100km"),
    (re.compile(r'\b(?:miles|mi)\b', re.IGNORECASE), mi_to_km, "km"),
    (re.compile(r'\bmph\b', re.IGNORECASE), mph_to_kmph, "km/h"),
    (re.compile(r'\bmin\b|\bminutes?\b', re.IGNORECASE), minutes_to_hours, "h"),
    (re.compile(r'\b\d+:\d+\b'), time_str_to_hours, "h"),
]

def convert_units(data):
    result = {}

    for key, value in data.items():
        result[key] = value

        if isinstance(value, dict):
            result[key] = convert_units(value)
            continue

        for pattern, converter, target_unit in unit_patterns:
            full_text = f"{key} {str(value)}".strip()
            if  "acceleration" in key.lower() and "mph" in key.lower() :
                continue
            elif pattern.search(full_text):
                try:
                    normalized_value = str(value).replace('−', '-').replace('–', '-')
                    nums = re.findall(r'\d+(?:\.\d+)?', normalized_value)
                    # Only proceed if the value contains 1 or 2 numeric values:
                    # - 1 number: convert directly
                    # - 2 numbers: treat as a range (e.g., "267 − 279 miles")
                    # - More than 2 numbers: skip (too complex or ambiguous without extra logic)
                    if 1 <= len(nums) <= 2:
                        conv = [converter(float(n)) for n in nums]
                        result[f"{key}_converted"] = (
                            f"{conv[0]}–{conv[1]} {target_unit}" if len(conv) == 2 else f"{conv[0]} {target_unit}"
                        )
                        break
                    elif ':' in str(value):  # For "0:35" etc.
                        conv_val = converter(value)
                        if conv_val is not None:
                            result[f"{key}_converted"] = f"{conv_val} {target_unit}"
                            break
                except:
                    continue
    return result

def get_nested(data, *keys, default="N/A"):
    for key in keys:
        if isinstance(data, dict):
            data = data.get(key)
        elif isinstance(data, list) and isinstance(key, int):
            if 0 <= key < len(data):
                data = data[key]
            else:
                return default
        else:
            return default
        if data is None:
            return default
    return data

def build_model_to_line_map(json_data):
    """
    Returns a dictionary mapping each modelCode to a list of line names
    where it appears under includedTransmissionVariants.
    """
    model_to_lines = {}

    for series in json_data.values():
        for model_range in series.get("modelRanges", {}).values():
            lines = model_range.get("lines", {})

            for line_name, line_data in lines.items():
                for variant in line_data.get("includedTransmissionVariants", []):
                    model_code = get_nested(variant, "configuration", "modelCode")
                    if model_code:
                        model_to_lines.setdefault(model_code, set()).add(line_name)

    # Convert sets to sorted lists for consistency
    return {model: sorted(list(lines)) for model, lines in model_to_lines.items()}


def to_valid_filename(s):
    # Replace non-alphanumeric characters with '_'
    s = re.sub(r'[^A-Za-z0-9]', '_', s)
    # Replace multiple underscores with a single underscore
    s = re.sub(r'_+', '_', s)
    # Optionally strip leading/trailing underscores
    s = s.strip('_')
    return s


def extract_technical_data_url_type2(html: str) -> str | None:
    """
    Extracts the href URL for the anchor tag that contains the text
    'Discover all technical data now'.

    Args:
        html (str): HTML content as a string.

    Returns:
        str | None: The href URL if found, otherwise None.
    """
    soup = BeautifulSoup(html, 'html.parser')

    # Attempt to find <a> where direct string matches the text
    link_tag = soup.find('a', string=lambda text: text and "Discover all technical data now" in text)

    # Fallback: check nested text inside the <a> tag
    if not link_tag:
        for a in soup.find_all('a'):
            if "Discover all technical data now" in a.get_text(strip=True):
                link_tag = a
                break

    if link_tag:
        return link_tag.get('href')
    return None


def extract_technical_data_url(html):
    soup = BeautifulSoup(html, 'html.parser')
    technical_data = soup.find('a', attrs={"aria-label": "Technical Data"})
    if technical_data:
        return technical_data.get('href')
    return None


def extract_supporting_data(html):
    soup = BeautifulSoup(html, 'lxml')
    head_block = soup.find('head')
    if head_block == None:
        return None, None
    script_tags = head_block.find('script', attrs={'type': 'application/json'})
    if script_tags:
        json_data = script_tags.string
        json_data = json.loads(json_data)
        return json_data.get("model-code"), json_data.get("model-range")
    else:
        print("No script tag found with type 'application/json'")
        return None, None


def decode_base64_uri_json(encoded_str):
    decoded_bytes = base64.b64decode(encoded_str)
    decoded_str = decoded_bytes.decode('utf-8')
    uri_decoded = urllib.parse.unquote(decoded_str)
    try:
        return json.loads(uri_decoded)
    except json.JSONDecodeError:
        raise ValueError("Decoded string is not valid JSON")


def get_brand_param(html):
    soup = BeautifulSoup(html, 'html.parser')
    # Step 1: Find the outer container
    visualizer_stage = soup.find('div', class_='cmp-visualizer__stage')
    # Step 2: Search inside this container for the brand
    if visualizer_stage:
        viewer = visualizer_stage.find('webcom-360-exterior-viewer-model')
        if viewer and viewer.has_attr('brand'):
            brand = viewer['brand']
            print(f'Brand: {brand}')
            return brand
    else:
        print("No visualizer stage found.")
    return None


def transform_accessory_data(data):
    result = {}
    all_accessory_ids = []

    for category in data:
        category_name = category['name'].lower().replace(" ", "_")
        sub_nodes = category.get('nodes', [])

        result[category_name] = {}
        for sub in sub_nodes:
            sub_name = sub['name'].lower().replace(" ", "_")
            accessories = sub.get('accessories', [])
            all_accessory_ids.extend(accessories)

            accessories_dict = {
                acc_id: {
                    "name": "",
                    "price": "",
                    "type": "option"
                } for acc_id in accessories
            }
            result[category_name][sub_name] = accessories_dict

    return result, all_accessory_ids


def update_multiple_accessories(catalog, accessory_data_dict):
    final_out = {}
    for accessory_id, details in accessory_data_dict.items():
        name = details.get('salesText', '')
        description = {k: v for k, v in details.items() if k not in [
            'accessoryId', 'salesText']}
        # Find and update the matching accessory in the catalog
        for category in catalog.values():
            if isinstance(category, dict):
                for subcat_name, subcategory in category.items():
                    if isinstance(subcategory, dict) and accessory_id in subcategory:
                        if subcat_name not in final_out:
                            final_out[subcat_name] = []

                        final_out[subcat_name].append({
                            'id': accessory_id,
                            'name': name,
                            'description': description,
                            'price': "",
                            'type': 'option'
                        })
    return final_out


def transform_packages(original_data):
    """
    Transforms original package data into the desired 'packages' structure:
    - Moves 'salesText' to 'name'
    - Sets 'price' to an empty string
    - Moves all other fields into 'description'
    """
    packages = {}

    for pkg_id, pkg_data in original_data.items():
        name = pkg_data.pop("salesText", "")
        packages[pkg_id] = {
            "name": name,
            "price": "",
            "description": pkg_data,
            "type": "option"
        }

    return {"packages": packages}

def extract_technical_data_type_2(html):
    soup = BeautifulSoup(html, "lxml")
    # STEP 1: Map model codes to full names
    model_name_map = {}
    for a in soup.find_all("a", class_="ds2-model-select"):
        code = a.get("data-model-code")
        name = a.get("data-model-name")
        if code and name:
            model_name_map[code] = name

    # STEP 2: Extract data, grouped by model and section
    structured_data = defaultdict(lambda: defaultdict(dict))

    for section in soup.find_all("div", attrs={"data-model-code": True}):
        model_code = section["data-model-code"]
        model_name = model_name_map.get(model_code, model_code)

        for table in section.find_all("table", class_="ds2-technical-data-expandable"):
            section_title = table.find("h3") or table.find("caption")
            section_name = section_title.get_text(strip=True) if section_title else "Unknown Section"

            for row in table.find_all("tr", class_="ds2-technical-data-expandable__data-group"):
                th, td = row.find("th"), row.find("td")
                if th and td:
                    label = th.get_text(strip=True)
                    value = td.get_text(strip=True)
                    structured_data[model_name][section_name][label] = value
    return dict(structured_data)


def extract_flat_technical_data(html_content):
    soup = BeautifulSoup(html_content, 'html.parser')
    model_data = {}

    # Find all wrappers for each model's data
    wrappers = soup.find_all('div', class_='cmp-technicaldata__wrapper')

    for wrapper in wrappers:
        model_json = wrapper.get('data-schema-org-json')
        if not model_json:
            continue

        model_info = json.loads(model_json)
        model_name = model_info.get('name', 'Unknown Model').strip()

        # Initialize flat dictionary for model
        model_data[model_name] = {}

        # Find all technical data rows in this wrapper
        rows = wrapper.find_all('tr', class_='cmp-technicaldatafact')
        for row in rows:
            label_elem = row.find('th', class_='cmp-technicaldatafact__label')
            value_elem = row.find('td', class_='cmp-technicaldatafact__value')

            if label_elem and value_elem:
                label = label_elem.get_text(strip=True)
                value = value_elem.get_text(strip=True)
                model_data[model_name][label] = value

    return model_data


def find_ids(data, path=None, results=None):
    if path is None:
        path = []
    if results is None:
        results = []

    if isinstance(data, dict):
        for key, value in data.items():
            if len(path) == 0 and key.lower() == "technical details":
                continue
            current_path = path + [key]

            if isinstance(value, dict):
                find_ids(value, current_path, results)
            elif isinstance(value, list):
                for i, item in enumerate(value):
                    find_ids(item, current_path + [i], results)
            elif key == "id":
                results.append((current_path, value))

    return results


def update_prices_from_paths(data, path_id_pairs, pricing_data):
    updated_data = copy.deepcopy(data)  # avoid mutating original

    def find_price_by_key(key):
        for item in pricing_data:
            if item.get('key') == key:
                return item
        return None

    for path, target_id in path_id_pairs:
        current = updated_data
        try:
            for i, key in enumerate(path):
                if i + 1 < len(path) and path[i + 1] == 'id':
                    current = current[key]
                    break
                else:
                    current = current[key]
            if isinstance(current, dict) and current.get('id') == target_id:
                price_info = find_price_by_key(target_id)
                if price_info:
                    current['price'] = price_info.get(
                        'effectivePrice', {}).get('grossPrice')
                    current['price_details'] = price_info
        except (KeyError, IndexError, TypeError):
            # Skip invalid paths or data structure mismatches
            continue

    return updated_data


def find_blocks_with_key(obj):
    found = []
    if isinstance(obj, dict):
        if "key" in obj:
            found.append(obj)
        for value in obj.values():
            found.extend(find_blocks_with_key(value))
    elif isinstance(obj, list):
        for item in obj:
            found.extend(find_blocks_with_key(item))
    return found


def get_bmw_type(model_name_cleaned):
    return bmw_config_data.get(model_name_cleaned)


def update_bmw_type(model_name_cleaned, bmw_type):
    bmw_config_data[model_name_cleaned] = bmw_type
    with open('bmw_config.json', 'w') as f:
        json.dump(bmw_config_data, f, indent=4)

def get_nested(data, *keys, default="N/A"):
    for key in keys:
        if isinstance(data, dict):
            data = data.get(key)
        elif isinstance(data, list) and isinstance(key, int):
            if 0 <= key < len(data):
                data = data[key]
            else:
                return default
        else:
            return default
        if data is None:
            return default
    return data

# Format value range nicely
def format_range(min_val, max_val, unit):
    if min_val == "N/A" or max_val == "N/A":
        return "N/A"
    return f"{min_val} − {max_val} {unit}" if min_val != max_val else f"{min_val} {unit}"


def extract_configurator_url(soup, keyword="Build & Price"):
    """
    Extracts the configurator URL from the given HTML.
    Priority:
    1. <a> tag with data-contextual-link-type="configurator" AND keyword in text
    2. Any <a> tag with keyword in text (fallback)
    """
    # First try: match data-contextual-link-type="configurator" and keyword
    a_tags = soup.find_all(
        'a', attrs={"data-contextual-link-type": "configurator"})
    for a in a_tags:
        if keyword in a.get_text(strip=True):
            return a.get('href')

    # Fallback: any <a> tag with matching keyword in text
    all_links = soup.find_all('a')
    for a in all_links:
        if keyword in a.get_text(strip=True):
            return a.get('href')

def extract_vehicle_data_Electric(json_data):
    """
    Builds a dictionary mapping each modelCode (e.g. 'IXMD') to its first valid
    technical data set found in includedTransmissionVariants.
    """
    model_data = {}

    for series in json_data.values():
        for model_range in series.get("modelRanges", {}).values():
            models = model_range.get("models", {})
            lines = model_range.get("lines", {})

            for line_data in lines.values():
                for variant in line_data.get("includedTransmissionVariants", []):
                    model_code = get_nested(variant, "configuration", "modelCode")
                    if not model_code or model_code in model_data:
                        continue  # already captured

                    model = models.get(model_code, {})
                    otd_values = get_nested(variant, "otdData", "values", default={})
                    wltp = get_nested(variant, "wltpRanges", "modelOptionCombinations", 0, "ranges", default={})
                    classified = variant.get("classifiedConfiguration", {})
                    wltp_classifier = variant.get("wltpClassifier", {})

                    drive_code = model.get("driveType", "")
                    fuel_code = model.get("fuelType", "")

                    drive_type = drive_type_map.get(drive_code, drive_code or "Unknown")
                    fuel_type = fuel_type_map.get(fuel_code, fuel_code or "Unknown")

                    model_data[model_code] = {
                        "Engine Type": fuel_type,
                        "Drive Type": drive_type,
                        "Body Style": model.get("bodyStyle", "N/A"),
                        "Engine performance": f"{get_nested(otd_values, 'C_LEIST_GES_KOMM', 'targetValue')} kW "
                                              f"({get_nested(otd_values, 'C_LEIST_GES_PS', 'targetValue')} hp)"
                                              if otd_values else "N/A",
                        "Acceleration (0–62 mph)": f"{get_nested(otd_values, 'E_0_100KMH', 'targetValue')} s" if otd_values else "N/A",
                        "WLTP Energy consumption (combined)": format_range(
                            get_nested(wltp, "electricConsumption", "combMin", "value"),
                            get_nested(wltp, "electricConsumption", "combMax", "value"),
                            "mi/kWh"
                        ),
                        "WLTP CO2 Emission (combined)": format_range(
                            get_nested(wltp, "co2Emission", "combMin", "value"),
                            get_nested(wltp, "co2Emission", "combMax", "value"),
                            "g/km"
                        ),
                        "WLTP Electric range (combined)": format_range(
                            get_nested(wltp, "pureElectricRange", "combMin", "value"),
                            get_nested(wltp, "pureElectricRange", "combMax", "value"),
                            "miles"
                        ),
                        "Battery size (gross/net)": (
                            f"{get_nested(otd_values, 'BAT_REESS_ENERINH_BRUT', 'targetValue')} kWh / "
                            f"{get_nested(otd_values, 'BAT_REESS_ENERINH_NET', 'targetValue')} kWh"
                        ) if otd_values else "N/A",
                        "Charging time (AC, 0–100% SOC)": f"{get_nested(otd_values, 'CHRG_LADEDAUER_AC_3_0_100', 'textValue')} h" if otd_values else "N/A",
                        "Max. charging performance AC": f"{get_nested(otd_values, 'CHRG_LADELEISTUNG_AC', 'targetValue')} kW" if otd_values else "N/A",
                        "Charging time (DC, 10–80% SOC)": f"{get_nested(otd_values, 'CHRG_LADEDAUER_DC_3_10_80', 'textValue')} h" if otd_values else "N/A",
                        "Max. charging performance DC": f"{get_nested(otd_values, 'CHRG_LADELEISTUNG_DC', 'targetValue')} kW" if otd_values else "N/A",
                        "Benefit in kind": wltp_classifier.get("maxenergyTax_wltp-non-binding", "N/A")
                    }

    return model_data

def extract_full_phev_data(json_data):
    result = {}

    for series in json_data.values():
        for model_range in series.get("modelRanges", {}).values():
            models = model_range.get("models", {})
            lines = model_range.get("lines", {})

            for line_data in lines.values():
                for variant in line_data.get("includedTransmissionVariants", []):
                    model_code = get_nested(variant, "configuration", "modelCode")
                    if not model_code or model_code in result:
                        continue

                    otd = get_nested(variant, "otdData", "values", default={})
                    wltp = get_nested(variant, "wltpRanges", "modelOptionCombinations", 0, "ranges", default={})
                    classifier = variant.get("wltpClassifier", {})

                    model = models.get(model_code, {})
                    drive_code = model.get("driveType", "")
                    drive_type = drive_type_map.get(drive_code, drive_code or "Unknown")

                    result[model_code] = {
                        "Fuel type": "Petrol Plug-in Hybrid",
                        "Engine performance": f"{get_nested(otd, 'C_LEIST_GES_KOMM', 'targetValue')} kW "
                                              f"({get_nested(otd, 'C_LEIST_GES_PS', 'targetValue')} hp)",
                        "Drive Type": drive_type,
                        "Energy consumption (combined)": format_range(
                            get_nested(wltp, "electricConsumption", "combMin", "value"),
                            get_nested(wltp, "electricConsumption", "combMax", "value"),
                            "mi/kWh"
                        ),
                        "WLTP Consumption (combined)": format_range(
                            get_nested(wltp, "fuelConsumptionWeighted", "fuelConsumptionWeightedMin", "value"),
                            get_nested(wltp, "fuelConsumptionWeighted", "fuelConsumptionWeightedMax", "value"),
                            "mpg"
                        ),
                        "WLTP CO2 Emissions (combined)": format_range(
                            get_nested(wltp, "co2Weighted", "co2WeightedMax", "value"),
                            get_nested(wltp, "co2Weighted", "co2WeightedMin", "value"),
                            "g/km"
                        ),
                        "WLTP Electric range (combined)": format_range(
                            get_nested(wltp, "allElectricRangeCombined", "allElectricRangeCombinedMin", "value"),
                            get_nested(wltp, "allElectricRangeCombined", "allElectricRangeCombinedMax", "value"),
                            "miles"
                        ),
                        "Battery size (gross/net)": (
                            f"{get_nested(otd, 'BAT_REESS_ENERINH_BRUT', 'targetValue')} kWh / "
                            f"{get_nested(otd, 'BAT_REESS_ENERINH_NET', 'targetValue')} kWh"
                        ),
                        "Charging time (AC, 0–100% SOC)": f"{get_nested(otd, 'CHRG_LADEDAUER_AC_3_0_100', 'textValue')} h",
                        "Max. charging performance AC": f"{get_nested(otd, 'CHRG_LADELEISTUNG_AC', 'targetValue')} kW",
                        "Benefit in kind": format_range(
                            classifier.get("minenergyTax_wltp-non-binding", "N/A"),
                            classifier.get("maxenergyTax_wltp-non-binding", "N/A"),
                            "%"
                        )
                    }

    return result

def extract_from_included_transmission_variants(json_data):
    result = {}

    for series in json_data.values():
        for model_range in series.get("modelRanges", {}).values():
            models = model_range.get("models", {})
            lines = model_range.get("lines", {})

            for line_data in lines.values():
                for variant in line_data.get("includedTransmissionVariants", []):
                    model_code = get_nested(variant, "configuration", "modelCode")
                    if not model_code or model_code in result:
                        continue

                    model = models.get(model_code, {})
                    fuel_code = model.get("fuelType", "")
                    drive_code = model.get("driveType", "")
                    transmission = get_nested(model, "transmissionName", "en", "longDescription", default="N/A")

                    otd = get_nested(variant, "otdData", "values", default={})
                    wltp = get_nested(variant, "wltpRanges", "modelOptionCombinations", 0, "ranges", default={})
                    classifier = variant.get("wltpClassifier", {})

                    result[model_code] = {
                        "Fuel type": fuel_type_map.get(fuel_code, fuel_code or "Unknown"),
                        "Engine performance": f"{get_nested(otd, 'C_LEIST_GES_KOMM', 'targetValue')} kW "
                                              f"({get_nested(otd, 'C_LEIST_GES_PS', 'targetValue')} hp)",
                        "Transmission": transmission,
                        "Drive Type": drive_type_map.get(drive_code, drive_code or "Unknown"),
                        "Acceleration (0–62 mph)": f"{get_nested(otd, 'E_0_100KMH', 'targetValue')} s",
                        "WLTP CO2 Emission (combined)": format_range(
                            get_nested(wltp, "co2ChargeSustaining", "combMax", "value"),
                            get_nested(wltp, "co2ChargeSustaining", "combMin", "value"),
                            "g/km"
                        ),
                        "WLTP Consumption (combined)": format_range(
                            get_nested(wltp, "fuelConsumptionChargeSustaining", "combMin", "value"),
                            get_nested(wltp, "fuelConsumptionChargeSustaining", "combMax", "value"),
                            "mpg"
                        ),
                        "Benefit in kind": format_range(
                            classifier.get("minenergyTax_wltp-non-binding", "N/A"),
                            classifier.get("maxenergyTax_wltp-non-binding", "N/A"),
                            "%"
                        ),
                        "Consumption (low)": format_range(
                            get_nested(wltp, "fuelConsumptionChargeSustaining", "lowMin", "value"),
                            get_nested(wltp, "fuelConsumptionChargeSustaining", "lowMax", "value"),
                            "mpg"
                        ),
                        "Consumption (medium)": format_range(
                            get_nested(wltp, "fuelConsumptionChargeSustaining", "midMin", "value"),
                            get_nested(wltp, "fuelConsumptionChargeSustaining", "midMax", "value"),
                            "mpg"
                        ),
                        "Consumption (high)": format_range(
                            get_nested(wltp, "fuelConsumptionChargeSustaining", "highMin", "value"),
                            get_nested(wltp, "fuelConsumptionChargeSustaining", "highMax", "value"),
                            "mpg"
                        ),
                        "Consumption (very high)": format_range(
                            get_nested(wltp, "fuelConsumptionChargeSustaining", "exHighMin", "value"),
                            get_nested(wltp, "fuelConsumptionChargeSustaining", "exHighMax", "value"),
                            "mpg"
                        ),
                    }

    return result

def extract_diesel_data(json_data):
    result = {}

    for series in json_data.values():
        for model_range in series.get("modelRanges", {}).values():
            models = model_range.get("models", {})
            lines = model_range.get("lines", {})

            for line_data in lines.values():
                for variant in line_data.get("includedTransmissionVariants", []):
                    model_code = get_nested(variant, "configuration", "modelCode")
                    if not model_code or model_code in result:
                        continue

                    model = models.get(model_code, {})
                    fuel_type_code = model.get("fuelType", "N/A")
                    drive_code = model.get("driveType", "")
                    drive_type = drive_type_map.get(drive_code, drive_code or "Unknown")

                    otd = get_nested(variant, "otdData", "values", default={})
                    wltp = get_nested(variant, "wltpRanges", "modelOptionCombinations", 0, "ranges", default={})
                    classifier = variant.get("wltpClassifier", {})

                    result[model_code] = {
                        "Fuel type": "Diesel" if fuel_type_code == "D" else fuel_type_code,
                        "Engine performance": f"{get_nested(otd, 'C_LEIST_GES_KOMM', 'targetValue')} kW "
                                              f"({get_nested(otd, 'C_LEIST_GES_PS', 'targetValue')} hp)",
                        "Transmission": "Automatic",
                        "Drive Type": drive_type,
                        "Acceleration (0–62 mph)": f"{get_nested(otd, 'E_0_100KMH', 'targetValue')} s",
                        "WLTP CO2 Emission (combined)": format_range(
                            get_nested(wltp, "co2ChargeSustaining", "combMin", "value"),
                            get_nested(wltp, "co2ChargeSustaining", "combMax", "value"),
                            "g/km"
                        ),
                        "WLTP Consumption (combined)": format_range(
                            get_nested(wltp, "fuelConsumptionChargeSustaining", "combMin", "value"),
                            get_nested(wltp, "fuelConsumptionChargeSustaining", "combMax", "value"),
                            "mpg"
                        ),
                        "Consumption (low)": format_range(
                            get_nested(wltp, "fuelConsumptionChargeSustaining", "lowMin", "value"),
                            get_nested(wltp, "fuelConsumptionChargeSustaining", "lowMax", "value"),
                            "mpg"
                        ),
                        "Consumption (medium)": format_range(
                            get_nested(wltp, "fuelConsumptionChargeSustaining", "midMin", "value"),
                            get_nested(wltp, "fuelConsumptionChargeSustaining", "midMax", "value"),
                            "mpg"
                        ),
                        "Consumption (high)": format_range(
                            get_nested(wltp, "fuelConsumptionChargeSustaining", "highMin", "value"),
                            get_nested(wltp, "fuelConsumptionChargeSustaining", "highMax", "value"),
                            "mpg"
                        ),
                        "Consumption (very high)": format_range(
                            get_nested(wltp, "fuelConsumptionChargeSustaining", "exHighMin", "value"),
                            get_nested(wltp, "fuelConsumptionChargeSustaining", "exHighMax", "value"),
                            "mpg"
                        ),
                        "Benefit in kind": format_range(
                            classifier.get("minenergyTax_wltp-non-binding", "N/A"),
                            classifier.get("maxenergyTax_wltp-non-binding", "N/A"),
                            "%"
                        )
                    }

    return result

class _TimeoutAdapter(requests.adapters.HTTPAdapter):
    """HTTPAdapter that enforces a hard timeout on every request."""
    def __init__(self, timeout=15, **kw):
        self._timeout = timeout
        super().__init__(**kw)
    def send(self, *args, **kwargs):
        kwargs.setdefault("timeout", self._timeout)
        return super().send(*args, **kwargs)


if __name__ == '__main__':
    print("[INFO] BMW Data Collector starting...")
    prev_block = ""
    html_path = 'Cache/'
    output_path = 'Output/'
    os.makedirs(html_path, exist_ok=True)
    os.makedirs(output_path, exist_ok=True)
    all_records = []
    uid_counter = 1
    MAX_RECORDS = 5
    sess = requests.Session()
    # Enforce 15-second timeout on every request — prevents indefinite hangs
    _adapter = _TimeoutAdapter(timeout=15)
    sess.mount("https://", _adapter)
    sess.mount("http://",  _adapter)
    sess.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
    models_url = 'https://www.bmw.co.uk/en/all-models.html'
    all_models_path = f'{html_path}all_models.html'
    if os.path.exists(all_models_path):
        print(f"[INFO] Loading cached all-models page from {all_models_path}")
        with open(all_models_path, 'r', encoding="utf-8") as fh:
            obj_text = fh.read()
    else:
        print(f"[INFO] Fetching all-models page from {models_url} ...")
        obj = sess.get(models_url, headers={'upgrade-insecure-requests': '1', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36', 'cache-control': 'no-cache', 'connection': 'keep-alive', 'host': 'www.bmw.co.uk',
                       'pragma': 'no-cache', 'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"', 'sec-ch-ua-mobile': '?0', 'sec-ch-ua-platform': '"Windows"', 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'none', 'sec-fetch-user': '?1'}, verify=False)
        with open(all_models_path, 'wb') as fh:
            fh.write(obj.content)
        obj_text = obj.text
        time.sleep(random.uniform(0.3, 0.8))
    soup = BeautifulSoup(obj_text, 'html.parser')
    car_soup = soup.find("div", attrs={"cmp-allmodels--container "})
    counter = 0
    for product_block in soup.find_all('div', attrs={'class': 'allmodelscard container responsivegrid'}):
      try:
        vehicle_info_url = None
        build_and_price_url = extract_configurator_url(product_block)
        technical_detail_url = None
        car_body_category = product_block.find("span",attrs={"class":"cmp-allmodelscarddetail__body-type"}).get_text().strip()
        series_name = product_block.find(
            'div', attrs={"cmp-allmodelscarddetail__series"}).get_text().strip()
        series_desc = product_block.find(
            'div', attrs={"cmp-allmodelscarddetail__description"}).get_text().strip()
        print(f"Series Name : {series_name}")
        print(f"Series Description : {series_desc}")
        model_name = f"{car_body_category}_{series_name}_{series_desc}"
        print(f"Model Name : {model_name}")
        vehicle_info_url_elem = product_block.find(
            'a', attrs={'aria-label': 'Find out more'})
        #print(f"Vehicle Information URL Element : {vehicle_info_url_elem}")
        model_name_cleaned = to_valid_filename(model_name)
        if not vehicle_info_url_elem:
            with open('Vehicle_Info_Error.txt', 'a') as fh:
                fh.write(f"Model Name: {model_name}\n")
                fh.write(f"Series Name: {series_name}\n")
                fh.write(f"Series Description: {series_desc}\n")
                fh.write("Vehicle Information URL Element not found.\n\n")
            #counter += 1
            continue
        if vehicle_info_url_elem:
            vehicle_info_url = vehicle_info_url_elem.get('href')
            vehicle_info_url = urljoin(models_url, vehicle_info_url)
            vehicle_path = f'{html_path}{model_name_cleaned}_Vehical_Information.html'
            if os.path.exists(vehicle_path):
                with open(vehicle_path, 'r', encoding="utf-8") as fh:
                    obj_text = fh.read()
            else:
                obj = sess.get(vehicle_info_url, headers={'upgrade-insecure-requests': '1', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36', 'cache-control': 'no-cache', 'connection': 'keep-alive', 'host': 'www.bmw.co.uk',
                               'pragma': 'no-cache', 'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"', 'sec-ch-ua-mobile': '?0', 'sec-ch-ua-platform': '"Windows"', 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'none', 'sec-fetch-user': '?1'}, verify=False)
                with open(vehicle_path, 'wb') as fh:
                    fh.write(obj.content)
                obj_text = obj.text
            bmw_type = get_brand_param(obj_text)
            technical_data_type = "type1"
            model_code, model_range = extract_supporting_data(obj_text)
            print(bmw_type)
            technical_relative_url = extract_technical_data_url(obj_text)
            if not technical_relative_url:
                technical_data_type = "type2"
                technical_relative_url = extract_technical_data_url_type2(obj_text)
            print(f"Technical Data URL : {technical_relative_url}")
            technical_url = urljoin(
                vehicle_info_url, technical_relative_url)
            if technical_relative_url:
                technical_detail_url = technical_url
                technical_detail_path = f'{html_path}{model_name_cleaned}_Technical_Data.html'
                if os.path.exists(technical_detail_path):
                    with open(technical_detail_path, 'r', encoding="utf-8") as fh:
                        obj_text = fh.read()
                else:
                    obj = sess.get(technical_url, headers={'upgrade-insecure-requests': '1', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36', 'cache-control': 'no-cache', 'connection': 'keep-alive', 'host': 'www.bmw.co.uk',
                                   'pragma': 'no-cache', 'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"', 'sec-ch-ua-mobile': '?0', 'sec-ch-ua-platform': '"Windows"', 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'none', 'sec-fetch-user': '?1'}, verify=False)
                    with open(technical_detail_path, 'wb') as fh:
                        fh.write(obj.content)
                    obj_text = obj.text
                if technical_data_type == "type1":
                    technical_block = extract_flat_technical_data(obj_text)
                elif technical_data_type == "type2":
                    technical_block = extract_technical_data_type_2(obj_text)
            else:
                technical_block = {}
            
            headers = {
                'x-api-key': 'OmVGc3hwNklHYlBqaHZaeDkyV2pkZ0wwV1ZzUXo0Vm1NYW0yTnNXNE4K',
                'host': 'prod.ucp.bmw.cloud'
            }
            if bmw_type == None:
                for bmw_type in ["bmwCar", "bmwi"]:
                    price_details_url = f"https://prod.ucp.bmw.cloud/model-matrices/vehicle-trees/connext-bmw/sources/pcaso/brands/{bmw_type}/countries/gb/effect-dates/{current_date}/order-dates/{current_date}?gfs-policy=none&cluster=default&model-ranges={model_range}&future-models=true&closest-fallback=true"
                    """price details
                        Engines 100%
                        """
                    print(f"modifying {bmw_type}")
                    obj = sess.get(price_details_url,
                                   headers=headers, verify=False)
                    check_data = obj.json()
                    if check_data:
                        # with open("data.json", 'w') as f:
                        #     json.dump(obj.json(), f, indent=4)
                        continue
                    else:
                        update_bmw_type(model_name_cleaned, bmw_type)
                        print("Data Found..")
                        data = obj.json()
                        break
            else:
                price_details_path = f'{html_path}{model_name_cleaned}_Price_Details.json'
                if os.path.exists(price_details_path):
                    with open(price_details_path, 'r', encoding="utf-8") as fh:
                        data = json.load(fh)
                else:
                    price_details_url = f"https://prod.ucp.bmw.cloud/model-matrices/vehicle-trees/connext-bmw/sources/pcaso/brands/{bmw_type}/countries/gb/effect-dates/{current_date}/order-dates/{current_date}?gfs-policy=none&cluster=default&model-ranges={model_range}&future-models=true&closest-fallback=true"
                    """price details
                        Engines 100%
                        """
                    print(price_details_url)
                    obj = sess.get(price_details_url,
                                   headers=headers, verify=False)
                    with open(price_details_path, 'wb') as fh:
                        fh.write(obj.content)
                    data = obj.json()
            price_data = data
            for series_key, series_data in data.items():
                if len(all_records) >= MAX_RECORDS:
                    break
                model_ranges = series_data.get("modelRanges", {})
                for model_range_key, model_range_data in model_ranges.items():
                    if len(all_records) >= MAX_RECORDS:
                        break
                    models = model_range_data.get("models", {})
                    lines_block = model_range_data.get("lines", {})
                    for model_code, model_data in models.items():
                        if len(all_records) >= MAX_RECORDS:
                            break
                        description = model_data.get('phrases', {}).get(
                            'en', {}).get('longDescription')
                        # additionalData = model_data.get('additionalData')
                        car_detail_model = {}
                        model_info = {
                            "Creation date": current_date,
                            "UID": f"{counter:04d}",
                            "Country": "United Kingdom",
                            "Brand": "BMW",
                            "Configurator Page Link": build_and_price_url,
                            "Technical Data Page Link": technical_detail_url,
                            "Currency": "£",
                            "Series": series_key,
                            "Model Range": model_range_key,
                            "Model Code": model_code,
                            "Derivative": model_data.get('derivative'),
							"Engine Power": model_data.get('technicalData', {}).get('enginePower'),
                            "Transmission Type": model_data.get('transmissionVariants', [{}])[0].get('transmission', {}).get('type'),
                            "Fuel Type": model_data.get('fuelType'),
                            "Doors": model_data.get('doors'),
                            "Body Style": model_data.get('bodyStyle'),
                            "Drive Type": model_data.get('driveType'),
                            "Name": model_data.get('phrases', {}).get('en', {}).get('longDescription').strip(),
                            "Order Date": model_data.get('orderDate'),
                            "Effect Date": model_data.get('effectDate'),
                            "type": "option",
                            "Price": ""
                        }
                        car_key = model_info.get('Name')
                        effective_date = model_info.get('Effect Date')
                        order_date = model_info.get('Order Date')
                        tax_date = model_data.get('taxDate', "")
                        lines_dict = model_data.get("lines", {})
                        line_values = list(lines_dict.values())
                        model_line_map = build_model_to_line_map(price_data)
                        line_code = model_line_map.get(model_code)
                        if model_info.get("Fuel Type") == "E":
                            sub_technical_block_json = extract_vehicle_data_Electric(price_data)
                        elif model_info.get("Fuel Type") == "X":
                            sub_technical_block_json = extract_full_phev_data(price_data)
                        elif model_info.get("Fuel Type") == "O":
                            sub_technical_block_json = extract_from_included_transmission_variants(price_data)
                        elif model_info.get("Fuel Type") ==  "Diesel" or model_info.get("Fuel Type") == "D":
                            sub_technical_block_json = extract_diesel_data(price_data)
                        else:
                            print(f"[WARN] Unknown fuel type '{model_info.get('Fuel Type')}' for {model_code} — skipping")
                            continue
                        print(f"Line Code: {line_code}")
                        sub_technical_block = sub_technical_block_json.get(model_code,{})
                        if line_code == None:
                            if line_values == []:
                                new_description = description
                                if "BMW" in description:
                                    new_description = description.replace(
                                        "BMW", "").strip()
                                if "M" in new_description:
                                    line_code = "M_PERFORMANCE_LINE"
                                else:
                                    line_code = "BASE_LINE"
                                print(f"Default Line Code: {line_code}")
                            else:
                                line_code = line_values[0]
                        else:
                            line_code = line_code[0]
                        price_block = lines_block.get(
                            line_code, {}).get("prices", {})
                        paint_details_path = f'{html_path}{model_name_cleaned}_Paint_Details.json'
                        paint_detail_url = f"https://prod.ucp.bmw.cloud/localisations/overridden-vehicle-data/sources/pcaso/brands/{bmw_type}/countries/gb/effect-dates/{effective_date}/order-dates/{order_date}/applications/connext/models/{model_code}/options/languages/en?trim={line_code}"
                        """Interior
                                Interior Trims
                                Exteriors (Paint)
                                Alloy Wheels
                                Optional Equipments"""
                        if os.path.exists(paint_details_path):
                            with open(paint_details_path, 'r', encoding="utf-8") as fh:
                                paint_data = json.load(fh)
                        else:
                            time.sleep(random.uniform(0.3, 0.8))
                            obj = sess.get(paint_detail_url,
                                           headers=headers, verify=False)
                            with open(f'{html_path}{model_name_cleaned}_Paint_Details.json', 'wb') as fh:
                                fh.write(obj.content)
                            paint_data = obj.json()
                        grouped_by_sales_group = {}  # defaultdict(list)
                        grouped_by_alloy_rims = []  # defaultdict(list)
                        for option_code, option_data in paint_data.items():
                            sales_groups = option_data.get(
                                "salesGroupCodes", [])
                            for group in sales_groups:
                                if "option" in option_data:
                                    id_val = option_data.pop("option")
                                    option_data["id"] = id_val
                                if "type" in option_data:
                                    option_data["site_type"] = option_data.pop(
                                        "type")
                                option_data["price"] = ""
                                option_data["type"] = "Std" if option_data.get(
                                    "std") else "option"
                                if re.match(r"RIMS_\d+$", group):
                                    # grouped_by_alloy_rims[group].append(option_data)
                                    grouped_by_alloy_rims.append(option_data)
                                else:
                                    if group in grouped_by_sales_group:
                                        grouped_by_sales_group[group].append(
                                            option_data)
                                    else:
                                        grouped_by_sales_group[group] = [
                                            option_data]
                        grouped_by_sales_group["Alloy Wheels"] = grouped_by_alloy_rims
                        standard_equipment_path = f'{html_path}{model_name_cleaned}_Standard_Equipment.html'
                        standard_equipment_url = f"https://prod.ucp.bmw.cloud/localisations/marketing-texts/countries/gb/model-ranges/{model_range}/models/{model_code}/languages/en/validity-dates/{current_date}?property-filter=benefits,type&type-filter=Baureihe,Fahrzeugtyp"
                        """Standard Equipment"""
                        if os.path.exists(standard_equipment_path):
                            with open(standard_equipment_path, 'r', encoding="utf-8") as fh:
                                data = json.load(fh)

                        else:
                            time.sleep(random.uniform(0.3, 0.8))
                            obj = sess.get(standard_equipment_url,
                                           headers=headers, verify=False)
                            with open(standard_equipment_path, 'wb') as fh:
                                fh.write(obj.content)
                            data = obj.json()
                        standard_equipments = []
                        for item in data.values():
                            if isinstance(item, dict):
                                benefits_html = item.get("benefits", "")
                                if benefits_html != "":
                                    standard_equipments.append(benefits_html)
                        standard_equipments_block = {
                            "Standard Equipment": standard_equipments}
                        # package_url = f"https://prod.ucp.bmw.cloud/localisations/marketing-texts/countries/gb/model-ranges/{model_range}/models/{model_code}/languages/en/validity-dates/{current_date}"
                        # """Packages"""
                        # packages_path = f'{html_path}{model_name_cleaned}_Packages.html'
                        # if os.path.exists(packages_path):
                        #     with open(packages_path, 'r', encoding="utf-8") as fh:
                        #         data = json.load(fh)
                        # else:
                        #     time.sleep(random.randint(1, 3))
                        #     obj = sess.get(
                        #         package_url, headers=headers, verify=False)
                        #     with open(packages_path, 'wb') as fh:
                        #         fh.write(obj.content)
                        #     data = obj.json()
                        # packages_block = transform_packages(data)
                        filter_accessories_path = f'{html_path}{model_name_cleaned}_filter_Accessories.html'
                        print(model_code)
                        filter_accessories_url = f"https://prod.ucp.bmw.cloud/localisations/overridden-rulesolver-data/rule-sets/pcaso,con/brands/{bmw_type}/countries/gb/sales-group-tree/languages/en/models/{model_code}/effect-dates/{effective_date}/order-dates/{order_date}"
                        print(filter_accessories_url)
                        if os.path.exists(filter_accessories_path):
                            with open(filter_accessories_path, 'r', encoding="utf-8") as fh:
                                filter_json = json.load(fh)
                        else:
                            time.sleep(random.uniform(0.3, 0.8))
                            obj = sess.get(filter_accessories_url,
                                           headers=headers, verify=False)
                            with open(filter_accessories_path, 'wb') as fh:
                                fh.write(obj.content)
                            filter_json = obj.json()
                        if "errorCode" in filter_json:
                            #Assumption: If the block is empty, it is the same as the previous block
                            print("Prev Block used")
                            charging_accessories_service_block = prev_block
                        else:
                            charging_accessories_service_block, accessories_list = transform_accessory_data(
                                filter_json)
                            accessory_id_string = ",".join(
                                sorted(set(accessories_list)))
                            accessories_url = f"https://prod.ucp.bmw.cloud/localisations/channels/con/countries/gb/accessories/phrases/models/{model_code}/languages/en/validity-dates/2025-06-03?accessory-ids={accessory_id_string}"
                            """Accessories"""
                            accessories_path = f'{html_path}{model_name_cleaned}_Accessories.html'
                            if os.path.exists(accessories_path):
                                with open(accessories_path, 'r', encoding="utf-8") as fh:
                                    accessory_json = json.load(fh)
                            else:
                                time.sleep(random.uniform(0.3, 0.8))
                                obj = sess.get(accessories_url,
                                            headers=headers, verify=False)
                                with open(accessories_path, 'wb') as fh:
                                    fh.write(obj.content)
                                accessory_json = obj.json()
                            charging_accessories_service_block = update_multiple_accessories(
                                charging_accessories_service_block, accessory_json)
                            prev_block = charging_accessories_service_block
                        prices_value = price_block.get("grossPrice", "")
                        model_info["Price"] = prices_value
                        car_detail_model.update(model_info)
                        sub_technical_block = convert_units(sub_technical_block)
                        car_detail_model.update({"Technical_and_Transmission_details": sub_technical_block})
                        car_detail_model.update({"prices": price_block})
                        car_detail_model.update(grouped_by_sales_group)
                        car_detail_model.update(standard_equipments_block)
                        # car_detail_model.update(packages_block)
                        car_detail_model.update(
                            charging_accessories_service_block)
                        technical_data_block_converted = convert_units(technical_block.get(car_key, {car_key: []}))
                        car_detail_model.update(
                            {"technical_details": technical_data_block_converted})
                        captured_ids = find_ids(car_detail_model)
                        id_values = [item[1] for item in captured_ids]
                        # Separate based on length
                        accessories = [
                            id_ for id_ in id_values if len(id_) == 8]
                        options = [id_ for id_ in id_values if len(id_) != 8]
                        accessories = [{"accessoryId": acc_id, "quantity": 1}
                                       for acc_id in accessories]
                        json_payload_data = {
                            "settings": {
                                "priceTree": "DEFAULT",
                                "ignoreInvalidOptionCodes": True,
                                "ignoreOptionsWithUndefinedPrices": True,
                                "roundingScale": 1,
                                "optimizedPriceDate": False,
                                "accessoriesMustFitConfiguration": False
                            },
                            "validityDates": {
                                "taxDate": tax_date,
                                "effectDate": effective_date
                            },
                            "configuration": {
                                "model": "IXMD",
                                "selectedOptions": options
                            },
                            "selectedAccessories": accessories
                        }
                        complete_price_path = f'{html_path}{model_name_cleaned}_Complete_price.json'
                        if os.path.exists(complete_price_path):
                            with open(complete_price_path, 'r', encoding="utf-8") as fh:
                                complete_price_json = json.load(fh)
                        else:
                            time.sleep(random.uniform(0.3, 0.8))
                            obj = sess.post(
                                'https://prod.ucp.bmw.cloud/pricing/calculation/public-calculation/price-lists/pcaso,con/brands/bmwi/countries/gb',
                                json=json_payload_data,
                                headers=headers, verify=False)
                            with open(complete_price_path, 'wb') as fh:
                                fh.write(obj.content)
                            complete_price_json = obj.json()
                        blocks_with_key = find_blocks_with_key(
                            complete_price_json)
                        car_detail_model = update_prices_from_paths(
                            car_detail_model, captured_ids, blocks_with_key)
                        car_key = f"{model_name_cleaned}_{car_key}"
                        cleaned_car_key = sanitize_filename(
                            car_key, replacement_text="_")
                        # Assign UID and live configurator URL (HITL shows live BMW page)
                        uid = f"BMW_{uid_counter:03d}"
                        car_detail_model["uid"] = uid
                        car_detail_model["configurator_url"] = build_and_price_url or ""

                        out_file = f'{output_path}car_detail_{cleaned_car_key}.json'
                        with open(out_file, 'w', encoding="utf-8") as fh:
                            json.dump(car_detail_model, fh,
                                      indent=4,  ensure_ascii=False)
                        print(f"[INFO] Saved -> {os.path.abspath(out_file)}")
                        all_records.append(car_detail_model)
                        counter += 1
                        uid_counter += 1

      except Exception as _model_exc:
          print(f"[WARN] Skipping model due to error: {_model_exc}")

      # Stop processing further product blocks once we have enough records
      if len(all_records) >= MAX_RECORDS:
          print(f"[INFO] MAX_RECORDS ({MAX_RECORDS}) reached — stopping.")
          break

    # Write combined single-file output
    bmw_json = f"{output_path}bmw.json"
    with open(bmw_json, "w", encoding="utf-8") as fh:
        json.dump(all_records, fh, indent=4, ensure_ascii=False)
    print(f"[INFO] BMW extraction complete. {counter} records written (limit: {MAX_RECORDS}).")
    print(f"[INFO] Combined output : {os.path.abspath(bmw_json)}")
    print(f"[INFO] Output folder   : {os.path.abspath(output_path)}")
