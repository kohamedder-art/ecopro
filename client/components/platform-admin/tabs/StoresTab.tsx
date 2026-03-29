import { useState, useMemo } from 'react';
import { Store, Search, ExternalLink, ShoppingBag, Package, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface StoreData {
  id: number;
  email: string;
  store_name: string;
  store_slug: string;
  subscription_status?: string;
  paid_until?: string;
  created_at: string;
}

interface Props {
  stores: StoreData[];
  loading: boolean;
}

export default function StoresTab({ stores, loading }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'trial' | 'expired'>('all');

  const filtered = useMemo(() => {
    let result = stores;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s => s.store_name?.toLowerCase().includes(q) || s.store_slug?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') {
      result = result.filter(s => s.subscription_status === statusFilter);
    }
    return result;
  }, [stores, search, statusFilter]);

  const activeCount = stores.filter(s => s.subscription_status === 'active').length;
  const trialCount = stores.filter(s => s.subscription_status === 'trial').length;
  const expiredCount = stores.filter(s => s.subscription_status === 'expired' || s.subscription_status === 'locked').length;

  function getStatusBadge(status?: string) {
    switch (status) {
      case 'active': return <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px]">Active</Badge>;
      case 'trial': return <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">Trial</Badge>;
      case 'expired': case 'locked': return <Badge className="bg-red-500/20 text-red-300 border border-red-500/30 text-[10px]">Expired</Badge>;
      default: return <Badge className="bg-slate-500/20 text-slate-400 border border-slate-500/30 text-[10px]">{status || 'Unknown'}</Badge>;
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-4">
          <p className="text-xs text-slate-400">Total Stores</p>
          <p className="text-2xl font-black text-white mt-1">{stores.length}</p>
        </div>
        <div className="bg-emerald-500/10 backdrop-blur-xl rounded-2xl border border-emerald-500/30 p-4">
          <p className="text-xs text-emerald-300">Active</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{activeCount}</p>
        </div>
        <div className="bg-amber-500/10 backdrop-blur-xl rounded-2xl border border-amber-500/30 p-4">
          <p className="text-xs text-amber-300">Trial</p>
          <p className="text-2xl font-black text-amber-400 mt-1">{trialCount}</p>
        </div>
        <div className="bg-red-500/10 backdrop-blur-xl rounded-2xl border border-red-500/30 p-4">
          <p className="text-xs text-red-300">Expired</p>
          <p className="text-2xl font-black text-red-400 mt-1">{expiredCount}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by store name, slug, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 text-sm pl-10 pr-4 py-2.5 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'active', 'trial', 'expired'] as const).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                statusFilter === f ? 'bg-blue-600 text-white' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stores Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-800/40 rounded-2xl border border-slate-700/40 py-12 text-center">
          <Store className="w-10 h-10 mx-auto mb-2 text-slate-600" />
          <p className="text-slate-500 text-sm">No stores found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.slice(0, 30).map(store => (
            <div key={store.id} className="group bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-4 hover:border-slate-600/60 transition-all shadow-lg hover:shadow-xl">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                      <Store className="w-4 h-4 text-indigo-300" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{store.store_name || 'Unnamed'}</h4>
                      <p className="text-[10px] text-slate-500 truncate">{store.store_slug}</p>
                    </div>
                  </div>
                </div>
                {getStatusBadge(store.subscription_status)}
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Owner</span>
                  <span className="text-slate-300 truncate ml-2">{store.email}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Created</span>
                  <span className="text-slate-300">{new Date(store.created_at).toLocaleDateString()}</span>
                </div>
                {store.paid_until && (
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Paid until</span>
                    <span className="text-slate-300">{new Date(store.paid_until).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-slate-700/30 flex items-center gap-2">
                <a
                  href={`/store/${store.store_slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Visit Store
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
      {filtered.length > 30 && (
        <p className="text-center text-xs text-slate-500">Showing 30 of {filtered.length} stores</p>
      )}
    </div>
  );
}
