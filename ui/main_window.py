"""
main_window.py — Tkinter-Hauptfenster mit Server-Log und Einstellungen.

Läuft zwingend im Hauptthread (Tkinter-Anforderung). Kommuniziert mit
dem FastAPI-Daemon-Thread über eine thread-safe queue.Queue, die alle
200 ms via root.after() abgefragt wird.
"""

import datetime
import queue
import tkinter as tk
from tkinter import filedialog, ttk

from server import config as cfg_module


class MainWindow:
    """Hauptfenster der Qlog-Tools-Desktop-App.

    Parameters
    ----------
    log_queue : queue.Queue
        Wird von api.py befüllt; jeder Eintrag ist ein Log-String.
    on_close : callable | None
        Wird beim Schliessen des Fensters aufgerufen (z. B. für Cleanup).
    """

    def __init__(self, log_queue: queue.Queue, on_close=None):
        self.log_queue = log_queue
        self.on_close  = on_close

        self.root = tk.Tk()
        self.root.title("Qlog-Tools")
        self.root.geometry("700x500")
        self.root.minsize(600, 400)
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

        # Einstellungen einmalig laden (werden im Tab angezeigt)
        self._settings = cfg_module.load()
        self._build_ui()
        self._poll_log()

    # ── UI-Aufbau ─────────────────────────────────────────────────────────────

    def _build_ui(self):
        """Erstellt das Notebook mit den beiden Tabs."""
        nb = ttk.Notebook(self.root)
        nb.pack(fill=tk.BOTH, expand=True, padx=8, pady=8)

        log_frame = ttk.Frame(nb)
        nb.add(log_frame, text="Server-Log")
        self._build_log_tab(log_frame)

        cfg_frame = ttk.Frame(nb)
        nb.add(cfg_frame, text="Einstellungen")
        self._build_settings_tab(cfg_frame)

    def _build_log_tab(self, parent: ttk.Frame):
        """Log-Tab: Status-Leiste, Textfeld mit Scrollbalken, Farb-Tags."""
        self._build_log_statusbar(parent)
        self._build_log_textfield(parent)

    def _build_log_statusbar(self, parent: ttk.Frame):
        """Obere Leiste im Log-Tab mit Status-Label und 'Log leeren'-Button."""
        bar = ttk.Frame(parent)
        bar.pack(fill=tk.X, padx=8, pady=(8, 4))

        self._status_var = tk.StringVar(value="● Server läuft")
        ttk.Label(bar, textvariable=self._status_var,
                  foreground="#22c55e").pack(side=tk.LEFT)

        ttk.Button(bar, text="Log leeren",
                   command=self._clear_log).pack(side=tk.RIGHT)

    def _build_log_textfield(self, parent: ttk.Frame):
        """Dunkles Monospace-Textfeld mit vertikalem und horizontalem Scrollbalken."""
        txt_frame = ttk.Frame(parent)
        txt_frame.pack(fill=tk.BOTH, expand=True, padx=8, pady=(0, 4))

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

        # Farb-Tags: Methode, Timestamp, Fehler, normaler Text
        self._log_text.tag_config("time", foreground="#64748b")
        self._log_text.tag_config("get",  foreground="#60a5fa")
        self._log_text.tag_config("put",  foreground="#4ade80")
        self._log_text.tag_config("err",  foreground="#f87171")
        self._log_text.tag_config("info", foreground="#e2e8f0")

        # Maximale Zeilenzahl aus den Einstellungen übernehmen
        self._max_lines = self._settings["max_log_entries"]

    def _build_settings_tab(self, parent: ttk.Frame):
        """Einstellungen-Tab: DB-Pfad, Server-Optionen, Speichern-Button."""
        pad = {"padx": 12, "pady": 6}

        self._build_settings_db_group(parent, pad)
        self._build_settings_server_group(parent, pad)
        self._build_settings_save_row(parent)

    def _build_settings_db_group(self, parent: ttk.Frame, pad: dict):
        """LabelFrame 'Datenbank' mit Pfad-Eingabe und Datei-Browser."""
        group = ttk.LabelFrame(parent, text="Datenbank")
        group.pack(fill=tk.X, padx=12, pady=(12, 6))

        ttk.Label(group, text="Pfad zur qlog.db:").grid(
            row=0, column=0, sticky=tk.W, **pad)

        self._db_path_var = tk.StringVar(value=self._settings["db_path"])
        ttk.Entry(group, textvariable=self._db_path_var, width=50).grid(
            row=0, column=1, sticky=tk.EW, **pad)

        ttk.Button(group, text="…", width=3,
                   command=self._browse_db).grid(row=0, column=2, **pad)

        group.columnconfigure(1, weight=1)

    def _build_settings_server_group(self, parent: ttk.Frame, pad: dict):
        """LabelFrame 'Server' mit Port, Max-Log-Einträge und Auto-Open."""
        group = ttk.LabelFrame(parent, text="Server")
        group.pack(fill=tk.X, padx=12, pady=6)

        ttk.Label(group, text="Port:").grid(
            row=0, column=0, sticky=tk.W, **pad)
        self._port_var = tk.IntVar(value=self._settings["port"])
        ttk.Spinbox(group, textvariable=self._port_var,
                    from_=1024, to=65535, width=8).grid(
            row=0, column=1, sticky=tk.W, **pad)

        ttk.Label(group, text="Max. Log-Einträge:").grid(
            row=1, column=0, sticky=tk.W, **pad)
        self._max_log_var = tk.IntVar(value=self._settings["max_log_entries"])
        ttk.Spinbox(group, textvariable=self._max_log_var,
                    from_=10, to=2000, width=8).grid(
            row=1, column=1, sticky=tk.W, **pad)

        self._auto_open_var = tk.BooleanVar(
            value=self._settings["auto_open_browser"])
        ttk.Checkbutton(group, text="Browser beim Start öffnen",
                        variable=self._auto_open_var).grid(
            row=2, column=0, columnspan=2, sticky=tk.W, **pad)

    def _build_settings_save_row(self, parent: ttk.Frame):
        """Unterste Zeile im Einstellungen-Tab: Bestätigungstext + Speichern-Button."""
        row = ttk.Frame(parent)
        row.pack(fill=tk.X, padx=12, pady=12)

        self._save_info = tk.StringVar()
        ttk.Label(row, textvariable=self._save_info,
                  foreground="#22c55e").pack(side=tk.LEFT)

        ttk.Button(row, text="Speichern",
                   command=self._save_settings).pack(side=tk.RIGHT)

    # ── Log-Methoden ──────────────────────────────────────────────────────────

    def _poll_log(self):
        """Liest alle verfügbaren Einträge aus der Queue und plant nächste Abfrage.

        Wird initial in __init__() gestartet und ruft sich selbst alle 200 ms
        via root.after() auf. Läuft im Tkinter-Hauptthread.
        """
        try:
            while True:
                msg = self.log_queue.get_nowait()
                self._append_log(msg)
        except queue.Empty:
            pass
        self.root.after(200, self._poll_log)

    def _append_log(self, msg: str):
        """Hängt eine Zeile ans Log-Textfeld an, mit Zeitstempel und Farbgebung.

        Kürzt ältere Einträge auf _max_lines, damit der Speicher begrenzt bleibt.
        """
        self._log_text.configure(state=tk.NORMAL)

        # Zeilenanzahl ermitteln und älteste Einträge kürzen
        try:
            line_count = int(self._log_text.index("end-1c").split(".")[0])
            if line_count > self._max_lines:
                self._log_text.delete("1.0", f"{line_count - self._max_lines}.0")
        except (ValueError, tk.TclError):
            pass  # index-Parse kann in Edge-Cases fehlschlagen

        # Zeitstempel
        ts = datetime.datetime.now().strftime("%H:%M:%S")
        self._log_text.insert(tk.END, ts + "  ", "time")

        # Methode farbig hervorheben, Rest als normalen Text einfügen
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
        """Löscht alle Einträge im Log-Textfeld."""
        self._log_text.configure(state=tk.NORMAL)
        self._log_text.delete("1.0", tk.END)
        self._log_text.configure(state=tk.DISABLED)

    # ── Einstellungen ─────────────────────────────────────────────────────────

    def _browse_db(self):
        """Öffnet einen Datei-Dialog zur Auswahl der qlog.db."""
        path = filedialog.askopenfilename(
            title="qlog.db auswählen",
            filetypes=[("SQLite-Datenbank", "*.db"), ("Alle Dateien", "*.*")],
        )
        if path:
            self._db_path_var.set(path)

    def _save_settings(self):
        """Liest die Felder aus und speichert sie via config_module in config.ini."""
        new_settings = {
            "db_path":           self._db_path_var.get(),
            "port":              self._port_var.get(),
            "auto_open_browser": self._auto_open_var.get(),
            "max_log_entries":   self._max_log_var.get(),
        }
        cfg_module.save(new_settings)
        # Max-Zeilen sofort wirksam machen
        self._max_lines = new_settings["max_log_entries"]
        # Kurze Bestätigung anzeigen, nach 3 s ausblenden
        self._save_info.set("✓ Gespeichert")
        self.root.after(3000, lambda: self._save_info.set(""))

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def _on_close(self):
        """Wird beim Klick auf das X-Symbol des Fensters aufgerufen."""
        if self.on_close:
            self.on_close()
        self.root.destroy()

    def run(self):
        """Startet die Tkinter-Ereignisschleife (blockiert bis Fenster geschlossen)."""
        self.root.mainloop()
