#!/usr/bin/env bash
set -euo pipefail

MODELS_DIR="$(cd "$(dirname "$0")/../models" && pwd)"
HF_BASE="https://huggingface.co/mufasabrownie/glowlytics-skin-models/resolve/main"

echo "[download-models] Downloading ONNX models to $MODELS_DIR"

download() {
  local remote="$1" local_name="$2"
  local dest="$MODELS_DIR/$local_name"
  if [ -f "$dest" ]; then
    echo "  · $local_name (cached)"
    return
  fi
  curl -fSL --progress-bar "$HF_BASE/$remote" -o "$dest"
  echo "  ✓ $local_name"
}

# Signal models (structure, hydration, elasticity)
download "structure_model.onnx" "structure.onnx"
download "hydration_model.onnx" "hydration.onnx"
download "elasticity_model.onnx" "elasticity.onnx"

# Unified skin signals model (multi-head EfficientNet-B0)
download "skin_signals.onnx" "skin_signals.onnx"

# Acne/lesion detector (YOLOv8s single-class)
download "acne_detector.onnx" "acne_detector.onnx"

echo "[download-models] Done. Models in $MODELS_DIR:"
ls -lh "$MODELS_DIR"/*.onnx 2>/dev/null || echo "  (no .onnx files)"
