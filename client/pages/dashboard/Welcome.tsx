import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/lib/i18n";
import { Store, Globe, Gift, Check, Loader2, ArrowRight, ArrowLeft } from "lucide-react";

const DONE_KEY = "ecopro_onboarding_done";

function slugify(v: string): string {
  const arMap: Record<string, string> = {
    'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'aa', 'ب': 'b', 'ت': 't', 'ث': 'th',
    'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
    'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
    'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
    'ه': 'h', 'و': 'w', 'ي': 'y', 'ة': 'a', 'ى': 'a', 'ؤ': 'w', 'ئ': 'y',
  };
  return v
    .split('')
    .map(c => arMap[c] ?? c)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export default function Welcome() {
  const { t, locale, setLocale } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [storeName, setStoreName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle');
  const [trialDays, setTrialDays] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialSlug, setInitialSlug] = useState('');
  const checkTimer = useRef<any>(null);
  const isRTL = locale === 'ar';
  const NextIcon = isRTL ? ArrowLeft : ArrowRight;

  useEffect(() => {
    try {
      if (localStorage.getItem(DONE_KEY) === '1') {
        navigate('/dashboard', { replace: true });
        return;
      }
    } catch { /* ignore */ }
    fetch('/api/client/store/settings', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const s = d?.settings || d || {};
        if (s.store_name) setStoreName(String(s.store_name));
        if (s.store_slug) {
          setSlug(String(s.store_slug));
          setInitialSlug(String(s.store_slug));
        }
      })
      .catch(() => {});
    fetch('/api/billing/public', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const n = Number(d?.trialDays);
        if (Number.isFinite(n) && n > 0) setTrialDays(n);
      })
      .catch(() => {});
  }, []);

  // Live slug availability
  useEffect(() => {
    if (!slug || slug === initialSlug) {
      setSlugState(slug ? 'ok' : 'idle');
      return;
    }
    setSlugState('checking');
    clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/client/store/check-slug?slug=${encodeURIComponent(slug)}`, { credentials: 'include' });
        const d = await r.json().catch(() => ({}));
        setSlugState(d.available ? 'ok' : d.reason === 'invalid' || d.reason === 'reserved' ? 'invalid' : 'taken');
      } catch {
        setSlugState('idle');
      }
    }, 500);
    return () => clearTimeout(checkTimer.current);
  }, [slug, initialSlug]);

  const onNameChange = (v: string) => {
    setStoreName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const canNextStore = storeName.trim().length >= 2 && (slugState === 'ok' || slugState === 'idle');

  const saveStore = async (): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/client/store/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ store_name: storeName.trim(), store_slug: slug.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setInitialSlug(slug.trim());
      return true;
    } catch (e: any) {
      setError(e.message || 'Save failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const finish = () => {
    try {
      localStorage.setItem(DONE_KEY, '1');
    } catch { /* ignore */ }
    navigate('/dashboard', { replace: true });
  };

  const steps = [t('welcome.stepStore'), t('welcome.stepLanguage'), t('welcome.stepTrial')];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 pt-6">
          <div className="flex items-center gap-2 mb-6">
            {steps.map((label, i) => (
              <div key={label} className="flex-1">
                <div className={`h-1.5 rounded-full transition-colors ${i <= step ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                <p className={`text-[10px] font-bold mt-1.5 ${i === step ? 'text-indigo-500' : 'text-muted-foreground'}`}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 pb-6">
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-black">{t('welcome.storeTitle')}</h2>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">{t('welcome.storeName')}</label>
                <input
                  value={storeName}
                  onChange={e => onNameChange(e.target.value)}
                  placeholder={t('welcome.storeNamePh')}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">{t('welcome.storeSlug')}</label>
                <input
                  value={slug}
                  onChange={e => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
                  placeholder="my-store"
                  dir="ltr"
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
                <p className="text-[11px] text-muted-foreground mt-1" dir="ltr">https://{slug || 'my-store'}.sahla4eco.com</p>
                {slugState === 'checking' && <p className="text-[11px] text-muted-foreground mt-1">{t('welcome.checking')}</p>}
                {slugState === 'ok' && slug && slug !== initialSlug && <p className="text-[11px] font-bold text-green-600 mt-1">{t('welcome.slugOk')}</p>}
                {slugState === 'taken' && <p className="text-[11px] font-bold text-red-600 mt-1">{t('welcome.slugTaken')}</p>}
                {slugState === 'invalid' && <p className="text-[11px] font-bold text-red-600 mt-1">{t('welcome.slugInvalid')}</p>}
              </div>
              {error && <p className="text-xs font-bold text-red-600">{error}</p>}
              <button
                disabled={!canNextStore || saving}
                onClick={async () => { if (await saveStore()) setStep(1); }}
                className="w-full h-10 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-40 hover:bg-indigo-700 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{t('welcome.next')} <NextIcon className="w-4 h-4" /></>}
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-black">{t('welcome.langTitle')}</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { code: 'ar', label: 'العربية' },
                  { code: 'fr', label: 'Français' },
                  { code: 'en', label: 'English' },
                ].map(l => (
                  <button
                    key={l.code}
                    onClick={() => setLocale(l.code as any)}
                    className={`h-12 rounded-xl border-2 text-sm font-bold transition-all ${locale === l.code ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600' : 'border-border hover:border-indigo-300'}`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                className="w-full h-10 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 flex items-center justify-center gap-2"
              >
                {t('welcome.next')} <NextIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-black">{t('welcome.trialTitle')}</h2>
              </div>
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-500/5 p-4 text-sm leading-relaxed">
                <p className="font-bold text-base mb-1">{t('welcome.trialDays').replace('{n}', String(trialDays))}</p>
                <p className="text-muted-foreground text-[13px]">{t('welcome.trialDesc')}</p>
              </div>
              <div className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-relaxed">
                <p className="font-bold text-[13px] mb-1">{t('welcome.lockTitle')}</p>
                <p className="text-muted-foreground text-[13px]">{t('welcome.lockDesc')}</p>
              </div>
              <button
                onClick={finish}
                className="w-full h-10 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" /> {t('welcome.start')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
