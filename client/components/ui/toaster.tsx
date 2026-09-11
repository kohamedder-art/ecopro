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

const VARIANT_ICON: Record<string, { Icon: any; className: string; bar: string }> = {
  success: { Icon: CheckCircle2, className: "text-emerald-500", bar: "bg-emerald-500" },
  warning: { Icon: AlertTriangle, className: "text-amber-500", bar: "bg-amber-500" },
  info: { Icon: Info, className: "text-sky-500", bar: "bg-sky-500" },
  destructive: { Icon: XCircle, className: "text-red-500", bar: "bg-red-500" },
  default: { Icon: Info, className: "text-muted-foreground", bar: "bg-primary" },
};

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const variant = (props as any).variant || "default";
        const { Icon, className, bar } = VARIANT_ICON[variant] || VARIANT_ICON.default;
        const duration = (props as any).duration ?? 4000;
        return (
          <Toast key={id} {...props}>
            <Icon className={`h-5 w-5 shrink-0 ${className}`} />
            <div className="grid flex-1 gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
            <span
              aria-hidden
              className={`absolute bottom-0 start-0 h-0.5 w-full origin-left ${bar}`}
              style={{ animation: `toast-progress-shrink ${duration}ms linear forwards` }}
            />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
