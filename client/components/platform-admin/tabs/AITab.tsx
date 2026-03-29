import { useState, useCallback } from 'react';
import { Brain, Activity, AlertTriangle, Shield, MessageSquare, Loader2, RefreshCw, Sparkles, TrendingDown, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AIResult {
  loading: boolean;
  data: any;
  error: string | null;
  lastRun: number | null;
}

const initial: AIResult = { loading: false, data: null, error: null, lastRun: null };

export default function AITab() {
  const [health, setHealth] = useState<AIResult>(initial);
  const [churn, setChurn] = useState<AIResult>(initial);
  const [fraud, setFraud] = useState<AIResult>(initial);
  const [moderate, setModerate] = useState<AIResult>(initial);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const runEndpoint = useCallback(async (
    endpoint: string,
    setter: React.Dispatch<React.SetStateAction<AIResult>>,
    body?: Record<string, any>
  ) => {
    setter(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`/api/ai/admin/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setter({ loading: false, data, error: null, lastRun: Date.now() });
    } catch (e: any) {
      setter(s => ({ ...s, loading: false, error: e.message || 'Failed' }));
    }
  }, []);

  const toggle = (key: string) => setExpandedCard(prev => prev === key ? null : key);

  const cards = [
    {
      key: 'health',
      title: 'Platform Health Analysis',
      description: 'AI-powered analysis of platform metrics, user trends, and infrastructure health.',
      icon: Activity,
      gradient: 'from-emerald-500/15 to-emerald-500/5',
      border: 'border-emerald-500/30',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      state: health,
      onRun: () => runEndpoint('platform-health', setHealth),
      renderResult: (data: any) => {
        const analysis = data?.analysis || data?.result || data;
        if (typeof analysis === 'string') return <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">{analysis}</p>;
        return (
          <div className="space-y-3">
            {analysis?.summary && <p className="text-slate-200 text-sm leading-relaxed">{analysis.summary}</p>}
            {analysis?.recommendations && (
              <div className="space-y-1.5">
                <p className="text-xs text-slate-400 font-medium uppercase">Recommendations</p>
                {(Array.isArray(analysis.recommendations) ? analysis.recommendations : [analysis.recommendations]).map((r: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-slate-200">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            )}
            {!analysis?.summary && !analysis?.recommendations && (
              <pre className="text-xs text-slate-300 bg-slate-900/50 rounded-lg p-3 overflow-auto max-h-64">{JSON.stringify(analysis, null, 2)}</pre>
            )}
          </div>
        );
      }
    },
    {
      key: 'churn',
      title: 'Churn Prediction',
      description: 'Identify users at risk of canceling or not renewing their subscription.',
      icon: TrendingDown,
      gradient: 'from-orange-500/15 to-orange-500/5',
      border: 'border-orange-500/30',
      badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      state: churn,
      onRun: () => runEndpoint('churn-prediction', setChurn),
      renderResult: (data: any) => {
        const result = data?.predictions || data?.result || data;
        if (typeof result === 'string') return <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">{result}</p>;
        if (Array.isArray(result)) {
          return (
            <div className="space-y-2">
              {result.slice(0, 10).map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-slate-900/40 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm text-white font-medium">{item.name || item.email || `User ${i + 1}`}</p>
                    {item.reason && <p className="text-xs text-slate-400">{item.reason}</p>}
                  </div>
                  <Badge className={`text-xs ${
                    (item.risk || item.score || 0) > 0.7 ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                    (item.risk || item.score || 0) > 0.4 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                    'bg-green-500/20 text-green-300 border-green-500/30'
                  } border`}>
                    {Math.round((item.risk || item.score || 0) * 100)}% risk
                  </Badge>
                </div>
              ))}
            </div>
          );
        }
        return <pre className="text-xs text-slate-300 bg-slate-900/50 rounded-lg p-3 overflow-auto max-h-64">{JSON.stringify(result, null, 2)}</pre>;
      }
    },
    {
      key: 'fraud',
      title: 'Fraud Detection',
      description: 'Scan for suspicious activity, abuse patterns, and potential security threats.',
      icon: Shield,
      gradient: 'from-red-500/15 to-red-500/5',
      border: 'border-red-500/30',
      badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30',
      state: fraud,
      onRun: () => runEndpoint('fraud-detection', setFraud),
      renderResult: (data: any) => {
        const result = data?.findings || data?.result || data;
        if (typeof result === 'string') return <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">{result}</p>;
        if (Array.isArray(result)) {
          return (
            <div className="space-y-2">
              {result.slice(0, 10).map((item: any, i: number) => (
                <div key={i} className="flex items-start gap-3 bg-slate-900/40 rounded-lg px-3 py-2">
                  <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    item.severity === 'high' ? 'text-red-400' : item.severity === 'medium' ? 'text-amber-400' : 'text-blue-400'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white font-medium">{item.title || item.type || `Finding ${i + 1}`}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{item.description || item.details || ''}</p>
                  </div>
                </div>
              ))}
            </div>
          );
        }
        return <pre className="text-xs text-slate-300 bg-slate-900/50 rounded-lg p-3 overflow-auto max-h-64">{JSON.stringify(result, null, 2)}</pre>;
      }
    },
    {
      key: 'moderate',
      title: 'Content Moderation',
      description: 'AI scan of products and store content for policy violations.',
      icon: Eye,
      gradient: 'from-purple-500/15 to-purple-500/5',
      border: 'border-purple-500/30',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      state: moderate,
      onRun: () => runEndpoint('moderate-content', setModerate),
      renderResult: (data: any) => {
        const result = data?.violations || data?.result || data;
        if (typeof result === 'string') return <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">{result}</p>;
        if (Array.isArray(result) && result.length === 0) {
          return (
            <div className="text-center py-4">
              <Shield className="w-8 h-8 mx-auto text-emerald-500/50 mb-2" />
              <p className="text-emerald-300 text-sm font-medium">All clear — no violations detected</p>
            </div>
          );
        }
        if (Array.isArray(result)) {
          return (
            <div className="space-y-2">
              {result.slice(0, 10).map((item: any, i: number) => (
                <div key={i} className="bg-slate-900/40 rounded-lg px-3 py-2">
                  <p className="text-sm text-white font-medium">{item.product || item.store || `Item ${i + 1}`}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.violation || item.reason || ''}</p>
                </div>
              ))}
            </div>
          );
        }
        return <pre className="text-xs text-slate-300 bg-slate-900/50 rounded-lg p-3 overflow-auto max-h-64">{JSON.stringify(result, null, 2)}</pre>;
      }
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 backdrop-blur-xl rounded-2xl border border-purple-500/30 p-5 shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">AI Intelligence Center</h3>
            <p className="text-slate-400 text-sm">Platform analytics powered by Gemini AI</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button size="sm" className="bg-slate-700/60 hover:bg-slate-600 text-white text-xs h-7"
            onClick={() => { cards.forEach(c => c.onRun()); }}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Run All Scans
          </Button>
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Health results are cached for 1 hour
          </span>
        </div>
      </div>

      {/* AI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {cards.map(card => {
          const isExpanded = expandedCard === card.key;
          const Icon = card.icon;
          return (
            <div key={card.key}
              className={`bg-gradient-to-br ${card.gradient} backdrop-blur-xl rounded-2xl border ${card.border} shadow-lg overflow-hidden transition-all`}
            >
              {/* Card Header */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-900/50 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4.5 h-4.5 text-slate-200" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold text-sm">{card.title}</h4>
                      <p className="text-slate-400 text-xs mt-0.5">{card.description}</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={card.onRun} disabled={card.state.loading}
                    className="bg-slate-800/60 hover:bg-slate-700 text-white text-xs h-7 flex-shrink-0"
                  >
                    {card.state.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  </Button>
                </div>

                {/* Status */}
                {card.state.lastRun && (
                  <div className="flex items-center gap-2 mt-3">
                    <Badge className={`${card.badgeColor} border text-[10px]`}>
                      Completed
                    </Badge>
                    <span className="text-[10px] text-slate-500">
                      {new Date(card.state.lastRun).toLocaleTimeString()}
                    </span>
                    <button onClick={() => toggle(card.key)} className="ml-auto text-slate-400 hover:text-white transition">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                )}

                {card.state.error && (
                  <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 text-red-200 text-xs">
                    {card.state.error}
                  </div>
                )}

                {card.state.loading && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Analyzing platform data...
                  </div>
                )}
              </div>

              {/* Expanded Result */}
              {isExpanded && card.state.data && (
                <div className="border-t border-slate-700/30 p-4 bg-slate-900/20">
                  {card.renderResult(card.state.data)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
