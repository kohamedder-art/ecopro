import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Lock, CreditCard, AlertCircle } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

/**
 * AccountLocked page - Shown when user's subscription has expired
 * They cannot access their store until they renew their subscription
 */
const AccountLocked = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const supportEmail = t("contact.card.email.content") || "support@walidstore.com";
  
  useEffect(() => {
    console.log("[AccountLocked] User redirected due to expired subscription");
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-gray-50 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-md w-full mx-auto px-6 py-12">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-red-100 dark:bg-red-900/30 rounded-full blur-xl"></div>
            <Lock className="w-16 h-16 text-red-600 dark:text-red-400 relative" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-900 dark:text-white">
          {t("accountLocked.title") || "Account Locked"}
        </h1>
        
        {/* Subheading */}
        <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
          {t("accountLocked.subtitle") || "Your subscription has expired"}
        </p>

        {/* Alert Box */}
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900 dark:text-red-200">
                {t("accountLocked.trialEnded") || "Your free trial or subscription has ended."}
              </p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {t("accountLocked.renewMessage") || "To continue using your store, please renew your subscription for 800 دج/month."}
              </p>
            </div>
          </div>
        </div>

        {/* Features that require subscription */}
        <div className="space-y-3 mb-8">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            {t("accountLocked.benefitsTitle") || "With an active subscription, you get:"}
          </h3>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              <span>{t("accountLocked.benefit1") || "Full access to your store"}</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              <span>{t("accountLocked.benefit2") || "Manage unlimited products"}</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              <span>{t("accountLocked.benefit3") || "Process customer orders"}</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              <span>{t("accountLocked.benefit4") || "Bot notifications & more"}</span>
            </li>
          </ul>
        </div>

        {/* Pricing info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-8 border border-blue-200 dark:border-blue-800">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              800 دج<span className="text-lg text-gray-600 dark:text-gray-400">/{t("billing.month") || "month"}</span>
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t("accountLocked.billingInfo") || "Billed monthly • Cancel anytime"}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Primary: Renew Subscription */}
          <button
            onClick={() => navigate("/billing")}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 group"
          >
            <CreditCard className="w-5 h-5 group-hover:scale-110 transition-transform" />
            {t("accountLocked.renewBtn") || "Renew Subscription"}
          </button>

          {/* Secondary: Contact Support */}
          <button
            onClick={() => navigate('/chat')}
            className="w-full bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold py-3 px-4 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
          >
            {t("accountLocked.contactSupport") || "Contact Support"}
          </button>

          {/* Tertiary: Logout */}
          <button
            onClick={() => {
              localStorage.removeItem("authToken");
              navigate("/login");
            }}
            className="w-full text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-semibold py-2 px-4 transition-colors text-sm"
          >
            {t("auth.logout") || "Sign Out"}
          </button>
        </div>

        {/* Footer text */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-center text-xs text-gray-500 dark:text-gray-400">
          <p>
            {t("accountLocked.needHelp") || "Need help?"} <a href="/chat" className="text-blue-600 dark:text-blue-400 hover:underline">{t("accountLocked.contactSupport") || "Contact Support"}</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AccountLocked;
