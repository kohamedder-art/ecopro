import type { ReactNode } from 'react';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface SectionHeaderProps {
  icon: ReactNode;
  title: string;
  description?: string;
}

export function SectionHeader({ icon, title, description }: SectionHeaderProps) {
  return (
    <CardHeader className="px-[13px] pt-[13px] pb-0">
      <CardTitle className="flex items-center gap-[7px] text-[13px] font-bold">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          <span className="h-[11px] w-[11px] flex items-center justify-center">{icon}</span>
        </span>
        {title}
      </CardTitle>
      {description && <CardDescription className="text-[11px] pt-[3px]">{description}</CardDescription>}
    </CardHeader>
  );
}
