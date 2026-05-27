import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { X, Package, Truck, Bot, ShoppingCart, Check, ArrowRight, Sparkles } from "lucide-react";

interface Step {
  key: string;
  icon: React.ReactNode;
  titleKey: string;
  descKey: string;
  actionLabelKey: string;
  route: string;
  checkDone: () => Promise<boolean>;
}

export function OnboardingWizard() {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem("onboarding_dismissed") === "true";
  });
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const isRTL = locale === "ar";

  const steps: Step[] = [
    {
      key: "product",
      icon: <Package className="w-5 h-5" />,
      titleKey: "onboarding.product.title",
      descKey: "onboarding.product.desc",
      actionLabelKey: "onboarding.product.action",
      route: "/dashboard/preview",
      checkDone: async () => {
        try {
          const res = await fetch("/api/client/products?limit=1", { credentials: "include" });
          if (!res.ok) return false;
          const data = await res.json();
          return Array.isArray(data) && data.length > 0;
        } catch { return false; }
      },
    },
    {
      key: "delivery",
      icon: <Truck className="w-5 h-5" />,
      titleKey: "onboarding.delivery.title",
      descKey: "onboarding.delivery.desc",
      actionLabelKey: "onboarding.delivery.action",
      route: "/dashboard/delivery/pricing",
      checkDone: async () => {
        try {
          const res = await fetch("/api/client/store", { credentials: "include" });
          if (!res.ok) return false;
          const data = await res.json();
          return data.has_delivery_prices || data.delivery_zones?.length > 0;
        } catch { return false; }
      },
    },
    {
      key: "bot",
      icon: <Bot className="w-5 h-5" />,
      titleKey: "onboarding.bot.title",
      descKey: "onboarding.bot.desc",
      actionLabelKey: "onboarding.bot.action",
      route: "/dashboard/bot-settings",
      checkDone: async () => {
        try {
          const res = await fetch("/api/client/bot", { credentials: "include" });
          if (!res.ok) return false;
          const data = await res.json();
          return data.enabled === true;
        } catch { return false; }
      },
    },
    {
      key: "order",
      icon: <ShoppingCart className="w-5 h-5" />,
      titleKey: "onboarding.order.title",
      descKey: "onboarding.order.desc",
      actionLabelKey: "onboarding.order.action",
      route: "/dashboard/orders",
      checkDone: async () => {
        try {
          const res = await fetch("/api/orders/new-count", { credentials: "include" });
          if (!res.ok) return false;
          const data = await res.json();
          return (data.count || 0) > 0;
        } catch { return false; }
      },
    },
  ];

  useEffect(() => {
    const checkAll = async () => {
      setLoading(true);
      const results: Record<string, boolean> = {};
      for (const step of steps) {
        results[step.key] = await step.checkDone();
      }
      setCompleted(results);
      setLoading(false);
    };
    if (!dismissed) checkAll();
  }, [dismissed]);

  const allDone = steps.every(s => completed[s.key]);
  if (dismissed || allDone || loading) return null;

  const currentStepIndex = steps.findIndex(s => !completed[s.key]);
  const currentStep = steps[currentStepIndex] || steps[0];

  return (
    <div className="relative mb-6 rounded-2xl border border-blue-200/60 dark:border-blue-800/40 bg-gradient-to-br from-blue-50/80 to-indigo-50/60 dark:from-blue-950/30 dark:to-indigo-950/20 p-5 shadow-sm">
      <button
        onClick={() => {
          setDismissed(true);
          localStorage.setItem("onboarding_dismissed", "true");
        }}
        className="absolute top-3 right-3 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-muted-foreground"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-base text-foreground">
            {t("onboarding.title")}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("onboarding.subtitle")}
          </p>
        </div>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-1 mb-4">
        {steps.map((step, i) => {
          const done = completed[step.key];
          const isCurrent = i === currentStepIndex;
          return (
            <div key={step.key} className="flex items-center flex-1">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all shrink-0",
                  done
                    ? "bg-emerald-500 text-white"
                    : isCurrent
                    ? "bg-blue-600 text-white ring-2 ring-blue-300 dark:ring-blue-700"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-400"
                )}
              >
                {done ? <Check className="w-4 h-4" /> : step.icon}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-1 rounded-full",
                    done ? "bg-emerald-400" : "bg-slate-200 dark:bg-slate-700"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Current step action */}
      <div className="flex items-center justify-between gap-4 bg-white/60 dark:bg-white/5 rounded-xl p-3.5 border border-blue-100/50 dark:border-blue-900/30">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground">
            {t(currentStep.titleKey)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(currentStep.descKey)}
          </p>
        </div>
        <button
          onClick={() => navigate(currentStep.route)}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          {t(currentStep.actionLabelKey)}
          <ArrowRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
        </button>
      </div>
    </div>
  );
}
