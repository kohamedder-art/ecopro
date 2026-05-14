import { useState } from 'react';
import { Users, CreditCard, Shield, Lock, Award, Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';
import { formatPriceForInput } from '@/lib/formatPrice';

interface PlatformSettings {
  max_users: number;
  max_stores: number;
  subscription_price: number;
  trial_days: number;
  updated_at: string;
}

interface Props {
  platformSettings: PlatformSettings | null;
  stats: { totalUsers: number; totalClients: number };
  settingsForm: { max_users: number; max_stores: number; subscription_price: number; trial_days: number };
  setSettingsForm: React.Dispatch<React.SetStateAction<{ max_users: number; max_stores: number; subscription_price: number; trial_days: number }>>;
  onSaveLimits: () => Promise<void>;
  onSaveSubscription: () => Promise<void>;
  savingLimits: boolean;
  savingSubscription: boolean;
}

export default function SettingsTab({ platformSettings, stats, settingsForm, setSettingsForm, onSaveLimits, onSaveSubscription, savingLimits, savingSubscription }: Props) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Platform Limits */}
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-blue-500/20 shadow-lg p-5">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center text-sm gap-2 mb-4">
            <Users className="w-4 h-4 text-blue-400" />
            {t('platformAdmin.settings.platformLimits')}
          </h3>
          <div className="space-y-3">
            <div className="bg-gray-50/40 dark:bg-slate-900/40 rounded-xl border border-gray-200/60 dark:border-slate-700/30 p-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('platformAdmin.settings.maxUsers')}</label>
              <div className="flex items-center gap-2">
                <input type="number" value={settingsForm.max_users}
                  onChange={e => setSettingsForm(s => ({ ...s, max_users: Number(e.target.value) }))}
                  className="flex-1 bg-white/60 dark:bg-slate-800/60 border border-gray-300/60 dark:border-slate-600/50 text-gray-900 dark:text-white rounded-lg focus:border-blue-500/50 text-sm p-2 outline-none"
                />
                <span className="text-gray-500 dark:text-slate-500 text-xs whitespace-nowrap">{t('platformAdmin.settings.now')} {stats.totalUsers}</span>
              </div>
            </div>
            <div className="bg-gray-50/40 dark:bg-slate-900/40 rounded-xl border border-gray-200/60 dark:border-slate-700/30 p-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('platformAdmin.settings.maxStores')}</label>
              <div className="flex items-center gap-2">
                <input type="number" value={settingsForm.max_stores}
                  onChange={e => setSettingsForm(s => ({ ...s, max_stores: Number(e.target.value) }))}
                  className="flex-1 bg-white/60 dark:bg-slate-800/60 border border-gray-300/60 dark:border-slate-600/50 text-gray-900 dark:text-white rounded-lg focus:border-emerald-500/50 text-sm p-2 outline-none"
                />
                <span className="text-gray-500 dark:text-slate-500 text-xs whitespace-nowrap">{t('platformAdmin.settings.now')} {stats.totalClients}</span>
              </div>
            </div>
            <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-xs h-9"
              disabled={savingLimits} onClick={onSaveLimits}
            >
              {savingLimits ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Zap className="w-3.5 h-3.5 mr-1" />}
              {savingLimits ? t('platformAdmin.settings.saving') : t('platformAdmin.settings.saveLimits')}
            </Button>
          </div>
        </div>

        {/* Subscription */}
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-emerald-500/20 shadow-lg p-5">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center text-sm gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            {t('platformAdmin.settings.subscriptionSettings')}
          </h3>
          <div className="space-y-3">
            <div className="bg-gray-50/40 dark:bg-slate-900/40 rounded-xl border border-gray-200/60 dark:border-slate-700/30 p-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('platformAdmin.settings.monthlyPrice')}</label>
              <input type="number" step="0.01" value={formatPriceForInput(settingsForm.subscription_price)}
                onChange={e => setSettingsForm(s => ({ ...s, subscription_price: Number(e.target.value) }))}
                className="w-full bg-white/60 dark:bg-slate-800/60 border border-gray-300/60 dark:border-slate-600/50 text-gray-900 dark:text-white rounded-lg focus:border-emerald-500/50 text-sm p-2 outline-none"
              />
            </div>
            <div className="bg-gray-50/40 dark:bg-slate-900/40 rounded-xl border border-gray-200/60 dark:border-slate-700/30 p-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('platformAdmin.settings.freeTrialDays')}</label>
              <input type="number" value={settingsForm.trial_days}
                onChange={e => setSettingsForm(s => ({ ...s, trial_days: Number(e.target.value) }))}
                className="w-full bg-white/60 dark:bg-slate-800/60 border border-gray-300/60 dark:border-slate-600/50 text-gray-900 dark:text-white rounded-lg focus:border-emerald-500/50 text-sm p-2 outline-none"
              />
            </div>
            <Button className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs h-9"
              disabled={savingSubscription} onClick={onSaveSubscription}
            >
              {savingSubscription ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Zap className="w-3.5 h-3.5 mr-1" />}
              {savingSubscription ? t('platformAdmin.settings.saving') : t('platformAdmin.settings.saveSubscription')}
            </Button>
          </div>
        </div>

        {/* Email Config */}
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-purple-500/20 shadow-lg p-5">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center text-sm gap-2 mb-4">
            <Award className="w-4 h-4 text-purple-400" />
            {t('platformAdmin.settings.emailConfig')}
          </h3>
          <div className="space-y-3">
            <div className="bg-gray-50/40 dark:bg-slate-900/40 rounded-xl border border-gray-200/60 dark:border-slate-700/30 p-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('platformAdmin.settings.adminEmail')}</label>
              <input type="email" placeholder="admin@sahla4eco.com" defaultValue="admin@sahla4eco.com"
                className="w-full bg-white/60 dark:bg-slate-800/60 border border-gray-300/60 dark:border-slate-600/50 text-gray-900 dark:text-white rounded-lg focus:border-purple-500/50 text-sm p-2 outline-none"
              />
            </div>
            <div className="bg-gray-50/40 dark:bg-slate-900/40 rounded-xl border border-gray-200/60 dark:border-slate-700/30 p-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('platformAdmin.settings.supportEmail')}</label>
              <input type="email" placeholder="support@sahla4eco.com"
                className="w-full bg-white/60 dark:bg-slate-800/60 border border-gray-300/60 dark:border-slate-600/50 text-gray-900 dark:text-white rounded-lg focus:border-purple-500/50 text-sm p-2 outline-none"
              />
            </div>
            <label className="flex items-center text-gray-600 dark:text-slate-300 cursor-pointer text-sm gap-2">
              <input type="checkbox" defaultChecked className="rounded bg-slate-700 border-gray-300 dark:border-slate-600 w-4 h-4" />
              {t('platformAdmin.settings.paymentAlerts')}
            </label>
          </div>
        </div>

        {/* Security */}
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-red-500/20 shadow-lg p-5">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center text-sm gap-2 mb-4">
            <Shield className="w-4 h-4 text-red-400" />
            {t('platformAdmin.settings.securityOptions')}
          </h3>
          <div className="space-y-1">
            {[
              { label: t('platformAdmin.settings.enable2fa'), defaultChecked: true },
              { label: t('platformAdmin.settings.enableIpWhitelist'), defaultChecked: true },
              { label: t('platformAdmin.settings.enableAuditLogging'), defaultChecked: true },
              { label: t('platformAdmin.settings.enableMaintenanceMode'), defaultChecked: false },
            ].map((opt, i) => (
              <label key={i} className="flex items-center text-gray-600 dark:text-slate-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700/30 rounded-lg transition-all text-sm gap-2 p-2">
                <input type="checkbox" defaultChecked={opt.defaultChecked} className="rounded bg-slate-700 border-gray-300 dark:border-slate-600 w-4 h-4" />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Current Settings Display */}
      {platformSettings && (
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-5 shadow-lg">
          <h3 className="text-gray-900 dark:text-white font-bold text-sm mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-gray-500 dark:text-slate-400" />
            {t('platformAdmin.settings.currentSettings')}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-500">{t('platformAdmin.settings.maxUsers')}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{platformSettings.max_users || 1000}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-500">{t('platformAdmin.settings.maxStores')}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{platformSettings.max_stores || 1000}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-500">{t('platformAdmin.settings.subscriptionPrice')}</p>
              <p className="text-lg font-bold text-emerald-400">{platformSettings.subscription_price || 7} {t('platformAdmin.settings.perMonth')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-500">{t('platformAdmin.settings.trialDays')}</p>
              <p className="text-lg font-bold text-blue-400">{platformSettings.trial_days || 30} {t('platformAdmin.settings.days')}</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-600 mt-3">
            {t('platformAdmin.settings.lastUpdated')} {new Date(platformSettings.updated_at).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
