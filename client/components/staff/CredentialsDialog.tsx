import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Copy, Eye, EyeOff, KeyRound, Globe, User, AlertTriangle, ListOrdered } from 'lucide-react';

interface CredentialsDialogProps {
  open: boolean;
  email: string;
  tempPassword: string;
  onClose: () => void;
}

const surfaceMuted =
  'rounded-2xl bg-white/75 dark:bg-slate-900/35 backdrop-blur-xl border border-slate-200/70 dark:border-slate-700/60 ring-1 ring-black/5 dark:ring-white/10 shadow-md';

export function CredentialsDialog({ open, email, tempPassword, onClose }: CredentialsDialogProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<'url' | 'email' | 'password' | null>(null);

  const copyToClipboard = (text: string, type: 'url' | 'email' | 'password') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const staffLoginUrl = `${window.location.origin}/staff/login`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl border-slate-200/80 dark:border-slate-700/70 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
        <DialogHeader className="border-b border-slate-200/70 dark:border-slate-700/60 pb-4">
          <DialogTitle className="text-base font-extrabold flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
              <KeyRound className="h-3.5 w-3.5 text-white" />
            </div>
            Staff Credentials Created
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Share these credentials with your staff member. They'll need them to log in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Login URL */}
          <div className={surfaceMuted + ' p-3'}>
            <div className="flex items-center gap-2 mb-2">
              <Globe className="h-3.5 w-3.5 text-sky-500" />
              <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Login URL</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm text-sky-600 dark:text-sky-400 font-mono break-all">{staffLoginUrl}</code>
              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(staffLoginUrl, 'url')}
                className="h-7 w-7 rounded-lg p-0 hover:bg-sky-500/10 hover:text-sky-600 flex-shrink-0">
                {copied === 'url' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          {/* Username */}
          <div className={surfaceMuted + ' p-3'}>
            <div className="flex items-center gap-2 mb-2">
              <User className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Username</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono font-bold">{email}</code>
              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(email, 'email')}
                className="h-7 w-7 rounded-lg p-0 hover:bg-blue-500/10 hover:text-blue-600 flex-shrink-0">
                {copied === 'email' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          {/* Password */}
          <div className={surfaceMuted + ' p-3'}>
            <div className="flex items-center gap-2 mb-2">
              <KeyRound className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Temporary Password</span>
            </div>
            <div className="flex items-center gap-2">
              <code className={`flex-1 text-sm font-mono font-bold ${showPassword ? '' : 'text-muted-foreground'}`}>
                {showPassword ? tempPassword : '•'.repeat(tempPassword.length)}
              </code>
              <Button size="sm" variant="ghost" onClick={() => setShowPassword(!showPassword)}
                className="h-7 w-7 rounded-lg p-0 hover:bg-violet-500/10 hover:text-violet-600 flex-shrink-0">
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(tempPassword, 'password')}
                className="h-7 w-7 rounded-lg p-0 hover:bg-violet-500/10 hover:text-violet-600 flex-shrink-0">
                {copied === 'password' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          {/* Warning */}
          <div className="rounded-xl bg-amber-500/10 border border-amber-300/40 dark:border-amber-700/40 p-3 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
              <strong>Important:</strong> This is the only time you'll see this password. Save or share it with your staff member immediately. They can change it after their first login.
            </p>
          </div>

          {/* Instructions */}
          <div className="rounded-xl bg-sky-500/10 border border-sky-300/40 dark:border-sky-700/40 p-3">
            <div className="flex items-center gap-2 mb-2">
              <ListOrdered className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
              <span className="text-sm font-bold text-sky-700 dark:text-sky-300">How to share with staff:</span>
            </div>
            <ol className="text-sm text-sky-700 dark:text-sky-300 space-y-0.5 list-decimal list-inside leading-relaxed">
              <li>Copy the login URL above</li>
              <li>Send them the username</li>
              <li>Send them the temporary password</li>
              <li>They can now log in at the provided URL</li>
            </ol>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/60">
          <Button onClick={onClose}
            className="w-full h-10 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md">
            I've Saved the Credentials
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
