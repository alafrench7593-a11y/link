#!/usr/bin/env bash
# Installe MoneyPrinterTurbo (non modifié) à côté du dépôt, puis ses dépendances.
set -e
cd "$(dirname "$0")"
MPT="${IRLY_MPT_DIR:-$(cd .. && cd .. && pwd)/MoneyPrinterTurbo}"
COMMIT=c235354804104665b58679223847f78c2b5e27d4
if [ ! -d "$MPT" ]; then
  git clone https://github.com/harry0703/MoneyPrinterTurbo.git "$MPT"
  git -C "$MPT" checkout "$COMMIT"
fi
[ -f "$MPT/config.toml" ] || cp "$MPT/config.example.toml" "$MPT/config.toml"
python3 -m venv "$MPT/.venv"
"$MPT/.venv/bin/pip" install -q -r "$MPT/requirements.txt" pytest
echo "OK. Lance : ./start.sh"
