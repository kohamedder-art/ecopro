import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Send,
  Plus,
  Trash2,
  Eye,
  Loader2,
  Sparkles,
} from "lucide-react";

interface CustomerSegment {
  all: number;
  completed: number;
  cancelled: number;
  pending: number;
  failed_delivery: number;
}

interface Campaign {
  id: number;
  name: string;
  message: string;
  target_category: string;
  channel: string;
  status: string;
  recipients_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  sent_at: string | null;
}

interface MessageLog {
  id: number;
  customer_phone: string;
  customer_name: string;
  status: string;
  error_message: string | null;
  sent_at: string;
}

const SEGMENT_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  all: { label: "All Customers", icon: Users, color: "text-blue-500" },
  completed: { label: "Completed Orders", icon: CheckCircle, color: "text-green-500" },
  cancelled: { label: "Cancelled Orders", icon: XCircle, color: "text-red-500" },
  pending: { label: "Pending Orders", icon: Clock, color: "text-yellow-500" },
  failed_delivery: { label: "Failed Delivery", icon: AlertTriangle, color: "text-orange-500" },
};

const EMPTY_SEGMENTS: CustomerSegment = {
  all: 0,
  completed: 0,
  cancelled: 0,
  pending: 0,
  failed_delivery: 0,
};

type CustomerBotProps = {
  embedded?: boolean;
};

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
  
  // Composer form state
  const [campaignName, setCampaignName] = useState("");
  const [campaignMessage, setCampaignMessage] = useState("");
  const [targetSegment, setTargetSegment] = useState("all");
  const [campaignChannel, setCampaignChannel] = useState("auto");
  const [creating, setCreating] = useState(false);
  const [aiComposing, setAiComposing] = useState(false);

  const composeWithAI = async () => {
    if (!campaignName.trim()) {
      alert('Please enter a campaign name first so AI knows the topic.');
      return;
    }
    setAiComposing(true);
    try {
      const csrfMatch = document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/);
      const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
      const res = await fetch('/api/ai/whatsapp/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        credentials: 'include',
        body: JSON.stringify({
          campaignName,
          targetSegment,
          segmentCount: segments?.[targetSegment as keyof CustomerSegment] ?? 0,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCampaignMessage(data.message || data.text || '');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'AI compose failed. Please try again.');
      }
    } catch {
      alert('Could not reach AI service.');
    } finally {
      setAiComposing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [segmentsRes, campaignsRes] = await Promise.all([
        fetch("/api/customer-bot/segments"),
        fetch("/api/customer-bot/campaigns"),
      ]);

      if (segmentsRes.status === 401 || campaignsRes.status === 401) {
        setSegments(EMPTY_SEGMENTS);
        setCampaigns([]);
        setLoadError("Not authenticated. Please log in again.");
        return;
      }

      if (segmentsRes.ok) {
        const segData = await segmentsRes.json();
        setSegments(segData);
      } else {
        setSegments(EMPTY_SEGMENTS);
        setLoadError("Failed to load customer statistics.");
      }

      if (campaignsRes.ok) {
        const campData = await campaignsRes.json();
        setCampaigns(campData);
      } else {
        setCampaigns([]);
        setLoadError((prev) => prev || "Failed to load campaigns.");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setSegments(EMPTY_SEGMENTS);
      setCampaigns([]);
      setLoadError("Could not connect to server. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  const createCampaign = async () => {
    if (!campaignName.trim() || !campaignMessage.trim()) {
      alert("Please enter campaign name and message");
      return;
    }

    try {
      setCreating(true);
      const res = await fetch("/api/customer-bot/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: campaignName,
          message: campaignMessage,
          target_category: targetSegment,
          channel: campaignChannel,
        }),
      });

      if (res.ok) {
        const newCampaign = await res.json();
        setCampaigns([newCampaign, ...campaigns]);
        setCampaignName("");
        setCampaignMessage("");
        setTargetSegment("all");
        setShowComposer(false);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create campaign");
      }
    } catch (error) {
      console.error("Error creating campaign:", error);
      alert("An error occurred while creating the campaign");
    } finally {
      setCreating(false);
    }
  };

  const sendCampaign = async (campaignId: number) => {
    if (!confirm("Are you sure you want to send this campaign?")) {
      return;
    }

    try {
      setSendingCampaign(campaignId);
      const res = await fetch(`/api/customer-bot/campaigns/${campaignId}/send`, {
        method: "POST",
      });

      const data = await res.json();
      if (res.ok) {
        alert(`Campaign sent!\nSucceeded: ${data.sent}\nFailed: ${data.failed}`);
        fetchData(); // Refresh campaigns
      } else {
        alert(data.error || "Failed to send campaign");
      }
    } catch (error) {
      console.error("Error sending campaign:", error);
      alert("An error occurred while sending the campaign");
    } finally {
      setSendingCampaign(null);
    }
  };

  const deleteCampaign = async (campaignId: number) => {
    if (!confirm("Are you sure you want to delete this campaign?")) {
      return;
    }

    try {
      const res = await fetch(`/api/customer-bot/campaigns/${campaignId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setCampaigns(campaigns.filter((c) => c.id !== campaignId));
      }
    } catch (error) {
      console.error("Error deleting campaign:", error);
    }
  };

  const viewLogs = async (campaignId: number) => {
    try {
      setShowLogs(campaignId);
      setLogsLoading(true);
      const res = await fetch(`/api/customer-bot/campaigns/${campaignId}/logs`, {
      });

      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLogsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={embedded ? "bg-transparent flex items-center justify-center p-8" : "bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-8"} dir="rtl">
        <div className="flex items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="text-gray-600 dark:text-gray-300">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "bg-transparent" : "bg-gray-50 dark:bg-slate-900 min-h-screen"} dir="rtl">
      <div className={embedded ? "px-4 py-4" : "max-w-7xl mx-auto px-4 py-8"}>
        {!embedded && (
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-green-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Customer Updates Bot</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">Send custom messages to your customers</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/dashboard")}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-800 dark:text-white"
            >
              Back
            </button>
          </div>
        )}

        {loadError && (
          <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 p-3 text-amber-800 dark:text-amber-200 text-sm">
            {loadError}
          </div>
        )}

        {/* Segment Stats */}
        {(segments || EMPTY_SEGMENTS) && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {Object.entries(SEGMENT_LABELS).map(([key, { label, icon: Icon, color }]) => (
              <div
                key={key}
                className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gray-50 dark:bg-slate-700 ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-800 dark:text-white">
                      {(segments || EMPTY_SEGMENTS)[key as keyof CustomerSegment]}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Campaigns</h2>
          <button
            onClick={() => setShowComposer(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Campaign
          </button>
        </div>

        {/* Campaign Composer Modal */}
        {showComposer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">Create New Campaign</h3>
                <button
                  onClick={() => setShowComposer(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  <XCircle className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="Example: Special offer for VIP customers"
                    className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Target Segment
                  </label>
                  <select
                    value={targetSegment}
                    onChange={(e) => setTargetSegment(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  >
                    {Object.entries(SEGMENT_LABELS).map(([key, { label }]) => (
                      <option key={key} value={key}>
                        {label} ({segments?.[key as keyof CustomerSegment] || 0} customers)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">                    Send via Channel
                  </label>
                  <select
                    value={campaignChannel}
                    onChange={(e) => setCampaignChannel(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  >
                    <option value="auto">🔄 Auto (Smart Detection)</option>
                    <option value="telegram">📱 Telegram</option>
                    <option value="whatsapp_cloud">💬 WhatsApp</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Auto mode sends via the channel each customer is connected to
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
                    <button
                      type="button"
                      onClick={composeWithAI}
                      disabled={aiComposing}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      {aiComposing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {aiComposing ? 'Composing...' : 'AI Compose'}
                    </button>
                  </div>
                  <textarea
                    value={campaignMessage}
                    onChange={(e) => setCampaignMessage(e.target.value)}
                    placeholder={`Hello {name},\n\nWe'd like to inform you...`}
                    rows={5}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Use {"{"}name{"}"}  to automatically insert customer name
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowComposer(false)}
                  className="flex-1 px-4 py-3 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-gray-800 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={createCampaign}
                  disabled={creating}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Create Campaign
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Logs Modal */}
        {showLogs && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">Send Log</h3>
                <button
                  onClick={() => setShowLogs(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  <XCircle className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {logsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : logs.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">No records</p>
                ) : (
                  <div className="space-y-3">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className={`p-4 rounded-lg border ${
                          log.status === "sent"
                            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                            : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-800 dark:text-white">
                              {log.customer_name || "Customer"}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{log.customer_phone}</p>
                          </div>
                          <div className="text-left">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                log.status === "sent"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {log.status === "sent" ? (
                                <>
                                  <CheckCircle className="w-3 h-3" />
                                  Sent
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3" />
                                  Failed
                                </>
                              )}
                            </span>
                            {log.error_message && (
                              <p className="text-xs text-red-600 mt-1">{log.error_message}</p>
                            )}
                          </div>
                        </div>
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
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center shadow-sm border border-gray-100 dark:border-slate-700">
            <MessageSquare className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">No Campaigns</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Start by creating your first campaign to communicate with your customers</p>
            <button
              onClick={() => setShowComposer(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Campaign
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-800 dark:text-white">{campaign.name}</h3>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          campaign.status === "sent"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                            : campaign.status === "sending"
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                            : "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {campaign.status === "sent"
                          ? "Sent"
                          : campaign.status === "sending"
                          ? "Sending"
                          : "Draft"}
                      </span>
                    </div>

                    <p className="text-gray-600 dark:text-gray-300 mb-3 whitespace-pre-wrap line-clamp-2">
                      {campaign.message}
                    </p>

                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        {(() => {
                          const seg = SEGMENT_LABELS[campaign.target_category];
                          const Icon = seg?.icon || Users;
                          return (
                            <>
                              <Icon className={`w-4 h-4 ${seg?.color || "text-gray-400"}`} />
                              {seg?.label || campaign.target_category}
                            </>
                          );
                        })()}
                      </span>
                      {campaign.status === "sent" && (
                        <>
                          <span>Recipients: {campaign.recipients_count}</span>
                          <span className="text-green-600">Succeeded: {campaign.sent_count}</span>
                          {campaign.failed_count > 0 && (
                            <span className="text-red-600">Failed: {campaign.failed_count}</span>
                          )}
                        </>
                      )}
                      <span>
                        {new Date(campaign.created_at).toLocaleDateString("ar-DZ")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {campaign.status === "sent" && (
                      <button
                        onClick={() => viewLogs(campaign.id)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                        title="View log"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    )}
                    {campaign.status === "draft" && (
                      <>
                        <button
                          onClick={() => sendCampaign(campaign.id)}
                          disabled={sendingCampaign === campaign.id}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {sendingCampaign === campaign.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              Send
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => deleteCampaign(campaign.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
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
