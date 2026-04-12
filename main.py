"""
main.py — Einstiegspunkt für Qlog-Tools.

Startet zwei parallele Ausführungseinheiten:
  1. FastAPI + uvicorn als Daemon-Thread (Port aus config.ini)
  2. Tkinter-Fenster im Hauptthread (blockiert bis Fenster geschlossen)

Da Tkinter den Hauptthread benötigt, läuft der Server im Hintergrund.
Der Server endet automatisch, wenn das Tkinter-Fenster geschlossen wird
(daemon=True → Thread wird mit dem Hauptprozess beendet).
"""

import threading
import webbrowser

import uvicorn

from server import api as api_module
from server import config as cfg_module
from ui.main_window import MainWindow


def run_server(port: int) -> None:
    """Startet uvicorn mit der FastAPI-App (blockierend, läuft in eigenem Thread)."""
    uvicorn.run(
        api_module.app,
        host="127.0.0.1",   # Nur lokal — kein Netzwerkzugriff von aussen
        port=port,
        log_level="warning",  # uvicorn-eigene Logs unterdrücken; wir loggen selbst
    )


def main() -> None:
    """Hauptfunktion: Server starten, Browser öffnen, Tkinter-Fenster anzeigen."""
    settings = cfg_module.load()
    port = settings["port"]

    # FastAPI in eigenem Thread (daemon → endet mit dem Hauptprozess)
    server_thread = threading.Thread(target=run_server, args=(port,), daemon=True)
    server_thread.start()

    # Ersten Log-Eintrag manuell einstellen (uvicorn schreibt nicht in log_queue)
    api_module.log_queue.put(f"Server gestartet auf http://127.0.0.1:{port}")

    # Browser automatisch öffnen (wenn in den Einstellungen aktiviert)
    if settings["auto_open_browser"]:
        webbrowser.open(f"http://127.0.0.1:{port}")

    # Tkinter im Hauptthread — blockiert bis Fenster geschlossen wird
    window = MainWindow(log_queue=api_module.log_queue)
    window.run()


if __name__ == "__main__":
    main()
