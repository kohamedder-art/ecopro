import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, Loader2, AlertCircle, ExternalLink, Copy, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlugInfo {
  currentSlug: string;
  storeName: string;
  isCustom: boolean;
  suggestedSlug: string;
  fullUrl: string;
}

export function StoreSlugEditor() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [slugInfo, setSlugInfo] = useState<SlugInfo | null>(null);
  const [newSlug, setNewSlug] = useState('');
  const [availability, setAvailability] = useState<any>(null);

  useEffect(() => { fetchSlugInfo(); }, []);

  useEffect(() => {
    if (!newSlug || newSlug === slugInfo?.currentSlug) { setAvailability(null); return; }
    const timer = setTimeout(() => checkAvailability(newSlug), 500);
    return () => clearTimeout(timer);
  }, [newSlug, slugInfo?.currentSlug]);

  const fetchSlugInfo = async () => {
    try {
      const res = await fetch('/api/store/slug');
      if (res.ok) {
        const data = await res.json();
        setSlugInfo(data);
        setNewSlug(data.currentSlug);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const checkAvailability = async (slug: string) => {
    setChecking(true);
    try {
      const res = await fetch('/api/store/slug/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug })
      });
      setAvailability(await res.json());
    } catch (e) { console.error(e); }
    finally { setChecking(false); }
  };

  const handleSave = async () => {
    if (!newSlug || newSlug === slugInfo?.currentSlug) return;
    setSaving(true);
    try {
      const res = await fetch('/api/store/slug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: newSlug })
      });
      const data = await res.json();
      if (res.ok) {
        setSlugInfo(prev => prev ? { ...prev, currentSlug: data.newSlug, fullUrl: data.fullUrl, isCustom: true } : null);
        toast({ title: 'Store URL Updated', description: data.message });
        setAvailability(null);
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch { toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const copyUrl = () => {
    if (slugInfo?.fullUrl) {
      navigator.clipboard.writeText(slugInfo.fullUrl);
      toast({ title: 'Copied!', description: 'Store URL copied to clipboard' });
    }
  };

  const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

  if (loading) return <Card><CardContent className="p-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></CardContent></Card>;

  const hasChanges = newSlug !== slugInfo?.currentSlug;
  const canSave = hasChanges && availability?.available && !checking && !saving;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5" />Store URL</CardTitle>
        <CardDescription>Customize your store link that customers will see and share</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground">Your store link</p>
            <p className="font-medium truncate">{slugInfo?.fullUrl}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={copyUrl}><Copy className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" asChild><a href={slugInfo?.fullUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /></a></Button>
        </div>

        <div className="space-y-2">
          <Label>Custom URL Slug</Label>
          <div className="flex items-center gap-2">
            <span className="text-muted-nowrap text-muted-foreground">/store/</span>
            <Input value={newSlug} onChange={(e) => setNewSlug(normalize(e.target.value))} placeholder={slugInfo?.suggestedSlug}
              className={cn(availability && !checking && (availability.available ? 'border-green-500' : 'border-red-500'))} />
          </div>
          <p className="text-xs text-muted-foreground">Lowercase letters, numbers, hyphens only (3-50 chars)</p>
        </div>

        {checking && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Checking...</div>}

        {availability && !checking && (
          <Alert variant={availability.available ? 'default' : 'destructive'}>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{availability.available ? <span className="text-green-600 flex items-center gap-1"><Check className="w-4 h-4" />Available!</span> : availability.error || 'Taken'}</AlertDescription>
          </Alert>
        )}

        {availability?.suggestions?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {availability.suggestions.map((s: string) => <Button key={s} variant="outline" size="sm" onClick={() => setNewSlug(s)}>{s}</Button>)}
          </div>
        )}

        <div className="flex items-center justify-between pt-4">
          {slugInfo?.isCustom && <span className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" />Custom URL set</span>}
          <div className="flex-1" />
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
