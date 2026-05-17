import { useTranslation } from "@/lib/i18n";

export default function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  const text = t("footer.copyright", { year });

  return (
    <footer className="border-t bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto py-2 sm:py-3 px-2 sm:px-4">
        <div className="flex flex-col items-center justify-between gap-2 md:flex-row">
          <p className="text-xs text-muted-foreground">{text}</p>
          <nav className="flex items-center gap-2 sm:gap-3 text-xs">
            <a href="/#features" className="text-foreground/60 hover:text-foreground transition-colors">Features</a>
            <a href="/#architecture" className="text-foreground/60 hover:text-foreground transition-colors">Architecture</a>
            <a href="/#pricing" className="text-foreground/60 hover:text-foreground transition-colors">Pricing</a>
            <a href="/chat" className="text-foreground/60 hover:text-foreground transition-colors">Support</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
