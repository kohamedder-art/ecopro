import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';

interface PixelEntry {
  platform: 'facebook' | 'tiktok';
  pixel_id: string;
  enabled: boolean;
  access_token?: string;
}

export default function PixelsTab() {
  const [pixels, setPixels] = useState<PixelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/platform-admin/pixels', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setPixels(data);
        else setPixels([]);
      })
      .catch(() => setPixels([]))
      .finally(() => setLoading(false));
  }, []);

  const addPixel = () => {
    setPixels(prev => [...prev, { platform: 'facebook', pixel_id: '', enabled: true, access_token: '' }]);
  };

  const removePixel = (idx: number) => {
    setPixels(prev => prev.filter((_, i) => i !== idx));
  };

  const updatePixel = (idx: number, field: keyof PixelEntry, value: any) => {
    setPixels(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/platform-admin/pixels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pixels }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setMessage({ type: 'success', text: 'Pixel config saved' });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: 'Failed to save pixel config' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-blue-500/20 shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white text-lg">Platform Pixels</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Configure Facebook & TikTok pixels for the landing page.
          </p>
        </div>
        <Button onClick={addPixel} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Pixel
        </Button>
      </div>

      {pixels.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500 text-sm">
          No pixels configured. Click "Add Pixel" to add one.
        </div>
      ) : (
        <div className="space-y-3">
          {pixels.map((pixel, idx) => (
            <div
              key={idx}
              className="flex items-center gap-4 p-4 rounded-xl bg-gray-50/60 dark:bg-slate-900/60 border border-gray-200/60 dark:border-slate-700/30"
            >
              <select
                value={pixel.platform}
                onChange={e => updatePixel(idx, 'platform', e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
              >
                <option value="facebook">Facebook</option>
                <option value="tiktok">TikTok</option>
              </select>
              <input
                type="text"
                placeholder="Pixel ID"
                value={pixel.pixel_id}
                onChange={e => updatePixel(idx, 'pixel_id', e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white placeholder-gray-400"
              />
              {pixel.platform === 'facebook' && (
                <input
                  type="text"
                  placeholder="Access Token (for Conversions API)"
                  value={pixel.access_token || ''}
                  onChange={e => updatePixel(idx, 'access_token', e.target.value)}
                  className="w-72 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 font-mono text-xs"
                />
              )}
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={pixel.enabled}
                  onChange={e => updatePixel(idx, 'enabled', e.target.checked)}
                  className="rounded"
                />
                Active
              </label>
              <button
                onClick={() => removePixel(idx)}
                className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving...' : 'Save Config'}
        </Button>
        {message && (
          <span className={`flex items-center gap-1.5 text-sm ${
            message.type === 'success' ? 'text-emerald-500' : 'text-red-500'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
