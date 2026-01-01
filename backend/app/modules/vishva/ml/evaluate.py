import json
import joblib
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix

MODEL_PATH = "ml/models/best_model.joblib"
DATA_PATH = "data/menu_data.json"

model = joblib.load(MODEL_PATH)

with open(DATA_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

df = pd.DataFrame(data)
df["text"] = df["name"].fillna("") + " " + df["description"].fillna("")

X = df["text"]
y = df["category"]

preds = model.predict(X)

print("\n📊 CLASSIFICATION REPORT\n")
print(classification_report(y, preds))

print("\n🧩 CONFUSION MATRIX\n")
print(confusion_matrix(y, preds))
