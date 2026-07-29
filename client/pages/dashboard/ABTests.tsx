import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus, FlaskConical, Trash2,
  Eye, ShoppingCart, DollarSign, Loader2, Image as ImageIcon, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

interface ABTest {
  id: number;
  name: string;
  status: "draft" | "running" | "paused" | "completed";
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          <span className="text-sm text-black dark:text-white">Loading tests…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
    <div className="max-w-screen-xl mx-auto px-3 sm:px-5 lg:px-6 py-4 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-black tracking-tight flex items-center gap-2 text-black dark:text-white">
            <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/30 shrink-0">
              <FlaskConical className="w-4 h-4 text-white" />
            </span>
            A/B Testing
          </h1>
          <p className="text-xs text-black dark:text-white mt-0.5 mr-9 hidden sm:block">Create tracking links to see which ad image brings more orders</p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="h-8 gap-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-2.5 sm:px-3 rounded shadow-sm shadow-blue-500/30"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Test</span>
        </Button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 p-4 w-full max-w-sm shadow-lg">
            <h2 className="text-sm font-black text-black dark:text-white mb-3">New A/B Test</h2>
            <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Test Name</label>
            <Input
              value={newTestName}
              onChange={(e) => setNewTestName(e.target.value)}
              placeholder="e.g., Summer Sale Ads"
              className="h-8 text-xs border-gray-300 dark:border-slate-600"
              onKeyDown={(e) => e.key === "Enter" && createTest()}
            />
            <div className="flex gap-2 mt-4 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)} className="h-8 text-xs">Cancel</Button>
              <Button
                onClick={createTest}
                disabled={!newTestName.trim() || creating}
                size="sm"
                className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700"
              >
                {creating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Create
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Test list — card-like container */}
      {tests.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 p-12 text-center shadow-sm">
          <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm text-black dark:text-white">No tests yet. Create your first test to get tracking links for your ads.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 shadow-sm">
          <div className="divide-y divide-black dark:divide-slate-700">
            {tests.map((test) => (
              <div key={test.id} className="px-2.5 py-2.5 active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-black text-black dark:text-white truncate">{test.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        test.status === "running" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                        : test.status === "paused" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                        : test.status === "completed" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
                        : "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300"
                      }`}>
                        {test.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-black dark:text-white">
                      <span>{test.variant_count} images</span>
                      <span>{new Date(test.created_at).toLocaleDateString()}</span>
                      {test.status !== "draft" && (
                        <>
                          <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{test.total_impressions.toLocaleString()}</span>
                          <span className="flex items-center gap-0.5"><ShoppingCart className="w-3 h-3" />{test.total_orders}</span>
                          <span className="flex items-center gap-0.5"><DollarSign className="w-3 h-3" />{test.total_revenue.toLocaleString()} DA</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link
                      to={`/dashboard/ab-tests/${test.id}`}
                      className="h-8 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium active:bg-emerald-500/20 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {test.status === "draft" ? "Edit" : "View"}
                    </Link>
                    <button
                      onClick={() => deleteTest(test.id)}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-red-500/10 text-red-500 active:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
