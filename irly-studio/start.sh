#!/usr/bin/env bash
# Lance IRLY Studio avec l'environnement Python de MoneyPrinterTurbo.
set -e
cd "$(dirname "$0")"
MPT="${IRLY_MPT_DIR:-$(cd .. && cd .. && pwd)/MoneyPrinterTurbo}"
exec "$MPT/.venv/bin/streamlit" run app.py --server.headless true --server.port "${PORT:-8502}" "$@"
