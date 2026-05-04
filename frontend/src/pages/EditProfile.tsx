import { FormEvent, useEffect, useState } from 'react';
import { useTitle } from '@/lib/useTitle';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMe, updateMe } from '@/lib/api';
import { Nav } from '@/components/Nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function EditProfile() {
  useTitle('Edit Profile');

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: getMe });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name ?? '');
      setLastName(user.last_name ?? '');
    }
  }, [user]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const newPassword = fd.get('new_password') as string;
    const confirmPassword = fd.get('confirm_password') as string;
    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      setLoading(false);
      return;
    }
    try {
      await updateMe(
        firstName,
        lastName,
        fd.get('current_password') as string,
        newPassword,
      );
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-svh bg-background">
      <Nav titleText='Edit Profile' />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold mb-1">Edit Profile</h1>
        <p className="text-muted-foreground text-sm mb-8">Update your name or password.</p>
        <form onSubmit={handleSubmit} className="space-y-8">

          <div className="bg-card border border-border rounded-xl p-6 space-y-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Account</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  placeholder="Jane"
                  required
                  autoComplete="given-name"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  placeholder="Smith"
                  required
                  autoComplete="family-name"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email ?? ''} disabled title="Email cannot be changed" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 space-y-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Change Password</h2>
            <p className="text-xs text-muted-foreground -mt-2">Leave blank to keep your current password.</p>
            <div className="space-y-1.5">
              <Label htmlFor="current_password">Current Password</Label>
              <Input id="current_password" name="current_password" type="password" placeholder="••••••••" autoComplete="current-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new_password">New Password</Label>
              <Input id="new_password" name="new_password" type="password" placeholder="••••••••" autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm_password">Confirm New Password</Label>
              <Input id="confirm_password" name="confirm_password" type="password" placeholder="••••••••" autoComplete="new-password" />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => navigate('/')}>Cancel</Button>
            <Button className="btn-glow" type="submit" disabled={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
