import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Trash2, Loader2, Play, Pause,
  Eye, ShoppingCart, DollarSign, Copy, Check, Image as ImageIcon,
  TrendingUp, Link2, BarChart3, Crown, Package
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { uploadFileWithProgress } from "@/lib/api";

interface ABTest {
  id: number;
  name: string;
  status: string;
  public_id: string;
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

interface StoreProduct {
  id: number;
  title: string;
  name?: string;
  slug: string;
  price: number;
  images?: string[];
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
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [editingVariant, setEditingVariant] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<number | "">("");

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

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/client/store/products?limit=200");
      if (res.ok) {
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : data.products || []);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchTest(); fetchProducts(); }, [fetchTest, fetchProducts]);

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
        body: JSON.stringify({
          image_url: imageUrl,
          label: `Variant ${String.fromCharCode(65 + variants.length)}`,
          cta_text: "Shop Now",
          product_id: selectedProduct || undefined,
        }),
      });
      if (res.ok) {
        const v = await res.json();
        setVariants((prev) => [...prev, v]);
        toast({ title: "Variant added" });
        setSelectedProduct("");
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const updateVariantProduct = async (variantId: number, productId: number | null) => {
    try {
      const res = await fetch(`/api/client/ab-tests/${id}/variants/${variantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      });
      if (res.ok) {
        const updated = await res.json();
        setVariants((prev) => prev.map(v => v.id === variantId ? { ...v, ...updated } : v));
        setEditingVariant(null);
        toast({ title: "Product linked" });
      }
    } catch {}
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
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-500 border-t-transparent" />
          <span className="text-sm text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="max-w-screen-xl mx-auto px-3 sm:px-5 lg:px-6 py-16 text-center">
          <p className="text-sm text-slate-400">Test not found</p>
          <Button variant="ghost" onClick={() => navigate("/dashboard/ab-tests")} className="mt-2 text-xs text-slate-500">
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

  // Find winner
  const winner = variants.length >= 2 && totalOrders > 0
    ? [...variants].sort((a, b) => b.orders - a.orders)[0]
    : null;

  const statusConfig: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    running: { bg: "bg-emerald-900/40", text: "text-emerald-400", border: "border-emerald-700/50", dot: "bg-emerald-400" },
    paused: { bg: "bg-amber-900/40", text: "text-amber-400", border: "border-amber-700/50", dot: "bg-amber-400" },
    completed: { bg: "bg-blue-900/40", text: "text-blue-400", border: "border-blue-700/50", dot: "bg-blue-400" },
    draft: { bg: "bg-slate-800/60", text: "text-slate-400", border: "border-slate-600/50", dot: "bg-slate-500" },
  };
  const sc = statusConfig[test.status] || statusConfig.draft;

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-screen-xl mx-auto px-3 sm:px-5 lg:px-6 py-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/dashboard/ab-tests")}
              className="h-8 w-8 inline-flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white">{test.name}</h1>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 border ${sc.bg} ${sc.text} ${sc.border} uppercase tracking-wider inline-flex items-center gap-1`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                {test.status}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isDraft ? (
              <Button
                onClick={toggleTest}
                disabled={variants.length < 2}
                size="sm"
                className="h-8 gap-1.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white px-2.5 rounded-lg shadow-lg shadow-emerald-500/20 disabled:opacity-40"
              >
                <Play className="w-3.5 h-3.5" /> Start
              </Button>
            ) : (
              <Button
                onClick={toggleTest}
                size="sm"
                className="h-8 gap-1.5 text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white px-2.5 rounded-lg border border-slate-600"
              >
                {test.status === "running" ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Resume</>}
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        {test.status !== "draft" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { icon: Eye, label: "IMPRESSIONS", value: totalImpressions.toLocaleString(), color: "slate" },
              { icon: ShoppingCart, label: "ORDERS", value: totalOrders.toString(), color: "emerald" },
              { icon: TrendingUp, label: "CONVERSION", value: totalImpressions > 0 ? `${((totalOrders / totalImpressions) * 100).toFixed(1)}%` : "0%", color: "blue" },
              { icon: DollarSign, label: "REVENUE", value: `${totalRevenue.toLocaleString()} DA`, color: "amber" },
            ].map((stat) => (
              <div key={stat.label} className="bg-slate-900 border border-slate-800 px-3 py-2.5 flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg bg-${stat.color}-900/40 border border-${stat.color}-700/30 flex items-center justify-center shrink-0`}>
                  <stat.icon className={`w-4 h-4 text-${stat.color}-400`} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-lg font-black text-white leading-tight">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Winner banner */}
        {winner && winner.orders > 0 && (
          <div className="bg-emerald-950/50 border border-emerald-800/50 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-900/60 border border-emerald-700/40 flex items-center justify-center shrink-0">
              <Crown className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-emerald-300">
                Leading: {winner.label}
              </p>
              <p className="text-[11px] text-emerald-500">
                {winner.orders} orders · {Number(winner.revenue).toLocaleString()} DA · {winner.impressions > 0 ? ((winner.orders / winner.impressions) * 100).toFixed(1) : 0}% conversion
              </p>
            </div>
            {variants.length >= 2 && (
              <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">vs runner-up</p>
                <p className="text-xs font-bold text-slate-400">
                  +{winner.orders - [...variants].sort((a, b) => b.orders - a.orders)[1]?.orders} orders
                </p>
              </div>
            )}
          </div>
        )}

        {/* Variants header */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-black text-white">{variants.length} variant{variants.length !== 1 ? "s" : ""}</span>
          <div className="flex items-center gap-2">
            {/* Product picker */}
            {isDraft && products.length > 0 && (
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value ? Number(e.target.value) : "")}
                className="h-8 text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2 rounded-lg appearance-none cursor-pointer max-w-[160px]"
              >
                <option value="">No product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.title || p.name}</option>
                ))}
              </select>
            )}
            {/* Upload button */}
            {isDraft && (
              <label className="cursor-pointer">
                <input type="file" accept="image/*,.avif" onChange={handleImageUpload} className="hidden" />
                <span className="h-8 px-2.5 inline-flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors border border-slate-600">
                  {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  {uploading ? "Uploading..." : "Add Image"}
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Conversion comparison bars (only when running) */}
        {test.status !== "draft" && variants.length >= 2 && (
          <div className="bg-slate-900 border border-slate-800 px-4 py-3 space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Conversion Rate Comparison</p>
            {variants.map((v) => {
              const rate = v.impressions > 0 ? (v.orders / v.impressions) * 100 : 0;
              const maxRate = Math.max(...variants.map(x => x.impressions > 0 ? (x.orders / x.impressions) * 100 : 0), 1);
              const barWidth = (rate / maxRate) * 100;
              const isWinner = winner?.id === v.id && winner.orders > 0;
              return (
                <div key={v.id} className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400 w-20 truncate shrink-0">{v.label}</span>
                  <div className="flex-1 h-5 bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${isWinner ? 'bg-emerald-600' : 'bg-slate-600'}`}
                      style={{ width: `${Math.max(barWidth, 2)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold w-14 text-right ${isWinner ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {rate.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Variant cards */}
        {variants.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 p-12 text-center">
            <ImageIcon className="w-10 h-10 mx-auto mb-3 text-slate-700" />
            <p className="text-sm font-bold text-slate-400 mb-1">No images yet</p>
            <p className="text-xs text-slate-600 mb-4">Upload at least 2 variant images to start testing</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {variants.map((v) => {
              const rate = v.impressions > 0 ? ((v.orders / v.impressions) * 100).toFixed(1) : "0.0";
              const isWinner = winner?.id === v.id && winner.orders > 0;
              const isEditing = editingVariant === v.id;
              return (
                <div key={v.id} className={`bg-slate-900 border overflow-hidden transition-colors ${isWinner ? 'border-emerald-700/50' : 'border-slate-800 hover:border-slate-700'}`}>
                  <div className="flex flex-col sm:flex-row">
                    {/* Image thumb */}
                    <div className="sm:w-44 h-40 bg-slate-800 shrink-0 relative group/img">
                      <img src={v.image_url} alt={v.label} className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-black/70 text-white uppercase tracking-wider">
                          {v.label}
                        </span>
                        {isWinner && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-600 text-white flex items-center gap-0.5">
                            <Crown className="w-2.5 h-2.5" /> WINNER
                          </span>
                        )}
                      </div>
                      {isDraft && (
                        <button
                          onClick={() => deleteVariant(v.id)}
                          className="absolute top-2 right-2 h-7 w-7 inline-flex items-center justify-center bg-black/70 text-white hover:bg-red-600 opacity-0 group-hover/img:opacity-100 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-3 min-w-0 space-y-2">
                      {/* Tracking link */}
                      <div className="flex items-center gap-2">
                        <Link2 className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        <span className="text-[11px] font-mono text-slate-400 truncate">{window.location.origin}/r/{v.tracking_code}</span>
                        <button
                          onClick={() => copyLink(v.tracking_code)}
                          className="h-6 px-1.5 inline-flex items-center gap-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-slate-700 shrink-0"
                        >
                          {copied === v.tracking_code ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                          {copied === v.tracking_code ? "Copied" : "Copy"}
                        </button>
                      </div>

                      {/* Product link */}
                      <div className="flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 flex-1">
                            <select
                              defaultValue={v.product_id || ""}
                              onChange={(e) => updateVariantProduct(v.id, e.target.value ? Number(e.target.value) : null)}
                              className="h-6 text-[11px] bg-slate-800 border border-slate-700 text-slate-300 px-1.5 flex-1"
                              autoFocus
                              onBlur={() => setEditingVariant(null)}
                            >
                              <option value="">No product</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>{p.title || p.name}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingVariant(v.id)}
                            className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors truncate text-left"
                          >
                            {v.product_name
                              ? `${v.product_name}${v.product_price ? ` — ${Number(v.product_price).toLocaleString()} DA` : ""}`
                              : "Link product..."
                            }
                          </button>
                        )}
                      </div>

                      {/* Stats row */}
                      {test.status !== "draft" ? (
                        <div className="flex items-center gap-3 pt-1 border-t border-slate-800">
                          {[
                            { label: "Views", value: v.impressions.toLocaleString() },
                            { label: "Clicks", value: v.clicks.toString() },
                            { label: "Orders", value: v.orders.toString(), highlight: isWinner },
                            { label: "Conv", value: `${rate}%`, highlight: isWinner },
                            { label: "Revenue", value: `${Number(v.revenue).toLocaleString()} DA` },
                          ].map((s) => (
                            <div key={s.label} className="text-center min-w-0">
                              <p className={`text-xs font-black tabular-nums ${s.highlight ? 'text-emerald-400' : 'text-white'}`}>
                                {s.value}
                              </p>
                              <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">{s.label}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-600 pt-1">Start the test to collect data</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Share link helper */}
        {test.status === "running" && (
          <div className="bg-slate-900 border border-slate-800 px-4 py-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">How to use</p>
            <p className="text-xs text-slate-400">
              Append <code className="bg-slate-800 px-1 py-0.5 text-slate-300 font-mono">?ab={test.public_id}</code> to any product page URL to activate A/B image testing.
              Visitors will be randomly assigned a variant and always see the same image on return visits.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
