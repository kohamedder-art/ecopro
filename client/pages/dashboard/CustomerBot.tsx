import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare, Users, CheckCircle, XCircle, Clock,
  AlertTriangle, Send, Plus, Trash2, Eye, Loader2, Sparkles,
} from "lucide-react";

interface CustomerSegment { all: number; completed: number; cancelled: number; pending: number; failed_delivery: number; }
interface Campaign { id: number; name: string; message: string; target_category: string; channel: string; status: string; recipients_count: number; sent_count: number; failed_count: number; created_at: string; sent_at: string | null; }
interface MessageLog { id: number; customer_phone: string; customer_name: string; status: string; error_message: string | null; sent_at: string; }

const SEGMENT_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  all:            { label: "كل العملاء",       icon: Users,         color: "text-blue-500"   },
  completed:      { label: "طلبات مكتملة",     icon: CheckCircle,   color: "text-green-500"  },
  cancelled:      { label: "طلبات ملغاة",      icon: XCircle,       color: "text-red-500"    },
  pending:        { label: "طلبات معلقة",      icon: Clock,         color: "text-yellow-500" },
  failed_delivery:{ label: "فشل التوصيل",     icon: AlertTriangle, color: "text-orange-500" },
};

const EMPTY_SEGMENTS: CustomerSegment = { all: 0, completed: 0, cancelled: 0, pending: 0, failed_delivery: 0 };

type CustomerBotProps = { embedded?: boolean };

export default function CustomerBot({ embedded = false }: CustomerBotProps) {
  const navigate = useNavigate();
  const [segments, setSegments] = useState<CustomerSegment | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendingCampaign, setSendingCampaign] = useState<number | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [showLogs, setShowLogs] = useState<number | null>(null);
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [campaignName, setCampaignName] = useState("");
  const [campaignMessage, setCampaignMessage] = useState("");
  const [targetSegment, setTargetSegment] = useState("all");
  const [campaignChannel, setCampaignChannel] = useState("auto");
  const [creating, setCreating] = useState(false);
  const [aiComposing, setAiComposing] = useState(false);

  const composeWithAI = async () => {
    if (!campaignName.trim()) { alert("أدخل اسم الحملة أولاً حتى يعرف الذكاء الاصطناعي الموضوع."); return; }
    setAiComposing(true);
    try {
      const csrfMatch = document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/);
      const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
      const res = await fetch('/api/ai/whatsapp/compose', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ campaignName, targetSegment, segmentCount: segments?.[targetSegment as keyof CustomerSegment] ?? 0 }),
      });
      if (res.ok) { const data = await res.json(); setCampaignMessage(data.message || data.text || ''); }
      else { const err = await res.json().catch(() => ({})); alert(err.error || 'فشل الذكاء الاصطناعي. حاول مجدداً.'); }
    } catch { alert('تعذر الاتصال بخدمة الذكاء الاصطناعي.'); }
    finally { setAiComposing(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true); setLoadError(null);
      const [segmentsRes, campaignsRes] = await Promise.all([
        fetch("/api/customer-bot/segments"),
        fetch("/api/customer-bot/campaigns"),
      ]);
      if (segmentsRes.status === 401 || campaignsRes.status === 401) {
        setSegments(EMPTY_SEGMENTS); setCampaigns([]);
        setLoadError("غير مصادق عليك. الرجاء تسجيل الدخول مجدداً."); return;
      }
      if (segmentsRes.ok) setSegments(await segmentsRes.json());
      else { setSegments(EMPTY_SEGMENTS); setLoadError("فشل تحميل إحصاءات العملاء."); }
      if (campaignsRes.ok) setCampaigns(await campaignsRes.json());
      else { setCampaigns([]); setLoadError((p) => p || "فشل تحميل الحملات."); }
    } catch { setSegments(EMPTY_SEGMENTS); setCampaigns([]); setLoadError("تعذر الاتصال بالخادم."); }
    finally { setLoading(false); }
  };

  const createCampaign = async () => {
    if (!campaignName.trim() || !campaignMessage.trim()) { alert("أدخل اسم الحملة والرسالة"); return; }
    try {
      setCreating(true);
      const res = await fetch("/api/customer-bot/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: campaignName, message: campaignMessage, target_category: targetSegment, channel: campaignChannel }),
      });
      if (res.ok) {
        setCampaigns([await res.json(), ...campaigns]);
        setCampaignName(""); setCampaignMessage(""); setTargetSegment("all"); setShowComposer(false);
      } else { const err = await res.json(); alert(err.error || "فشل إنشاء الحملة"); }
    } catch { alert("حدث خطأ أثناء إنشاء الحملة"); }
    finally { setCreating(false); }
  };

  const sendCampaign = async (campaignId: number) => {
    if (!confirm("هل أنت متأكد من إرسال هذه الحملة؟")) return;
    try {
      setSendingCampaign(campaignId);
      const res = await fetch(`/api/customer-bot/campaigns/${campaignId}/send`, { method: "POST" });
      const data = await res.json();
      if (res.ok) { alert(`تم الإرسال!\nنجح: ${data.sent}\nفشل: ${data.failed}`); fetchData(); }
      else alert(data.error || "فشل الإرسال");
    } catch { alert("حدث خطأ أثناء الإرسال"); }
    finally { setSendingCampaign(null); }
  };

  const deleteCampaign = async (campaignId: number) => {
    if (!confirm("هل أنت متأكد من حذف هذه الحملة؟")) return;
    try {
      const res = await fetch(`/api/customer-bot/campaigns/${campaignId}`, { method: "DELETE" });
      if (res.ok) setCampaigns(campaigns.filter((c) => c.id !== campaignId));
    } catch { /* ignore */ }
  };

  const viewLogs = async (campaignId: number) => {
    try {
      setShowLogs(campaignId); setLogsLoading(true);
      const res = await fetch(`/api/customer-bot/campaigns/${campaignId}/logs`);
      if (res.ok) setLogs(await res.json());
    } catch { /* ignore */ }
    finally { setLogsLoading(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-8" dir="rtl">
      <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
      <span className="mr-2 text-sm text-slate-500">جاري التحميل...</span>
    </div>
  );

  return (
    <div className={embedded ? "bg-transparent" : "bg-gray-50 dark:bg-slate-900 min-h-screen"} dir="rtl">
      <div className={embedded ? "px-2 py-3" : "max-w-7xl mx-auto px-4 py-8"}>

        {/* Page header — standalone only */}
        {!embedded && (
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-violet-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">بوت التحديثات</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">أرسل رسائل مخصصة لعملائك</p>
              </div>
            </div>
            <button onClick={() => navigate("/dashboard")}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white text-sm">
              رجوع
            </button>
          </div>
        )}

        {loadError && (
          <div className="mb-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 p-3 text-amber-800 dark:text-amber-200 text-sm">
            {loadError}
          </div>
        )}

        {/* Segment Stats — compact grid for embedded */}
        <div className={`grid gap-2 mb-4 ${embedded ? 'grid-cols-5' : 'grid-cols-2 md:grid-cols-5'}`}>
          {Object.entries(SEGMENT_LABELS).map(([key, { label, icon: Icon, color }]) => (
            <div key={key} className="bg-white dark:bg-slate-800 rounded-xl p-2.5 border border-gray-100 dark:border-slate-700 flex flex-col items-center gap-1 text-center">
              <Icon className={`w-4 h-4 ${color}`} />
              <p className="text-lg font-bold text-gray-800 dark:text-white leading-none">
                {(segments || EMPTY_SEGMENTS)[key as keyof CustomerSegment]}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {/* Actions bar */}
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-bold text-gray-800 dark:text-white">الحملات</h2>
          <button onClick={() => setShowComposer(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm font-semibold">
            <Plus className="w-4 h-4" />
            حملة جديدة
          </button>
        </div>

        {/* Campaign Composer Modal */}
        {showComposer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-800 dark:text-white">إنشاء حملة جديدة</h3>
                <button onClick={() => setShowComposer(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                  <XCircle className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم الحملة</label>
                  <input type="text" value={campaignName} onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="مثال: عرض خاص لعملاء VIP"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الشريحة المستهدفة</label>
                  <select value={targetSegment} onChange={(e) => setTargetSegment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm">
                    {Object.entries(SEGMENT_LABELS).map(([key, { label }]) => (
                      <option key={key} value={key}>{label} ({segments?.[key as keyof CustomerSegment] || 0} عميل)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">قناة الإرسال</label>
                  <select value={campaignChannel} onChange={(e) => setCampaignChannel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm">
                    <option value="auto">🔄 تلقائي (الكشف الذكي)</option>
                    <option value="telegram">📱 Telegram</option>
                    <option value="whatsapp_cloud">💬 WhatsApp</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">الوضع التلقائي يرسل عبر القناة التي اتصل بها العميل</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">الرسالة</label>
                    <button type="button" onClick={composeWithAI} disabled={aiComposing}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                      {aiComposing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {aiComposing ? 'يكتب...' : 'AI كتابة'}
                    </button>
                  </div>
                  <textarea value={campaignMessage} onChange={(e) => setCampaignMessage(e.target.value)}
                    placeholder={`مرحباً {name}،\n\nنودّ إعلامك...`} rows={4}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white resize-none text-sm" />
                  <p className="text-xs text-gray-500 mt-1">استخدم {"{name}"} لإدراج اسم العميل تلقائياً</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setShowComposer(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-sm text-gray-800 dark:text-white">
                  إلغاء
                </button>
                <button onClick={createCampaign} disabled={creating}
                  className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-semibold">
                  {creating ? <><Loader2 className="w-4 h-4 animate-spin" />جاري الإنشاء...</> : <><Plus className="w-4 h-4" />إنشاء الحملة</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Logs Modal */}
        {showLogs && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-800 dark:text-white">سجل الإرسال</h3>
                <button onClick={() => setShowLogs(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                  <XCircle className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {logsLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
                ) : logs.length === 0 ? (
                  <p className="text-center text-gray-500 py-8 text-sm">لا توجد سجلات</p>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div key={log.id} className={`p-3 rounded-lg border ${log.status === "sent" ? "bg-green-50 dark:bg-green-900/20 border-green-200" : "bg-red-50 dark:bg-red-900/20 border-red-200"}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-800 dark:text-white">{log.customer_name || "عميل"}</p>
                            <p className="text-xs text-gray-500">{log.customer_phone}</p>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${log.status === "sent" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {log.status === "sent" ? <><CheckCircle className="w-3 h-3" />تم الإرسال</> : <><XCircle className="w-3 h-3" />فشل</>}
                          </span>
                        </div>
                        {log.error_message && <p className="text-xs text-red-600 mt-1">{log.error_message}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Campaigns List */}
        {campaigns.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border border-gray-100 dark:border-slate-700">
            <MessageSquare className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-800 dark:text-white mb-1">لا توجد حملات</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">ابدأ بإنشاء أول حملة للتواصل مع عملائك</p>
            <button onClick={() => setShowComposer(true)}
              className="inline-flex items-center gap-2 px-5 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-semibold">
              <Plus className="w-4 h-4" />إنشاء حملة
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm font-bold text-gray-800 dark:text-white">{campaign.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        campaign.status === "sent" ? "bg-green-100 dark:bg-green-900/30 text-green-700"
                        : campaign.status === "sending" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700"
                        : "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300"}`}>
                        {campaign.status === "sent" ? "تم الإرسال" : campaign.status === "sending" ? "يُرسل..." : "مسودة"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mb-2 line-clamp-2 whitespace-pre-wrap">{campaign.message}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      {(() => { const seg = SEGMENT_LABELS[campaign.target_category]; const Icon = seg?.icon || Users; return <span className="flex items-center gap-1"><Icon className={`w-3 h-3 ${seg?.color || "text-gray-400"}`} />{seg?.label || campaign.target_category}</span>; })()}
                      {campaign.status === "sent" && (<>
                        <span>مستلمون: {campaign.recipients_count}</span>
                        <span className="text-green-600">نجح: {campaign.sent_count}</span>
                        {campaign.failed_count > 0 && <span className="text-red-600">فشل: {campaign.failed_count}</span>}
                      </>)}
                      <span>{new Date(campaign.created_at).toLocaleDateString("ar-DZ")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {campaign.status === "sent" && (
                      <button onClick={() => viewLogs(campaign.id)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg" title="عرض السجل">
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    {campaign.status === "draft" && (<>
                      <button onClick={() => sendCampaign(campaign.id)} disabled={sendingCampaign === campaign.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-xs font-semibold">
                        {sendingCampaign === campaign.id ? <><Loader2 className="w-3 h-3 animate-spin" />يُرسل...</> : <><Send className="w-3 h-3" />إرسال</>}
                      </button>
                      <button onClick={() => deleteCampaign(campaign.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg" title="حذف">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>)}
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
