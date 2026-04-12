"""
network.py — Hilfsfunktionen zur Netzwerk-Adressermittlung.
"""

import socket


def get_local_ips() -> list[str]:
    """Gibt alle lokalen IPv4-Adressen zurück (ohne Loopback 127.x.x.x).

    Funktioniert ohne Root-Rechte und ohne externe Bibliotheken.
    Öffnet kurz einen UDP-Socket pro Netzwerkziel um die ausgehende
    Interface-Adresse zu ermitteln — es wird kein Paket gesendet.

    Bei mehreren Interfaces (LAN + WLAN) werden alle zurückgegeben.
    Gibt ['127.0.0.1'] zurück wenn keine Netzwerkverbindung besteht.
    """
    ips: list[str] = []

    # Mehrere Zieladressen ausprobieren, um alle aktiven Interfaces zu erfassen
    targets = [
        ("8.8.8.8",   80),   # Default-Route (typischerweise LAN oder WLAN)
        ("1.1.1.1",   80),   # Alternatives Ziel für zweites Interface
    ]

    for host, port in targets:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.connect((host, port))
                ip = s.getsockname()[0]
                if ip not in ips and not ip.startswith("127."):
                    ips.append(ip)
        except OSError:
            pass

    return ips if ips else ["127.0.0.1"]


def format_server_addresses(port: int) -> str:
    """Gibt alle Server-Adressen als kommagetrennten String zurück.

    Beispiel: '192.168.1.42:8765, 10.0.0.5:8765'

    Parameters
    ----------
    port : int
        Der Port auf dem der Server läuft.
    """
    ips = get_local_ips()
    return ", ".join(f"{ip}:{port}" for ip in ips)
