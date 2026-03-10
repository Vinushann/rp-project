#!/bin/bash
# Quick script to train the KPI preference model

echo "🚀 Training KPI Preference Model..."
echo ""

# Train the model
RESPONSE=$(curl -s -X POST http://localhost:8000/ayathma/kpi/train)

# Check if successful
if echo "$RESPONSE" | grep -q "n_examples"; then
    echo "✅ Training successful!"
    echo ""
    echo "$RESPONSE" | python3 -m json.tool
    echo ""
    echo "📊 Model saved and ready to use!"
else
    echo "❌ Training failed!"
    echo "$RESPONSE"
    exit 1
fi
