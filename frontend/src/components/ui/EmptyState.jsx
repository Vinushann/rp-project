/**
 * Empty State Components
 * Beautiful illustrations for empty/no data states
 */
import { motion } from 'framer-motion';

export function EmptyState({ 
  icon = '📭',
  title = 'No data yet',
  description = 'Get started by adding some data',
  action,
  actionLabel
}) {
  return (
    <motion.div 
      className="flex flex-col items-center justify-center py-12 px-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div 
        className="text-6xl mb-4"
        animate={{ 
          y: [0, -10, 0],
          rotate: [0, -5, 5, 0]
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity,
          repeatType: 'reverse'
        }}
      >
        {icon}
      </motion.div>
      <h3 className="text-lg font-semibold text-gray-700 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm text-center max-w-sm mb-4">{description}</p>
      {action && (
        <button
          onClick={action}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
        >
          {actionLabel || 'Get Started'}
        </button>
      )}
    </motion.div>
  );
}

export function NoModelState({ onTrain }) {
  return (
    <EmptyState
      icon="🤖"
      title="No model trained yet"
      description="Train a machine learning model to start classifying menu items automatically"
      action={onTrain}
      actionLabel="Train Model"
    />
  );
}

export function NoDataState({ onExtract }) {
  return (
    <EmptyState
      icon="📋"
      title="No menu data"
      description="Extract menu data from a restaurant website to get started"
      action={onExtract}
      actionLabel="Extract Menu"
    />
  );
}

export function NoPredictionsState() {
  return (
    <EmptyState
      icon="🔮"
      title="No predictions yet"
      description="Upload a file or enter product names to classify them"
    />
  );
}

export function NoFeedbackState() {
  return (
    <EmptyState
      icon="💬"
      title="No corrections yet"
      description="Correct predictions in the Extract & Train tab to improve the model"
    />
  );
}

export default EmptyState;
