import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, X, Check } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

type Announcement = {
  id: number;
  title: string;
  body: string;
  variant: 'blue' | 'red' | string;
  is_enabled: boolean;
  starts_at: string | null;
  ends_at: string | null;
  min_view_ms: number;
  allow_dismiss: boolean;
  allow_never_show_again: boolean;
  created_at: string;
};

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export default function GlobalAnnouncementsManager() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [variant, setVariant] = useState<'blue' | 'red'>('blue');
  const [enabled, setEnabled] = useState(true);
  const [startsAt, setStartsAt] = useState<string>('');
  const [endsAt, setEndsAt] = useState<string>('');
  const [minViewSec, setMinViewSec] = useState<number>(3);

  // Edit mode state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editVariant, setEditVariant] = useState<'blue' | 'red'>('blue');

  const csrf = useMemo(() => getCookie('ecopro_csrf'), []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/announcements');
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed');
      setItems((data?.announcements || []) as Announcement[]);
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        title,
        body,
        variant,
        is_enabled: enabled,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      };

      if (variant === 'red') {
        payload.min_view_ms = Math.max(0, Math.floor((minViewSec || 0) * 1000));
        payload.allow_never_show_again = false;
        payload.allow_dismiss = true;
      } else {
        payload.min_view_ms = 0;
        payload.allow_never_show_again = true;
        payload.allow_dismiss = true;
      }

      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed');

      setTitle('');
      setBody('');
      setStartsAt('');
      setEndsAt('');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(a: Announcement) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/announcements/${a.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify({ is_enabled: !a.is_enabled }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed');
    }
  }

  // Start editing an announcement
  function startEdit(a: Announcement) {
    setEditingId(a.id);
    setEditTitle(a.title);
    setEditBody(a.body);
    setEditVariant(a.variant as 'blue' | 'red');
  }

  // Cancel editing
  function cancelEdit() {
    setEditingId(null);
    setEditTitle('');
    setEditBody('');
    setEditVariant('blue');
  }

  // Save edit
  async function saveEdit(id: number) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify({
          title: editTitle,
          body: editBody,
          variant: editVariant,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed');
      cancelEdit();
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed');
    }
  }

  // Delete announcement
  async function deleteAnnouncement(id: number) {
    if (!confirm(t('platformAdmin.announcements.deleteConfirm'))) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: 'DELETE',
        headers: {
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed');
    }
  }

  return (
    <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-md rounded-xl border border-gray-200 dark:border-slate-700/50 shadow-lg p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-gray-900 dark:text-white font-bold">{t('platformAdmin.announcements.title')}</h3>
          <p className="text-gray-500 dark:text-slate-400 text-sm">{t('platformAdmin.announcements.subtitle')}</p>
        </div>
        <Button className="bg-slate-700 hover:bg-slate-600 text-gray-900 dark:text-white" onClick={load} disabled={loading}>
          {loading ? t('platformAdmin.common.loading') : t('platformAdmin.announcements.refresh')}
        </Button>
      </div>

      {error && (
        <div className="mt-3 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-700/60 bg-gray-50/40 dark:bg-slate-900/40 p-4">
          <div className="text-gray-700 dark:text-slate-200 font-semibold mb-3">{t('platformAdmin.announcements.createNew')}</div>

          <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">{t('platformAdmin.announcements.titleLabel')}</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
            placeholder={t('platformAdmin.announcements.titlePlaceholder')}
          />

          <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1 mt-3">{t('platformAdmin.announcements.message')}</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 min-h-[100px]"
            placeholder={t('platformAdmin.announcements.messagePlaceholder')}
          />

          <div className="mt-3 flex gap-3 flex-wrap">
            <div>
              <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">{t('platformAdmin.announcements.template')}</label>
              <select
                value={variant}
                onChange={(e) => setVariant(e.target.value as any)}
                className="rounded-lg border border-gray-200 dark:border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
              >
                <option value="blue">{t('platformAdmin.announcements.blue')}</option>
                <option value="red">{t('platformAdmin.announcements.red')}</option>
              </select>
            </div>

            {variant === 'red' && (
              <div>
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">{t('platformAdmin.announcements.delaySeconds')}</label>
                <input
                  type="number"
                  min={0}
                  value={minViewSec}
                  onChange={(e) => setMinViewSec(Number(e.target.value))}
                  className="w-36 rounded-lg border border-gray-200 dark:border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
                />
              </div>
            )}

            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-slate-200">
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                {t('platformAdmin.announcements.enabled')}
              </label>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">{t('platformAdmin.announcements.startOptional')}</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">{t('platformAdmin.announcements.endOptional')}</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
              />
            </div>
          </div>

          <Button
            onClick={create}
            disabled={saving || !title.trim() || !body.trim()}
            className="mt-4 w-full bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            {saving ? t('platformAdmin.announcements.creating') : t('platformAdmin.announcements.create')}
          </Button>
        </div>

        <div className="rounded-xl border border-slate-700/60 bg-gray-50/40 dark:bg-slate-900/40 p-4">
          <div className="text-gray-700 dark:text-slate-200 font-semibold mb-3">{t('platformAdmin.announcements.recent')}</div>

          {items.length === 0 && <div className="text-gray-500 dark:text-slate-400 text-sm">{t('platformAdmin.announcements.noAnnouncements')}</div>}

          <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
            {items.map((a) => (
              <div key={a.id} className="rounded-xl border border-slate-700/60 bg-slate-950/30 p-3">
                {editingId === a.id ? (
                  // Edit mode
                  <div className="space-y-3">
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                      placeholder="Title"
                    />
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 min-h-[80px]"
                      placeholder="Message"
                    />
                    <div className="flex items-center gap-2">
                      <select
                        value={editVariant}
                        onChange={(e) => setEditVariant(e.target.value as 'blue' | 'red')}
                        className="rounded-lg border border-gray-300 dark:border-slate-600 bg-slate-900/60 px-2 py-1 text-xs text-slate-100"
                      >
                        <option value="blue">Blue</option>
                        <option value="red">Red</option>
                      </select>
                      <div className="flex-1" />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-gray-900 dark:text-white"
                        onClick={cancelEdit}
                      >
                        <X className="w-4 h-4 mr-1" /> {t('platformAdmin.announcements.cancel')}
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => saveEdit(a.id)}
                        disabled={!editTitle.trim() || !editBody.trim()}
                      >
                        <Check className="w-4 h-4 mr-1" /> {t('platformAdmin.announcements.save')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-slate-100 font-semibold truncate">{a.title}</div>
                        <div className="text-gray-500 dark:text-slate-400 text-xs mt-0.5">{new Date(a.created_at).toLocaleString()}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={a.variant === 'red' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}>
                          {a.variant}
                        </Badge>
                        <Badge className={a.is_enabled ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-white'}>
                          {a.is_enabled ? t('platformAdmin.announcements.enabled') : t('platformAdmin.announcements.disabled')}
                        </Badge>
                      </div>
                    </div>

                    <div className="text-gray-600 dark:text-slate-300 text-sm mt-2 whitespace-pre-wrap">{a.body}</div>

                    <div className="mt-2 flex items-center justify-between gap-2 flex-wrap text-xs text-gray-500 dark:text-slate-400">
                      <div>
                        {a.starts_at ? `Start: ${new Date(a.starts_at).toLocaleString()}` : 'Start: now'}
                        {' • '}
                        {a.ends_at ? `End: ${new Date(a.ends_at).toLocaleString()}` : 'End: none'}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-gray-500 dark:text-slate-400 hover:text-cyan-400"
                          onClick={() => startEdit(a)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-gray-500 dark:text-slate-400 hover:text-red-400"
                          onClick={() => deleteAnnouncement(a.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          className={a.is_enabled ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-emerald-700 hover:bg-emerald-600 text-white'}
                          onClick={() => toggleEnabled(a)}
                        >
                          {a.is_enabled ? t('platformAdmin.announcements.disable') : t('platformAdmin.announcements.enable')}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
