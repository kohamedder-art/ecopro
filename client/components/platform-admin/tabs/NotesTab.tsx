import { useState } from 'react';
import { StickyNote, Plus, Pin, Trash2, Pencil, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';

interface AdminNote {
  id: number;
  title: string;
  content: string;
  color: string;
  is_pinned: boolean;
  updated_at: string;
}

interface Props {
  notes: AdminNote[];
  loading: boolean;
  onSave: (data: { title: string; content: string; color: string; is_pinned: boolean }, editId?: number) => Promise<void>;
  onDelete: (id: number) => void;
  onTogglePin: (note: AdminNote) => void;
  saving: boolean;
}

const colorStyles: Record<string, string> = {
  yellow: 'bg-yellow-500/15 border-yellow-500/35 hover:border-yellow-500/55',
  blue: 'bg-blue-500/15 border-blue-500/35 hover:border-blue-500/55',
  green: 'bg-green-500/15 border-green-500/35 hover:border-green-500/55',
  red: 'bg-red-500/15 border-red-500/35 hover:border-red-500/55',
  purple: 'bg-purple-500/15 border-purple-500/35 hover:border-purple-500/55',
};
const headerColors: Record<string, string> = {
  yellow: 'text-yellow-300', blue: 'text-blue-300', green: 'text-green-300', red: 'text-red-300', purple: 'text-purple-300',
};
const bgDots: Record<string, string> = {
  yellow: 'bg-yellow-500', blue: 'bg-blue-500', green: 'bg-green-500', red: 'bg-red-500', purple: 'bg-purple-500',
};

export default function NotesTab({ notes, loading, onSave, onDelete, onTogglePin, saving }: Props) {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<AdminNote | null>(null);
  const [form, setForm] = useState({ title: '', content: '', color: 'yellow', is_pinned: false });

  const openCreate = () => {
    setEditingNote(null);
    setForm({ title: '', content: '', color: 'yellow', is_pinned: false });
    setShowModal(true);
  };

  const openEdit = (note: AdminNote) => {
    setEditingNote(note);
    setForm({ title: note.title, content: note.content, color: note.color, is_pinned: note.is_pinned });
    setShowModal(true);
  };

  const handleSave = async () => {
    await onSave(form, editingNote?.id);
    setShowModal(false);
  };

  const pinned = notes.filter(n => n.is_pinned);
  const unpinned = notes.filter(n => !n.is_pinned);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-gray-900 dark:text-white font-bold text-lg flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-yellow-400" />
            {t('platformAdmin.notes.title')}
          </h3>
          <p className="text-gray-500 dark:text-slate-400 text-sm">{t('platformAdmin.notes.subtitle')}</p>
        </div>
        <Button onClick={openCreate}
          className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white text-xs"
        >
          <Plus className="w-4 h-4 mr-1" />
          {t('platformAdmin.notes.newNote')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-yellow-400" /></div>
      ) : notes.length === 0 ? (
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-10 text-center shadow-lg">
          <StickyNote className="w-10 h-10 mx-auto text-slate-600 mb-3" />
          <p className="text-gray-500 dark:text-slate-400 text-sm">{t('platformAdmin.notes.noNotes')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pinned.length > 0 && (
            <>
              <p className="text-xs text-gray-500 dark:text-slate-500 uppercase font-medium flex items-center gap-1"><Pin className="w-3 h-3" /> {t('platformAdmin.notes.pinned')}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pinned.map(note => <NoteCard key={note.id} note={note} onEdit={openEdit} onDelete={onDelete} onTogglePin={onTogglePin} />)}
              </div>
            </>
          )}
          {unpinned.length > 0 && (
            <>
              {pinned.length > 0 && <p className="text-xs text-gray-500 dark:text-slate-500 uppercase font-medium">{t('platformAdmin.notes.otherNotes')}</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {unpinned.map(note => <NoteCard key={note.id} note={note} onEdit={openEdit} onDelete={onDelete} onTogglePin={onTogglePin} />)}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-2xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-900 dark:text-white font-bold">{editingNote ? t('platformAdmin.notes.editNote') : t('platformAdmin.notes.newNote')}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-gray-900 dark:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">{t('platformAdmin.notes.titleOptional')}</label>
                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder={t('platformAdmin.notes.titlePlaceholder')} className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 text-sm outline-none focus:border-yellow-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">{t('platformAdmin.notes.content')}</label>
                <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
                  placeholder={t('platformAdmin.notes.contentPlaceholder')} rows={5}
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 text-sm resize-none outline-none focus:border-yellow-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 block mb-2">{t('platformAdmin.notes.color')}</label>
                <div className="flex gap-2">
                  {(['yellow', 'blue', 'green', 'red', 'purple'] as const).map(color => (
                    <button key={color} onClick={() => setForm({ ...form, color })}
                      className={`w-8 h-8 rounded-full ${bgDots[color]} transition-all ${form.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110' : 'opacity-60 hover:opacity-100'}`}
                    />
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_pinned} onChange={e => setForm({ ...form, is_pinned: e.target.checked })} className="w-4 h-4 rounded" />
                <span className="text-gray-600 dark:text-slate-300 text-sm">{t('platformAdmin.notes.pinNote')}</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowModal(false)} className="text-gray-600 dark:text-slate-300 border-slate-600">{t('platformAdmin.notes.cancel')}</Button>
              <Button onClick={handleSave} disabled={saving || !form.content.trim()}
                className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {editingNote ? t('platformAdmin.notes.saveChanges') : t('platformAdmin.notes.createNote')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NoteCard({ note, onEdit, onDelete, onTogglePin }: {
  note: AdminNote;
  onEdit: (note: AdminNote) => void;
  onDelete: (id: number) => void;
  onTogglePin: (note: AdminNote) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={`rounded-2xl border p-4 transition-all backdrop-blur-xl shadow-lg ${colorStyles[note.color] || colorStyles.yellow}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          {note.is_pinned && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 mb-1">
              <Pin className="w-2.5 h-2.5" /> {t('platformAdmin.notes.pinned')}
            </span>
          )}
          {note.title && (
            <h4 className={`font-bold truncate text-sm ${headerColors[note.color] || headerColors.yellow}`}>
              {note.title}
            </h4>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => onTogglePin(note)}
            className={`p-1.5 rounded hover:bg-white/10 transition ${note.is_pinned ? 'text-amber-400' : 'text-gray-500 dark:text-slate-500'}`}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onEdit(note)}
            className="p-1.5 rounded hover:bg-white/10 transition text-gray-500 dark:text-slate-500 hover:text-gray-900 dark:hover:text-gray-900 dark:text-white"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(note.id)}
            className="p-1.5 rounded hover:bg-red-500/20 transition text-gray-500 dark:text-slate-500 hover:text-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <p className="text-gray-700 dark:text-slate-200 text-sm whitespace-pre-wrap break-words leading-relaxed">{note.content}</p>
      <div className="mt-3 pt-2 border-t border-white/10 text-[10px] text-gray-500 dark:text-slate-500">
        {t('platformAdmin.notes.updated')} {new Date(note.updated_at).toLocaleDateString()}
      </div>
    </div>
  );
}
