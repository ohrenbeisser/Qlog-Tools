#!/bin/bash
cd "$(dirname "$0")"
python3 main.py &

sleep 3
wmctrl -r "Qlog-Tools" -t 3
