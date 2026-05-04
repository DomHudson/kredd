import LogoMuted from '@/components/LogoMuted';
import { DashboardOrSignupButton } from '@/components/DashboardOrSignupButton';

export default function TopicClosed() {
  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <div className="text-center">
        <LogoMuted />
        <h1 className="text-xl font-semibold mb-2">Closed</h1>
        <p className="text-muted-foreground mb-6">Sorry, this topic is no longer accepting submissions.</p>
        <DashboardOrSignupButton />
      </div>
    </div>
  );
}
