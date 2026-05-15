import { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Filter, PackageX, Package, AlertTriangle, 
  TrendingDown, TrendingUp, Edit, Trash2, History, Download,
  BarChart3, RefreshCw, Tag, X, Check, Sparkles, Loader2, Layers,
  Palette, Ruler, Shirt, Footprints, ShoppingBag, Gift, TicketPercent,
  Truck, ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { markOnboardingStepComplete } from '@/lib/onboarding';
import { formatPriceForInput } from '@/lib/formatPrice';
import { useAI } from '@/hooks/useAI';

interface StockItem {
  id: number;
  name: string;
  description?: string;
  category?: string;
  shipping_mode?: 'delivery_pricing' | 'flat' | 'free';
  shipping_flat_fee?: number | null;
  quantity: number;
  unit_price?: number;
  reorder_level: number;
  status: 'active' | 'discontinued' | 'out_of_stock';
  notes?: string;
  is_low_stock?: boolean;
  images?: string[];
  video_url?: string;
  created_at: string;
  updated_at: string;
}

interface StockHistory {
  id: number;
  quantity_before: number;
  quantity_after: number;
  adjustment: number;
  reason: string;
  notes?: string;
  created_at: string;
  adjusted_by_name?: string;
}

interface StockCategory {
  id: number;
  name: string;
  color: string;
  icon: string;
  product_count: number;
  created_at: string;
  sample_image?: string | null;
}

type StockVariantDraft = {
  id?: number;
  color?: string;
  size?: string;
  variant_name?: string;
  price?: number;
  stock_quantity: number;
  is_active?: boolean;
  sort_order?: number;
};

// ─── AI Helper Components ───────

function AIGenerateDescription({
  title,
  category,
  onGenerate,
}: {
  title: string;
  category: string;
  onGenerate: (desc: string) => void;
}) {
  const { call, loading } = useAI('/api/ai/product/description');
  const handleClick = async () => {
    if (!title.trim()) return;
    const data = await call({ title, category });
    if (data?.description) onGenerate(data.description);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || !title.trim()}
      className="flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 disabled:opacity-40 transition-colors"
      title="Generate description with AI"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
      AI Generate
    </button>
  );
}

function AISuggestTitles({
  currentTitle,
  category,
  onSelect,
}: {
  currentTitle: string;
  category: string;
  onSelect: (title: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const { call, loading } = useAI('/api/ai/product/title');

  const handleClick = async () => {
    if (!currentTitle.trim()) return;
    const data = await call({ currentTitle, category });
    if (data?.suggestions?.length) {
      setSuggestions(data.suggestions);
      setOpen(true);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || !currentTitle.trim()}
        className="flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 disabled:opacity-40 transition-colors"
        title="Suggest better titles with AI"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
        AI Suggest
      </button>
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-[200] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-2 w-[260px]">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-2 pb-1">Pick a title</p>
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { onSelect(s); setOpen(false); }}
              className="w-full text-left px-2 py-1.5 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AIVisionSuggest({
  imageUrl,
  locale,
  onApply,
}: {
  imageUrl: string;
  locale: string;
  onApply: (data: {
    title?: string;
    description?: string;
    price?: number;
    category?: string;
  }) => void;
}) {
  const { call, loading } = useAI('/api/ai/product/vision');
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleAnalyze = async () => {
    const data = await call({ imageUrl, locale });
    if (data) {
      setResult(data);
      setOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={loading || !imageUrl}
        className="flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 disabled:opacity-40 transition-colors"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
        AI Vision Suggest
      </button>

      {open && result && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>AI Vision Suggestions</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {result.title && (
                <div>
                  <Label className="text-xs">Suggested Title</Label>
                  <div className="flex gap-2">
                    <Input value={result.title} readOnly className="flex-1" />
                    <Button size="sm" onClick={() => onApply({ title: result.title })}>Use</Button>
                  </div>
                </div>
              )}
              {result.category && (
                <div>
                  <Label className="text-xs">Suggested Category</Label>
                  <div className="flex gap-2">
                    <Input value={result.category} readOnly className="flex-1" />
                    <Button size="sm" onClick={() => onApply({ category: result.category })}>Use</Button>
                  </div>
                </div>
              )}
              {result.price && (
                <div>
                  <Label className="text-xs">Suggested Price</Label>
                  <div className="flex gap-2">
                    <Input value={result.price} readOnly className="flex-1" />
                    <Button size="sm" onClick={() => onApply({ price: result.price })}>Use</Button>
                  </div>
                </div>
              )}
              {result.description && (
                <div>
                  <Label className="text-xs">Suggested Description</Label>
                  <Textarea value={result.description} readOnly className="flex-1" rows={3} />
                  <Button size="sm" onClick={() => onApply({ description: result.description })} className="mt-2">Use Description</Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ──────────────────────────────────

export default function StockManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [filteredStock, setFilteredStock] = useState<StockItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<StockCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showLowStock, setShowLowStock] = useState(false);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  
  // Selected item
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [stockHistory, setStockHistory] = useState<StockHistory[]>([]);
  
  // Form state
  const [formData, setFormData] = useState<Partial<StockItem>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [activeFormSection, setActiveFormSection] = useState<'product' | 'price' | 'variants' | 'offers' | 'status' | 'shipping' | 'images' | 'video' | 'notes'>('product');
  const [adjustData, setAdjustData] = useState({
    adjustment: undefined as number | undefined,
    reason: 'adjustment',
    notes: '',
  });

  const [variantsDraft, setVariantsDraft] = useState<StockVariantDraft[]>([]);
  const [variantsLoaded, setVariantsLoaded] = useState(false);
  const [variantsDirty, setVariantsDirty] = useState(false);
  const [loadingVariants, setLoadingVariants] = useState(false);

  type StockOfferDraft = {
    id?: number;
    quantity: number;
    bundle_price: number;
    compare_price?: number;
    free_delivery?: boolean;
    label?: string;
    image_url?: string;
    sort_order?: number;
    is_active?: boolean;
  };
  const [offersDraft, setOffersDraft] = useState<StockOfferDraft[]>([]);
  const [offersLoaded, setOffersLoaded] = useState(false);
  const [offersDirty, setOffersDirty] = useState(false);
  const [loadingOffers, setLoadingOffers] = useState(false);

  const buildCreatePayload = () => {
    const images = Array.isArray(formData.images) ? formData.images : [];

    return {
      name: (formData.name || '').toString(),
      sku: (formData as any).sku ? String((formData as any).sku) : undefined,
      description: formData.description ? String(formData.description) : undefined,
      category: formData.category ? String(formData.category) : undefined,
      quantity: formData.quantity ?? 0,
      unit_price: formData.unit_price == null ? undefined : Number(formData.unit_price),
      reorder_level: formData.reorder_level == null ? 10 : Number(formData.reorder_level),
      location: (formData as any).location ? String((formData as any).location) : undefined,
      supplier_name: (formData as any).supplier_name ? String((formData as any).supplier_name) : undefined,
      supplier_contact: (formData as any).supplier_contact ? String((formData as any).supplier_contact) : undefined,
      status: formData.status,
      shipping_mode: formData.shipping_mode,
      shipping_flat_fee: formData.shipping_flat_fee == null ? undefined : Number(formData.shipping_flat_fee),
      notes: formData.notes ? String(formData.notes) : undefined,
      video_url: (formData as any).video_url ? String((formData as any).video_url) : undefined,
      images,
    };
  };

  const buildUpdatePayload = () => {
    const images = Array.isArray(formData.images) ? formData.images : [];

    return {
      name: formData.name ? String(formData.name) : undefined,
      sku: (formData as any).sku ? String((formData as any).sku) : undefined,
      description: formData.description ? String(formData.description) : undefined,
      category: formData.category ? String(formData.category) : undefined,
      unit_price: formData.unit_price == null ? undefined : Number(formData.unit_price),
      reorder_level: formData.reorder_level == null ? 10 : Number(formData.reorder_level),
      location: (formData as any).location ? String((formData as any).location) : undefined,
      supplier_name: (formData as any).supplier_name ? String((formData as any).supplier_name) : undefined,
      supplier_contact: (formData as any).supplier_contact ? String((formData as any).supplier_contact) : undefined,
      status: formData.status,
      shipping_mode: formData.shipping_mode,
      shipping_flat_fee: formData.shipping_flat_fee == null ? undefined : Number(formData.shipping_flat_fee),
      notes: formData.notes ? String(formData.notes) : undefined,
      video_url: (formData as any).video_url ? String((formData as any).video_url) : undefined,
      images,
    };
  };

  // Category form state
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3b82f6');
  const [newCategoryIcon, setNewCategoryIcon] = useState('📦');
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);

  const [lowStockCount, setLowStockCount] = useState(0);
  const [totalValue, setTotalValue] = useState(0);

  const loadStockVariants = async (stockId: number) => {
    setLoadingVariants(true);
    try {
      const res = await fetch(`/api/client/stock/${stockId}/variants`);
      if (!res.ok) throw new Error('Failed to load variants');
      const data = await res.json();
      const variants = Array.isArray(data?.variants) ? data.variants : [];
      setVariantsDraft(
        variants.map((v: any, idx: number) => ({
          id: v.id,
          color: v.color ?? '',
          size: v.size ?? '',
          variant_name: v.variant_name ?? '',
          price: v.price == null ? undefined : Number(v.price),
          stock_quantity: Number(v.stock_quantity ?? 0),
          is_active: v.is_active == null ? true : Boolean(v.is_active),
          sort_order: v.sort_order == null ? idx : Number(v.sort_order),
        }))
      );
      setVariantsLoaded(true);
      setVariantsDirty(false);
    } catch (e) {
      console.error('Failed to load stock variants', e);
      setVariantsDraft([]);
      setVariantsLoaded(true);
      setVariantsDirty(false);
    } finally {
      setLoadingVariants(false);
    }
  };

  const loadStockOffers = async (stockId: number) => {
    setLoadingOffers(true);
    try {
      const res = await fetch(`/api/client/stock/${stockId}/offers`);
      if (!res.ok) throw new Error('Failed to load offers');
      const data = await res.json();
      const offers = Array.isArray(data?.offers) ? data.offers : [];
      setOffersDraft(offers.map((o: any) => ({
        id: o.id,
        quantity: Number(o.quantity),
        bundle_price: Number(o.bundle_price),
        compare_price: o.compare_price == null ? undefined : Number(o.compare_price),
        free_delivery: Boolean(o.free_delivery),
        label: o.label || undefined,
        image_url: o.image_url || undefined,
        sort_order: o.sort_order ?? 0,
        is_active: o.is_active !== false,
      })));
      setOffersLoaded(true);
      setOffersDirty(false);
    } catch {
      setOffersDraft([]);
      setOffersLoaded(true);
    } finally {
      setLoadingOffers(false);
    }
  };

  const saveStockOffers = async (stockId: number) => {
    try {
      const res = await fetch(`/api/client/stock/${stockId}/offers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offers: offersDraft.map((o, idx) => ({
            ...(o.id ? { id: o.id } : {}),
            quantity: Number(o.quantity),
            bundle_price: Number(o.bundle_price),
            compare_price: o.compare_price == null ? undefined : Number(o.compare_price),
            free_delivery: o.free_delivery ?? false,
            label: o.label || undefined,
            image_url: o.image_url || undefined,
            sort_order: o.sort_order ?? idx,
            is_active: o.is_active !== false,
          })),
        }),
      });
      if (!res.ok && res.status !== 404) {
        throw new Error('Failed to save offers');
      }
    } catch (error) {
      console.error('Failed to save stock offers', error);
    }
  };

  const saveStockVariants = async (stockId: number) => {
    const res = await fetch(`/api/client/stock/${stockId}/variants`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variants: variantsDraft.map((v, idx) => ({
          ...(v.id ? { id: v.id } : {}),
          color: (v.color || '').trim() || undefined,
          size: (v.size || '').trim() || undefined,
          variant_name: (v.variant_name || '').trim() || undefined,
          price: v.price === undefined || v.price === null || Number.isNaN(Number(v.price)) ? undefined : Number(v.price),
          stock_quantity: Number(v.stock_quantity ?? 0),
          is_active: v.is_active ?? true,
          sort_order: v.sort_order == null ? idx : Number(v.sort_order),
        })),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Failed to save variants');
    }
  };

  useEffect(() => {
    loadStock();
    loadCategories();
  }, []);

  useEffect(() => {
    filterStock();
  }, [stock, debouncedSearchQuery, categoryFilter, showLowStock]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 200);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  useEffect(() => {
    // Calculate stats
    const lowCount = stock.filter(item => item.is_low_stock).length;
    const value = stock.reduce((sum, item) => sum + (item.quantity * (item.unit_price || 0)), 0);
    setLowStockCount(lowCount);
    setTotalValue(value);
  }, [stock]);

  const loadStock = async () => {
    try {
      const res = await fetch('/api/client/stock');
      if (res.ok) {
        const data = await res.json();
        setStock(data);
      } else {
        console.error('[loadStock] Failed with status:', res.status);
      }
    } catch (error) {
      console.error('Failed to load stock:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/client/stock/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.map((c: any) => c.category).filter(Boolean));
      }
      
      // Also load all categories with details
      const allRes = await fetch('/api/client/stock/categories/all');
      if (allRes.ok) {
        const allData = await allRes.json();
        setAllCategories(allData);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const createCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    setCreatingCategory(true);
    try {
      const res = await fetch('/api/client/stock/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          color: newCategoryColor,
          icon: newCategoryIcon
        })
      });
      
      if (res.ok) {
        const newCategory = await res.json();
        setAllCategories([...allCategories, { ...newCategory, product_count: 0 }]);
        setCategories([...categories, newCategory.name]);
        setFormData(prev => ({ ...prev, category: newCategory.name }));
        setNewCategoryName('');
        setCategoryPopoverOpen(false);
      } else {
        const error = await res.json();
        toast({
          variant: 'destructive',
          title: t('stock.toast.createCategoryFailedTitle'),
          description: error?.error || t('stock.toast.createCategoryFailedDesc'),
        });
      }
    } catch (error) {
      console.error('Failed to create category:', error);
      toast({
        variant: 'destructive',
        title: t('stock.toast.createCategoryFailedTitle'),
        description: t('stock.toast.createCategoryFailedDesc'),
      });
    } finally {
      setCreatingCategory(false);
    }
  };

  const deleteCategory = async (categoryId: number) => {
    if (!confirm('Delete this category? Products will have their category removed.')) return;
    
    try {
      const res = await fetch(`/api/client/stock/categories/${categoryId}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        setAllCategories(allCategories.filter(c => c.id !== categoryId));
        loadCategories();
        loadStock();
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const filterStock = () => {
    let filtered = [...stock];

    // Search filter
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    // Low stock filter
    if (showLowStock) {
      filtered = filtered.filter(item => item.is_low_stock);
    }

    setFilteredStock(filtered);
  };

  const uploadSingleImage = async (file: File): Promise<string> => {
    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Image must be less than 10MB');
    }
    if (!file.type.startsWith('image/')) {
      throw new Error('Please select an image file');
    }

    const uploadFormData = new FormData();
    uploadFormData.append('image', file);
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: uploadFormData,
    });
    const responseText = await res.text();
    if (!res.ok) {
      try {
        const error = JSON.parse(responseText);
        throw new Error(error.error || 'Upload failed');
      } catch {
        throw new Error(`Upload failed: ${res.statusText}`);
      }
    }
    if (!responseText) throw new Error('Upload succeeded but server returned empty response');
    const data = JSON.parse(responseText);
    return data.url;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const existing = Array.isArray(formData.images) ? formData.images : [];
    const remaining = Math.max(0, 10 - existing.length);
    if (remaining <= 0) {
      toast({
        variant: 'destructive',
        title: t('stock.toast.maxImagesTitle'),
        description: t('stock.toast.maxImagesDesc'),
      });
      e.target.value = '';
      return;
    }

    const toUpload = files.slice(0, remaining);

    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of toUpload) {
        const url = await uploadSingleImage(file);
        uploadedUrls.push(url);
      }

      const nextImages = [...existing, ...uploadedUrls].slice(0, 10);
      setFormData(prev => ({ ...prev, images: nextImages }));

      if (selectedItem?.id) {
        try {
          const updateRes = await fetch(`/api/client/stock/${selectedItem.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: nextImages }),
          });
          if (updateRes.ok) await loadStock();
        } catch (autoSaveErr) {
          console.warn('[handleImageUpload] Auto-save error:', autoSaveErr);
        }
      }

      toast({
        title: t('stock.toast.imagesUploadedTitle'),
        description: t('stock.toast.imagesUploadedDesc'),
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        variant: 'destructive',
        title: t('stock.toast.uploadErrorTitle'),
        description:
          error instanceof Error
            ? error.message
            : t('stock.toast.uploadErrorDesc'),
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImageAt = async (idx: number) => {
    const existing = Array.isArray(formData.images) ? formData.images : [];
    const nextImages = existing.filter((_, i) => i !== idx);
    setFormData(prev => ({ ...prev, images: nextImages }));

    if (selectedItem?.id) {
      try {
        const updateRes = await fetch(`/api/client/stock/${selectedItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: nextImages }),
        });
        if (updateRes.ok) await loadStock();
      } catch (autoSaveErr) {
        console.warn('[removeImageAt] Auto-save error:', autoSaveErr);
      }
    }
  };

  const handleCreateStock = async () => {
    try {
      const payload = buildCreatePayload();
      
      const res = await fetch('/api/client/stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const createdItem = await res.json();

        const createdId = Number(createdItem?.id);
        if (createdId && variantsDraft.length > 0) {
          try {
            await saveStockVariants(createdId);
          } catch (e) {
            console.error('Failed to save stock variants after create', e);
          }
        }
        if (createdId && offersDraft.length > 0) {
          try {
            await saveStockOffers(createdId);
          } catch (e) {
            console.error('Failed to save stock offers after create', e);
          }
        }
        await loadStock();
        setShowAddModal(false);
        setFormData({});
        setVariantsDraft([]);
        setVariantsLoaded(false);
        setVariantsDirty(false);
        setOffersDraft([]);
        setOffersLoaded(false);
        setOffersDirty(false);
        toast({
          title: t('stock.toast.createdTitle'),
          description: t('stock.toast.createdDesc'),
        });
      } else {
        try {
          const error = await res.json();
          console.error('[handleCreateStock] Error response:', error);
          toast({
            variant: 'destructive',
            title: t('stock.toast.createFailedTitle'),
            description: error?.error || t('stock.toast.createFailedDesc'),
          });
        } catch (parseErr) {
          console.error('[handleCreateStock] Failed to parse error response');
          toast({
            variant: 'destructive',
            title: t('stock.toast.createFailedTitle'),
            description: t('stock.toast.createFailedDesc'),
          });
        }
      }
    } catch (error) {
      console.error('Create stock error:', error);
      toast({
        variant: 'destructive',
        title: t('stock.toast.createFailedTitle'),
        description:
          error instanceof Error
            ? error.message
            : t('stock.toast.createFailedDesc'),
      });
    }
  };

  const handleUpdateStock = async () => {
    if (!selectedItem) return;

    try {
      const payload = buildUpdatePayload();
      const res = await fetch(`/api/client/stock/${selectedItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        if (variantsDirty) {
          try {
            await saveStockVariants(selectedItem.id);
            setVariantsDirty(false);
          } catch (e) {
            console.error('Failed to save stock variants', e);
            toast({
              variant: 'destructive',
              title: t('stock.toast.saveVariantsFailedTitle'),
              description: (e as any)?.message || t('stock.toast.saveVariantsFailedDesc'),
            });
          }
        }
        if (offersDirty) {
          try {
            await saveStockOffers(selectedItem.id);
            setOffersDirty(false);
          } catch (e) {
            console.error('Failed to save stock offers', e);
          }
        }
        await loadStock();
        setShowEditModal(false);
        setSelectedItem(null);
        setFormData({});
        setVariantsDraft([]);
        setVariantsLoaded(false);
        setVariantsDirty(false);
        setOffersDraft([]);
        setOffersLoaded(false);
        setOffersDirty(false);
      } else {
        const error = await res.json();
        toast({
          variant: 'destructive',
          title: t('stock.toast.updateFailedTitle'),
          description: error?.error || t('stock.toast.updateFailedDesc'),
        });
      }
    } catch (error) {
      console.error('Update stock error:', error);
      toast({
        variant: 'destructive',
        title: t('stock.toast.updateFailedTitle'),
        description: t('stock.toast.updateFailedDesc'),
      });
    }
  };

  const handleAdjustQuantity = async () => {
    if (!selectedItem) return;

    try {
      const res = await fetch(`/api/client/stock/${selectedItem.id}/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(adjustData)
      });

      if (res.ok) {
        await loadStock();
        setShowAdjustModal(false);
        setSelectedItem(null);
        setAdjustData({ adjustment: 0, reason: 'adjustment', notes: '' });
      } else {
        const error = await res.json();
        toast({
          variant: 'destructive',
          title: t('stock.toast.adjustFailedTitle'),
          description: error?.error || t('stock.toast.adjustFailedDesc'),
        });
      }
    } catch (error) {
      console.error('Adjust quantity error:', error);
      toast({
        variant: 'destructive',
        title: t('stock.toast.adjustFailedTitle'),
        description: t('stock.toast.adjustFailedDesc'),
      });
    }
  };

  const handleDeleteStock = async () => {
    if (!selectedItem) return;

    try {
      const res = await fetch(`/api/client/stock/${selectedItem.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await loadStock();
        setShowDeleteDialog(false);
        setSelectedItem(null);
      } else {
        const error = await res.json();
        toast({
          variant: 'destructive',
          title: t('stock.toast.deleteFailedTitle'),
          description: error?.error || t('stock.toast.deleteFailedDesc'),
        });
      }
    } catch (error) {
      console.error('Delete stock error:', error);
      toast({
        variant: 'destructive',
        title: t('stock.toast.deleteFailedTitle'),
        description: t('stock.toast.deleteFailedDesc'),
      });
    }
  };

  const loadHistory = async (itemId: number) => {
    try {
      const res = await fetch(`/api/client/stock/${itemId}/history`);
      if (res.ok) {
        const data = await res.json();
        setStockHistory(data);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const openEditModal = (item: StockItem) => {
    setSelectedItem(item);
    setFormData({
      ...item,
      images: Array.isArray((item as any).images) ? (item as any).images : [],
      shipping_mode: ((item as any).shipping_mode as any) || 'delivery_pricing',
      shipping_flat_fee: (item as any).shipping_flat_fee ?? null,
      video_url: (item as any).video_url || '',
    });
    setActiveFormSection('product');
    setVariantsDraft([]);
    setVariantsLoaded(false);
    setVariantsDirty(false);
    setOffersDraft([]);
    setOffersLoaded(false);
    setOffersDirty(false);
    setShowEditModal(true);

    // Load variants and offers in background
    loadStockVariants(item.id);
    loadStockOffers(item.id);
  };

  const openAdjustModal = (item: StockItem) => {
    setSelectedItem(item);
    setAdjustData({ adjustment: 0, reason: 'adjustment', notes: '' });
    setShowAdjustModal(true);
  };

  const openHistoryModal = async (item: StockItem) => {
    setSelectedItem(item);
    await loadHistory(item.id);
    setShowHistoryModal(true);
  };

  const openDeleteDialog = (item: StockItem) => {
    setSelectedItem(item);
    setShowDeleteDialog(true);
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Category', 'Quantity', 'Unit Price'];
    const rows = filteredStock.map(item => [
      item.name,
      item.category || '',
      item.quantity,
      item.unit_price || 0,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-inventory-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const outOfStockCount = stock.filter(i => i.status === 'out_of_stock').length;
  const inStockCount = stock.filter(i => i.status === 'active' && !i.is_low_stock).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">{t('stock.title')}…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
    <div className="max-w-screen-xl mx-auto px-3 sm:px-5 lg:px-6 py-4 space-y-3">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-black tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
            <span className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/30 shrink-0">
              <Package className="w-4 h-4 text-white" />
            </span>
            {t('stock.title')}
          </h1>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 mr-9 hidden sm:block">{t('stock.subtitle')}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={loadStock} className="h-8 w-8 p-0 rounded-lg border-slate-200 dark:border-slate-700">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV} className="h-8 w-8 p-0 sm:w-auto sm:px-3 sm:gap-1.5 text-xs font-medium rounded-lg border-slate-200 dark:border-slate-700">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('stock.export')}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowCategoryModal(true)} className="h-8 w-8 p-0 sm:w-auto sm:px-3 sm:gap-1.5 text-xs font-medium rounded-lg border-slate-200 dark:border-slate-700">
            <Tag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('stock.categories')}</span>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setFormData({ name: '', description: '', category: '', quantity: 0, unit_price: undefined, reorder_level: 10, status: 'active', shipping_mode: 'delivery_pricing', shipping_flat_fee: null, images: [], notes: '', video_url: '' });
              setActiveFormSection('product');
              setVariantsDraft([]);
              setVariantsLoaded(false);
              setVariantsDirty(false);
              setShowAddModal(true);
            }}
            className="h-8 gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 sm:px-3 rounded-lg shadow-sm shadow-indigo-500/30"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('stock.addNewProduct')}</span>
          </Button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl px-3 py-2.5 flex items-center gap-2.5 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
            <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t('stock.items')}</p>
            <p className="text-xl font-black text-slate-900 dark:text-white leading-tight">{stock.length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl px-3 py-2.5 flex items-center gap-2.5 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t('stock.totalValue')}</p>
            <p className="text-xl font-black text-slate-900 dark:text-white leading-tight">{Math.round(totalValue).toLocaleString()} <span className="text-xs font-normal text-slate-400">DA</span></p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl px-3 py-2.5 flex items-center gap-2.5 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t('stock.lowStock')}</p>
            <p className="text-xl font-black text-amber-600 dark:text-amber-400 leading-tight">{lowStockCount}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl px-3 py-2.5 flex items-center gap-2.5 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
            <PackageX className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t('stock.outOfStock')}</p>
            <p className="text-xl font-black text-red-600 dark:text-red-400 leading-tight">{outOfStockCount}</p>
          </div>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="relative flex-1 min-w-[120px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={t('stock.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-7 text-xs border-border bg-background focus-visible:ring-1"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[110px] h-7 text-xs border-border bg-background">
              <SelectValue placeholder={t('stock.allCategories')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('stock.allCategories')}</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={() => setShowLowStock(!showLowStock)}
            className={`inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium border transition-colors ${
              showLowStock
                ? 'bg-amber-500 border-amber-500 text-white'
                : 'border-border bg-background text-muted-foreground hover:text-foreground hover:border-amber-500/50'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span className="hidden sm:inline">{t('stock.low')}</span>
            {lowStockCount > 0 && (
              <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${showLowStock ? 'bg-white/20' : 'bg-amber-500 text-white'}`}>
                {lowStockCount}
              </span>
            )}
          </button>
          <div className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap">
            {filteredStock.length}/{stock.length}
          </div>
        </div>

        {/* ── Mobile card list (hidden on md+) ── */}
        <div className="md:hidden divide-y divide-border/60">
          {filteredStock.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <PackageX className="w-8 h-8 mx-auto opacity-30 mb-2" />
              <p className="text-sm font-medium">
                {searchQuery || categoryFilter !== 'all' || showLowStock
                  ? t('stock.noProductsMatch')
                  : t('stock.noStockItems')}
              </p>
            </div>
          ) : (
            filteredStock.map((item) => {
              const stockPct = item.reorder_level > 0 ? Math.min(100, Math.round((item.quantity / (item.reorder_level * 3)) * 100)) : 100;
              const barColor = item.status === 'out_of_stock' ? 'bg-red-500' : item.is_low_stock ? 'bg-amber-500' : 'bg-emerald-500';
              const statusColor = item.status === 'out_of_stock' ? 'text-red-600 dark:text-red-400' : item.is_low_stock ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
              return (
                <div key={item.id} className="px-3 py-3 active:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    {/* Thumbnail */}
                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                      {item.images?.[0]
                        ? <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-muted-foreground/30"><Package className="w-5 h-5" /></div>
                      }
                    </div>
                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-semibold text-sm leading-tight truncate">{item.name}</p>
                        <span className={`text-sm font-bold tabular-nums flex-shrink-0 ml-1 ${statusColor}`}>{item.quantity}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {item.category && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{item.category}</span>
                        )}
                        <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${statusColor}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'out_of_stock' ? 'bg-red-500' : item.is_low_stock ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                          {item.status === 'out_of_stock' ? t('stock.outStock') : item.is_low_stock ? t('stock.low') : t('stock.active')}
                        </span>
                        {item.unit_price && (
                          <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">{Math.round(Number(item.unit_price)).toLocaleString()} DA</span>
                        )}
                      </div>
                      {/* Stock bar */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${stockPct}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">min {item.reorder_level}</span>
                      </div>
                    </div>
                  </div>
                  {/* Action row */}
                  <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-border/40">
                    <button
                      onClick={() => openAdjustModal(item)}
                      className="flex-1 h-8 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium active:bg-emerald-500/20 transition-colors"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      {t('stock.adjustQuantity')}
                    </button>
                    <button
                      onClick={() => openHistoryModal(item)}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-muted text-muted-foreground active:bg-muted/80 transition-colors"
                    >
                      <History className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openEditModal(item)}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-muted text-muted-foreground active:bg-muted/80 transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openDeleteDialog(item)}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-red-500/10 text-red-500 active:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Desktop table (hidden on mobile) ── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t('stock.product')}</th>
                <th className="text-left px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-[100px]">{t('stock.category')}</th>
                <th className="text-center px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-[100px]">{t('stock.qty')}</th>
                <th className="text-left px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-[90px]">{t('stock.status')}</th>
                <th className="text-right px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-[90px]">{t('stock.price')}</th>
                <th className="text-right px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-[120px]">{t('stock.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredStock.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    <PackageX className="w-8 h-8 mx-auto opacity-30 mb-2" />
                    <p className="text-sm font-medium">
                      {searchQuery || categoryFilter !== 'all' || showLowStock
                        ? t('stock.noProductsMatch')
                        : t('stock.noStockItems')}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStock.map((item) => {
                  const stockPct = item.reorder_level > 0 ? Math.min(100, Math.round((item.quantity / (item.reorder_level * 3)) * 100)) : 100;
                  const barColor = item.status === 'out_of_stock' ? 'bg-red-500' : item.is_low_stock ? 'bg-amber-500' : 'bg-emerald-500';
                  return (
                    <tr key={item.id} className="hover:bg-muted/40 transition-colors group">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-md overflow-hidden flex-shrink-0 bg-muted">
                            {item.images?.[0]
                              ? <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-muted-foreground/40"><Package className="w-4 h-4" /></div>
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate leading-tight">{item.name}</p>
                            {item.description && (
                              <p className="text-[11px] text-muted-foreground truncate max-w-[170px] leading-tight">{item.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {item.category
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-medium border border-primary/20">{item.category}</span>
                          : <span className="text-[11px] text-muted-foreground/50">—</span>
                        }
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`tabular-nums font-bold text-sm ${
                            item.status === 'out_of_stock' ? 'text-red-600 dark:text-red-400'
                            : item.is_low_stock ? 'text-amber-600 dark:text-amber-400'
                            : 'text-foreground'
                          }`}>{item.quantity}</span>
                          <div className="w-12 h-1 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${stockPct}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground/60">min {item.reorder_level}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          item.status === 'out_of_stock' ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                          : item.status === 'discontinued' ? 'bg-muted text-muted-foreground'
                          : item.is_low_stock ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            item.status === 'out_of_stock' ? 'bg-red-500'
                            : item.status === 'discontinued' ? 'bg-muted-foreground'
                            : item.is_low_stock ? 'bg-amber-500'
                            : 'bg-emerald-500'
                          }`} />
                          {item.status === 'out_of_stock' ? t('stock.outStock')
                            : item.status === 'discontinued' ? t('stock.discontinued')
                            : item.is_low_stock ? t('stock.low')
                            : t('stock.active')}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {item.unit_price
                          ? <span className="font-semibold text-sm">{Math.round(Number(item.unit_price)).toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">DA</span></span>
                          : <span className="text-muted-foreground/50 text-xs">—</span>
                        }
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openAdjustModal(item)} title={t('stock.adjustQuantity')} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-900/30 text-muted-foreground transition-colors">
                            <TrendingUp className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openHistoryModal(item)} title={t('stock.history')} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/30 text-muted-foreground transition-colors">
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEditModal(item)} title={t('stock.editProduct')} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openDeleteDialog(item)} title={t('stock.deleteProduct')} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 text-muted-foreground transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {filteredStock.length > 0 && (
          <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 flex items-center gap-4 text-[11px] text-slate-400">
            <span><span className="font-semibold text-foreground">{inStockCount}</span> {t('stock.active')}</span>
            <span><span className="font-semibold text-amber-600">{lowStockCount}</span> {t('stock.low')}</span>
            <span><span className="font-semibold text-red-600">{outOfStockCount}</span> {t('stock.outOfStock')}</span>
            <span className="ml-auto">{t('stock.totalValue')}: <span className="font-semibold text-foreground">{Math.round(totalValue).toLocaleString()} DA</span></span>
          </div>
        )}
      </div>
    </div>

      {/* Add/Edit Product Modal */}
      <Dialog open={showAddModal || showEditModal} onOpenChange={(open) => {
        if (!open) {
          setShowAddModal(false);
          setShowEditModal(false);
          setFormData({});
          setSelectedItem(null);
          setActiveFormSection('product');
          setVariantsDraft([]);
          setVariantsLoaded(false);
          setVariantsDirty(false);
          setOffersDraft([]);
          setOffersLoaded(false);
          setOffersDirty(false);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-background via-background to-primary/5 dark:from-slate-950 dark:to-slate-900/30 p-3 md:p-4">
          <DialogHeader className="space-y-1 pb-2 md:pb-3 border-b border-border/50">
            <DialogTitle className="text-lg md:text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              {showAddModal ? t('stock.addNewProduct') : t('stock.editProduct')}
            </DialogTitle>
            <DialogDescription className="text-base font-semibold">
              {showAddModal ? t('stock.addToInventory') : t('stock.updateInfo')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 md:gap-3 py-2 md:py-3">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: 'product', label: t('stock.form.sections.product') },
                  { key: 'price', label: t('stock.form.sections.price') },
                  { key: 'variants', label: t('stock.form.sections.variants') },
                  { key: 'offers', label: t('stock.form.sections.offers') },
                  { key: 'status', label: t('stock.form.sections.status') },
                  { key: 'shipping', label: t('stock.form.sections.shipping') },
                  { key: 'images', label: t('stock.form.sections.images') },
                  { key: 'video', label: '🎬 فيديو' },
                  { key: 'notes', label: t('stock.form.sections.notes') },
                ] as const
              ).map((sec) => (
                <Button
                  key={sec.key}
                  type="button"
                  variant={activeFormSection === sec.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveFormSection(sec.key)}
                  className={activeFormSection === sec.key ? 'bg-gradient-to-r from-primary to-purple-600 text-white' : 'border-primary/30 hover:bg-primary/10'}
                >
                  {sec.label}
                </Button>
              ))}
            </div>

            {activeFormSection === 'product' && (
              <div className="space-y-2 bg-primary/5 dark:bg-slate-800/30 p-2 md:p-3 rounded border border-primary/20">
                <h3 className="text-lg font-bold text-primary">{t('stock.basicInfo')}</h3>

                {(formData.images?.length || 0) > 0 && (
                  <AIVisionSuggest
                    imageUrl={formData.images![0]}
                    locale="ar"
                    onApply={(data) => setFormData(prev => ({
                      ...prev,
                      ...(data.title ? { name: data.title } : {}),
                      ...(data.description ? { description: data.description } : {}),
                      ...(data.category ? { category: data.category } : {}),
                      ...(data.price ? { unit_price: data.price } : {}),
                    }))}
                  />
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="name" className="text-base font-bold">{t('stock.productName')} *</Label>
                    <AISuggestTitles
                      currentTitle={formData.name || ''}
                      category={formData.category || ''}
                      onSelect={(title) => setFormData(prev => ({ ...prev, name: title }))}
                    />
                  </div>
                  <Input
                    id="name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={t('stock.productName')}
                    className="border-primary/30 focus:border-primary/60 transition-colors h-9 text-base"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="description" className="text-base font-bold">{t('stock.description')}</Label>
                    <AIGenerateDescription
                      title={formData.name || ''}
                      category={formData.category || ''}
                      onGenerate={(desc) => setFormData(prev => ({ ...prev, description: desc }))}
                    />
                  </div>
                  <Textarea
                    id="description"
                    value={formData.description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={t('stock.description')}
                    rows={3}
                    className="border-primary/30 focus:border-primary/60 transition-colors resize-none text-base"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="category" className="text-base font-bold">{t('stock.category')}</Label>
                  <Input
                    id="category"
                    value={formData.category || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    placeholder={t('stock.selectCategory')}
                    className="border-primary/30 focus:border-primary/60 transition-colors h-9 text-base"
                  />
                </div>
              </div>
            )}

            {activeFormSection === 'variants' && (() => {
              const COLORS = [
                { name: 'أحمر', tw: 'bg-red-500', ring: 'ring-red-400' },
                { name: 'أزرق', tw: 'bg-blue-500', ring: 'ring-blue-400' },
                { name: 'أسود', tw: 'bg-slate-900', ring: 'ring-slate-700' },
                { name: 'أبيض', tw: 'bg-white border border-slate-300', ring: 'ring-slate-300' },
                { name: 'أخضر', tw: 'bg-emerald-500', ring: 'ring-emerald-400' },
                { name: 'أصفر', tw: 'bg-yellow-400', ring: 'ring-yellow-300' },
                { name: 'رمادي', tw: 'bg-gray-400', ring: 'ring-gray-300' },
                { name: 'بني', tw: 'bg-amber-700', ring: 'ring-amber-600' },
                { name: 'برتقالي', tw: 'bg-orange-500', ring: 'ring-orange-400' },
                { name: 'وردي', tw: 'bg-pink-400', ring: 'ring-pink-300' },
                { name: 'بنفسجي', tw: 'bg-purple-500', ring: 'ring-purple-400' },
                { name: 'كحلي', tw: 'bg-blue-900', ring: 'ring-blue-800' },
                { name: 'بيج', tw: 'bg-amber-100 border border-amber-300', ring: 'ring-amber-200' },
              ];
              const CLOTHING = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
              const SHOES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];

              const existingColors = [...new Set(variantsDraft.map(v => (v.color || '').trim()).filter(Boolean))];
              const existingSizes = [...new Set(variantsDraft.map(v => (v.size || '').trim()).filter(Boolean))];

              const splitColors = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);

              const generateCombos = (colors: string[], sizes: string[]) => {
                const newVariants: typeof variantsDraft = [];
                const existingKeys = new Set(variantsDraft.map(v => `${(v.color||'').trim()}|${(v.size||'').trim()}`));
                for (const c of colors) {
                  for (const s of sizes) {
                    if (!existingKeys.has(`${c}|${s}`)) {
                      newVariants.push({ color: c, size: s, variant_name: '', stock_quantity: 0, is_active: true, sort_order: variantsDraft.length + newVariants.length });
                    }
                  }
                }
                return newVariants;
              };

              const toggleColor = (colorName: string) => {
                const has = existingColors.includes(colorName);
                if (has) {
                  setVariantsDraft(prev => prev.filter(v => (v.color || '').trim() !== colorName));
                } else {
                  const sizesToUse = existingSizes.length > 0 ? existingSizes : [''];
                  const newOnes = generateCombos([colorName], sizesToUse);
                  if (newOnes.length > 0) {
                    setVariantsDraft(prev => [...prev, ...newOnes]);
                  } else {
                    setVariantsDraft(prev => [...prev, { color: colorName, size: '', variant_name: '', stock_quantity: 0, is_active: true, sort_order: prev.length }]);
                  }
                }
                setVariantsDirty(true);
                setVariantsLoaded(true);
              };

              const toggleSize = (sizeName: string) => {
                const has = existingSizes.includes(sizeName);
                if (has) {
                  setVariantsDraft(prev => prev.filter(v => (v.size || '').trim() !== sizeName));
                } else {
                  const colorsToUse = existingColors.length > 0 ? existingColors : [''];
                  const newOnes = generateCombos(colorsToUse, [sizeName]);
                  if (newOnes.length > 0) {
                    setVariantsDraft(prev => [...prev, ...newOnes]);
                  } else {
                    setVariantsDraft(prev => [...prev, { color: '', size: sizeName, variant_name: '', stock_quantity: 0, is_active: true, sort_order: prev.length }]);
                  }
                }
                setVariantsDirty(true);
                setVariantsLoaded(true);
              };

              const colorGroups: { [color: string]: (typeof variantsDraft[0] & { originalIndex: number })[] } = {};
              variantsDraft.forEach((v, idx) => {
                const color = (v.color || '').trim() || '—';
                if (!colorGroups[color]) colorGroups[color] = [];
                colorGroups[color].push({ ...v, originalIndex: idx });
              });

              return (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                    <Layers className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('stock.form.sections.variants')}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('stock.hints.variants')}</p>
                  </div>
                </div>

                {loadingVariants && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                  </div>
                )}

                {!loadingVariants && (<>
                {/* Step 1: Colors */}
                <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                      <Palette className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-slate-800 dark:text-white">① اختر الألوان المتوفرة</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block">اضغط على كل لون متوفر لديك</span>
                    </div>
                    {existingColors.length > 0 && (
                      <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 px-2.5 py-1 rounded-full">
                        {existingColors.length} لون
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap gap-2.5">
                      {COLORS.map((c) => {
                        const selected = existingColors.includes(c.name);
                        return (
                          <button key={c.name} type="button" onClick={() => toggleColor(c.name)}
                            className={`group relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                              selected
                                ? 'bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-500 dark:border-indigo-400 shadow-md shadow-indigo-500/10'
                                : 'bg-slate-50 dark:bg-slate-700/50 border-2 border-transparent hover:border-slate-300 dark:hover:border-slate-500 hover:shadow-sm'
                            }`}>
                            <span className={`w-5 h-5 rounded-full ${c.tw} flex-shrink-0 ${selected ? `ring-2 ${c.ring} ring-offset-2` : ''}`} />
                            <span className="text-slate-700 dark:text-slate-200">{c.name}</span>
                            {selected && (
                              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center shadow-sm">
                                <Check className="h-3 w-3 text-white" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {/* Custom palette colors (added by user, persist with product) */}
                      {existingColors.filter(c => !COLORS.some(sc => sc.name === c)).map(customColor => (
                        <button key={customColor} type="button" onClick={() => toggleColor(customColor)}
                          className="group relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-200 dark:border-amber-700 hover:border-amber-400 dark:hover:border-amber-500 shadow-sm"
                        >
                          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex-shrink-0" />
                          <span className="text-amber-700 dark:text-amber-300">{customColor}</span>
                          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center shadow-sm">
                            <Check className="h-3 w-3 text-white" />
                          </span>
                          <button type="button" onClick={(e) => { e.stopPropagation(); toggleColor(customColor); }}
                            className="p-0.5 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors mr-1"
                          >
                            <X className="h-3 w-3 text-amber-500" />
                          </button>
                        </button>
                      ))}
                      <div className="flex items-center gap-1.5 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl px-3 py-1.5">
                        <Plus className="h-4 w-4 text-slate-400" />
                        <Input
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = (e.target as HTMLInputElement).value.trim();
                              if (val && !existingColors.includes(val)) { toggleColor(val); (e.target as HTMLInputElement).value = ''; }
                            }
                          }}
                          placeholder="لون آخر + Enter"
                          className="h-7 w-24 border-0 p-0 text-sm bg-transparent focus-visible:ring-0 shadow-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 2: Sizes */}
                <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                      <Ruler className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-slate-800 dark:text-white">② اختر المقاسات المتوفرة</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block">اضغط على كل مقاس متوفر لديك</span>
                    </div>
                    {existingSizes.length > 0 && (
                      <span className="text-xs font-bold bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-300 px-2.5 py-1 rounded-full">
                        {existingSizes.length} مقاس
                      </span>
                    )}
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Shirt className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ملابس</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {CLOTHING.map((s) => {
                          const selected = existingSizes.includes(s);
                          return (
                            <button key={s} type="button" onClick={() => toggleSize(s)}
                              className={`min-w-[44px] px-3 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                                selected ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/25 scale-105' : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                              }`}>{s}</button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Footprints className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">أحذية</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {SHOES.map((s) => {
                          const selected = existingSizes.includes(s);
                          return (
                            <button key={s} type="button" onClick={() => toggleSize(s)}
                              className={`min-w-[44px] px-3 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                                selected ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/25 scale-105' : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                              }`}>{s}</button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl px-3 py-1.5 w-fit">
                      <Plus className="h-4 w-4 text-slate-400" />
                      <Input
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = (e.target as HTMLInputElement).value.trim();
                            if (val && !existingSizes.includes(val)) { toggleSize(val); (e.target as HTMLInputElement).value = ''; }
                          }
                        }}
                        placeholder="مقاس آخر + Enter"
                        className="h-7 w-28 border-0 p-0 text-sm bg-transparent focus-visible:ring-0 shadow-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Step 3: Variants table */}
                {variantsDraft.length > 0 && (
                <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                      <Package className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-slate-800 dark:text-white">③ المخزون لكل نوع</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block">أدخل الكمية المتوفرة لكل نوع</span>
                    </div>
                    <span className="text-xs font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 px-2.5 py-1 rounded-full">
                      {variantsDraft.length} نوع
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {Object.entries(colorGroups).map(([color, variants]) => (
                      <div key={color}>
                        {color !== '—' && (
                          <div className="px-4 py-2 bg-slate-50/80 dark:bg-slate-800/50 flex items-center gap-2">
                            {(() => {
                              const names = splitColors(color);
                              if (names.length > 1) {
                                return (
                                  <div className="flex -space-x-1.5">
                                    {names.map((n, i) => {
                                      const def = COLORS.find(c => c.name === n);
                                      return (
                                        <span key={i} className={`w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${def?.tw || 'bg-slate-300'}`} />
                                      );
                                    })}
                                  </div>
                                );
                              }
                              const cd = COLORS.find(c => c.name === color);
                              return cd ? <span className={`w-4 h-4 rounded-full ${cd.tw}`} /> : <Palette className="h-4 w-4 text-slate-400" />;
                            })()}
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{color}</span>
                            <span className="text-[10px] text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">{variants.length}</span>
                          </div>
                        )}
                        {variants.map((v) => (
                          <div key={v.originalIndex} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                            <span className={`min-w-[42px] text-center px-2 py-1 rounded-lg text-xs font-bold ${v.size ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                              {v.size || '—'}
                            </span>
                            <div className="flex items-center gap-1.5 flex-1">
                              <span className="text-xs text-slate-400">الكمية:</span>
                              <Input
                                type="number" min={0}
                                value={v.stock_quantity ?? ''}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const next = raw === '' ? undefined : Number(raw);
                                  const idx = v.originalIndex;
                                  setVariantsDraft(prev => prev.map((row, i) => (i === idx ? { ...row, stock_quantity: next } : row)));
                                  setVariantsDirty(true);
                                }}
                                className="h-8 w-20 text-sm text-center" placeholder="0"
                              />
                            </div>
                            <div className="hidden sm:flex items-center gap-1.5">
                              <Input
                                type="number" min={0} step="0.01"
                                value={formatPriceForInput(v.price)}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const next = raw === '' ? undefined : Number(raw);
                                  const idx = v.originalIndex;
                                  setVariantsDraft(prev => prev.map((row, i) => (i === idx ? { ...row, price: next } : row)));
                                  setVariantsDirty(true);
                                }}
                                placeholder="السعر" className="h-8 w-20 text-sm text-center"
                              />
                              <span className="text-[10px] text-slate-400">دج</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span dir="ltr">
                                <Switch
                                  checked={v.is_active ?? true}
                                  onCheckedChange={(checked) => {
                                    const idx = v.originalIndex;
                                    setVariantsDraft(prev => prev.map((row, i) => (i === idx ? { ...row, is_active: checked } : row)));
                                    setVariantsDirty(true);
                                  }}
                                />
                              </span>
                              <button type="button"
                                onClick={() => { const idx = v.originalIndex; setVariantsDraft(prev => prev.filter((_, i) => i !== idx)); setVariantsDirty(true); setVariantsLoaded(true); }}
                                className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                    <Button type="button" size="sm" variant="outline"
                      onClick={() => {
                        setVariantsDraft(prev => [...prev, { color: '', size: '', variant_name: '', price: undefined, stock_quantity: 0, is_active: true, sort_order: prev.length }]);
                        setVariantsLoaded(true); setVariantsDirty(true);
                      }}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> إضافة نوع يدوياً
                    </Button>
                  </div>
                </div>
                )}
                </>)}
              </div>
              );
            })()}

            {activeFormSection === 'offers' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/25">
                    <TicketPercent className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('stock.offersTitle')}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('stock.offersDesc')}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setOffersDraft((prev) => [
                        ...prev,
                        {
                          quantity: prev.length + 2,
                          bundle_price: (Number(formData.unit_price) ?? 0) * (prev.length + 2),
                          free_delivery: false,
                          sort_order: prev.length,
                        },
                      ]);
                      setOffersDirty(true);
                      setOffersLoaded(true);
                    }}
                    className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-md shadow-orange-500/20"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t('stock.offersAddBtn') || 'إضافة عرض'}
                  </Button>
                </div>

                {loadingOffers && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                  </div>
                )}

                {!loadingOffers && (offersDraft.length === 0) && (
                  <div className="text-center py-8 bg-white dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 flex items-center justify-center mx-auto mb-3">
                      <Gift className="h-7 w-7 text-orange-400 dark:text-orange-500" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">لا يوجد عروض بعد</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                      أنشئ عروض خاصة مثل: اشترِ 2 بسعر 2700 دج بدل 3000 دج
                    </p>
                    {showAddModal && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 max-w-[300px] mx-auto">
                        💡 يمكنك إضافة العروض بعد إنشاء المنتج من خلال تعديله لاحقاً
                      </p>
                    )}
                  </div>
                )}

                {!loadingOffers && offersDraft.length > 0 && (
                  <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {offersDraft.map((o, idx) => {
                      const unitPrice = Number(formData.unit_price) ?? 0;
                      const totalRegular = unitPrice * Number(o.quantity);
                      const bundlePrice = Number(o.bundle_price) ?? 0;
                      const savings = totalRegular > bundlePrice ? totalRegular - bundlePrice : 0;
                      const discountPercent = totalRegular > 0 ? Math.round((savings / totalRegular) * 100) : 0;
                      return (
                      <div key={o.id ?? idx} className="px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                        <div className="flex items-center gap-3">
                          <label className="flex-shrink-0 cursor-pointer group">
                            <input type="file" accept="image/*" className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  const fd = new FormData();
                                  fd.append('image', file);
                                  const res = await fetch('/api/upload', { method: 'POST', body: fd });
                                  if (!res.ok) throw new Error('Upload failed');
                                  const data = await res.json();
                                  setOffersDraft((prev) => prev.map((row, i) => (i === idx ? { ...row, image_url: data.url } : row)));
                                  setOffersDirty(true);
                                } catch { /* silent */ }
                              }}
                            />
                            {o.image_url ? (
                              <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600">
                                <img src={o.image_url} alt="" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                  <Edit className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center group-hover:border-orange-400 transition-colors">
                                <ImageIcon className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-orange-400 transition-colors" />
                              </div>
                            )}
                          </label>

                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                            idx === 0 ? 'bg-gradient-to-br from-orange-500 to-red-500' :
                            idx === 1 ? 'bg-gradient-to-br from-violet-500 to-purple-600' :
                            'bg-gradient-to-br from-emerald-500 to-teal-600'
                          }`}>{idx + 1}</div>

                          <div className="flex-1">
                            <Input
                              type="text"
                              value={o.label || ''}
                              onChange={(e) => { setOffersDraft((prev) => prev.map((row, i) => (i === idx ? { ...row, label: e.target.value || undefined } : row))); setOffersDirty(true); }}
                              placeholder={`${o.quantity} منتج 💚${o.free_delivery ? ' + توصيل مجاني ✅' : ''}`}
                              className="h-8 text-sm font-bold" dir="auto"
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <Input
                              type="number" min={1}
                              value={o.quantity}
                              onChange={(e) => { setOffersDraft((prev) => prev.map((row, i) => (i === idx ? { ...row, quantity: Number(e.target.value) } : row))); setOffersDirty(true); }}
                              className="h-8 w-14 text-sm text-center"
                            />
                            <span className="text-xs text-slate-400">×</span>
                            <Input
                              type="number" min={0} step="0.01"
                              value={formatPriceForInput(o.bundle_price)}
                              onChange={(e) => { const n = e.target.value === '' ? 0 : Number(e.target.value); setOffersDraft((prev) => prev.map((row, i) => (i === idx ? { ...row, bundle_price: n } : row))); setOffersDirty(true); }}
                              className="h-8 w-24 text-sm text-center"
                            />
                          </div>

                          <button type="button"
                            onClick={() => { setOffersDraft((prev) => prev.map((row, i) => (i === idx ? { ...row, free_delivery: !row.free_delivery } : row))); setOffersDirty(true); }}
                            className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                              o.free_delivery
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-400 border border-transparent hover:border-slate-300'
                            }`}>
                            <Truck className="h-3 w-3" />
                            {o.free_delivery ? '✓' : 'مجاني'}
                          </button>

                          {discountPercent > 0 && (
                            <span className="flex-shrink-0 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded-md">-{discountPercent}%</span>
                          )}

                          <button type="button"
                            onClick={() => { setOffersDraft((prev) => prev.filter((_, i) => i !== idx)); setOffersDirty(true); setOffersLoaded(true); }}
                            className="flex-shrink-0 p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      );
                    })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeFormSection === 'status' && (
              <div className="space-y-2 bg-amber-500/5 dark:bg-amber-900/10 p-2 md:p-3 rounded border border-amber-500/20">
                <h3 className="text-lg font-bold text-amber-600 dark:text-amber-400">{t('stock.status')}</h3>
                <div className="space-y-1">
                  <Label htmlFor="stock_status" className="text-base font-bold">{t('stock.status')}</Label>
                  <Select
                    value={(formData.status as any) || 'active'}
                    onValueChange={(value: any) => setFormData((prev) => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger id="stock_status" className="border-amber-500/30 focus:border-amber-500/60 h-9 text-base font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-[300]" sideOffset={4}>
                      <SelectItem value="active">{t('stock.active')}</SelectItem>
                      <SelectItem value="out_of_stock">{t('stock.outStock')}</SelectItem>
                      <SelectItem value="discontinued">{t('stock.discontinued')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {activeFormSection === 'price' && (
              <div className="space-y-2 bg-emerald-500/5 dark:bg-emerald-900/10 p-2 md:p-3 rounded border border-emerald-500/20">
                <h3 className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{t('stock.basicInfo') || 'السعر والمخزون'}</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="unit_price" className="text-base font-bold">{t('stock.unitPrice')} *</Label>
                    <Input
                      id="unit_price"
                      type="number"
                      step="0.01"
                      value={formatPriceForInput(formData.unit_price)}
                      onChange={(e) => {
                        const v = e.target.value;
                        const n = Number(v);
                        setFormData(prev => ({ ...prev, unit_price: v === '' || Number.isNaN(n) ? undefined : n }));
                      }}
                      min="0"
                      placeholder="0"
                      className="border-emerald-500/30 focus:border-emerald-500/60 transition-colors h-9 text-base"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="compare_price" className="text-base font-bold">{t('stock.comparePrice') || 'السعر الأصلي (شطب)'}</Label>
                    <Input
                      id="compare_price"
                      type="number"
                      step="0.01"
                      value={formatPriceForInput((formData as any).compare_price)}
                      onChange={(e) => {
                        const v = e.target.value;
                        const n = Number(v);
                        setFormData(prev => ({ ...prev, compare_price: v === '' || Number.isNaN(n) ? undefined : n } as any));
                      }}
                      min="0"
                      placeholder="0"
                      className="border-emerald-500/30 focus:border-emerald-500/60 transition-colors h-9 text-base"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="quantity" className="text-base font-bold">{t('stock.quantity')}</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={formData.quantity ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      const n = Number.parseInt(v, 10);
                      setFormData(prev => ({ ...prev, quantity: v === '' || Number.isNaN(n) ? undefined : Math.max(0, n) }));
                    }}
                    min="0"
                    className="border-emerald-500/30 focus:border-emerald-500/60 transition-colors h-9 text-base"
                  />
                  <p className="text-xs text-muted-foreground">{t('stock.hints.quantity')}</p>
                </div>

              </div>
            )}

            {activeFormSection === 'shipping' && (
              <div className="space-y-2 bg-indigo-500/5 dark:bg-indigo-900/10 p-2 md:p-3 rounded border border-indigo-500/20">
                <h3 className="text-lg font-bold text-indigo-600 dark:text-indigo-400">Shipping</h3>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-base font-bold">Shipping mode</Label>
                    <Select
                      value={(formData.shipping_mode as any) || 'delivery_pricing'}
                      onValueChange={(value: any) => {
                        setFormData(prev => ({
                          ...prev,
                          shipping_mode: value,
                          shipping_flat_fee: value === 'flat' ? (prev.shipping_flat_fee ?? 0) : null,
                        }));
                      }}
                    >
                      <SelectTrigger className="border-indigo-500/30 focus:border-indigo-500/60 h-9 text-base font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" className="z-[300]" sideOffset={4}>
                        <SelectItem value="delivery_pricing">Normal delivery prices (wilaya-based)</SelectItem>
                        <SelectItem value="flat">Same shipping price for all wilayas</SelectItem>
                        <SelectItem value="free">Free shipping</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {((formData.shipping_mode as any) || 'delivery_pricing') === 'flat' && (
                    <div className="space-y-1">
                      <Label className="text-base font-bold">Flat fee (DA)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={formData.shipping_flat_fee ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const parsed = raw === '' ? undefined : Number(raw);
                          setFormData(prev => ({ ...prev, shipping_flat_fee: typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined }))
                        }}
                        className="border-indigo-500/30 focus:border-indigo-500/60 h-9 text-base"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeFormSection === 'images' && (
              <div className="space-y-2 bg-purple-500/5 dark:bg-purple-900/10 p-2 md:p-3 rounded border border-purple-500/20">
                <h3 className="text-lg font-bold text-purple-600 dark:text-purple-400">Images (max 10)</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {(Array.isArray(formData.images) ? formData.images : []).map((url, idx) => (
                    <div key={`${url}-${idx}`} className="relative w-full h-28 border rounded-lg overflow-hidden">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        className="absolute top-1 right-1 h-7 w-7"
                        onClick={() => removeImageAt(idx)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    disabled={uploading || ((formData.images?.length || 0) >= 10)}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload up to 10 images. Each image must be &lt; 10MB.
                  </p>
                </div>
              </div>
            )}

            {activeFormSection === 'video' && (
              <div className="space-y-3 bg-rose-500/5 dark:bg-rose-900/10 p-2 md:p-3 rounded border border-rose-500/20">
                <div>
                  <h3 className="text-lg font-bold text-rose-600 dark:text-rose-400">🎬 فيديو المنتج</h3>
                  <p className="text-sm text-muted-foreground">الفيديو يظهر أولاً في معرض الصور — العميل يرى الفيديو ثم يتنقل للصور</p>
                </div>
                {/* Upload video file directly */}
                <div className="flex items-center gap-2">
                  <label className={`flex items-center gap-2 px-3 py-2 rounded-md border border-dashed cursor-pointer text-sm transition-colors ${uploadingVideo ? 'opacity-50 pointer-events-none' : 'hover:bg-rose-500/10 border-rose-400/40'}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                    {uploadingVideo ? 'جارٍ الرفع...' : 'رفع فيديو من جهازك (mp4)'}
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/ogg"
                      className="hidden"
                      disabled={uploadingVideo}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!file.type.startsWith('video/')) {
                          toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء اختيار ملف فيديو (mp4, webm...)' });
                          return;
                        }
                        if (file.size > 100 * 1024 * 1024) {
                          toast({ variant: 'destructive', title: 'الملف كبير جداً', description: 'الحد الأقصى لحجم الفيديو هو 100MB' });
                          e.target.value = '';
                          return;
                        }
                        setUploadingVideo(true);
                        try {
                          const fd = new FormData();
                          fd.append('image', file);
                          const res = await fetch('/api/upload', { method: 'POST', body: fd });
                          if (!res.ok) throw new Error('فشل الرفع');
                          const data = await res.json();
                          setFormData((prev) => ({ ...prev, video_url: data.url }));
                          toast({ title: 'تم رفع الفيديو ✓' });
                        } catch {
                          toast({ variant: 'destructive', title: 'فشل رفع الفيديو', description: 'حاول مرة أخرى' });
                        } finally {
                          setUploadingVideo(false);
                          e.target.value = '';
                        }
                      }}
                    />
                  </label>
                  <span className="text-xs text-muted-foreground">أو الصق رابطاً أدناه</span>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="video_url" className="text-base font-bold">رابط الفيديو</Label>
                  <Input
                    id="video_url"
                    value={(formData as any).video_url || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, video_url: e.target.value }))}
                    placeholder="https://youtube.com/... أو رابط مباشر"
                    className="border-rose-500/30 focus:border-rose-500/60 transition-colors h-10 text-base"
                  />
                  <p className="text-xs text-muted-foreground">
                    يدعم YouTube، Vimeo، أو رابط فيديو مباشر (MP4)
                  </p>
                </div>
                {/* Preview if video exists */}
                {(formData as any).video_url && (
                  <div className="rounded-lg overflow-hidden border border-rose-500/30 bg-black">
                    <video
                      src={(formData as any).video_url}
                      className="w-full max-h-48 object-contain"
                      controls
                      preload="metadata"
                    />
                  </div>
                )}
              </div>
            )}

            {activeFormSection === 'notes' && (
              <div className="space-y-2 bg-slate-500/5 dark:bg-slate-900/10 p-2 md:p-3 rounded border border-slate-500/20">
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Notes</h3>
                <div className="space-y-1">
                  <Label htmlFor="notes" className="text-base font-bold">{t('stock.additionalNotes')}</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder={t('stock.additionalNotes')}
                    rows={4}
                    className="border-slate-500/30 focus:border-slate-500/60 transition-colors resize-none text-base"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border/50 pt-2 md:pt-3 mt-2 gap-2 flex flex-row-reverse">
            <Button 
              onClick={showAddModal ? handleCreateStock : handleUpdateStock}
              className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700 text-white shadow hover:shadow-md transition-all text-base font-bold h-10"
            >
              {showAddModal ? t('stock.createProduct') : t('stock.saveChanges')}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddModal(false);
                setShowEditModal(false);
                setFormData({});
                setActiveFormSection('product');
                setVariantsDraft([]);
                setVariantsLoaded(false);
                setVariantsDirty(false);
              }}
              className="border-muted-foreground/30 hover:bg-muted/50 text-base font-bold h-10"
            >
              ❌ {t('cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Quantity Modal */}
      <Dialog open={showAdjustModal} onOpenChange={(open) => {
        if (!open) {
          setShowAdjustModal(false);
          setSelectedItem(null);
          setAdjustData({ adjustment: 0, reason: 'adjustment', notes: '' });
        }
      }}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-sm font-semibold leading-tight">{t('stock.adjustQuantity')}</DialogTitle>
              {selectedItem && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{selectedItem.name}</p>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="px-4 py-3 space-y-3">
            {/* Current → New qty display */}
            {selectedItem && (
              <div className="flex items-center justify-between rounded-lg bg-muted/40 border border-border px-3 py-2">
                <div className="text-center">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{t('stock.currentQuantity')}</p>
                  <p className="text-2xl font-bold tabular-nums leading-tight">{selectedItem.quantity}</p>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <div className={`text-xs font-bold px-2 py-0.5 rounded ${adjustData.adjustment > 0 ? 'text-emerald-600' : adjustData.adjustment < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                    {adjustData.adjustment > 0 ? `+${adjustData.adjustment}` : adjustData.adjustment || '±0'}
                  </div>
                  <div className="w-8 h-px bg-border" />
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{t('stock.newQuantity')}</p>
                  <p className={`text-2xl font-bold tabular-nums leading-tight ${
                    selectedItem.quantity + adjustData.adjustment < 0 ? 'text-red-500' : 'text-foreground'
                  }`}>
                    {Math.max(0, selectedItem.quantity + adjustData.adjustment)}
                  </p>
                </div>
              </div>
            )}

            {/* Adjustment input with ± buttons */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">{t('stock.adjustment')}</Label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAdjustData(d => ({ ...d, adjustment: d.adjustment - 1 }))}
                  className="h-8 w-8 rounded border border-border bg-background hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors font-bold text-base flex-shrink-0"
                >−</button>
                <Input
                  type="number"
                  value={adjustData.adjustment ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const parsed = raw === '' ? undefined : Number(raw);
                    setAdjustData({ ...adjustData, adjustment: typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined });
                  }}
                  placeholder="0"
                  className="h-8 text-center text-sm font-semibold tabular-nums flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => setAdjustData(d => ({ ...d, adjustment: d.adjustment + 1 }))}
                  className="h-8 w-8 rounded border border-border bg-background hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors font-bold text-base flex-shrink-0"
                >+</button>
              </div>
            </div>

            {/* Quick presets */}
            <div className="flex gap-1.5 flex-wrap">
              {[-10, -5, -1, +1, +5, +10].map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAdjustData(d => ({ ...d, adjustment: d.adjustment + v }))}
                  className={`h-6 px-2 rounded text-[11px] font-semibold border transition-colors ${
                    v > 0
                      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15'
                      : 'border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400 hover:bg-red-500/15'
                  }`}
                >
                  {v > 0 ? `+${v}` : v}
                </button>
              ))}
            </div>

            {/* Reason */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">{t('stock.reason')}</Label>
              <Select value={adjustData.reason} onValueChange={(value) => setAdjustData({ ...adjustData, reason: value })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale">{t('stock.reasonSold')}</SelectItem>
                  <SelectItem value="purchase">{t('stock.reasonReceived')}</SelectItem>
                  <SelectItem value="return">{t('stock.reasonReturned')}</SelectItem>
                  <SelectItem value="damage">{t('stock.reasonDamaged')}</SelectItem>
                  <SelectItem value="stocktake">{t('stock.reasonAdjustment')}</SelectItem>
                  <SelectItem value="adjustment">{t('stock.reasonOther')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">{t('stock.notes')}</Label>
              <Textarea
                value={adjustData.notes}
                onChange={(e) => setAdjustData({ ...adjustData, notes: e.target.value })}
                placeholder={t('stock.additionalNotes')}
                rows={2}
                className="text-xs resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-muted/20">
            <Button variant="outline" size="sm" className="h-8 text-xs flex-1" onClick={() => setShowAdjustModal(false)}>
              {t('cancel')}
            </Button>
            <Button size="sm" className="h-8 text-xs flex-1 bg-primary hover:bg-primary/90 text-white" onClick={handleAdjustQuantity}>
              {t('stock.applyAdjustment')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={showHistoryModal} onOpenChange={(open) => {
        if (!open) {
          setShowHistoryModal(false);
          setSelectedItem(null);
          setStockHistory([]);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('stock.history')}</DialogTitle>
            <DialogDescription>
              {selectedItem && `${t('stock.historyFor')}: ${selectedItem.name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto max-h-96">
            {stockHistory.length === 0 ? (
              <p className="text-center py-4 md:py-6 text-muted-foreground">{t('stock.noHistory')}</p>
            ) : (
              <div className="space-y-4">
                {stockHistory.map((record) => (
                  <div key={record.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <Badge variant="outline">{record.reason.replace('_', ' ')}</Badge>
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(record.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${record.adjustment >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {record.adjustment >= 0 ? '+' : ''}{record.adjustment}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {record.quantity_before} → {record.quantity_after}
                        </p>
                      </div>
                    </div>
                    {record.notes && (
                      <p className="text-sm mt-2 text-muted-foreground">{record.notes}</p>
                    )}
                    {record.adjusted_by_name && (
                      <p className="text-xs text-muted-foreground mt-1">
                        By: {record.adjusted_by_name}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('stock.deleteProduct')}?</AlertDialogTitle>
            <AlertDialogDescription>
              {t('stock.deleteConfirm')} "{selectedItem?.name}"
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStock} className="bg-red-600 hover:bg-red-700">
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category Management Modal */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="max-w-md bg-gradient-to-br from-background via-background to-primary/5 dark:from-slate-950 dark:to-slate-900/30">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" /> {t('stock.manageCategories')}
            </DialogTitle>
            <DialogDescription>
              {t('stock.categoriesDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Create new category */}
            <div className="space-y-2">
              <Label className="font-bold">{t('stock.createCategory')}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={t('stock.categoryName')}
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      createCategory();
                    }
                  }}
                />
                <Button 
                  onClick={createCategory}
                  disabled={!newCategoryName.trim() || creatingCategory}
                  className="bg-primary"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t('stock.add')}
                </Button>
              </div>
            </div>

            {/* Categories list */}
            <div className="space-y-2">
              <Label className="font-bold">{t('stock.categories')} ({allCategories.length})</Label>
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {allCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('stock.noCategories')}
                  </p>
                ) : (
                  allCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {cat.sample_image ? (
                          <img 
                            src={cat.sample_image} 
                            alt={cat.name}
                            className="w-10 h-10 rounded-lg object-cover border border-primary/20"
                          />
                        ) : (
                          <span className="text-xl w-10 h-10 flex items-center justify-center bg-primary/10 rounded-lg">{cat.icon}</span>
                        )}
                        <div>
                          <p className="font-medium">{cat.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {cat.product_count} product{cat.product_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteCategory(cat.id)}
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryModal(false)}>
              {t('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
