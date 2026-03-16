# RadianceIQ ML Pipeline

Fine-tune and evaluate vision models for skin health scoring.

## Setup (Google Colab)

1. Upload this `ml/` folder to Google Drive
2. Open each notebook in Google Colab
3. Set runtime to GPU (T4 or A100 recommended for MedGemma)
4. Run notebooks in order: 01 → 02 → 03 → 04

## Notebooks

| Notebook | Purpose |
|----------|---------|
| `01_data_preparation.ipynb` | Download and preprocess Fitzpatrick17k, ISIC, PAD-UFES-20 datasets |
| `02_gpt4o_finetune.ipynb` | Fine-tune GPT-4o on labeled skin images |
| `03_medgemma_finetune.ipynb` | Fine-tune MedGemma with LoRA/QLoRA |
| `04_evaluation.ipynb` | Compare models: MAE, consistency, latency, cost |

## Output Schema

All models produce:
```json
{
  "acne_score": 0-100,
  "sun_damage_score": 0-100,
  "skin_age_score": 0-100,
  "confidence": "low" | "med" | "high",
  "primary_driver": "string",
  "recommended_action": "string"
}
```

## Dependencies

```bash
pip install -r requirements.txt
```

Set `OPENAI_API_KEY` environment variable for GPT-4o fine-tuning notebook.
