import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Trash2, Loader2, Play, Pause,
  Eye, ShoppingCart, DollarSign, Copy, Check, Image as ImageIcon, ExternalLink,
  TrendingUp, FlaskConical, Link2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { uploadFileWithProgress } from "@/lib/api";

interface ABTest {
  id: number;
  name: string;
  status: string;
  store_slug?: string;
  store_subdomain?: string;
}

interface ABVariant {
  id: number;
  label: string;
  image_url: string;
  tracking_code: string;
  product_id?: number;
  product_name?: string;
  product_slug?: string;
  product_price?: number;
  impressions: number;
  clicks: number;
  orders: number;
  revenue: number;
}

export default function ABTestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [test, setTest] = useState<ABTest | null>(null);
  const [variants, setVariants] = useState<ABVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchTest = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/client/ab-tests/${id}`);
      if (res.ok) {
        const data = await res.json();
        setTest(data);
        setVariants(data.variants || []);
      }
    } catch {}
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchTest(); }, [fetchTest]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadFileWithProgress(file, () => {});
      const imageUrl = result?.url || result?.urls?.[0];
      if (!imageUrl) throw new Error("Upload failed");

      const res = await fetch(`/api/client/ab-tests/${id}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageUrl, label: `Variant ${String.fromCharCode(65 + variants.length)}`, cta_text: "Shop Now" }),
      });
      if (res.ok) {
        const v = await res.json();
        setVariants((prev) => [...prev, v]);
        toast({ title: "Variant added" });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const deleteVariant = async (vid: number) => {
    if (!confirm("Remove this variant?")) return;
    try {
      const res = await fetch(`/api/client/ab-tests/${id}/variants/${vid}`, { method: "DELETE" });
      if (res.ok) {
        setVariants((prev) => prev.filter((v) => v.id !== vid));
        toast({ title: "Variant removed" });
      }
    } catch {}
  };

  const toggleTest = async () => {
    if (!test) return;
    const newStatus = test.status === "running" ? "paused" : "running";
    try {
      const res = await fetch(`/api/client/ab-tests/${test.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setTest((prev) => prev ? { ...prev, status: newStatus } : null);
        toast({ title: newStatus === "running" ? "Test started!" : "Test paused" });
      }
    } catch {}
  };

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/r/${code}`);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          <span className="text-sm text-black dark:text-white">Loading…</span>
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-screen-xl mx-auto px-3 sm:px-5 lg:px-6 py-16 text-center">
        <p className="text-sm text-black dark:text-white">Test not found</p>
        <Button variant="ghost" onClick={() => navigate("/dashboard/ab-tests")} className="mt-2 text-xs">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
        </Button>
      </div>
      </div>
    );
  }

  const totalImpressions = variants.reduce((a, v) => a + v.impressions, 0);
  const totalOrders = variants.reduce((a, v) => a + v.orders, 0);
  const totalRevenue = variants.reduce((a, v) => a + Number(v.revenue), 0);
  const isDraft = test.status === "draft";

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
    <div className="max-w-screen-xl mx-auto px-3 sm:px-5 lg:px-6 py-4 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/dashboard/ab-tests")}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-muted text-black dark:text-white active:bg-muted/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-black tracking-tight text-black dark:text-white">{test.name}</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            test.status === "running" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
            : test.status === "paused" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
            : test.status === "completed" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
            : "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300"
          }`}>{test.status.toUpperCase()}</span>
          {isDraft ? (
            <Button
              onClick={toggleTest}
              disabled={variants.length < 2}
              size="sm"
              className="h-8 gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 rounded shadow-sm"
            >
              <Play className="w-3.5 h-3.5" /> Start
            </Button>
          ) : (
            <Button
              onClick={toggleTest}
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-bold rounded border-gray-300 dark:border-slate-600"
            >
              {test.status === "running" ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Resume</>}
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      {test.status !== "draft" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
          <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-600 px-2.5 py-2 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">VISITS</p>
              <p className="text-lg font-black text-black dark:text-white leading-tight">{(totalImpressions).toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-600 px-2.5 py-2 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">ORDERS</p>
              <p className="text-lg font-black text-black dark:text-white leading-tight">{totalOrders}</p>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-600 px-2.5 py-2 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">CONV.</p>
              <p className="text-lg font-black text-black dark:text-white leading-tight">{totalImpressions > 0 ? ((totalOrders / totalImpressions) * 100).toFixed(1) : 0}%</p>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-600 px-2.5 py-2 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">REVENUE</p>
              <p className="text-lg font-black text-black dark:text-white leading-tight">{totalRevenue.toLocaleString()} <span className="text-xs font-bold text-gray-500 dark:text-gray-400">DA</span></p>
            </div>
          </div>
        </div>
      )}

      {/* Winner banner */}
      {test.status !== "draft" && variants.length >= 2 && (
        (() => {
          const winner = [...variants].sort((a, b) => b.orders - a.orders)[0];
          if (winner.orders === 0) return null;
          return (
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 px-2.5 py-2 flex items-center gap-2.5">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                <strong>Winning: {winner.label}</strong> — {winner.orders} orders · {Number(winner.revenue).toLocaleString()} DA · {winner.impressions > 0 ? ((winner.orders / winner.impressions) * 100).toFixed(1) : 0}% conv
              </p>
            </div>
          );
        })()
      )}

      {/* Variants header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-black text-black dark:text-white">{variants.length} variant{variants.length !== 1 ? "s" : ""}</span>
        {isDraft && (
          <label className="cursor-pointer">
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            <span className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-medium active:bg-blue-500/20 transition-colors">
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              {uploading ? "Uploading..." : "Add Image"}
            </span>
          </label>
        )}
      </div>

      {/* Variant cards */}
      {variants.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 p-12 text-center shadow-sm">
          <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm text-black dark:text-white">No images yet. Upload at least 2 variants to start testing.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {variants.map((v) => (
            <div key={v.id} className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 overflow-hidden shadow-sm">
              <div className="flex flex-col sm:flex-row">
                {/* Image thumb */}
                <div className="sm:w-48 h-40 bg-gray-100 dark:bg-slate-800 shrink-0 relative">
                  <img src={v.image_url} alt={v.label} className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-black/60 text-white rounded">{v.label}</span>
                  </div>
                  {isDraft && (
                    <button
                      onClick={() => deleteVariant(v.id)}
                      className="absolute top-2 right-2 h-7 w-7 inline-flex items-center justify-center rounded bg-black/60 text-white hover:bg-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {/* Content */}
                <div className="flex-1 p-3 min-w-0">
                  {/* Tracking link */}
                  <div className="flex items-center gap-2 mb-2">
                    <Link2 className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                    <span className="text-[11px] font-mono text-black dark:text-white truncate">{window.location.origin}/r/{v.tracking_code}</span>
                    <button
                      onClick={() => copyLink(v.tracking_code)}
                      className="h-7 px-2 inline-flex items-center gap-1 rounded text-xs bg-blue-500/10 text-blue-700 dark:text-blue-400 font-medium active:bg-blue-500/20 transition-colors shrink-0"
                    >
                      {copied === v.tracking_code ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied === v.tracking_code ? "Copied!" : "Copy"}
                    </button>
                  </div>

                  {/* Product info */}
                  {v.product_name && (
                    <div className="text-[11px] text-black dark:text-white mb-2 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      {v.product_name}{v.product_price ? ` — ${Number(v.product_price).toLocaleString()} DA` : ""}
                    </div>
                  )}

                  {/* Stats */}
                  {test.status !== "draft" ? (
                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-center">
                        <p className="font-black text-black dark:text-white">{v.impressions.toLocaleString()}</p>
                        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Views</p>
                      </div>
                      <div className="text-center">
                        <p className="font-black text-black dark:text-white">{v.clicks}</p>
                        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Clicks</p>
                      </div>
                      <div className="text-center">
                        <p className="font-black text-black dark:text-white">{v.orders}</p>
                        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Orders</p>
                      </div>
                      <div className="text-center">
                        <p className="font-black text-black dark:text-white">{v.impressions > 0 ? ((v.orders / v.impressions) * 100).toFixed(1) : 0}%</p>
                        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Conv</p>
                      </div>
                      <div className="text-center">
                        <p className="font-black text-black dark:text-white">{Number(v.revenue).toLocaleString()}</p>
                        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">DA</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-500">Start the test to collect data</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </div>
  );
}
