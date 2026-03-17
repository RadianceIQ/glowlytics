#!/usr/bin/env bash
set -euo pipefail

MODELS_DIR="$(cd "$(dirname "$0")/../models" && pwd)"
HF_BASE="https://huggingface.co/mufasabrownie/glowlytics-skin-models/resolve/main"

echo "[download-models] Downloading ONNX models to $MODELS_DIR"

curl -fSL --progress-bar "$HF_BASE/structure_model.onnx" -o "$MODELS_DIR/structure.onnx"
echo "  ✓ structure.onnx"

curl -fSL --progress-bar "$HF_BASE/hydration_model.onnx" -o "$MODELS_DIR/hydration.onnx"
echo "  ✓ hydration.onnx"

curl -fSL --progress-bar "$HF_BASE/elasticity_model.onnx" -o "$MODELS_DIR/elasticity.onnx"
echo "  ✓ elasticity.onnx"

# Lesion detector — download .pt then export to ONNX if ultralytics is available
LESION_PT="$MODELS_DIR/lesion_yolov8_best.pt"
curl -fSL --progress-bar "$HF_BASE/lesion_yolov8_best.pt" -o "$LESION_PT"
echo "  ✓ lesion_yolov8_best.pt"

if command -v python3 &>/dev/null && python3 -c "import ultralytics" 2>/dev/null; then
  echo "[download-models] Exporting lesion detector to ONNX..."
  python3 -c "
from ultralytics import YOLO
model = YOLO('$LESION_PT')
model.export(format='onnx', imgsz=640, simplify=True)
"
  mv "$MODELS_DIR/lesion_yolov8_best.onnx" "$MODELS_DIR/lesion_detector.onnx" 2>/dev/null || true
  echo "  ✓ lesion_detector.onnx"
else
  echo "[download-models] ultralytics not installed — run ml/export_lesion_onnx.py manually"
fi

echo "[download-models] Done. Models in $MODELS_DIR:"
ls -lh "$MODELS_DIR"/*.onnx 2>/dev/null || echo "  (no .onnx files yet)"
