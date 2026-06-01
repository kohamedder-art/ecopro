import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/lib/i18n';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { buildStoreUrl } from '@/lib/resolvedStore';

export default function MyStoreIndex() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { storeSlug, isFetching, isError } = useStoreSettings({
    enabled: true,
    onUnauthorized: () => navigate('/login'),
  });

  const loading = isFetching && !storeSlug;
  const error = useMemo(() => (isError ? t('myStore.errorLoad') : null), [isError, t]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-6">{t('myStore.title')}</h1>
      {/* Main UI always visible */}
      <div className="w-full max-w-xl bg-background rounded-xl shadow p-6 mb-6">
        {loading && (
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">{t('myStore.loading')}<br />{t('myStore.loadingHint')}</p>
          </div>
        )}
        {error && (
          <div className="text-red-500 font-semibold text-center">{error}</div>
        )}
        {!loading && !error && storeSlug && (
          <div className="text-center">
            <p className="text-lg">{t('myStore.storeLoaded', { slug: storeSlug })}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('myStore.tip')}
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                className="px-4 py-2 rounded bg-primary text-white font-bold"
                onClick={() => navigate(buildStoreUrl(storeSlug, '/'))}
              >
                {t('store.viewStorefront')}
              </button>
              <button
                className="px-4 py-2 rounded border border-slate-200 bg-white text-slate-900 font-bold"
                onClick={() => navigate(`/template-editor`)}
              >
                {t('store.templateEditor')}
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                className="px-4 py-3 rounded border border-slate-200 bg-white text-slate-900 font-bold"
                onClick={() => navigate('/dashboard/preview')}
              >
                {t('myStore.dashboard')}
                <div className="text-xs text-muted-foreground font-normal mt-1">{t('myStore.dashboardHint')}</div>
              </button>
              <button
                className="px-4 py-3 rounded border border-slate-200 bg-white text-slate-900 font-bold"
                onClick={() => navigate('/dashboard/stock')}
              >
                {t('myStore.stock')}
                <div className="text-xs text-muted-foreground font-normal mt-1">{t('myStore.stockHint')}</div>
              </button>
            </div>
          </div>
        )}
        {!loading && !error && !storeSlug && (
          <div className="text-center text-muted-foreground">{t('myStore.noStore')}</div>
        )}
      </div>
    </div>
  );
}
