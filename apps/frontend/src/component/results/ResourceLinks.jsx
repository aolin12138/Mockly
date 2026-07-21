import { ExternalLink } from 'lucide-react';

/**
 * Renders a compact list of web resources (GitHub repos, tutorials, courses)
 * inline within a feedback section. Used inside ProjectSuggestions, GapAnalysis,
 * and InterviewTips so resources appear next to the feedback they support.
 */

// Map a URL to a short source label + accent (github, youtube, docs, etc.)
function sourceMeta(url = '') {
  const u = url.toLowerCase();
  if (u.includes('github.com')) return { label: 'GitHub', cls: 'text-slate-700 dark:text-slate-300' };
  if (u.includes('youtube.com') || u.includes('youtu.be')) return { label: 'YouTube', cls: 'text-red-600 dark:text-red-400' };
  if (u.includes('coursera') || u.includes('udemy') || u.includes('edx') || u.includes('linkedin.com/learning')) return { label: 'Course', cls: 'text-sky-600 dark:text-sky-400' };
  if (u.includes('arxiv.org')) return { label: 'Paper', cls: 'text-amber-600 dark:text-amber-400' };
  if (u.includes('medium.com') || u.includes('dev.to') || u.includes('substack') || u.includes('blog')) return { label: 'Article', cls: 'text-emerald-600 dark:text-emerald-400' };
  try { return { label: new URL(url).hostname.replace(/^www\./, ''), cls: 'text-slate-500 dark:text-slate-400' }; }
  catch { return { label: 'Link', cls: 'text-slate-500 dark:text-slate-400' }; }
}

export default function ResourceLinks({ resources, label = 'Resources', compact = false }) {
  if (!resources || resources.length === 0) return null;

  return (
    <div className={compact ? 'mt-3' : 'mt-4'}>
      <div className="flex items-center gap-1.5 mb-2">
        <ExternalLink className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <div className="space-y-1.5">
        {resources.map((r, i) => {
          const meta = sourceMeta(r.url);
          return (
            <a
              key={i}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 px-3 py-2 hover:border-emerald-500/40 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
            >
              <span className={`text-[10px] font-bold uppercase mt-0.5 flex-shrink-0 ${meta.cls}`}>{meta.label}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-medium text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">{r.title}</span>
                {!compact && r.snippet && (
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{r.snippet}</span>
                )}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
