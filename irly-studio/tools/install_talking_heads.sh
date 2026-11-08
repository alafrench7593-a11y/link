#!/usr/bin/env bash
# Installe les moteurs « visage qui parle » et la voix locale à côté du dépôt.
# Chaque outil a son propre environnement Python (uv) et une version CPU de PyTorch.
# Usage : tools/install_talking_heads.sh [sadtalker|chatterbox|liveportrait|wav2lip|musetalk|all]
set -u
BASE="${IRLY_TOOLS_DIR:-$(cd "$(dirname "$0")/../../.." && pwd)}"
CPU=https://download.pytorch.org/whl/cpu
export HF_HUB_DISABLE_XET=1  # téléchargements Hugging Face en HTTP classique
LOGS="${IRLY_TOOLS_LOGS:-$BASE/irly_tools_logs}"
mkdir -p "$LOGS"

clone() { [ -d "$BASE/$2" ] || git clone --depth 1 "https://github.com/$1.git" "$BASE/$2"; }
venv() { (cd "$BASE/$1" && [ -x .venv/bin/python ] || uv venv -p "$2" .venv); }
pipi() { local d=$1; shift; uv pip install -p "$BASE/$d/.venv/bin/python" "$@"; }
hf() { local d=$1; shift; "$BASE/$d/.venv/bin/huggingface-cli" download "$@"; }

sadtalker() {
  clone OpenTalker/SadTalker SadTalker && venv SadTalker 3.10
  cd "$BASE/SadTalker" && mkdir -p checkpoints gfpgan/weights
  grep -v "^#" scripts/download_models.sh | grep http | grep -v "_512" \
    | sed 's/wget -nc/curl -fsSL -C -/; s/ -O / -o /' | bash
  pipi SadTalker torch==2.1.2 torchvision==0.16.2 --index-url $CPU
  pipi SadTalker numpy==1.23.4 face_alignment==1.3.5 imageio==2.19.3 imageio-ffmpeg==0.4.7 \
    librosa==0.9.2 numba resampy==0.3.1 pydub==0.25.1 scipy==1.10.1 kornia==0.6.8 tqdm yacs==0.1.8 \
    pyyaml joblib==1.1.0 scikit-image==0.19.3 basicsr==1.4.2 facexlib==0.3.0 gfpgan av safetensors \
    opencv-python==4.8.1.78
}

chatterbox() {
  clone resemble-ai/chatterbox chatterbox && venv chatterbox 3.11
  pipi chatterbox torch==2.6.0 torchaudio==2.6.0 --index-url $CPU
  pipi chatterbox -e "$BASE/chatterbox"
}

liveportrait() {
  clone KwaiVGI/LivePortrait LivePortrait && venv LivePortrait 3.10
  pipi LivePortrait torch==2.3.0 torchvision==0.18.0 --index-url $CPU
  pipi LivePortrait -r "$BASE/LivePortrait/requirements_base.txt" onnxruntime "huggingface_hub[cli]<1"
  hf LivePortrait KwaiVGI/LivePortrait --local-dir "$BASE/LivePortrait/pretrained_weights" \
    --exclude "*.git*" "README.md" "docs/*"
}

wav2lip() {
  clone Rudrabha/Wav2Lip Wav2Lip && venv Wav2Lip 3.10
  pipi Wav2Lip torch==2.3.0 torchvision==0.18.0 --index-url $CPU
  pipi Wav2Lip numpy==1.23.5 librosa==0.9.2 numba opencv-python==4.8.1.78 tqdm "huggingface_hub[cli]<1"
  # Miroirs communautaires : les poids officiels sont sur un SharePoint universitaire.
  hf Wav2Lip desudesuka/wav2lip-gan --local-dir "$BASE/Wav2Lip/hf_weights"
  hf Wav2Lip n0x1103/s3fd --local-dir "$BASE/Wav2Lip/hf_s3fd"
}

musetalk() {
  clone TMElyralab/MuseTalk MuseTalk && venv MuseTalk 3.10
  pipi MuseTalk torch==2.0.1 torchvision==0.15.2 torchaudio==2.0.2 --index-url $CPU
  grep -v -E "tensorflow|tensorboard" "$BASE/MuseTalk/requirements.txt" > "$LOGS/mt_req.txt"
  pipi MuseTalk -r "$LOGS/mt_req.txt" "huggingface_hub[cli]<1" gdown setuptools wheel ninja pip "mmengine==0.10.4"
  (cd "$BASE/MuseTalk" && sed -e 's/^pip install.*//' -e 's/^export HF_ENDPOINT.*//' download_weights.sh \
    | PATH="$BASE/MuseTalk/.venv/bin:$PATH" bash)
  MMCV_WITH_OPS=1 FORCE_CUDA=0 MAX_JOBS=4 pipi MuseTalk --no-build-isolation "mmcv==2.0.1"
  pipi MuseTalk "mmdet==3.1.0" "mmpose==1.1.0"
}

for tool in "${@:-all}"; do
  if [ "$tool" = all ]; then set -- sadtalker chatterbox liveportrait wav2lip musetalk; fi
done
for tool in "$@"; do
  echo "=== $tool"
  ( "$tool" ) > "$LOGS/$tool.log" 2>&1 && echo "$tool OK" || echo "$tool ÉCHEC (voir $LOGS/$tool.log)"
done
