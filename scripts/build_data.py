#!/usr/bin/env python3
"""TW-AMR Watch data build: data/curated/** -> public/data/*.json + public/api/v1/**

  1. (unless --no-map) runs scripts/ingest/map_amr.py: data/source/transcribed/** -> data/curated/{resistance,isolates}.csv
  2. loads the curated CSV/JSON inputs, checks them semantically and against data/schema/*.schema.json
  3. writes the canonical envelopes (docs/ARCHITECTURE.md section 4) to public/data/
  4. writes the static API (JSON + CSV + pre-sliced endpoints + openapi.yaml) to public/api/v1/

Deterministic and idempotent: stable key order, sorted records; the only timestamp is `generatedAt`, which is reused
from the previous build when the content digest is unchanged (or taken from SOURCE_DATE_EPOCH).
Exit code 1 on any contract violation.

Usage: python3 scripts/build_data.py [--no-map] [--check] [--quiet] [--lenient-content]
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import shutil
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "ingest"))
from vocab import Vocab, vocab  # noqa: E402

CUR = ROOT / "data" / "curated"
SCHEMA_DIR = ROOT / "data" / "schema"
OUT_DATA = ROOT / "public" / "data"
OUT_API = ROOT / "public" / "api" / "v1"
RAW = ROOT / "raw"
PLACEHOLDER_TS = "1970-01-01T00:00:00Z"

ERRORS: list[str] = []
WARNINGS: list[str] = []
QUIET = False


def err(msg):
    ERRORS.append(msg)


def warn(msg):
    WARNINGS.append(msg)
    if not QUIET:
        print(f"[build] WARN {msg}", file=sys.stderr)


def info(msg):
    if not QUIET:
        print(f"[build] {msg}")


def jload(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def read_csv(p: Path) -> list[dict]:
    if not p.exists():
        return []
    with p.open(encoding="utf-8-sig", newline="") as fh:
        return [{k.strip(): (v or "").strip() for k, v in r.items() if k} for r in csv.DictReader(fh)]


def num(s, cast=float):
    if s is None or s == "":
        return None
    try:
        v = float(s)
    except ValueError:
        return "__bad__"
    return int(round(v)) if cast is int else v


def strip_none(d: dict, optional: set[str]) -> dict:
    return {k: v for k, v in d.items() if not (k in optional and v is None)}


# ============================================================================ loaders
def load_resistance(v: Vocab):
    rows = read_csv(CUR / "resistance.csv")
    out = []
    for i, r in enumerate(rows, 2):
        rec = {"year": num(r.get("year"), int), "pathogen": r.get("pathogen"), "antibiotic": r.get("antibiotic"),
               "phenotype": r.get("phenotype") or None, "level": r.get("level"), "ward": r.get("ward") or "all",
               "setting": r.get("setting") or "all", "specimen": r.get("specimen") or "all",
               "isolates": num(r.get("isolates"), int), "resistant_pct": num(r.get("resistant_pct")),
               "susceptible_pct": num(r.get("susceptible_pct")), "ci_low": num(r.get("ci_low")), "ci_high": num(r.get("ci_high")),
               "precision": r.get("precision"), "reportYear": num(r.get("reportYear"), int)}
        if "__bad__" in rec.values():
            err(f"resistance.csv:{i}: non-numeric value in {r}")
            continue
        out.append(strip_none(rec, {"phenotype", "susceptible_pct", "ci_low", "ci_high", "reportYear"}))
    return out


def load_isolates():
    out = []
    for i, r in enumerate(read_csv(CUR / "isolates.csv"), 2):
        rec = {"year": num(r.get("year"), int), "organism": r.get("organism"), "scope": r.get("scope"),
               "level": r.get("level") or "all", "subset": r.get("subset") or None,
               "rank": num(r.get("rank"), int), "isolates": num(r.get("isolates"), int),
               "precision": r.get("precision") or None, "reportYear": num(r.get("reportYear"), int)}
        if "__bad__" in rec.values():
            err(f"isolates.csv:{i}: non-numeric value")
            continue
        out.append(strip_none(rec, {"subset", "rank", "precision", "reportYear"}))
    return out


def load_simple(name, spec):
    """spec: list of (field, type) with type in int|float|str."""
    rows = read_csv(CUR / f"{name}.csv")
    out, origins = [], Counter()
    for i, r in enumerate(rows, 2):
        rec = {}
        for f, t in spec:
            val = r.get(f, "")
            if t is int or t is float:
                val = num(val, t)
                if val == "__bad__":
                    err(f"{name}.csv:{i}: bad number in {f}={r.get(f)!r}")
            rec[f] = val
        origins[r.get("origin") or "unknown"] += 1
        out.append(rec)
    return out, origins


# ============================================================================ checks
def check_unique(name, recs, keyf):
    seen = {}
    for i, r in enumerate(recs):
        k = keyf(r)
        if k in seen:
            err(f"{name}: duplicate key {k}")
        seen[k] = i


def check_codes(name, recs, field, allowed, optional=False):
    bad = Counter(r.get(field) for r in recs if (r.get(field) is not None or not optional) and r.get(field) not in allowed)
    for code, n in bad.items():
        err(f"{name}: unknown {field} code {code!r} ({n} rows) - add it to data/curated/dims")


# ============================================================================ dims helpers
def subset(dims, used, autos=None):
    used = set(used)
    out = [d for d in dims if d["code"] in used]
    known = {d["code"] for d in dims}
    for code in sorted(used - known):
        if autos and code in autos:
            out.append(autos[code])
        else:
            out.append({"code": code, "name": {"zh-TW": code, "en": code, "ja": code}, "group": "unmapped", "order": 999,
                        "meta": {"autoGenerated": True}})
    return out


def clean_dim(d):
    """Drop internal matching aliases from published dims (keep everything else)."""
    d = json.loads(json.dumps(d))
    meta = d.get("meta")
    if meta:
        meta.pop("aliases", None)
        meta.pop("thas", None) if False else None
        if not meta:
            d.pop("meta")
    return d


def dimlist(lst):
    return [clean_dim(d) for d in lst]


# ============================================================================ envelope + IO
ENVELOPE_ORDER = ["dataset", "version", "generatedAt", "provisional", "latestYear", "yearsAvailable", "provisionalDatasets",
                  "ingestion", "lastBuild", "contentDigest", "sources", "notes", "slice", "meta", "dims", "records"]


def dumps_envelope(env: dict) -> str:
    keys = [k for k in ENVELOPE_ORDER if k in env] + [k for k in env if k not in ENVELOPE_ORDER]
    parts = []
    for k in keys:
        v = env[k]
        if k == "records":
            if v:
                body = ",\n".join("    " + json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in v)
                parts.append(f'  "records": [\n{body}\n  ]')
            else:
                parts.append('  "records": []')
        else:
            s = json.dumps(v, ensure_ascii=False, indent=2)
            parts.append(f"  {json.dumps(k)}: " + s.replace("\n", "\n  "))
    return "{\n" + ",\n".join(parts) + "\n}\n"


def flatten(rec: dict) -> dict:
    out = {}
    for k, v in rec.items():
        if isinstance(v, dict) and set(v) >= {"zh-TW", "en", "ja"} and all(isinstance(x, str) for x in v.values()):
            for lang in ("zh-TW", "en", "ja"):
                out[f"{k}.{lang}"] = v[lang]
        elif isinstance(v, list):
            out[k] = "|".join(json.dumps(x, ensure_ascii=False) if isinstance(x, (dict, list)) else str(x) for x in v)
        elif isinstance(v, dict):
            out[k] = json.dumps(v, ensure_ascii=False, sort_keys=True)
        elif v is None:
            out[k] = ""
        elif isinstance(v, bool):
            out[k] = "true" if v else "false"
        else:
            out[k] = v
    return out


def to_csv(records: list[dict], columns: list[str] | None = None) -> str:
    flat = [flatten(r) for r in records]
    cols = list(columns or [])
    for r in flat:
        for k in r:
            if k not in cols:
                cols.append(k)
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(cols)
    for r in flat:
        w.writerow([r.get(c, "") for c in cols])
    return buf.getvalue()


def yaml_dump(obj, indent=0) -> str:
    """Tiny deterministic YAML emitter (strings are JSON-quoted, which is valid YAML)."""
    pad = "  " * indent
    if isinstance(obj, dict):
        if not obj:
            return "{}"
        lines = []
        for k, v in obj.items():
            key = k if isinstance(k, str) and k.replace("_", "").replace("-", "").isalnum() else json.dumps(str(k), ensure_ascii=False)
            if isinstance(v, (dict, list)) and v:
                lines.append(f"{pad}{key}:\n{yaml_dump(v, indent + 1)}")
            else:
                lines.append(f"{pad}{key}: {yaml_dump(v, indent + 1)}")
        return "\n".join(lines)
    if isinstance(obj, list):
        if not obj:
            return "[]"
        lines = []
        for v in obj:
            if isinstance(v, dict) and v:
                inner = yaml_dump(v, indent + 1).lstrip()
                lines.append(f"{pad}- {inner}")
            elif isinstance(v, list) and v:
                lines.append(f"{pad}-\n{yaml_dump(v, indent + 1)}")
            else:
                lines.append(f"{pad}- {yaml_dump(v, indent + 1)}")
        return "\n".join(lines)
    if obj is None:
        return "null"
    if isinstance(obj, bool):
        return "true" if obj else "false"
    if isinstance(obj, (int, float)):
        return json.dumps(obj)
    return json.dumps(str(obj), ensure_ascii=False)


# ============================================================================ schema validation
class MiniValidator:
    """Fallback validator for the JSON-Schema subset used in data/schema (used only if `jsonschema` is missing)."""

    def __init__(self, schemas: dict[str, dict]):
        self.schemas = schemas

    def resolve(self, ref, base):
        file, _, frag = ref.partition("#")
        doc = self.schemas[file] if file else base
        node = doc
        for part in [p for p in frag.split("/") if p]:
            node = node[part]
        return node, doc

    def errors(self, inst, sch, base, path="$", out=None, limit=50):
        out = [] if out is None else out
        if len(out) >= limit:
            return out
        if "$ref" in sch:
            node, doc = self.resolve(sch["$ref"], base)
            self.errors(inst, node, doc, path, out)
        for sub in sch.get("allOf", []):
            self.errors(inst, sub, base, path, out)
        if "anyOf" in sch and not any(not self.errors(inst, s, base, path, []) for s in sch["anyOf"]):
            out.append(f"{path}: matches none of anyOf")
        types = sch.get("type")
        if types:
            types = types if isinstance(types, list) else [types]
            ok = any(
                (t == "object" and isinstance(inst, dict)) or (t == "array" and isinstance(inst, list)) or
                (t == "string" and isinstance(inst, str)) or (t == "boolean" and isinstance(inst, bool)) or
                (t == "null" and inst is None) or
                (t == "integer" and isinstance(inst, int) and not isinstance(inst, bool)) or
                (t == "number" and isinstance(inst, (int, float)) and not isinstance(inst, bool)) for t in types)
            if not ok:
                out.append(f"{path}: expected {types}, got {type(inst).__name__}")
                return out
        if "const" in sch and inst != sch["const"]:
            out.append(f"{path}: expected const {sch['const']!r}")
        if "enum" in sch and inst not in sch["enum"]:
            out.append(f"{path}: {inst!r} not in enum")
        if isinstance(inst, (int, float)) and not isinstance(inst, bool):
            if "minimum" in sch and inst < sch["minimum"]:
                out.append(f"{path}: {inst} < minimum {sch['minimum']}")
            if "maximum" in sch and inst > sch["maximum"]:
                out.append(f"{path}: {inst} > maximum {sch['maximum']}")
        if isinstance(inst, str):
            import re
            if "pattern" in sch and not re.search(sch["pattern"], inst):
                out.append(f"{path}: {inst!r} does not match {sch['pattern']}")
            if "minLength" in sch and len(inst) < sch["minLength"]:
                out.append(f"{path}: too short")
        if isinstance(inst, dict):
            for req in sch.get("required", []):
                if req not in inst:
                    out.append(f"{path}: missing required {req!r}")
            props = sch.get("properties", {})
            for k, val in inst.items():
                if k in props:
                    self.errors(val, props[k], base, f"{path}.{k}", out)
                elif sch.get("additionalProperties") is False:
                    out.append(f"{path}: unexpected property {k!r}")
                elif isinstance(sch.get("additionalProperties"), dict):
                    self.errors(val, sch["additionalProperties"], base, f"{path}.{k}", out)
        if isinstance(inst, list):
            if "minItems" in sch and len(inst) < sch["minItems"]:
                out.append(f"{path}: fewer than {sch['minItems']} items")
            if "items" in sch:
                for i, it in enumerate(inst):
                    self.errors(it, sch["items"], base, f"{path}[{i}]", out)
                    if len(out) >= limit:
                        break
        return out


def make_validator():
    schemas = {p.name: jload(p) for p in sorted(SCHEMA_DIR.glob("*.schema.json"))}
    try:
        from jsonschema import Draft202012Validator
        from referencing import Registry, Resource
        reg = Registry().with_resources([(s["$id"], Resource.from_contents(s)) for s in schemas.values()])

        def validate(name, doc):
            v = Draft202012Validator(schemas[f"{name}.schema.json"], registry=reg)
            return [f"{'/'.join(map(str, e.absolute_path)) or '$'}: {e.message}" for e in
                    sorted(v.iter_errors(doc), key=lambda e: list(map(str, e.absolute_path)))[:50]]
        return validate, "jsonschema"
    except ImportError:
        mv = MiniValidator(schemas)

        def validate(name, doc):
            s = schemas[f"{name}.schema.json"]
            return mv.errors(doc, s, s)
        return validate, "built-in mini validator"


# ============================================================================ main build
def fill(tpl: dict, **kw) -> dict:
    return {lang: txt.format(**kw) for lang, txt in tpl.items() if lang in ("zh-TW", "en", "ja")}


def year_range_text(years):
    return f"{min(years)}–{max(years)}" if years else "—"


def build(args):
    global QUIET
    QUIET = args.quiet
    if not args.no_map:
        import map_amr
        map_amr.run(quiet=args.quiet)
    v = vocab()
    cfg = jload(CUR / "_config.json")
    srcs = {s["id"]: s for s in jload(CUR / "sources.json")["sources"]}
    notes = jload(CUR / "notes.json")
    prov = jload(CUR / "_provenance.json").get("datasets", {}) if (CUR / "_provenance.json").exists() else {}
    dims_amu = jload(CUR / "dims" / "amu.json")
    dims_hai = jload(CUR / "dims" / "hai.json")
    dims_glass = jload(CUR / "dims" / "glass.json")
    version = cfg["dataVersion"]
    report_src = cfg["reportSources"]

    org_codes = {o["code"] for o in v.organisms} | set(v.auto_organisms)
    abx_codes = {a["code"] for a in v.antibiotics} | set(v.auto_antibiotics)
    autos_org = dict(v.auto_organisms)
    autos_abx = dict(v.auto_antibiotics)
    for code in org_codes | abx_codes:
        pass

    def allow_auto(codes, recs, field):
        return codes | {r[field] for r in recs if isinstance(r.get(field), str) and r[field].startswith("X-")}

    def order_of(lst):
        return {d["code"]: d.get("order", 0) for d in lst}

    envs: dict[str, dict] = {}

    # ---------------------------------------------------------------- resistance
    res = load_resistance(v)
    check_codes("resistance", res, "pathogen", allow_auto(org_codes, res, "pathogen"))
    check_codes("resistance", res, "antibiotic", allow_auto(abx_codes, res, "antibiotic"))
    check_codes("resistance", res, "phenotype", set(v.pheno_by_code), optional=True)
    check_unique("resistance", res, lambda r: (r["year"], r["pathogen"], r["antibiotic"], r.get("phenotype"), r["level"],
                                               r["ward"], r["setting"], r["specimen"]))
    for r in res:
        if "susceptible_pct" in r and abs(r["resistant_pct"] + r["susceptible_pct"] - 100) > 0.051:
            err(f"resistance: resistant_pct + susceptible_pct != 100 for {r}")
        if "ci_low" in r and "ci_high" in r and not (r["ci_low"] - 0.5 <= r["resistant_pct"] <= r["ci_high"] + 0.5):
            warn(f"resistance: value outside its CI {r}")
        if "phenotype" in r:
            pm = v.pheno_by_code.get(r["phenotype"], {}).get("meta", {})
            if pm and (pm["pathogen"] != r["pathogen"] or pm["antibiotic"] != r["antibiotic"]):
                err(f"resistance: phenotype {r['phenotype']} inconsistent with pathogen/antibiotic in {r}")
    rp = prov.get("resistance", {})
    res_ingested = rp.get("status") == "ingested" and len(res) > 0
    res_years = sorted({r["year"] for r in res})
    res_reports = sorted({r["reportYear"] for r in res if "reportYear" in r})
    prec = Counter(r["precision"] for r in res)
    res_sources = [srcs[report_src[str(y)]] for y in (res_reports or [int(y) for y in report_src])]
    used_groups = {v.abx_by_code[a]["group"] for a in {r["antibiotic"] for r in res} if a in v.abx_by_code}
    res_notes = fill(notes["resistance"], years=year_range_text(res_years), table=prec.get("table", 0),
                     text=prec.get("text", 0), chart=prec.get("chart_estimate", 0))
    if not res:
        res_notes = {k: val + " " + {"zh-TW": "（轉錄資料尚未匯入）", "en": "(transcriptions not yet ingested)",
                                     "ja": "（転記データ未取り込み）"}[k] for k, val in res_notes.items()}
    envs["resistance"] = {
        "dataset": "resistance", "version": version if res_ingested else version + "-pending", "generatedAt": PLACEHOLDER_TS,
        "provisional": not res_ingested, "sources": res_sources, "notes": res_notes,
        "meta": {"coverage": {"dataYears": res_years, "reportYears": res_reports, "byKind": rp.get("byKind", {})},
                 "precisionSummary": {k: prec.get(k, 0) for k in ("table", "text", "chart_estimate")},
                 "dedupDropped": sum(1 for _ in read_csv(CUR / "_dedup_log.csv") if _["dataset"] == "resistance"),
                 "definitions": {"resistant_pct": "table rows: 100 - %susceptible (non-susceptible incl. intermediate); text/chart rows: %resistant as printed",
                                 "phenotype": "present only on section-4 MDRO trend indicators; absent on drug-level rows (antibiogram 圖3-1-x, pathogen charts 圖3-2-x)",
                                 "dedup": "same key in several editions -> newest reportYear wins, then precision table > text > chart_estimate"}},
        "dims": {
            "pathogens": dimlist(subset(v.organisms, {r["pathogen"] for r in res}, autos_org)),
            "antibiotics": dimlist(subset(v.antibiotics, {r["antibiotic"] for r in res}, autos_abx)),
            "antibioticClasses": dimlist([g for g in v.antibiotic_groups if g["code"] in used_groups]),
            "phenotypes": dimlist(subset(v.phenotypes, {r["phenotype"] for r in res if "phenotype" in r})),
            "levels": dimlist(v.levels), "wards": dimlist(subset(v.wards, {r["ward"] for r in res} | {"all"})),
            "settings": dimlist(v.settings), "specimens": dimlist(subset(v.specimens, {r["specimen"] for r in res} | {"all"})),
            "precisions": dimlist(v.precisions)},
        "records": res}
    if not res:
        warn("resistance: 0 records (no transcriptions mapped yet)")

    # ---------------------------------------------------------------- isolates
    iso = load_isolates()
    check_codes("isolates", iso, "organism", allow_auto(org_codes, iso, "organism"))
    check_unique("isolates", iso, lambda r: (r["year"], r["organism"], r["scope"], r["level"], r.get("subset", "")))
    ranks = defaultdict(list)
    for r in iso:
        if "rank" in r:
            ranks[(r["year"], r["scope"], r["level"])].append(r["rank"])
    for k, rs in ranks.items():
        if len(rs) != len(set(rs)):
            warn(f"isolates: tied/duplicate ranks {sorted(rs)} for {k} (as printed)")
    # QC: (I+R) count / total count should reproduce the MDRO trend %R read independently from 圖 4-x-y-2
    pheno_of = {pm["meta"]["pathogen"]: pm["code"] for pm in v.phenotypes if pm["meta"]["antibiotic"] in ("MEM", "OXA", "VAN")
                and pm["code"] not in ("CR-ENT",)}
    totals = {(r["year"], r["organism"], r["scope"], r["level"]): r["isolates"] for r in iso if not r.get("subset")}
    mdro_pct = {(r["year"], r["phenotype"], r["setting"], r["level"]): r["resistant_pct"] for r in res if "phenotype" in r}
    qc = []
    for r in iso:
        if r.get("subset") == "I+R":
            t = totals.get((r["year"], r["organism"], r["scope"], r["level"]))
            p = mdro_pct.get((r["year"], pheno_of.get(r["organism"]), r["scope"], r["level"]))
            if t and p is not None:
                d = round(100 * r["isolates"] / t - p, 1)
                qc.append(d)
                if abs(d) > 10:
                    warn(f"isolates QC: (I+R)/total differs from MDRO %R by {d} pts for {r['organism']} {r['scope']} {r['level']} {r['year']}")
    qc_meta = {"pairs": len(qc), "medianDiffPts": sorted(qc)[len(qc) // 2] if qc else None,
               "maxAbsDiffPts": max((abs(x) for x in qc), default=None),
               "within2Pts": sum(1 for x in qc if abs(x) <= 2),
               "description": "100 x (I+R count) / total count minus the MDRO %R transcribed independently (same organism, setting, level, year)"}
    ip = prov.get("isolates", {})
    iso_ingested = ip.get("status") == "ingested" and len(iso) > 0
    iso_years = sorted({r["year"] for r in iso})
    iso_reports = sorted({r["reportYear"] for r in iso if "reportYear" in r})
    scope_dims = [{"code": "all", "name": v.specimens[0]["name"], "order": 0}] + \
        [{"code": d["code"], "name": d["name"], "group": "specimen", "order": d["order"]} for d in v.specimens if d["code"] in {"blood", "urine", "sputum", "pus", "stool"}] + \
        [{"code": d["code"], "name": d["name"], "group": "setting", "order": 10 + d["order"]} for d in v.settings if d["code"] in {"co", "ho"}]
    envs["isolates"] = {
        "dataset": "isolates", "version": version if iso_ingested else version + "-pending", "generatedAt": PLACEHOLDER_TS,
        "provisional": not iso_ingested, "sources": [srcs[report_src[str(y)]] for y in (iso_reports or [int(y) for y in report_src])],
        "notes": fill(notes["isolates"], years=year_range_text(iso_years)),
        "meta": {"coverage": {"dataYears": iso_years, "reportYears": iso_reports}, "qc": qc_meta,
                 "precisionSummary": dict(sorted(Counter(r.get("precision", "table") for r in iso).items())),
                 "definitions": {"scope": "all = all specimens (CO+HO); blood/urine/sputum/pus/stool = specimen (CO+HO); co/ho = infection setting (all specimens)",
                                 "TOTAL/OTHER": "organism codes TOTAL and OTHER are the printed 總計 / 其他 rows",
                                 "subset": "'I+R' = non-susceptible isolates, 'S' = susceptible isolates (section-4 MDRO count charts, by level x CO/HO); absent = total isolates. Never add subsets to totals."}},
        "dims": {"organisms": dimlist(subset(v.organisms, {r["organism"] for r in iso}, autos_org)),
                 "scopes": scope_dims, "levels": dimlist(v.levels), "precisions": dimlist(v.precisions)},
        "records": iso}

    # ---------------------------------------------------------------- provisional datasets
    def provisional_flag(name, origins):
        st = prov.get(name, {}).get("status")
        return not (st == "ingested" and origins.get("model", 0) == 0)

    amu, amu_orig = load_simple("antibiotic_use", [("year", int), ("level", str), ("setting", str), ("atc", str), ("className", str),
                                                   ("aware", str), ("metric", str), ("value", float)])
    cls = {d["code"]: d for d in dims_amu["classes"]}
    check_codes("antibiotic_use", amu, "className", set(cls))
    check_unique("antibiotic_use", amu, lambda r: (r["year"], r["level"], r["setting"], r["className"], r["metric"]))
    tot = defaultdict(float)
    tots = {}
    for r in amu:
        if r["className"] in cls and cls[r["className"]]["meta"]["aware"] != r["aware"]:
            err(f"antibiotic_use: aware {r['aware']} != dims for {r['className']}")
        k = (r["year"], r["level"], r["setting"], r["metric"])
        if r["className"] == "TOTAL":
            tots[k] = r["value"]
        else:
            tot[k] += r["value"]
    for k, t in tots.items():
        if abs(tot[k] - t) > 0.15:
            err(f"antibiotic_use: TOTAL {t} != sum of classes {tot[k]:.1f} for {k}")
    lo = order_of(v.levels)
    co = order_of(dims_amu["classes"])
    amu.sort(key=lambda r: (r["year"], lo[r["level"]], r["setting"], r["metric"], co.get(r["className"], 99)))
    amu_prov = provisional_flag("antibiotic_use", amu_orig)
    envs["antibiotic_use"] = {
        "dataset": "antibiotic_use", "version": version + ("-provisional" if amu_prov else ""), "generatedAt": PLACEHOLDER_TS,
        "provisional": amu_prov, "sources": [srcs["tw-amr-watch-model"], srcs["tw-cdc-amu-ref"]] if amu_prov else [srcs["tw-cdc-amu-ref"]],
        "notes": fill(notes["provisional"], report={"zh-TW": "臺灣抗生素使用量監視年報", "en": "Taiwan Antimicrobial Use Surveillance Annual Report",
                                                    "ja": "台湾抗菌薬使用量監視年報"}["en"]) if amu_prov else None,
        "dims": {"classes": dimlist(dims_amu["classes"]), "aware": dimlist(dims_amu["aware"]), "levels": dimlist(v.levels),
                 "settings": dimlist(dims_amu["settings"]), "metrics": dimlist(dims_amu["metrics"])},
        "records": amu}

    hai, hai_orig = load_simple("hai", [("year", int), ("level", str), ("icu_type", str), ("metric", str), ("value", float), ("unit", str)])
    mu = {d["code"]: d["meta"]["unit"] for d in dims_hai["metrics"]}
    check_unique("hai", hai, lambda r: (r["year"], r["level"], r["icu_type"], r["metric"]))
    for r in hai:
        if mu.get(r["metric"]) != r["unit"]:
            err(f"hai: unit {r['unit']} does not match metric {r['metric']}")
    io_ = order_of(dims_hai["icuTypes"])
    mo = order_of(dims_hai["metrics"])
    hai.sort(key=lambda r: (r["year"], lo[r["level"]], io_.get(r["icu_type"], 99), mo.get(r["metric"], 99)))
    hai_prov = provisional_flag("hai", hai_orig)
    hai_note = fill(notes["provisional"], report="醫療照護相關感染監視年報 (TNIS)")
    envs["hai"] = {
        "dataset": "hai", "version": version + ("-provisional" if hai_prov else ""), "generatedAt": PLACEHOLDER_TS,
        "provisional": hai_prov, "sources": [srcs["tw-amr-watch-model"], srcs["tw-cdc-hai-ref"]] if hai_prov else [srcs["tw-cdc-hai-ref"]],
        "notes": hai_note if hai_prov else None,
        "dims": {"levels": dimlist(v.levels), "icuTypes": dimlist(dims_hai["icuTypes"]), "metrics": dimlist(dims_hai["metrics"]),
                 "units": dimlist(dims_hai["units"])},
        "records": hai}

    hp, hp_orig = load_simple("hai_pathogens", [("year", int), ("level", str), ("site", str), ("rank", int), ("pathogen", str), ("pct", float)])
    check_codes("hai_pathogens", hp, "pathogen", org_codes)
    check_unique("hai_pathogens", hp, lambda r: (r["year"], r["level"], r["site"], r["rank"]))
    check_unique("hai_pathogens", hp, lambda r: (r["year"], r["level"], r["site"], r["pathogen"]))
    so = order_of(dims_hai["sites"])
    hp.sort(key=lambda r: (r["year"], lo[r["level"]], so.get(r["site"], 9), r["rank"]))
    prev = None
    for r in hp:
        k = (r["year"], r["level"], r["site"])
        if prev and prev[0] == k and r["pct"] > prev[1] + 1e-9:
            err(f"hai_pathogens: pct not descending by rank at {k} rank {r['rank']}")
        prev = (k, r["pct"])
    hp_prov = provisional_flag("hai_pathogens", hp_orig)
    envs["hai_pathogens"] = {
        "dataset": "hai_pathogens", "version": version + ("-provisional" if hp_prov else ""), "generatedAt": PLACEHOLDER_TS,
        "provisional": hp_prov, "sources": [srcs["tw-amr-watch-model"], srcs["tw-cdc-hai-ref"]] if hp_prov else [srcs["tw-cdc-hai-ref"]],
        "notes": hai_note if hp_prov else None,
        "dims": {"pathogens": dimlist(subset(v.organisms, {r["pathogen"] for r in hp})), "sites": dimlist(dims_hai["sites"]),
                 "levels": dimlist(subset(v.levels, {r["level"] for r in hp}))},
        "records": hp}

    # ---------------------------------------------------------------- GLASS (+ TWN derived from real resistance data)
    countries = {r["iso3"]: r for r in read_csv(CUR / "glass_countries.csv")}
    glass_rows = read_csv(CUR / "glass.csv")
    glass, origins = [], Counter()
    for i, r in enumerate(glass_rows, 2):
        c = countries.get(r["iso3"])
        if not c:
            err(f"glass.csv:{i}: iso3 {r['iso3']} missing from glass_countries.csv")
            continue
        if r["source"] not in srcs:
            err(f"glass.csv:{i}: source {r['source']!r} not in sources.json")
        origins[r.get("origin") or "unknown"] += 1
        glass.append({"iso3": r["iso3"], "country": {"zh-TW": c["name_zh-TW"], "en": c["name_en"], "ja": c["name_ja"]},
                      "whoRegion": c["whoRegion"], "year": num(r["year"], int), "indicator": r["indicator"],
                      "resistant_pct": num(r["resistant_pct"]), "isolates": num(r.get("isolates"), int), "source": r["source"]})
    twn_rows, comparability = derive_twn(res, dims_glass["indicators"], countries.get("TWN"), report_src, v)
    glass = [g for g in glass if g["iso3"] != "TWN"] + twn_rows
    check_unique("glass", glass, lambda r: (r["iso3"], r["indicator"]))
    ro = order_of(dims_glass["whoRegions"])
    ino = order_of(dims_glass["indicators"])
    glass.sort(key=lambda r: (ino[r["indicator"]], ro[r["whoRegion"]], r["iso3"]))
    used_src = sorted({g["source"] for g in glass})
    envs["glass"] = {
        "dataset": "glass", "version": version + "-provisional", "generatedAt": PLACEHOLDER_TS, "provisional": True,
        "sources": [srcs[s] for s in used_src], "notes": fill(notes["glass"]),
        "meta": {"comparability": comparability},
        "dims": {"indicators": dimlist(dims_glass["indicators"]), "whoRegions": dimlist(dims_glass["whoRegions"]),
                 "countries": [{"code": k, "name": {"zh-TW": c["name_zh-TW"], "en": c["name_en"], "ja": c["name_ja"]},
                                "group": c["whoRegion"], "meta": {"whoRegion": c["whoRegion"]}}
                               for k, c in sorted(countries.items())]},
        "records": glass}

    # ---------------------------------------------------------------- content pass-through
    for name in ("links", "glossary", "kb"):
        envs[name] = content_envelope(name, version, notes["content"], args.lenient_content)

    for env in envs.values():
        if env.get("notes") is None:
            env.pop("notes", None)

    # ---------------------------------------------------------------- meta
    core = ["resistance", "isolates", "antibiotic_use", "hai", "hai_pathogens", "glass"]
    years_avail = sorted(set(res_years) | set(iso_years)) or sorted({r["year"] for r in amu})
    pdfs = []
    for p in sorted(RAW.glob("*.pdf")) if RAW.exists() else []:
        ry = next((int(y) for y in report_src if y in p.name), None)
        pdfs.append({"file": f"raw/{p.name}", "reportYear": ry, "source": report_src.get(str(ry)) if ry else None,
                     "sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "bytes": p.stat().st_size,
                     "status": "ingested" if ry in res_reports or ry in iso_reports else "pending"})
    meta_records = []
    for name in core + ["links", "glossary", "kb"]:
        e = envs[name]
        ys = [r["year"] for r in e["records"] if isinstance(r, dict) and isinstance(r.get("year"), int)]
        meta_records.append({"dataset": name, "file": f"data/{name}.json", "records": len(e["records"]), "provisional": e["provisional"],
                             "yearMin": min(ys) if ys else None, "yearMax": max(ys) if ys else None})
    all_src_ids = []
    for name in core:
        for s in envs[name]["sources"]:
            if s["id"] not in all_src_ids:
                all_src_ids.append(s["id"])
    envs["meta"] = {
        "dataset": "meta", "version": version, "generatedAt": PLACEHOLDER_TS,
        "provisional": not res_ingested,
        "latestYear": max(years_avail) if years_avail else None, "yearsAvailable": years_avail,
        "provisionalDatasets": [n for n in core if envs[n]["provisional"]],
        "ingestion": {"status": "ingested" if res_ingested else "provisional", "pdfs": pdfs},
        "lastBuild": PLACEHOLDER_TS, "contentDigest": "",
        "sources": [srcs[i] for i in all_src_ids], "notes": fill(notes["meta"]), "records": meta_records}
    return envs


def derive_twn(res, indicators, twn_country, report_src, v):
    """TWN GLASS rows from the real resistance data. Preference per indicator:
    1 blood, national, CO+HO, drug-level (antibiotic preference order from dims/glass.json)
    2 MDRO phenotype indicator, national, CO+HO, all specimens
    3 all specimens, national, CO+HO, drug-level (antibiogram)"""
    name = {"zh-TW": twn_country["name_zh-TW"], "en": twn_country["name_en"], "ja": twn_country["name_ja"]} if twn_country else \
        {"zh-TW": "臺灣", "en": "Taiwan", "ja": "台湾"}
    region = twn_country["whoRegion"] if twn_country else "WPR"
    base = [r for r in res if r["level"] == "all" and r["setting"] == "all" and r["ward"] == "all"]
    rows, per = [], {}
    tiers = [("blood", lambda r, m: "phenotype" not in r and r["specimen"] == "blood" and r["pathogen"] == m["pathogen"] and r["antibiotic"] in m["antibiotics"]),
             ("phenotype", lambda r, m: r.get("phenotype") == m.get("phenotype") and r["specimen"] == "all"),
             ("all_specimens", lambda r, m: "phenotype" not in r and r["specimen"] == "all" and r["pathogen"] == m["pathogen"] and r["antibiotic"] in m["antibiotics"])]
    for ind in indicators:
        m = ind["meta"]
        chosen = None
        for tier, pred in tiers:
            cands = [r for r in base if pred(r, m)]
            if not cands:
                continue
            ymax = max(r["year"] for r in cands)
            cands = [r for r in cands if r["year"] == ymax]
            pref = {a: i for i, a in enumerate(m["antibiotics"])}
            cands.sort(key=lambda r: (pref.get(r["antibiotic"], 99), -(r.get("reportYear") or 0)))
            chosen = (tier, cands[0])
            break
        if not chosen:
            per[ind["code"]] = {"available": False, "reason": "no matching Taiwan record yet"}
            continue
        tier, r = chosen
        ry = r.get("reportYear")
        src = report_src.get(str(ry), "tw-cdc-amr-2024")
        rows.append({"iso3": "TWN", "country": name, "whoRegion": region, "year": r["year"], "indicator": ind["code"],
                     "resistant_pct": r["resistant_pct"], "isolates": r.get("isolates"), "source": src})
        measure = "non_susceptible (100 - %S)" if "susceptible_pct" in r else "resistant (%R as printed)"
        per[ind["code"]] = {"available": True, "tier": tier, "pathogen": r["pathogen"], "antibiotic": r["antibiotic"],
                            "phenotype": r.get("phenotype"), "specimen": r["specimen"], "level": r["level"], "setting": r["setting"],
                            "year": r["year"], "precision": r["precision"], "reportYear": ry, "measure": measure,
                            "fallback": tier != "blood"}
    comp = {
        "TWN": per,
        "tiers": {"blood": "blood isolates, national, CO+HO, drug-level (closest to GLASS)",
                  "phenotype": "THAS MDRO indicator, national, CO+HO, all specimens (fallback)",
                  "all_specimens": "antibiogram, national, all specimens (fallback)"},
        "caveats": [
            "Taiwan is not a WHO Member State and does not report to GLASS; TWN rows are computed by this site from the THAS annual reports.",
            "Taiwan's THAS uses CLSI breakpoints; many GLASS/EARS-Net countries use EUCAST.",
            "THAS percentages count isolates (first-isolate rules per report); GLASS counts patients with positive blood cultures.",
            "Antibiogram-derived values are non-susceptible (100 - %S, includes intermediate) and therefore slightly higher than %R.",
            "Country values other than TWN are approximate curated figures (~2021-2022) - provisional."],
    }
    return rows, comp


def content_envelope(name, version, note, lenient):
    path = CUR / f"{name}.json"
    if not path.exists():
        warn(f"{name}: data/curated/{name}.json not found - writing an empty envelope")
        return {"dataset": name, "version": "0.0.0", "generatedAt": PLACEHOLDER_TS, "provisional": False, "sources": [],
                "notes": note, "records": []}
    try:
        doc = jload(path)
    except json.JSONDecodeError as e:
        (warn if lenient else err)(f"{name}: invalid JSON in data/curated/{name}.json: {e}")
        return {"dataset": name, "version": "0.0.0", "generatedAt": PLACEHOLDER_TS, "provisional": False, "sources": [], "records": []}
    if isinstance(doc, list):
        doc = {"records": doc}
    env = {"dataset": name, "version": str(doc.get("version", version)), "generatedAt": PLACEHOLDER_TS,
           "provisional": bool(doc.get("provisional", False)), "sources": doc.get("sources", [])}
    for k in ("notes", "dims", "meta"):
        if k in doc:
            env[k] = doc[k]
    env["records"] = doc.get("records", [])
    return env


# ============================================================================ API
API_NAMES = {"meta": "meta", "resistance": "resistance", "isolates": "isolates", "antibiotic_use": "antibiotic-use", "hai": "hai",
             "hai_pathogens": "hai-pathogens", "glass": "glass", "links": "links", "glossary": "glossary", "kb": "kb"}
CSV_COLS = {
    "resistance": ["year", "pathogen", "antibiotic", "phenotype", "level", "ward", "setting", "specimen", "isolates", "resistant_pct",
                   "susceptible_pct", "ci_low", "ci_high", "precision", "reportYear"],
    "isolates": ["year", "organism", "scope", "level", "subset", "rank", "isolates", "precision", "reportYear"],
}
SLICES = [  # (dataset, by, field, path-segment)
    ("resistance", "pathogen", "pathogen", "resistance/pathogen"),
    ("resistance", "phenotype", "phenotype", "resistance/phenotype"),
    ("resistance", "year", "year", "resistance/year"),
    ("antibiotic_use", "year", "year", "antibiotic-use/year"),
    ("hai", "year", "year", "hai/year"),
    ("glass", "indicator", "indicator", "glass/indicator"),
    ("glass", "country", "iso3", "glass/country"),
]


def build_api(envs, base_url, files: dict[str, str]):
    catalogue = []
    endpoints = []
    for ds, api in API_NAMES.items():
        env = envs[ds]
        files[f"api/v1/{api}.json"] = dumps_envelope(env)
        recs = env["records"]
        files[f"api/v1/{api}.csv"] = to_csv(recs, CSV_COLS.get(ds)) if ds != "meta" else to_csv(recs)
        title = env.get("notes", {}).get("en", "") if False else None
        entry = {"id": api, "dataset": ds, "records": len(recs), "provisional": env["provisional"], "version": env["version"],
                 "json": f"{base_url}/{api}.json", "csv": f"{base_url}/{api}.csv",
                 "schema": f"{base_url}/schema/{ds}.schema.json", "slices": []}
        catalogue.append(entry)
        endpoints += [{"path": f"/{api}.json", "records": len(recs)}, {"path": f"/{api}.csv", "records": len(recs)}]
    for ds, by, field, seg in SLICES:
        env = envs[ds]
        groups = defaultdict(list)
        for r in env["records"]:
            if r.get(field) is not None:
                groups[r[field]].append(r)
        values = sorted(groups, key=lambda x: (str(type(x)), x))
        for val in values:
            sl = {k: env[k] for k in env if k != "records"}
            sl["slice"] = {"by": by, "value": val, "of": ds}
            sl["records"] = groups[val]
            files[f"api/v1/{seg}/{val}.json"] = dumps_envelope(sl)
            endpoints.append({"path": f"/{seg}/{val}.json", "records": len(groups[val])})
        next(e for e in catalogue if e["dataset"] == ds)["slices"].append(
            {"by": by, "urlTemplate": f"{base_url}/{seg}/{{{by}}}.json", "values": values})
    for p in sorted(SCHEMA_DIR.glob("*.schema.json")):
        files[f"api/v1/schema/{p.name}"] = p.read_text(encoding="utf-8")
    index = {"api": "TW-AMR Watch static data API", "version": "v1", "baseUrl": base_url, "generatedAt": PLACEHOLDER_TS,
             "provisionalDatasets": envs["meta"]["provisionalDatasets"],
             "cors": "Served by GitHub Pages with Access-Control-Allow-Origin: * - fetch from any origin; read-only GET; no auth, no rate-limit guarantees.",
             "openapi": f"{base_url}/openapi.yaml", "docs": "https://github.com/ancientsky/tw_amr_dashboard/blob/main/docs/API.md",
             "datasets": catalogue, "endpoints": endpoints}
    files["api/v1/index.json"] = json.dumps(index, ensure_ascii=False, indent=2) + "\n"
    files["api/v1/openapi.yaml"] = openapi(envs, base_url, catalogue)


def openapi(envs, base_url, catalogue) -> str:
    paths = {"/index.json": {"get": {"summary": "API catalogue (datasets, record counts, slice URLs, generatedAt)", "operationId": "getIndex",
                                     "responses": {"200": {"description": "Catalogue", "content": {"application/json": {"schema": {"type": "object"}}}}}}}}
    for e in catalogue:
        ds, api = e["dataset"], e["id"]
        ref = {"$ref": f"./schema/{ds}.schema.json"}
        prov = " PROVISIONAL estimates." if e["provisional"] else ""
        paths[f"/{api}.json"] = {"get": {"summary": f"{ds} dataset envelope ({e['records']} records).{prov}", "operationId": f"get_{ds}_json",
                                         "tags": [ds], "responses": {"200": {"description": "Envelope", "content": {"application/json": {"schema": ref}}}}}}
        paths[f"/{api}.csv"] = {"get": {"summary": f"{ds} records as CSV (UTF-8; LocalizedText flattened to field.zh-TW/en/ja)", "operationId": f"get_{ds}_csv",
                                        "tags": [ds], "responses": {"200": {"description": "CSV", "content": {"text/csv": {"schema": {"type": "string"}}}}}}}
        for s in e["slices"]:
            seg = s["urlTemplate"].replace(base_url, "")
            is_year = s["by"] == "year"
            paths[seg] = {"get": {"summary": f"{ds} records filtered by {s['by']} (same envelope + `slice`)", "operationId": f"get_{ds}_by_{s['by']}",
                                  "tags": [ds],
                                  "parameters": [{"name": s["by"], "in": "path", "required": True,
                                                  "schema": {"type": "integer" if is_year else "string", "enum": s["values"]}}],
                                  "responses": {"200": {"description": "Envelope slice", "content": {"application/json": {"schema": ref}}},
                                                "404": {"description": "No such slice"}}}}
    paths["/schema/{name}.schema.json"] = {"get": {"summary": "JSON Schema (draft 2020-12) of a dataset", "operationId": "getSchema",
                                                   "parameters": [{"name": "name", "in": "path", "required": True,
                                                                   "schema": {"type": "string", "enum": [e["dataset"] for e in catalogue] + ["common"]}}],
                                                   "responses": {"200": {"description": "Schema", "content": {"application/schema+json": {"schema": {"type": "object"}}}}}}}
    doc = {"openapi": "3.1.0",
           "info": {"title": "TW-AMR Watch static data API", "version": "1.0.0",
                    "description": ("Read-only static JSON/CSV files describing Taiwan antimicrobial resistance surveillance "
                                    "(Taiwan CDC THAS annual reports) plus provisional antibiotic-use, HAI and international comparison datasets. "
                                    "All endpoints are plain GET requests for static files on GitHub Pages, which serves "
                                    "`Access-Control-Allow-Origin: *`, so they can be fetched from any web origin. "
                                    "Check each envelope's `provisional` flag: provisional datasets are model estimates, not official data."),
                    "license": {"name": "Data: see sources in each envelope; code: repository license"}},
           "servers": [{"url": base_url}],
           "paths": paths}
    return "# Generated by scripts/build_data.py - do not edit by hand.\n" + yaml_dump(doc) + "\n"


# ============================================================================ write
def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-map", action="store_true", help="do not run the AMR transcription mapper first")
    ap.add_argument("--check", action="store_true", help="verify outputs are up to date; write nothing; exit 1 if stale")
    ap.add_argument("--quiet", action="store_true")
    ap.add_argument("--lenient-content", action="store_true", help="downgrade invalid links/glossary/kb files to warnings")
    args = ap.parse_args(argv)
    envs = build(args)
    cfg = jload(CUR / "_config.json")

    validate, engine = make_validator()
    for name, env in envs.items():
        errs = validate(name, env)
        if errs:
            if name in ("links", "glossary", "kb") and args.lenient_content:
                for e in errs[:10]:
                    warn(f"schema {name}: {e}")
                envs[name] = {**env, "records": []}
            else:
                for e in errs[:20]:
                    err(f"schema {name}: {e}")
    if ERRORS:
        print(f"[build] FAILED with {len(ERRORS)} contract violation(s):", file=sys.stderr)
        for e in ERRORS[:60]:
            print(f"  - {e}", file=sys.stderr)
        return 1

    # render everything with the placeholder timestamp, digest, then stamp
    files: dict[str, str] = {}
    for name, env in envs.items():
        files[f"data/{name}.json"] = dumps_envelope(env)
    build_api(envs, cfg["apiBaseUrl"].rstrip("/"), files)
    digest = hashlib.sha256("".join(k + "\0" + files[k] for k in sorted(files)).encode()).hexdigest()
    ts = stamp(digest)
    files = {k: s.replace(PLACEHOLDER_TS, ts) for k, s in files.items()}
    files["data/meta.json"] = files["data/meta.json"].replace('"contentDigest": ""', f'"contentDigest": "{digest}"')
    files["api/v1/meta.json"] = files["api/v1/meta.json"].replace('"contentDigest": ""', f'"contentDigest": "{digest}"')

    out_root = ROOT / "public"
    existing = {str(p.relative_to(out_root)) for d in (OUT_DATA, OUT_API) if d.exists() for p in d.rglob("*") if p.is_file()}
    stale = sorted(existing - set(files))
    changed = [k for k, s in files.items() if not (out_root / k).exists() or (out_root / k).read_text(encoding="utf-8") != s]
    if args.check:
        if changed or stale:
            print(f"[build] STALE: {len(changed)} changed, {len(stale)} stale files (run scripts/build_data.py)", file=sys.stderr)
            return 1
        info("up to date")
        return 0
    for k in stale:
        (out_root / k).unlink()
    for k in changed:
        p = out_root / k
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(files[k], encoding="utf-8")
    for d in (OUT_API,):  # prune empty dirs
        for p in sorted(d.rglob("*"), reverse=True):
            if p.is_dir() and not any(p.iterdir()):
                p.rmdir()

    info(f"validated with {engine}; generatedAt={ts}; {len(changed)} file(s) written, {len(stale)} removed, {len(files)} total")
    for name in ["meta", "resistance", "isolates", "antibiotic_use", "hai", "hai_pathogens", "glass", "links", "glossary", "kb"]:
        e = envs[name]
        info(f"  {name:15s} records={len(e['records']):6d} provisional={str(e['provisional']).lower()}")
    if WARNINGS:
        info(f"{len(WARNINGS)} warning(s)")
    return 0


def stamp(digest: str) -> str:
    if os.environ.get("SOURCE_DATE_EPOCH"):
        return datetime.fromtimestamp(int(os.environ["SOURCE_DATE_EPOCH"]), timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    meta = OUT_DATA / "meta.json"
    if meta.exists():
        try:
            m = jload(meta)
            if m.get("contentDigest") == digest and m.get("generatedAt"):
                return m["generatedAt"]
        except (json.JSONDecodeError, OSError):
            pass
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


if __name__ == "__main__":
    sys.exit(main())
