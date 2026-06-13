import { useState } from 'react';
import {
  BarChart3, Users, Store, Package, CreditCard, Gift, Receipt,
  HeartPulse, AlertTriangle, Activity, Brain, Zap, Settings, StickyNote,
  TrendingUp, Menu, X, ShoppingBag
} from 'lucide-react';

type TabKey = 'overview' | 'users' | 'stores' | 'products' | 'activity' | 'errors' | 'health' | 'settings' | 'billing' | 'payment-failures' | 'codes' | 'tools' | 'affiliates' | 'notes' | 'ai' | 'bills';

interface Props {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onBillingClick: () => void;
  onCodesClick: () => void;
  onNotesClick: () => void;
  onSettingsClick: () => void;
  onHealthClick: () => void;
}

interface NavItem {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export default function PlatformAdminSidebar({ activeTab, onTabChange, onBillingClick, onCodesClick, onNotesClick, onSettingsClick, onHealthClick }: Props) {
  const [open, setOpen] = useState(false);

  const groups: NavGroup[] = [
    {
      title: '',
      items: [
        { key: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Management',
      items: [
        { key: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
        { key: 'stores', label: 'Stores', icon: <Store className="w-4 h-4" /> },
        { key: 'products', label: 'Products', icon: <Package className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Financial',
      items: [
        { key: 'billing', label: 'Subscriptions', icon: <CreditCard className="w-4 h-4" />, onClick: onBillingClick },
        { key: 'codes', label: 'Codes', icon: <Gift className="w-4 h-4" />, onClick: onCodesClick },
        { key: 'bills', label: 'Bills', icon: <Receipt className="w-4 h-4" /> },
        { key: 'payment-failures', label: 'Payment Failures', icon: <ShoppingBag className="w-4 h-4" /> },
      ],
    },
    {
      title: 'System',
      items: [
        { key: 'health', label: 'Health', icon: <HeartPulse className="w-4 h-4" />, onClick: onHealthClick },
        { key: 'errors', label: 'Errors', icon: <AlertTriangle className="w-4 h-4" /> },
        { key: 'activity', label: 'Activity', icon: <Activity className="w-4 h-4" /> },
        { key: 'ai', label: 'AI', icon: <Brain className="w-4 h-4" /> },
        { key: 'tools', label: 'Tools', icon: <Zap className="w-4 h-4" /> },
        { key: 'notes', label: 'Notes', icon: <StickyNote className="w-4 h-4" />, onClick: onNotesClick },
        { key: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, onClick: onSettingsClick },
      ],
    },
    {
      title: 'Other',
      items: [
        { key: 'affiliates', label: 'Affiliates', icon: <TrendingUp className="w-4 h-4" /> },
      ],
    },
  ];

  const sidebar = (
    <div className="w-56 shrink-0 bg-white/80 dark:bg-slate-800/50 backdrop-blur-md border-l border-gray-200 dark:border-slate-700/50 h-full overflow-y-auto">
      <div className="p-3 space-y-5">
        {groups.map((group) => (
          <div key={group.title || 'main'}>
            {group.title && (
              <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-1.5 px-2">
                {group.title}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      item.onClick?.();
                      onTabChange(item.key);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-all ${
                      isActive
                        ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 font-medium shadow-sm border border-blue-500/20'
                        : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700/30 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed top-4 right-4 z-50 p-2 rounded-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-gray-200 dark:border-slate-700/50 shadow-md"
      >
        {open ? <X className="w-5 h-5 text-gray-700 dark:text-slate-200" /> : <Menu className="w-5 h-5 text-gray-700 dark:text-slate-200" />}
      </button>

      {/* Desktop sidebar */}
      <div className="hidden lg:block h-full">
        {sidebar}
      </div>

      {/* Mobile sidebar overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-64 bg-white dark:bg-slate-900 h-full shadow-2xl overflow-y-auto">
            {sidebar}
          </div>
        </div>
      )}
    </>
  );
}