import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, ExternalLink, Check, Tag } from 'lucide-react';
import { copyLink } from '@/lib/utils';
import { useState } from 'react';
import { getTopics, setTopicClosed } from '@/lib/api';
import { Nav } from '@/components/Nav';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';
import { useTitle } from '@/lib/useTitle';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Topic } from '@/lib/types';

function TopicRow({ topic }: { topic: Topic }) {
  const isClosed = !!topic.closed_at;
  const [copiedId, setCopiedId] = useState(false);
  const queryClient = useQueryClient();

  const { mutate: toggleClosed, isPending } = useMutation<{ closed_at: string | null }, Error, boolean>({
    mutationFn: (closed: boolean) => setTopicClosed(topic.id, closed),
    onSuccess: (data) => {
      queryClient.setQueryData<Topic[]>(['topics'], (prev) =>
        prev?.map((t) => t.id === topic.id ? { ...t, closed_at: data.closed_at } : t)
      );
      toast.success(data.closed_at ? 'Topic closed.' : 'Topic reopened.');
    },
    onError: () => toast.error('Failed to update topic.'),
  });

  const copy = () => {
    copyLink(topic.url);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1800);
  };

  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(220px,2fr)_70px_repeat(3,minmax(80px,1fr))_minmax(220px,1.5fr)_140px] gap-4 px-5 py-4 border-b border-border last:border-b-0 items-center transition-colors',
        isClosed && 'bg-muted/20'
      )}
    >
      <div className="min-w-0">
        <div className={cn('font-medium text-foreground truncate', isClosed && 'text-muted-foreground')}>
          {topic.name}
        </div>
        {/* {<div className="text-xs text-muted-foreground truncate mt-0.5">
          {Description to go here}
        </div>} */}
      </div>
      <div className={cn('text-right tabular-nums font-medium ', isClosed ? 'text-muted-foreground' : 'text-foreground')}>
        {topic.outreach_count ?? 0}
      </div>
      <div className={cn('text-right tabular-nums font-medium ', isClosed ? 'text-muted-foreground' : 'text-score-green')}>
        {topic.stats?.strong_fit ?? 0}
      </div>
      <div className={cn('text-right tabular-nums font-medium ', isClosed ? 'text-muted-foreground' : 'text-score-amber')}>
        {topic.stats?.potential_fit ?? 0}
      </div>
      <div className={cn('text-right tabular-nums font-medium ', isClosed ? 'text-muted-foreground' : 'text-score-red')}>
        {topic.stats?.weak_fit ?? 0}
      </div>
      <div className="border border-border rounded-lg px-3 py-2 bg-background/60 flex items-center gap-2">
        <code className="text-[10px] font-mono text-muted-foreground truncate flex-1 min-w-0">
          {topic.url.replace(/^https?:\/\/(www\.)?/, '')}
        </code>
        <div className="w-px h-4 bg-border shrink-0" />
        <div className="flex items-center gap-1 shrink-0">
          <Tooltip content="Copy link">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={copy} disabled={isClosed}>
              {copiedId
                ? <Check className="w-3 h-3 text-score-green" />
                : <Copy className="w-3 h-3" />}
            </Button>
          </Tooltip>
          <Tooltip content="Open link">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              disabled={isClosed}
              onClick={() => window.open(topic.url, '_blank', 'noreferrer')}
            >
              <ExternalLink className="w-3 h-3" />
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-medium', isClosed ? 'text-muted-foreground' : 'text-score-green')}>
            {isClosed ? 'Closed' : 'Open'}
          </span>
          <Tooltip content="Close this topic to stop accepting new outreaches.">
            <span>
              <Switch
                checked={!isClosed}
                onCheckedChange={(checked) => toggleClosed(!checked)}
                disabled={isPending}
                aria-label="Toggle topic open"
              />
            </span>
          </Tooltip>
        </div>
        {isClosed && topic.closed_at && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {new Date(topic.closed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Topics() {
  useTitle('Topics');
  const { data: topics = [], isLoading } = useQuery({ queryKey: ['topics'], queryFn: getTopics });

  return (
    <div className="min-h-screen bg-background">
      <Nav titleText="Topics" />
      <main className="max-w-6xl mx-auto px-6 py-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">All topics</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Each topic has its own intake link. Close a topic to stop accepting new outreaches.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground tabular-nums">
              {topics.length} {topics.length === 1 ? 'topic' : 'topics'}
            </span>
            <Link to="/topics/create">
              <Button className="btn-glow" size="sm">+ New Topic</Button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-lg border border-border overflow-hidden bg-card">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 border-b border-border last:border-b-0 animate-pulse bg-muted/20" />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg py-16 flex flex-col items-center text-center">
            <Tag className="w-8 h-8 text-muted-foreground/40 mb-3" />
            <p className="text-foreground font-medium mb-1">No topics yet</p>
            <p className="text-sm text-muted-foreground mb-4">Create a topic to start collecting outreaches.</p>
            <Link to="/topics/create">
              <Button size="sm">Create topic</Button>
            </Link>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden bg-card">
            <div className="grid grid-cols-[minmax(220px,2fr)_70px_repeat(3,minmax(80px,1fr))_minmax(220px,1.5fr)_140px] gap-4 px-5 py-3 border-b border-border bg-muted/30 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              <div>Topic</div>
              <div className="text-right">Total</div>
              <div className="text-right text-score-green">Strong</div>
              <div className="text-right text-score-amber">Potential</div>
              <div className="text-right text-score-red">Weak</div>
              <div>Link</div>
              <div className="text-right">Status</div>
            </div>
            {topics.map((topic) => (
              <TopicRow key={topic.id} topic={topic} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
