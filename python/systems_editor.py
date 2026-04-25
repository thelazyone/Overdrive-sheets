"""
Interactive system tile editor: load a JSON (library, ship, or dedicatedSystems),
list systems and ship slots (reactor/mess/shields + section slots), edit in the form,
and render a full 300 DPI tile (same as print/export), then downscale for on-screen
preview. Slots use `options` (full system dicts) and an editor `label` (shown in the list as
``{label} slot (n)``, same as the web app). Presets do not store an installed
choice; preview uses “Option to edit”. The web app may track an install for the sheet
separately — this editor strips any `selectedIndex` on save.
Legacy `allowed` / `selectedId` in a file is normalized on open using the merged
library. The slot panel is a compact bar (editing option, installed index, add/remove)
followed by the same system form used for inline systems.
FocusOut / Return — not on every keypress. An optional raw JSON column on the right of the form is available from
the “Show JSON” toolbar checkbox (off by default). The tile preview is
a full-width strip below the editor. Library / dedicated systems and section
rows can be removed (“Remove entry”); ship reactor/mess/shields rows that are
already slots cannot be removed as a whole (edit or replace in JSON).
Systems under a JSON key (library / dedicatedSystems) expose “Library id” in
the form to rename that key.
"""
from __future__ import annotations

import copy
import json
import os
import tkinter as tk
from collections.abc import Callable
from tkinter import filedialog, messagebox, ttk

import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)

if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

# After changing cwd, imports resolve to repo-root-relative paths (fonts, resources)
os.chdir(REPO_ROOT)

from PIL import Image, ImageTk  # noqa: E402  (import after chdir for clarity)

from src.system import (  # noqa: E402
    DPI,
    TILE_HEIGHT_CM,
    TILE_WIDTH_CM,
    create_system,
)


# --- data discovery ----------------------------------------------------------


SHIP_ROOT_KEYS = {
    "name",
    "description",
    "label",
    "dedicatedSystems",
    "overdrive",
    "control",
    "sections",
    "shields",
    "reactor",
    "mess",
    "title",
    "subtitle",
}


def _looks_like_system(d: dict) -> bool:
    if not isinstance(d, dict):
        return False
    k = d.get("kind")
    if k in ("generic", "mess", "reactor", "engine", "shields"):
        return True
    n = d.get("name", "")
    if isinstance(n, str) and n.lower() in ("mess", "reactor", "engine", "shields"):
        return "areas" in d or k or "circles" in d or "med_bay" in d
    if "name" in d and "areas" in d:
        return True
    if "name" in d and ("weapon" in d or "hull" in d or d.get("rules") is not None):
        return True
    return False


def build_merged_library(data: dict) -> dict:
    """Same idea as the web app: top-level library keys + dedicatedSystems (later wins on id)."""
    out: dict[str, dict] = {}
    if not isinstance(data, dict):
        return out
    for k, v in sorted(data.items(), key=lambda x: x[0]):
        if k in SHIP_ROOT_KEYS or k == "dedicatedSystems":
            continue
        if isinstance(v, dict) and _looks_like_system(v):
            out[k] = v
    ds = data.get("dedicatedSystems")
    if isinstance(ds, dict):
        for k, v in ds.items():
            if isinstance(v, dict) and _looks_like_system(v):
                out[k] = v
    return out


EntryRow = tuple[
    str,
    str,
    dict | None,
    Callable[[dict], None] | None,
    str | None,
    str | None,
]
"""
Listbox row:
  (entry_kind, list_label, dict_ref, remover, library_key, rename_scope).

entry_kind is ``"header"`` (section label, dict_ref None), ``"system"``, or ``"slot"``.

library_key: JSON id for this system when it lives under library/ or
dedicatedSystems/ (same value used when deleting, for slot cleanup).
rename_scope: "dedicated" | "library" if the id can be renamed in-form;
None for inline-only systems and all slot rows.
"""


def _clear_slots_pointing_to(data: dict, removed_id: str) -> None:
    """0.1 slots hold full system copies; removing a library id does not auto-edit slots."""

    _ = (data, removed_id)


def _rewrite_id_references(data: dict, old_id: str, new_id: str) -> None:
    """0.1 slots do not reference library ids; no slot rewrites needed."""

    _ = (data, old_id, new_id)


def _strip_slot_installation(slot: dict) -> None:
    """Preset slots are templates: no persisted installed index."""
    if isinstance(slot, dict) and slot.get("kind") == "slot":
        slot.pop("selectedIndex", None)


def normalize_slot_to_v01(slot: dict, lib: dict) -> None:
    """Mutate slot to { kind, label?, options }; migrate legacy allowed/selectedId."""
    if not isinstance(slot, dict) or slot.get("kind") != "slot":
        return
    if isinstance(slot.get("options"), list):
        for k in ("allowed", "selectedId", "arc-start", "arc-end"):
            slot.pop(k, None)
        if not isinstance(slot.get("label"), str):
            slot["label"] = ""
        _strip_slot_installation(slot)
        return
    allowed = [str(x).strip() for x in (slot.get("allowed") or []) if str(x).strip()]
    options: list[dict] = []
    for aid in allowed:
        if aid in lib and isinstance(lib[aid], dict):
            options.append(copy.deepcopy(lib[aid]))
    slot.clear()
    slot.update({"kind": "slot", "label": "", "options": options})


def strip_all_slot_installations_in_document(data: dict) -> None:
    """Remove selectedIndex from every slot before saving preset JSON."""
    if not isinstance(data, dict):
        return
    for key in ("reactor", "mess", "shields"):
        r = data.get(key)
        if isinstance(r, dict) and r.get("kind") == "slot":
            _strip_slot_installation(r)
    sec = data.get("sections")
    if isinstance(sec, dict):
        for col in ("left", "core", "right"):
            for item in sec.get(col) or []:
                if isinstance(item, dict) and item.get("kind") == "slot":
                    _strip_slot_installation(item)


def normalize_ship_document_slots(data: dict) -> None:
    """Normalize all ship slots in-place (for loaded JSON)."""
    if not isinstance(data, dict):
        return
    lib = build_merged_library(data)
    for key in ("reactor", "mess", "shields"):
        r = data.get(key)
        if isinstance(r, dict) and r.get("kind") == "slot":
            normalize_slot_to_v01(r, lib)
    sec = data.get("sections")
    if isinstance(sec, dict):
        for col in ("left", "core", "right"):
            for item in sec.get(col) or []:
                if isinstance(item, dict) and item.get("kind") == "slot":
                    normalize_slot_to_v01(item, lib)


def _rename_library_key_in_document(d: dict, old: str, new: str, scope: str) -> None:
    if scope == "dedicated":
        ds = d.get("dedicatedSystems")
        if not isinstance(ds, dict) or old not in ds:
            raise KeyError(f"dedicatedSystems has no key {old!r}")
        ds[new] = ds.pop(old)
        if not ds:
            d.pop("dedicatedSystems", None)
    elif scope == "library":
        if old in SHIP_ROOT_KEYS:
            raise KeyError(f"cannot rename reserved key {old!r}")
        if old not in d:
            raise KeyError(f"no top-level library key {old!r}")
        d[new] = d.pop(old)
    else:
        raise ValueError(f"unknown rename scope {scope!r}")


def _system_card_name(s: dict) -> str:
    """On-card name for list labels (inline systems)."""
    n = (s.get("name") or "").strip()
    return n if n else "Unnamed"


def format_slot_list_label(slot: dict, row_fallback: str | None = None) -> str:
    """Human-readable list row for a slot: ``{label} slot ({n})`` (matches web editor)."""
    opts = slot.get("options") or []
    n = len(opts) if isinstance(opts, list) else 0
    raw = (slot.get("label") or "").strip() if isinstance(slot.get("label"), str) else ""
    fb = (row_fallback or "").strip()
    base = raw or fb or "Unlabeled"
    return f"{base} slot ({n})"


def collect_all_entries(data: object) -> list[EntryRow]:
    """
    Return rows for the listbox: 6-tuple per EntryRow.
    entry_kind is ``header`` (non-selectable section label), ``system``, or ``slot``.
    dict_ref is the live system or slot object, or ``None`` for headers.
    """
    out: list[EntryRow] = []
    seen_sys: set[int] = set()

    def add_header(title: str) -> None:
        out.append(("header", title, None, None, None, None))

    def add_system(
        list_label: str,
        s: object,
        remover: Callable[[dict], None] | None,
        library_key: str | None = None,
        rename_scope: str | None = None,
    ) -> None:
        if not isinstance(s, dict) or not _looks_like_system(s):
            return
        i = id(s)
        if i in seen_sys:
            return
        seen_sys.add(i)
        out.append(("system", list_label, s, remover, library_key, rename_scope))

    def add_slot(
        list_label: str,
        slot: dict,
        remover: Callable[[dict], None] | None,
    ) -> None:
        if not isinstance(slot, dict) or slot.get("kind") != "slot":
            return
        out.append(("slot", list_label, slot, remover, None, None))

    if not isinstance(data, dict):
        return out

    library_header_done = False

    def ensure_library_header() -> None:
        nonlocal library_header_done
        if not library_header_done:
            add_header("── Library ──")
            library_header_done = True

    ds = data.get("dedicatedSystems")
    if isinstance(ds, dict):
        for k, s in sorted(ds.items(), key=lambda x: x[0]):

            def _rm_ded(d: dict, key: str = k) -> None:
                dd = d.get("dedicatedSystems")
                if isinstance(dd, dict) and key in dd:
                    del dd[key]
                    if not dd:
                        d.pop("dedicatedSystems", None)

            ensure_library_header()
            add_system(f"dedicatedSystems / {k}", s, _rm_ded, k, "dedicated")

    for k, v in sorted(data.items(), key=lambda x: x[0]):
        if k in SHIP_ROOT_KEYS:
            continue
        if isinstance(v, dict) and _looks_like_system(v):

            def _rm_lib(d: dict, key: str = k) -> None:
                if key in d and key not in SHIP_ROOT_KEYS:
                    del d[key]

            ensure_library_header()
            add_system(f"library / {k}", v, _rm_lib, k, "library")

    has_ship_core = any(isinstance(data.get(k), dict) for k in ("reactor", "mess", "shields"))
    if has_ship_core:
        add_header("── Core ──")
    for key in ("reactor", "mess", "shields"):
        r = data.get(key)
        if not isinstance(r, dict):
            continue
        if r.get("kind") == "slot":
            fb = {"reactor": "Reactor", "mess": "Mess", "shields": "Shields"}.get(key)
            add_slot(
                format_slot_list_label(r, fb),
                r,
                None,
            )
        elif r.get("kind") == "system" and "system" in r:

            def _rm_ship_inline(d: dict, field: str = key) -> None:
                d[field] = {
                    "kind": "slot",
                    "label": "",
                    "options": [],
                }

            add_system(
                f"{_system_card_name(r['system'])} ({key})",
                r["system"],
                _rm_ship_inline,
            )

    sec = data.get("sections")
    if isinstance(sec, dict):
        for col, banner in (("left", "LEFT"), ("core", "CENTER"), ("right", "RIGHT")):
            add_header(f"── {banner} ──")
            for i, item in enumerate(sec.get(col) or []):
                if not isinstance(item, dict):
                    continue
                if item.get("kind") == "slot":
                    def _rm_sec_slot(d: dict, c: str = col, idx: int = i) -> None:
                        ssec = d.get("sections") or {}
                        L = ssec.get(c)
                        if isinstance(L, list) and 0 <= idx < len(L):
                            L.pop(idx)

                    add_slot(
                        format_slot_list_label(item, None),
                        item,
                        _rm_sec_slot,
                    )
                elif item.get("kind") == "system" and "system" in item:

                    def _rm_sec_sys(d: dict, c: str = col, idx: int = i) -> None:
                        ssec = d.get("sections") or {}
                        L = ssec.get(c)
                        if isinstance(L, list) and 0 <= idx < len(L):
                            L.pop(idx)

                    add_system(
                        f"{_system_card_name(item['system'])} ({col})",
                        item["system"],
                        _rm_sec_sys,
                    )

    return out


def collect_system_entries(data: object) -> list[tuple[str, dict]]:
    """Systems only (for add-new flow that needs a system ref)."""
    return [(lbl, ref) for kind, lbl, ref, _, _, _ in collect_all_entries(data) if kind == "system"]


def _valid_library_id(new: str) -> bool:
    if not new or new.strip() != new:
        return False
    for ch in new:
        if not (ch.isalnum() or ch == "_"):
            return False
    return True


def is_pure_top_level_library(data: dict) -> bool:
    """True when JSON is a flat id → system map (not a full ship / preset document)."""
    if not data:
        return True
    if "sections" in data:
        return False
    if "dedicatedSystems" in data:
        return False
    if "reactor" in data or "mess" in data or "shields" in data:
        return False
    if "overdrive" in data:
        return False
    meta = {"name", "title", "subtitle", "description", "label", "control"}
    keys = [k for k in data if k not in meta]
    if not keys:
        return True
    return all(
        isinstance(data[k], dict) and _looks_like_system(data[k]) for k in keys
    )


def _unique_key(container: dict, base: str) -> str:
    if base not in container:
        return base
    n = 1
    while f"{base}_{n}" in container:
        n += 1
    return f"{base}_{n}"


def _default_new_system() -> dict:
    return {
        "kind": "generic",
        "name": "New system",
        "rules": "",
        "weapon": False,
        "main": False,
        "hull": False,
        "electronics": False,
        "life_support": False,
        "areas": [],
    }


# --- form + preview ---------------------------------------------------------


def _bparse_int_list(s: str) -> list[int]:
    s = s.strip()
    if not s:
        return []
    return [int(x.strip()) for x in s.split(",") if x.strip() != ""]


class SystemsEditor(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Systems editor (Overdrive)")

        self._data: dict | None = None
        self._file_path: str | None = None
        self._entries: list[EntryRow] = []
        self._entry_kind: str = "system"
        self._active: dict | None = None
        self._active_library_key: str | None = None
        self._active_rename_scope: str | None = None
        self._library_id_at_load: str | None = None
        self._list_index = 0
        self._render_after: str | None = None
        self._photo: ImageTk.PhotoImage | None = None
        self._form_vars: dict = {}
        self._bulk_load = False
        self._json_mute = False
        self._list_silent = False
        self._preview_pil: Image.Image | None = None
        self._preview_refit_after: str | None = None
        self._slot_last_edit_i: int | None = None

        self._build_menu()
        self._build_ui()
        self.protocol("WM_DELETE_WINDOW", self._on_quit)

    def _build_menu(self) -> None:
        m = tk.Menu(self)
        file_m = tk.Menu(m, tearoff=0)
        file_m.add_command(label="New file", command=self._new_file, accelerator="Ctrl+N")
        file_m.add_separator()
        file_m.add_command(label="Open…", command=self._open, accelerator="Ctrl+O")
        file_m.add_command(label="Save", command=self._save, accelerator="Ctrl+S")
        file_m.add_command(label="Save as…", command=self._save_as, accelerator="Ctrl+Shift+S")
        file_m.add_separator()
        file_m.add_command(label="Exit", command=self._on_quit, accelerator="Alt+F4")
        m.add_cascade(label="File", menu=file_m)
        self.config(menu=m)
        self.bind_all("<Control-n>", lambda e: self._new_file())
        self.bind_all("<Control-o>", lambda e: self._open())
        self.bind_all("<Control-s>", lambda e: self._save())
        self.bind_all("<Control-Shift-S>", lambda e: self._save_as())

    def _build_ui(self) -> None:
        tb = ttk.Frame(self)
        tb.pack(side=tk.TOP, fill=tk.X, padx=6, pady=4)
        for text, cmd, pad in [
            ("New file", self._new_file, 0),
            ("Open…", self._open, 0),
            ("Save", self._save, 0),
            ("Save as…", self._save_as, 8),
        ]:
            ttk.Button(tb, text=text, command=cmd).pack(side=tk.LEFT, padx=(2, 2 + pad) if pad else 2)
        ttk.Separator(tb, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=6)
        ttk.Button(tb, text="New system", command=self._new_system).pack(side=tk.LEFT, padx=2)
        ttk.Button(tb, text="Remove entry", command=self._remove_selected).pack(side=tk.LEFT, padx=2)
        ttk.Separator(tb, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=6)
        self._json_panel_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(
            tb,
            text="Show JSON",
            variable=self._json_panel_var,
            command=self._on_json_panel_toggle,
        ).pack(side=tk.LEFT, padx=2)

        # Vertical split: (list | form | [JSON?]) on top, full-width preview below.
        outer = ttk.PanedWindow(self, orient=tk.VERTICAL)
        outer.pack(fill=tk.BOTH, expand=True, padx=4, pady=(0, 4))

        top_h = ttk.PanedWindow(outer, orient=tk.HORIZONTAL)
        self._top_h_pane = top_h

        left = ttk.Frame(top_h, width=240)
        lf = ttk.LabelFrame(left, text="Systems & slots (ship)", padding=4)
        lf.pack(fill=tk.BOTH, expand=True)
        self._listbox = tk.Listbox(lf, width=34, font=("Segoe UI", 10), height=22)
        sb1 = ttk.Scrollbar(lf, orient=tk.VERTICAL, command=self._listbox.yview)
        self._listbox.configure(yscrollcommand=sb1.set)
        self._listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        sb1.pack(side=tk.RIGHT, fill=tk.Y)
        self._listbox.bind("<<ListboxSelect>>", self._on_list_select)
        self._listbox.bind("<Delete>", self._remove_selected)
        self._listbox.bind("<BackSpace>", self._remove_selected)
        ttk.Button(left, text="+ New system", command=self._new_system).pack(
            fill=tk.X, pady=(6, 0)
        )
        ttk.Button(left, text="Remove entry", command=self._remove_selected).pack(
            fill=tk.X, pady=(4, 0)
        )
        top_h.add(left, weight=0)

        form_wrap = ttk.Frame(top_h)
        cv = tk.Canvas(form_wrap, highlightthickness=0)
        scroll = ttk.Scrollbar(form_wrap, orient=tk.VERTICAL, command=cv.yview)
        self._form = ttk.Frame(cv)
        self._form.bind(
            "<Configure>", lambda e: cv.configure(scrollregion=cv.bbox("all"))
        )
        win = cv.create_window((0, 0), window=self._form, anchor="nw")
        cv.configure(yscrollcommand=scroll.set)

        def _cfg_cv(event):
            cv.itemconfigure(win, width=event.width)

        cv.bind("<Configure>", _cfg_cv)
        cv.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self._canvas = cv
        self._form_columns()
        top_h.add(form_wrap, weight=3)

        self._json_frame = ttk.LabelFrame(
            top_h,
            text="JSON — on the right (sash; focus out to apply)",
            padding=4,
        )
        j_wrap = ttk.Frame(self._json_frame)
        j_wrap.pack(fill=tk.BOTH, expand=True)
        jy = ttk.Scrollbar(j_wrap, orient=tk.VERTICAL)
        jx = ttk.Scrollbar(j_wrap, orient=tk.HORIZONTAL)
        self._json_text = tk.Text(
            j_wrap,
            height=12,
            width=50,
            font=("Consolas", 10),
            wrap=tk.NONE,
            undo=True,
        )
        self._json_text.configure(yscrollcommand=jy.set, xscrollcommand=jx.set)
        jy.config(command=self._json_text.yview)
        jx.config(command=self._json_text.xview)
        self._json_text.grid(row=0, column=0, sticky=tk.NSEW)
        jy.grid(row=0, column=1, sticky=tk.NS)
        jx.grid(row=1, column=0, sticky=tk.EW)
        j_wrap.grid_rowconfigure(0, weight=1)
        j_wrap.grid_columnconfigure(0, weight=1)
        self._json_text.bind("<FocusOut>", self._on_json_focus_out)
        # JSON is off by default; "Show JSON" adds this pane to the right of the form.
        outer.add(top_h, weight=2)

        preview_row = ttk.Frame(outer)
        pv_inner = ttk.Frame(preview_row)
        pv_inner.pack(fill=tk.BOTH, expand=True, padx=2, pady=(0, 4))
        ttk.Label(
            pv_inner,
            text="Preview: 300 DPI render, scaled to fit the area (WYSIWYG) — focus out / Enter to refresh",
            font=("Segoe UI", 9),
            foreground="#555",
        ).pack(side=tk.TOP, anchor=tk.W, fill=tk.X)
        self._img_area = ttk.Frame(pv_inner)
        self._img_area.pack(side=tk.TOP, fill=tk.BOTH, expand=True)
        self._img_label = ttk.Label(self._img_area, anchor=tk.CENTER, justify=tk.CENTER)
        self._img_label.place(relx=0.5, rely=0.5, anchor=tk.CENTER)
        self._img_area.bind("<Configure>", self._on_preview_area_configure)
        outer.add(preview_row, weight=2)

        self.minsize(1000, 700)
        self.geometry("1500x920")

    def _form_columns(self) -> None:
        self._form.grid_rowconfigure(1, weight=1)
        self._form.grid_columnconfigure(0, weight=1)

        self._form_slot = ttk.LabelFrame(
            self._form,
            text="Slot (label, then option templates — same as web presets)",
            padding=6,
        )
        self._form_slot.grid(row=0, column=0, sticky=tk.EW)
        self._form_slot.grid_columnconfigure(1, weight=1)
        self._form_slot.grid_remove()

        rsl = 0
        ttk.Label(self._form_slot, text="Slot label", font=("Segoe UI", 9, "bold")).grid(
            row=rsl, column=0, sticky=tk.W, pady=2
        )
        self._form_vars["slot_label_e"] = ttk.Entry(
            self._form_slot, width=52, font=("Segoe UI", 10)
        )
        self._form_vars["slot_label_e"].grid(row=rsl, column=1, sticky=tk.EW, pady=2)
        self._bind_done(self._form_vars["slot_label_e"])
        rsl += 1
        ttk.Label(
            self._form_slot,
            text='List row shows “{label} slot (n)”. Tab out or Enter to apply.',
            font=("Segoe UI", 8),
            foreground="#555",
        ).grid(row=rsl, column=0, columnspan=2, sticky=tk.W, pady=(0, 4))
        rsl += 1
        ttk.Label(self._form_slot, text="Option to edit").grid(
            row=rsl, column=0, sticky=tk.W, pady=2
        )
        self._form_vars["slot_edit_var"] = tk.StringVar(value="")
        self._form_vars["slot_edit_cb"] = ttk.Combobox(
            self._form_slot,
            textvariable=self._form_vars["slot_edit_var"],
            width=50,
            state="readonly",
        )
        self._form_vars["slot_edit_cb"].grid(row=rsl, column=1, sticky=tk.EW, pady=2)
        self._form_vars["slot_edit_cb"].bind(
            "<<ComboboxSelected>>",
            self._on_slot_edit_combo,
        )
        rsl += 1
        sab = ttk.Frame(self._form_slot)
        sab.grid(row=rsl, column=0, columnspan=2, sticky=tk.W, pady=4)
        ttk.Button(sab, text="Add blank", command=self._slot_add_blank).pack(
            side=tk.LEFT, padx=(0, 4)
        )
        ttk.Button(sab, text="Remove option", command=self._slot_remove_option).pack(
            side=tk.LEFT, padx=4
        )
        ttk.Label(sab, text="Add from library:").pack(side=tk.LEFT, padx=(12, 4))
        self._form_vars["slot_lib_add_cb"] = ttk.Combobox(sab, width=28)
        self._form_vars["slot_lib_add_cb"].pack(side=tk.LEFT, padx=2)
        self._form_vars["slot_lib_add_cb"].bind(
            "<<ComboboxSelected>>",
            self._on_slot_add_from_library,
        )
        ttk.Label(
            self._form_slot,
            text="Preview uses the option above. Below: edit that system like an inline entry.",
            font=("Segoe UI", 8),
            foreground="#555",
        ).grid(row=rsl + 1, column=0, columnspan=2, sticky=tk.W, pady=(2, 0))

        self._form_system = ttk.Frame(self._form)
        self._form_system.grid(row=1, column=0, sticky=tk.NSEW)
        self._form_system.grid_columnconfigure(1, weight=1)

        p = self._form_system
        r = 0
        self._library_id_lf = ttk.LabelFrame(
            p,
            text="Library id (JSON key for this entry — not the on-card Name)",
            padding=6,
        )
        self._library_id_lf.grid(row=r, column=0, columnspan=2, sticky=tk.EW, pady=(0, 8))
        r += 1
        self._form_vars["library_id_e"] = ttk.Entry(
            self._library_id_lf, width=52, font=("Consolas", 10)
        )
        self._form_vars["library_id_e"].grid(row=0, column=0, sticky=tk.W)
        self._form_vars["library_id_e"].bind("<FocusOut>", self._on_library_id_field_done)
        self._form_vars["library_id_e"].bind("<Return>", self._on_library_id_field_done)
        ttk.Label(
            self._library_id_lf,
            text="Edit and press Enter or tab away to rename; all ship slots that reference this id are updated.",
            font=("Segoe UI", 8),
            foreground="#555",
        ).grid(row=1, column=0, sticky=tk.W, pady=(4, 0))

        ttk.Label(p, text="Kind", font=("Segoe UI", 9, "bold")).grid(
            row=r, column=0, sticky=tk.W, pady=2
        )
        self._form_vars["kind"] = tk.StringVar(value="generic")
        kind_cb = ttk.Combobox(
            p,
            textvariable=self._form_vars["kind"],
            values=("generic", "mess", "reactor", "engine", "shields"),
            state="readonly",
            width=20,
        )
        kind_cb.grid(row=r, column=1, sticky=tk.W, pady=2)
        kind_cb.bind("<<ComboboxSelected>>", self._on_kind_change)
        r += 1

        for label, key in [
            ("Name", "name_e"),
            ("Rules (one line, or use \\n in JSON for breaks)", "rules_e"),
        ]:
            ttk.Label(p, text=label, font=("Segoe UI", 9, "bold")).grid(
                row=r, column=0, sticky=tk.NW, pady=2
            )
            e = ttk.Entry(p, width=56)
            e.grid(row=r, column=1, sticky=tk.EW, pady=2)
            self._form_vars[key] = e
            self._bind_done(e)
            r += 1

        ttk.Separator(p, orient=tk.HORIZONTAL).grid(
            row=r, column=0, columnspan=2, sticky=tk.EW, pady=6
        )
        r += 1
        ttk.Label(p, text="Flags", font=("Segoe UI", 9, "bold")).grid(
            row=r, column=0, columnspan=2, sticky=tk.W
        )
        r += 1
        flags = ("weapon", "main", "hull", "electronics", "life_support")
        fb = ttk.Frame(p)
        fb.grid(row=r, column=0, columnspan=2, sticky=tk.W)
        for i, fl in enumerate(flags):
            v = tk.BooleanVar(value=False)
            self._form_vars[fl] = v
            cb = ttk.Checkbutton(fb, text=fl, variable=v, command=self._schedule_render)
            cb.grid(row=0, column=i, padx=4, sticky=tk.W)
        r += 1

        self._form_extra = ttk.LabelFrame(p, text="Type-specific", padding=6)
        self._form_extra.grid(row=r, column=0, columnspan=2, sticky=tk.EW, pady=8)
        r += 1
        # dynamic rows go inside _form_extra — rebuilt in _refresh_extras
        self._form_extra_r = 0

        ttk.Separator(p, orient=tk.HORIZONTAL).grid(
            row=r, column=0, columnspan=2, sticky=tk.EW, pady=6
        )
        r += 1
        ttk.Label(p, text="Areas (generic / engine extras)", font=("Segoe UI", 9, "bold")).grid(
            row=r, column=0, columnspan=2, sticky=tk.W
        )
        r += 1
        ab = ttk.Frame(p)
        ab.grid(row=r, column=0, columnspan=2, sticky=tk.W)
        ttk.Button(ab, text="+ Add area", command=self._add_area).pack(side=tk.LEFT, padx=2)
        ttk.Label(ab, text="(editing: focus out to refresh preview)").pack(side=tk.LEFT, padx=8)
        r += 1
        self._areas_frame = ttk.Frame(p)
        self._areas_frame.grid(row=r, column=0, columnspan=2, sticky=tk.EW, pady=4)
        p.grid_columnconfigure(1, weight=1)
        self._row_areas = r

    def _on_preview_area_configure(self, event: tk.Event) -> None:
        if event.widget is not self._img_area:
            return
        if self._preview_pil is None:
            return
        if self._preview_refit_after:
            self.after_cancel(self._preview_refit_after)
        self._preview_refit_after = self.after(80, self._refit_preview_from_cache)

    def _refit_preview_from_cache(self) -> None:
        self._preview_refit_after = None
        if self._preview_pil is not None:
            self._fit_preview_to_area(self._preview_pil)

    def _fit_preview_to_area(self, im: Image.Image) -> None:
        self.update_idletasks()
        aw = self._img_area.winfo_width()
        ah = self._img_area.winfo_height()
        pad = 10
        aw = max(1, aw - 2 * pad)
        ah = max(1, ah - 2 * pad)
        if aw < 32 or ah < 32:
            aw, ah = 900, 400
        iw, ih = im.size
        s = min(aw / iw, ah / ih)
        nw, nh = max(1, int(iw * s)), max(1, int(ih * s))
        out = im.resize((nw, nh), Image.Resampling.LANCZOS) if (nw, nh) != (iw, ih) else im
        self._photo = ImageTk.PhotoImage(out)
        self._img_label.configure(image=self._photo, text="")

    def _set_preview_error(self, message: str) -> None:
        self._preview_pil = None
        if self._photo is not None:
            self._photo = None
        self._img_label.configure(text=message, image="")
        self._img_label.place(relx=0.5, rely=0.5, anchor=tk.CENTER)

    def _on_json_panel_toggle(self) -> None:
        if not hasattr(self, "_json_frame") or not hasattr(self, "_top_h_pane"):
            return
        top, jf = self._top_h_pane, self._json_frame
        if self._json_panel_var.get():
            if str(jf) not in top.panes():
                top.add(jf, weight=1)
            self._sync_json_panel()
        else:
            if str(jf) in top.panes():
                self._on_json_focus_out()
            try:
                top.forget(jf)
            except tk.TclError:
                pass

    def _bind_done(self, w: tk.Widget) -> None:
        w.bind("<FocusOut>", self._on_done)
        w.bind("<Return>", self._on_done)

    def _set_form_mode(self, slot: bool) -> None:
        if not hasattr(self, "_form_system"):
            return
        if slot:
            self._form_slot.grid(row=0, column=0, sticky=tk.EW)
            self._form_system.grid(row=1, column=0, sticky=tk.NSEW)
            self._form.grid_rowconfigure(1, weight=1)
        else:
            self._form_slot.grid_remove()
            self._form_system.grid(row=0, column=0, sticky=tk.NSEW)
            self._form.grid_rowconfigure(0, weight=1)
            self._form.grid_rowconfigure(1, weight=0)

    def _rebuild_listbox(self, entries: list[EntryRow]) -> None:
        self._listbox.delete(0, tk.END)
        for idx, (_k, lab, _, _, _, _) in enumerate(entries):
            self._listbox.insert(tk.END, lab)
            if _k == "header":
                try:
                    self._listbox.itemconfigure(
                        idx,
                        font=("Segoe UI", 10, "bold"),
                        foreground="#222",
                    )
                except tk.TclError:
                    pass

    @staticmethod
    def _nearest_selectable_index(entries: list[EntryRow], i: int) -> int | None:
        if not entries:
            return None
        if 0 <= i < len(entries) and entries[i][0] != "header":
            return i
        for d in range(1, len(entries) + 1):
            for j in (i + d, i - d):
                if 0 <= j < len(entries) and entries[j][0] != "header":
                    return j
        return None

    @staticmethod
    def _first_selectable_index(entries: list[EntryRow]) -> int | None:
        for i, row in enumerate(entries):
            if row[0] != "header":
                return i
        return None

    def _refresh_list_preserving_selection(self) -> None:
        if self._data is None:
            return
        mark = self._active
        key_id = id(mark) if mark is not None else None
        self._entries = collect_all_entries(self._data)
        self._list_silent = True
        try:
            self._rebuild_listbox(self._entries)
            if key_id is None or not self._entries:
                return
            for i, (_k, _l, ref, _, _, _) in enumerate(self._entries):
                if ref is not None and id(ref) == key_id:
                    self._listbox.selection_clear(0, tk.END)
                    self._listbox.selection_set(i)
                    self._listbox.see(i)
                    self._list_index = i
                    return
        finally:
            self._list_silent = False

    def _slot_option_labels(self, slot: dict) -> list[str]:
        opts = slot.get("options") or []
        if not isinstance(opts, list):
            return []
        out: list[str] = []
        for i, o in enumerate(opts):
            if isinstance(o, dict):
                nm = (o.get("name") or "").strip() or "option"
                out.append(f"{i} — {nm}")
            else:
                out.append(f"{i} — ?")
        return out

    @staticmethod
    def _parse_slot_combo_label(s: str) -> int | None:
        s = (s or "").strip()
        if not s or s == "(none)":
            return None
        parts = s.split("—", 1)
        try:
            return int(parts[0].strip())
        except ValueError:
            return None

    def _refresh_slot_lib_combobox(self) -> None:
        cb = self._form_vars.get("slot_lib_add_cb")
        if not cb or self._data is None:
            return
        lib = build_merged_library(self._data)
        cb["values"] = tuple(sorted(lib.keys()))

    def _sync_slot_comboboxes_from_slot(self, slot: dict) -> None:
        labels = self._slot_option_labels(slot)
        edit_cb = self._form_vars.get("slot_edit_cb")
        ev = self._form_vars.get("slot_edit_var")
        if not edit_cb or not ev:
            return
        edit_cb["values"] = labels
        opts = slot.get("options") or []
        n = len(opts) if isinstance(opts, list) else 0
        if n == 0:
            ev.set("")
            return
        cur_edit = self._parse_slot_combo_label(ev.get())
        if cur_edit is None or cur_edit < 0 or cur_edit >= n:
            cur_edit = 0
        ev.set(labels[cur_edit])

    def _on_slot_edit_combo(self, event=None) -> None:
        if self._bulk_load or self._entry_kind != "slot":
            return
        prev = self._slot_last_edit_i
        slot = self._active
        le = self._form_vars.get("slot_label_e")
        if le is not None and slot:
            slot["label"] = le.get()
        if (
            prev is not None
            and slot
            and isinstance(slot.get("options"), list)
            and 0 <= prev < len(slot["options"])
        ):
            self._apply_system_fields_to(slot["options"][prev])
        new_i = self._parse_slot_combo_label(
            (self._form_vars.get("slot_edit_var") or tk.StringVar()).get()
        )
        self._slot_last_edit_i = new_i
        if (
            new_i is not None
            and slot
            and isinstance(slot.get("options"), list)
            and 0 <= new_i < len(slot["options"])
        ):
            self._load_system_fields_into_form(slot["options"][new_i])
        else:
            self._clear_system_fields_for_empty_target()
        self._sync_json_panel()
        self._schedule_render()

    def _slot_add_blank(self) -> None:
        if not self._active or self._entry_kind != "slot":
            return
        self._apply_from_form()
        slot = self._active
        slot.setdefault("options", []).append(_default_new_system())
        self._sync_slot_comboboxes_from_slot(slot)
        labels = self._slot_option_labels(slot)
        if labels:
            self._form_vars["slot_edit_var"].set(labels[-1])
        self._refresh_list_preserving_selection()
        self._load_into_form()
        self._schedule_render()

    def _slot_remove_option(self) -> None:
        if not self._active or self._entry_kind != "slot":
            return
        self._apply_from_form()
        slot = self._active
        opts = slot.get("options") or []
        if not isinstance(opts, list) or not opts:
            return
        i = self._parse_slot_combo_label(self._form_vars["slot_edit_var"].get())
        if i is None or i < 0 or i >= len(opts):
            i = len(opts) - 1
        opts.pop(i)
        _strip_slot_installation(slot)
        self._refresh_list_preserving_selection()
        self._sync_slot_comboboxes_from_slot(slot)
        self._slot_last_edit_i = None
        self._load_into_form()
        self._schedule_render()

    def _on_slot_add_from_library(self, event=None) -> None:
        cb = self._form_vars.get("slot_lib_add_cb")
        if not self._active or self._entry_kind != "slot" or not cb:
            return
        lid = (cb.get() or "").strip()
        if not lid:
            return
        lib = build_merged_library(self._data or {})
        if lid not in lib:
            return
        self._apply_from_form()
        slot = self._active
        slot.setdefault("options", []).append(copy.deepcopy(lib[lid]))
        cb.set("")
        self._sync_slot_comboboxes_from_slot(slot)
        labels = self._slot_option_labels(slot)
        if labels:
            self._form_vars["slot_edit_var"].set(labels[-1])
        self._refresh_list_preserving_selection()
        self._load_into_form()
        self._schedule_render()

    def _form_system_target(self) -> dict | None:
        if self._entry_kind == "system":
            return self._active
        if self._entry_kind == "slot" and self._active:
            opts = self._active.get("options") or []
            if not isinstance(opts, list) or not opts:
                return None
            i = self._parse_slot_combo_label(
                (self._form_vars.get("slot_edit_var") or tk.StringVar()).get()
            )
            if i is None or i < 0 or i >= len(opts):
                i = 0
            return opts[i]
        return None

    def _on_kind_change(self, event=None) -> None:
        if not self._active or self._bulk_load:
            return
        tgt = self._form_system_target()
        if not tgt:
            return
        tgt["kind"] = self._form_vars["kind"].get()
        self._refresh_extras(tgt["kind"])
        self._load_into_form()

    def _on_done(self, event=None) -> None:
        self._apply_from_form()
        self._schedule_render()
        return "break" if event and event.keysym == "Return" and isinstance(event.widget, tk.Text) else None

    def _schedule_render(self, event=None) -> None:
        if self._render_after:
            self.after_cancel(self._render_after)
        self._render_after = self.after(50, self._do_render)

    def _form_extra_r_reset(self) -> int:
        for c in self._form_extra.winfo_children():
            c.destroy()
        return 0

    def _refresh_extras(self, kind: str) -> None:
        self._form_extra_r = self._form_extra_r_reset()
        r = 0
        e = self._form_extra
        if kind == "mess":
            ttk.Label(e, text="med_bay").grid(row=r, column=0, sticky=tk.W)
            sp = ttk.Spinbox(e, from_=0, to=12, width=6)
            sp.grid(row=r, column=1, sticky=tk.W)
            self._bind_done(sp)
            if "med_bay_sp" in self._form_vars:
                del self._form_vars["med_bay_sp"]
            self._form_vars["med_bay_sp"] = sp
            r += 1
        elif kind == "reactor":
            ttk.Label(e, text="circles").grid(row=r, column=0, sticky=tk.W)
            sp = ttk.Spinbox(e, from_=0, to=24, width=6)
            sp.grid(row=r, column=1, sticky=tk.W)
            self._bind_done(sp)
            self._form_vars["circles_sp"] = sp
            r += 1
        elif kind == "engine":
            ttk.Label(
                e, text="speed_slots (JSON array of {speed, rotation})"
            ).grid(row=r, column=0, columnspan=2, sticky=tk.W)
            r += 1
            tx = tk.Text(e, width=64, height=10, font=("Consolas", 10), wrap=tk.WORD)
            tx.grid(row=r, column=0, columnspan=2, sticky=tk.EW, pady=4)
            self._bind_done(tx)
            self._form_vars["speed_slots_tx"] = tx
            e.grid_columnconfigure(0, weight=1)
            r += 1
        elif kind == "shields":
            ttk.Label(e, text="front (comma-separated positive ints)").grid(
                row=r, column=0, sticky=tk.W
            )
            fe = ttk.Entry(e, width=48)
            fe.grid(row=r, column=1, sticky=tk.EW, pady=2)
            self._bind_done(fe)
            self._form_vars["front_e"] = fe
            r += 1
            ttk.Label(e, text="rear (comma-separated)").grid(row=r, column=0, sticky=tk.W)
            re_ = ttk.Entry(e, width=48)
            re_.grid(row=r, column=1, sticky=tk.EW, pady=2)
            self._bind_done(re_)
            self._form_vars["rear_e"] = re_
            r += 1
        ttk.Label(
            e, text="(Shields: weapon/main icons apply if you set flags.)", font=("Segoe UI", 8)
        ).grid(row=r, column=0, columnspan=2, sticky=tk.W, pady=4)
        e.grid_columnconfigure(1, weight=1)

    def _add_area(self) -> None:
        tgt = self._form_system_target()
        if not tgt:
            return
        tgt.setdefault("areas", [])
        tgt["areas"].append(
            {
                "name": "",
                "description": "",
                "cost": {"energy": 0, "crew": 0},
            }
        )
        self._load_into_form()
        self._schedule_render()

    def _rebuild_area_widgets(self) -> None:
        for c in self._areas_frame.winfo_children():
            c.destroy()
        self._form_vars["area_w"] = []
        tgt = self._form_system_target()
        if not tgt:
            return
        areas = tgt.get("areas") or []
        for i, a in enumerate(areas):
            fr = ttk.LabelFrame(self._areas_frame, text=f"Area {i}", padding=4)
            fr.pack(fill=tk.X, pady=4)
            ttk.Label(fr, text="name").grid(row=0, column=0, sticky=tk.W)
            ne = ttk.Entry(fr, width=32)
            ne.grid(row=0, column=1, padx=4)
            ttk.Label(fr, text="description").grid(row=1, column=0, sticky=tk.NW)
            de = tk.Text(fr, width=50, height=4, font=("Segoe UI", 9), wrap=tk.WORD)
            de.grid(row=1, column=1, padx=4, pady=2)
            ttk.Label(fr, text="energy / crew in cost").grid(row=2, column=0, sticky=tk.W)
            cfr = ttk.Frame(fr)
            cfr.grid(row=2, column=1, sticky=tk.W)
            ee = ttk.Spinbox(cfr, from_=0, to=20, width=4)
            ce = ttk.Spinbox(cfr, from_=0, to=20, width=4)
            ee.pack(side=tk.LEFT, padx=2)
            ce.pack(side=tk.LEFT, padx=2)
            ttk.Label(fr, text="shoot (JSON or empty) — damage, range, arc-start, arc-end").grid(
                row=3, column=0, columnspan=2, sticky=tk.W
            )
            st = tk.Text(fr, width=60, height=4, font=("Consolas", 9), wrap=tk.NONE)
            st.grid(row=4, column=0, columnspan=2, pady=2, sticky=tk.W)
            br = ttk.Frame(fr)
            br.grid(row=5, column=0, columnspan=2, sticky=tk.W)
            ttk.Button(
                br,
                text="Remove area",
                command=lambda idx=i: self._remove_area(idx),
            ).pack(side=tk.LEFT, padx=2)

            self._bind_done(ne)
            self._bind_done(de)
            self._bind_done(ee)
            self._bind_done(ce)
            self._bind_done(st)
            self._form_vars["area_w"].append(
                {"i": i, "aname": ne, "desc": de, "en": ee, "cr": ce, "shoot": st}
            )

    def _remove_area(self, idx: int) -> None:
        tgt = self._form_system_target()
        if not tgt or "areas" not in tgt:
            return
        a = tgt["areas"]
        if 0 <= idx < len(a):
            del a[idx]
        self._load_into_form()
        self._schedule_render()

    def _load_into_form(self) -> None:
        s = self._active
        if not s:
            self._clear_form()
            self._sync_json_panel()
            return
        self._bulk_load = True
        try:
            self._load_into_form_impl(s)
        finally:
            self._bulk_load = False

    def _clear_system_fields_for_empty_target(self) -> None:
        self._library_id_lf.grid_remove()
        self._library_id_at_load = None
        self._form_vars["kind"].set("generic")
        self._form_vars["name_e"].delete(0, tk.END)
        self._form_vars["rules_e"].delete(0, tk.END)
        for fl in ("weapon", "main", "hull", "electronics", "life_support"):
            self._form_vars[fl].set(False)
        self._refresh_extras("generic")
        self._form_vars["area_w"] = []
        for c in self._areas_frame.winfo_children():
            c.destroy()

    def _load_system_fields_into_form(self, s: dict) -> None:
        eid = self._form_vars.get("library_id_e")
        if self._active_rename_scope and self._active_library_key is not None and eid:
            self._library_id_lf.grid(
                row=0, column=0, columnspan=2, sticky=tk.EW, pady=(0, 8)
            )
            eid.delete(0, tk.END)
            eid.insert(0, self._active_library_key)
            self._library_id_at_load = self._active_library_key
        else:
            self._library_id_lf.grid_remove()
            self._library_id_at_load = None
        k = s.get("kind", "generic")
        if not k and s.get("name", "").lower() in ("mess", "reactor", "engine"):
            m = s.get("name", "").lower()
            k = {"mess": "mess", "reactor": "reactor", "engine": "engine"}.get(m, "generic")
        if k not in ("generic", "mess", "reactor", "engine", "shields"):
            k = "generic"
        self._form_vars["kind"].set(k)
        self._form_vars["name_e"].delete(0, tk.END)
        self._form_vars["name_e"].insert(0, s.get("name", ""))
        self._form_vars["rules_e"].delete(0, tk.END)
        self._form_vars["rules_e"].insert(0, s.get("rules", "") or "")
        for fl in ("weapon", "main", "hull", "electronics", "life_support"):
            self._form_vars[fl].set(bool(s.get(fl, False)))
        self._refresh_extras(k)
        if k == "mess" and "med_bay_sp" in self._form_vars:
            self._form_vars["med_bay_sp"].delete(0, tk.END)
            self._form_vars["med_bay_sp"].insert(0, str(s.get("med_bay", 0)))
        if k == "reactor" and "circles_sp" in self._form_vars:
            self._form_vars["circles_sp"].delete(0, tk.END)
            self._form_vars["circles_sp"].insert(0, str(s.get("circles", 0)))
        if k == "engine" and "speed_slots_tx" in self._form_vars:
            self._form_vars["speed_slots_tx"].delete("1.0", tk.END)
            self._form_vars["speed_slots_tx"].insert(
                "1.0", json.dumps(s.get("speed_slots", []), indent=2)
            )
        if k == "shields":
            if "front_e" in self._form_vars:
                self._form_vars["front_e"].delete(0, tk.END)
                self._form_vars["front_e"].insert(
                    0, ", ".join(str(x) for x in s.get("front", []))
                )
            if "rear_e" in self._form_vars:
                self._form_vars["rear_e"].delete(0, tk.END)
                self._form_vars["rear_e"].insert(0, ", ".join(str(x) for x in s.get("rear", [])))
        self._rebuild_area_widgets()
        for w in self._form_vars.get("area_w", []) or []:
            a = s.get("areas", [])[w["i"]]
            w["aname"].insert(0, a.get("name", "") or "")
            w["desc"].insert("1.0", a.get("description", "") or "")
            w["en"].insert(0, str(a.get("cost", {}).get("energy", 0)))
            w["cr"].insert(0, str(a.get("cost", {}).get("crew", 0)))
            sh = a.get("shoot")
            w["shoot"].insert("1.0", json.dumps(sh) if sh else "")

    def _load_into_form_impl(self, s) -> None:
        if self._entry_kind == "slot":
            normalize_slot_to_v01(s, build_merged_library(self._data or {}))
            self._set_form_mode(True)
            sle = self._form_vars.get("slot_label_e")
            if sle is not None:
                sle.delete(0, tk.END)
                lab = s.get("label", "")
                sle.insert(0, lab if isinstance(lab, str) else "")
            self._refresh_slot_lib_combobox()
            self._sync_slot_comboboxes_from_slot(s)
            self._slot_last_edit_i = self._parse_slot_combo_label(
                self._form_vars["slot_edit_var"].get()
            )
            tgt = self._form_system_target()
            if tgt:
                self._load_system_fields_into_form(tgt)
            else:
                self._clear_system_fields_for_empty_target()
            self._sync_json_panel()
            return
        self._set_form_mode(False)
        self._load_system_fields_into_form(s)
        self._sync_json_panel()

    def _sync_json_panel(self) -> None:
        if not hasattr(self, "_json_text") or self._json_mute:
            return
        self._json_mute = True
        self._json_text.delete("1.0", tk.END)
        if self._active:
            self._json_text.insert(
                "1.0",
                json.dumps(self._active, indent=2, ensure_ascii=False),
            )
        else:
            self._json_text.insert(
                "1.0",
                "# No entry selected. Open a file, use New file, or add New system.\n",
            )
        self._json_mute = False

    def _on_json_focus_out(self, event=None) -> None:
        if self._json_mute or not self._active:
            return
        raw = self._json_text.get("1.0", tk.END).strip()
        if not raw or raw.startswith("#"):
            return
        try:
            o = json.loads(raw)
        except json.JSONDecodeError as err:
            messagebox.showerror("Invalid JSON", f"{err}\n\nFix the JSON, then focus out again.")
            return
        if not isinstance(o, dict):
            messagebox.showerror("Invalid JSON", "Top level must be a JSON object (dict).")
            return
        if self._entry_kind == "slot" and o.get("kind") != "slot":
            messagebox.showerror("Invalid JSON", 'This list row is a slot: JSON must have "kind": "slot".')
            return
        if self._entry_kind == "system" and o.get("kind") == "slot":
            messagebox.showerror("Invalid JSON", "This list row is a system: JSON must not be a slot object.")
            return
        self._json_mute = True
        self._active.clear()
        self._active.update(o)
        if self._entry_kind == "slot" and isinstance(self._data, dict):
            normalize_slot_to_v01(self._active, build_merged_library(self._data))
            _strip_slot_installation(self._active)
        self._json_mute = False
        self._load_into_form()
        self._refresh_list_preserving_selection()
        self._schedule_render()

    def _clear_form(self) -> None:
        if not hasattr(self, "_form_vars"):
            return
        self._set_form_mode(False)
        if hasattr(self, "_library_id_lf"):
            self._library_id_lf.grid_remove()
        if "library_id_e" in self._form_vars:
            self._form_vars["library_id_e"].delete(0, tk.END)
        self._active_library_key = None
        self._active_rename_scope = None
        self._library_id_at_load = None
        if "slot_label_e" in self._form_vars:
            self._form_vars["slot_label_e"].delete(0, tk.END)
        if "slot_edit_var" in self._form_vars:
            self._form_vars["slot_edit_var"].set("")
        if "slot_edit_cb" in self._form_vars:
            self._form_vars["slot_edit_cb"].configure(values=())
        if "slot_lib_add_cb" in self._form_vars:
            self._form_vars["slot_lib_add_cb"].set("")
        self._slot_last_edit_i = None
        if "name_e" in self._form_vars:
            self._form_vars["name_e"].delete(0, tk.END)
            self._form_vars["rules_e"].delete(0, tk.END)
        if "kind" in self._form_vars:
            self._form_vars["kind"].set("generic")
        for fl in ("weapon", "main", "hull", "electronics", "life_support"):
            if fl in self._form_vars:
                self._form_vars[fl].set(False)
        self._form_vars["area_w"] = []
        for c in self._areas_frame.winfo_children():
            c.destroy()
        self._refresh_extras("generic")

    def _apply_system_fields_to(self, s: dict) -> None:
        k = self._form_vars["kind"].get()
        s["kind"] = k
        s["name"] = self._form_vars["name_e"].get()
        s["rules"] = self._form_vars["rules_e"].get()
        for fl in ("weapon", "main", "hull", "electronics", "life_support"):
            s[fl] = self._form_vars[fl].get()
        s.setdefault("areas", [])
        if k == "mess" and "med_bay_sp" in self._form_vars:
            try:
                s["med_bay"] = int(self._form_vars["med_bay_sp"].get())
            except (TypeError, ValueError):
                s["med_bay"] = 0
        elif k == "reactor" and "circles_sp" in self._form_vars:
            try:
                s["circles"] = int(self._form_vars["circles_sp"].get())
            except (TypeError, ValueError):
                s["circles"] = 0
        elif k == "engine" and "speed_slots_tx" in self._form_vars:
            raw = self._form_vars["speed_slots_tx"].get("1.0", tk.END).strip()
            try:
                s["speed_slots"] = json.loads(raw) if raw else []
            except json.JSONDecodeError:
                s["speed_slots"] = s.get("speed_slots", [])
        elif k == "shields":
            s["front"] = _bparse_int_list(self._form_vars["front_e"].get()) if "front_e" in self._form_vars else []
            s["rear"] = _bparse_int_list(self._form_vars["rear_e"].get()) if "rear_e" in self._form_vars else []
        for w in self._form_vars.get("area_w", []) or []:
            i = w["i"]
            if i >= len(s["areas"]):
                continue
            a = s["areas"][i]
            a["name"] = w["aname"].get()
            a["description"] = w["desc"].get("1.0", tk.END).rstrip()
            co = a.setdefault("cost", {})
            try:
                co["energy"] = int(w["en"].get())
            except (TypeError, ValueError):
                co["energy"] = 0
            try:
                co["crew"] = int(w["cr"].get())
            except (TypeError, ValueError):
                co["crew"] = 0
            j = w["shoot"].get("1.0", tk.END).strip()
            if j:
                try:
                    a["shoot"] = json.loads(j)
                except json.JSONDecodeError:
                    pass
            else:
                a.pop("shoot", None)

    def _apply_from_form(self) -> None:
        s = self._active
        if not s:
            return
        if self._entry_kind == "slot":
            le = self._form_vars.get("slot_label_e")
            if le is not None:
                s["label"] = le.get()
            tgt = self._form_system_target()
            if tgt:
                self._apply_system_fields_to(tgt)
            _strip_slot_installation(s)
            self._refresh_list_preserving_selection()
            self._sync_json_panel()
            return
        self._apply_system_fields_to(s)
        self._sync_json_panel()

    def _do_render(self) -> None:
        self._render_after = None
        if not self._active:
            return
        self._apply_from_form()
        try:
            tw = int(round(TILE_WIDTH_CM * DPI / 2.54))
            th = int(round(TILE_HEIGHT_CM * DPI / 2.54))
            if self._entry_kind == "slot":
                slot = self._active
                opts = slot.get("options") or []
                ei = self._parse_slot_combo_label(
                    (self._form_vars.get("slot_edit_var") or tk.StringVar()).get()
                )
                if (
                    not isinstance(opts, list)
                    or not opts
                    or ei is None
                    or ei < 0
                    or ei >= len(opts)
                ):
                    self._set_preview_error(
                        "(No option) Add an option or pick one in “Option to edit”."
                    )
                    return
                sys_def = copy.deepcopy(opts[ei])
                im = create_system(sys_def, tw, th, DPI)
            else:
                im = create_system(copy.deepcopy(self._active), tw, th, DPI)
        except Exception as ex:
            self._set_preview_error(f"Render error: {ex}")
            return
        self._preview_pil = im
        self._img_label.place(relx=0.5, rely=0.5, anchor=tk.CENTER)
        self._fit_preview_to_area(im)

    def _remove_selected(self, event=None) -> str | None:
        """Remove the current list row from the document (library, dedicated, or section)."""
        if self._data is None:
            return "break" if event else None
        items = self._listbox.curselection()
        if not items:
            return "break" if event else None
        i = int(items[0])
        if i >= len(self._entries):
            return "break" if event else None
        _kind, label, _ref, remover, removed_library_id, _ = self._entries[i]
        if _kind == "header":
            return "break" if event else None
        if remover is None:
            messagebox.showinfo(
                "Cannot remove",
                "This row is reactor, mess, or shields on the ship as a slot. "
                "That slot cannot be removed from the document here; edit it in the form or in JSON.",
            )
            return "break" if event else None
        if not messagebox.askyesno("Remove entry", f"Remove this entry?\n\n{label}"):
            return "break" if event else None
        if self._active is not None:
            self._apply_from_form()
        try:
            remover(self._data)
        except Exception as ex:
            messagebox.showerror("Remove failed", str(ex))
            return "break" if event else None
        if removed_library_id:
            _clear_slots_pointing_to(self._data, removed_library_id)
        self._entries = collect_all_entries(self._data)
        self._list_silent = True
        try:
            self._rebuild_listbox(self._entries)
        finally:
            self._list_silent = False
        if not self._entries:
            self._active = None
            self._entry_kind = "system"
            self._clear_form()
            self._sync_json_panel()
            self._set_preview_error("(No selection)")
            return "break" if event else None
        new_i = min(i, len(self._entries) - 1)
        pick = self._nearest_selectable_index(self._entries, new_i)
        if pick is None:
            self._active = None
            self._entry_kind = "system"
            self._clear_form()
            self._sync_json_panel()
            self._set_preview_error("(No selection)")
            return "break" if event else None
        new_i = pick
        self._listbox.selection_set(new_i)
        self._listbox.see(new_i)
        self._list_index = new_i
        (
            self._entry_kind,
            _lbl,
            self._active,
            _,
            self._active_library_key,
            self._active_rename_scope,
        ) = self._entries[new_i]
        self._load_into_form()
        self._schedule_render()
        return "break" if event else None

    def _try_apply_library_id_rename(self, old: str, new: str, *, show_errors: bool) -> bool:
        if self._data is None or not self._active_rename_scope:
            return False
        if new == old:
            return True
        if not _valid_library_id(new):
            if show_errors:
                messagebox.showerror(
                    "Library id",
                    "Use only letters, digits, and underscores; no spaces.",
                )
            return False
        if new in SHIP_ROOT_KEYS:
            if show_errors:
                messagebox.showerror(
                    "Library id",
                    f"The id {new!r} is reserved for ship metadata.",
                )
            return False
        scope = self._active_rename_scope
        if scope == "dedicated":
            ds = self._data.get("dedicatedSystems") or {}
            if new in ds:
                if show_errors:
                    messagebox.showerror(
                        "Library id",
                        f"dedicatedSystems already has a key {new!r}.",
                    )
                return False
        elif scope == "library":
            if new in self._data and new != old:
                if show_errors:
                    messagebox.showerror(
                        "Library id",
                        f"Top-level key {new!r} already exists.",
                    )
                return False
        try:
            _rename_library_key_in_document(self._data, old, new, scope)
        except (KeyError, ValueError) as ex:
            if show_errors:
                messagebox.showerror("Rename failed", str(ex))
            return False
        _rewrite_id_references(self._data, old, new)
        return True

    def _flush_library_id_rename_if_dirty(self) -> None:
        if self._data is None or self._bulk_load:
            return
        if (
            self._entry_kind != "system"
            or not self._active_rename_scope
            or not self._library_id_at_load
        ):
            return
        e = self._form_vars.get("library_id_e")
        new = (e.get().strip() if e else "")
        old = self._library_id_at_load
        if new == old:
            return
        if not self._try_apply_library_id_rename(old, new, show_errors=True):
            if e:
                e.delete(0, tk.END)
                e.insert(0, old)
            return
        self._library_id_at_load = new
        self._active_library_key = new

    def _on_library_id_field_done(self, event=None) -> str | None:
        if self._bulk_load or self._data is None:
            return None
        if self._entry_kind != "system" or not self._active_rename_scope:
            return None
        old = self._library_id_at_load
        if not old:
            return None
        e = self._form_vars.get("library_id_e")
        new = (e.get().strip() if e else "")
        if new == old:
            return None
        if not self._try_apply_library_id_rename(old, new, show_errors=True):
            if e:
                e.delete(0, tk.END)
                e.insert(0, old)
            return "break" if event and getattr(event, "keysym", "") == "Return" else None
        self._library_id_at_load = new
        self._active_library_key = new
        self._refresh_list_preserving_selection()
        self._refresh_slot_lib_combobox()
        self._sync_json_panel()
        self._schedule_render()
        return "break" if event and getattr(event, "keysym", "") == "Return" else None

    def _on_list_select(self, event=None) -> None:
        if self._list_silent:
            return
        items = self._listbox.curselection()
        if not items or not self._entries:
            return
        target_i = int(items[0])
        if target_i >= len(self._entries):
            return
        if self._entries[target_i][0] == "header":
            self._list_silent = True
            try:
                self._listbox.selection_clear(0, tk.END)
                j = None
                if 0 <= self._list_index < len(self._entries):
                    if self._entries[self._list_index][0] != "header":
                        j = self._list_index
                if j is None:
                    j = self._nearest_selectable_index(self._entries, target_i)
                if j is not None:
                    self._listbox.selection_set(j)
                    self._listbox.see(j)
            finally:
                self._list_silent = False
            return
        target_ref = self._entries[target_i][2]

        self._flush_library_id_rename_if_dirty()

        if self._active is not None:
            self._apply_from_form()

        self._entries = collect_all_entries(self._data)
        new_index: int | None = None
        for j, row in enumerate(self._entries):
            if row[2] is target_ref:
                new_index = j
                break
        if new_index is None:
            new_index = (
                min(target_i, len(self._entries) - 1) if self._entries else 0
            )
        if self._entries and 0 <= new_index < len(self._entries):
            if self._entries[new_index][0] == "header":
                adj = self._nearest_selectable_index(self._entries, new_index)
                if adj is not None:
                    new_index = adj

        self._list_silent = True
        try:
            self._rebuild_listbox(self._entries)
            if self._entries:
                self._listbox.selection_set(new_index)
                self._listbox.see(new_index)
        finally:
            self._list_silent = False

        if not self._entries:
            self._active = None
            self._entry_kind = "system"
            self._active_library_key = None
            self._active_rename_scope = None
            self._library_id_at_load = None
            self._clear_form()
            self._sync_json_panel()
            return

        if self._entries[new_index][0] == "header":
            self._active = None
            self._entry_kind = "system"
            self._clear_form()
            self._sync_json_panel()
            return

        self._list_index = new_index
        (
            self._entry_kind,
            _lbl,
            self._active,
            _,
            self._active_library_key,
            self._active_rename_scope,
        ) = self._entries[new_index]
        self._load_into_form()
        self._schedule_render()

    def _populate_list(self) -> None:
        self._rebuild_listbox(self._entries)
        if not self._entries:
            self._active = None
            self._entry_kind = "system"
            self._active_library_key = None
            self._active_rename_scope = None
            self._library_id_at_load = None
            self._clear_form()
            self._sync_json_panel()
            return
        first = self._first_selectable_index(self._entries)
        if first is None:
            self._active = None
            self._entry_kind = "system"
            self._clear_form()
            self._sync_json_panel()
            return
        self._listbox.selection_set(first)
        (
            self._entry_kind,
            _lbl,
            self._active,
            _,
            self._active_library_key,
            self._active_rename_scope,
        ) = self._entries[first]
        self._list_index = first
        self._load_into_form()
        self._schedule_render()

    def _new_file(self) -> None:
        if self._data and self._active is not None:
            self._flush_library_id_rename_if_dirty()
            self._apply_from_form()
        self._data = {}
        self._file_path = None
        self._entries = []
        self._active = None
        self._entry_kind = "system"
        if hasattr(self, "_listbox"):
            self._listbox.delete(0, tk.END)
        self._clear_form()
        self._sync_json_panel()
        self.title("Systems editor — untitled")

    def _new_system(self) -> None:
        if self._data is not None and self._active is not None:
            self._flush_library_id_rename_if_dirty()
            self._apply_from_form()
        d = self._data
        if d is None:
            d = {}
            self._data = d
        blank = _default_new_system()
        if is_pure_top_level_library(d):
            k = _unique_key(d, "new_system")
            d[k] = blank
        else:
            ds = d.setdefault("dedicatedSystems", {})
            k = _unique_key(ds, "new_system")
            ds[k] = blank
        self._entries = collect_all_entries(self._data)
        self._rebuild_listbox(self._entries)
        for i, (_k, _l, ref, _rm, _lk, _rs) in enumerate(self._entries):
            if ref is blank:
                self._listbox.selection_clear(0, tk.END)
                self._listbox.selection_set(i)
                self._listbox.see(i)
                self._list_index = i
                self._entry_kind = "system"
                self._active = blank
                self._active_library_key = _lk
                self._active_rename_scope = _rs
                self._load_into_form()
                self._schedule_render()
                self.title(
                    f"Systems editor — {os.path.basename(self._file_path or 'untitled')}"
                )
                return
        self._sync_json_panel()

    def _open(self) -> None:
        path = filedialog.askopenfilename(
            filetypes=[("JSON", "*.json"), ("All", "*.*")]
        )
        if not path:
            return
        try:
            with open(path, "r", encoding="utf-8") as f:
                self._data = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            messagebox.showerror("Open failed", str(e))
            return
        if isinstance(self._data, dict):
            normalize_ship_document_slots(self._data)
        self._file_path = path
        self._entries = collect_all_entries(self._data)
        self._populate_list()
        self.title(f"Systems editor — {os.path.basename(path)}")

    def _save(self) -> None:
        if self._active is not None:
            self._flush_library_id_rename_if_dirty()
            self._apply_from_form()
        if self._data is None:
            self._data = {}
        if not self._file_path:
            self._save_as()
            return
        try:
            if isinstance(self._data, dict):
                strip_all_slot_installations_in_document(self._data)
            with open(self._file_path, "w", encoding="utf-8") as f:
                json.dump(self._data, f, indent=2, ensure_ascii=False)
        except OSError as e:
            messagebox.showerror("Save failed", str(e))
        else:
            self.title(f"Systems editor — {os.path.basename(self._file_path)} (saved)")

    def _save_as(self) -> None:
        if self._active is not None:
            self._flush_library_id_rename_if_dirty()
            self._apply_from_form()
        if self._data is None:
            self._data = {}
        path = filedialog.asksaveasfilename(
            defaultextension=".json", filetypes=[("JSON", "*.json")]
        )
        if not path:
            return
        self._file_path = path
        self._save()

    def _on_quit(self) -> None:
        self.destroy()


def main() -> None:
    app = SystemsEditor()
    app.mainloop()


if __name__ == "__main__":
    main()
