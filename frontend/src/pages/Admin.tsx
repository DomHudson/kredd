import { useState } from 'react';
import { useTitle } from '@/lib/useTitle';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { HatGlasses, CircleCheck, CircleX, UserRoundCheck, UserRoundX, Filter, ChevronDown, ShieldAlert, ShieldOff, LogOut } from 'lucide-react';
import { getAdminUsers, getMe, impersonate, setUserActive, setUserStaff, forceLogout, type AdminUser } from '@/lib/api';
import { toast } from 'sonner';
import { Nav } from '@/components/Nav';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

type UsersFilter = 'all' | 'active' | 'deactivated' | 'staff' | 'standard';

const USERS_FILTER_LABELS: Record<UsersFilter, string> = {
  all: 'All',
  active: 'Active',
  deactivated: 'Deactivated',
  staff: 'Staff',
  standard: 'Standard Users',
};

export default function Admin() {
  useTitle('Admin');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [usersFilter, setUsersFilter] = useState<UsersFilter>('active');
  const { data: users, isLoading } = useQuery({ queryKey: ['admin', 'users'], queryFn: getAdminUsers });
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe });

  const handleImpersonate = async (userId: number) => {
    await impersonate(userId);
    queryClient.clear();
    navigate('/');
  };

  const handleSetActive = async (userId: number, active: boolean) => {
    await setUserActive(userId, active);
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    toast.success(active ? 'User activated.' : 'User deactivated.');
  };

  const handleSetStaff = async (userId: number, staff: boolean) => {
    await setUserStaff(userId, staff);
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    toast.success(staff ? 'Staff access granted.' : 'Staff access revoked.');
  };

  const handleForceLogout = async (userId: number) => {
    await forceLogout(userId);
    toast.success('User sessions invalidated.');
  };

  const filteredUsers = (users ?? []).filter((user: AdminUser) => {
    if (usersFilter === 'active') return user.is_active;
    if (usersFilter === 'deactivated') return !user.is_active;
    if (usersFilter === 'staff') return user.is_staff;
    if (usersFilter === 'standard') return !user.is_staff;
    return true;
  });

  return (
    <div className="min-h-svh flex flex-col bg-background">
      <Nav titleText='Admin' />

      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="text-muted-foreground">Users</span>
            <span className="ml-1.5 font-semibold text-foreground tabular-nums">{(users ?? []).length}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Filter className="w-3 h-3 mr-1" /> {USERS_FILTER_LABELS[usersFilter as UsersFilter]} <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {(Object.entries(USERS_FILTER_LABELS) as [UsersFilter, string][]).map(([key, label]) => (
                <DropdownMenuItem key={key} onClick={() => setUsersFilter(key)}
                  className={cn(usersFilter === key && 'font-medium text-primary')}>{label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-sm text-muted-foreground italic">Loading...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-sm text-muted-foreground italic">No users.</p>
          </div>
        ) : filteredUsers.map((user) => (
          <div key={user.id} className="flex items-start gap-3 px-4 py-3.5 border-b border-border hover:bg-muted/30 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                {user.is_staff && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] tracking-wider font-medium bg-accent text-accent-foreground shrink-0">Staff</span>
                )}
                <span className="text-sm font-semibold text-foreground truncate">
                  {user.first_name} {user.last_name}
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground truncate">{user.email}</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-muted-foreground">Joined {formatDate(user.date_joined)}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">Last login {formatDate(user.last_login)}</span>
                <span className="text-xs text-muted-foreground">·</span>
                {user.is_active
                  ? <span className="flex items-center gap-1 text-xs text-green-600"><CircleCheck className="w-3 h-3" /> Active</span>
                  : <span className="flex items-center gap-1 text-xs text-muted-foreground"><CircleX className="w-3 h-3" /> Inactive</span>}
                <span className="text-xs text-muted-foreground">·</span>
                {user.is_onboarded
                  ? <span className="flex items-center gap-1 text-xs text-green-600"><CircleCheck className="w-3 h-3" /> Onboarded</span>
                  : <span className="flex items-center gap-1 text-xs text-muted-foreground"><CircleX className="w-3 h-3" /> Not onboarded</span>}
                  <>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{user.topic_count} {user.topic_count === 1 ? 'topic' : 'topics'}</span>
                  </>
                  <>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{user.outreach_count} {user.outreach_count === 1 ? 'outreach' : 'outreaches'}</span>
                  </>

              </div>
            </div>
            <div className="shrink-0 mt-0.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={user.id === me?.id || !!me?.is_impersonating}
                  >
                    Perform Action <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-destructive">
                  {user.is_staff ? (
                    <DropdownMenuItem onClick={() => handleSetStaff(user.id, false)}>
                      <ShieldOff className="w-4 h-4" /> Revoke Staff Access
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => handleSetStaff(user.id, true)}>
                      <ShieldAlert className="w-4 h-4" /> Grant Staff Access
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => handleImpersonate(user.id)}>
                    <HatGlasses className="w-4 h-4" /> Impersonate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleForceLogout(user.id)}>
                    <LogOut className="w-4 h-4" /> Force Logout
                  </DropdownMenuItem>
                  {user.is_active ? (
                    <DropdownMenuItem onClick={() => handleSetActive(user.id, false)}>
                      <UserRoundX className="w-4 h-4" /> Deactivate
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => handleSetActive(user.id, true)}>
                      <UserRoundCheck className="w-4 h-4" /> Activate
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
