from tools import train_category_classifier
import sys
import os

def main():
    print("="*70)
    print("MENU CATEGORY CLASSIFIER - MODEL TRAINING")
    print("="*70)
    
    # Use the cleaned menu data as training data
    script_dir = os.path.dirname(os.path.abspath(__file__))
    training_file = os.path.join(script_dir, "output", "menu_data.json")
    models_dir = os.path.join(script_dir, "models")
    
    print(f"\nUsing training file: {training_file}")
    print("This may take a few minutes...\n")
    
    # Train
    result = train_category_classifier(training_file, output_dir=models_dir)
    
    # Show final result
    print("\n" + "="*70)
    if result["success"]:
        print("TRAINING COMPLETED SUCCESSFULLY")
        print("="*70)
        print(f"\nBest Model: {result['best_model']['name']}")
        print(f"Accuracy: {result['best_model']['accuracy']:.2%}")
        print(f"F1-Score: {result['best_model']['f1_score']:.4f}")
        print(f"Model saved: {result['model_file']}")
        print(f"Total configurations tested: {result['total_models_tested']}")
        print(f"Categories: {len(result['categories'])}")
        print(f"Training samples: {result['n_samples']}")
    else:
        print("TRAINING FAILED")
        print("="*70)
        print(f"\nError: {result['message']}")
        sys.exit(1)
    
    print("\n" + "="*70)
    print("Training complete!")
    print("="*70)

if __name__ == "__main__":
    main()