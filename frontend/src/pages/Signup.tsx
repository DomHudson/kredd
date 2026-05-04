import { FormEvent, useState } from 'react';
import { useTitle } from '@/lib/useTitle';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '@/components/Logo';
import { useQueryClient } from '@tanstack/react-query';
import { signup } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthPageGlow from '@/components/AuthPageGlow';

export default function Signup() {
  useTitle('Signup');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);
    const password = fd.get('password1') as string;
    if (password !== fd.get('password2')) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await signup(
        fd.get('first_name') as string,
        fd.get('last_name') as string,
        fd.get('email') as string,
        password,
      );
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      navigate('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-svh flex items-center justify-center px-6 relative overflow-hidden">
      <AuthPageGlow />
      <div className="relative z-1 w-full max-w-sm bg-card border border-border rounded-xl p-8 shadow-xs">
        <div className="flex items-center justify-center mb-6">
          <Logo large />
        </div>
        <h2 className="text-center text-xl mb-6">Create your account</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first_name">First Name</Label>
              <Input id="first_name" name="first_name" placeholder="Jane" required autoFocus autoComplete="given-name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name">Last Name</Label>
              <Input id="last_name" name="last_name" placeholder="Smith" required autoComplete="family-name" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" required autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password1">Password</Label>
            <Input id="password1" name="password1" type="password" placeholder="••••••••" required autoComplete="new-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password2">Confirm Password</Label>
            <Input id="password2" name="password2" type="password" placeholder="••••••••" required autoComplete="new-password" />
          </div>
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Create Account'}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
