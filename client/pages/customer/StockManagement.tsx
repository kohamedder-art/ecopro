import { useState, useEffect } from 'react';
import { 
  Plus, Search, Filter, PackageX, Package, AlertTriangle, 
  TrendingDown, TrendingUp, Edit, Trash2, History, Download,
  BarChart3, RefreshCw, Tag, X, Check
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
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';

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
  const [activeFormSection, setActiveFormSection] = useState<'product' | 'variants' | 'price' | 'shipping' | 'images' | 'notes'>('product');
  const [adjustData, setAdjustData] = useState({
    adjustment: 0,
    reason: 'adjustment',
    notes: '',
  });

  const [variantsDraft, setVariantsDraft] = useState<StockVariantDraft[]>([]);
  const [variantsLoaded, setVariantsLoaded] = useState(false);
  const [variantsDirty, setVariantsDirty] = useState(false);
  const [loadingVariants, setLoadingVariants] = useState(false);

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
        await loadStock();
        setShowAddModal(false);
        setFormData({});
        setVariantsDraft([]);
        setVariantsLoaded(false);
        setVariantsDirty(false);
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
        await loadStock();
        setShowEditModal(false);
        setSelectedItem(null);
        setFormData({});
        setVariantsDraft([]);
        setVariantsLoaded(false);
        setVariantsDirty(false);
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
    });
    setActiveFormSection('product');
    setVariantsDraft([]);
    setVariantsLoaded(false);
    setVariantsDirty(false);
    setShowEditModal(true);

    // Load variants in background
    loadStockVariants(item.id);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/30 p-3 md:p-4">
      <div className="max-w-7xl mx-auto space-y-2 md:space-y-3">
        {/* Header with Gradient */}
        <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-primary/10 to-purple-600/10 dark:from-primary/5 dark:to-purple-600/5 rounded-lg border border-primary/20 p-3">
          <div>
            <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              {t('stock.title')}
            </h1>
            <p className="text-muted-foreground text-base font-semibold">{t('stock.subtitle')}</p>
            <div className="mt-2 rounded-md border border-primary/20 bg-background/70 dark:bg-slate-900/30 px-3 py-2 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground">{t('stock.hints.headerTitle')}</div>
              <div className="mt-1">{t('stock.hints.headerDesc')}</div>
            </div>
          </div>
          <div className="flex gap-1 md:gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowCategoryModal(true)}
              className="border-primary/30 hover:bg-primary/10 transition-all gap-1 text-sm font-bold py-2 px-3 h-9"
            >
              <Tag className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">{t('stock.categories')}</span>
            </Button>
            <Button 
              variant="outline" 
              onClick={exportToCSV}
              className="border-primary/30 hover:bg-primary/10 transition-all gap-1 text-sm font-bold py-2 px-3 h-9"
            >
              <Download className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">{t('stock.export')}</span>
            </Button>
            <Button 
              onClick={() => {
                setFormData({
                  name: '',
                  description: '',
                  category: '',
                  quantity: 0,
                  unit_price: undefined,
                  reorder_level: 10,
                  shipping_mode: 'delivery_pricing',
                  shipping_flat_fee: null,
                  images: [],
                  notes: '',
                });
                setActiveFormSection('product');
                setVariantsDraft([]);
                setVariantsLoaded(false);
                setVariantsDirty(false);
                setShowAddModal(true);
              }}
              className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all gap-1 text-base font-bold py-2 px-4 h-10"
            >
              <Plus className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">{t('store.createProduct') || t('stock.addNewProduct') || t('stock.add')}</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards with Gradients - Compact */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 dark:from-blue-900/20 dark:to-blue-900/5 rounded border border-blue-500/30 p-2 md:p-3 hover:border-blue-500/50 transition-all hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium truncate">{t('stock.items')}</p>
                <p className="text-lg md:text-xl font-bold text-blue-600 dark:text-blue-400">{stock.length}</p>
              </div>
              <div className="bg-blue-500/20 dark:bg-blue-500/10 p-2 rounded flex-shrink-0">
                <Package className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 dark:from-orange-900/20 dark:to-orange-900/5 rounded border border-orange-500/30 p-2 md:p-3 hover:border-orange-500/50 transition-all hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium truncate">{t('stock.lowStock')}</p>
                <p className="text-lg md:text-xl font-bold text-orange-600 dark:text-orange-400">{lowStockCount}</p>
              </div>
              <div className="bg-orange-500/20 dark:bg-orange-500/10 p-2 rounded flex-shrink-0">
                <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-orange-500" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 dark:from-emerald-900/20 dark:to-emerald-900/5 rounded border border-emerald-500/30 p-2 md:p-3 hover:border-emerald-500/50 transition-all hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium truncate">{t('stock.totalValue')}</p>
                <p className="text-lg md:text-xl font-bold text-emerald-600 dark:text-emerald-400">{Math.round(totalValue)}</p>
              </div>
              <div className="bg-emerald-500/20 dark:bg-emerald-500/10 p-2 rounded flex-shrink-0">
                <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 dark:from-red-900/20 dark:to-red-900/5 rounded border border-red-500/30 p-2 md:p-3 hover:border-red-500/50 transition-all hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium truncate">{t('stock.outOfStock')}</p>
                <p className="text-lg md:text-xl font-bold text-red-600 dark:text-red-400">
                  {stock.filter(i => i.status === 'out_of_stock').length}
                </p>
              </div>
              <div className="bg-red-500/20 dark:bg-red-500/10 p-2 rounded flex-shrink-0">
                <PackageX className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gradient-to-r from-primary/5 to-purple-600/5 dark:from-slate-800/50 dark:to-slate-800/30 rounded border border-primary/20 p-2 md:p-3 backdrop-blur-sm">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="flex-1 min-w-[150px]">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
                <Input
                  placeholder={t('stock.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 border-primary/30 focus:border-primary/60 transition-colors h-9 text-base"
                />
              </div>
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-[140px] border-primary/30 focus:border-primary/60 h-8 text-sm">
                <SelectValue placeholder={t('stock.category')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('stock.allCategories')}</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={showLowStock ? 'default' : 'outline'}
              onClick={() => setShowLowStock(!showLowStock)}
              className={showLowStock ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg' : 'border-primary/30 hover:bg-primary/10'}
              size="sm"
            >
              <Filter className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden md:inline ml-1 text-xs">{t('stock.low')}</span>
            </Button>

            <Button 
              variant="outline" 
              onClick={loadStock}
              className="border-primary/30 hover:bg-primary/10"
              size="sm"
            >
              <RefreshCw className="w-3 h-3 md:w-4 md:h-4" />
            </Button>
          </div>
        </div>

        {/* Stock Table */}
        <div className="bg-gradient-to-br from-background to-primary/5 dark:from-slate-900/50 dark:to-slate-800/30 rounded border border-primary/20 overflow-hidden shadow">
          <div className="overflow-x-auto">
            <table className="w-full text-base font-semibold table-fixed">
              <thead className="bg-gradient-to-r from-primary/15 to-purple-600/15 dark:from-primary/10 dark:to-purple-600/10 border-b border-primary/20">
                <tr>
                  <th className="text-left p-2 font-bold text-primary dark:text-primary/90 text-sm whitespace-nowrap w-[180px]">{t('stock.product')}</th>
                  <th className="text-center p-2 font-bold text-primary dark:text-primary/90 text-sm whitespace-nowrap w-[80px]">{t('stock.category')}</th>
                  <th className="text-center p-2 font-bold text-primary dark:text-primary/90 text-sm whitespace-nowrap w-[70px]">{t('stock.qty')}</th>
                  <th className="text-right p-2 font-bold text-primary dark:text-primary/90 text-sm whitespace-nowrap w-[70px]">{t('stock.price')}</th>
                  <th className="text-right p-2 font-bold text-primary dark:text-primary/90 text-sm whitespace-nowrap w-[140px]">{t('stock.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4 md:py-6 text-muted-foreground">
                      <Package className="w-6 h-6 mx-auto opacity-50 mb-2" />
                      <p className="text-base font-semibold">
                        {searchQuery || categoryFilter !== 'all'
                          ? t('stock.noProductsMatch')
                          : t('stock.noStockItems')}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredStock.map(item => (
                    <tr key={item.id} className="border-b border-primary/10 hover:bg-primary/10 dark:hover:bg-primary/5 transition-colors">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          {item.images?.[0] ? (
                            <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0">
                              <img
                                src={item.images[0]}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-muted/40 flex items-center justify-center flex-shrink-0 text-xs text-muted-foreground">
                              📦
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate max-w-[100px]">{item.name}</p>
                            {item.is_low_stock && (
                              <Badge className="bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30 text-[10px] py-0 px-1">
                                <AlertTriangle className="w-2 h-2 mr-0.5" />
                                Low
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-2 text-center">
                        {item.category && (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px] py-0 px-1">{item.category}</Badge>
                        )}
                      </td>
                      <td className="p-2 text-center font-semibold text-sm">
                        <span className={item.is_low_stock ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}>
                          {item.quantity}
                        </span>
                        <span className="text-[10px] text-muted-foreground">/{item.reorder_level}</span>
                      </td>
                      <td className="p-2 text-right font-medium text-sm">
                        {item.unit_price ? Math.round(Number(item.unit_price)) : '-'}
                      </td>
                      <td className="p-2 md:p-3 sticky right-0 bg-background dark:bg-slate-900">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openAdjustModal(item)}
                            title="Adjust Quantity"
                            className="h-8 w-8"
                          >
                            <TrendingUp className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openHistoryModal(item)}
                            title="View History"
                            className="h-8 w-8"
                          >
                            <History className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditModal(item)}
                            title="Edit"
                            className="h-8 w-8"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openDeleteDialog(item)}
                            title="Delete"
                            className="h-8 w-8"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
                  { key: 'product', label: 'Product' },
                  { key: 'variants', label: 'Variants' },
                  { key: 'price', label: 'Price' },
                  { key: 'shipping', label: 'Shipping' },
                  { key: 'images', label: 'Images' },
                  { key: 'notes', label: 'Notes' },
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
                <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                  {t('stock.basicInfo')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="name" className="text-base font-bold">{t('stock.productName')}</Label>
                    <Input
                      id="name"
                      value={formData.name || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder={t('stock.productName')}
                      className="border-primary/30 focus:border-primary/60 transition-colors h-9 text-base"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('stock.hints.name')}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="description" className="text-base font-bold">{t('stock.description')}</Label>
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
                  <Label htmlFor="category" className="text-base font-bold flex items-center gap-2">
                    <Tag className="w-4 h-4" /> {t('stock.category')}
                  </Label>
                  <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between border-primary/30 hover:border-primary/60 h-9 text-base font-normal"
                      >
                        {formData.category || t('stock.selectCategory')}
                        <Tag className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <div className="p-2 border-b">
                        <div className="flex gap-2">
                          <Input
                            placeholder={t('stock.newCategoryName')}
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            className="h-8 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                createCategory();
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            onClick={createCategory}
                            disabled={!newCategoryName.trim() || creatingCategory}
                            className="h-8 px-2"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto p-1">
                        {allCategories.length === 0 && categories.length === 0 ? (
                          <p className="text-sm text-muted-foreground p-2 text-center">
                            {t('stock.noCategories')}
                          </p>
                        ) : (
                          <>
                            {allCategories.map((cat) => (
                              <div
                                key={cat.id}
                                className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-primary/10 ${
                                  formData.category === cat.name ? 'bg-primary/20' : ''
                                }`}
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, category: cat.name }));
                                  setCategoryPopoverOpen(false);
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <span>{cat.icon}</span>
                                  <span className="text-sm font-medium">{cat.name}</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {cat.product_count}
                                  </Badge>
                                </div>
                                {formData.category === cat.name && (
                                  <Check className="w-4 h-4 text-primary" />
                                )}
                              </div>
                            ))}
                            {categories
                              .filter(c => !allCategories.some(ac => ac.name === c))
                              .map((cat) => (
                                <div
                                  key={cat}
                                  className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-primary/10 ${
                                    formData.category === cat ? 'bg-primary/20' : ''
                                  }`}
                                  onClick={() => {
                                    setFormData(prev => ({ ...prev, category: cat }));
                                    setCategoryPopoverOpen(false);
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <span>📦</span>
                                    <span className="text-sm font-medium">{cat}</span>
                                  </div>
                                  {formData.category === cat && (
                                    <Check className="w-4 h-4 text-primary" />
                                  )}
                                </div>
                              ))}
                          </>
                        )}
                      </div>
                      {formData.category && (
                        <div className="border-t p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-muted-foreground"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, category: '' }));
                              setCategoryPopoverOpen(false);
                            }}
                          >
                            <X className="w-4 h-4 mr-2" /> {t('stock.clearCategory')}
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {activeFormSection === 'variants' && (
              <div className="space-y-2 bg-indigo-500/5 dark:bg-indigo-900/10 p-2 md:p-3 rounded border border-indigo-500/20">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-indigo-600 dark:text-indigo-400">Variants (Size / Color)</h3>
                    <p className="text-sm text-muted-foreground">
                      Optional. If you add variants, total stock quantity is automatically the sum of active variant stock.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('stock.hints.variants')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setVariantsDraft((prev) => [
                        ...prev,
                        {
                          color: '',
                          size: '',
                          variant_name: '',
                          price: undefined,
                          stock_quantity: 0,
                          is_active: true,
                          sort_order: prev.length,
                        },
                      ]);
                      setVariantsLoaded(true);
                      setVariantsDirty(true);
                    }}
                  >
                    Add Variant
                  </Button>
                </div>

                {loadingVariants && <div className="text-sm text-muted-foreground">Loading variants…</div>}

                {!loadingVariants && variantsLoaded && variantsDraft.length === 0 && (
                  <div className="text-sm text-muted-foreground">No variants added.</div>
                )}

                {variantsDraft.length > 0 && (
                  <div className="space-y-2">
                    {variantsDraft
                      .slice()
                      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
                      .map((v, idx) => (
                        <div key={v.id ?? `new-${idx}`} className="grid grid-cols-12 gap-2 items-end border rounded p-2 bg-background/50">
                          <div className="col-span-4">
                            <Label className="text-xs">Color</Label>
                            <Input
                              value={v.color || ''}
                              onChange={(e) => {
                                const next = e.target.value;
                                setVariantsDraft((prev) =>
                                  prev.map((x) => (x === v ? { ...x, color: next } : x))
                                );
                                setVariantsDirty(true);
                              }}
                              className="h-9"
                              placeholder="e.g. Red"
                            />
                          </div>
                          <div className="col-span-4">
                            <Label className="text-xs">Size</Label>
                            <Input
                              value={v.size || ''}
                              onChange={(e) => {
                                const next = e.target.value;
                                setVariantsDraft((prev) =>
                                  prev.map((x) => (x === v ? { ...x, size: next } : x))
                                );
                                setVariantsDirty(true);
                              }}
                              className="h-9"
                              placeholder="e.g. M"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Stock</Label>
                            <Input
                              type="number"
                              min={0}
                              value={Number(v.stock_quantity ?? 0)}
                              onChange={(e) => {
                                const next = Math.max(0, parseInt(e.target.value) || 0);
                                setVariantsDraft((prev) =>
                                  prev.map((x) => (x === v ? { ...x, stock_quantity: next } : x))
                                );
                                setVariantsDirty(true);
                              }}
                              className="h-9"
                            />
                          </div>
                          <div className="col-span-2 flex gap-2 justify-end">
                            <Button
                              type="button"
                              variant={v.is_active === false ? 'outline' : 'default'}
                              size="sm"
                              className="h-9"
                              onClick={() => {
                                setVariantsDraft((prev) =>
                                  prev.map((x) => (x === v ? { ...x, is_active: !(x.is_active ?? true) } : x))
                                );
                                setVariantsDirty(true);
                              }}
                            >
                              {v.is_active === false ? 'Off' : 'On'}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9"
                              onClick={() => {
                                setVariantsDraft((prev) => prev.filter((x) => x !== v));
                                setVariantsDirty(true);
                              }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {activeFormSection === 'price' && (
              <div className="space-y-2 bg-amber-500/5 dark:bg-amber-900/10 p-2 md:p-3 rounded border border-amber-500/20">
                <h3 className="text-lg font-bold text-amber-600 dark:text-amber-400">Price & Inventory</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="quantity" className="text-base font-bold">{t('stock.quantity')}</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={formData.quantity ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '') {
                          setFormData(prev => ({ ...prev, quantity: undefined }));
                          return;
                        }

                        const n = Number.parseInt(v, 10);
                        setFormData(prev => ({
                          ...prev,
                          quantity: Number.isNaN(n) ? undefined : Math.max(0, n),
                        }));
                      }}
                      min="0"
                      className="border-amber-500/30 focus:border-amber-500/60 transition-colors h-9 text-base"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('stock.hints.quantity')}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="unit_price" className="text-base font-bold">{t('stock.unitPrice')}</Label>
                    <Input
                      id="unit_price"
                      type="number"
                      step="0.01"
                      value={formData.unit_price || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        const n = Number(v);
                        setFormData(prev => ({ ...prev, unit_price: v === '' || Number.isNaN(n) ? undefined : n }));
                      }}
                      min="0"
                      className="border-amber-500/30 focus:border-amber-500/60 transition-colors h-9 text-base"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="reorder_level" className="text-base font-bold">{t('stock.reorderLevel')}</Label>
                    <Input
                      id="reorder_level"
                      type="number"
                      value={formData.reorder_level ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '') {
                          setFormData(prev => ({ ...prev, reorder_level: undefined }));
                          return;
                        }

                        const n = Number.parseInt(v, 10);
                        setFormData(prev => ({
                          ...prev,
                          reorder_level: Number.isNaN(n) ? undefined : Math.max(0, n),
                        }));
                      }}
                      min="0"
                      className="border-amber-500/30 focus:border-amber-500/60 transition-colors h-9 text-base"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('stock.hints.reorder')}
                    </p>
                  </div>
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
                      <SelectContent>
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
                        value={formData.shipping_flat_fee ?? 0}
                        onChange={(e) => setFormData(prev => ({ ...prev, shipping_flat_fee: parseFloat(e.target.value) || 0 }))}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('stock.adjustQuantity')}</DialogTitle>
            <DialogDescription>
              {selectedItem && `${t('stock.currentQuantity')}: ${selectedItem.quantity}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="adjustment">{t('stock.adjustment')}</Label>
              <Input
                id="adjustment"
                type="number"
                value={adjustData.adjustment}
                onChange={(e) => setAdjustData({ ...adjustData, adjustment: parseInt(e.target.value) || 0 })}
                placeholder={t('stock.adjustment')}
              />
              {selectedItem && (
                <p className="text-sm text-muted-foreground">
                  {t('stock.newQuantity')}: {selectedItem.quantity + adjustData.adjustment}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">{t('stock.reason')}</Label>
              <Select
                value={adjustData.reason}
                onValueChange={(value) => setAdjustData({ ...adjustData, reason: value })}
              >
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label htmlFor="adjust_notes">{t('stock.notes')}</Label>
              <Textarea
                id="adjust_notes"
                value={adjustData.notes}
                onChange={(e) => setAdjustData({ ...adjustData, notes: e.target.value })}
                placeholder={t('stock.additionalNotes')}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustModal(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleAdjustQuantity}>
              {t('stock.applyAdjustment')}
            </Button>
          </DialogFooter>
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
