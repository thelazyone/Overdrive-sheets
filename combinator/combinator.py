"""
Overdrive Trait Combinator
==========================

Tiny developer tool to visualise which ships / systems are available to a
player given their two chosen traits.

Rules
-----
- Five traits: Trade, Military, Exploration, Science, Diplomacy.
- A player picks 2 of the 5  -> C(5,2) = 10 distinct combinations.
- Each ship and each system has zero or more required traits.
- An item is AVAILABLE for a given combo if it has no requirements OR at
  least one of its required traits is in the player's combo (OR logic).

Layout
------
[ Tree + buttons ] | [ Name + 5 trait checkboxes ] | [ 10 combo cells ]

Data is auto-saved to ``combinator/data.json`` on every edit.
"""

from __future__ import annotations

import json
import tkinter as tk
from itertools import combinations
from pathlib import Path
from tkinter import font as tkfont
from tkinter import messagebox, ttk

TRAITS = ["Trade", "Military", "Exploration", "Science", "Diplomacy"]

TRAIT_COLORS = {
    "Trade": "#e6b800",
    "Military": "#cc3333",
    "Exploration": "#33aa55",
    "Science": "#3377cc",
    "Diplomacy": "#aa55cc",
}

DATA_FILE = Path(__file__).parent / "data.json"


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------
def load_data() -> dict:
    if DATA_FILE.exists():
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {"ships": []}


def save_data(data: dict) -> None:
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Rules
# ---------------------------------------------------------------------------
def is_available(required: list[str], combo: tuple[str, ...]) -> bool:
    """No requirements -> always available; otherwise OR over the combo."""
    if not required:
        return True
    return any(t in combo for t in required)


def mix_color(traits: list[str]) -> str:
    """Average the trait colors. Empty -> neutral grey."""
    if not traits:
        return "#666666"
    rs, gs, bs = [], [], []
    for t in traits:
        hexc = TRAIT_COLORS[t].lstrip("#")
        rs.append(int(hexc[0:2], 16))
        gs.append(int(hexc[2:4], 16))
        bs.append(int(hexc[4:6], 16))
    return f"#{sum(rs)//len(rs):02x}{sum(gs)//len(gs):02x}{sum(bs)//len(bs):02x}"


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
class App(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Overdrive Trait Combinator")
        self.geometry("1400x820")
        self.minsize(900, 500)

        self._loading = False  # guards trace callbacks while loading editor
        self.data = load_data()
        self.selected_path: tuple | None = None  # ("ship", si) | ("system", si, yi)

        # cached fonts for text measurement on the combo canvas
        self._ship_font = tkfont.Font(family="TkDefaultFont", size=9, weight="bold")
        self._title_font = tkfont.Font(family="TkDefaultFont", size=10, weight="bold")
        self._sub_font = tkfont.Font(family="TkDefaultFont", size=8)

        # hover tooltip state for the combo canvas
        # canvas item id -> (kind, name, traits)
        self._hover_info: dict[int, tuple[str, str, list[str]]] = {}
        self._tooltip: tk.Toplevel | None = None

        self._build_ui()
        self._refresh_tree()
        self.after(50, self._refresh_combos)  # let the canvas get a real size

    # ---------------------- UI construction --------------------------------
    def _build_ui(self) -> None:
        paned = ttk.PanedWindow(self, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True)

        # --- column 1: tree + buttons ---
        left = ttk.Frame(paned, padding=4)
        paned.add(left, weight=1)

        btns = ttk.Frame(left)
        btns.pack(fill=tk.X)
        ttk.Button(btns, text="New Ship", command=self._new_ship).pack(side=tk.LEFT)
        ttk.Button(btns, text="New System", command=self._new_system).pack(
            side=tk.LEFT, padx=(4, 0)
        )
        ttk.Button(btns, text="Delete", command=self._delete).pack(
            side=tk.LEFT, padx=(4, 0)
        )

        self.tree = ttk.Treeview(left, show="tree")
        self.tree.pack(fill=tk.BOTH, expand=True, pady=(6, 0))
        self.tree.bind("<<TreeviewSelect>>", self._on_select)

        # --- column 2: editor ---
        mid = ttk.Frame(paned, padding=10)
        paned.add(mid, weight=1)

        self.editor_title = ttk.Label(
            mid, text="(nothing selected)", font=("TkDefaultFont", 12, "bold")
        )
        self.editor_title.pack(anchor=tk.W)

        ttk.Label(mid, text="Name:").pack(anchor=tk.W, pady=(10, 2))
        self.name_var = tk.StringVar()
        self.name_entry = ttk.Entry(mid, textvariable=self.name_var)
        self.name_entry.pack(fill=tk.X)
        self.name_var.trace_add("write", lambda *_: self._apply_changes())

        ttk.Label(mid, text="Required traits (any-of):").pack(
            anchor=tk.W, pady=(12, 2)
        )
        self.trait_vars: dict[str, tk.BooleanVar] = {}
        for t in TRAITS:
            v = tk.BooleanVar()
            ttk.Checkbutton(
                mid, text=t, variable=v, command=self._apply_changes
            ).pack(anchor=tk.W)
            self.trait_vars[t] = v

        ttk.Separator(mid).pack(fill=tk.X, pady=(16, 6))
        legend = ttk.Frame(mid)
        legend.pack(anchor=tk.W)
        ttk.Label(legend, text="Trait colors:").pack(anchor=tk.W, pady=(0, 2))
        for t, color in TRAIT_COLORS.items():
            row = ttk.Frame(legend)
            row.pack(anchor=tk.W)
            sw = tk.Canvas(row, width=14, height=14, highlightthickness=0)
            sw.pack(side=tk.LEFT, padx=(0, 4))
            sw.create_rectangle(0, 0, 14, 14, fill=color, outline="")
            ttk.Label(row, text=t).pack(side=tk.LEFT)

        # --- column 3: 10 combinations panel ---
        right = ttk.Frame(paned, padding=4)
        paned.add(right, weight=3)
        self.combo_canvas = tk.Canvas(right, bg="#1e1e1e", highlightthickness=0)
        self.combo_canvas.pack(fill=tk.BOTH, expand=True)
        self.combo_canvas.bind("<Configure>", lambda _e: self._refresh_combos())

        # hover bindings (single shared tag, info keyed by canvas item id)
        self.combo_canvas.tag_bind("hov", "<Enter>", self._on_hover_enter)
        self.combo_canvas.tag_bind("hov", "<Motion>", self._on_hover_motion)
        self.combo_canvas.tag_bind("hov", "<Leave>", self._on_hover_leave)

    # ---------------------- tree helpers -----------------------------------
    def _refresh_tree(self) -> None:
        prev = self.selected_path
        self.tree.delete(*self.tree.get_children())

        for si, ship in enumerate(self.data["ships"]):
            ship_id = f"ship:{si}"
            self.tree.insert(
                "",
                "end",
                iid=ship_id,
                text=self._format_label(ship["name"], ship.get("traits", [])),
                open=True,
            )
            for yi, sysobj in enumerate(ship.get("systems", [])):
                self.tree.insert(
                    ship_id,
                    "end",
                    iid=f"sys:{si}:{yi}",
                    text=self._format_label(
                        sysobj["name"], sysobj.get("traits", [])
                    ),
                )

        if prev is not None:
            iid = self._path_to_iid(prev)
            if self.tree.exists(iid):
                self.tree.selection_set(iid)

    @staticmethod
    def _format_label(name: str, traits: list[str]) -> str:
        if traits:
            return f"{name}  [{'/'.join(t[0] for t in traits)}]"
        return f"{name}  [-]"

    @staticmethod
    def _path_to_iid(path: tuple) -> str:
        if path[0] == "ship":
            return f"ship:{path[1]}"
        return f"sys:{path[1]}:{path[2]}"

    def _on_select(self, _evt) -> None:
        sel = self.tree.selection()
        if not sel:
            self.selected_path = None
        else:
            iid = sel[0]
            if iid.startswith("ship:"):
                self.selected_path = ("ship", int(iid.split(":")[1]))
            else:
                _, si, yi = iid.split(":")
                self.selected_path = ("system", int(si), int(yi))
        self._load_editor()

    # ---------------------- selected-item helpers --------------------------
    def _get_item(self) -> dict | None:
        if not self.selected_path:
            return None
        ships = self.data["ships"]
        if self.selected_path[0] == "ship":
            return ships[self.selected_path[1]]
        return ships[self.selected_path[1]]["systems"][self.selected_path[2]]

    # ---------------------- editor -----------------------------------------
    def _load_editor(self) -> None:
        item = self._get_item()
        self._loading = True
        try:
            if item is None:
                self.editor_title.config(text="(nothing selected)")
                self.name_var.set("")
                for v in self.trait_vars.values():
                    v.set(False)
                return
            kind = "Ship" if self.selected_path[0] == "ship" else "System"
            self.editor_title.config(text=f"Edit {kind}")
            self.name_var.set(item.get("name", ""))
            for t, v in self.trait_vars.items():
                v.set(t in item.get("traits", []))
        finally:
            self._loading = False

    def _apply_changes(self) -> None:
        if self._loading:
            return
        item = self._get_item()
        if item is None:
            return
        item["name"] = self.name_var.get()
        item["traits"] = [t for t, v in self.trait_vars.items() if v.get()]
        save_data(self.data)

        iid = self._path_to_iid(self.selected_path)
        if self.tree.exists(iid):
            self.tree.item(
                iid, text=self._format_label(item["name"], item["traits"])
            )
        self._refresh_combos()

    # ---------------------- CRUD -------------------------------------------
    def _new_ship(self) -> None:
        self.data["ships"].append(
            {"name": "New Ship", "traits": [], "systems": []}
        )
        save_data(self.data)
        new_idx = len(self.data["ships"]) - 1
        self.selected_path = ("ship", new_idx)
        self._refresh_tree()
        iid = self._path_to_iid(self.selected_path)
        self.tree.selection_set(iid)
        self.tree.focus(iid)
        self._load_editor()
        self.name_entry.focus_set()
        self.name_entry.select_range(0, tk.END)
        self._refresh_combos()

    def _new_system(self) -> None:
        if not self.selected_path:
            messagebox.showinfo(
                "Pick a ship", "Select a ship first to add a system to it."
            )
            return
        si = self.selected_path[1]  # works for both ship and system selection
        systems = self.data["ships"][si].setdefault("systems", [])
        systems.append({"name": "New System", "traits": []})
        save_data(self.data)
        new_idx = len(systems) - 1
        self.selected_path = ("system", si, new_idx)
        self._refresh_tree()
        iid = self._path_to_iid(self.selected_path)
        self.tree.selection_set(iid)
        self.tree.focus(iid)
        self._load_editor()
        self.name_entry.focus_set()
        self.name_entry.select_range(0, tk.END)
        self._refresh_combos()

    def _delete(self) -> None:
        if not self.selected_path:
            return
        if self.selected_path[0] == "ship":
            ship = self.data["ships"][self.selected_path[1]]
            if not messagebox.askyesno(
                "Delete ship",
                f"Delete ship '{ship['name']}' and all its systems?",
            ):
                return
            del self.data["ships"][self.selected_path[1]]
        else:
            si, yi = self.selected_path[1], self.selected_path[2]
            sysname = self.data["ships"][si]["systems"][yi]["name"]
            if not messagebox.askyesno(
                "Delete system", f"Delete system '{sysname}'?"
            ):
                return
            del self.data["ships"][si]["systems"][yi]

        save_data(self.data)
        self.selected_path = None
        self._refresh_tree()
        self._load_editor()
        self._refresh_combos()

    # ---------------------- combinations panel -----------------------------
    def _refresh_combos(self) -> None:
        c = self.combo_canvas
        # tearing down all canvas items invalidates every hover registration
        self._hide_tooltip()
        self._hover_info.clear()
        c.delete("all")
        w = c.winfo_width()
        h = c.winfo_height()
        if w < 50 or h < 50:
            return

        cols, rows = 2, 5
        pad = 6
        cell_w = (w - pad * (cols + 1)) / cols
        cell_h = (h - pad * (rows + 1)) / rows

        for i, combo in enumerate(combinations(TRAITS, 2)):
            col, row = i % cols, i // cols
            x0 = pad + col * (cell_w + pad)
            y0 = pad + row * (cell_h + pad)
            self._draw_combo_cell(combo, x0, y0, x0 + cell_w, y0 + cell_h)

    # tuneables for the per-cell column-flow layout
    SHIP_H = 18
    SYS_SQ = 11           # side of each small system square
    SYS_GAP = 2
    GROUP_GAP = 5         # vertical gap between ship groups
    COL_GAP = 4           # horizontal gap between columns
    MIN_COL_W = 48        # narrowest a column is allowed to get

    def _draw_combo_cell(self, combo, x0, y0, x1, y1) -> None:
        c = self.combo_canvas

        ships = [
            s for s in self.data["ships"]
            if is_available(s.get("traits", []), combo)
        ]
        per_ship_systems = [
            [
                s for s in ship.get("systems", [])
                if is_available(s.get("traits", []), combo)
            ]
            for ship in ships
        ]
        total_systems = sum(len(s) for s in per_ship_systems)

        c.create_rectangle(x0, y0, x1, y1, fill="#2a2a2a", outline="#444")

        # --- header ---
        title_y = y0 + 14
        c.create_text(
            x0 + 8, title_y, anchor=tk.W,
            text=f"{combo[0]} + {combo[1]}",
            fill="white", font=self._title_font,
        )
        c.create_text(
            x0 + 8, title_y + 16, anchor=tk.W,
            text=f"{len(ships)} ships  /  {total_systems} systems",
            fill="#aaaaaa", font=self._sub_font,
        )
        dot_x = x1 - 8
        for t in reversed(combo):
            c.create_oval(
                dot_x - 11, title_y - 6, dot_x, title_y + 5,
                fill=TRAIT_COLORS[t], outline="",
            )
            dot_x -= 15

        if not ships:
            return

        # --- content area ---
        content_top = y0 + 38
        content_left = x0 + 6
        content_right = x1 - 6
        content_bottom = y1 - 6
        content_w = content_right - content_left
        content_h = content_bottom - content_top

        if content_w < self.MIN_COL_W or content_h < self.SHIP_H:
            return

        # Pick the smallest number of columns that fits every ship group.
        max_cols = max(
            1,
            int((content_w + self.COL_GAP) // (self.MIN_COL_W + self.COL_GAP)),
        )
        max_cols = min(max_cols, len(ships))

        def group_height(n_systems: int, per_row: int) -> int:
            rows = (n_systems + per_row - 1) // per_row if n_systems else 0
            return (
                self.SHIP_H
                + (rows * (self.SYS_SQ + self.SYS_GAP) if rows else 0)
                + self.GROUP_GAP
            )

        def col_metrics(cols: int) -> tuple[float, int]:
            col_w = (content_w - (cols - 1) * self.COL_GAP) / cols
            per_row = max(1, int((col_w + self.SYS_GAP) // (self.SYS_SQ + self.SYS_GAP)))
            return col_w, per_row

        def fits(cols: int) -> bool:
            _, per_row = col_metrics(cols)
            col_idx = 0
            col_y = 0
            for sys_list in per_ship_systems:
                h = group_height(len(sys_list), per_row)
                # tall group on a fresh column that still doesn't fit -> truncate it
                if col_y > 0 and col_y + h > content_h:
                    col_idx += 1
                    col_y = 0
                    if col_idx >= cols:
                        return False
                col_y += h
            return True

        cols = 1
        while cols < max_cols and not fits(cols):
            cols += 1
        # if we hit max_cols and still don't fit, just use max_cols (groups
        # at the very end will be clipped at the cell edge - acceptable)
        col_w, per_row = col_metrics(cols)

        # --- layout pass ---
        col_idx = 0
        col_y_off = 0
        for ship, sys_list in zip(ships, per_ship_systems):
            h = group_height(len(sys_list), per_row)
            if col_y_off > 0 and col_y_off + h > content_h:
                col_idx += 1
                col_y_off = 0
                if col_idx >= cols:
                    break  # safety guard; layout chose cols so we shouldn't hit this

            cx = content_left + col_idx * (col_w + self.COL_GAP)
            cy = content_top + col_y_off

            ship_color = mix_color(ship.get("traits", []))
            ship_ids: list[int] = []
            ship_ids.append(c.create_rectangle(
                cx, cy, cx + col_w, cy + self.SHIP_H,
                fill=ship_color, outline="#111",
            ))
            text = self._fit_text(ship["name"], self._ship_font, col_w - 8)
            if text:
                ship_ids.append(c.create_text(
                    cx + 4, cy + self.SHIP_H / 2, anchor=tk.W,
                    text=text, fill="white", font=self._ship_font,
                ))
            self._register_hover(
                ship_ids, "Ship", ship["name"], ship.get("traits", []),
            )

            # systems: small colored squares, no text, wrapping inside col_w
            sy0 = cy + self.SHIP_H + self.SYS_GAP
            for i, sysobj in enumerate(sys_list):
                row, colp = divmod(i, per_row)
                sx = cx + 2 + colp * (self.SYS_SQ + self.SYS_GAP)
                srect_y = sy0 + row * (self.SYS_SQ + self.SYS_GAP)
                sys_id = c.create_rectangle(
                    sx, srect_y,
                    sx + self.SYS_SQ, srect_y + self.SYS_SQ,
                    fill=mix_color(sysobj.get("traits", [])),
                    outline="#111",
                )
                self._register_hover(
                    [sys_id], "System", sysobj["name"], sysobj.get("traits", []),
                )

            col_y_off += h

    @staticmethod
    def _fit_text(text: str, font: tkfont.Font, max_px: float) -> str:
        """Truncate ``text`` (adding an ellipsis) so it fits within ``max_px``."""
        if max_px <= 0:
            return ""
        if font.measure(text) <= max_px:
            return text
        ell = "..."
        if font.measure(ell) > max_px:
            return ""
        cut = text
        while cut and font.measure(cut + ell) > max_px:
            cut = cut[:-1]
        return (cut + ell) if cut else ell

    # ---------------------- hover tooltips ---------------------------------
    def _register_hover(
        self,
        item_ids: list[int],
        kind: str,
        name: str,
        traits: list[str],
    ) -> None:
        """Tag canvas items so they trigger the shared hover tooltip."""
        info = (kind, name, traits)
        for item_id in item_ids:
            self.combo_canvas.addtag_withtag("hov", item_id)
            self._hover_info[item_id] = info

    def _current_info(self) -> tuple[str, str, list[str]] | None:
        items = self.combo_canvas.find_withtag("current")
        if not items:
            return None
        return self._hover_info.get(items[0])

    def _on_hover_enter(self, event) -> None:
        info = self._current_info()
        if info is not None:
            self._show_tooltip(event, info)

    def _on_hover_motion(self, event) -> None:
        if self._tooltip is None:
            # if Enter was missed for some reason, show on first motion
            info = self._current_info()
            if info is None:
                return
            self._show_tooltip(event, info)
            return
        self._tooltip.wm_geometry(f"+{event.x_root + 14}+{event.y_root + 18}")

    def _on_hover_leave(self, _event) -> None:
        self._hide_tooltip()

    def _show_tooltip(self, event, info: tuple[str, str, list[str]]) -> None:
        kind, name, traits = info
        self._hide_tooltip()

        tw = tk.Toplevel(self)
        tw.wm_overrideredirect(True)
        try:
            tw.wm_attributes("-topmost", True)
        except tk.TclError:
            pass

        traits_line = " / ".join(traits) if traits else "(no requirements)"
        frame = tk.Frame(tw, bg="#202020", bd=1, relief="solid")
        frame.pack()
        tk.Label(
            frame, text=name, bg="#202020", fg="white",
            font=("TkDefaultFont", 9, "bold"),
        ).pack(anchor=tk.W, padx=6, pady=(4, 0))
        tk.Label(
            frame, text=f"{kind} - {traits_line}",
            bg="#202020", fg="#bbbbbb",
            font=("TkDefaultFont", 8),
        ).pack(anchor=tk.W, padx=6, pady=(0, 4))

        tw.wm_geometry(f"+{event.x_root + 14}+{event.y_root + 18}")
        self._tooltip = tw

    def _hide_tooltip(self) -> None:
        if self._tooltip is not None:
            try:
                self._tooltip.destroy()
            except tk.TclError:
                pass
            self._tooltip = None


if __name__ == "__main__":
    App().mainloop()
