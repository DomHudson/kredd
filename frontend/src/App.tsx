import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip';
import { useQuery } from '@tanstack/react-query';
import { getMe } from '@/lib/api';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import CreateTopic from './pages/CreateTopic';
import CreateOutreach from './pages/CreateOutreach';
import EditProfile from './pages/EditProfile';
import ResetPassword from './pages/ResetPassword';
import Onboarding from './pages/Onboarding';
import Admin from './pages/Admin';
import Topics from './pages/Topics';
import NotFound from './pages/NotFound';
import { useMaintenance } from './hooks/useMaintenance';
import { ReactNode } from 'react';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } },
});

function RequireAuth({ children }: { children: ReactNode }) {
  const { data: user, isLoading, isError } = useQuery({ queryKey: ['me'], queryFn: getMe });
  if (isLoading) return null;
  if (isError || !user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireGuest({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useQuery({ queryKey: ['me'], queryFn: getMe });
  if (isLoading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireAuthAndOnboarded({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useQuery({ queryKey: ['me'], queryFn: getMe });
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_onboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function RequireAuthAndNotOnboarded({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useQuery({ queryKey: ['me'], queryFn: getMe });
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.is_onboarded) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireAuthAndStaff({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useQuery({ queryKey: ['me'], queryFn: getMe });
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_staff) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function MaintenancePoller() {
  useMaintenance();
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
      <Toaster position="bottom-right" />
      <BrowserRouter>
        <MaintenancePoller />
        <Routes>
          // Public routes.
          <Route path="*" element={<NotFound />} />
          <Route path="/login" element={<RequireGuest><Login /></RequireGuest>} />
          <Route path="/signup" element={<RequireGuest><Signup /></RequireGuest>} />
          <Route path="/resetpassword" element={<RequireGuest><ResetPassword /></RequireGuest>} />
          <Route path="/contact/:urlSuffix" element={<CreateOutreach />} />

          // Allowed during onboarding.
          <Route path="/onboarding" element={<RequireAuthAndNotOnboarded><Onboarding /></RequireAuthAndNotOnboarded>} />
          <Route path="/profile/edit" element={<RequireAuth><EditProfile /></RequireAuth>} />

          // Must be logged in & onboarded.
          <Route path="/" element={<RequireAuthAndOnboarded><Home /></RequireAuthAndOnboarded>} />
          <Route path="/topics" element={<RequireAuthAndOnboarded><Topics /></RequireAuthAndOnboarded>} />
          <Route path="/topics/create" element={<RequireAuthAndOnboarded><CreateTopic /></RequireAuthAndOnboarded>} />

          // Must be logged in & staff.
          <Route path="/admin" element={<RequireAuthAndStaff><Admin /></RequireAuthAndStaff>} />
        </Routes>
      </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
