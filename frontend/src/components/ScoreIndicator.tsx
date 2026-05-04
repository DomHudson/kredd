import { cn } from '@/lib/utils';
import { SCORE_GREEN_THRESHOLD, SCORE_AMBER_THRESHOLD } from '@/lib/constants';

interface ScoreIndicatorProps {
  score: number | null;
  size?: 'sm' | 'md';
}

function scoreLabel(pct: number): string {
  if (pct >= SCORE_GREEN_THRESHOLD) return 'Strong fit';
  if (pct >= SCORE_AMBER_THRESHOLD) return 'Potential fit';
  return 'Weak fit';
}

export function ScoreIndicator({ score, size = 'sm' }: ScoreIndicatorProps) {
  if (score === null) {
    return (
      <span className={cn('text-muted-foreground italic', size === 'sm' ? 'text-xs' : 'text-sm')}>
        Pending
      </span>
    );
  }

  const pct = score;
  const color = pct >= SCORE_GREEN_THRESHOLD ? 'bg-score-green' : pct >= SCORE_AMBER_THRESHOLD ? 'bg-score-amber' : 'bg-score-red';
  const textColor = pct >= SCORE_GREEN_THRESHOLD ? 'text-score-green' : pct >= SCORE_AMBER_THRESHOLD ? 'text-score-amber' : 'text-score-red';

  if (size === 'md') {
    return (
      <div className="flex items-center gap-3">
        <div>
          <p className={cn('text-2xl font-bold tabular-nums', textColor)}>
            {pct}<span className="text-sm text-muted-foreground font-normal"> / 100</span>
          </p>
          <p className="text-xs text-muted-foreground">{scoreLabel(pct)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className={cn('rounded-full shrink-0', color, 'w-2 h-2')} />
      <span className={cn('tabular-nums font-medium text-sm', textColor)}>
        {pct}
      </span>
    </div>
  );
}
