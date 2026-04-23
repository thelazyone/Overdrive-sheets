"""
Interactive system tile editor: load a JSON (library, ship, or dedicatedSystems),
list systems and ship slots (reactor/mess/shields + section slots), edit in the form,
and render a full 300 DPI tile (same as print/export), then downscale for on-screen
preview. Slot rows show label, allowed ids, and selectedId; the preview resolves
selectedId through the merged library (top-level + dedicatedSystems) like the web app.
FocusOut / Return — not on every keypress. Raw JSON for the selected entry is
in a resizable lower pane in the form column.
"""
from __future__ import annotations

import copy
import json
import os
import tkinter as tk
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


def collect_all_entries(data: object) -> list[tuple[str, str, dict]]:
    """
    Return rows for the listbox: (entry_kind, list_label, dict_ref).
    entry_kind is 'system' or 'slot'. dict_ref is the live system or slot object.
    """
    out: list[tuple[str, str, dict]] = []
    seen_sys: set[int] = set()

    def add_system(list_label: str, s: object) -> None:
        if not isinstance(s, dict) or not _looks_like_system(s):
            return
        i = id(s)
        if i in seen_sys:
            return
        seen_sys.add(i)
        out.append(("system", list_label, s))

    def add_slot(list_label: str, slot: dict) -> None:
        if not isinstance(slot, dict) or slot.get("kind") != "slot":
            return
        out.append(("slot", list_label, slot))

    if not isinstance(data, dict):
        return out

    ds = data.get("dedicatedSystems")
    if isinstance(ds, dict):
        for k, s in sorted(ds.items(), key=lambda x: x[0]):
            add_system(f"dedicatedSystems / {k}", s)

    for k, v in sorted(data.items(), key=lambda x: x[0]):
        if k in SHIP_ROOT_KEYS:
            continue
        if isinstance(v, dict) and _looks_like_system(v):
            add_system(f"library / {k}", v)

    for key in ("reactor", "mess", "shields"):
        r = data.get(key)
        if not isinstance(r, dict):
            continue
        if r.get("kind") == "slot":
            lab = (r.get("label") or key).strip()
            al = r.get("allowed") or []
            al_s = ", ".join(str(x) for x in al)
            sel = r.get("selectedId")
            sel_s = "" if sel is None else repr(sel)
            add_slot(
                f'ship / {key} (slot) — "{lab}" | allowed: {al_s} | selected: {sel_s}',
                r,
            )
        elif r.get("kind") == "system" and "system" in r:
            add_system(f"ship / {key} (inline)", r["system"])

    sec = data.get("sections")
    if isinstance(sec, dict):
        for col in ("left", "core", "right"):
            for i, item in enumerate(sec.get(col) or []):
                if not isinstance(item, dict):
                    continue
                if item.get("kind") == "slot":
                    lab = (item.get("label") or "?").strip()
                    al = item.get("allowed") or []
                    al_s = ", ".join(str(x) for x in al)
                    sel = item.get("selectedId")
                    sel_s = "" if sel is None else repr(sel)
                    add_slot(
                        f'ship / sections / {col} [{i}] (slot) — "{lab}" | allowed: {al_s} | selected: {sel_s}',
                        item,
                    )
                elif item.get("kind") == "system" and "system" in item:
                    add_system(f"ship / sections / {col} [{i}] (inline)", item["system"])

    return out


def collect_system_entries(data: object) -> list[tuple[str, dict]]:
    """Systems only (for add-new flow that needs a system ref)."""
    return [(lbl, ref) for kind, lbl, ref in collect_all_entries(data) if kind == "system"]


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
        self._entries: list[tuple[str, str, dict]] = []
        self._entry_kind: str = "system"
        self._active: dict | None = None
        self._list_index = 0
        self._render_after: str | None = None
        self._photo: ImageTk.PhotoImage | None = None
        self._form_vars: dict = {}
        self._bulk_load = False
        self._json_mute = False
        self._list_silent = False

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

        main = ttk.PanedWindow(self, orient=tk.HORIZONTAL)
        main.pack(fill=tk.BOTH, expand=True, padx=4, pady=(0, 4))

        left = ttk.Frame(main, width=240)
        lf = ttk.LabelFrame(left, text="Systems & slots (ship)", padding=4)
        lf.pack(fill=tk.BOTH, expand=True)
        self._listbox = tk.Listbox(lf, width=34, font=("Segoe UI", 10), height=22)
        sb1 = ttk.Scrollbar(lf, orient=tk.VERTICAL, command=self._listbox.yview)
        self._listbox.configure(yscrollcommand=sb1.set)
        self._listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        sb1.pack(side=tk.RIGHT, fill=tk.Y)
        self._listbox.bind("<<ListboxSelect>>", self._on_list_select)
        ttk.Button(left, text="+ New system", command=self._new_system).pack(
            fill=tk.X, pady=(6, 0)
        )
        main.add(left, weight=0)

        mid = ttk.PanedWindow(main, orient=tk.VERTICAL)
        form_wrap = ttk.Frame(mid)
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
        mid.add(form_wrap, weight=3)

        json_frame = ttk.LabelFrame(
            mid,
            text="Selected entry — JSON (resize pane above; focus out to apply edits)",
            padding=4,
        )
        j_wrap = ttk.Frame(json_frame)
        j_wrap.pack(fill=tk.BOTH, expand=True)
        jy = ttk.Scrollbar(j_wrap, orient=tk.VERTICAL)
        jx = ttk.Scrollbar(j_wrap, orient=tk.HORIZONTAL)
        self._json_text = tk.Text(
            j_wrap,
            height=16,
            width=40,
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
        mid.add(json_frame, weight=2)
        main.add(mid, weight=2)

        right = ttk.Frame(main, width=400)
        self._img_label = ttk.Label(right, anchor=tk.NW)
        self._img_label.pack(fill=tk.BOTH, expand=True)
        ttk.Label(
            right,
            text="Preview: 300 DPI render, scaled to fit (WYSIWYG) — focus out / Enter to refresh",
            font=("Segoe UI", 9),
            foreground="#555",
        ).pack(side=tk.BOTTOM, anchor=tk.W)
        main.add(right, weight=1)

        self.minsize(1000, 700)
        self.geometry("1500x920")

    def _form_columns(self) -> None:
        self._form.grid_rowconfigure(0, weight=1)
        self._form.grid_columnconfigure(0, weight=1)

        self._form_system = ttk.Frame(self._form)
        self._form_system.grid(row=0, column=0, sticky=tk.NSEW)
        self._form_system.grid_columnconfigure(1, weight=1)

        self._form_slot = ttk.LabelFrame(
            self._form,
            text="Slot (label, allowed ids, selectedId — same as web)",
            padding=6,
        )
        self._form_slot.grid(row=0, column=0, sticky=tk.NSEW)
        self._form_slot.grid_columnconfigure(1, weight=1)
        self._form_slot.grid_rowconfigure(2, weight=1)
        self._form_slot.grid_remove()

        ttk.Label(self._form_slot, text="Label (row title in UI)").grid(
            row=0, column=0, sticky=tk.W, pady=2
        )
        self._form_vars["slot_label_e"] = ttk.Entry(self._form_slot, width=56)
        self._form_vars["slot_label_e"].grid(row=0, column=1, sticky=tk.EW, pady=2)
        self._bind_done(self._form_vars["slot_label_e"])
        ttk.Label(self._form_slot, text="allowed (one id per line)").grid(
            row=1, column=0, columnspan=2, sticky=tk.W, pady=(6, 0)
        )
        self._form_vars["slot_allowed_tx"] = tk.Text(
            self._form_slot, height=5, width=50, font=("Consolas", 10), wrap=tk.WORD
        )
        self._form_vars["slot_allowed_tx"].grid(
            row=2, column=0, columnspan=2, sticky=tk.NSEW, pady=4
        )
        self._bind_done(self._form_vars["slot_allowed_tx"])
        ttk.Label(self._form_slot, text="selectedId").grid(
            row=3, column=0, sticky=tk.W, pady=2
        )
        self._form_vars["slot_sel_var"] = tk.StringVar(value="")
        self._form_vars["slot_selected_cb"] = ttk.Combobox(
            self._form_slot,
            textvariable=self._form_vars["slot_sel_var"],
            width=52,
        )
        self._form_vars["slot_selected_cb"].grid(row=3, column=1, sticky=tk.W, pady=2)
        self._form_vars["slot_selected_cb"].bind(
            "<<ComboboxSelected>>",
            lambda e: (self._apply_slot_from_form(), self._schedule_render()),
        )
        ttk.Label(
            self._form_slot,
            text="Preview uses merged library (dedicatedSystems + top-level) for the id.",
            font=("Segoe UI", 8),
        ).grid(row=4, column=0, columnspan=2, sticky=tk.W, pady=4)

        p = self._form_system
        r = 0
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

    def _bind_done(self, w: tk.Widget) -> None:
        w.bind("<FocusOut>", self._on_done)
        w.bind("<Return>", self._on_done)

    def _set_form_mode(self, slot: bool) -> None:
        if not hasattr(self, "_form_system"):
            return
        if slot:
            self._form_system.grid_remove()
            self._form_slot.grid()
        else:
            self._form_slot.grid_remove()
            self._form_system.grid()

    def _refresh_list_preserving_selection(self) -> None:
        if self._data is None:
            return
        mark = self._active
        key_id = id(mark) if mark is not None else None
        self._entries = collect_all_entries(self._data)
        self._list_silent = True
        try:
            self._listbox.delete(0, tk.END)
            for _k, label, _ in self._entries:
                self._listbox.insert(tk.END, label)
            if key_id is None or not self._entries:
                return
            for i, (_k, _l, ref) in enumerate(self._entries):
                if id(ref) == key_id:
                    self._listbox.selection_clear(0, tk.END)
                    self._listbox.selection_set(i)
                    self._listbox.see(i)
                    self._list_index = i
                    return
        finally:
            self._list_silent = False

    def _update_slot_combobox(self) -> None:
        cb = self._form_vars.get("slot_selected_cb")
        var = self._form_vars.get("slot_sel_var")
        if not self._active or not cb or not var or self._data is None:
            return
        al = [str(x).strip() for x in (self._active.get("allowed") or []) if str(x).strip()]
        values: list[str] = [""] + al
        cb["values"] = values
        cur = self._active.get("selectedId")
        key = "" if cur is None else str(cur)
        if key in values:
            var.set(key)
        else:
            var.set("")

    def _load_slot_form(self, s: dict) -> None:
        self._set_form_mode(True)
        self._form_vars["slot_label_e"].delete(0, tk.END)
        self._form_vars["slot_label_e"].insert(0, s.get("label", "") or "")
        tx = self._form_vars["slot_allowed_tx"]
        tx.delete("1.0", tk.END)
        for x in s.get("allowed") or []:
            tx.insert(tk.END, f"{x}\n")
        s.setdefault("kind", "slot")
        self._update_slot_combobox()
        self._sync_json_panel()

    def _apply_slot_from_form(self, *, refresh_list: bool = True) -> None:
        s = self._active
        if not s or self._entry_kind != "slot":
            return
        s["kind"] = "slot"
        s["label"] = self._form_vars["slot_label_e"].get()
        lines = [ln.strip() for ln in self._form_vars["slot_allowed_tx"].get("1.0", tk.END).splitlines() if ln.strip()]
        s["allowed"] = lines
        v = (self._form_vars["slot_sel_var"].get() or "").strip()
        s["selectedId"] = None if v == "" else v
        self._update_slot_combobox()
        self._sync_json_panel()
        if refresh_list:
            self._refresh_list_preserving_selection()

    def _on_kind_change(self, event=None) -> None:
        if not self._active or self._bulk_load:
            return
        if self._entry_kind != "system":
            return
        self._active["kind"] = self._form_vars["kind"].get()
        self._refresh_extras(self._active["kind"])
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
        if not self._active or self._entry_kind != "system":
            return
        self._active.setdefault("areas", [])
        self._active["areas"].append(
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
        if not self._active:
            return
        areas = self._active.get("areas") or []
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
        if not self._active or self._entry_kind != "system" or "areas" not in self._active:
            return
        a = self._active["areas"]
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

    def _load_into_form_impl(self, s) -> None:
        if self._entry_kind == "slot":
            self._load_slot_form(s)
            return
        self._set_form_mode(False)
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
        self._json_mute = False
        self._load_into_form()
        self._refresh_list_preserving_selection()
        self._schedule_render()

    def _clear_form(self) -> None:
        if not hasattr(self, "_form_vars"):
            return
        self._set_form_mode(False)
        if "slot_label_e" in self._form_vars:
            self._form_vars["slot_label_e"].delete(0, tk.END)
        if "slot_allowed_tx" in self._form_vars:
            self._form_vars["slot_allowed_tx"].delete("1.0", tk.END)
        if "slot_sel_var" in self._form_vars:
            self._form_vars["slot_sel_var"].set("")
        if "slot_selected_cb" in self._form_vars:
            self._form_vars["slot_selected_cb"].configure(values=())
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

    def _apply_from_form(self) -> None:
        s = self._active
        if not s:
            return
        if self._entry_kind == "slot":
            self._apply_slot_from_form(refresh_list=True)
            return
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
        self._sync_json_panel()

    def _do_render(self) -> None:
        self._render_after = None
        if not self._active:
            return
        if self._entry_kind == "slot":
            self._apply_slot_from_form(refresh_list=False)
        else:
            self._apply_from_form()
        try:
            tw = int(round(TILE_WIDTH_CM * DPI / 2.54))
            th = int(round(TILE_HEIGHT_CM * DPI / 2.54))
            if self._entry_kind == "slot":
                lib = build_merged_library(self._data or {})
                sid = self._active.get("selectedId")
                if sid is None or str(sid).strip() == "":
                    self._img_label.configure(
                        text="(No selectedId) Pick an installed id to preview the tile.",
                        image="",
                    )
                    if self._photo:
                        self._photo = None
                    return
                key = str(sid).strip()
                if key not in lib:
                    self._img_label.configure(
                        text=f"selectedId {key!r} not in merged library (top-level + dedicatedSystems).",
                        image="",
                    )
                    if self._photo:
                        self._photo = None
                    return
                sys_def = copy.deepcopy(lib[key])
                im = create_system(sys_def, tw, th, DPI)
            else:
                im = create_system(copy.deepcopy(self._active), tw, th, DPI)
        except Exception as ex:
            self._img_label.configure(
                text=f"Render error: {ex}", image=""
            )
            if self._photo:
                self._photo = None
            return
        # Display-only resize (layout matches full-resolution output)
        max_w = 700
        w, h = im.size
        if w > max_w:
            scale = max_w / w
            im = im.resize((max_w, int(h * scale)), Image.Resampling.LANCZOS)
        self._photo = ImageTk.PhotoImage(im)
        self._img_label.configure(image=self._photo, text="")

    def _on_list_select(self, event=None) -> None:
        if self._list_silent:
            return
        if self._entries and self._active is not None:
            if self._entry_kind == "slot":
                self._apply_slot_from_form(refresh_list=False)
            else:
                self._apply_from_form()
        items = self._listbox.curselection()
        if not items or not self._entries:
            return
        i = int(items[0])
        self._list_index = i
        self._entry_kind, _lbl, self._active = self._entries[i]
        self._load_into_form()
        self._schedule_render()

    def _populate_list(self) -> None:
        self._listbox.delete(0, tk.END)
        for _k, label, _ in self._entries:
            self._listbox.insert(tk.END, label)
        if not self._entries:
            self._active = None
            self._entry_kind = "system"
            self._clear_form()
            self._sync_json_panel()
            return
        self._listbox.selection_set(0)
        self._entry_kind, _lbl, self._active = self._entries[0]
        self._load_into_form()
        self._schedule_render()

    def _new_file(self) -> None:
        if self._data and self._active is not None:
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
        self._listbox.delete(0, tk.END)
        for _k, label, _ in self._entries:
            self._listbox.insert(tk.END, label)
        for i, (_k, _l, ref) in enumerate(self._entries):
            if ref is blank:
                self._listbox.selection_clear(0, tk.END)
                self._listbox.selection_set(i)
                self._listbox.see(i)
                self._entry_kind = "system"
                self._active = blank
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
        self._file_path = path
        self._entries = collect_all_entries(self._data)
        self._populate_list()
        self.title(f"Systems editor — {os.path.basename(path)}")

    def _save(self) -> None:
        if self._active is not None:
            self._apply_from_form()
        if self._data is None:
            self._data = {}
        if not self._file_path:
            self._save_as()
            return
        try:
            with open(self._file_path, "w", encoding="utf-8") as f:
                json.dump(self._data, f, indent=2, ensure_ascii=False)
        except OSError as e:
            messagebox.showerror("Save failed", str(e))
        else:
            self.title(f"Systems editor — {os.path.basename(self._file_path)} (saved)")

    def _save_as(self) -> None:
        if self._active is not None:
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
