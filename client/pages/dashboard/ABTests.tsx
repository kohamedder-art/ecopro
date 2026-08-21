import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus, FlaskConical, Trash2,
  Eye, ShoppingCart, DollarSign, Loader2, Image as ImageIcon, ExternalLink,
  BarChart3, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

interface ABTest {
  id: number;
  name: string;
  status: "draft" | "running" | "paused" | "completed";
  public_id: string;
  created_at: string;
  variant_count: number;
  total_impressions: number;
  total_orders: number;
  total_revenue: number;
}

export default function ABTests() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTestName, setNewTestName] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchTests = useCallback(async () => {
    try {
      const res = await fetch("/api/client/ab-tests");
      if (res.ok) setTests(await res.json());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTests(); }, [fetchTests]);

  const createTest = async () => {
    if (!newTestName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/client/ab-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTestName }),
      });
      if (res.ok) {
        const test = await res.json();
        toast({ title: "Test created" });
        setShowCreate(false);
        setNewTestName("");
        navigate(`/dashboard/ab-tests/${test.id}`);
      }
    } catch {}
    finally { setCreating(false); }
  };

  const deleteTest = async (id: number) => {
    if (!confirm("Delete this test?")) return;
    try {
      const res = await fetch(`/api/client/ab-tests/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTests((prev) => prev.filter((t) => t.id !== id));
        toast({ title: "Test deleted" });
      }
    } catch {}
  };

  const statusConfig = {
    running: { bg: "bg-emerald-900/40", text: "text-emerald-400", border: "border-emerald-700/50", dot: "bg-emerald-400" },
    paused: { bg: "bg-amber-900/40", text: "text-amber-400", border: "border-amber-700/50", dot: "bg-amber-400" },
    completed: { bg: "bg-blue-900/40", text: "text-blue-400", border: "border-blue-700/50", dot: "bg-blue-400" },
    draft: { bg: "bg-slate-800/60", text: "text-slate-400", border: "border-slate-600/50", dot: "bg-slate-500" },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-500 border-t-transparent" />
          <span className="text-sm text-slate-400">Loading tests...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-screen-xl mx-auto px-3 sm:px-5 lg:px-6 py-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-black tracking-tight flex items-center gap-2 text-white">
              <span className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center shadow-lg shadow-slate-500/20 shrink-0">
                <FlaskConical className="w-4 h-4 text-slate-200" />
              </span>
              A/B Testing
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 mr-9 hidden sm:block">Test different hero images to find which brings more orders</p>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="h-8 gap-1.5 text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white px-2.5 sm:px-3 rounded-lg shadow-lg shadow-slate-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Test</span>
          </Button>
        </div>

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 p-5 w-full max-w-sm shadow-2xl shadow-black/50">
              <h2 className="text-sm font-black text-white mb-1">New A/B Test</h2>
              <p className="text-[11px] text-slate-500 mb-3">Give your test a name to identify it later</p>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Test Name</label>
              <Input
                value={newTestName}
                onChange={(e) => setNewTestName(e.target.value)}
                placeholder="e.g., Hero Image Test"
                className="h-9 text-xs bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-slate-500"
                onKeyDown={(e) => e.key === "Enter" && createTest()}
              />
              <div className="flex gap-2 mt-4 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)} className="h-8 text-xs text-slate-400 hover:text-white">
                  Cancel
                </Button>
                <Button
                  onClick={createTest}
                  disabled={!newTestName.trim() || creating}
                  size="sm"
                  className="h-8 text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white shadow-lg shadow-slate-500/20"
                >
                  {creating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Create
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Test list */}
        {tests.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 p-12 text-center">
            <FlaskConical className="w-10 h-10 mx-auto mb-3 text-slate-700" />
            <p className="text-sm font-bold text-slate-400 mb-1">No tests yet</p>
            <p className="text-xs text-slate-600 mb-4">Create your first A/B test to compare hero images</p>
            <Button
              onClick={() => setShowCreate(true)}
              className="h-8 gap-1.5 text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white px-3 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" /> Create Test
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {tests.map((test) => {
              const sc = statusConfig[test.status] || statusConfig.draft;
              const convRate = test.total_impressions > 0
                ? ((test.total_orders / test.total_impressions) * 100).toFixed(1)
                : "0.0";
              return (
                <div key={test.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors group">
                  <div className="px-3 py-3 sm:px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-black text-white truncate">{test.name}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 border ${sc.bg} ${sc.text} ${sc.border} uppercase tracking-wider`}>
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${sc.dot} mr-1 -mb-px`} />
                            {test.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" />
                            {test.variant_count} variant{test.variant_count !== 1 ? "s" : ""}
                          </span>
                          <span>{new Date(test.created_at).toLocaleDateString()}</span>
                          {test.status !== "draft" && (
                            <>
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {test.total_impressions.toLocaleString()} views
                              </span>
                              <span className="flex items-center gap-1">
                                <ShoppingCart className="w-3 h-3" />
                                {test.total_orders} orders
                              </span>
                              <span className="flex items-center gap-1 text-slate-400">
                                <BarChart3 className="w-3 h-3" />
                                {convRate}% conv
                              </span>
                              <span className="flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />
                                {test.total_revenue.toLocaleString()} DA
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Link
                          to={`/dashboard/ab-tests/${test.id}`}
                          className="h-8 px-2.5 inline-flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors border border-slate-700"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {test.status === "draft" ? "Edit" : "View"}
                        </Link>
                        <button
                          onClick={() => deleteTest(test.id)}
                          className="h-8 w-8 inline-flex items-center justify-center bg-slate-800 hover:bg-red-900/50 text-slate-500 hover:text-red-400 transition-colors border border-slate-700 hover:border-red-800"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
