/**
 * Skeleton Loading Components
 * Animated placeholder for loading states
 */

export function Skeleton({ className = '', variant = 'default' }) {
  const baseClasses = 'animate-pulse bg-gray-200 rounded';
  
  const variants = {
    default: 'h-4 w-full',
    title: 'h-6 w-3/4',
    text: 'h-4 w-full',
    avatar: 'h-10 w-10 rounded-full',
    button: 'h-10 w-24 rounded-lg',
    card: 'h-32 w-full rounded-xl',
    table: 'h-12 w-full',
  };

  return (
    <div className={`${baseClasses} ${variants[variant]} ${className}`} />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
      <Skeleton variant="title" />
      <Skeleton className="h-4 w-1/2" />
      <div className="space-y-2">
        <Skeleton />
        <Skeleton className="w-5/6" />
        <Skeleton className="w-4/6" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full bg-gray-100" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="table" />
      ))}
    </div>
  );
}

export function SkeletonList({ items = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <Skeleton variant="avatar" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl p-4 border space-y-2">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
