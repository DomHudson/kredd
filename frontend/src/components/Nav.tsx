import { Link, useNavigate } from 'react-router-dom';
import { Moon, Sun, CircleUserRound, LogOut, ShieldAlert, Menu, Tags, Inbox } from 'lucide-react';
import Logo from '@/components/Logo';
import { useDarkMode } from '@/hooks/use-dark-mode';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMe, logout, stopImpersonating } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ReactNode } from 'react';

interface NavProps {
  showButtons?: boolean;
  titleText?: string;
  progressBar?: ReactNode;
}

export function Nav({ showButtons = true, titleText = '', progressBar }: NavProps) {
  const { isDark, toggle } = useDarkMode();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: getMe });

  const handleLogout = async () => {
    if (user?.is_impersonating) {
      await stopImpersonating();
      queryClient.clear();
      navigate('/admin');
    } else {
      await logout();
      queryClient.clear();
      navigate('/login');
    }
  };

  return (
    <nav className="border-b border-border bg-card">
      <div className="px-6 h-14 flex items-center justify-between">

        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
            <Logo />
          </Link>
          {titleText && (
            <>
              <span className="text-muted-foreground text-sm mx-2">·</span>
              <span className="text-sm text-muted-foreground">{titleText}</span>
            </>
          )}
        </div>
        {showButtons && user && (
          <>
            {/* Wide screen buttons */}
            <div className="hidden sm:flex items-center gap-3">
              {user.is_staff && (
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
                  <ShieldAlert className="w-4 h-4" /> Admin
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <Inbox className="w-4 h-4" /> Inbox
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/topics')}>
                <Tags className="w-4 h-4" /> Topics
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/profile/edit')}>
                <CircleUserRound className="w-4 h-4" /> {user.first_name} {user.last_name}
              </Button>
              <Button variant="ghost" size="sm" onClick={toggle}>
                {isDark ? <><Sun className="w-4 h-4" /> Light Mode</> : <><Moon className="w-4 h-4" /> Dark Mode</>}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4" /> {user.is_impersonating ? 'Stop Impersonating' : 'Log Out'}
              </Button>
            </div>

            {/* Mobile burger menu */}
            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Menu className="w-4 h-4" /> Menu
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {user.is_staff && (
                    <DropdownMenuItem onClick={() => navigate('/admin')}>
                      <ShieldAlert className="w-4 h-4 mr-2" /> Admin
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate('/')}>
                    <Inbox className="w-4 h-4 mr-2" /> Inbox
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/topics')}>
                    <Tags className="w-4 h-4 mr-2" /> Topics
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/profile/edit')}>
                    <CircleUserRound className="w-4 h-4 mr-2" /> {user.first_name} {user.last_name}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={toggle}>
                    {isDark ? <><Sun className="w-4 h-4 mr-2" /> Light Mode</> : <><Moon className="w-4 h-4 mr-2" /> Dark Mode</>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" /> {user.is_impersonating ? 'Stop Impersonating' : 'Log Out'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>
      {progressBar && (
        <div className="px-6 pb-4">
          {progressBar}
        </div>
      )}
    </nav>
  );
}
