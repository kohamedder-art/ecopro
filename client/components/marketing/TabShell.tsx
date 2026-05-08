import type { ReactNode } from 'react';
import { surfaceCard } from './helpers';

interface TabShellProps {
  isEmpty: boolean;
  emptyIcon: ReactNode;
  emptyGradient: string;
  emptyTitle: string;
  emptyHint?: string;
  children: ReactNode;
}

export function TabShell({ isEmpty, emptyIcon, emptyGradient, emptyTitle, emptyHint, children }: TabShellProps) {
  if (isEmpty) {
    return (
      <div className={`${surfaceCard} p-[13px] flex flex-col items-center justify-center py-16 text-center`}>
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${emptyGradient} mb-[11px]`}>
          <span className="h-7 w-7 flex items-center justify-center">{emptyIcon}</span>
        </div>
        <p className="text-sm font-bold mb-1">{emptyTitle}</p>
        {emptyHint && <p className="text-xs text-muted-foreground max-w-xs">{emptyHint}</p>}
      </div>
    );
  }

  return <>{children}</>;
}
