import { motion } from 'framer-motion';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Target } from 'lucide-react';
import { getScoreColor, formatDimensionName } from './helpers';
import CollapsibleSection from './CollapsibleSection';

function DimensionDetailCard({ dimension, index, maxScore }) {
  const score = Number(dimension.score || 0);
  const normalizedScore = (score / maxScore) * 10;
  const percentage = (score / maxScore) * 100;
  const colors = getScoreColor(normalizedScore);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay: 0.05 * index, duration: 0.3 }}
      className={`${colors.bg} border ${colors.border} rounded-2xl p-4`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-base font-medium text-slate-900">{formatDimensionName(dimension.dimension)}</span>
        <span className={`text-sm font-bold ${colors.text}`}>{score}/{maxScore}</span>
      </div>

      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-3">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${percentage}%` }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 + 0.05 * index, duration: 0.8, ease: 'easeOut' }}
          className={`h-full bg-gradient-to-r ${colors.gradient} shadow-lg`}
        />
      </div>

      {dimension.evidence && dimension.evidence.length > 0 && (
        <div className="space-y-2 mt-3">
          {dimension.evidence.map((ev, evIdx) => (
            <div key={evIdx} className="text-sm bg-white rounded-lg p-3 border border-slate-200">
              <p className="text-slate-700">
                <strong className="text-slate-900">Observation:</strong> {ev.observation}
              </p>
              {ev.reasoning && (
                <p className="text-slate-600 mt-1">
                  <strong className="text-slate-700">Reasoning:</strong> {ev.reasoning}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-slate-800">{data.dimension}</p>
      <p className="text-sm text-emerald-700 font-medium">{data.rawScore}/{data.maxScore}</p>
    </div>
  );
}

export default function DimensionRadar({ dimensionScores }) {
  if (!dimensionScores || dimensionScores.length === 0) return null;

  const maxDimensionScore = Math.max(...dimensionScores.map((d) => Number(d.score || 0)), 0);
  const maxScore = maxDimensionScore <= 5 ? 5 : 10;

  const radarData = dimensionScores.map((d) => ({
    dimension: formatDimensionName(d.dimension),
    score: ((Number(d.score || 0) / maxScore) * 10) || 0,
    rawScore: Number(d.score || 0),
    maxScore,
    fullMark: 10,
  }));

  return (
    <CollapsibleSection title="Skill Breakdown" icon={Target} defaultOpen={true} delay={0.25}>
      {/* Radar Chart */}
      {dimensionScores.length >= 3 && (
        <motion.div
          className="w-full mb-6"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="rgba(148, 163, 184, 0.12)" />
              <PolarAngleAxis
                dataKey="dimension"
                tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
                tickLine={false}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 10]}
                tick={false}
                axisLine={false}
              />
              <Radar
                name="Score"
                dataKey="score"
                stroke="#10b981"
                strokeWidth={2}
                fill="#10b981"
                fillOpacity={0.15}
                dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
              />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Detail Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {dimensionScores.map((dimension, idx) => (
          <DimensionDetailCard key={dimension.dimension || idx} dimension={dimension} index={idx} maxScore={maxScore} />
        ))}
      </div>
    </CollapsibleSection>
  );
}
