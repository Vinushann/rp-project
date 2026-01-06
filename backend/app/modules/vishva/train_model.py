from tools import train_category_classifier
import sys

def main():
    print("="*70)
    print("🚀 MENU CATEGORY CLASSIFIER - MODEL TRAINING")
    print("="*70)
    
    # Use the cleaned menu data as training data
    training_file = "output/menu_data.json"
    
    print(f"\n📖 Using training file: {training_file}")
    print("⏳ This may take a few minutes...\n")
    
    # Train
    result = train_category_classifier(training_file, output_dir="models")
    
    # Show final result
    print("\n" + "="*70)
    if result["success"]:
        print("✅ TRAINING COMPLETED SUCCESSFULLY")
        print("="*70)
        print(f"\n🎯 Best Model: {result['best_model']['name']}")
        print(f"📊 Accuracy: {result['best_model']['accuracy']:.2%}")
        print(f"📊 F1-Score: {result['best_model']['f1_score']:.4f}")
        print(f"📁 Model saved: {result['model_file']}")
        print(f"🔢 Total configurations tested: {result['total_models_tested']}")
        print(f"📋 Categories: {len(result['categories'])}")
        print(f"📊 Training samples: {result['n_samples']}")
    else:
        print("❌ TRAINING FAILED")
        print("="*70)
        print(f"\nError: {result['message']}")
        sys.exit(1)
    
    print("\n" + "="*70)
    print("🏁 Training complete!")
    print("="*70)

if __name__ == "__main__":
    main()