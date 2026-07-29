import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function ABTestRedirect() {
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    if (!code) return;
    fetch(`/api/ab/redirect/${code}`)
      .then((r) => r.json())
      .then((data) => {
        window.location.href = data.url || "/";
      })
      .catch(() => {
        window.location.href = "/";
      });
  }, [code]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Redirecting…</p>
      </div>
    </div>
  );
}
