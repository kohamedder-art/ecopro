import { useState, useMemo } from 'react';
import { Package, Search, Flag, Eye, ShoppingCart, Trash2, Grid, List, Loader2, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/lib/i18n';

const TEST_PRODUCT_TITLES = ['ساعة رجالية فاخرة', 'عطر فرنسي أصلي', 'حقيبة يد نسائية', 'طقم رياضي رجالي'];

interface Product {
  id: number;
  title: string;
  price: number;
  seller_name: string;
  seller_email: string;
  status: string;
  views: number;
  order_count: number;
  created_at: string;
  images?: string[];
  flagged?: boolean;
  flag_reason?: string;
}

interface Props {
  products: Product[];
  loading: boolean;
  total: number;
  page: number;
  sort: string;
  onPageChange: (page: number) => void;
  onSortChange: (sort: string) => void;
  onFlag: (productId: number) => void;
  onDelete: (productId: number) => void;
  onUnflag: (productId: number) => void;
}

const PAGE_SIZE = 50;

export default function ProductsTab({ products, loading, total, page, sort, onPageChange, onSortChange, onFlag, onDelete, onUnflag }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'flagged' | 'active'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [hideTest, setHideTest] = useState(true);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filtered = useMemo(() => {
    let result = products;
    if (hideTest) result = result.filter(p => !TEST_PRODUCT_TITLES.includes(p.title));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => p.title?.toLowerCase().includes(q) || p.seller_name?.toLowerCase().includes(q));
    }
    if (filter === 'flagged') result = result.filter(p => p.flagged);
    else if (filter === 'active') result = result.filter(p => !p.flagged);
    return result;
  }, [products, search, filter]);

  const flaggedCount = products.filter(p => p.flagged).length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-4">
          <p className="text-xs text-gray-500 dark:text-slate-400">{t('platformAdmin.products.totalProducts')}</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{total}</p>
        </div>
        <div className="bg-emerald-500/10 rounded-2xl border border-emerald-500/30 p-4">
          <p className="text-xs text-emerald-300">{t('platformAdmin.products.active')}</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{total - flaggedCount}</p>
        </div>
        <div className={`${flaggedCount > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-white/60 dark:bg-slate-800/40 border-slate-700/40'} rounded-2xl border p-4`}>
          <p className={`text-xs ${flaggedCount > 0 ? 'text-red-300' : 'text-gray-500 dark:text-slate-400'}`}>{t('platformAdmin.products.flagged')}</p>
          <p className={`text-2xl font-black mt-1 ${flaggedCount > 0 ? 'text-red-400' : 'text-gray-500 dark:text-slate-500'}`}>{flaggedCount}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-500 w-4 h-4" />
          <input
            type="text"
            placeholder={t('platformAdmin.products.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/60 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/50 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 text-sm ps-10 pe-4 py-2.5 focus:border-blue-500/50 outline-none transition-all"
          />
        </div>
        {/* Sort */}
        <select
          value={sort}
          onChange={e => onSortChange(e.target.value)}
          className="bg-white/60 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/50 rounded-xl text-gray-900 dark:text-white text-sm px-3 py-2.5 outline-none transition-all cursor-pointer"
        >
          <option value="newest">{t('platformAdmin.products.newest') || 'الأحدث'}</option>
          <option value="most_viewed">{t('platformAdmin.products.mostViewed') || 'الأكثر مشاهدة'}</option>
          <option value="most_ordered">{t('platformAdmin.products.mostOrdered') || 'الأكثر طلباً'}</option>
        </select>
        <div className="flex gap-1.5">
          {(['all', 'flagged', 'active'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-white/60 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              {f === 'all' ? t('platformAdmin.products.all') : f === 'flagged' ? `${t('platformAdmin.products.flagged')} (${flaggedCount})` : t('platformAdmin.products.active')}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-white/60 dark:bg-slate-800/60 rounded-lg p-0.5">
          <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-slate-700 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-500'}`}>
            <Grid className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-slate-700 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-500'}`}>
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          onClick={() => setHideTest(!hideTest)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            hideTest ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-white/60 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
          }`}
        >
          {hideTest ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {hideTest ? 'إخفاء التجربي' : 'إظهار الكل'}
        </button>
      </div>

      {/* Products */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white/60 dark:bg-slate-800/40 rounded-2xl border border-slate-700/40 py-12 text-center">
          <Package className="w-10 h-10 mx-auto mb-2 text-slate-600" />
          <p className="text-gray-500 dark:text-slate-500 text-sm">{t('platformAdmin.products.noProducts')}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
          {filtered.map(p => (
            <div key={p.id} className={`group bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-xl border ${p.flagged ? 'border-red-500/40' : 'border-slate-700/40'} overflow-hidden shadow-md hover:shadow-lg transition-all`}>
              {/* Image */}
              <div className="aspect-square bg-slate-900/60 relative overflow-hidden">
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-6 h-6 text-slate-700" />
                  </div>
                )}
                {p.flagged && (
                  <div className="absolute top-1 left-1">
                    <Badge className="bg-red-600 text-white text-[9px] px-1 py-0">
                      <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                      {t('platformAdmin.products.flagged')}
                    </Badge>
                  </div>
                )}
                {/* Hover actions */}
                <div className="absolute inset-0 bg-black/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  {p.flagged ? (
                    <Button size="sm" onClick={() => onUnflag(p.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] h-7 px-2">
                      <CheckCircle className="w-2.5 h-2.5 mr-0.5" /> {t('platformAdmin.products.unflag')}
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => onFlag(p.id)} className="bg-orange-600 hover:bg-orange-700 text-white text-[10px] h-7 px-2">
                      <Flag className="w-2.5 h-2.5 mr-0.5" /> {t('platformAdmin.products.flag')}
                    </Button>
                  )}
                  <Button size="sm" onClick={() => onDelete(p.id)} variant="destructive" className="text-[10px] h-7 px-2">
                    <Trash2 className="w-2.5 h-2.5" />
                  </Button>
                </div>
              </div>

              {/* Info */}
              <div className="p-2">
                <h4 className="text-[11px] font-medium text-gray-900 dark:text-white truncate leading-tight">{p.title}</h4>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[11px] font-bold text-emerald-400">{Number(p.price).toLocaleString()} دج</span>
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-slate-500">
                    <div className="flex items-center gap-0.5">
                      <Eye className="w-2.5 h-2.5" />
                      <span className="text-[9px]">{p.views}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <ShoppingCart className="w-2.5 h-2.5" />
                      <span className="text-[9px]">{p.order_count}</span>
                    </div>
                  </div>
                </div>
                <p className="text-[9px] text-gray-500 dark:text-slate-500 mt-0.5 truncate leading-tight">{p.seller_name}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-slate-700/30">
            {filtered.map(p => (
              <div key={p.id} className="group flex items-center gap-3 p-3 hover:bg-gray-50/30 dark:bg-slate-900/30 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-slate-900/60 overflow-hidden flex-shrink-0">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Package className="w-4 h-4 text-slate-700" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate">{p.title}</p>
                  <p className="text-[11px] text-gray-500 dark:text-slate-500">{p.seller_name} · {p.views} views · {p.order_count} orders</p>
                </div>
                <span className="text-xs font-bold text-emerald-400">{Number(p.price).toLocaleString()} دج</span>
                {p.flagged && <Badge className="bg-red-500/20 text-red-300 text-[10px]">{t('platformAdmin.products.flagged')}</Badge>}
                <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  {p.flagged ? (
                    <button onClick={() => onUnflag(p.id)} className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-gray-500 dark:text-slate-400 hover:text-emerald-300">
                      <CheckCircle className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button onClick={() => onFlag(p.id)} className="p-1.5 rounded-lg hover:bg-orange-500/20 text-gray-500 dark:text-slate-400 hover:text-orange-300">
                      <Flag className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => onDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 dark:text-slate-400 hover:text-red-300">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            صفحة {page} من {totalPages} ({total} منتج)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-2 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/50 text-gray-700 dark:text-slate-300 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-500 dark:text-slate-400 min-w-[4rem] text-center">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-2 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/50 text-gray-700 dark:text-slate-300 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
