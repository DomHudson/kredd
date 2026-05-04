import AuthPageGlow from '@/components/AuthPageGlow';
import Logo from '@/components/Logo';
import { useMaintenance } from '@/hooks/useMaintenance';

export default function Maintenance() {
  useMaintenance();

  return (
    <div className="min-h-svh flex items-center justify-center px-6 relative overflow-hidden">
      <AuthPageGlow />
      <div className="relative z-1 w-full max-w-sm bg-card border border-border rounded-xl p-8 shadow-xs text-center">
        <div className="flex items-center justify-center mb-6">
          <Logo large />
        </div>
        <h2 className="text-xl font-semibold mb-2">Planned Maintenance</h2>
        <p className="text-sm text-muted-foreground">
          We're making some improvements. Please check back shortly.
        </p>
      </div>
    </div>
  );
}
