import { motion } from 'framer-motion';
import { Code2, ExternalLink, Trophy } from 'lucide-react';
import Card from './Card';
import ResourceLinks from './ResourceLinks';

const TYPE_ICONS = {
  open_source: Code2,
  side_project: ExternalLink,
  portfolio_piece: Trophy,
  course: ExternalLink,
  certification: Trophy,
};

const TYPE_COLORS = {
  open_source: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  side_project: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-300',
  portfolio_piece: 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20 text-violet-700 dark:text-violet-300',
  course: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300',
  certification: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300',
};

const TYPE_LABELS = {
  open_source: 'Open Source',
  side_project: 'Side Project',
  portfolio_piece: 'Portfolio',
  course: 'Course',
  certification: 'Certification',
};

export default function ProjectSuggestions({ projects }) {
  if (!Array.isArray(projects) || projects.length === 0) return null;

  return (
    <Card delay={0.28}>
      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
        <Code2 className="w-5 h-5 text-violet-600" />
        Project Suggestions
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
        Concrete projects to close the gaps above. Each one gives you something specific to talk about in your next interview.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project, idx) => {
          const TypeIcon = TYPE_ICONS[project.type] || ExternalLink;
          const typeColor = TYPE_COLORS[project.type] || TYPE_COLORS.side_project;
          const typeLabel = TYPE_LABELS[project.type] || project.type?.replace(/_/g, ' ') || 'Project';

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.06 * idx }}
              className="bg-white dark:bg-slate-800/20 border border-slate-200 dark:border-white/10 rounded-xl p-4 flex flex-col"
            >
              {/* Type badge */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${typeColor} flex items-center gap-1`}>
                  <TypeIcon className="w-3 h-3" />
                  {typeLabel}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                {project.title}
              </h3>

              {/* Why */}
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 flex-1 leading-relaxed">
                {project.why}
              </p>

              {/* Technologies */}
              {Array.isArray(project.technologies) && project.technologies.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {project.technologies.map((tech, ti) => (
                    <span
                      key={ti}
                      className="text-xs font-mono text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/10 rounded-md px-1.5 py-0.5"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              )}

              {/* Outcome */}
              {project.outcome && (
                <div className="mt-auto pt-3 border-t border-slate-200 dark:border-white/10">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                    <strong className="text-emerald-800 dark:text-emerald-300">After:</strong> {project.outcome}
                  </p>
                </div>
              )}

              {/* Real repos / tutorials matching this project */}
              <ResourceLinks resources={project.resources} label="Get started" compact />
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}
