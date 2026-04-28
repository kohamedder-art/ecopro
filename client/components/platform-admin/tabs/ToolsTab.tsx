import { useState } from 'react';
import { Wrench, Key, Download, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';

interface Props {
  LockedAccountsManager: React.ComponentType;
}

export default function ToolsTab({ LockedAccountsManager }: Props) {
  const { t } = useTranslation();
  const [genKernel, setGenKernel] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Kernel Creds */}
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-cyan-500/30 p-5 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
              <Key className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h4 className="text-gray-900 dark:text-white font-semibold text-sm">{t('platformAdmin.tools.kernelPortal')}</h4>
              <p className="text-gray-500 dark:text-slate-400 text-xs">{t('platformAdmin.tools.kernelDesc')}</p>
            </div>
          </div>
          <Button
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs h-9"
            disabled={genKernel}
            onClick={async () => {
              setGenKernel(true);
              try {
                const res = await fetch('/api/admin/kernel/reset-creds', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ username: 'root' }),
                });
                const data = await res.json().catch(() => ({} as any));
                if (!res.ok) throw new Error(data?.error || data?.message || 'Failed');
                alert(`${t('platformAdmin.tools.credsGenerated')}\n\nUsername: ${data.username}\nPassword: ${data.password}\n\nOpen: /kernel-portal-k7r2n9x5p3`);
              } catch (e: any) {
                alert(e?.message || t('platformAdmin.tools.credsFailed'));
              } finally {
                setGenKernel(false);
              }
            }}
          >
            {genKernel ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Key className="w-3.5 h-3.5 mr-1" />}
            {t('platformAdmin.tools.generateCreds')}
          </Button>
        </div>

        {/* Export DB */}
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-5 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center">
              <Download className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-gray-900 dark:text-white font-semibold text-sm">{t('platformAdmin.tools.exportDb')}</h4>
              <p className="text-gray-500 dark:text-slate-400 text-xs">{t('platformAdmin.tools.exportDesc')}</p>
            </div>
          </div>
          <Button
            className="w-full bg-slate-700 hover:bg-slate-600 text-gray-900 dark:text-white text-xs h-9"
            onClick={() => {
              if (!confirm(t('platformAdmin.tools.exportConfirm'))) return;
              window.location.href = '/api/admin/export-db?limit=1000';
            }}
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            {t('platformAdmin.tools.exportSnapshot')}
          </Button>
        </div>

        {/* Clear Cache */}
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-5 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h4 className="text-gray-900 dark:text-white font-semibold text-sm">{t('platformAdmin.tools.clearCache')}</h4>
              <p className="text-gray-500 dark:text-slate-400 text-xs">{t('platformAdmin.tools.clearCacheDesc')}</p>
            </div>
          </div>
          <Button
            className="w-full bg-slate-700 hover:bg-slate-600 text-gray-900 dark:text-white text-xs h-9"
            disabled={clearingCache}
            onClick={async () => {
              if (!confirm(t('platformAdmin.tools.clearConfirm'))) return;
              setClearingCache(true);
              try {
                const res = await fetch('/api/admin/clear-cache', { method: 'POST', credentials: 'include' });
                const data = await res.json().catch(() => ({} as any));
                if (!res.ok) throw new Error(data?.error || data?.message || 'Failed to clear cache');
                alert(t('platformAdmin.tools.cacheCleared'));
              } catch (e: any) {
                alert(e?.message || 'Failed to clear cache');
              } finally {
                setClearingCache(false);
              }
            }}
          >
            {clearingCache ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
            {t('platformAdmin.tools.clearCache')}
          </Button>
        </div>
      </div>

      {/* Locked Accounts Manager */}
      <LockedAccountsManager />
    </div>
  );
}
