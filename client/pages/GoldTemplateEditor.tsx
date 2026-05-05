import React, { useState, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Monitor, Smartphone, Tablet, Wand2, Sparkles, LayoutTemplate, MousePointerClick, Zap, Save, Eye, ExternalLink, Settings, Check, Search, X, ChevronDown, Image as ImageIcon, UploadCloud, Type } from 'lucide-react';
import { RenderStorefront, normalizeTemplateId } from './storefront/templates';
import { uploadImage } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useStoreProducts } from '@/hooks/useStoreProducts';

const DEFAULT_TEMPLATE_ID = 'dzshop';

// Templates that are considered 100% editable + verified against TEMPLATE_EDITS_CONTRACT.
// These are the only templates shown by default in the picker.
// NOTE: Disabled templates (files kept but not selectable):
// dzpremium, minimalist, aurora, sculptor, artisan, gallery, jewelheart, classicshop, vera, novadz, lumina
const READY_TEMPLATE_IDS = new Set(['dzshop', 'luxedrop', 'needdz', 'zenith', 'boutique', 'streetwear', 'iyco', 'bassem28', 'dz3shop', 'spiriluxe', 'leroishop']);

// Template preview data with categories
// NOTE: Disabled templates (files kept but not selectable):
// dzpremium, minimalist, aurora, sculptor, artisan, gallery, jewelheart, classicshop, vera, novadz, lumina
const TEMPLATE_PREVIEWS = [
  { id: 'dzshop', name: 'متجر DZ — كلاسيكي جزائري', image: '', categories: ['popular', 'industry'] },
  { id: 'luxedrop', name: 'لوكس دروب — الوضع الداكن', image: '', categories: ['dark', 'landing'] },
  { id: 'needdz', name: 'NeedDZ — تطبيق موبايل', image: '', categories: ['mobile', 'popular'] },
  { id: 'zenith', name: 'زينيث — هبوط نظيف', image: '', categories: ['landing', 'minimal'] },
  { id: 'boutique', name: 'بوتيك — متجر تشكيلة', image: '', categories: ['popular', 'elegant'] },
  { id: 'streetwear', name: 'ستريت وير — شبكة داكنة', image: '', categories: ['dark', 'popular'] },
  { id: 'iyco', name: 'IYCO — ملابس عصرية', image: '', categories: ['popular', 'landing'] },
  { id: 'bassem28', name: 'بريمو — منتج احترافي', image: '', categories: ['popular', 'landing', 'elegant'] },
  { id: 'dz3shop', name: 'Dz3 شوب — كتالوج المنتجات', image: '', categories: ['popular', 'industry'] },
  { id: 'spiriluxe', name: 'سبيريلوكس — هبوط + صور + فيديو', image: '', categories: ['landing', 'popular'] },
  { id: 'leroishop', name: 'لوروا شوب — كتالوج متعدد المنتجات', image: '', categories: ['popular', 'industry'] }
];

const TEMPLATE_CATEGORIES = [
  { id: 'all', name: 'All Templates', icon: '🎨' },
  { id: 'popular', name: 'Popular', icon: '⭐' },
  { id: 'landing', name: 'Landing Pages', icon: '📄' },
  { id: 'minimal', name: 'Minimal & Clean', icon: '✨' },
  { id: 'colorful', name: 'Colorful', icon: '🌈' },
  { id: 'dark', name: 'Dark Mode', icon: '🌙' },
  { id: 'elegant', name: 'Elegant', icon: '💎' },
  { id: 'industry', name: 'Industry Specific', icon: '🏪' },
  { id: 'pro', name: 'Pro Series', icon: '🚀' },
];

// Default settings for each template - used for reset functionality
// Keys that should be reset when switching/resetting templates
const TEMPLATE_SETTING_KEYS = [
  'template_hero_heading',
  'template_hero_subtitle',
  'template_button_text',
  'template_description_text',
  'template_description_color',
  'template_description_size',
  'template_description_weight',
  'template_description_style',
] as const;

// When resetting, we clear these values so templates use their built-in defaults
const getTemplateDefaults = (): Partial<StoreSettings> => {
  const defaults: Partial<StoreSettings> = {};
  TEMPLATE_SETTING_KEYS.forEach(key => {
    defaults[key] = null; // null = use template's built-in default
  });
  return defaults;
};

type StoreSettings = {
  [key: string]: any;
  store_slug?: string;
  store_name?: string;
  store_description?: string;
  store_logo?: string;
  banner_url?: string | null;
  primary_color?: string;
  secondary_color?: string;
  currency_code?: string;
  template?: string;
  template_hero_heading?: string | null;
  template_hero_subtitle?: string | null;
  template_button_text?: string | null;
  template_accent_color?: string | null;
};

type StoreProduct = {
  id: number;
  title: string;
  description?: string;
  price: number;
  images?: string[];
  category?: string;
  stock_quantity: number;
  is_featured: boolean;
  slug: string;
  views: number;
};

export default function GoldTemplateEditor() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const previewRootRef = React.useRef<HTMLDivElement | null>(null);
  const previewFitRef = React.useRef<HTMLDivElement | null>(null);
  const canvasContainerRef = React.useRef<HTMLDivElement | null>(null);
  const previewIframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const previewIframeRootRef = React.useRef<ReturnType<typeof createRoot> | null>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // CSRF token for mutating API calls
  const getCsrfToken = (): string => {
    const match = document.cookie.match(/ecopro_csrf=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  };
  const [settings, setSettings] = useState<StoreSettings>({});
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [activeTab, setActiveTab] = useState<'preview' | 'settings'>('preview');

  // Lock body/html scroll so the editor never bleeds outside its h-dvh container
  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'TEMPLATE_UPDATE_SETTING') {
        const { key, value } = event.data;
        if (typeof key === 'string') {
          handleSettingChange(key, value);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);


  const {
    data: storeSettingsData,
    isLoading: settingsLoading,
    error: storeSettingsError,
  } = useStoreSettings({
    onUnauthorized: () => navigate('/login'),
  });

  const {
    data: storeProductsData,
    isLoading: productsLoading,
    error: storeProductsError,
  } = useStoreProducts({
    onUnauthorized: () => navigate('/login'),
  });

  const loading = settingsLoading || productsLoading;

  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'tablet' | 'desktop'>(() => {
    // Auto-detect: on mobile devices, show mobile preview by default
    if (window.innerWidth < 640) return 'mobile';
    if (window.innerWidth < 1024) return 'tablet';
    return 'desktop';
  });
  const [selectedEditPath, setSelectedEditPath] = useState<string | null>(null);
  const [mobileEditPanelOpen, setMobileEditPanelOpen] = useState(false);

  // Mobile responsive editor
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setMobilePanelOpen(false);
    };
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Auto-open mobile edit panel when element is selected (only on mobile)
  useEffect(() => {
    if (selectedEditPath && window.innerWidth < 1024) {
      setMobileEditPanelOpen(true);
    }
  }, [selectedEditPath]);

  const handleSelectEditPath = useCallback((path: string) => {
    setSelectedEditPath(path);
  }, []);

  const IFRAME_SRC_DOC = useMemo(
    () =>
      `<!doctype html><html><head><meta charset="utf-8" /></head><body style="margin:0"><div id="ecopro-iframe-root"></div></body></html>`,
    []
  );

  const syncIframeHead = useCallback((doc: Document) => {
    // Copy over styles so Tailwind/media queries work inside the iframe.
    const head = doc.head;
    // Remove any previous copied styles (but keep meta/charset).
    Array.from(head.querySelectorAll('style[data-ecopro],link[data-ecopro]')).forEach((n) => n.remove());

    const parentNodes = Array.from(document.head.querySelectorAll('link[rel="stylesheet"],style'));
    parentNodes.forEach((node) => {
      if (node.tagName === 'LINK') {
        const link = node as HTMLLinkElement;
        if (!link.href) return;
        const clone = doc.createElement('link');
        clone.rel = 'stylesheet';
        clone.href = link.href;
        clone.setAttribute('data-ecopro', '1');
        head.appendChild(clone);
        return;
      }
      const style = node as HTMLStyleElement;
      if (!style.textContent) return;
      const clone = doc.createElement('style');
      clone.textContent = style.textContent;
      clone.setAttribute('data-ecopro', '1');
      head.appendChild(clone);
    });

    // Match RTL/LTR directionality.
    doc.documentElement.lang = document.documentElement.lang || 'en';
    doc.documentElement.dir = document.documentElement.dir || 'ltr';
  }, []);

  // Reset iframe state when switching preview mode.
  // Must reset for ALL modes — switching devices unmounts the old iframe,
  // so the old React root becomes stale. Always create a fresh root.
  useEffect(() => {
    setIframeReady(false);
    previewIframeRootRef.current = null;
  }, [previewDevice]);

  // Template picker (header)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState('all');
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const autoExpandedForLegacyTemplateRef = React.useRef(false);

  const currentTemplateIsReady = useMemo(() => {
    const normalized = normalizeTemplateId(String(settings.template || DEFAULT_TEMPLATE_ID));
    return READY_TEMPLATE_IDS.has(normalized);
  }, [settings.template]);

  // If this store is already on a non-ready template, automatically expand so the
  // current selection is still reachable from the picker.
  useEffect(() => {
    if (loading) return;
    if (autoExpandedForLegacyTemplateRef.current) return;

    const normalized = normalizeTemplateId(String(settings.template || DEFAULT_TEMPLATE_ID));
    if (!READY_TEMPLATE_IDS.has(normalized)) {
      setShowAllTemplates(true);
      autoExpandedForLegacyTemplateRef.current = true;
    }
  }, [loading, settings.template]);

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    const base = showAllTemplates
      ? TEMPLATE_PREVIEWS
      : TEMPLATE_PREVIEWS.filter((tpl) => READY_TEMPLATE_IDS.has(tpl.id));

    return base.filter((tpl) => {
      const searchMatch = !q || tpl.name.toLowerCase().includes(q) || tpl.id.toLowerCase().includes(q);
      const categoryMatch = templateCategory === 'all' || (tpl.categories && tpl.categories.includes(templateCategory));
      return searchMatch && categoryMatch;
    });
  }, [templateSearch, templateCategory, showAllTemplates]);

  const effectiveTemplateId = useMemo(() => {
    const normalized = normalizeTemplateId(String(settings.template || DEFAULT_TEMPLATE_ID));
    const allowed = TEMPLATE_PREVIEWS.some((t) => t.id === normalized);
    return allowed ? normalized : DEFAULT_TEMPLATE_ID;
  }, [settings.template]);

  // Preview-only selection (does not save until user clicks "Use template")
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const activeTemplateId = previewTemplateId ? normalizeTemplateId(previewTemplateId) : effectiveTemplateId;
  const isPreviewingDifferentTemplate = Boolean(previewTemplateId && normalizeTemplateId(previewTemplateId) !== effectiveTemplateId);

  // If an old/removed template is present in settings, switch locally to a valid one.
  useEffect(() => {
    if (loading) return;
    setSettings((prev) => {
      const normalized = normalizeTemplateId(String(prev.template || DEFAULT_TEMPLATE_ID));
      const allowed = TEMPLATE_PREVIEWS.some((t) => t.id === normalized);
      if (allowed) return prev;
      return { ...prev, template: DEFAULT_TEMPLATE_ID };
    });
  }, [loading]);

  // Load store data
  useEffect(() => {
    if (storeSettingsData) setSettings(storeSettingsData);
  }, [storeSettingsData]);

  useEffect(() => {
    if (Array.isArray(storeProductsData)) setProducts(storeProductsData);
  }, [storeProductsData]);

  useEffect(() => {
    if (storeSettingsError && !error) {
      const message = storeSettingsError instanceof Error ? storeSettingsError.message : 'Failed to load store settings';
      setError(message);
    }
  }, [storeSettingsError, error]);

  useEffect(() => {
    if (storeProductsError && !error) {
      const message = storeProductsError instanceof Error ? storeProductsError.message : 'Failed to load products';
      setError(message);
    }
  }, [storeProductsError, error]);

  const handleSettingChange = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // Handle template change - reset template-specific settings when switching and auto-save
  const handleTemplateChange = async (newTemplateId: string) => {
    const currentTemplate = normalizeTemplateId(settings.template || DEFAULT_TEMPLATE_ID);
    const nextTemplate = normalizeTemplateId(newTemplateId);
    if (nextTemplate === currentTemplate) {
      setPreviewTemplateId(null);
      return;
    }

    // Use fast template-only endpoint (now supports per-template snapshots).
    setSaving(true);
    try {
      const res = await fetch('/api/client/store/template', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ template: nextTemplate, mode: 'import' }),
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data && (data.error || data.message)) ? String(data.error || data.message) : t('editor.saveFailed'));
      }

      const savedData = await res.json().catch(() => ({} as any));

      // If backend is running in dev fallback mode (DB unavailable), don't pretend it saved.
      if (savedData && (savedData as any).__dbUnavailable) {
        throw new Error('Database unavailable. Changes were not saved.');
      }

      // Server returns the merged settings for the selected template snapshot.
      setSelectedEditPath(null);
      setPreviewTemplateId(null);
      setSettings(savedData || { template: nextTemplate });
      queryClient.invalidateQueries({ queryKey: ['storeSettings'] });
      setSuccess(t('editor.templateChanged', { name: nextTemplate }) || `Template changed to ${nextTemplate}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save template change');
    } finally {
      setSaving(false);
    }
  };

  // Reset current template to its defaults
  const handleResetTemplate = async () => {
    if (!confirm('Reset this template to its original layout and settings? This only affects the currently selected template.')) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/client/store/template', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ template: effectiveTemplateId, mode: 'defaults' }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data && (data.error || data.message)) ? String(data.error || data.message) : 'Failed to reset template');
      }

      const savedData = await res.json().catch(() => ({} as any));
      if (savedData && (savedData as any).__dbUnavailable) {
        throw new Error('Database unavailable. Changes were not saved.');
      }

      setSelectedEditPath(null);
      setPreviewTemplateId(null);
      setSettings(savedData || { template: effectiveTemplateId });
      queryClient.invalidateQueries({ queryKey: ['storeSettings'] });
      setSuccess('Template reset to defaults');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset template');
    } finally {
      setSaving(false);
    }
  };

  // Upload any base64 data URIs found in settings before saving
  // Compress image via canvas before uploading — keeps high-res images under control
  const compressImage = (dataUri: string, maxWidth = 1920, quality = 0.85): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round(height * (maxWidth / width));
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context failed'));
        ctx.drawImage(img, 0, 0, width, height);
        // Try webp first, fallback to jpeg if browser doesn't support webp encoding
        canvas.toBlob(
          (blob) => {
            if (blob) return resolve(blob);
            // Fallback to jpeg
            canvas.toBlob(
              (jpegBlob) => jpegBlob ? resolve(jpegBlob) : reject(new Error('Blob conversion failed')),
              'image/jpeg',
              quality
            );
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = dataUri;
    });
  };

  const sanitizeSettingsImages = async (raw: StoreSettings): Promise<StoreSettings> => {
    const cleaned: StoreSettings = { ...raw };
    const uploads: Promise<void>[] = [];

    const uploadBase64 = async (b64DataUri: string): Promise<string> => {
      const blob = await compressImage(b64DataUri);
      const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
      const file = new File([blob], `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`, { type: blob.type });
      const result = await uploadImage(file);
      return result.url;
    };

    // Regex to match a complete data URI: data:image/...;base64,...
    const dataUriRegex = /data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g;

    const processString = async (val: string): Promise<string> => {
      if (!val.includes('data:image/')) return val;
      try {
        const matches = val.match(dataUriRegex);
        if (!matches || matches.length === 0) {
          return val.replace(/data:image\/[^,]+,[^\s,]*/g, '').replace(/,,+/g, ',').replace(/^,|,$/g, '');
        }
        let result = val;
        for (const dataUri of matches) {
          try {
            const url = await uploadBase64(dataUri);
            result = result.replace(dataUri, url);
          } catch (uploadErr) {
            console.error('[sanitizeSettingsImages] Upload failed for data URI, keeping original:', uploadErr);
            // Keep the base64 data URI rather than stripping it — the image won't be lost
          }
        }
        return result;
      } catch (outerErr) {
        console.error('[sanitizeSettingsImages] processString failed, keeping original value:', outerErr);
        return val;
      }
    };

    const processArray = async (arr: any[]): Promise<any[]> => {
      const result = [...arr];
      for (let i = 0; i < result.length; i++) {
        if (typeof result[i] === 'string' && result[i].includes('data:image/')) {
          result[i] = await processString(result[i]);
        }
      }
      return result;
    };

    const processObject = async (obj: Record<string, any>): Promise<Record<string, any>> => {
      const out = { ...obj };
      for (const k of Object.keys(out)) {
        const v = out[k];
        if (typeof v === 'string' && v.includes('data:image/')) {
          out[k] = await processString(v);
        } else if (Array.isArray(v)) {
          if (JSON.stringify(v).includes('data:image/')) {
            out[k] = await processArray(v);
          }
        } else if (v && typeof v === 'object') {
          if (JSON.stringify(v).includes('data:image/')) {
            out[k] = await processObject(v);
          }
        }
      }
      return out;
    };

    // Process all keys recursively
    for (const key of Object.keys(cleaned)) {
      const val = cleaned[key];
      if (typeof val === 'string' && val.includes('data:image/')) {
        uploads.push(
          (async () => { cleaned[key] = await processString(val); })()
        );
      } else if (Array.isArray(val)) {
        if (JSON.stringify(val).includes('data:image/')) {
          uploads.push(
            (async () => { cleaned[key] = await processArray(val); })()
          );
        }
      } else if (val && typeof val === 'object') {
        if (JSON.stringify(val).includes('data:image/')) {
          uploads.push(
            (async () => { cleaned[key] = await processObject(val); })()
          );
        }
      }
    }

    await Promise.all(uploads);
    return cleaned;
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Strip / upload any base64 images before sending
      const cleanedSettings = await sanitizeSettingsImages(settings);

      // "Publish Changes" means the store should go live
      cleanedSettings.is_public = true;

      // If the user is previewing a different template, apply it on publish
      if (previewTemplateId && normalizeTemplateId(previewTemplateId) !== effectiveTemplateId) {
        cleanedSettings.template = normalizeTemplateId(previewTemplateId);
      }

      // Strip DB-internal columns that should never be sent back
      // (they cause exponential data growth when re-embedded into template_settings JSONB)
      delete cleanedSettings.template_settings;
      delete cleanedSettings.template_settings_by_template;
      delete cleanedSettings.global_settings;
      delete cleanedSettings.id;
      delete cleanedSettings.client_id;
      delete cleanedSettings.created_at;
      delete cleanedSettings.updated_at;
      delete cleanedSettings.page_views;
      delete cleanedSettings.subscription_status;
      delete cleanedSettings.subscription_plan;
      delete cleanedSettings.trial_ends_at;
      delete cleanedSettings.subscription_ends_at;
      delete cleanedSettings.is_locked;

      const res = await fetch('/api/client/store/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify(cleanedSettings),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data && (data.error || data.message)) ? String(data.error || data.message) : t('editor.saveFailed'));
      }

      // Update local settings with response from server to ensure consistency
      const savedData = await res.json().catch(() => ({} as any));

      // If backend is running in dev fallback mode (DB unavailable), don't pretend it saved.
      if (savedData && (savedData as any).__dbUnavailable) {
        throw new Error('Database unavailable. Changes were not saved.');
      }
      setSettings(savedData);
      setPreviewTemplateId(null);
      queryClient.invalidateQueries({ queryKey: ['storeSettings'] });
      
      setSuccess(t('editor.saved'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (key: string, file: File) => {
    try {
      // Compress large images before uploading
      let uploadFile = file;
      if (file.type.startsWith('image/') && file.size > 500 * 1024) {
        const dataUri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const blob = await compressImage(dataUri);
        uploadFile = new File([blob], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' });
      }
      const result = await uploadImage(uploadFile);
      handleSettingChange(key, result.url);
    } catch (err) {
      setError('Failed to upload image');
    }
  };

  const handlePreviewClickCapture = useCallback((e: React.MouseEvent) => {
    // If the template picker is open, any click in the preview should hide it
    // so users can focus on selecting/editing elements inside the phone.
    setTemplatePickerOpen(false);

    const target = e.target as HTMLElement | null;
    if (!target) return;

    const root = previewRootRef.current;
    const el = target.closest('[data-edit-path]') as HTMLElement | null;
    if (!el) return;
    if (root && !root.contains(el)) return;

    const path = el.getAttribute('data-edit-path');
    if (!path) return;

    e.preventDefault();
    e.stopPropagation();
    handleSelectEditPath(path);
  }, [handleSelectEditPath]);

  // Close the template picker if the user switches away from Preview.
  useEffect(() => {
    if (activeTab !== 'preview') setTemplatePickerOpen(false);
  }, [activeTab]);

  useEffect(() => {
    const escapeCss = (value: string) => {
      const cssAny = (globalThis as any).CSS;
      if (cssAny && typeof cssAny.escape === 'function') return cssAny.escape(value);
      return value.replace(/[^a-zA-Z0-9_\-]/g, (m) => `\\${m}`);
    };

    const clearAndSelect = (root: ParentNode | null) => {
      if (!root) return;
      const prev = root.querySelector('[data-edit-selected="true"]') as HTMLElement | null;
      if (prev) prev.removeAttribute('data-edit-selected');
      if (!selectedEditPath) return;
      const selected = root.querySelector(`[data-edit-path="${escapeCss(selectedEditPath)}"]`) as HTMLElement | null;
      if (selected) {
        selected.setAttribute('data-edit-selected', 'true');
        try {
          selected.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        } catch {
          // ignore
        }
      }
    };

    if (previewDevice === 'desktop') {
      clearAndSelect(previewRootRef.current);
      return;
    }

    const doc = previewIframeRef.current?.contentDocument;
    clearAndSelect(doc);
  }, [selectedEditPath]);

  const previewGridCols = useMemo(() => {
    // Use minmax(0, ...) so wide preview content can't force horizontal overflow.
    if (previewDevice === 'desktop') return 'lg:grid-cols-[minmax(0,1fr),460px]';
    if (previewDevice === 'tablet') return 'lg:grid-cols-[minmax(0,620px),minmax(0,1fr)]';
    return 'lg:grid-cols-[minmax(0,420px),minmax(0,1fr)]';
  }, [previewDevice]);

  useEffect(() => {
    const root = previewDevice === 'desktop' ? previewRootRef.current : previewIframeRef.current?.contentDocument;
    if (!root) return;

    const handleImageError = (e: Event) => {
      const img = e.target as HTMLImageElement | null;
      if (!img) return;
      if (img.src === '/placeholder.png') return; // Already fallback, don't loop
      // Silently replace broken image with placeholder without logging
      img.src = '/placeholder.png';
    };

    const handleVideoError = (e: Event) => {
      const video = e.target as HTMLVideoElement | null;
      if (!video) return;
      // Hide broken video elements
      video.style.display = 'none';
    };

    // Add error handlers to all current images
    const images = (root as any).querySelectorAll('img') as NodeListOf<HTMLImageElement>;
    images.forEach((img) => img.addEventListener('error', handleImageError));

    const videos = (root as any).querySelectorAll('video') as NodeListOf<HTMLVideoElement>;
    videos.forEach((video) => video.addEventListener('error', handleVideoError));

    return () => {
      images.forEach((img) => img.removeEventListener('error', handleImageError));
      videos.forEach((video) => video.removeEventListener('error', handleVideoError));
    };
  }, [selectedEditPath, settings, products]);

  const formatPrice = useCallback(
    (price: number) => {
      const currency = settings.currency_code || 'DZD';
      return `${Math.round(price).toLocaleString()} ${currency}`;
    },
    [settings.currency_code]
  );

  // Template preview props
  // When no real products exist, show sample products so the template isn't blank
  const SAMPLE_PRODUCTS: StoreProduct[] = useMemo(() => [
    { id: 1, title: 'منتج تجريبي 1', price: 3500, images: ['https://placehold.co/600x800/1a1a2e/e0e0e0?text=Product+1'], category: 'ملابس', stock_quantity: 10, is_featured: true, slug: 'sample-1', views: 120, description: 'هذا منتج تجريبي لعرض القالب. أضف منتجات حقيقية من إدارة المتجر.' },
    { id: 2, title: 'منتج تجريبي 2', price: 2800, images: ['https://placehold.co/600x800/2d2d44/e0e0e0?text=Product+2'], category: 'إكسسوارات', stock_quantity: 25, is_featured: false, slug: 'sample-2', views: 85, description: 'منتج تجريبي ثاني لعرض كيف يبدو القالب مع عدة منتجات.' },
    { id: 3, title: 'منتج تجريبي 3', price: 4200, images: ['https://placehold.co/600x800/16213e/e0e0e0?text=Product+3'], category: 'ملابس', stock_quantity: 5, is_featured: true, slug: 'sample-3', views: 200, description: 'منتج تجريبي ثالث.' },
    { id: 4, title: 'منتج تجريبي 4', price: 1900, images: ['https://placehold.co/600x800/0f3460/e0e0e0?text=Product+4'], category: 'إكسسوارات', stock_quantity: 15, is_featured: false, slug: 'sample-4', views: 60, description: 'منتج تجريبي رابع.' },
  ], []);

  const effectiveProducts = products.length > 0 ? products : SAMPLE_PRODUCTS;

  const templateProps = useMemo(
    () => ({
      storeSlug: settings.store_slug || 'preview',
      settings: {
        ...settings,
        ...(isPreviewingDifferentTemplate ? getTemplateDefaults() : null),
        template: activeTemplateId,
      },
      products: effectiveProducts,
      filtered: effectiveProducts,
      categories: [...new Set(effectiveProducts.map((p) => p.category).filter(Boolean))] as string[],
      searchQuery: '',
      setSearchQuery: () => {},
      categoryFilter: '',
      setCategoryFilter: () => {},
      sortOption: 'featured' as const,
      setSortOption: () => {},
      viewMode: 'grid' as const,
      setViewMode: () => {},
      formatPrice,
      primaryColor: settings.template_accent_color || settings.primary_color || '#1E90FF',
      secondaryColor: settings.secondary_color || '#6B7280',
      bannerUrl: settings.banner_url || null,
      navigate: (to: string | number) => { if (typeof to === 'string') navigate(to); },
      canManage: true,
      forcedBreakpoint: previewDevice,
      onSelect: handleSelectEditPath,
    }),
    [settings, effectiveProducts, formatPrice, navigate, previewDevice, activeTemplateId, isPreviewingDifferentTemplate, handleSelectEditPath]
  );

  const selectedTemplateId = useMemo(() => normalizeTemplateId(String(activeTemplateId)), [activeTemplateId]);

  // Render storefront into an iframe for all device modes so CSS breakpoints match the simulated device.
  useEffect(() => {
    const iframe = previewIframeRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc || !iframeReady) return;

    try {
      syncIframeHead(doc);
    } catch {
      // ignore
    }

    const mount = doc.getElementById('ecopro-iframe-root');
    if (!mount) return;

    if (!previewIframeRootRef.current) {
      previewIframeRootRef.current = createRoot(mount);
    }

    previewIframeRootRef.current.render(
      <div>
        <style>{`[data-edit-selected="true"]{outline:2px solid hsl(var(--primary)); outline-offset:2px;}`}</style>
        {RenderStorefront(selectedTemplateId, templateProps as any)}
      </div>
    );

    // Inject font-family override into iframe head if a custom font is selected
    const fontFamily = (templateProps.settings as any)?.template_font_family;
    if (fontFamily && fontFamily !== 'cairo') {
      const fontMap: Record<string, { url: string; name: string }> = {
        tajawal: { url: 'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap', name: 'Tajawal' },
        almarai: { url: 'https://fonts.googleapis.com/css2?family=Almarai:wght@300;400;700;800&display=swap', name: 'Almarai' },
        'ibm-plex-arabic': { url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Arabic:wght@300;400;500;700&display=swap', name: 'IBM Plex Arabic' },
      };
      const fontInfo = fontMap[fontFamily];
      if (fontInfo) {
        doc.querySelectorAll('[data-font-inject]').forEach(n => n.remove());
        const link = doc.createElement('link');
        link.rel = 'stylesheet'; link.href = fontInfo.url;
        link.setAttribute('data-font-inject', '1');
        doc.head.appendChild(link);
        const style = doc.createElement('style');
        style.setAttribute('data-font-inject', '1');
        style.textContent = `*{font-family:'${fontInfo.name}',sans-serif!important}`;
        doc.head.appendChild(style);
      }
    }
  }, [iframeReady, previewDevice, selectedTemplateId, templateProps, syncIframeHead]);

  // Click-to-edit inside iframe (capture phase) so templates don't need special wiring.
  // Also handle touch events for mobile devices
  useEffect(() => {
    const doc = previewIframeRef.current?.contentDocument;
    if (!doc || !iframeReady) return;

    const handleEditPath = (target: HTMLElement | null) => {
      setTemplatePickerOpen(false);
      if (!target) return;
      const el = target.closest('[data-edit-path]') as HTMLElement | null;
      if (!el) return;
      const path = el.getAttribute('data-edit-path');
      if (!path) return;
      handleSelectEditPath(path);
    };

    // Check if the target is inside a contentEditable element — if so,
    // let the event through so the user can tap-to-focus and edit text.
    const isContentEditable = (target: HTMLElement | null): boolean => {
      if (!target) return false;
      let el: HTMLElement | null = target;
      while (el) {
        if (el.isContentEditable) return true;
        el = el.parentElement;
      }
      return false;
    };

    // Check if the click is on or inside an interactive element (file upload, button, select, input, etc.)
    const isInteractiveElement = (target: HTMLElement | null): boolean => {
      if (!target) return false;
      let el: HTMLElement | null = target;
      while (el) {
        const tag = el.tagName;
        if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'LABEL') return true;
        if (el.getAttribute('data-upload-trigger') !== null) return true;
        el = el.parentElement;
      }
      return false;
    };

    const onClickCapture = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (isContentEditable(target) || isInteractiveElement(target)) {
        // Allow contentEditable focus and interactive elements — still track the edit path
        handleEditPath(target);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      handleEditPath(target);
    };

    const onTouchEnd = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (isContentEditable(target) || isInteractiveElement(target)) {
        handleEditPath(target);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      handleEditPath(target);
    };

    doc.addEventListener('click', onClickCapture, true);
    doc.addEventListener('touchend', onTouchEnd, true);
    return () => {
      doc.removeEventListener('click', onClickCapture, true);
      doc.removeEventListener('touchend', onTouchEnd, true);
    };
  }, [iframeReady, previewDevice, handleSelectEditPath]);

  // Touch event handler for desktop preview mode on real mobile devices
  // Click events are handled by onClickCapture in JSX, but touch needs native listener
  useEffect(() => {
    if (previewDevice !== 'desktop') return;
    const root = previewRootRef.current;
    if (!root) return;

    const onTouchEnd = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const el = target.closest('[data-edit-path]') as HTMLElement | null;
      if (el) {
        const path = el.getAttribute('data-edit-path');
        if (path) {
          e.preventDefault();
          e.stopPropagation();
          setTemplatePickerOpen(false);
          handleSelectEditPath(path);
        }
      }
    };

    root.addEventListener('touchend', onTouchEnd, true);
    return () => {
      root.removeEventListener('touchend', onTouchEnd, true);
    };
  }, [previewDevice, handleSelectEditPath]);

  const deviceFrame = useMemo(() => {
    if (previewDevice === 'mobile') {
      // Samsung Galaxy S24 Ultra scaled to 80%: 330x732
      return { width: '330px', maxWidth: '330px', height: '732px', aspectRatio: '330/732' } as const;
    }
    if (previewDevice === 'tablet') {
      // iPad Pro 11" scaled to 65%: 542x776
      return { width: '542px', maxWidth: '542px', height: '776px', aspectRatio: '542/776' } as const;
    }
    // Desktop uses fluid width/height — no fixed frame.
    return { width: '100%', maxWidth: '100%', height: '100%', aspectRatio: 'auto' } as const;
  }, [previewDevice]);

  const baseDeviceOuter = useMemo(() => {
    if (previewDevice === 'mobile') {
      // Outer container is 342px wide and has 6px padding around a 732px screen.
      return { width: 342, height: 732 + 12 };
    }
    if (previewDevice === 'tablet') {
      // Outer container is 562px wide; includes 12px vertical padding and a small camera area.
      return { width: 562, height: 776 + 24 + 20 };
    }
    // Desktop uses fluid layout.
    return { width: 0, height: 0 };
  }, [previewDevice]);

  const [deviceScale, setDeviceScale] = useState(1);

  useLayoutEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const compute = () => {
      if (previewDevice === 'desktop') {
        setDeviceScale(1);
        return;
      }
      const availW = container.clientWidth;
      const availH = container.clientHeight;
      const naturalW = previewDevice === 'mobile' ? 375 : 768;
      const naturalH = previewDevice === 'mobile' ? 812 : 1024;
      const s = Math.min((availW * 0.98) / naturalW, (availH * 0.98) / naturalH, 1.4);
      setDeviceScale(Math.max(0.25, s));
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [previewDevice]);

  useEffect(() => {
    if (!templatePickerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTemplatePickerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [templatePickerOpen]);

  const editPanel = useMemo(() => {
    const path = selectedEditPath;
    if (!path) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>{t('editor.edit')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {t('editor.clickToEdit')}
            </div>
          </CardContent>
        </Card>
      );
    }

    const bindText = (label: string, key: keyof StoreSettings, placeholder?: string) => (
      <div className="space-y-2">
        <div className="text-sm font-medium">{label}</div>
        <Input
          value={String((settings as any)[key] || '')}
          onChange={(e) => handleSettingChange(String(key), e.target.value)}
          placeholder={placeholder}
        />
      </div>
    );

    const bindColor = (label: string, key: keyof StoreSettings, fallback: string) => (
      <div className="space-y-2">
        <div className="text-sm font-medium">{label}</div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={settings?.[key] || fallback}
            onChange={(e) => handleSettingChange(String(key), e.target.value)}
            className="w-12 h-12 rounded border border-input cursor-pointer"
          />
          <Input
            value={settings?.[key] || fallback}
            onChange={(e) => handleSettingChange(String(key), e.target.value)}
            placeholder={fallback}
            className="flex-1"
          />
        </div>
      </div>
    );

    const bindSwitch = (label: string, key: keyof StoreSettings, defaultValue: boolean) => (
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{label}</div>
        <button
          onClick={() => handleSettingChange(String(key), !settings?.[key])}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings?.[key] !== false ? 'bg-primary' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings?.[key] !== false ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    );

    const bindSelect = (label: string, key: string, options: { value: string; label: string }[], fallback: string) => (
      <div className="space-y-2">
        <div className="text-sm font-medium">{label}</div>
        <select
          value={String((settings as any)[key] || fallback)}
          onChange={(e) => handleSettingChange(key, e.target.value)}
          className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    );

    const bindImage = (label: string, key: keyof StoreSettings) => (
      <div className="space-y-2">
        <div className="text-sm font-medium">{label}</div>
        <div className="flex items-center gap-3">
          {(settings as any)[key] ? (
            <img src={String((settings as any)[key])} alt={label} className="h-14 w-auto rounded" />
          ) : null}
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImageUpload(String(key), file);
            }}
          />
        </div>
      </div>
    );

    const bindRange = (label: string, key: string, min: number, max: number, fallback: number, unit?: string) => (
      <div className="space-y-2">
        <div className="text-sm font-medium">{label}: {(settings as any)[key] || fallback}{unit || ''}</div>
        <input
          type="range"
          min={min}
          max={max}
          value={Number((settings as any)[key]) || fallback}
          onChange={(e) => handleSettingChange(key, e.target.value)}
          className="w-full"
        />
      </div>
    );

    const bindTextarea = (label: string, key: string, placeholder?: string, rows?: number) => (
      <div className="space-y-2">
        <div className="text-sm font-medium">{label}</div>
        <textarea
          value={String((settings as any)[key] || '')}
          onChange={(e) => handleSettingChange(key, e.target.value)}
          placeholder={placeholder}
          rows={rows || 4}
          className="w-full px-3 py-2 border rounded-md bg-background text-foreground font-mono text-xs"
        />
      </div>
    );

    const bindJsonArray = (label: string, key: string, placeholder?: string) => (
      <div className="space-y-2">
        <div className="text-sm font-medium">{label}</div>
        <textarea
          value={String((settings as any)[key] || '')}
          onChange={(e) => handleSettingChange(key, e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="w-full px-3 py-2 border rounded-md bg-background text-foreground font-mono text-xs"
        />
        <div className="text-xs text-muted-foreground">{t('editor.jsonRequired')}</div>
      </div>
    );

    let body: React.ReactNode = (
      <div className="text-sm text-muted-foreground">
        {t('editor.notEditable')}
      </div>
    );

    if (path === '__settings.store_name') {
      body = bindText('Store Name', 'store_name', 'Your Store Name');
    } else if (path.startsWith('layout.header.logo') || path === 'layout.header') {
      body = (
        <div className="space-y-4">
          {bindImage('Store Logo', 'store_logo')}
          {bindText('Store Name', 'store_name', 'Your Store Name')}
          {bindColor('Header Background', 'template_header_bg' as any, '#FDF8F3')}
          {bindColor('Header Text Color', 'template_header_text' as any, '#F97316')}
        </div>
      );
    } else if (path.startsWith('layout.hero.title')) {
      if (activeTemplateId === 'urgency-max') {
        body = bindText('Hero Title', 'template_hero_heading', 'Main headline');
      } else {
        body = (
          <div className="space-y-4">
            {bindText('Hero Heading', 'template_hero_heading', 'Main headline for your store')}
            {bindColor('Heading Color', 'template_hero_title_color' as any, '#1C1917')}
            {bindText('Heading Size (px)', 'template_hero_title_size' as any, '32')}
          </div>
        );
      }
    } else if (path.startsWith('layout.hero.subtitle')) {
      if (activeTemplateId === 'urgency-max') {
        body = bindText('Hero Subtitle', 'template_hero_subtitle', 'Subtitle text');
      } else {
        body = (
          <div className="space-y-4">
            {bindText('Hero Subtitle', 'template_hero_subtitle', 'Subtitle or tagline')}
            {bindColor('Subtitle Color', 'template_hero_subtitle_color' as any, '#78716C')}
            {bindText('Subtitle Size (px)', 'template_hero_subtitle_size' as any, '13')}
          </div>
        );
      }
    } else if (path.startsWith('layout.hero.kicker')) {
      body = (
        <div className="space-y-4">
          {bindText('Kicker Text', 'template_hero_kicker' as any, 'NEW SEASON • SOFT & PLAYFUL')}
          {bindColor('Kicker Color', 'template_hero_kicker_color' as any, '#78716C')}
        </div>
      );
    } else if (path.startsWith('layout.hero.cta')) {
      body = (
        <div className="space-y-4">
          {bindText('Primary Button Text', 'template_button_text', 'Shop Now')}
          {bindText('Secondary Button Text', 'template_button2_text' as any, 'View All')}
          {bindColor('Primary Button Color', 'template_accent_color', '#F97316')}
          {bindColor('Secondary Button Border', 'template_button2_border' as any, '#D6D3D1')}
        </div>
      );
    } else if (path.startsWith('layout.hero.image')) {
      body = (
        <div className="space-y-4">
          {bindImage('Hero Image (Banner)', 'banner_url')}
          {bindText('Hero Video URL (optional)', 'hero_video_url' as any, 'https://...')}
        </div>
      );
    } else if (path.startsWith('layout.hero.badge')) {
      if (activeTemplateId === 'papercraft') {
        body = (
          <div className="space-y-4">
            {bindTextarea('Testimonial Text', 'template_testimonial_text' as any, '"Amazing product..."', 4)}
            {bindText('Testimonial Author', 'template_testimonial_author' as any, '— Sarah M.')}
          </div>
        );
      } else if (activeTemplateId === 'urgency-max') {
        body = (
          <div className="space-y-4">
            {bindText('Urgency Bar Text', 'template_hero_kicker' as any, '🔥 SELLING FAST')}
            {bindText('Urgency Bar Warning', 'template_warning_text' as any, '⚠️ Price increases when timer ends!')}
          </div>
        );
      } else {
        body = (
          <div className="space-y-4">
            <div className="border rounded-lg p-3 bg-gradient-to-r from-orange-50 to-red-50">
              <h4 className="font-semibold text-sm mb-2">🎯 Promotional Banner</h4>
              {bindSwitch('Show Banner', 'show_promotional_banner' as any, true)}
              {bindText('Banner Title', 'template_hero_badge_title' as any, '🔥 عرض محدود')}
              {bindText('Banner Subtitle', 'template_hero_badge_subtitle' as any, 'اطلب الآن واحصل على توصيل مجاني!')}
              {bindColor('Banner Accent', 'template_accent_color', '#F97316')}
            </div>
          </div>
        );
      }
    } else if (path === 'layout.hero') {
      body = (
        <div className="space-y-4">
          {bindImage('Hero Image', 'banner_url')}
          {bindText('Hero Heading', 'template_hero_heading', 'Main headline')}
          {bindText('Hero Subtitle', 'template_hero_subtitle', 'Subtitle')}
          {bindColor('Background Color', 'template_bg_color' as any, '#FDF8F3')}
          {bindColor('Accent Color', 'template_accent_color', '#F97316')}
        </div>
      );
    } else if (path.startsWith('layout.checkout.')) {
      body = (
        <div className="space-y-4">
          {bindText('Checkout Title', 'template_checkout_title' as any, 'Your Order')}
          {bindText('Checkout Subheading', 'template_checkout_subheading' as any, 'Secure checkout subheading')}
        </div>
      );
    } else if (path.startsWith('layout.featured.title')) {
      body = (
        <div className="space-y-4">
          {bindText('Section Title', 'template_featured_title' as any, 'Soft & snugly picks')}
          {bindColor('Title Color', 'template_section_title_color' as any, '#1C1917')}
          {bindText('Title Size (px)', 'template_section_title_size' as any, '20')}
        </div>
      );
    } else if (path.startsWith('layout.featured.subtitle')) {
      body = (
        <div className="space-y-4">
          {bindText('Section Subtitle', 'template_featured_subtitle' as any, 'A small edit of plush toys...')}
          {bindColor('Subtitle Color', 'template_section_subtitle_color' as any, '#78716C')}
        </div>
      );
    } else if (path === 'layout.products' || path.startsWith('layout.products.')) {
      body = (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Product details are managed in your product list.
          </div>
          {bindColor('Product Card Background', 'template_card_bg' as any, '#FFFFFF')}
          {bindColor('Product Tag Color', 'template_accent_color', '#F97316')}
          {bindColor('Product Title Color', 'template_product_title_color' as any, '#1C1917')}
          {bindColor('Product Price Color', 'template_product_price_color' as any, '#1C1917')}
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/store')}>Edit Products</Button>
        </div>
      );
    } else if (path.startsWith('layout.featured.items')) {
      body = (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Product details are managed in your product list.
          </div>
          {bindColor('Product Card Background', 'template_card_bg' as any, '#FFFFFF')}
          {bindColor('Product Tag Color', 'template_accent_color', '#F97316')}
          {bindColor('Product Title Color', 'template_product_title_color' as any, '#1C1917')}
          {bindColor('Product Price Color', 'template_product_price_color' as any, '#1C1917')}
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/store')}>Edit Products</Button>
        </div>
      );
    } else if (path.startsWith('layout.featured.addLabel')) {
      body = (
        <div className="space-y-4">
          {bindText('Add Button Label', 'template_add_to_cart_label' as any, 'Add')}
          <div className="text-xs text-muted-foreground">
            This label is used on product cards (e.g., Add/View).
          </div>
        </div>
      );
    } else if (path.startsWith('layout.featured')) {
      body = (
        <div className="space-y-4">
          {bindText('Section Title', 'template_featured_title' as any, 'Soft & snugly picks')}
          {bindText('Section Subtitle', 'template_featured_subtitle' as any, 'Description text...')}
          {bindColor('Section Background', 'template_bg_color' as any, '#FDF8F3')}
          <div className="text-sm text-muted-foreground">
            Products are generated from your product list.
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/store')}>Go to Products</Button>
        </div>
      );
    } else if (path.startsWith('layout.footer.copyright')) {
      body = (
        <div className="space-y-4">
          {bindText('Copyright Text', 'template_copyright' as any, '© 2026 Your Store')}
          {bindColor('Footer Text Color', 'template_footer_text' as any, '#A8A29E')}
        </div>
      );
    } else if (path.startsWith('layout.footer.social')) {
      body = (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Add social media links in JSON format.
          </div>
          {bindJsonArray('Social Links', 'template_social_links', '[{"platform":"facebook","url":"https://facebook.com/..."},{"platform":"instagram","url":"https://instagram.com/..."}]')}
          <div className="text-xs text-muted-foreground">
            Supported: facebook, twitter, instagram, youtube, linkedin, tiktok, pinterest
          </div>
        </div>
      );
    } else if (path.startsWith('layout.footer.links')) {
      body = (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Footer links can be customized in JSON format.
          </div>
          {bindJsonArray('Footer Links', 'template_footer_links' as any, '[{"label":"Shipping","url":"/shipping"},{"label":"Returns","url":"/returns"},{"label":"Contact","url":"/contact"}]')}
          {bindColor('Link Color', 'template_footer_link_color' as any, '#78716C')}
        </div>
      );
    } else if (path.startsWith('layout.header.nav')) {
      body = (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Add navigation links in JSON format.
          </div>
          {bindJsonArray('Navigation Links', 'template_nav_links', '[{"label":"Shop","url":"/products"},{"label":"About","url":"/about"},{"label":"Contact","url":"/contact"}]')}
        </div>
      );
    } else if (path === 'layout.categories') {
      if (activeTemplateId === 'papercraft') {
        body = (
          <div className="space-y-4">
            <div className="font-medium text-sm">Feature Cards</div>
            {bindText('Feature 1 Title', 'template_feature1_title' as any, '✋ Handcrafted')}
            {bindText('Feature 1 Description', 'template_feature1_desc' as any, 'Made by real artisans')}
            {bindText('Feature 2 Title', 'template_feature2_title' as any, '🌿 Sustainable')}
            {bindText('Feature 2 Description', 'template_feature2_desc' as any, 'Eco-friendly materials')}
            {bindText('Feature 3 Title', 'template_feature3_title' as any, '🎁 Gift Ready')}
            {bindText('Feature 3 Description', 'template_feature3_desc' as any, 'Beautiful packaging')}
          </div>
        );
      } else if (activeTemplateId === 'urgency-max') {
        body = (
          <div className="space-y-4">
            <div className="font-medium text-sm">Social Proof</div>
            {bindText('Viewers Text', 'template_viewers_text' as any, '47 people viewing this right now')}
            {bindText('Sold Today Text', 'template_sold_today' as any, '156 sold in the last 24 hours')}
          </div>
        );
      } else {
        body = (
          <div className="space-y-4">
            <div className="font-medium text-sm">Description</div>
            {bindTextarea('Description Text', 'template_description_text', 'Write a short description for your store...', 5)}
            {bindColor('Text Color', 'template_description_color' as any, '#78716C')}
            {bindRange('Font Size', 'template_description_size', 10, 32, 14, 'px')}
            {bindSelect('Font Style', 'template_description_style', [
              { value: 'normal', label: 'Normal' },
              { value: 'italic', label: 'Italic' },
            ], 'normal')}
            {bindSelect('Font Weight', 'template_description_weight', [
              { value: '300', label: 'Light (300)' },
              { value: '400', label: 'Normal (400)' },
              { value: '500', label: 'Medium (500)' },
              { value: '600', label: 'Semi-bold (600)' },
              { value: '700', label: 'Bold (700)' },
            ], '400')}
            <div className="text-xs text-muted-foreground">
              Tip: if left empty, it will use your store description.
            </div>
          </div>
        );
      }
    } else if (path === 'layout.grid' || path.startsWith('layout.grid.')) {
      body = (
        <div className="space-y-4">
          <div className="font-medium text-sm">Product Grid Settings</div>
          {bindText('Grid Section Title', 'template_grid_title' as any, 'Our Products')}
          {bindSelect('Grid Columns (Desktop)', 'template_grid_columns', [
            { value: '2', label: '2 Columns' },
            { value: '3', label: '3 Columns' },
            { value: '4', label: '4 Columns' },
            { value: '5', label: '5 Columns' },
            { value: '6', label: '6 Columns' },
          ], '4')}
          {bindRange('Grid Gap', 'template_grid_gap', 8, 48, 24, 'px')}
          {bindRange('Card Border Radius', 'template_card_border_radius', 0, 32, 12, 'px')}
          {bindColor('Card Background', 'template_card_bg' as any, '#FFFFFF')}
        </div>
      );
    } else if (path.startsWith('layout.urgency.')) {
      if (path === 'layout.urgency.timer.hours.label' || path === 'layout.urgency.timer.hours') {
        body = bindText('Hours Label', 'template_timer_label_hours' as any, 'ساعات');
      } else if (path === 'layout.urgency.timer.mins.label' || path === 'layout.urgency.timer.mins') {
        body = bindText('Minutes Label', 'template_timer_label_mins' as any, 'دقائق');
      } else if (path === 'layout.urgency.timer.secs.label' || path === 'layout.urgency.timer.secs') {
        body = bindText('Seconds Label', 'template_timer_label_secs' as any, 'ثوان');
      } else if (path === 'layout.urgency.timer' || path.startsWith('layout.urgency.timer')) {
        body = (
          <div className="space-y-4">
            <div className="font-medium text-sm">Timer Labels</div>
            {bindText('Ends In Label', 'template_timer_ends_label' as any, 'Ends in:')}
            {bindText('Hours Label', 'template_timer_label_hours' as any, 'HOURS')}
            {bindText('Minutes Label', 'template_timer_label_mins' as any, 'MINS')}
            {bindText('Seconds Label', 'template_timer_label_secs' as any, 'SECS')}
          </div>
        );
      } else if (path === 'layout.urgency.stock') {
        body = (
          <div className="space-y-4">
            <div className="font-medium text-sm">Stock Warning</div>
            {bindText('Prefix', 'template_stock_prefix' as any, '⚠️ Only')}
            {bindText('Stock Count', 'template_stock_count' as any, '7')}
            {bindText('Stock Text', 'template_stock_text' as any, 'items left at this price!')}
          </div>
        );
      } else if (path === 'layout.urgency.pricing.original') {
        body = bindText('Original Price', 'template_original_price' as any, '19,999 دج');
      } else if (path === 'layout.urgency.pricing.sale') {
        body = bindText('Sale Price', 'template_sale_price' as any, '5,999 دج');
      } else if (path === 'layout.urgency.pricing.save') {
        body = bindText('Save Amount Text', 'template_save_amount' as any, 'وفر 14,000 دج!');
      } else if (path === 'layout.urgency.pricing') {
        body = (
          <div className="space-y-4">
            <div className="font-medium text-sm">Pricing</div>
            {bindText('Original Price', 'template_original_price' as any, '19,999 دج')}
            {bindText('Sale Price', 'template_sale_price' as any, '5,999 دج')}
            {bindText('Save Amount Text', 'template_save_amount' as any, 'وفر 14,000 دج!')}
          </div>
        );
      } else if (path === 'layout.urgency.benefits.item1') {
        body = bindText('Benefit 1', 'template_feature1_title' as any, '✅ Free Express Shipping');
      } else if (path === 'layout.urgency.benefits.item2') {
        body = bindText('Benefit 2', 'template_feature2_title' as any, '✅ 30-Day Money Back Guarantee');
      } else if (path === 'layout.urgency.benefits.item3') {
        body = bindText('Benefit 3', 'template_feature3_title' as any, '✅ Limited Time Bonus Gift');
      } else if (path === 'layout.urgency.benefits.item4') {
        body = bindText('Benefit 4', 'template_feature4_title' as any, '✅ Priority Customer Support');
      } else if (path === 'layout.urgency.benefits') {
        body = (
          <div className="space-y-4">
            <div className="font-medium text-sm">Benefits List</div>
            {bindText('Benefit 1', 'template_feature1_title' as any, '✅ Free Express Shipping')}
            {bindText('Benefit 2', 'template_feature2_title' as any, '✅ 30-Day Money Back Guarantee')}
            {bindText('Benefit 3', 'template_feature3_title' as any, '✅ Limited Time Bonus Gift')}
            {bindText('Benefit 4', 'template_feature4_title' as any, '✅ Priority Customer Support')}
          </div>
        );
      } else if (path === 'layout.urgency.stock.prefix') {
        body = bindText('Stock Prefix', 'template_stock_prefix' as any, '⚠️ Only');
      } else if (path === 'layout.urgency.stock.count') {
        body = bindText('Stock Count', 'template_stock_count' as any, '7');
      } else if (path === 'layout.urgency.stock.text') {
        body = bindText('Stock Text', 'template_stock_text' as any, 'items left at this price!');
      } else if (path === 'layout.urgency.stock') {
        body = (
          <div className="space-y-4">
            <div className="font-medium text-sm">Stock Warning</div>
            {bindText('Prefix', 'template_stock_prefix' as any, '⚠️ Only')}
            {bindText('Stock Count', 'template_stock_count' as any, '7')}
            {bindText('Stock Text', 'template_stock_text' as any, 'items left at this price!')}
          </div>
        );
      } else if (path === 'layout.urgency.saleBadge') {
        body = bindText('Sale Badge Text', 'template_discount_badge_text' as any, '🔥 FLASH SALE');
      } else if (path === 'layout.urgency.topBar.kicker') {
        body = bindText('Urgency Kicker', 'template_hero_kicker' as any, '🔥 بيع سريع جداً');
      } else if (path === 'layout.urgency.topBar.warning') {
        body = bindText('Warning Text', 'template_warning_text' as any, '⚠️ Price increases when timer ends!');
      } else if (path === 'layout.urgency.topBar') {
        body = (
          <div className="space-y-4">
            <div className="font-medium text-sm">Top Urgency Bar</div>
            {bindText('Urgency Kicker', 'template_hero_kicker' as any, '🔥 بيع سريع جداً')}
            {bindText('Warning Text', 'template_warning_text' as any, '⚠️ Price increases when timer ends!')}
          </div>
        );
      } else if (path === 'layout.urgency.timer.endsLabel') {
        body = bindText('Timer Label', 'template_timer_ends_label' as any, 'Ends In');
      } else if (path === 'layout.urgency.socialProof.viewers') {
        body = bindText('Viewers Text', 'template_viewers_text' as any, '47 people watching now');
      } else if (path === 'layout.urgency.socialProof.sold') {
        body = bindText('Sold Today Text', 'template_sold_today' as any, '156 sold in last 24 hours');
      } else if (path === 'layout.urgency.socialProof') {
        body = (
          <div className="space-y-4">
            <div className="font-medium text-sm">Social Proof</div>
            {bindText('Viewers Text', 'template_viewers_text' as any, '47 people watching now')}
            {bindText('Sold Today Text', 'template_sold_today' as any, '156 sold in last 24 hours')}
          </div>
        );
      } else if (path === 'layout.urgency.trustBadges') {
        body = (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">Trust badges shown under checkout (JSON string array).</div>
            {bindTextarea('Trust Badges', 'template_trust_badges' as any, '["🔒 Secure","📦 Fast Ship","✅ Guaranteed"]', 4)}
            <div className="text-xs text-muted-foreground">Example: ["🔒 Secure","📦 Fast Ship","✅ Guaranteed"]</div>
          </div>
        );
      }
    } else if (path.startsWith('layout.testimonial.')) {
      body = (
        <div className="space-y-4">
          {bindTextarea('Testimonial Text', 'template_testimonial_text' as any, '"Amazing product..."', 4)}
          {bindText('Testimonial Author', 'template_testimonial_author' as any, '— Sarah M.')}
        </div>
      );
    } else if (path.startsWith('layout.features.')) {
      body = (
        <div className="space-y-4">
          <div className="font-medium text-sm">Feature Cards</div>
          {bindText('Feature 1 Title', 'template_feature1_title' as any, '✋ Handcrafted')}
          {bindText('Feature 1 Description', 'template_feature1_desc' as any, 'Made by real artisans')}
          {bindText('Feature 2 Title', 'template_feature2_title' as any, '🌿 Sustainable')}
          {bindText('Feature 2 Description', 'template_feature2_desc' as any, 'Eco-friendly materials')}
          {bindText('Feature 3 Title', 'template_feature3_title' as any, '🎁 Gift Ready')}
          {bindText('Feature 3 Description', 'template_feature3_desc' as any, 'Beautiful packaging')}
        </div>
      );
    } else if (path === 'layout.footer') {
      body = (
        <div className="space-y-4">
          {bindText('Copyright Text', 'template_copyright' as any, '© 2026 Your Store')}
          {bindColor('Footer Background', 'template_footer_bg' as any, '#FDF8F3')}
          {bindColor('Footer Text Color', 'template_footer_text' as any, '#A8A29E')}
          {bindColor('Footer Link Color', 'template_footer_link_color' as any, '#78716C')}
          {bindJsonArray('Social Links', 'template_social_links', '[{"platform":"instagram","url":"https://instagram.com/..."}]')}
        </div>
      );
    } else if (path === '__root' || path === '__settings') {
      body = (
        <div className="space-y-4">
          <div className="font-medium text-sm">Global Typography</div>
          {bindSelect('Font Family', 'template_font_family', [
            { value: 'system-ui, -apple-system, sans-serif', label: 'System (Default)' },
            { value: 'Inter, sans-serif', label: 'Inter' },
            { value: 'Poppins, sans-serif', label: 'Poppins' },
            { value: 'Roboto, sans-serif', label: 'Roboto' },
            { value: 'Open Sans, sans-serif', label: 'Open Sans' },
            { value: 'Lato, sans-serif', label: 'Lato' },
            { value: 'Montserrat, sans-serif', label: 'Montserrat' },
            { value: 'Playfair Display, serif', label: 'Playfair Display' },
            { value: 'Merriweather, serif', label: 'Merriweather' },
            { value: 'Georgia, serif', label: 'Georgia' },
          ], 'system-ui, -apple-system, sans-serif')}
          {bindSelect('Body Font Weight', 'template_font_weight', [
            { value: '300', label: 'Light (300)' },
            { value: '400', label: 'Normal (400)' },
            { value: '500', label: 'Medium (500)' },
          ], '400')}
          {bindSelect('Heading Font Weight', 'template_heading_font_weight', [
            { value: '500', label: 'Medium (500)' },
            { value: '600', label: 'Semi-bold (600)' },
            { value: '700', label: 'Bold (700)' },
            { value: '800', label: 'Extra-bold (800)' },
          ], '600')}

          <div className="font-medium text-sm pt-4">Border Radius</div>
          {bindRange('Global Border Radius', 'template_border_radius', 0, 24, 8, 'px')}
          {bindRange('Card Border Radius', 'template_card_border_radius', 0, 32, 12, 'px')}
          {bindRange('Button Border Radius', 'template_button_border_radius', 0, 50, 9999, 'px')}

          <div className="font-medium text-sm pt-4">Spacing</div>
          {bindRange('Base Spacing', 'template_spacing', 8, 32, 16, 'px')}
          {bindRange('Section Spacing', 'template_section_spacing', 24, 96, 48, 'px')}

          <div className="font-medium text-sm pt-4">Animations</div>
          {bindRange('Animation Speed', 'template_animation_speed', 100, 500, 200, 'ms')}
          {bindSelect('Hover Scale', 'template_hover_scale', [
            { value: '1', label: 'None' },
            { value: '1.02', label: 'Subtle (1.02)' },
            { value: '1.05', label: 'Medium (1.05)' },
            { value: '1.1', label: 'Strong (1.1)' },
          ], '1.02')}

          <div className="font-medium text-sm pt-4">Custom CSS</div>
          {bindTextarea('Custom CSS', 'template_custom_css', '/* Add your custom CSS here */\n.my-class {\n  color: red;\n}', 6)}
        </div>
      );
    } else if (path.startsWith('layout.footer') || path.startsWith('layout.header')) {
      body = (
        <div className="space-y-4">
          {bindColor('Background Color', 'template_bg_color' as any, '#FDF8F3')}
          {bindColor('Accent Color', 'template_accent_color', '#F97316')}
          {bindColor('Text Color', 'template_text_color' as any, '#1C1917')}
          {bindColor('Muted Text Color', 'template_muted_color' as any, '#78716C')}
        </div>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('editor.edit')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-xs text-muted-foreground">{t('editor.selected')}: {path}</div>
          {body}
        </CardContent>
      </Card>
    );
  }, [selectedEditPath, settings, navigate, t, activeTemplateId]);

    if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-[#0A0D14]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // ===== MOBILE LAYOUT =====
  if (isMobile) {
    return (
      <div dir="ltr" className="h-dvh flex flex-col overflow-hidden bg-slate-50 dark:bg-[#0A0D14] font-sans text-slate-800 dark:text-slate-200" style={{ isolation: 'isolate' }}>
        {/* Toast Notifications */}
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
          {error && <div className="bg-red-500/90 text-white px-4 py-2 rounded-xl backdrop-blur-md shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-4">{error}</div>}
          {success && <div className="bg-green-500/90 text-white px-4 py-2 rounded-xl backdrop-blur-md shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-4">{success}</div>}
        </div>

        {/* MOBILE TOP BAR */}
        <div className="shrink-0 h-12 bg-white/90 dark:bg-[#04060b]/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-3 z-50">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 rounded-lg h-8 px-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span className="font-bold text-xs tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 uppercase">STORE ENGINE</span>
          <div className="flex items-center gap-1.5">
            {settings.store_slug && (
              <Button variant="ghost" size="sm" onClick={() => window.open(`/store/${settings.store_slug}`, '_blank')} className="hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 rounded-lg h-8 px-2" title="Preview store">
                <ExternalLink className="w-4 h-4" />
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving} size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 h-8 text-xs font-bold shadow-[0_0_15px_-5px_rgba(79,70,229,0.4)]">
              {saving ? <div className="w-3 h-3 rounded-full border-2 border-white/20 border-t-white animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        {/* FULL-SCREEN PREVIEW */}
        <div className="flex-1 relative overflow-hidden bg-white">
          <iframe
            ref={previewIframeRef}
            title="Storefront Preview"
            srcDoc={IFRAME_SRC_DOC}
            onLoad={() => setIframeReady(true)}
            style={{ border: 0, width: '100%', height: '100%', display: 'block', background: '#ffffff' }}
          />
        </div>

        {/* BOTTOM SHEET OVERLAY */}
        {mobilePanelOpen && (
          <>
            <div className="fixed inset-0 bg-black/40 z-[60] animate-in fade-in duration-200" onClick={() => setMobilePanelOpen(false)} />
            <div dir="auto" className="fixed bottom-14 left-0 right-0 z-[70] bg-white dark:bg-[#0B0F19] rounded-t-3xl shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.3)] max-h-[70vh] flex flex-col animate-in slide-in-from-bottom-8 duration-300">
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1 cursor-pointer" onClick={() => setMobilePanelOpen(false)}>
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              </div>
              {/* Panel content */}
              <div className="flex-1 overflow-y-auto px-5 pb-6 custom-scrollbar">

                {/* ===== THEME SETTINGS ===== */}
                {(activeTab === 'theme' as any || activeTab === 'settings') && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('editor.globalStyles')}</h3>

                    {/* Colors */}
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2"><Zap className="w-3 h-3 text-indigo-500"/> {t('editor.coreColors')}</h4>
                      <div className="bg-slate-100 dark:bg-[#131825] p-4 rounded-2xl border border-slate-200 dark:border-white/5 space-y-4">
                        {/* Primary */}
                        <div className="flex items-center gap-3">
                          <input type="color" value={settings.primary_color || '#2563eb'} onChange={(e) => handleSettingChange('primary_color', e.target.value)} className="w-10 h-10 rounded-xl cursor-pointer border-none bg-transparent shrink-0" />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 block">{t('editor.primaryColor')}</span>
                            <div className="flex gap-1.5 mt-1.5">
                              {['#2563eb', '#f97316', '#10b981', '#6366f1', '#ec4899', '#0f172a'].map(c => (
                                <button key={c} onClick={() => handleSettingChange('primary_color', c)} className="w-6 h-6 rounded-lg border border-white/10 active:scale-95 transition-transform" style={{backgroundColor: c}} />
                              ))}
                            </div>
                          </div>
                        </div>
                        {/* Accent */}
                        <div className="flex items-center gap-3">
                          <input type="color" value={settings.template_accent_color || '#f97316'} onChange={(e) => handleSettingChange('template_accent_color', e.target.value)} className="w-10 h-10 rounded-xl cursor-pointer border-none bg-transparent shrink-0" />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 block">لون الزر / Accent</span>
                            <div className="flex gap-1.5 mt-1.5">
                              {['#f97316', '#ef4444', '#22c55e', '#a855f7', '#06b6d4', '#fbbf24'].map(c => (
                                <button key={c} onClick={() => handleSettingChange('template_accent_color', c)} className="w-6 h-6 rounded-lg border border-white/10 active:scale-95 transition-transform" style={{backgroundColor: c}} />
                              ))}
                            </div>
                          </div>
                        </div>
                        {/* Background */}
                        <div className="flex items-center gap-3">
                          <input type="color" value={settings.template_bg_color || '#ffffff'} onChange={(e) => handleSettingChange('template_bg_color', e.target.value)} className="w-10 h-10 rounded-xl cursor-pointer border-none bg-transparent shrink-0" />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 block">لون الخلفية</span>
                            <div className="flex gap-1.5 mt-1.5">
                              {['#ffffff', '#f8fafc', '#f9f8f6', '#0a0a0a', '#080808', '#0f172a'].map(c => (
                                <button key={c} onClick={() => handleSettingChange('template_bg_color', c)} className="w-6 h-6 rounded-lg border border-slate-300 dark:border-white/10 active:scale-95 transition-transform" style={{backgroundColor: c}} />
                              ))}
                            </div>
                          </div>
                        </div>
                        {/* Header */}
                        <div className="flex items-center gap-3">
                          <input type="color" value={settings.iyco_header_color || '#ffffff'} onChange={(e) => handleSettingChange('iyco_header_color', e.target.value)} className="w-10 h-10 rounded-xl cursor-pointer border-none bg-transparent shrink-0" />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 block">لون الهيدر</span>
                            <div className="flex gap-1.5 mt-1.5">
                              {['#ffffff', '#f8fafc', '#1e293b', '#0f172a', '#0a0a0a', '#111827'].map(c => (
                                <button key={c} onClick={() => handleSettingChange('iyco_header_color', c)} className="w-6 h-6 rounded-lg border border-slate-300 dark:border-white/10 active:scale-95 transition-transform" style={{backgroundColor: c}} />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Typography & Copy */}
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2"><Type className="w-3 h-3 text-indigo-500"/> Typography</h4>
                      <div className="bg-slate-100 dark:bg-[#131825] p-4 rounded-2xl border border-slate-200 dark:border-white/5 space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t('editor.mainProduct')}</label>
                          <select value={settings.dzp_main_product_id || ''} onChange={(e) => handleSettingChange('dzp_main_product_id', e.target.value)} className="w-full bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm outline-none">
                            <option value="">{t('editor.latestProduct')}</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t('editor.storeName')}</label>
                          <Input value={settings.store_name || ''} onChange={(e) => handleSettingChange('store_name', e.target.value)} className="bg-white dark:bg-[#0B0F19] border-slate-200 dark:border-white/5 rounded-xl h-10" placeholder="My Awesome Store" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t('editor.heroTitle')}</label>
                          <Input value={settings.template_hero_heading || ''} onChange={(e) => handleSettingChange('template_hero_heading', e.target.value)} className="bg-white dark:bg-[#0B0F19] border-slate-200 dark:border-white/5 rounded-xl h-10" placeholder="توصيل 58 ولاية" dir="rtl" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">نص فرعي / Subtitle</label>
                          <Input value={settings.template_hero_subtitle || ''} onChange={(e) => handleSettingChange('template_hero_subtitle', e.target.value)} className="bg-white dark:bg-[#0B0F19] border-slate-200 dark:border-white/5 rounded-xl h-10" placeholder="🔥 عرض محدود..." dir="rtl" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">نص زر الطلب / CTA Button</label>
                          <Input value={settings.template_button_text || ''} onChange={(e) => handleSettingChange('template_button_text', e.target.value)} className="bg-white dark:bg-[#0B0F19] border-slate-200 dark:border-white/5 rounded-xl h-10" placeholder="أطلب الآن" dir="rtl" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">خط الواجهة / Font</label>
                          <select value={(settings as any).template_font_family || 'cairo'} onChange={(e) => handleSettingChange('template_font_family', e.target.value)} className="w-full bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm outline-none">
                            <option value="cairo">Cairo — كايرو</option>
                            <option value="tajawal">Tajawal — تجوال</option>
                            <option value="almarai">Almarai — المرعي</option>
                            <option value="ibm-plex-arabic">IBM Plex Arabic</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Order Fields */}
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2"><Sparkles className="w-3 h-3 text-indigo-500"/> حقول نموذج الطلب</h4>
                      <div className="bg-slate-100 dark:bg-[#131825] p-4 rounded-2xl border border-slate-200 dark:border-white/5 space-y-3">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">الاسم، الهاتف، والولاية مطلوبين دائمًا.</p>
                        {([['order_field_address', 'العنوان'], ['order_field_commune', 'البلدية'], ['order_field_notes', 'ملاحظات']] as const).map(([field, label]) => (
                          <label key={field} className="flex items-center justify-between cursor-pointer py-1">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
                            <button onClick={() => handleSettingChange(field, !(settings as any)[field])} className={`w-10 h-6 rounded-full transition-colors relative ${(settings as any)[field] ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${(settings as any)[field] ? 'translate-x-5' : 'translate-x-1'}`} />
                            </button>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Delivery Type Options */}
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2"><Sparkles className="w-3 h-3 text-indigo-500"/> خيارات التوصيل</h4>
                      <div className="bg-slate-100 dark:bg-[#131825] p-4 rounded-2xl border border-slate-200 dark:border-white/5 space-y-3">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">عند تفعيل الخيارين، يمكن للعميل اختيار نوع التوصيل.</p>
                        {([['delivery_type_home', 'التوصيل للمنزل'], ['delivery_type_desk', 'الاستلام من المكتب']] as const).map(([field, label]) => (
                          <label key={field} className="flex items-center justify-between cursor-pointer py-1">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
                            <button onClick={() => handleSettingChange(field, (settings as any)[field] === false ? true : false)} className={`w-10 h-6 rounded-full transition-colors relative ${(settings as any)[field] !== false ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${(settings as any)[field] !== false ? 'translate-x-5' : 'translate-x-1'}`} />
                            </button>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Template-specific sections (NeedDZ) */}
                    {activeTemplateId === 'needdz' && (
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2"><Eye className="w-3 h-3 text-indigo-500"/> أقسام NeedDZ</h4>
                      <div className="bg-slate-100 dark:bg-[#131825] p-4 rounded-2xl border border-slate-200 dark:border-white/5 space-y-3">
                        {([
                          ['needdz_show_urgent_bar', 'شريط العجلة (countdown)'],
                          ['needdz_show_social_proof', 'قسم آراء العملاء'],
                          ['needdz_show_card_proof', 'إحصائية بطاقة المنتج'],
                        ] as const).map(([field, label]) => (
                          <label key={field} className="flex items-center justify-between cursor-pointer py-1">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
                            <button onClick={() => handleSettingChange(field, (settings as any)[field] === false ? true : false)} className={`w-10 h-6 rounded-full transition-colors relative ${ (settings as any)[field] !== false ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${ (settings as any)[field] !== false ? 'translate-x-5' : 'translate-x-1'}`} />
                            </button>
                          </label>
                        ))}
                      </div>
                    </div>
                    )}

                    {/* Template-specific sections (NovaDZ) */}
                    {activeTemplateId === 'novadz' && (
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2"><Eye className="w-3 h-3 text-indigo-500"/> أقسام NovaDZ</h4>
                      <div className="bg-slate-100 dark:bg-[#131825] p-4 rounded-2xl border border-slate-200 dark:border-white/5 space-y-3">
                        {([
                          ['nova_show_features', 'مميزات المنتج (بطاقات ✓)'],
                          ['nova_show_trust', 'قسم "لماذا نحن"'],
                        ] as const).map(([field, label]) => (
                          <label key={field} className="flex items-center justify-between cursor-pointer py-1">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
                            <button onClick={() => handleSettingChange(field, (settings as any)[field] === false ? true : false)} className={`w-10 h-6 rounded-full transition-colors relative ${ (settings as any)[field] !== false ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                              <span className={`absolute top-1 left-0 w-4 h-4 rounded-full bg-white shadow transition-transform ${ (settings as any)[field] !== false ? 'translate-x-5' : 'translate-x-1'}`} />
                            </button>
                          </label>
                        ))}
                      </div>
                    </div>
                    )}

                    {/* Template-specific sections (DZPremium) */}
                    {activeTemplateId === 'dzpremium' && (
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2"><Eye className="w-3 h-3 text-indigo-500"/> أقسام DZ بريميوم</h4>
                      <div className="bg-slate-100 dark:bg-[#131825] p-4 rounded-2xl border border-slate-200 dark:border-white/5 space-y-3">
                        <label className="flex items-center justify-between cursor-pointer py-1">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">بطاقات المزايا (توصيل / دفع / ضمان)</span>
                          <button onClick={() => handleSettingChange('dzp_hide_benefits', !(settings as any).dzp_hide_benefits)} className={`w-10 h-6 rounded-full transition-colors relative ${!(settings as any).dzp_hide_benefits ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${!(settings as any).dzp_hide_benefits ? 'translate-x-5' : 'translate-x-1'}`} />
                          </button>
                        </label>
                      </div>
                    </div>
                    )}

                    {/* Template-specific sections (Lumina) */}
                    {activeTemplateId === 'lumina' && (
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2"><Eye className="w-3 h-3 text-indigo-500"/> أقسام Lumina</h4>
                      <div className="bg-slate-100 dark:bg-[#131825] p-4 rounded-2xl border border-slate-200 dark:border-white/5 space-y-3">
                        {([
                          ['lumina_show_countdown', 'عداد تنازلي (countdown)'],
                        ] as const).map(([field, label]) => (
                          <label key={field} className="flex items-center justify-between cursor-pointer py-1">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
                            <button onClick={() => handleSettingChange(field, (settings as any)[field] === false ? true : false)} className={`w-10 h-6 rounded-full transition-colors relative ${ (settings as any)[field] !== false ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${ (settings as any)[field] !== false ? 'translate-x-5' : 'translate-x-1'}`} />
                            </button>
                          </label>
                        ))}
                      </div>
                    </div>
                    )}

                    {/* Chat Bubble */}
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2"><MousePointerClick className="w-3 h-3 text-indigo-500"/> فقاعة التواصل</h4>
                      <div className="bg-slate-100 dark:bg-[#131825] p-4 rounded-2xl border border-slate-200 dark:border-white/5 space-y-3">
                        <label className="flex items-center justify-between cursor-pointer py-1">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">تفعيل فقاعة التواصل</span>
                          <button onClick={() => handleSettingChange('chat_bubble_enabled', !settings.chat_bubble_enabled)} className={`w-10 h-6 rounded-full transition-colors relative ${settings.chat_bubble_enabled ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${settings.chat_bubble_enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                          </button>
                        </label>
                        {settings.chat_bubble_enabled && (
                          <p className="text-[10px] text-indigo-400 bg-indigo-500/10 px-3 py-2 rounded-xl">قم بإعداد قنوات التواصل من صفحة إعدادات البوت</p>
                        )}
                        {settings.chat_bubble_enabled && (
                          <>
                            <label className="flex items-center justify-between cursor-pointer py-1">
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">زر الاتصال المباشر</span>
                              <button onClick={() => handleSettingChange('phone_call_enabled', !settings.phone_call_enabled)} className={`w-10 h-6 rounded-full transition-colors relative ${settings.phone_call_enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${settings.phone_call_enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                              </button>
                            </label>
                            {settings.phone_call_enabled && (
                              <input
                                type="tel"
                                dir="ltr"
                                value={settings.contact_phone || ''}
                                onChange={(e) => handleSettingChange('contact_phone', e.target.value)}
                                placeholder="+213 555 123 456"
                                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0A0D14] text-sm text-slate-800 dark:text-white placeholder:text-slate-400"
                              />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === ('media' as any) && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('editor.storeAssets')}</h3>
                    <div className="bg-slate-100 dark:bg-[#131825] p-4 rounded-2xl border border-slate-200 dark:border-white/5 space-y-4">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">{t('editor.storeLogo')}</label>
                      {settings.store_logo ? (
                        <div className="relative group rounded-xl overflow-hidden bg-slate-200 dark:bg-[#0A0D14] aspect-video flex items-center justify-center border border-slate-300 dark:border-white/5 p-4">
                          <img src={settings.store_logo} alt="Logo" className="max-h-full w-auto object-contain" />
                          <button onClick={() => handleSettingChange('store_logo', '')} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 active:opacity-100 transition-opacity">
                            <span className="text-white text-sm font-medium bg-red-500 px-4 py-2 rounded-xl">{t('editor.removeLogo')}</span>
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed border-slate-300 dark:border-white/10 active:border-indigo-500/50 active:bg-indigo-500/5 transition-all cursor-pointer">
                          <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
                          <span className="text-xs font-medium text-slate-500">{t('editor.uploadLogo')}</span>
                          <Input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) handleImageUpload('store_logo', f); }} />
                        </label>
                      )}
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block pt-2">صورة البانر / Banner</label>
                      {settings.banner_url ? (
                        <div className="relative group rounded-xl overflow-hidden bg-slate-200 dark:bg-[#0A0D14] aspect-video border border-slate-300 dark:border-white/5">
                          <img src={settings.banner_url} alt="Banner" className="w-full h-full object-cover" />
                          <button onClick={() => handleSettingChange('banner_url', '')} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 active:opacity-100 transition-opacity">
                            <span className="text-white text-sm font-medium bg-red-500 px-4 py-2 rounded-xl">إزالة</span>
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed border-slate-300 dark:border-white/10 active:border-indigo-500/50 active:bg-indigo-500/5 transition-all cursor-pointer">
                          <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
                          <span className="text-xs font-medium text-slate-500">رفع صورة البانر</span>
                          <Input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) handleImageUpload('banner_url', f); }} />
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {/* ===== TEMPLATES / LAYOUT ===== */}
                {(activeTab === 'layout' as any || activeTab === 'preview') && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('editor.architecture')}</h3>
                    {isPreviewingDifferentTemplate && (
                      <button
                        onClick={() => handleTemplateChange(previewTemplateId!)}
                        disabled={saving}
                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all shadow-[0_0_20px_-5px_rgba(79,70,229,0.4)] disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {saving ? <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" /> : <Check className="w-4 h-4" />}
                        {t('editor.applyFramework')} — {TEMPLATE_PREVIEWS.find(tp => tp.id === normalizeTemplateId(previewTemplateId!))?.name || previewTemplateId}
                      </button>
                    )}
                    <div className="grid gap-3">
                      {TEMPLATE_PREVIEWS.map((template) => (
                        <button key={template.id} onClick={() => setPreviewTemplateId(template.id)} className={`relative overflow-hidden rounded-2xl border transition-all text-left p-4 ${effectiveTemplateId === template.id ? 'border-indigo-500 bg-gradient-to-br from-indigo-500/10 to-violet-500/5' : previewTemplateId === template.id ? 'border-violet-400 bg-violet-500/5 dark:bg-violet-500/10' : 'border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#131825]'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${effectiveTemplateId === template.id ? 'bg-indigo-500 text-white' : previewTemplateId === template.id ? 'bg-violet-500 text-white' : 'bg-slate-200 dark:bg-[#0B0F19] text-slate-500'}`}>
                              <LayoutTemplate className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <h4 className={`font-bold text-sm truncate ${effectiveTemplateId === template.id ? 'text-indigo-400' : previewTemplateId === template.id ? 'text-violet-400' : 'text-slate-700 dark:text-slate-200'}`}>{template.name}</h4>
                              <p className="text-[10px] text-slate-500 mt-0.5">{effectiveTemplateId === template.id ? t('editor.activeFramework') : previewTemplateId === template.id ? t('editor.previewingTemplate') : t('editor.applyFramework')}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </>
        )}

        {/* BOTTOM TAB BAR */}
        <div className="shrink-0 h-14 bg-white/95 dark:bg-[#04060b]/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/5 flex items-center justify-around z-[80]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <button onClick={() => setMobilePanelOpen(false)} className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all min-w-[56px] ${!mobilePanelOpen ? 'text-indigo-500' : 'text-slate-400 dark:text-slate-500'}`}>
            <Eye className="w-5 h-5" />
            <span className="text-[10px] font-medium">معاينة</span>
          </button>
          <button onClick={() => { setActiveTab('theme' as any); setMobilePanelOpen(true); }} className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all min-w-[56px] ${mobilePanelOpen && (activeTab === 'theme' as any || activeTab === 'settings') ? 'text-indigo-500' : 'text-slate-400 dark:text-slate-500'}`}>
            <Wand2 className="w-5 h-5" />
            <span className="text-[10px] font-medium">{t('editor.theme')}</span>
          </button>
          <button onClick={() => { setActiveTab('media' as any); setMobilePanelOpen(true); }} className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all min-w-[56px] ${mobilePanelOpen && activeTab === ('media' as any) ? 'text-indigo-500' : 'text-slate-400 dark:text-slate-500'}`}>
            <ImageIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{t('editor.assets')}</span>
          </button>
          <button onClick={() => { setActiveTab('layout' as any); setMobilePanelOpen(true); }} className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all min-w-[56px] ${mobilePanelOpen && (activeTab === 'layout' as any || activeTab === 'preview') ? 'text-indigo-500' : 'text-slate-400 dark:text-slate-500'}`}>
            <LayoutTemplate className="w-5 h-5" />
            <span className="text-[10px] font-medium">{t('editor.layout')}</span>
          </button>
        </div>
      </div>
    );
  }

  // ===== DESKTOP LAYOUT =====
  return (
    <div dir="ltr" className="h-dvh flex overflow-hidden bg-slate-50 dark:bg-[#0A0D14] font-sans text-slate-800 dark:text-slate-200" style={{ isolation: 'isolate' }}>
      {/* GLOW EFFECTS */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] mix-blend-screen pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/10 blur-[120px] mix-blend-screen pointer-events-none z-0" />

      
      {/* Toast Notifications */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
        {error && (
          <div className="bg-red-500/90 text-white px-4 py-2 rounded-xl backdrop-blur-md shadow-lg border border-red-400/50 min-w-[200px] text-center text-sm font-medium animate-in fade-in slide-in-from-top-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-500/90 text-white px-4 py-2 rounded-xl backdrop-blur-md shadow-lg border border-green-400/50 min-w-[200px] text-center text-sm font-medium animate-in fade-in slide-in-from-top-4">
            {success}
          </div>
        )}
      </div>

      {/* TOP NAVIGATION / TOOLBAR */}
      <div dir="auto" className="absolute top-0 left-0 right-0 h-16 bg-white/90 dark:bg-[#04060b]/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-6 z-50">
          <div className="flex items-center gap-6">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl h-10">
              <ArrowLeft className="w-4 h-4 mr-2" /> {t('common.back')} ({t('common.returnToDashboard')})
            </Button>
            <div className="h-5 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 uppercase">STORE ENGINE</span>
            </div>
          </div>

          {/* DEVICE PREVIEW TOGGLES */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-inner">
            <button onClick={() => setPreviewDevice('mobile')} className={`p-2 rounded-xl transition-all duration-300 ${previewDevice === 'mobile' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}><Smartphone className="w-4 h-4" /></button>
            <button onClick={() => setPreviewDevice('tablet')} className={`p-2 rounded-xl transition-all duration-300 ${previewDevice === 'tablet' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}><Tablet className="w-4 h-4" /></button>
            <button onClick={() => setPreviewDevice('desktop')} className={`p-2 rounded-xl transition-all duration-300 ${previewDevice === 'desktop' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}><Monitor className="w-4 h-4" /></button>
          </div>

          <div className="flex items-center gap-3">
            {settings.store_slug && (
              <Button variant="ghost" size="sm" onClick={() => window.open(`/store/${settings.store_slug}`, '_blank')} className="hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl h-10 gap-2" title="Preview store in new tab">
                <Eye className="w-4 h-4" /><ExternalLink className="w-3 h-3" />
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-6 h-10 font-bold shadow-[0_0_20px_-5px_rgba(79,70,229,0.4)] transition-all">
               {saving ? <span className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin"/> {t('editor.saving')}</span> : <span className="flex items-center gap-2"><Save className="w-4 h-4"/> {t('editor.publishChanges')}</span>}
            </Button>
          </div>
      </div>

      {/* LEFT SIDEBAR - TOOL PICKER */}
      <div className="w-20 h-full pt-16 bg-white/80 dark:bg-[#04060b]/80 backdrop-blur-lg border-r border-slate-200 dark:border-white/5 flex flex-col items-center py-6 gap-6 z-40 relative">
         <div className="flex flex-col gap-3 mt-4 w-full px-3">
            <button onClick={() => setActiveTab('theme' as any)} className={`w-full aspect-square flex flex-col items-center justify-center gap-1 rounded-2xl transition-all duration-300 ${activeTab === ('theme' as any) || activeTab === 'settings' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white border border-transparent'}`} title="Theme Settings">
              <Wand2 className="w-5 h-5" />
              <span className="text-[10px] font-medium">{t('editor.theme')}</span>
            </button>
            <button onClick={() => setActiveTab('media' as any)} className={`w-full aspect-square flex flex-col items-center justify-center gap-1 rounded-2xl transition-all duration-300 ${activeTab === ('media' as any) ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white border border-transparent'}`} title="Media & Branding">
              <ImageIcon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{t('editor.assets')}</span>
            </button>
            <button onClick={() => setActiveTab('layout' as any)} className={`w-full aspect-square flex flex-col items-center justify-center gap-1 rounded-2xl transition-all duration-300 ${activeTab === ('layout' as any) || activeTab === 'preview' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white border border-transparent'}`} title="Layout & Structure">
              <LayoutTemplate className="w-5 h-5" />
              <span className="text-[10px] font-medium">{t('editor.layout')}</span>
            </button>
         </div>
      </div>

      {/* SECONDARY SIDEBAR - SETTINGS PANEL */}
      <div dir="auto" className="w-80 h-full pt-16 bg-white dark:bg-[#0B0F19] border-r border-slate-200 dark:border-white/5 flex flex-col z-30 overflow-y-auto relative custom-scrollbar shadow-2xl">
         <div className="p-6">
            {(activeTab === 'theme' as any || activeTab === 'settings') && (
              <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
                 <div>
                   <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{t('editor.globalStyles')}</h3>
                   <p className="text-xs text-slate-500 dark:text-slate-400">{t('editor.globalStylesDesc')}</p>
                 </div>
                 
                 {/* Brand Colors */}
                 <div className="space-y-4">
                    <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2"><Zap className="w-3 h-3 text-indigo-500"/> {t('editor.coreColors')}</h4>
                    <div className="bg-slate-100 dark:bg-[#131825] p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-5">
                       <div className="flex flex-col gap-3">
                         <div className="flex items-center justify-between">
                           <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('editor.primaryColor')}</span>
                           <span className="text-xs font-mono text-slate-500">{settings.primary_color || '#2563eb'}</span>
                         </div>
                         <div className="flex gap-2">
                            <input type="color" value={settings.primary_color || '#2563eb'} onChange={(e) => handleSettingChange('primary_color', e.target.value)} className="w-10 h-10 rounded-xl cursor-pointer border-none bg-transparent" />
                            <div className="flex-1 flex gap-1">
                               {/* Quick swatches */}
                               {['#2563eb', '#f97316', '#10b981', '#6366f1', '#ec4899', '#0f172a'].map(color => (
                                  <button key={color} onClick={() => handleSettingChange('primary_color', color)} className="flex-1 rounded-lg border border-white/10 hover:scale-110 transition-transform" style={{backgroundColor: color}} />
                               ))}
                            </div>
                         </div>
                       </div>
                       {/* Accent / CTA button color */}
                       <div className="flex flex-col gap-3">
                         <div className="flex items-center justify-between">
                           <span className="text-sm font-medium text-slate-700 dark:text-slate-300">لون الزر / Accent</span>
                           <span className="text-xs font-mono text-slate-500">{settings.template_accent_color || '#f97316'}</span>
                         </div>
                         <div className="flex gap-2">
                            <input type="color" value={settings.template_accent_color || '#f97316'} onChange={(e) => handleSettingChange('template_accent_color', e.target.value)} className="w-10 h-10 rounded-xl cursor-pointer border-none bg-transparent" />
                            <div className="flex-1 flex gap-1">
                               {['#f97316', '#ef4444', '#22c55e', '#a855f7', '#06b6d4', '#fbbf24'].map(color => (
                                  <button key={color} onClick={() => handleSettingChange('template_accent_color', color)} className="flex-1 rounded-lg border border-white/10 hover:scale-110 transition-transform" style={{backgroundColor: color}} />
                               ))}
                            </div>
                         </div>
                       </div>
                       {/* Background color */}
                       <div className="flex flex-col gap-3">
                         <div className="flex items-center justify-between">
                           <span className="text-sm font-medium text-slate-700 dark:text-slate-300">لون الخلفية / Background</span>
                           <span className="text-xs font-mono text-slate-500">{settings.template_bg_color || '#ffffff'}</span>
                         </div>
                         <div className="flex gap-2">
                            <input type="color" value={settings.template_bg_color || '#ffffff'} onChange={(e) => handleSettingChange('template_bg_color', e.target.value)} className="w-10 h-10 rounded-xl cursor-pointer border-none bg-transparent" />
                            <div className="flex-1 flex gap-1">
                               {['#ffffff', '#f8fafc', '#f9f8f6', '#0a0a0a', '#080808', '#0f172a'].map(color => (
                                  <button key={color} onClick={() => handleSettingChange('template_bg_color', color)} className="flex-1 rounded-lg border border-slate-300 dark:border-white/10 hover:scale-110 transition-transform" style={{backgroundColor: color}} />
                               ))}
                            </div>
                         </div>
                       </div>

                       {/* Header / Surface color (for templates that support it) */}
                       <div className="flex flex-col gap-3">
                         <div className="flex items-center justify-between">
                           <span className="text-sm font-medium text-slate-700 dark:text-slate-300">لون الهيدر / Header</span>
                           <span className="text-xs font-mono text-slate-500">{settings.iyco_header_color || '#ffffff'}</span>
                         </div>
                         <div className="flex gap-2">
                            <input type="color" value={settings.iyco_header_color || '#ffffff'} onChange={(e) => handleSettingChange('iyco_header_color', e.target.value)} className="w-10 h-10 rounded-xl cursor-pointer border-none bg-transparent" />
                            <div className="flex-1 flex gap-1">
                               {['#ffffff', '#f8fafc', '#1e293b', '#0f172a', '#0a0a0a', '#111827'].map(color => (
                                  <button key={color} onClick={() => handleSettingChange('iyco_header_color', color)} className="flex-1 rounded-lg border border-slate-300 dark:border-white/10 hover:scale-110 transition-transform" style={{backgroundColor: color}} />
                               ))}
                            </div>
                         </div>
                       </div>
                    </div>
                 </div>

                 {/* Typography */}
                 <div className="space-y-4">
                    <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2"><Type className="w-3 h-3 text-indigo-500"/> Typography & Copy</h4>
                    <div className="bg-slate-100 dark:bg-[#131825] p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-4">

                        <div className="space-y-2">
                           <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t('editor.mainProduct')}</label>
                           <select 
                               value={settings.dzp_main_product_id || ''} 
                               onChange={(e) => handleSettingChange('dzp_main_product_id', e.target.value)}
                               className="w-full bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                           >
                               <option value="">{t('editor.latestProduct')}</option>
                               {products.map(p => (
                                   <option key={p.id} value={p.id}>{p.title}</option>
                               ))}
                           </select>
                        </div>

                        <div className="space-y-2">
                           <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t('editor.storeName')}</label>
                           <Input value={settings.store_name || ''} onChange={(e) => handleSettingChange('store_name', e.target.value)} className="bg-white dark:bg-[#0B0F19] border-slate-200 dark:border-white/5 text-slate-900 dark:text-white rounded-xl focus-visible:ring-indigo-500" placeholder="My Awesome Store" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t('editor.heroTitle')}</label>
                           <Input value={settings.template_hero_heading || ''} onChange={(e) => handleSettingChange('template_hero_heading', e.target.value)} className="bg-white dark:bg-[#0B0F19] border-slate-200 dark:border-white/5 text-slate-900 dark:text-white rounded-xl focus-visible:ring-indigo-500" placeholder="توصيل 58 ولاية" dir="rtl" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">نص فرعي / Subtitle</label>
                           <Input value={settings.template_hero_subtitle || ''} onChange={(e) => handleSettingChange('template_hero_subtitle', e.target.value)} className="bg-white dark:bg-[#0B0F19] border-slate-200 dark:border-white/5 text-slate-900 dark:text-white rounded-xl focus-visible:ring-indigo-500" placeholder="🔥 عرض محدود..." dir="rtl" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">نص زر الطلب / CTA Button</label>
                           <Input value={settings.template_button_text || ''} onChange={(e) => handleSettingChange('template_button_text', e.target.value)} className="bg-white dark:bg-[#0B0F19] border-slate-200 dark:border-white/5 text-slate-900 dark:text-white rounded-xl focus-visible:ring-indigo-500" placeholder="أطلب الآن" dir="rtl" />
                        </div>
                        {/* Font family */}
                        <div className="space-y-2">
                           <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">خط الواجهة / Font</label>
                           <select
                              value={(settings as any).template_font_family || 'cairo'}
                              onChange={(e) => handleSettingChange('template_font_family', e.target.value)}
                              className="w-full bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                           >
                              <option value="cairo">Cairo — كايرو</option>
                              <option value="tajawal">Tajawal — تجوال</option>
                              <option value="almarai">Almarai — المرعي</option>
                              <option value="ibm-plex-arabic">IBM Plex Arabic</option>
                           </select>
                        </div>
                    </div>
                 </div>

                 {/* Order Form Fields */}
                 <div className="space-y-4">
                    <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2"><Sparkles className="w-3 h-3 text-indigo-500"/> حقول نموذج الطلب</h4>
                    <div className="bg-slate-100 dark:bg-[#131825] p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-4">
                       <p className="text-[11px] text-slate-500 dark:text-slate-400">الاسم، الهاتف، والولاية مطلوبين دائمًا. فعّل الحقول الإضافية حسب الحاجة.</p>
                       <div className="space-y-3">
                          <label className="flex items-center justify-between cursor-pointer group">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">العنوان</span>
                            <button
                              onClick={() => handleSettingChange('order_field_address', !settings.order_field_address)}
                              className={`w-10 h-6 rounded-full transition-colors relative ${settings.order_field_address ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                            >
                              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${settings.order_field_address ? 'translate-x-5' : 'translate-x-1'}`} />
                            </button>
                          </label>
                          <label className="flex items-center justify-between cursor-pointer group">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">البلدية</span>
                            <button
                              onClick={() => handleSettingChange('order_field_commune', !settings.order_field_commune)}
                              className={`w-10 h-6 rounded-full transition-colors relative ${settings.order_field_commune ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                            >
                              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${settings.order_field_commune ? 'translate-x-5' : 'translate-x-1'}`} />
                            </button>
                          </label>
                          <label className="flex items-center justify-between cursor-pointer group">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">ملاحظات</span>
                            <button
                              onClick={() => handleSettingChange('order_field_notes', !settings.order_field_notes)}
                              className={`w-10 h-6 rounded-full transition-colors relative ${settings.order_field_notes ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                            >
                              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${settings.order_field_notes ? 'translate-x-5' : 'translate-x-1'}`} />
                            </button>
                          </label>
                       </div>
                    </div>
                 </div>

                 {/* Template-specific sections (NovaDZ) */}
                 {activeTemplateId === 'novadz' && (
                 <div className="space-y-4">
                    <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2"><Eye className="w-4 h-4 text-indigo-500"/> أقسام NovaDZ</h4>
                    <div className="bg-slate-100 dark:bg-[#131825] p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-4">
                      {([
                        ['nova_show_features', 'مميزات المنتج (بطاقات ✓)'],
                        ['nova_show_trust', 'قسم "لماذا نحن"'],
                      ] as const).map(([field, label]) => (
                        <label key={field} className="flex items-center justify-between cursor-pointer py-1">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
                          <button onClick={() => handleSettingChange(field, (settings as any)[field] === false ? true : false)} className={`w-10 h-6 rounded-full transition-colors relative ${ (settings as any)[field] !== false ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                            <span className={`absolute top-1 left-0 w-4 h-4 rounded-full bg-white shadow transition-transform ${ (settings as any)[field] !== false ? 'translate-x-5' : 'translate-x-1'}`} />
                          </button>
                        </label>
                      ))}
                    </div>
                 </div>
                 )}

                 {/* Template-specific sections (NeedDZ) */}
                 {activeTemplateId === 'needdz' && (
                 <div className="space-y-4">
                    <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2"><Eye className="w-4 h-4 text-indigo-500"/> أقسام NeedDZ</h4>
                    <div className="bg-slate-100 dark:bg-[#131825] p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-4">
                       <div className="space-y-3">
                         {([
                           ['needdz_show_urgent_bar', 'شريط العجلة (countdown)'],
                           ['needdz_show_social_proof', 'قسم آراء العملاء'],
                           ['needdz_show_card_proof', 'إحصائية بطاقة المنتج'],
                         ] as const).map(([field, label]) => (
                           <label key={field} className="flex items-center justify-between cursor-pointer group">
                             <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
                             <button
                               onClick={() => handleSettingChange(field, (settings as any)[field] === false ? true : false)}
                               className={`w-10 h-6 rounded-full transition-colors relative ${ (settings as any)[field] !== false ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                             >
                               <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${ (settings as any)[field] !== false ? 'translate-x-5' : 'translate-x-1'}`} />
                             </button>
                           </label>
                         ))}
                       </div>
                    </div>
                 </div>
                 )}

                 {/* Template-specific sections (Lumina) */}
                 {activeTemplateId === 'lumina' && (
                 <div className="space-y-4">
                    <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2"><Eye className="w-4 h-4 text-indigo-500"/> أقسام Lumina</h4>
                    <div className="bg-slate-100 dark:bg-[#131825] p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-4">
                       <div className="space-y-3">
                         {([
                           ['lumina_show_countdown', 'عداد تنازلي (countdown)'],
                         ] as const).map(([field, label]) => (
                           <label key={field} className="flex items-center justify-between cursor-pointer group">
                             <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
                             <button
                               onClick={() => handleSettingChange(field, (settings as any)[field] === false ? true : false)}
                               className={`w-10 h-6 rounded-full transition-colors relative ${ (settings as any)[field] !== false ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                             >
                               <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${ (settings as any)[field] !== false ? 'translate-x-5' : 'translate-x-1'}`} />
                             </button>
                           </label>
                         ))}
                       </div>
                    </div>
                 </div>
                 )}

                 {/* Chat Bubble */}
                 <div className="space-y-4">
                    <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2"><MousePointerClick className="w-3 h-3 text-indigo-500"/> فقاعة التواصل</h4>
                    <div className="bg-slate-100 dark:bg-[#131825] p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-3">
                       <p className="text-[11px] text-slate-500 dark:text-slate-400">تظهر زر عائم على الواجهة يسمح للزبائن بالتواصل معك عبر المنصات المتصلة (واتساب، تليغرام...)</p>
                       <label className="flex items-center justify-between cursor-pointer group">
                         <span className="text-sm font-medium text-slate-700 dark:text-slate-300">تفعيل فقاعة التواصل</span>
                         <button
                           onClick={() => handleSettingChange('chat_bubble_enabled', !settings.chat_bubble_enabled)}
                           className={`w-10 h-6 rounded-full transition-colors relative ${settings.chat_bubble_enabled ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                         >
                           <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${settings.chat_bubble_enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                         </button>
                       </label>
                       {settings.chat_bubble_enabled && (
                         <p className="text-[10px] text-indigo-400 bg-indigo-500/10 px-3 py-2 rounded-xl">قم بإعداد قنوات التواصل من صفحة إعدادات البوت</p>
                       )}
                       {settings.chat_bubble_enabled && (
                         <>
                           <label className="flex items-center justify-between cursor-pointer group">
                             <span className="text-sm font-medium text-slate-700 dark:text-slate-300">زر الاتصال المباشر</span>
                             <button
                               onClick={() => handleSettingChange('phone_call_enabled', !settings.phone_call_enabled)}
                               className={`w-10 h-6 rounded-full transition-colors relative ${settings.phone_call_enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                             >
                               <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${settings.phone_call_enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                             </button>
                           </label>
                           {settings.phone_call_enabled && (
                             <input
                               type="tel"
                               dir="ltr"
                               value={settings.contact_phone || ''}
                               onChange={(e) => handleSettingChange('contact_phone', e.target.value)}
                               placeholder="+213 555 123 456"
                               className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0A0D14] text-sm text-slate-800 dark:text-white placeholder:text-slate-400"
                             />
                           )}
                         </>
                       )}
                    </div>
                 </div>
              </div>
            )}
            
            {activeTab === ('media' as any) && (
              <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
                 <div>
                   <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{t('editor.storeAssets')}</h3>
                   <p className="text-xs text-slate-500 dark:text-slate-400">{t('editor.storeAssetsDesc')}</p>
                 </div>
                 <div className="bg-slate-100 dark:bg-[#131825] p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-5">
                    <div>
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-3">{t('editor.storeLogo')}</label>
                      {settings.store_logo ? (
                        <div className="relative group rounded-xl overflow-hidden bg-slate-200 dark:bg-[#0A0D14] aspect-video flex items-center justify-center border border-slate-300 dark:border-white/5 p-4">
                           <img src={settings.store_logo} alt="Logo" className="max-h-full w-auto object-contain" />
                           <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                              <Button variant="destructive" size="sm" onClick={() => handleSettingChange('store_logo', '')} className="rounded-xl">{t('editor.removeLogo')}</Button>
                           </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed border-slate-300 dark:border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all cursor-pointer group">
                           <UploadCloud className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-2 group-hover:scale-110 transition-transform group-hover:text-indigo-400" />
                           <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('editor.uploadLogo')}</span>
                           <Input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) handleImageUpload('store_logo', f); }} />
                        </label>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-3">صورة البانر / Banner</label>
                      {settings.banner_url ? (
                        <div className="relative group rounded-xl overflow-hidden bg-slate-200 dark:bg-[#0A0D14] aspect-video border border-slate-300 dark:border-white/5">
                           <img src={settings.banner_url} alt="Banner" className="w-full h-full object-cover" />
                           <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                              <Button variant="destructive" size="sm" onClick={() => handleSettingChange('banner_url', '')} className="rounded-xl">إزالة</Button>
                           </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed border-slate-300 dark:border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all cursor-pointer group">
                           <UploadCloud className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-2 group-hover:scale-110 transition-transform group-hover:text-indigo-400" />
                           <span className="text-xs font-medium text-slate-500 dark:text-slate-400">رفع صورة البانر</span>
                           <Input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) handleImageUpload('banner_url', f); }} />
                        </label>
                      )}
                    </div>
                 </div>
              </div>
            )}

            {(activeTab === 'layout' as any || activeTab === 'preview') && (
              <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                 <div>
                   <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{t('editor.architecture')}</h3>
                   <p className="text-xs text-slate-500 dark:text-slate-400">{t('editor.architectureDesc')}</p>
                 </div>
                 {isPreviewingDifferentTemplate && (
                   <button
                     onClick={() => handleTemplateChange(previewTemplateId!)}
                     disabled={saving}
                     className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all shadow-[0_0_20px_-5px_rgba(79,70,229,0.4)] disabled:opacity-60 flex items-center justify-center gap-2"
                   >
                     {saving ? <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" /> : <Check className="w-4 h-4" />}
                     {t('editor.applyFramework')} — {TEMPLATE_PREVIEWS.find(tp => tp.id === normalizeTemplateId(previewTemplateId!))?.name || previewTemplateId}
                   </button>
                 )}
                 <div className="grid gap-4">
                   {TEMPLATE_PREVIEWS.map((template) => (
                      <button key={template.id} onClick={() => setPreviewTemplateId(template.id)} className={`relative overflow-hidden group rounded-2xl border transition-all text-left p-5 ${effectiveTemplateId === template.id ? 'border-indigo-500 bg-gradient-to-br from-indigo-500/10 to-violet-500/5 shadow-[0_0_15px_-3px_rgba(99,102,241,0.2)]' : previewTemplateId === template.id ? 'border-violet-400 bg-violet-500/5 dark:bg-violet-500/10 shadow-[0_0_10px_-3px_rgba(139,92,246,0.2)]' : 'border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#131825] hover:border-slate-300 dark:hover:border-white/20'}`}>
                        <div className="flex items-center gap-4 relative z-10">
                           <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner ${effectiveTemplateId === template.id ? 'bg-indigo-500 text-white' : previewTemplateId === template.id ? 'bg-violet-500 text-white' : 'bg-slate-200 dark:bg-[#0B0F19] text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white group-hover:bg-slate-300 dark:group-hover:bg-white/5'}`}>
                             <LayoutTemplate className="w-6 h-6" />
                           </div>
                           <div>
                             <h4 className={`font-bold text-sm ${effectiveTemplateId === template.id ? 'text-indigo-400' : previewTemplateId === template.id ? 'text-violet-400' : 'text-slate-700 dark:text-slate-200'}`}>{template.name}</h4>
                             <p className="text-xs text-slate-500 mt-1">{effectiveTemplateId === template.id ? t('editor.activeFramework') : previewTemplateId === template.id ? t('editor.previewingTemplate') : t('editor.applyFramework')}</p>
                           </div>
                        </div>
                      </button>
                   ))}
                 </div>
              </div>
            )}
         </div>
      </div>

      {/* MAIN PREVIEW CANVAS */}
      <div className="flex-1 h-full pt-16 bg-slate-100 dark:bg-[#04060b] relative overflow-hidden flex flex-col items-center">
          {/* Subtle grid background to look like a workspace */}
          <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03] dark:opacity-[0.02]" style={{ backgroundImage: 'linear-gradient(to right, #64748b 1px, transparent 1px), linear-gradient(to bottom, #64748b 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

          <div
            ref={canvasContainerRef}
            className="flex-1 w-full z-10 flex items-center justify-center overflow-hidden"
          >
            {previewDevice !== 'desktop' ? (
              /* Compensating wrapper: layout footprint = visual (scaled) size */
              <div style={{
                width: (previewDevice === 'mobile' ? 375 : 768) * deviceScale,
                height: (previewDevice === 'mobile' ? 812 : 1024) * deviceScale,
                flexShrink: 0,
                position: 'relative',
              }}>
                <div
                  ref={previewFitRef}
                  className="transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
                  style={{
                    width: previewDevice === 'mobile' ? '375px' : '768px',
                    height: previewDevice === 'mobile' ? '812px' : '1024px',
                    position: 'absolute',
                    top: 0, left: 0,
                    transform: `scale(${deviceScale})`,
                    transformOrigin: 'top left',
                    border: '14px solid #1a1a2e',
                    borderRadius: '50px',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), inset 0 0 0 2px #333, inset 0 0 0 6px #000',
                    backgroundColor: '#ffffff',
                    overflow: 'hidden',
                  }}
                >
                  {/* Status bar */}
                  <div className="absolute top-0 inset-x-0 h-9 flex items-center justify-between px-5 z-[60] pointer-events-none bg-[#1a1a2e]/90 backdrop-blur-sm">
                    <span className="text-white text-[11px] font-semibold tracking-tight">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="w-[80px] h-5 bg-[#1a1a2e] rounded-full absolute left-1/2 -translate-x-1/2 top-0 flex items-center justify-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#333] border border-white/10" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg width="12" height="10" viewBox="0 0 12 10" fill="none" className="text-white"><rect x="0" y="7" width="2" height="3" rx="0.5" fill="currentColor"/><rect x="3" y="5" width="2" height="5" rx="0.5" fill="currentColor"/><rect x="6" y="3" width="2" height="7" rx="0.5" fill="currentColor"/><rect x="9" y="0" width="2" height="10" rx="0.5" fill="currentColor"/></svg>
                      <svg width="13" height="10" viewBox="0 0 13 10" fill="none" className="text-white"><path d="M6.5 8.5a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/><path d="M3.8 6.2a3.8 3.8 0 015.4 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/><path d="M1.5 3.9a6.5 6.5 0 019.8 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.5"/></svg>
                      <div className="flex items-center gap-0.5">
                        <div className="w-5 h-2.5 rounded-[3px] border border-white/70 relative p-px">
                          <div className="h-full w-[75%] bg-white rounded-[2px]" />
                        </div>
                        <div className="w-0.5 h-1.5 bg-white/50 rounded-r-sm" />
                      </div>
                    </div>
                  </div>
                  <div className="w-full h-full bg-white relative z-50" style={{ paddingTop: '36px' }}>
                    <iframe
                      ref={previewIframeRef}
                      title="Storefront Preview"
                      srcDoc={IFRAME_SRC_DOC}
                      onLoad={() => setIframeReady(true)}
                      style={{ border: 0, width: '100%', height: '100%', display: 'block', background: '#ffffff', pointerEvents: 'auto' }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Desktop — fill entire available space */
              <div
                ref={previewFitRef}
                className="w-full h-full"
                style={{ overflow: 'hidden', backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)' }}
              >
                <iframe
                  ref={previewIframeRef}
                  title="Storefront Preview"
                  srcDoc={IFRAME_SRC_DOC}
                  onLoad={() => setIframeReady(true)}
                  style={{ border: 0, width: '100%', height: '100%', display: 'block', background: '#ffffff', pointerEvents: 'auto' }}
                />
              </div>
            )}
          </div>
      </div>
    </div>
  );
}
