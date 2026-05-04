import { useState } from 'react';
import { useTitle } from '@/lib/useTitle';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Paperclip, ChevronDown, ArrowUpDown, Filter, MessageCircleQuestionMark, ThumbsUp, ThumbsDown, User, Sparkles, X, MessageSquare } from 'lucide-react';
import { getTopics, getOutreaches, getOutreach, recordView, setFeedback } from '@/lib/api';
import type { Topic, OutreachSummary, OutreachDetail } from '@/lib/types';
import { Nav } from '@/components/Nav';
import { ScoreIndicator } from '@/components/ScoreIndicator';
import { ScoreBreakdown } from '@/components/ScoreBreakdown';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { cn, formatSize } from '@/lib/utils';
import { SCORE_GREEN_THRESHOLD, SCORE_AMBER_THRESHOLD } from '@/lib/constants';


type SortKey = 'date' | 'score-high' | 'score-low' | 'name';

const SORT_LABELS: Record<SortKey, string> = {
  date: 'Newest',
  'score-high': 'Score ↓',
  'score-low': 'Score ↑',
  name: 'Name A→Z',
};

function scoreGradient(score: number | null): string {
  if (score === null) return 'from-muted to-muted';
  if (score >= SCORE_GREEN_THRESHOLD) return 'from-score-green/20 to-score-green/5';
  if (score >= SCORE_AMBER_THRESHOLD) return 'from-score-amber/20 to-score-amber/5';
  return 'from-score-red/20 to-score-red/5';
}

export default function Home() {
  useTitle('Inbox');
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [filterBy, setFilterBy] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [openIsNew, setOpenIsNew] = useState(false);

  const queryClient = useQueryClient();

  const { data: topics = [] } = useQuery({ queryKey: ['topics'], queryFn: getTopics });
  const { data: outreaches = [], isLoading } = useQuery({ queryKey: ['outreaches'], queryFn: getOutreaches });
  const { data: detail } = useQuery({
    queryKey: ['outreach', openId],
    queryFn: () => getOutreach(openId!),
    enabled: openId !== null,
  });

  const feedbackMutation = useMutation({
    mutationFn: ({ value }: { value: boolean | null }) => setFeedback(openId!, value),
    onSuccess: (newFeedback) => {
      queryClient.setQueryData(['outreach', openId], (old: OutreachDetail | undefined) =>
        old ? { ...old, feedback: newFeedback } : old,
      );
      toast.success('Feedback saved.');
    },
    onError: () => toast.error('Failed to save feedback.'),
  });

  const handleFeedback = (value: boolean) => {
    if (!detail) return;
    const next = detail.feedback === value ? null : value;
    feedbackMutation.mutate({ value: next });
  };

  const openDrawer = (id: number, isNew: boolean) => {
    setOpenId(id);
    setOpenIsNew(isNew);
    queryClient.setQueryData(['outreaches'], (old: OutreachSummary[] | undefined) =>
      old ? old.map(o => o.id === id ? { ...o, is_unread: false } : o) : old,
    );
    recordView(id);
  };

  const filtered = outreaches
    .filter((o: OutreachSummary) => filterBy === null || o.topic.id === filterBy)
    .sort((a: OutreachSummary, b: OutreachSummary) => {
      if (sortBy === 'score-high') return (b.analysis?.score ?? -1) - (a.analysis?.score ?? -1);
      if (sortBy === 'score-low') return (a.analysis?.score ?? 101) - (b.analysis?.score ?? 101);
      if (sortBy === 'name') return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      return 0;
    });

  const scored = outreaches.filter((o: OutreachSummary) => o.analysis !== null);
  const avgScore = scored.length
    ? Math.round(scored.reduce((s: number, o: OutreachSummary) => s + (o.analysis?.score ?? 0), 0) / scored.length)
    : null;

  const isProcessed = detail?.analysis != null;

  return (
    <div className="h-svh flex flex-col bg-background">
      <Nav titleText='Inbox' />

      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Outreaches</span>
              <span className="ml-1.5 font-semibold text-foreground tabular-nums">{outreaches.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Avg Score</span>
              <span className="ml-1.5 font-semibold text-foreground tabular-nums">{avgScore ?? '—'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <ArrowUpDown className="w-3 h-3 mr-1" /> Sort: {SORT_LABELS[sortBy]} <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(([key, label]) => (
                  <DropdownMenuItem key={key} onClick={() => setSortBy(key)}
                    className={cn(sortBy === key && 'font-medium text-primary')}>{label}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Filter className="w-3 h-3 mr-1" />
                  {filterBy === null ? 'Filter' : topics.find((t: Topic) => t.id === filterBy)?.name}
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setFilterBy(null)} className={cn(filterBy === null && 'font-medium text-primary')}>
                  All
                </DropdownMenuItem>
                {topics.map((topic: Topic) => (
                  <DropdownMenuItem key={topic.id} onClick={() => setFilterBy(topic.id)}
                    className={cn(filterBy === topic.id && 'font-medium text-primary')}>
                    {topic.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">

        {/* List */}
        <div className={cn(
          "overflow-auto border-r border-border transition-all",
          openId ? "hidden md:block md:w-[30%] md:min-w-[280px]" : "flex-1"
        )}>
          {isLoading && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3.5 border-b border-border">
              <Skeleton className="h-6 w-6 rounded-full shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <p className="text-sm text-muted-foreground italic">
                No outreaches yet. Share your topic link to start receiving outreaches.
              </p>
            </div>
          )}
          {!isLoading && filtered.map((o: OutreachSummary) => (
            <button
              key={o.id}
              onClick={() => openDrawer(o.id, o.is_unread)}
              className={cn(
                "w-full flex items-start gap-3 px-4 py-3.5 border-b border-border hover:bg-muted/30 transition-colors text-left",
                openId === o.id && "bg-muted/40"
              )}
            >
              <div className="pt-0.5 shrink-0">
                <ScoreIndicator score={o.analysis?.score ?? null} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {o.is_unread && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] tracking-wider font-medium bg-accent text-accent-foreground shrink-0">New</span>
                  )}
                  <span className="text-sm font-semibold text-foreground truncate">
                    {o.first_name} {o.last_name}
                  </span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground truncate">{o.email}</span>
                </div>
                {o.analysis?.summary && (
                  <p className="text-xs text-muted-foreground truncate mb-1">{o.analysis.summary}</p>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider font-medium text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded">
                    {o.topic.name}
                  </span>
                  {o.attachment_count > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Paperclip className="w-2.5 h-2.5" />{o.attachment_count} {o.attachment_count === 1 ? 'attachment' : 'attachments'}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0 mt-0.5">{o.created_at}</span>
            </button>
          ))}
        </div>

        {/* Detail panel */}
        {openId !== null && (
          <div className="w-full md:w-[70%] overflow-auto bg-background animate-panel-in">
            {!detail ? (
              <>
                <div className="h-1.5 w-full bg-muted" />
                <div className="p-6 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
                </div>
              </>
            ) : (
              <>
                <div className={cn("h-1.5 w-full bg-linear-to-r", scoreGradient(isProcessed ? Math.round(detail.analysis!.score * 100) : null))} />

                {/* Sticky action bar — small screens only */}
                <div className="sticky top-0 z-20 flex justify-end items-center gap-1.5 px-4 py-2 bg-background/95 backdrop-blur-sm border-b border-border md:hidden">
                  <Tooltip content="Good outreach">
                    <button
                      onClick={() => handleFeedback(true)}
                      className={cn(
                        'flex items-center justify-center w-8 h-8 rounded-lg border transition-colors',
                        detail.feedback === true
                          ? 'bg-score-green/10 border-score-green text-score-green'
                          : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted',
                      )}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Poor outreach">
                    <button
                      onClick={() => handleFeedback(false)}
                      className={cn(
                        'flex items-center justify-center w-8 h-8 rounded-lg border transition-colors',
                        detail.feedback === false
                          ? 'bg-destructive/10 border-destructive text-destructive'
                          : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted',
                      )}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                  <button
                    onClick={() => setOpenId(null)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all ml-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 max-w-4xl mx-auto">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                        {detail.first_name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-2xl font-bold text-foreground tracking-tight">{detail.first_name} {detail.last_name}</h2>
                          {openIsNew && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] tracking-wider font-medium bg-accent text-accent-foreground">New</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{detail.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs uppercase tracking-wider font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                            {detail.topic.name}
                          </span>
                          <span className="text-xs text-muted-foreground">{detail.created_at}</span>
                        </div>
                      </div>
                    </div>
                    {/* Inline action buttons — md+ only */}
                    <div className="hidden md:flex items-center gap-1.5">
                      <Tooltip content="Good outreach">
                        <button
                          onClick={() => handleFeedback(true)}
                          className={cn(
                            'flex items-center justify-center w-8 h-8 rounded-lg border transition-colors',
                            detail.feedback === true
                              ? 'bg-score-green/10 border-score-green text-score-green'
                              : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted',
                          )}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                      <Tooltip content="Poor outreach">
                        <button
                          onClick={() => handleFeedback(false)}
                          className={cn(
                            'flex items-center justify-center w-8 h-8 rounded-lg border transition-colors',
                            detail.feedback === false
                              ? 'bg-destructive/10 border-destructive text-destructive'
                              : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted',
                          )}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                      <button
                        onClick={() => setOpenId(null)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all ml-1"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-6">
                      <ScoreBreakdown analysis={detail.analysis} />

                      <div className="rounded-xl border border-border p-5 bg-card">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-4 h-4 text-primary" />
                          <h3 className="text-sm font-semibold text-foreground">AI Summary</h3>
                        </div>
                        {isProcessed && detail.analysis!.summary ? (
                          <p className="text-sm text-foreground/80 leading-relaxed">{detail.analysis!.summary}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">No summary available.</p>
                        )}
                        {isProcessed && detail.analysis!.follow_ups && detail.analysis!.follow_ups.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-border">
                            <p className="text-xs font-medium text-muted-foreground mb-2">Suggested follow-ups</p>
                            <ul className="space-y-1.5">
                              {detail.analysis!.follow_ups.map(f => (
                                <li key={f.id} className="text-xs text-foreground/70 flex gap-2">
                                  <MessageCircleQuestionMark className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                                  <span>{f.text}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="rounded-xl border border-border p-5 bg-card">
                        <div className="flex items-center gap-2 mb-3">
                          <User className="w-4 h-4 text-primary" />
                          <h3 className="text-sm font-semibold text-foreground">Contact</h3>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Name</span>
                            <span className="text-sm font-medium text-foreground">{detail.first_name} {detail.last_name}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Email</span>
                            <a href={`mailto:${detail.email}`} className="text-sm font-medium text-primary hover:underline">{detail.email}</a>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">LinkedIn</span>
                            {detail.linkedin_url ? (
                              <a href={detail.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline truncate max-w-[60%] text-right">{detail.linkedin_url}</a>
                            ) : (
                              <span className="text-sm text-muted-foreground italic">None provided</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {detail.attachments.length > 0 && (
                        <div className="rounded-xl border border-border p-5 bg-card">
                          <div className="flex items-center gap-2 mb-3">
                            <Paperclip className="w-4 h-4 text-primary" />
                            <h3 className="text-sm font-semibold text-foreground">Attachments</h3>
                          </div>
                          <div className="space-y-2">
                            {detail.attachments.map(a => (
                              <a
                                key={a.id}
                                href={`/api/outreaches/${detail.id}/attachments/${a.id}/`}
                                className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors"
                              >
                                <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                                <span className="font-medium text-xs text-foreground">{a.filename}</span>
                                <span className="text-xs text-muted-foreground ml-auto">({formatSize(a.file_size)})</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border p-5 bg-card">
                    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" /> Responses</h3>
                    {detail.responses.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No responses recorded.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {detail.responses.map(r => (
                          <div key={r.question_id} className="rounded-lg border border-border p-3 bg-background">
                            <p className="text-xs font-semibold text-foreground mb-1.5">{r.text}</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {r.response || <span className="italic">Left blank</span>}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
