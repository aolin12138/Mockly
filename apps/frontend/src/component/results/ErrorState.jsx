import { XCircle } from 'lucide-react';

export default function ErrorState({ error, onRetry, onNavigate, navigateLabel = 'Start new interview' }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mb-6">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 border border-red-500/30 mb-4">
            <XCircle className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {error || 'Failed to load feedback'}
          </h1>
          <p className="text-slate-400">
            We encountered an error while processing your interview feedback. Please try again.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-5 py-2.5 text-sm font-medium hover:shadow-lg hover:shadow-emerald-500/25 cursor-pointer"
            >
              Retry
            </button>
          )}
          {onNavigate && (
            <button
              type="button"
              onClick={onNavigate}
              className="inline-flex items-center justify-center rounded-full border border-white/10 text-white px-5 py-2.5 text-sm font-medium hover:bg-white/5 cursor-pointer"
            >
              {navigateLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
