import LogoMuted from '@/components/LogoMuted';
import { DashboardOrSignupButton } from '@/components/DashboardOrSignupButton';

export default function NotFound() {
  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <div className="text-center">
        <LogoMuted />
        <h1 className="text-xl font-semibold mb-2">Page not found</h1>
        <p className="text-muted-foreground mb-6">The page you're looking for doesn't exist.</p>
        <DashboardOrSignupButton />
      </div>
    </div>
  );
}
