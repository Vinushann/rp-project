from tools import predict_categories
import sys
import os

def main():
    print("="*70)
    print("🔮 MENU CATEGORY PREDICTOR")
    print("="*70)
    
    # Check if model exists
    if not os.path.exists("models/best_model.pkl"):
        print("\n❌ Error: No trained model found!")
        print("   Please train the model first using: python train_model.py")
        sys.exit(1)
    
    # You can either:
    # 1. Provide a JSON file with items to categorize
    # 2. Provide items as a list
    
    # Option 1: Use a JSON file
    input_file = "data/new_menu_items.json"  # Your new items to categorize
    
    # If file doesn't exist, create a sample
    if not os.path.exists(input_file):
        print(f"\n⚠️  Input file not found: {input_file}")

    else:
        # Predict using file
        result = predict_categories(
            items=input_file,
            model_dir="models",
            output_file="output/predictions.json"
        )
    
    # Show final result
    print("\n" + "="*70)
    if result["success"]:
        print("✅ PREDICTION COMPLETED SUCCESSFULLY")
        print("="*70)
        print(f"\n📊 Statistics:")
        print(f"   Total items: {result['statistics']['total_items']}")
        print(f"   Average confidence: {result['statistics']['average_confidence']:.2%}")
        print(f"   Output: {result['output_file']}")
    else:
        print("❌ PREDICTION FAILED")
        print("="*70)
        print(f"\nError: {result['message']}")
        sys.exit(1)
    
    print("\n" + "="*70)
    print("🏁 Prediction complete!")
    print("="*70)

if __name__ == "__main__":
    main()