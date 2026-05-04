import { useEffect } from 'react';

export function useTitle(title: string) {
  useEffect(() => {
    document.title = `Kredd — ${title}`;
    return () => { document.title = 'Kredd'; };
  }, [title]);
}
