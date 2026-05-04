import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { useTitle } from '@/lib/useTitle';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Logo from '@/components/Logo';
import { confirmPasswordReset, requestPasswordReset, validatePasswordResetToken } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthPageGlow from '@/components/AuthPageGlow';

const INVALID_MESSAGE = 'Invalid or expired link.';

function Shell({ headerText, children }: { headerText: string; children: ReactNode }) {
  return (
    <div className="min-h-svh flex items-center justify-center px-6 relative overflow-hidden">
      <AuthPageGlow />
      <div className="relative z-1 w-full max-w-sm bg-card border border-border rounded-xl p-8 shadow-xs">
        <div className="flex items-center justify-center mb-6">
          <Logo large />
        </div>
        <h2 className="text-center text-xl mb-6">{headerText}</h2>
        {children}
      </div>
    </div>
  );
}

function RequestForm() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await requestPasswordReset(fd.get('email') as string);
    } catch {
      // Intentionally ignore — response is always generic.
    } finally {
      setSubmitted(true);
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Shell headerText="Reset Your Password">
        <p className="text-sm text-muted-foreground text-center">If an account exists for that email, we've sent a password reset link.</p>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary hover:underline">Back to login</Link>
        </p>
      </Shell>
    );
  }

  return (
    <Shell headerText="Reset Your Password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="you@example.com" required autoFocus autoComplete="email" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Requesting…' : 'Request Email'}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link to="/login" className="text-primary hover:underline">Log in</Link>
      </p>
    </Shell>
  );
}

function ConfirmForm({ token }: { token: string }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ok = await validatePasswordResetToken(token);
        if (!cancelled) setValid(ok);
      } catch {
        if (!cancelled) setValid(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

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
      await confirmPasswordReset(token, password);
      navigate('/login');
    } catch (err) {
      setError(INVALID_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return <Shell headerText="Reset Your Password"><p className="text-sm text-muted-foreground text-center">Checking link…</p></Shell>;
  }

  if (!valid) {
    return (
      <Shell headerText="Reset Your Password">
        <p className="text-sm text-muted-foreground text-center">{INVALID_MESSAGE}</p>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          <Link to="/resetpassword" className="text-primary hover:underline">Request a new link</Link>
        </p>
      </Shell>
    );
  }

  return (
    <Shell headerText="Choose a new password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password1">New Password</Label>
          <Input id="password1" name="password1" type="password" placeholder="••••••••" required autoFocus autoComplete="new-password" />
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
          {loading ? 'Updating…' : 'Update Password'}
        </Button>
      </form>
    </Shell>
  );
}

export default function ResetPassword() {
  useTitle('Reset Password');
  const [params] = useSearchParams();
  const token = params.get('token');
  return token ? <ConfirmForm token={token} /> : <RequestForm />;
}
