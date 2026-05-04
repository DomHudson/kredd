import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMe } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function DashboardOrSignupButton() {
  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: getMe });

  if (currentUser) {
    return (
      <Link to="/"><Button variant="outline" size="sm">Go to dashboard</Button></Link>
    );
  }

  return (
    <Link to="/signup"><Button variant="outline" size="sm">Create your own Kredd →</Button></Link>
  );
}
