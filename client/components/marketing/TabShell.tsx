import type { ReactNode } from 'react';

export function TabShell({ isEmpty, emptyIcon, emptyGradient, emptyTitle, emptyHint, children }: {
  isEmpty: boolean; emptyIcon: ReactNode; emptyGradient: string; emptyTitle: string; emptyHint?: string; children: ReactNode;
}) {
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border rounded-xl p-[13px]">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${emptyGradient} mb-[11px]`}>
          {emptyIcon}
        </div>
        <p className="text-sm font-bold mb-1">{emptyTitle}</p>
        {emptyHint && <p className="text-xs text-muted-foreground max-w-xs">{emptyHint}</p>}
      </div>
    );
  }
  return <div className="space-y-[9px]">{children}</div>;
}
