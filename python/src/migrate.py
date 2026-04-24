"""Normalize ship JSON from the new web schema into the legacy inline shape
expected by the Pillow renderers in ``ship_profile.py`` / ``system.py``.

The web app ships ship JSON with three schema differences relative to the
original Python format:

1. ``title`` / ``subtitle``                 -> ``name`` / ``description``
2. ``shields: { front, rear }``             -> ``shields: SystemRef``
3. ``reactor`` / ``mess`` / sections[*]     -> ``SystemRef`` (``{kind:"system"|"slot"}``)

Slot refs are resolved against the shared web library at
``web/src/core/library/*.json`` plus any ``dedicatedSystems`` the ship JSON
carries inline.

After ``migrate_ship`` the shape is what the renderer already accepts:
``title``, ``subtitle``, ``shields: {front, rear}``, inline systems for
reactor/mess/sections. Empty slots are dropped from sections.
"""
from __future__ import annotations

import glob
import json
import os
from typing import Any, Dict, List, Optional

# Directory holding the shared web library JSONs, relative to the repo root.
_WEB_LIBRARY_DIR = os.path.join("web", "src", "core", "library")


def load_web_library(repo_root: Optional[str] = None) -> Dict[str, dict]:
    """Merge every ``*.json`` under ``web/src/core/library/`` into one map.

    Mirrors ``loadBaseLibraryFromModules`` in the web app. Duplicate IDs raise.
    """
    base = repo_root if repo_root is not None else os.getcwd()
    lib_dir = os.path.join(base, _WEB_LIBRARY_DIR)
    merged: Dict[str, dict] = {}
    if not os.path.isdir(lib_dir):
        return merged
    for path in sorted(glob.glob(os.path.join(lib_dir, "*.json"))):
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        if not isinstance(data, dict):
            continue
        for key, sys in data.items():
            if key in merged:
                raise ValueError(
                    f'Duplicate system id "{key}" while loading web library from {path}'
                )
            merged[key] = sys
    return merged


def _normalize_system(raw: dict) -> dict:
    """Make a shallow copy of a system dict with defaults the renderer expects."""
    out = dict(raw)
    out.setdefault("name", "")
    out.setdefault("rules", "")
    out.setdefault("areas", [])
    out.setdefault("weapon", False)
    out.setdefault("main", False)
    out.setdefault("hull", False)
    out.setdefault("electronics", False)
    out.setdefault("life_support", False)
    return out


def _resolve_ref(ref: Any, library: Dict[str, dict]) -> Optional[dict]:
    """Resolve a SystemRef to a concrete inline system, or None for empty slots.

    Accepts either the new discriminated shape (``{kind: "system"|"slot", ...}``)
    or a legacy inline system dict (which is returned as-is, normalized).
    """
    if not isinstance(ref, dict):
        return None
    kind = ref.get("kind")
    if kind == "system" and isinstance(ref.get("system"), dict):
        return _normalize_system(ref["system"])
    if kind == "slot":
        selected = ref.get("selectedId")
        if not selected:
            return None
        sys = library.get(selected)
        if sys is None:
            raise KeyError(
                f'Slot references unknown system id "{selected}". '
                f"Known ids: {sorted(library.keys())}"
            )
        return _normalize_system(sys)
    # Legacy inline system (pre-SystemRef): treat the dict itself as the system.
    return _normalize_system(ref)


def _extract_shields(shields_ref: Any, library: Dict[str, dict]) -> Dict[str, List[int]]:
    """Collapse a shields SystemRef (or legacy ``{front, rear}``) to ``{front, rear}``."""
    if not isinstance(shields_ref, dict):
        return {"front": [], "rear": []}
    # Legacy inline shape.
    if "front" in shields_ref or "rear" in shields_ref:
        if shields_ref.get("kind") not in ("system", "slot"):
            return {
                "front": list(shields_ref.get("front") or []),
                "rear": list(shields_ref.get("rear") or []),
            }
    resolved = _resolve_ref(shields_ref, library)
    if resolved is None:
        return {"front": [], "rear": []}
    return {
        "front": list(resolved.get("front") or []),
        "rear": list(resolved.get("rear") or []),
    }


def migrate_ship(raw: dict, repo_root: Optional[str] = None) -> dict:
    """Convert a ship JSON doc (new or legacy) into the renderer's expected shape.

    Any ``dedicatedSystems`` block in the ship doc is merged on top of the
    shared web library for slot resolution. Empty slots in sections are
    dropped (the renderer has no concept of "empty slot").
    """
    if not isinstance(raw, dict):
        raise ValueError("Ship JSON must be an object")

    library = dict(load_web_library(repo_root))
    dedicated = raw.get("dedicatedSystems") or {}
    if isinstance(dedicated, dict):
        # Dedicated systems override the shared library on id collision; the
        # web app forbids collisions but we're permissive here.
        library.update(dedicated)

    sections_in = raw.get("sections") or {}

    def migrate_section(items: Any) -> List[dict]:
        if not isinstance(items, list):
            return []
        out: List[dict] = []
        for item in items:
            resolved = _resolve_ref(item, library)
            if resolved is not None:
                out.append(resolved)
        return out

    migrated: Dict[str, Any] = {
        "title": raw.get("name") or raw.get("title") or "Unnamed Ship",
        "subtitle": raw.get("description") or raw.get("subtitle") or "",
        "overdrive": list(raw.get("overdrive") or []),
        "control": int(raw.get("control") or 0),
        "shields": _extract_shields(raw.get("shields"), library),
        "reactor": _resolve_ref(raw.get("reactor"), library)
        or _normalize_system({"name": "Reactor", "kind": "reactor", "circles": 0}),
        "mess": _resolve_ref(raw.get("mess"), library)
        or _normalize_system({"name": "Mess", "kind": "mess", "med_bay": 0}),
        "sections": {
            "left": migrate_section(sections_in.get("left")),
            "core": migrate_section(sections_in.get("core")),
            "right": migrate_section(sections_in.get("right")),
        },
    }
    return migrated
