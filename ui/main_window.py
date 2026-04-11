import queue
import tkinter as tk
from tkinter import filedialog, font, ttk

from server import config as cfg_module


class MainWindow:
    def __init__(self, log_queue: queue.Queue, on_close=None):
        self.log_queue = log_queue
        self.on_close  = on_close

        self.root = tk.Tk()
        self.root.title("Qlog-Tools")
        self.root.geometry("700x500")
        self.root.minsize(600, 400)
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

        self._settings = cfg_module.load()
        self._build_ui()
        self._poll_log()

    # ── UI-Aufbau ─────────────────────────────────────────────────────────────

    def _build_ui(self):
        # Notebook (Tabs)
        nb = ttk.Notebook(self.root)
        nb.pack(fill=tk.BOTH, expand=True, padx=8, pady=8)

        # Tab 1: Server-Log
        log_frame = ttk.Frame(nb)
        nb.add(log_frame, text="Server-Log")
        self._build_log_tab(log_frame)

        # Tab 2: Einstellungen
        cfg_frame = ttk.Frame(nb)
        nb.add(cfg_frame, text="Einstellungen")
        self._build_settings_tab(cfg_frame)

    def _build_log_tab(self, parent):
        # Status-Leiste oben
        status_bar = ttk.Frame(parent)
        status_bar.pack(fill=tk.X, padx=8, pady=(8, 4))

        self._status_var = tk.StringVar(value="● Server läuft")
        status_lbl = ttk.Label(status_bar, textvariable=self._status_var,
                               foreground="#22c55e")
        status_lbl.pack(side=tk.LEFT)

        ttk.Button(status_bar, text="Log leeren",
                   command=self._clear_log).pack(side=tk.RIGHT)

        # Log-Textfeld
        txt_frame = ttk.Frame(parent)
        txt_frame.pack(fill=tk.BOTH, expand=True, padx=8, pady=(0, 8))

        self._log_text = tk.Text(
            txt_frame,
            state=tk.DISABLED,
            wrap=tk.NONE,
            font=("Courier New", 10),
            bg="#0f172a",
            fg="#e2e8f0",
            insertbackground="#e2e8f0",
            relief=tk.FLAT,
            bd=0,
        )
        self._log_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        sb_y = ttk.Scrollbar(txt_frame, orient=tk.VERTICAL,
                              command=self._log_text.yview)
        sb_y.pack(side=tk.RIGHT, fill=tk.Y)
        self._log_text.configure(yscrollcommand=sb_y.set)

        sb_x = ttk.Scrollbar(parent, orient=tk.HORIZONTAL,
                              command=self._log_text.xview)
        sb_x.pack(fill=tk.X, padx=8, pady=(0, 4))
        self._log_text.configure(xscrollcommand=sb_x.set)

        # Farb-Tags
        self._log_text.tag_config("time",    foreground="#64748b")
        self._log_text.tag_config("get",     foreground="#60a5fa")
        self._log_text.tag_config("put",     foreground="#4ade80")
        self._log_text.tag_config("err",     foreground="#f87171")
        self._log_text.tag_config("info",    foreground="#e2e8f0")

        self._max_lines = self._settings["max_log_entries"]

    def _build_settings_tab(self, parent):
        pad = {"padx": 12, "pady": 6}

        # ── Datenbank ──────────────────────────────────────────────────────
        db_group = ttk.LabelFrame(parent, text="Datenbank")
        db_group.pack(fill=tk.X, padx=12, pady=(12, 6))

        ttk.Label(db_group, text="Pfad zur qlog.db:").grid(
            row=0, column=0, sticky=tk.W, **pad)

        self._db_path_var = tk.StringVar(value=self._settings["db_path"])
        db_entry = ttk.Entry(db_group, textvariable=self._db_path_var, width=50)
        db_entry.grid(row=0, column=1, sticky=tk.EW, **pad)

        ttk.Button(db_group, text="…", width=3,
                   command=self._browse_db).grid(row=0, column=2, **pad)

        db_group.columnconfigure(1, weight=1)

        # ── Server ─────────────────────────────────────────────────────────
        srv_group = ttk.LabelFrame(parent, text="Server")
        srv_group.pack(fill=tk.X, padx=12, pady=6)

        ttk.Label(srv_group, text="Port:").grid(
            row=0, column=0, sticky=tk.W, **pad)
        self._port_var = tk.IntVar(value=self._settings["port"])
        ttk.Spinbox(srv_group, textvariable=self._port_var,
                    from_=1024, to=65535, width=8).grid(
            row=0, column=1, sticky=tk.W, **pad)

        ttk.Label(srv_group, text="Max. Log-Einträge:").grid(
            row=1, column=0, sticky=tk.W, **pad)
        self._max_log_var = tk.IntVar(value=self._settings["max_log_entries"])
        ttk.Spinbox(srv_group, textvariable=self._max_log_var,
                    from_=10, to=2000, width=8).grid(
            row=1, column=1, sticky=tk.W, **pad)

        self._auto_open_var = tk.BooleanVar(
            value=self._settings["auto_open_browser"])
        ttk.Checkbutton(srv_group, text="Browser beim Start öffnen",
                        variable=self._auto_open_var).grid(
            row=2, column=0, columnspan=2, sticky=tk.W, **pad)

        # ── Speichern-Button ───────────────────────────────────────────────
        btn_frame = ttk.Frame(parent)
        btn_frame.pack(fill=tk.X, padx=12, pady=12)

        self._save_info = tk.StringVar()
        ttk.Label(btn_frame, textvariable=self._save_info,
                  foreground="#22c55e").pack(side=tk.LEFT)

        ttk.Button(btn_frame, text="Speichern",
                   command=self._save_settings).pack(side=tk.RIGHT)

    # ── Log-Methoden ──────────────────────────────────────────────────────────

    def _poll_log(self):
        try:
            while True:
                msg = self.log_queue.get_nowait()
                self._append_log(msg)
        except queue.Empty:
            pass
        self.root.after(200, self._poll_log)

    def _append_log(self, msg: str):
        import datetime
        self._log_text.configure(state=tk.NORMAL)

        # Alte Zeilen kürzen
        lines = int(self._log_text.index("end-1c").split(".")[0])
        if lines > self._max_lines:
            self._log_text.delete("1.0", f"{lines - self._max_lines}.0")

        # Zeitstempel
        ts = datetime.datetime.now().strftime("%H:%M:%S")
        self._log_text.insert(tk.END, ts + "  ", "time")

        # Methode farbig
        upper = msg.upper()
        if upper.startswith("GET"):
            self._log_text.insert(tk.END, "GET  ", "get")
            self._log_text.insert(tk.END, msg[3:].rstrip() + "\n", "info")
        elif upper.startswith("PUT"):
            self._log_text.insert(tk.END, "PUT  ", "put")
            self._log_text.insert(tk.END, msg[3:].rstrip() + "\n", "info")
        elif "fehler" in msg.lower() or "error" in msg.lower():
            self._log_text.insert(tk.END, msg.rstrip() + "\n", "err")
        else:
            self._log_text.insert(tk.END, msg.rstrip() + "\n", "info")

        self._log_text.configure(state=tk.DISABLED)
        self._log_text.see(tk.END)

    def _clear_log(self):
        self._log_text.configure(state=tk.NORMAL)
        self._log_text.delete("1.0", tk.END)
        self._log_text.configure(state=tk.DISABLED)

    # ── Einstellungen ─────────────────────────────────────────────────────────

    def _browse_db(self):
        path = filedialog.askopenfilename(
            title="qlog.db auswählen",
            filetypes=[("SQLite-Datenbank", "*.db"), ("Alle Dateien", "*.*")],
        )
        if path:
            self._db_path_var.set(path)

    def _save_settings(self):
        new_settings = {
            "db_path":           self._db_path_var.get(),
            "port":              self._port_var.get(),
            "auto_open_browser": self._auto_open_var.get(),
            "max_log_entries":   self._max_log_var.get(),
        }
        cfg_module.save(new_settings)
        self._max_lines = new_settings["max_log_entries"]
        self._save_info.set("✓ Gespeichert")
        self.root.after(3000, lambda: self._save_info.set(""))

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def _on_close(self):
        if self.on_close:
            self.on_close()
        self.root.destroy()

    def run(self):
        self.root.mainloop()
