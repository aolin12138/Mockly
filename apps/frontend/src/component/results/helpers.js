/* --- Score color helpers --- */

export function getScoreColor(score) {
  if (score >= 7) {
    return {
      text: 'text-emerald-700 dark:text-emerald-300',
      gradient: 'from-emerald-500 to-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-500/5',
      border: 'border-emerald-200 dark:border-emerald-500/20',
      arc: '#10b981',
    };
  }
  if (score >= 5) {
    return {
      text: 'text-amber-700 dark:text-amber-300',
      gradient: 'from-amber-500 to-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-500/5',
      border: 'border-amber-200 dark:border-amber-500/20',
      arc: '#f59e0b',
    };
  }
  return {
    text: 'text-red-700 dark:text-red-300',
    gradient: 'from-red-500 to-red-400',
    bg: 'bg-red-50 dark:bg-red-500/5',
    border: 'border-red-200 dark:border-red-500/20',
    arc: '#ef4444',
  };
}

export function getRecommendationColor(recommendation) {
  switch (recommendation) {
    case 'strong_hire':
      return { bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', label: 'Strong Hire' };
    case 'hire':
      return { bg: 'bg-sky-50 dark:bg-sky-500/10', border: 'border-sky-200 dark:border-sky-500/20', text: 'text-sky-700 dark:text-sky-300', label: 'Hire' };
    case 'neutral':
      return { bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20', text: 'text-amber-700 dark:text-amber-300', label: 'Neutral' };
    case 'no_hire':
      return { bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/20', text: 'text-red-700 dark:text-red-300', label: 'No Hire' };
    default:
      return { bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-white/10', text: 'text-slate-700 dark:text-slate-300', label: recommendation };
  }
}

export function formatTime(seconds) {
  if (seconds == null) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatDimensionName(name) {
  if (!name || typeof name !== 'string') return 'Unknown';
  return name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
