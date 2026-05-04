import { Zap } from 'lucide-react';

export default function Logo({ large = false }: { large?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Zap className={`${large ? 'w-5 h-5' : 'w-4 h-4'} text-primary`} />
      <span className={`font-bold gradient-text${large ? ' text-lg' : ''}`}>Kredd</span>
    </div>
  );
}
