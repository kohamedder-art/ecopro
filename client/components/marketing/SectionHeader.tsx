import type { ReactNode } from 'react';

export function SectionHeader({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-[7px] px-[13px] pt-[13px] pb-[9px]">
      <span className="flex h-[11px] w-[11px] items-center justify-center text-primary shrink-0">{icon}</span>
      <span className="text-[13px] font-bold">{title}</span>
      {description && <span className="text-[10px] text-muted-foreground mr-auto">{description}</span>}
    </div>
  );
}
