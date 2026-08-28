import { useState, useEffect } from 'react';
import { MessageCircle, Plus, Trash2, GripVertical, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Contact {
  id: number;
  platform: string;
  label: string;
  url: string;
  icon_url?: string;
  is_active: boolean;
  sort_order: number;
}

const PLATFORMS = [
  { value: 'whatsapp', label: 'WhatsApp', color: '#25D366' },
  { value: 'telegram', label: 'Telegram', color: '#0088cc' },
  { value: 'messenger', label: 'Messenger', color: '#1877F2' },
  { value: 'instagram', label: 'Instagram', color: '#E4405F' },
  { value: 'email', label: 'Email', color: '#EA4335' },
  { value: 'phone', label: 'Phone', color: '#10b981' },
  { value: 'viber', label: 'Viber', color: '#7B519D' },
  { value: 'custom', label: 'Custom', color: '#6366f1' },
];

export default function ContactsTab() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ platform: 'whatsapp', label: '', url: '', icon_url: '' });
  const [editingId, setEditingId] = useState<number | null>(null);

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/admin-contacts', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
      }
    } catch (e) {
      console.error('Failed to fetch contacts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContacts(); }, []);

  const handleSave = async () => {
    if (!form.label || !form.url) return;
    setSaving(true);
    try {
      if (editingId) {
        await fetch(`/api/admin-contacts/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(form),
        });
      } else {
        await fetch('/api/admin-contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ...form, sort_order: contacts.length }),
        });
      }
      setForm({ platform: 'whatsapp', label: '', url: '', icon_url: '' });
      setEditingId(null);
      fetchContacts();
    } catch (e) {
      console.error('Failed to save contact:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/admin-contacts/${id}`, { method: 'DELETE', credentials: 'include' });
      fetchContacts();
    } catch (e) {
      console.error('Failed to delete contact:', e);
    }
  };

  const handleEdit = (c: Contact) => {
    setForm({ platform: c.platform, label: c.label, url: c.url, icon_url: c.icon_url || '' });
    setEditingId(c.id);
  };

  const handleToggleActive = async (c: Contact) => {
    try {
      await fetch(`/api/admin-contacts/${c.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !c.is_active }),
      });
      fetchContacts();
    } catch (e) {
      console.error('Failed to toggle contact:', e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-indigo-500/20 shadow-lg p-5">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center text-sm gap-2 mb-4">
          <MessageCircle className="w-4 h-4 text-indigo-400" />
          {editingId ? 'Edit Contact' : 'Add Contact'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Platform</label>
            <select
              value={form.platform}
              onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
              className="w-full bg-white/60 dark:bg-slate-800/60 border border-gray-300/60 dark:border-slate-600/50 text-gray-900 dark:text-white rounded-lg text-sm p-2 outline-none"
            >
              {PLATFORMS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Label</label>
            <input
              type="text"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Support WhatsApp"
              className="w-full bg-white/60 dark:bg-slate-800/60 border border-gray-300/60 dark:border-slate-600/50 text-gray-900 dark:text-white rounded-lg text-sm p-2 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">URL</label>
            <input
              type="url"
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              placeholder="https://wa.me/1234567890"
              className="w-full bg-white/60 dark:bg-slate-800/60 border border-gray-300/60 dark:border-slate-600/50 text-gray-900 dark:text-white rounded-lg text-sm p-2 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Icon URL (optional)</label>
            <input
              type="url"
              value={form.icon_url}
              onChange={e => setForm(f => ({ ...f, icon_url: e.target.value }))}
              placeholder="Custom icon URL"
              className="w-full bg-white/60 dark:bg-slate-800/60 border border-gray-300/60 dark:border-slate-600/50 text-gray-900 dark:text-white rounded-lg text-sm p-2 outline-none"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button
            onClick={handleSave}
            disabled={saving || !form.label || !form.url}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
            {editingId ? 'Update' : 'Add Contact'}
          </Button>
          {editingId && (
            <Button
              variant="outline"
              onClick={() => { setEditingId(null); setForm({ platform: 'whatsapp', label: '', url: '', icon_url: '' }); }}
              className="text-xs"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Existing contacts */}
      <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-gray-200/60 dark:border-slate-700/30 shadow-lg p-5">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center text-sm gap-2 mb-4">
          <MessageCircle className="w-4 h-4 text-gray-400" />
          Active Contacts ({contacts.filter(c => c.is_active).length}/{contacts.length})
        </h3>
        {contacts.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">No contacts added yet. Add your first contact above.</p>
        ) : (
          <div className="space-y-2">
            {contacts.map(c => {
              const plat = PLATFORMS.find(p => p.value === c.platform);
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    c.is_active
                      ? 'bg-white/80 dark:bg-slate-800/60 border-gray-200/60 dark:border-slate-700/30'
                      : 'bg-gray-50/40 dark:bg-slate-900/40 border-gray-200/30 dark:border-slate-700/20 opacity-60'
                  }`}
                >
                  <GripVertical className="h-4 w-4 text-gray-300 dark:text-slate-600 flex-shrink-0" />
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: plat?.color || '#6366f1' }}
                  >
                    <MessageCircle className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.label}</div>
                    <div className="text-xs text-gray-400 dark:text-slate-500 truncate">{c.url}</div>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 flex-shrink-0">
                    {plat?.label || c.platform}
                  </span>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors flex-shrink-0"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    onClick={() => handleToggleActive(c)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors flex-shrink-0 ${
                      c.is_active
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500'
                    }`}
                  >
                    {c.is_active ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={() => handleEdit(c)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 hover:text-indigo-500 transition-colors flex-shrink-0 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
