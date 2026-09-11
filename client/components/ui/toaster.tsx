import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

const VARIANT_STYLE: Record<string, { Icon: any; iconWrap: string; icon: string; bar: string }> = {
  success: { Icon: CheckCircle2, iconWrap: "bg-emerald-500/15", icon: "text-emerald-500", bar: "bg-emerald-500" },
  warning: { Icon: AlertTriangle, iconWrap: "bg-amber-500/15", icon: "text-amber-500", bar: "bg-amber-500" },
  info: { Icon: Info, iconWrap: "bg-sky-500/15", icon: "text-sky-500", bar: "bg-sky-500" },
  destructive: { Icon: XCircle, iconWrap: "bg-red-500/15", icon: "text-red-500", bar: "bg-red-500" },
  default: { Icon: Info, iconWrap: "bg-primary/10", icon: "text-primary", bar: "bg-primary" },
};

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const variant = (props as any).variant || "default";
        const style = VARIANT_STYLE[variant] || VARIANT_STYLE.default;
        const duration = (props as any).duration ?? 4000;
        return (
          <Toast key={id} {...props}>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.iconWrap}`}>
              <style.Icon className={`h-5 w-5 ${style.icon}`} />
            </div>
            <div className="grid flex-1 gap-0.5 py-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
            <span
              aria-hidden
              className={`absolute bottom-0 start-0 h-[3px] w-full origin-left ${style.bar}`}
              style={{ animation: `toast-progress-shrink ${duration}ms linear forwards` }}
            />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
