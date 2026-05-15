import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { Home, ArrowLeft, Search, HelpCircle } from "lucide-react";
import { FloatingShapes } from "@/components/ui/floating-shapes";

const NotFound = () => {
  const { t } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden">
      <FloatingShapes variant="section" colors="cool" />
      
      <div className="relative z-10 text-center px-4 max-w-lg">
        {/* Large 404 with gradient */}
        <div className="relative mb-6">
          <h1 className="text-[120px] sm:text-[150px] font-black bg-gradient-to-br from-primary/20 to-accent/20 bg-clip-text text-transparent leading-none select-none">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl shadow-primary/30">
              <Search className="w-10 h-10 text-white" />
            </div>
          </div>
        </div>
        
        {/* Message */}
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white mb-3">
          {t('notfound.title') || "Page Not Found"}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-8 text-sm sm:text-base">
          {t('notfound.message')}
        </p>
        
        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <Link 
            to="/" 
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:scale-[1.02] transition-all"
          >
            <Home className="w-4 h-4" />
            {t('notfound.cta')}
          </Link>
          <button 
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold border-2 border-slate-200 dark:border-slate-700 hover:border-primary/30 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('notfound.goBack') || "Go Back"}
          </button>
        </div>
        
        {/* Help link */}
        <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-500">
          <HelpCircle className="w-4 h-4" />
          <span>{t('notfound.needHelp') || "Need help?"}</span>
          <Link to="/contact" className="text-primary hover:underline font-medium">
            {t('notfound.contactUs') || "Contact Support"}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

