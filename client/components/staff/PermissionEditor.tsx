import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { PERMISSION_CATEGORIES, PERMISSION_LABELS, getCategoryPermissions } from '@shared/staff';
import {
  LayoutDashboard, ShoppingCart, Package, BarChart3, Settings, Users, Zap,
} from 'lucide-react';

interface PermissionEditorProps {
  permissions: Record<string, boolean>;
  onPermissionChange: (permission: string, value: boolean) => void;
}

const CATEGORY_META: Record<string, { title: string; desc: string; icon: React.ReactNode; gradient: string; shadow: string }> = {
  dashboard: { title: 'لوحة التحكم', desc: 'الوصول للوحة التحكم الرئيسية والتنقل', icon: <LayoutDashboard className="h-3.5 w-3.5 text-white" />, gradient: 'from-sky-500 to-blue-600', shadow: 'shadow-sky-500/30' },
  orders:    { title: 'الطلبات', desc: 'إدارة طلبات العملاء وحالاتها', icon: <ShoppingCart className="h-3.5 w-3.5 text-white" />, gradient: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-500/30' },
  products:  { title: 'المنتجات', desc: 'إدارة منتجات المتجر والمخزون', icon: <Package className="h-3.5 w-3.5 text-white" />, gradient: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/30' },
  analytics: { title: 'التحليلات', desc: 'عرض التحليلات والتقارير وتصدير البيانات', icon: <BarChart3 className="h-3.5 w-3.5 text-white" />, gradient: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/30' },
  settings:  { title: 'الإعدادات', desc: 'الوصول وتعديل إعدادات المتجر', icon: <Settings className="h-3.5 w-3.5 text-white" />, gradient: 'from-slate-500 to-gray-600', shadow: 'shadow-slate-500/30' },
  staff:     { title: 'الموظفون', desc: 'إدارة أعضاء الفريق وعرض سجلات النشاط', icon: <Users className="h-3.5 w-3.5 text-white" />, gradient: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/30' },
  advanced:  { title: 'متقدم', desc: 'ميزات متقدمة مثل إعدادات البوت والبث', icon: <Zap className="h-3.5 w-3.5 text-white" />, gradient: 'from-rose-500 to-pink-600', shadow: 'shadow-rose-500/30' },
};

export function PermissionEditor({ permissions, onPermissionChange }: PermissionEditorProps) {
  const categories = Object.keys(PERMISSION_CATEGORIES).map(
    (key) => PERMISSION_CATEGORIES[key as keyof typeof PERMISSION_CATEGORIES]
  );

  return (
    <div className="space-y-3">
      {categories.map((category) => {
        const perms = getCategoryPermissions(category);
        if (Object.keys(perms).length === 0) return null;
        const meta = CATEGORY_META[category] || CATEGORY_META.dashboard;
        const enabledCount = Object.values(perms).filter(p => permissions[p] === true).length;

        return (
          <div key={category} className="rounded-xl bg-white/60 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 overflow-hidden">
            {/* Category header */}
            <div className="flex items-center gap-2.5 p-3 border-b border-slate-200/50 dark:border-slate-700/40">
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${meta.gradient} shadow-md ${meta.shadow} flex-shrink-0`}>
                {meta.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-extrabold">{meta.title}</p>
                <p className="text-sm text-muted-foreground truncate">{meta.desc}</p>
              </div>
              <span className="text-sm font-bold text-muted-foreground bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-md flex-shrink-0">
                {enabledCount}/{Object.keys(perms).length}
              </span>
            </div>

            {/* Permission checkboxes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              {Object.entries(perms).map(([key, permission]) => {
                const label = PERMISSION_LABELS[permission as string] || permission;
                const isChecked = permissions[permission] === true;

                return (
                  <label
                    key={permission}
                    htmlFor={permission}
                    className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/30 border-b border-slate-100/60 dark:border-slate-700/30 last:border-b-0 ${
                      isChecked ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <Checkbox
                      id={permission}
                      checked={isChecked}
                      onCheckedChange={(checked) => onPermissionChange(permission, checked as boolean)}
                      className="h-4 w-4 rounded-md border-slate-300 dark:border-slate-600 data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-blue-500 data-[state=checked]:to-indigo-600 data-[state=checked]:border-blue-500"
                    />
                    <span className={`text-sm font-medium ${isChecked ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                      {label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
