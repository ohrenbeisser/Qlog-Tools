import threading
import webbrowser

import uvicorn

from server import api as api_module
from server import config as cfg_module
from ui.main_window import MainWindow


def run_server(port: int) -> None:
    uvicorn.run(
        api_module.app,
        host="127.0.0.1",
        port=port,
        log_level="warning",
    )


def main() -> None:
    settings = cfg_module.load()
    port = settings["port"]

    # FastAPI in eigenem Thread (daemon → endet mit dem Hauptprozess)
    t = threading.Thread(target=run_server, args=(port,), daemon=True)
    t.start()

    api_module.log_queue.put(f"Server gestartet auf http://127.0.0.1:{port}")

    if settings["auto_open_browser"]:
        webbrowser.open(f"http://127.0.0.1:{port}")

    # TKinter läuft im Hauptthread
    window = MainWindow(log_queue=api_module.log_queue)
    window.run()


if __name__ == "__main__":
    main()
