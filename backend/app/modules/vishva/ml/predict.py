import joblib

MODEL_PATH = "ml/models/best_model.joblib"
model = joblib.load(MODEL_PATH)

def predict_category(name: str, description: str = "") -> dict:
    text = f"{name} {description}"
    prediction = model.predict([text])[0]

    return {
        "name": name,
        "predicted_category": prediction
    }

if __name__ == "__main__":
    print(predict_category("MILKSHAKES - Chocolate"))
    print(predict_category("CRISPY RIPPLE STRIPES"))
