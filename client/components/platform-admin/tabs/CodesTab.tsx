import { useState } from 'react';
import { Gift, CheckCircle, Clock, AlertCircle, Copy, X, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/lib/i18n';

interface GeneratedCode {
  generated_code: string;
  status: string;
  created_at: string;
  expiry_date: string;
  redeemed_by_name?: string;
  redeemed_by_email?: string;
  client_name?: string;
  client_email?: string;
}

interface Props {
  stats: { totalCodes: number; redeemedCodes: number; pendingCodes: number; expiredCodes: number };
  generatedCodes: GeneratedCode[];
  codesLoading: boolean;
  issuingCode: boolean;
  lastGeneratedCode: { code: string } | null;
  onIssueCode: () => void;
  onDismissCode: () => void;
}

export default function CodesTab({ stats, generatedCodes, codesLoading, issuingCode, lastGeneratedCode, onIssueCode, onDismissCode }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const filtered = search
    ? generatedCodes.filter(c => c.generated_code.toLowerCase().includes(search.toLowerCase()) || (c.redeemed_by_email || c.client_email || '').toLowerCase().includes(search.toLowerCase()))
    : generatedCodes;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('platformAdmin.codes.totalCodes'), value: stats.totalCodes, icon: Gift, gradient: 'from-cyan-500/15 to-cyan-500/5', border: 'border-cyan-500/30', text: 'text-cyan-400', iconColor: 'text-cyan-500/40' },
          { label: t('platformAdmin.codes.redeemed'), value: stats.redeemedCodes, icon: CheckCircle, gradient: 'from-emerald-500/15 to-emerald-500/5', border: 'border-emerald-500/30', text: 'text-emerald-400', iconColor: 'text-emerald-500/40' },
          { label: t('platformAdmin.codes.pending'), value: stats.pendingCodes, icon: Clock, gradient: 'from-amber-500/15 to-amber-500/5', border: 'border-amber-500/30', text: 'text-amber-400', iconColor: 'text-amber-500/40' },
          { label: t('platformAdmin.codes.expired'), value: stats.expiredCodes, icon: AlertCircle, gradient: 'from-red-500/15 to-red-500/5', border: 'border-red-500/30', text: 'text-red-400', iconColor: 'text-red-500/40' },
        ].map((kpi, i) => (
          <div key={i} className={`bg-gradient-to-br ${kpi.gradient} backdrop-blur-xl rounded-2xl border ${kpi.border} p-4 shadow-lg`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{kpi.label}</p>
                <p className={`text-2xl font-bold ${kpi.text}`}>{kpi.value}</p>
              </div>
              <kpi.icon className={`w-7 h-7 ${kpi.iconColor}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Generate Section */}
      <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-5 shadow-lg">
        <h3 className="text-gray-900 dark:text-white font-bold text-sm flex items-center gap-2 mb-3">
          <Gift className="w-4 h-4 text-cyan-400" />
          {t('platformAdmin.codes.generateTitle')}
        </h3>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <p className="text-gray-500 dark:text-slate-400 text-sm flex-1">
            {t('platformAdmin.codes.generateDesc')}
          </p>
          <Button onClick={onIssueCode} disabled={issuingCode}
            className="w-full sm:w-auto bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white"
          >
            <Gift className="w-4 h-4 mr-2" />
            {issuingCode ? t('platformAdmin.codes.generating') : t('platformAdmin.codes.generateCode')}
          </Button>
        </div>
      </div>

      {/* Last Generated */}
      {lastGeneratedCode && (
        <div className="bg-gradient-to-r from-emerald-500/15 to-green-500/15 backdrop-blur-xl rounded-2xl border border-emerald-500/40 p-5 shadow-lg relative">
          <button onClick={onDismissCode} className="absolute top-3 right-3 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-gray-900 dark:text-white">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <h3 className="text-emerald-300 font-bold text-sm">{t('platformAdmin.codes.codeGenerated')}</h3>
          </div>
          <div className="bg-gray-100/50 dark:bg-slate-900/50 rounded-xl p-4 border border-emerald-500/20 mb-3">
            <p className="text-[10px] text-gray-500 dark:text-slate-500 uppercase mb-1">{t('platformAdmin.codes.subscriptionCode')}</p>
            <div className="flex items-center justify-between gap-3">
              <code className="text-xl font-mono font-bold text-emerald-400 break-all">{lastGeneratedCode.code}</code>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0"
                onClick={() => { navigator.clipboard.writeText(lastGeneratedCode.code); }}
              >
                <Copy className="w-3.5 h-3.5 mr-1" /> {t('platformAdmin.codes.copy')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50/40 dark:bg-slate-900/40 rounded-lg p-2 border border-emerald-500/10">
              <p className="text-[10px] text-gray-500 dark:text-slate-500">{t('platformAdmin.codes.expiresIn')}</p>
              <p className="text-sm font-bold text-emerald-300">{t('platformAdmin.codes.oneHour')}</p>
            </div>
            <div className="bg-gray-50/40 dark:bg-slate-900/40 rounded-lg p-2 border border-emerald-500/10">
              <p className="text-[10px] text-gray-500 dark:text-slate-500">{t('platformAdmin.codes.status')}</p>
              <p className="text-sm font-bold text-emerald-300">{t('platformAdmin.codes.activeStatus')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Codes Table */}
      <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 shadow-lg overflow-hidden">
        <div className="p-4 border-b border-slate-700/40 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-gray-900 dark:text-white font-bold text-sm flex items-center gap-2">
            {t('platformAdmin.codes.recentCodes')}
          </h3>
          <div className="relative w-56">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-500 w-3.5 h-3.5" />
            <input type="text" placeholder={t('platformAdmin.codes.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-100/50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700/50 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 text-xs ps-9 pe-3 py-2 focus:border-cyan-500/50 outline-none"
            />
          </div>
        </div>

        {codesLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Gift className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <p className="text-gray-500 dark:text-slate-400 text-sm">{t('platformAdmin.codes.noCodes')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/40 bg-gray-50/40 dark:bg-slate-900/40">
                  <th className="p-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400">{t('platformAdmin.codes.code')}</th>
                  <th className="p-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400">{t('platformAdmin.codes.status')}</th>
                  <th className="p-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400">{t('platformAdmin.codes.created')}</th>
                  <th className="p-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400">{t('platformAdmin.codes.expires')}</th>
                  <th className="p-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400">{t('platformAdmin.codes.client')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700/30">
                {filtered.map((code, idx) => {
                  const expiryAt = new Date(code.expiry_date);
                  const isExpired = expiryAt < new Date();
                  const timeLeft = Math.max(0, expiryAt.getTime() - Date.now()) / 60000;
                  return (
                    <tr key={idx} className="hover:bg-gray-50/30 dark:bg-slate-900/30 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono text-cyan-400">{code.generated_code}</code>
                          <button onClick={() => navigator.clipboard.writeText(code.generated_code)}
                            className="text-gray-500 dark:text-slate-500 hover:text-gray-900 dark:hover:text-gray-900 dark:text-white transition text-xs">📋</button>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge className={`${code.status === 'used' ? 'bg-emerald-600' : isExpired ? 'bg-red-600' : 'bg-amber-600'} text-white text-[10px]`}>
                          {code.status === 'used' ? t('platformAdmin.codes.redeemedStatus') : isExpired ? t('platformAdmin.codes.expiredStatus') : t('platformAdmin.codes.activeStatus')}
                        </Badge>
                      </td>
                      <td className="p-3 text-gray-500 dark:text-slate-400 text-xs">{new Date(code.created_at).toLocaleDateString()}</td>
                      <td className="p-3 text-xs">
                        {isExpired ? <span className="text-red-400">{t('platformAdmin.codes.expiredStatus')}</span> : <span className="text-amber-400">{Math.floor(timeLeft)} {t('platformAdmin.codes.min')}</span>}
                      </td>
                      <td className="p-3 text-gray-500 dark:text-slate-400 text-xs truncate max-w-[160px]">
                        {code.redeemed_by_name || code.redeemed_by_email || code.client_name || code.client_email || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
