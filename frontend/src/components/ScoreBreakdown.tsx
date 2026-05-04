import { BarChart3 } from 'lucide-react';
import { ScoreIndicator } from '@/components/ScoreIndicator';
import { SCORE_GREEN_THRESHOLD, SCORE_AMBER_THRESHOLD } from '@/lib/constants';
import type { OutreachAnalysis } from '@/lib/types';

const CATEGORIES: { label: string; desc: string; key: keyof Pick<OutreachAnalysis, 'relevance_score' | 'completeness_score' | 'credibility_score'> }[] = [
  { label: 'Relevance', desc: 'How well the pitch aligns with your priorities', key: 'relevance_score' },
  { label: 'Completeness', desc: 'Depth and thoroughness of responses', key: 'completeness_score' },
  { label: 'Credibility', desc: 'Evidence of track record and proof points', key: 'credibility_score' },
];

function barColor(value: number): string {
  if (value >= SCORE_GREEN_THRESHOLD) return 'bg-score-green';
  if (value >= SCORE_AMBER_THRESHOLD) return 'bg-score-amber';
  return 'bg-score-red';
}

interface Props {
  analysis: OutreachAnalysis | null;
}

export function ScoreBreakdown({ analysis }: Props) {
  const overallScore = analysis ? Math.round(analysis.score * 100) : null;

  return (
    <div className="rounded-xl border border-border p-5 bg-card">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Score Breakdown</h3>
      </div>
      <div className="flex items-center gap-4 mb-5">
        <ScoreIndicator score={overallScore} size="md" />
      </div>
      <div className="space-y-3">
        {CATEGORIES.map((item) => {
          const value = analysis ? Math.round(analysis[item.key] * 100) : null;
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-foreground">{item.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {value !== null ? value : '—'}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${value !== null ? barColor(value) : 'bg-muted'}`}
                  style={{ width: value !== null ? `${value}%` : '0%' }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
