import { useState } from 'react';
import { Wrench, Key, Download, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  LockedAccountsManager: React.ComponentType;
}

export default function ToolsTab({ LockedAccountsManager }: Props) {
  const [genKernel, setGenKernel] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Kernel Creds */}
        <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-cyan-500/30 p-5 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
              <Key className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm">Kernel Portal</h4>
              <p className="text-slate-400 text-xs">Generate root login credentials</p>
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
                alert(`Kernel creds generated\n\nUsername: ${data.username}\nPassword: ${data.password}\n\nOpen: /kernel-portal-k7r2n9x5p3`);
              } catch (e: any) {
                alert(e?.message || 'Failed to reset kernel creds');
              } finally {
                setGenKernel(false);
              }
            }}
          >
            {genKernel ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Key className="w-3.5 h-3.5 mr-1" />}
            Generate Creds
          </Button>
        </div>

        {/* Export DB */}
        <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-5 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center">
              <Download className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm">Export Database</h4>
              <p className="text-slate-400 text-xs">Download JSON snapshot</p>
            </div>
          </div>
          <Button
            className="w-full bg-slate-700 hover:bg-slate-600 text-white text-xs h-9"
            onClick={() => {
              if (!confirm('Export a DB snapshot now? (This will download a JSON file)')) return;
              window.location.href = '/api/admin/export-db?limit=1000';
            }}
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Export Snapshot
          </Button>
        </div>

        {/* Clear Cache */}
        <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-5 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm">Clear Cache</h4>
              <p className="text-slate-400 text-xs">Purge server-side caches</p>
            </div>
          </div>
          <Button
            className="w-full bg-slate-700 hover:bg-slate-600 text-white text-xs h-9"
            disabled={clearingCache}
            onClick={async () => {
              if (!confirm('Clear server caches now?')) return;
              setClearingCache(true);
              try {
                const res = await fetch('/api/admin/clear-cache', { method: 'POST', credentials: 'include' });
                const data = await res.json().catch(() => ({} as any));
                if (!res.ok) throw new Error(data?.error || data?.message || 'Failed to clear cache');
                alert('Cache cleared');
              } catch (e: any) {
                alert(e?.message || 'Failed to clear cache');
              } finally {
                setClearingCache(false);
              }
            }}
          >
            {clearingCache ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
            Clear Cache
          </Button>
        </div>
      </div>

      {/* Locked Accounts Manager */}
      <LockedAccountsManager />
    </div>
  );
}
