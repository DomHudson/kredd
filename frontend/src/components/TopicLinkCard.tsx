import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { copyLink } from '@/lib/utils';

interface Props {
  name: string;
  url: string;
}

export function TopicLinkCard({ name, url }: Props) {
  return (
    <div className="border border-border rounded-xl p-4 bg-card flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground mb-1">{name}</p>
        <code className="text-xs font-mono text-muted-foreground truncate block">
          {url}
        </code>
      </div>
      <Tooltip content="Copy link">
        <Button variant="outline" size="sm" onClick={() => copyLink(url)}>
          <Copy className="w-3.5 h-3.5" />
        </Button>
      </Tooltip>
    </div>
  );
}
