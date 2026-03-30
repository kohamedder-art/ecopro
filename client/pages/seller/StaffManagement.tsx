import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Loader2, Plus, Edit, Trash2, Eye, Clock, AlertCircle, CheckCircle,
  Users, Shield, UserPlus, Activity, KeyRound,
} from 'lucide-react';
import { StaffMember } from '@shared/staff';
import { PermissionEditor } from '@/components/staff/PermissionEditor';
import { ActivityLog } from '@/components/staff/ActivityLog';
import { CredentialsDialog } from '@/components/staff/CredentialsDialog';

// ─── Design Tokens ──────────────────────────────────────────────
const surfaceCard =
  'rounded-2xl bg-white/90 dark:bg-slate-900/45 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/70 ring-1 ring-black/5 dark:ring-white/10 shadow-lg shadow-slate-200/60 dark:shadow-black/40 transition-shadow hover:shadow-xl';
const surfaceMuted =
  'rounded-2xl bg-white/75 dark:bg-slate-900/35 backdrop-blur-xl border border-slate-200/70 dark:border-slate-700/60 ring-1 ring-black/5 dark:ring-white/10 shadow-md';
const tabsSurface =
  'bg-white/75 dark:bg-slate-900/35 backdrop-blur border border-slate-200/80 dark:border-slate-700/70 ring-1 ring-black/5 dark:ring-white/10 shadow-lg rounded-2xl p-1';

export default function StaffManagement() {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';
  const { toast } = useToast();

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('staff');

  // Create staff form state
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState<'manager' | 'staff'>('manager');
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Edit state
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editPermissions, setEditPermissions] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // Activity log state
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);

  // Created staff state
  const [showCreatedDialog, setShowCreatedDialog] = useState(false);
  const [createdStaff, setCreatedStaff] = useState<{ username: string; password: string } | null>(null);

  useEffect(() => { loadStaffList(); }, []);

  const loadStaffList = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/client/staff');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || 'Failed to load staff');
      setStaffList(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading staff:', error);
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Failed to load staff members' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async () => {
    if (!staffUsername || !staffPassword) {
      toast({ variant: 'destructive', title: 'Error', description: 'Username and password are required' });
      return;
    }
    if (staffPassword.length < 6) {
      toast({ variant: 'destructive', title: 'Error', description: 'Password must be at least 6 characters' });
      return;
    }
    try {
      setCreating(true);
      const response = await fetch('/api/client/staff/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: staffUsername, password: staffPassword, role: staffRole, permissions: selectedPermissions }),
      });
      if (!response.ok) { const error = await response.json(); throw new Error(error.error || 'Failed to create staff'); }
      setCreatedStaff({ username: staffUsername, password: staffPassword });
      setShowCreatedDialog(true);
      toast({ title: 'Success', description: 'Staff member created successfully!' });
      setStaffUsername(''); setStaffPassword(''); setStaffRole('manager'); setSelectedPermissions({}); setShowCreateDialog(false);
      loadStaffList();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Failed to create staff' });
    } finally { setCreating(false); }
  };

  const handleEditOpen = (staff: StaffMember) => { setEditingStaff(staff); setEditPermissions(staff.permissions); setShowEditDialog(true); };

  const handlePermissionChange = (permission: string, value: boolean) => { setEditPermissions(prev => ({ ...prev, [permission]: value })); };

  const handleSavePermissions = async () => {
    if (!editingStaff) return;
    try {
      setSaving(true);
      const response = await fetch(`/api/client/staff/${editingStaff.id}/permissions`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permissions: editPermissions }) });
      if (!response.ok) throw new Error('Failed to update permissions');
      toast({ title: 'Success', description: 'Permissions updated successfully' });
      setShowEditDialog(false); setEditingStaff(null); loadStaffList();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Failed to update permissions' });
    } finally { setSaving(false); }
  };

  const handleRemoveStaff = async (staffId: number, staffEmail: string) => {
    if (!confirm(`Are you sure you want to remove ${staffEmail}? They will lose access immediately.`)) return;
    try {
      const response = await fetch(`/api/client/staff/${staffId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to remove staff');
      toast({ title: 'Success', description: 'Staff member removed successfully' });
      loadStaffList();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Failed to remove staff' });
    }
  };

  const handleViewActivityLog = (staffId: number) => { setSelectedStaffId(staffId); setShowActivityLog(true); };

  const activeCount = staffList.filter(s => s.status === 'active').length;
  const permTotal = staffList.reduce((sum, s) => sum + Object.values(s.permissions).filter(Boolean).length, 0);

  return (
    <div className={`space-y-4 pb-8 ${isRTL ? 'text-right' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ─── Header ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/30">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">{t('staff.management')}</h1>
            <p className="text-sm text-muted-foreground">{t('staff.manageDesc')}</p>
          </div>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-10 rounded-xl gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md">
              <UserPlus className="h-3.5 w-3.5" /> {t('staff.createAccount')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border-slate-200/80 dark:border-slate-700/70 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
            <DialogHeader className="border-b border-slate-200/70 dark:border-slate-700/60 pb-4">
              <DialogTitle className="text-base font-extrabold flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600">
                  <UserPlus className="h-3.5 w-3.5 text-white" />
                </div>
                {t('staff.createNew')}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">{t('staff.setupCredentials')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              {/* Basic Info */}
              <div className={surfaceMuted + ' p-4'}>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <KeyRound className="h-3.5 w-3.5 text-blue-500" /> {t('staff.accountInfo')}
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1 block">{t('staff.usernameLabel')}</label>
                    <Input type="text" placeholder="john_staff" value={staffUsername} onChange={(e) => setStaffUsername(e.target.value)}
                      className="h-10 rounded-xl bg-white/80 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60 text-sm" />
                    <p className="text-sm text-muted-foreground mt-1">{t('staff.usernameHint')}</p>
                  </div>
                  <div>
                    <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1 block">{t('staff.passwordLabel')}</label>
                    <Input type="password" placeholder={t('staff.passwordHint')} value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)}
                      className="h-10 rounded-xl bg-white/80 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60 text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1 block">{t('staff.roleLabel')}</label>
                    <select value={staffRole} onChange={(e) => setStaffRole(e.target.value as 'manager' | 'staff')}
                      className="w-full h-10 px-3 text-sm rounded-xl bg-white/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                      <option value="manager">{t('staff.manager')}</option>
                      <option value="staff">{t('staff.members')}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Permissions */}
              <div className={surfaceMuted + ' p-4'}>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-emerald-500" /> Permissions
                </h3>
                <div className="bg-white/60 dark:bg-slate-800/40 rounded-xl p-3 border border-slate-200/60 dark:border-slate-700/50">
                  <PermissionEditor permissions={selectedPermissions} onPermissionChange={(p, v) => setSelectedPermissions(prev => ({ ...prev, [p]: v }))} />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/60">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="h-9 rounded-xl text-xs">Cancel</Button>
                <Button onClick={handleCreateStaff} disabled={creating || !staffUsername || !staffPassword}
                  className="h-9 rounded-xl text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white gap-1.5 shadow-md">
                  {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create Account
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ─── KPI Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('staff.members'), value: String(staffList.length), icon: <Users className="h-4 w-4" />, gradient: 'from-blue-600 to-indigo-600', shadow: 'shadow-blue-500/30' },
          { label: t('staff.active'), value: String(activeCount), icon: <CheckCircle className="h-4 w-4" />, gradient: 'from-emerald-600 to-teal-600', shadow: 'shadow-emerald-500/30' },
          { label: t('staff.permissionsEnabled'), value: String(permTotal), icon: <Shield className="h-4 w-4" />, gradient: 'from-violet-600 to-purple-600', shadow: 'shadow-violet-500/30' },
        ].map((kpi, i) => (
          <div key={i} className={surfaceMuted + ' p-3 flex items-center gap-3'}>
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${kpi.gradient} shadow-md ${kpi.shadow} flex-shrink-0`}>
              <span className="text-white">{kpi.icon}</span>
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{kpi.label}</p>
              <p className="text-lg font-extrabold">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Tabs ─────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={tabsSurface}>
          <TabsTrigger value="staff" className="rounded-xl data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm text-sm font-bold gap-1.5">
            <Users className="h-3.5 w-3.5" /> {t('staff.members')}
          </TabsTrigger>
          <TabsTrigger value="activity" className="rounded-xl data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm text-sm font-bold gap-1.5">
            <Activity className="h-3.5 w-3.5" /> {t('staff.activityLogs')}
          </TabsTrigger>
        </TabsList>

        {/* Staff Members Tab */}
        <TabsContent value="staff" className="mt-4 space-y-3">
          {loading ? (
            <div className={`${surfaceCard} flex items-center justify-center py-20`}>
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : staffList.length === 0 ? (
            <div className={`${surfaceCard} flex flex-col items-center justify-center py-16`}>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 mb-3">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-bold text-muted-foreground">No staff members yet</p>
              <p className="text-sm text-muted-foreground mt-1">Invite someone to get started!</p>
            </div>
          ) : (
            staffList.map((staff) => (
              <div key={staff.id} className={surfaceCard + ' overflow-hidden'}>
                <div className="p-4 flex items-start justify-between gap-3">
                  {/* Left: avatar + info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0 ${staff.status === 'active'
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/30'
                      : 'bg-gradient-to-br from-slate-400 to-slate-500 shadow-md shadow-slate-400/30'}`}>
                      <span className="text-white text-base font-extrabold">{staff.email.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-extrabold truncate">{staff.email}</p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-sm font-bold border
                          ${staff.status === 'active'
                            ? 'bg-gradient-to-r from-emerald-500/15 to-green-500/15 border-emerald-300/40 dark:border-emerald-700/40 text-emerald-700 dark:text-emerald-300'
                            : 'bg-gradient-to-r from-slate-500/15 to-gray-500/15 border-slate-300/40 dark:border-slate-700/40 text-slate-600 dark:text-slate-400'}`}>
                          {staff.status === 'active' ? <CheckCircle className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                          {staff.status}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-sm font-bold border bg-gradient-to-r from-violet-500/15 to-indigo-500/15 border-violet-300/40 dark:border-violet-700/40 text-violet-700 dark:text-violet-300">
                          <Shield className="h-2.5 w-2.5" /> {staff.role}
                        </span>
                      </div>

                      {/* Metrics row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                        {[
                          { label: t('staff.invited'), value: new Date(staff.invited_at).toLocaleDateString() },
                          ...(staff.activated_at ? [{ label: t('staff.active'), value: new Date(staff.activated_at).toLocaleDateString() }] : []),
                          ...(staff.last_login ? [{ label: t('staff.lastLogin'), value: new Date(staff.last_login).toLocaleDateString() }] : []),
                          { label: t('staff.permissions'), value: `${Object.values(staff.permissions).filter(Boolean).length} ${t('staff.permissionsEnabled')}` },
                        ].map((m, i) => (
                          <div key={i}>
                            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{m.label}</p>
                            <p className="text-sm font-bold">{m.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div className={`flex items-center gap-1 flex-shrink-0 ${isRTL ? 'mr-2' : 'ml-2'}`}>
                    <Button variant="ghost" size="sm" onClick={() => handleViewActivityLog(staff.id)} title="View Activity Log"
                      className="h-8 w-8 rounded-xl p-0 hover:bg-sky-500/10 hover:text-sky-600">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEditOpen(staff)} title="Edit Permissions"
                      className="h-8 w-8 rounded-xl p-0 hover:bg-amber-500/10 hover:text-amber-600">
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveStaff(staff.id, staff.email)} title="Remove Staff"
                      className="h-8 w-8 rounded-xl p-0 hover:bg-red-500/10 text-red-500 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* Activity Logs Tab */}
        <TabsContent value="activity" className="mt-4">
          <div className={surfaceCard + ' p-4'}>
            <ActivityLog storeId={0} staffId={null} />
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Edit Permissions Dialog ──────────────────────── */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border-slate-200/80 dark:border-slate-700/70 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
          <DialogHeader className="border-b border-slate-200/70 dark:border-slate-700/60 pb-4">
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
                <Shield className="h-3.5 w-3.5 text-white" />
              </div>
              Edit Permissions — {editingStaff?.email}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">Permissions apply instantly when changed</DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <PermissionEditor permissions={editPermissions} onPermissionChange={handlePermissionChange} />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200/70 dark:border-slate-700/60">
            <Button variant="outline" onClick={() => setShowEditDialog(false)} className="h-9 rounded-xl text-xs">Close</Button>
            <Button onClick={handleSavePermissions} disabled={saving}
              className="h-9 rounded-xl text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-1.5 shadow-md">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Created Staff Credentials Dialog ─────────────── */}
      {createdStaff && (
        <CredentialsDialog
          open={showCreatedDialog}
          email={createdStaff.username}
          tempPassword={createdStaff.password}
          onClose={() => { setShowCreatedDialog(false); setCreatedStaff(null); }}
        />
      )}
    </div>
  );
}
