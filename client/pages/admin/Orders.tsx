import React, { useEffect, useState, useRef } from "react";
import { MoreHorizontal, Download, ShoppingBag, TrendingUp, Plus, Settings, X, Trash2, Truck, CheckSquare, Square, Upload, ChevronRight, Search, Copy, Check, StickyNote, AlertTriangle, Bell, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/lib/i18n";
import { OrderFulfillment } from "@/components/delivery/OrderFulfillment";
import { RiskAlert } from "@/components/orders/RiskAlert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getAlgeriaCommunesByWilayaId, getAlgeriaWilayas } from "@/lib/algeriaGeo";

interface DeliveryCompany {
  id: number;
  name: string;
  features: any;
  is_active: boolean;
  is_configured?: boolean;
  has_api_key?: boolean;
}

interface OrderStatus {
  id: string | number;
  name: string;
  key: string; // English key like 'confirmed', 'completed' - REQUIRED
  color: string;
  icon: string;
  sort_order: number;
  is_default: boolean;
  is_system?: boolean;
  counts_as_revenue?: boolean;
}

export default function OrdersAdmin() {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [showStatusManager, setShowStatusManager] = useState(false);
  const [customStatuses, setCustomStatuses] = useState<OrderStatus[]>([]);
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#6b7280');
  const [newStatusIcon, setNewStatusIcon] = useState('●');
  const [newStatusCountsAsRevenue, setNewStatusCountsAsRevenue] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<string>('all');
  const [timeUpdate, setTimeUpdate] = useState<number>(0); // For triggering time updates
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 20;
  
  // Bulk selection states
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [deliveryCompanies, setDeliveryCompanies] = useState<DeliveryCompany[]>([]);
  const [selectedDeliveryCompany, setSelectedDeliveryCompany] = useState<number | null>(null);
  const [generateLabels, setGenerateLabels] = useState(true);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkUploadResult, setBulkUploadResult] = useState<{ successCount: number; failCount: number; results: any[] } | null>(null);

  // Search & date filter
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Copy-to-clipboard flash state: key = `phone|id` + value
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    });
  };

  // Order notes (in-memory per session, keyed by raw_id)
  const [orderNotes, setOrderNotes] = useState<Record<number, string>>({});

  // New-order notification banner
  const [newOrderCount, setNewOrderCount] = useState(0);
  const prevOrderCountRef = useRef<number>(0);

  // Order editing (store owner)
  const [showEditOrder, setShowEditOrder] = useState(false);
  const [editOrder, setEditOrder] = useState<any | null>(null);
  const [deliveryOrder, setDeliveryOrder] = useState<any | null>(null);
  const [editVariants, setEditVariants] = useState<any[]>([]);
  const [loadingEditVariants, setLoadingEditVariants] = useState(false);
  const [savingEditOrder, setSavingEditOrder] = useState(false);
  const [editForm, setEditForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    shipping_address: '',
    shipping_wilaya_id: '',
    shipping_commune_id: '',
    shipping_hai: '',
    delivery_type: 'home' as 'home' | 'desk',
    quantity: 1,
    variant_id: '' as string,
  });

  const dzWilayas = getAlgeriaWilayas();
  const dzCommunesForEdit = getAlgeriaCommunesByWilayaId(editForm.shipping_wilaya_id);

  const selectedDeliveryCompanyData = deliveryCompanies.find(c => c.id === selectedDeliveryCompany) || null;
  const isNoestSelected = String(selectedDeliveryCompanyData?.name || '').trim().toLowerCase() === 'noest';
  const isDhdSelected = String(selectedDeliveryCompanyData?.name || '').trim().toLowerCase().includes('dhd');
  const canGenerateLabels = Boolean(
    (selectedDeliveryCompanyData as any)?.features?.labels ??
    (selectedDeliveryCompanyData as any)?.features?.supports_labels
  ) || isNoestSelected || isDhdSelected;
  
  const [newOrder, setNewOrder] = useState({
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    total_price: '',
  });

  const customerNames = {
    ar: [
      'Ahmed Mohammed', 'Fatima Ali', 'Mahmoud Sara', 'Layla Hassan', 'Salim Omar',
      'Noureddine', 'Zeinab Ahmed', 'Karim Hussein', 'Sara Mostafa', 'Yasser Mahmoud',
      'Rania Khaled', 'Omar Farouk', 'Mona Saeed', 'Tarek Gamal', 'Huda Kamal'
    ],
    en: [
      'Ahmed Mohamed', 'Fatima Ali', 'Mahmoud Sarah', 'Leila Hassan', 'Salim Omar',
      'Nour Eddine', 'Zainab Ahmed', 'Karim Hussein', 'Sarah Mustafa', 'Yasser Mahmoud',
      'Rania Khaled', 'Omar Farouk', 'Mona Saeed', 'Tarek Jamal', 'Hoda Kamal'
    ],
    fr: [
      'Ahmed Mohamed', 'Fatima Ali', 'Mahmoud Sarah', 'Leila Hassan', 'Salim Omar',
      'Nour Eddine', 'Zeinab Ahmed', 'Karim Hussein', 'Sara Mustafa', 'Yasser Mahmoud',
      'Rania Khaled', 'Omar Farouk', 'Mona Saeed', 'Tarek Jamal', 'Hoda Kamal'
    ]
  };

  // Delete order handler
  const handleDeleteOrder = async (orderId: number) => {
    if (!window.confirm('Are you sure you want to delete this order? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/client/orders/${orderId}`, { method: 'DELETE' });
      if (res.ok) {
        await loadOrders();
      } else {
        alert('Failed to delete order');
      }
    } catch (error) {
      alert('Error deleting order');
    }
  };

  // Parse database timestamp as UTC (PostgreSQL stores without timezone indicator)
  const parseUTCDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    // If already has timezone indicator, parse directly
    if (dateStr.includes('Z') || dateStr.includes('+') || dateStr.includes('-')) {
      return new Date(dateStr);
    }
    // Otherwise, append Z to treat as UTC
    return new Date(dateStr.replace(' ', 'T') + 'Z');
  };

  const getTimeStr = (minutes: number) => {
    if (minutes < 60) {
      return t('orders.time.minutes').replace('{n}', minutes.toString());
    } else if (minutes === 60) {
      return t('orders.time.hour');
    } else {
      const hours = Math.floor(minutes / 60);
      return hours === 1 
        ? t('orders.time.hour')
        : t('orders.time.hours').replace('{n}', hours.toString());
    }
  };

  // Filter orders based on selected tab (uses English key)
  const getFilteredOrders = () => {
    let result = orders;

    // Status / tab filter
    if (filterTab === 'archived') {
      result = result.filter(o => o.status === 'failed' || o.status === 'cancelled' || o.status === 'fake' || o.status === 'duplicate');
    } else if (filterTab !== 'all') {
      result = result.filter(o => o.status === filterTab);
    }

    // Date range filter
    if (dateRange !== 'all') {
      const now = Date.now();
      const cutoff =
        dateRange === 'today' ? now - 86400000 :
        dateRange === 'week'  ? now - 7 * 86400000 :
        now - 30 * 86400000;
      result = result.filter(o => parseUTCDate(o.created_at).getTime() >= cutoff);
    }

    // Search filter (customer, phone, order id, product title)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(o =>
        (o.customer || '').toLowerCase().includes(q) ||
        (o.phone || '').toLowerCase().includes(q) ||
        (o.id || '').toLowerCase().includes(q) ||
        (o.product_title || '').toLowerCase().includes(q)
      );
    }

    return result;
  };

  // Duplicate phone detection (phones appearing more than once across ALL orders)
  const duplicatePhones = (() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => { if (o.phone) counts[o.phone] = (counts[o.phone] || 0) + 1; });
    return new Set(Object.entries(counts).filter(([, v]) => v > 1).map(([k]) => k));
  })();

  // CSV export
  const exportCSV = () => {
    const rows = getFilteredOrders();
    const headers = ['Order ID', 'Customer', 'Phone', 'Product', 'Qty', 'Total (DZD)', 'Status', 'Date'];
    const lines = [headers.join(','), ...rows.map(o => [
      o.id, `"${o.customer || ''}"`, o.phone || '', `"${o.product_title || ''}"`,
      o.quantity, Math.round(Number(o.total) || 0), o.status,
      new Date(parseUTCDate(o.created_at)).toLocaleDateString()
    ].join(','))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `orders-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Get paginated orders
  const getPaginatedOrders = () => {
    const filtered = getFilteredOrders();
    const startIndex = (currentPage - 1) * ordersPerPage;
    const endIndex = startIndex + ordersPerPage;
    return filtered.slice(startIndex, endIndex);
  };

  // Calculate pagination info
  const totalFilteredOrders = getFilteredOrders().length;
  const totalPages = Math.ceil(totalFilteredOrders / ordersPerPage);
  const startOrder = totalFilteredOrders === 0 ? 0 : (currentPage - 1) * ordersPerPage + 1;
  const endOrder = Math.min(currentPage * ordersPerPage, totalFilteredOrders);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterTab]);

  // Load custom statuses
  const loadStatuses = async () => {
    try {
      const res = await fetch('/api/client/order-statuses');
      if (res.ok) {
        const data = await res.json();
        setCustomStatuses(data);
      }
    } catch (error) {
      console.error('Failed to load statuses:', error);
    }
  };

  // Load delivery companies with integration status
  const loadDeliveryCompanies = async () => {
    try {
      const res = await fetch('/api/delivery/companies');
      if (res.ok) {
        const data = await res.json();
        setDeliveryCompanies(data);
        // Auto-select first configured company
        const configuredCompany = data.find((c: DeliveryCompany) => c.is_configured && c.has_api_key);
        if (configuredCompany) {
          setSelectedDeliveryCompany(configuredCompany.id);
        } else if (data.length > 0) {
          // Fallback to first company (will be disabled anyway)
          setSelectedDeliveryCompany(null);
        }
      }
    } catch (error) {
      console.error('Failed to load delivery companies:', error);
    }
  };

  // Toggle single order selection
  const toggleOrderSelection = (rawId: number) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(rawId)) {
      newSelected.delete(rawId);
    } else {
      newSelected.add(rawId);
    }
    setSelectedOrders(newSelected);
  };

  // Select all orders in current filter
  const selectAllFiltered = () => {
    const filtered = getFilteredOrders();
    const allRawIds = filtered.map(o => o.raw_id);
    const allSelected = allRawIds.every(id => selectedOrders.has(id));
    
    if (allSelected) {
      // Deselect all filtered
      const newSelected = new Set(selectedOrders);
      allRawIds.forEach(id => newSelected.delete(id));
      setSelectedOrders(newSelected);
    } else {
      // Select all filtered
      const newSelected = new Set(selectedOrders);
      allRawIds.forEach(id => newSelected.add(id));
      setSelectedOrders(newSelected);
    }
  };

  // Clear all selections
  const clearSelection = () => {
    setSelectedOrders(new Set());
  };

  // Bulk upload to delivery company
  const handleBulkUpload = async () => {
    if (selectedOrders.size === 0 || !selectedDeliveryCompany) return;
    
    setBulkUploading(true);
    setBulkUploadResult(null);
    
    try {
      const res = await fetch('/api/delivery/orders/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_ids: Array.from(selectedOrders),
          delivery_company_id: selectedDeliveryCompany,
          generate_labels: generateLabels
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setBulkUploadResult({
          successCount: data.successCount,
          failCount: data.failCount,
          results: data.results
        });
        // Reload orders to reflect changes
        await loadOrders();
        // Clear selection after successful upload
        if (data.failCount === 0) {
          setSelectedOrders(new Set());
        }
      } else {
        // Show detailed error from server
        setBulkUploadResult({
          successCount: 0,
          failCount: selectedOrders.size,
          results: [{ orderId: 0, success: false, error: data.details || data.error || 'Failed to upload orders' }]
        });
      }
    } catch (error) {
      console.error('Bulk upload failed:', error);
      setBulkUploadResult({
        successCount: 0,
        failCount: selectedOrders.size,
        results: [{ orderId: 0, success: false, error: 'Network error - failed to connect to server' }]
      });
    } finally {
      setBulkUploading(false);
    }
  };

  // Add new custom status
  const handleAddStatus = async () => {
    if (!newStatusName.trim()) return;
    try {
      const res = await fetch('/api/client/order-statuses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newStatusName,
          color: newStatusColor,
          icon: newStatusIcon,
          counts_as_revenue: newStatusCountsAsRevenue
        })
      });
      if (res.ok) {
        await loadStatuses();
        setNewStatusName('');
        setNewStatusColor('#6b7280');
        setNewStatusIcon('●');
        setNewStatusCountsAsRevenue(false);
      }
    } catch (error) {
      console.error('Failed to add status:', error);
    }
  };

  // Delete custom status
  const handleDeleteStatus = async (statusId: string | number) => {
    try {
      const res = await fetch(`/api/client/order-statuses/${statusId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        await loadStatuses();
      }
    } catch (error) {
      console.error('Failed to delete status:', error);
    }
  };

  // Get status display info - uses key to find status, shows translated name
  const getStatusDisplay = (statusKey: string) => {
    // First try to find in custom statuses by key
    const status = customStatuses.find(s => s.key === statusKey);
    if (status) {
      // Use translation if available, fallback to status name
      let translatedName = t(`orders.status.${status.key}`) || status.name;
      // Defensive: some bad keys (null/undefined) may humanize to the literal "Null".
      // If translation produced a literal 'null' or 'Null', prefer the stored name.
      if (typeof translatedName === 'string' && translatedName.trim().toLowerCase() === 'null') {
        translatedName = status.name;
      }
      return { name: translatedName, color: status.color, icon: status.icon };
    }
    // Fallback to built-in statuses with translations
    const builtIn: Record<string, { color: string; icon: string }> = {
      pending: { color: '#eab308', icon: '●' },
      confirmed: { color: '#22c55e', icon: '✓' },
      completed: { color: '#10b981', icon: '✓' },
      processing: { color: '#3b82f6', icon: '◐' },
      shipped: { color: '#8b5cf6', icon: '📦' },
      delivered: { color: '#10b981', icon: '✓' },
      cancelled: { color: '#ef4444', icon: '✕' },
      failed: { color: '#ef4444', icon: '✕' },
      at_delivery: { color: '#8b5cf6', icon: '🚚' },
      no_answer_1: { color: '#f59e0b', icon: '📞' },
      no_answer_2: { color: '#f59e0b', icon: '📞' },
      no_answer_3: { color: '#f59e0b', icon: '📞' },
      waiting_callback: { color: '#3b82f6', icon: '📱' },
      postponed: { color: '#6366f1', icon: '⏰' },
      line_closed: { color: '#6b7280', icon: '📵' },
      fake: { color: '#dc2626', icon: '⚠️' },
      duplicate: { color: '#9ca3af', icon: '📋' },
      returned: { color: '#f97316', icon: '↩️' },
      refunded: { color: '#22c55e', icon: '💰' },
    };
    const info = builtIn[statusKey] || { color: '#6b7280', icon: '●' };
    // Use translation, fallback to formatted key
    const translatedName = t(`orders.status.${statusKey}`) || statusKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return { name: translatedName, color: info.color, icon: info.icon };
  };

  useEffect(()=>{
    loadOrders();
    loadStatuses();
    loadDeliveryCompanies();
  },[]);

  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

  // Quick status update handler
  const updateOrderStatus = async (orderId: number, newStatus: string) => {
    try {
      setUpdatingOrderId(orderId);
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        await loadOrders();
      } else {
        alert('Failed to update order status');
      }
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Error updating order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Poll orders every 30 seconds for near-real-time updates (reduced from 5s for performance)
  useEffect(() => {
    const id = setInterval(async () => {
      const prevCount = prevOrderCountRef.current;
      await loadOrders(true);
      // After load, compare (orders state is stale here — use a callback approach via ref)
    }, 30000); // 30 seconds instead of 5 seconds
    return () => clearInterval(id);
  }, []);

  // Track new orders by comparing order count after silent reload
  useEffect(() => {
    if (prevOrderCountRef.current === 0) {
      prevOrderCountRef.current = orders.length;
      return;
    }
    const diff = orders.length - prevOrderCountRef.current;
    if (diff > 0) {
      setNewOrderCount(prev => prev + diff);
    }
    prevOrderCountRef.current = orders.length;
  }, [orders.length]);

  // Update time display every minute
  useEffect(() => {
    const id = setInterval(() => {
      setTimeUpdate(prev => prev + 1);
    }, 60000); // Update every 60 seconds
    return () => clearInterval(id);
  }, []);

  const loadOrders = async (silent = false) => {
    try {
      if (!silent) {
        setIsRefreshing(true);
        setIsLoading(true);
      }
      setError(null);
      const isStaff = localStorage.getItem('isStaff') === 'true';
      const res = await fetch(isStaff ? '/api/staff/orders' : '/api/client/orders?limit=100', {});

      if (res.status === 401) {
        setError('Authentication failed. Please log in again.');
        setIsLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch orders: ${res.status}`);
      }

      const data = await res.json();
      // Handle both old array format and new paginated object format
      const ordersArray = Array.isArray(data) ? data : (data.orders || []);
      
      // Transform API data to match our format
      const transformedOrders = ordersArray.map((order: any) => {
        // Get first product image from the images array
        let product_image = null;
        if (order.product_images) {
          // product_images comes as PostgreSQL array string like '{url1,url2}' or as actual array
          const images = Array.isArray(order.product_images) 
            ? order.product_images 
            : order.product_images.replace(/^\{|\}$/g, '').split(',').filter(Boolean);
          product_image = images[0] || null;
        }
        
        return {
          id: `ORD-${String(order.id).padStart(3, '0')}`,
          product_id: order.product_id,
          customer: order.customer_name,
          total: order.total_price,
          unit_price: Number(order.unit_price ?? order.product_price ?? 0),
          status: order.status, // Keep the actual status from database
          created_at: order.created_at,
          time: getTimeStr(Math.floor((Date.now() - parseUTCDate(order.created_at).getTime()) / 60000)),
          product_title: order.product_title,
          product_image: product_image,
          quantity: Number(order.quantity ?? 0),
          phone: order.customer_phone,
          email: order.customer_email,
          address: order.shipping_address,
          shipping_wilaya_id: order.shipping_wilaya_id ?? null,
          shipping_commune_id: order.shipping_commune_id ?? null,
          shipping_hai: order.shipping_hai ?? null,
          delivery_type: order.delivery_type ?? 'home',
          delivery_fee: order.delivery_fee ?? null,
          cod_amount: order.cod_amount ?? null,
          variant_id: order.variant_id ?? null,
          variant_color: order.variant_color ?? null,
          variant_size: order.variant_size ?? null,
          variant_name: order.variant_name ?? null,
          raw_id: order.id,
          // Delivery fields
          delivery_company_id: order.delivery_company_id,
          tracking_number: order.tracking_number,
          delivery_status: order.delivery_status,
          shipping_label_url: order.shipping_label_url
        };
      });
      setOrders(transformedOrders);
      setError(null);
    } catch (error) {
      console.error('Failed to load orders:', error);
      setError(error instanceof Error ? error.message : 'Failed to load orders. Please try again.');
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  };

  const openEditModal = async (orderRow: any) => {
    const isStaff = localStorage.getItem('isStaff') === 'true';
    if (isStaff) return;

    setEditOrder(orderRow);
    setEditForm({
      customer_name: String(orderRow.customer || ''),
      customer_phone: String(orderRow.phone || ''),
      customer_email: String(orderRow.email || ''),
      shipping_address: String(orderRow.address || ''),
      shipping_wilaya_id: orderRow.shipping_wilaya_id != null ? String(orderRow.shipping_wilaya_id) : '',
      shipping_commune_id: orderRow.shipping_commune_id != null ? String(orderRow.shipping_commune_id) : '',
      shipping_hai: String(orderRow.shipping_hai || ''),
      delivery_type: (orderRow.delivery_type === 'desk' ? 'desk' : 'home') as any,
      quantity: Number(orderRow.quantity || 1),
      variant_id: orderRow.variant_id != null ? String(orderRow.variant_id) : '',
    });
    setShowEditOrder(true);

    // Load variants for this product (optional)
    setLoadingEditVariants(true);
    try {
      const productId = Number(orderRow.product_id);
      if (Number.isFinite(productId) && productId > 0) {
        const r = await fetch(`/api/client/store/products/${productId}/variants`);
        if (r.ok) {
          const data = await r.json();
          const variants = Array.isArray(data) ? data : (data.variants || []);
          setEditVariants(variants);

          // If the order has no variant set but the product has exactly 1 active variant,
          // default to it to prevent accidental invalid saves.
          const active = (variants || []).filter((v: any) => v?.is_active !== false);
          if (active.length === 1) {
            setEditForm(prev => (prev.variant_id ? prev : { ...prev, variant_id: String(active[0].id) }));
          }
        } else {
          setEditVariants([]);
        }
      } else {
        setEditVariants([]);
      }
    } catch {
      setEditVariants([]);
    } finally {
      setLoadingEditVariants(false);
    }
  };

  const saveOrderEdits = async () => {
    if (!editOrder?.raw_id) return;

    setSavingEditOrder(true);
    try {
      const wilayaId = editForm.shipping_wilaya_id ? Number(editForm.shipping_wilaya_id) : null;
      const communeId = editForm.shipping_commune_id ? Number(editForm.shipping_commune_id) : null;
      const variantId = editForm.variant_id ? Number(editForm.variant_id) : null;

      const payload: any = {
        customer_name: editForm.customer_name,
        customer_phone: editForm.customer_phone,
        customer_email: editForm.customer_email || null,
        shipping_address: editForm.shipping_address || null,
        shipping_wilaya_id: wilayaId && Number.isFinite(wilayaId) ? wilayaId : null,
        shipping_commune_id: communeId && Number.isFinite(communeId) ? communeId : null,
        shipping_hai: editForm.shipping_hai || null,
        delivery_type: editForm.delivery_type,
        quantity: Number(editForm.quantity),
        variant_id: variantId && Number.isFinite(variantId) ? variantId : null,
      };

      const res = await fetch(`/api/client/orders/${editOrder.raw_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.error || 'Failed to update order');
        return;
      }

      await loadOrders(true);
      setShowEditOrder(false);
      setEditOrder(null);
      setEditVariants([]);
    } catch (e) {
      console.error('Save order edits failed:', e);
      alert('Failed to update order');
    } finally {
      setSavingEditOrder(false);
    }
  };

  async function setStatus(id: string, status: string) {
    try {
      setUpdatingOrderId(id as any);
      // Extract raw ID from ORD-XXX format
      const rawId = orders.find(o => o.id === id)?.raw_id;
      if (!rawId) return;

      const isStaff = localStorage.getItem('isStaff') === 'true';

      const res = await fetch(isStaff ? `/api/staff/orders/${rawId}/status` : `/api/client/orders/${rawId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        // Reload orders after status update
        await loadOrders();
      } else {
        alert('Failed to update order status');
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Error updating status');
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function handleAddOrder() {
    try {
      if (!newOrder.customer_name || !newOrder.total_price) {
        alert('Please fill in customer name and total price');
        return;
      }

      const res = await fetch('/api/client/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          total_price: parseFloat(newOrder.total_price),
          customer_name: newOrder.customer_name,
          customer_phone: newOrder.customer_phone || null,
          customer_address: newOrder.customer_address || null,
        })
      });

      if (res.ok) {
        setShowAddOrder(false);
        setNewOrder({ customer_name: '', customer_phone: '', customer_address: '', total_price: '' });
        await loadOrders();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Failed to create order');
      }
    } catch (error) {
      console.error('Error adding order:', error);
      alert('Error creating order');
    }
  }

  return (
    <div className="pt-4">
      {/* Risk Alert for suspicious orders */}
      <RiskAlert 
        onOrderClick={(orderId) => {
          // Find the order in our list and expand it
          const order = orders.find(o => o.raw_id === orderId);
          if (order) {
            setExpandedOrderId(order.id);
          }
        }}
      />

      {/* New orders notification banner */}
      {newOrderCount > 0 && (
        <div
          className="mb-2 flex items-center gap-3 rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2 cursor-pointer hover:bg-green-500/20 transition-colors"
          onClick={() => { setNewOrderCount(0); loadOrders(); setFilterTab('all'); setCurrentPage(1); }}
        >
          <Bell className="h-4 w-4 text-green-600 animate-bounce" />
          <span className="text-sm font-bold text-green-700 dark:text-green-400">
            {newOrderCount} new order{newOrderCount > 1 ? 's' : ''} arrived — click to refresh
          </span>
          <button className="ml-auto text-green-600 hover:text-green-800"><X className="h-4 w-4" /></button>
        </div>
      )}
      
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-2 mb-2 md:mb-3">
        <div className="rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 p-2 md:p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded bg-primary/20">
              <ShoppingBag className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold text-muted-foreground">{t('orders.totalOrders')}</div>
              <div className="text-2xl font-bold">{orders.length}</div>
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 p-2 md:p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded bg-accent/20">
              <TrendingUp className="h-4 w-4 text-accent" />
            </div>
            <div>
              <div className="text-sm font-semibold text-muted-foreground">{t('orders.confirmedOrders')}</div>
              <div className="text-2xl font-bold">{orders.filter(o => o.status === 'confirmed').length}</div>
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-500/5 border border-orange-500/30 p-2 md:p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded bg-orange-500/20">
              <span className="text-lg">💰</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-muted-foreground">{t('orders.revenue')}</div>
              <div className="text-xl font-bold bg-gradient-to-r from-accent to-orange-500 bg-clip-text text-transparent">
                {Math.round(orders
                  .filter(o => {
                    // Get statuses that count as revenue
                    const revenueStatuses = customStatuses
                      .filter(s => s.counts_as_revenue)
                      .map(s => s.key || s.name);
                    // Also include built-in 'completed' status (مكتملة)
                    revenueStatuses.push('completed');
                    return revenueStatuses.includes(o.status);
                  })
                  .reduce((sum, o: any) => {
                    const unit = Number(o.unit_price ?? 0);
                    const qty = Number(o.quantity ?? 0);
                    if (!Number.isFinite(unit) || !Number.isFinite(qty)) return sum;
                    return sum + (unit * qty);
                  }, 0))} DZD
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-lg border border-primary/20 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm shadow overflow-hidden">
        <div className="p-2 md:p-3 border-b border-primary/10">
          <div className="flex items-center justify-between">
            <h3 className="text-base md:text-lg font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              {t('orders.title')}
            </h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => loadOrders()}
                className="inline-flex items-center gap-1 rounded border border-primary/30 bg-background px-3 py-2 text-sm font-bold hover:bg-primary/10 transition-colors disabled:opacity-50 h-9"
                disabled={isRefreshing}
              >
                {isRefreshing ? t('orders.refreshing') : t('orders.refresh')}
              </button>
              <button 
                onClick={() => setShowAddOrder(true)}
                className="inline-flex items-center gap-1 rounded bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-2 text-sm font-bold hover:from-green-600 hover:to-green-700 transition-colors shadow h-9"
              >
                <Plus className="h-4 w-4"/> {t('orders.addOrder')}
              </button>
              <button 
                onClick={() => setShowStatusManager(true)}
                className="inline-flex items-center gap-1 rounded border border-purple-500/30 bg-purple-500/10 text-purple-600 px-3 py-2 text-sm font-bold hover:bg-purple-500/20 transition-colors h-9"
              >
                <Settings className="h-4 w-4"/> {t('orders.statuses')}
              </button>
              <button onClick={exportCSV} className="inline-flex items-center gap-1 rounded border border-primary/30 bg-background px-3 py-2 text-sm font-bold hover:bg-primary/10 transition-colors h-9">
                <Download className="h-4 w-4"/> {t('orders.download')}
              </button>
            </div>
          </div>

          {/* Search + Date Range */}
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search by customer, phone, order ID, product..."
                className="w-full h-9 pl-8 pr-3 rounded border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex gap-1">
              {(['all','today','week','month'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => { setDateRange(r); setCurrentPage(1); }}
                  className={`px-2.5 h-9 rounded text-xs font-bold border transition-colors ${dateRange === r ? 'bg-primary text-white border-primary' : 'bg-background border-border hover:bg-primary/10'}`}
                >
                  {r === 'all' ? 'All' : r === 'today' ? 'Today' : r === 'week' ? '7d' : '30d'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="border-b border-primary/10 bg-gradient-to-r from-muted/30 to-muted/10 p-2 flex gap-1 flex-wrap">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-4 py-2 rounded text-sm font-bold transition-colors h-9 ${
              filterTab === 'all'
                ? 'bg-primary text-white'
                : 'bg-background text-foreground hover:bg-primary/10'
            }`}
          >
            {t('orders.status.all')} ({orders.length})
          </button>
          {customStatuses.map(status => {
            const statusCount = orders.filter(o => o.status === status.key).length;
            const translatedName = t(`orders.status.${status.key}`) || status.name;
            return (
              <button
                key={status.id}
                onClick={() => setFilterTab(status.key)}
                style={{ 
                  backgroundColor: filterTab === status.key ? status.color : undefined,
                  borderColor: status.color 
                }}
                className={`px-4 py-2 rounded text-sm font-bold transition-colors h-9 border ${
                  filterTab === status.key
                    ? 'text-white'
                    : 'bg-background text-foreground hover:opacity-80'
                }`}
              >
                {status.icon} {translatedName} ({statusCount})
              </button>
            );
          })}
          <button
            onClick={() => setFilterTab('archived')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors h-7 ${
              filterTab === 'archived'
                ? 'bg-gray-500 text-white'
                : 'bg-background text-foreground hover:bg-gray-500/10'
            }`}
          >
            {t('orders.status.archived')} ({orders.filter(o => o.status === 'failed' || o.status === 'cancelled' || o.status === 'fake' || o.status === 'duplicate').length})
          </button>
        </div>

        {/* Bulk Selection Toolbar */}
        {selectedOrders.size > 0 && (
          <div className="border-b border-primary/10 bg-gradient-to-r from-blue-500/10 to-blue-500/5 p-2 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-bold text-blue-600">{selectedOrders.size} {selectedOrders.size > 1 ? t('orders.selectedPlural') : t('orders.selected')}</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={clearSelection}
                className="px-3 py-1.5 rounded text-sm font-bold border border-gray-300 bg-background hover:bg-gray-100 transition-colors"
              >
                {t('orders.clear')}
              </button>
              <button
                onClick={() => setShowBulkUpload(true)}
                className="px-4 py-1.5 rounded text-sm font-bold bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-colors shadow flex items-center gap-2"
              >
                <Truck className="h-4 w-4" />
                {t('orders.uploadToDelivery')}
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          {/* Loading State */}
          {isLoading && (
            <div className="p-3 md:p-3 text-center">
              <div className="inline-flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
              <p className="mt-1 md:mt-2 text-muted-foreground text-xs">{t('orders.loadingOrders')}</p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="p-3 md:p-3 text-center">
              <div className="rounded bg-red-500/10 border border-red-500/30 p-2 md:p-3 mb-2">
                <p className="text-red-600 font-semibold text-xs">⚠️ {t('orders.error')}</p>
                <p className="text-red-600 text-xs mt-1">{error}</p>
              </div>
              <button
                onClick={() => loadOrders()}
                className="inline-flex items-center gap-1 rounded bg-primary text-white px-2 py-1 text-xs font-medium hover:bg-primary/90 transition-colors h-8"
              >
                {t('orders.retry')}
              </button>
            </div>
          )}

          {/* Empty State - No Orders At All */}
          {!isLoading && !error && orders.length === 0 && (
            <div className="p-6 md:p-8 text-center">
              <div className="text-lg mb-2">📭</div>
              <p className="text-xs md:text-sm font-semibold text-muted-foreground mb-1">{t('orders.noOrders')}</p>
              <p className="text-xs text-muted-foreground mb-2">{t('orders.noOrdersYet')}</p>

              <div className="mx-auto mb-3 max-w-md rounded-lg border bg-muted/30 p-3 text-left">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t('orders.demoTitle') || 'What an order looks like'}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t('orders.demoDesc') || 'When a customer orders from your store, it will appear here with customer info, product, amount, and status.'}
                </div>
              </div>

              <button
                onClick={() => setShowAddOrder(true)}
                className="inline-flex items-center gap-1 rounded bg-green-500 text-white px-2 py-1 text-xs font-medium hover:bg-green-600 transition-colors h-8"
              >
                <Plus className="h-3 w-3"/> {t('orders.addNewOrder')}
              </button>
            </div>
          )}

          {/* Empty State - No Orders in This Category */}
          {!isLoading && !error && orders.length > 0 && getFilteredOrders().length === 0 && (
            <div className="p-6 md:p-8 text-center">
              <div className="text-lg mb-2">🔍</div>
              <p className="text-xs md:text-sm font-semibold text-muted-foreground mb-1">{t('orders.noOrdersInCategory')}</p>
              <p className="text-xs text-muted-foreground">{t('orders.tryChangingFilter')}</p>
            </div>
          )}

          {/* Orders Table */}
          {!isLoading && !error && orders.length > 0 && getFilteredOrders().length > 0 && (
          <table className="w-full text-sm font-semibold">
            <thead>
              <tr className="border-b border-primary/10 bg-gradient-to-r from-muted/50 to-muted/30">
                <th className="whitespace-nowrap p-2 text-center font-bold text-sm w-10">
                  <button 
                    onClick={selectAllFiltered}
                    className="p-1 hover:bg-primary/10 rounded"
                    title={getFilteredOrders().every(o => selectedOrders.has(o.raw_id)) ? "Deselect all" : "Select all"}
                  >
                    {getFilteredOrders().length > 0 && getFilteredOrders().every(o => selectedOrders.has(o.raw_id)) ? (
                      <CheckSquare className="h-4 w-4 text-blue-500" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </th>
                <th className="whitespace-nowrap p-2 text-right font-bold text-sm">{t('orders.image')}</th>
                <th className="whitespace-nowrap p-2 text-right font-bold text-sm">{t('orders.orderNumber')}</th>
                <th className="whitespace-nowrap p-2 text-right font-bold text-sm">{t('orders.product')}</th>
                <th className="whitespace-nowrap p-2 text-right font-bold text-sm">{t('orders.customer')}</th>
                <th className="whitespace-nowrap p-2 text-right font-bold text-sm">{t('orders.amount')}</th>
                <th className="whitespace-nowrap p-2 text-right font-bold text-sm">{t('orders.status')}</th>
                <th className="whitespace-nowrap p-2 text-right font-bold text-sm">{t('orders.time')}</th>
                <th className="whitespace-nowrap p-2 text-right font-bold text-sm w-8"></th>
              </tr>
            </thead>
            <tbody>
              {getPaginatedOrders().map((o:any)=> (
                <React.Fragment key={o.id}>
                  <tr 
                    onClick={() => setExpandedOrderId(expandedOrderId === o.id ? null : o.id)}
                    className={`group border-b border-primary/5 transition-all cursor-pointer hover:bg-primary/10 ${duplicatePhones.has(o.phone) ? 'bg-amber-500/5 border-l-2 border-l-amber-400' : ''}`}
                  >
                    <td className="whitespace-nowrap p-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => toggleOrderSelection(o.raw_id)}
                        className="p-1 hover:bg-primary/10 rounded"
                      >
                        {selectedOrders.has(o.raw_id) ? (
                          <CheckSquare className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </td>
                    <td className="whitespace-nowrap p-2 text-right">
                      {o.product_image ? (
                        <div className="w-10 h-10 rounded overflow-hidden border border-border/50 ml-auto">
                          <img 
                            src={o.product_image} 
                            alt={o.product_title || 'Product'} 
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center border border-border/50 ml-auto">
                          <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap p-2 text-right font-bold text-sm" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => copyToClipboard(o.id, `id-${o.id}`)}
                        className="inline-flex items-center gap-1 group/copy hover:text-primary transition-colors"
                        title="Copy order ID"
                      >
                        {o.id}
                        {copiedKey === `id-${o.id}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 opacity-0 group-hover/copy:opacity-60" />}
                      </button>
                    </td>
                    <td className="whitespace-nowrap p-2 text-right">
                      <span className="text-sm font-semibold max-w-[150px] truncate block" title={o.product_title}>
                        {o.product_title || t('orders.noProduct')}
                      </span>
                    </td>
                    <td className="whitespace-nowrap p-2 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-sm font-semibold">{o.customer}</span>
                        {o.phone && (
                          <button
                            onClick={() => copyToClipboard(o.phone, `phone-${o.id}`)}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors group/phone"
                            title="Copy phone"
                          >
                            {duplicatePhones.has(o.phone) && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                            {o.phone}
                            {copiedKey === `phone-${o.id}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 opacity-0 group-hover/phone:opacity-60" />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap p-2 text-right">
                      <span className="font-bold bg-gradient-to-r from-accent to-orange-500 bg-clip-text text-transparent text-sm">
                        {Math.round(Number(o.total) || 0)} DZD
                      </span>
                    </td>
                    <td className="whitespace-nowrap p-2 text-right">
                      {(() => {
                        const statusInfo = getStatusDisplay(o.status);
                        return (
                          <span 
                            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold border"
                            style={{ 
                              backgroundColor: `${statusInfo.color}20`,
                              borderColor: `${statusInfo.color}50`,
                              color: statusInfo.color 
                            }}
                          >
                            {statusInfo.icon} {statusInfo.name}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="whitespace-nowrap p-2 text-right text-muted-foreground text-sm" key={`time-${o.id}-${timeUpdate}`}>{getTimeStr(Math.floor((Date.now() - parseUTCDate(o.created_at).getTime()) / 60000))}</td>
                    <td className="p-2 text-right">
                      <ChevronRight className={`h-4 w-4 text-muted-foreground ml-auto transition-transform duration-200 ${expandedOrderId === o.id ? 'rotate-90' : 'group-hover:translate-x-0.5'}`} />
                    </td>
                  </tr>
                  {expandedOrderId === o.id && (
                    <tr className="bg-muted/30 border-b border-primary/10">
                      <td colSpan={9} className="p-3">
                        <div className="space-y-2">
                          {/* Order Details Grid - Compact */}
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                            <div className="bg-background rounded p-2 border border-border/50">
                              <div className="text-xs font-semibold text-muted-foreground">{t('orders.orderNumber')}</div>
                              <div className="font-bold text-sm">{o.id}</div>
                            </div>
                            <div className="bg-background rounded p-2 border border-border/50">
                              <div className="text-xs font-semibold text-muted-foreground">{t('orders.customerName')}</div>
                              <div className="font-bold text-sm">{o.customer}</div>
                            </div>
                            <div className="bg-background rounded p-2 border border-border/50">
                              <div className="text-xs font-semibold text-muted-foreground">{t('orders.phoneNumber')}</div>
                              <div className="font-bold text-sm">{o.phone || t('orders.notAvailable')}</div>
                            </div>
                            <div className="bg-background rounded p-2 border border-border/50">
                              <div className="text-xs font-semibold text-muted-foreground">{t('orders.address')}</div>
                              <div className="font-bold text-sm truncate">{o.address || t('orders.notAvailable')}</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                            <div className="bg-background rounded p-2 border border-border/50">
                              <div className="text-xs font-semibold text-muted-foreground">{t('orders.product')}</div>
                              <div className="flex items-center gap-2">
                                {o.product_image ? (
                                  <img 
                                    src={o.product_image} 
                                    alt={o.product_title || 'Product'} 
                                    className="w-8 h-8 rounded object-cover border border-border/50"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center border border-border/50">
                                    <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="font-bold text-sm truncate">{o.product_title || t('orders.notAvailable')}</div>
                              </div>
                            </div>
                            <div className="bg-background rounded p-2 border border-border/50">
                              <div className="text-xs font-semibold text-muted-foreground">Variant</div>
                              <div className="font-bold text-sm">
                                {o.variant_name || [o.variant_color, o.variant_size].filter(Boolean).join(' / ') || '—'}
                              </div>
                            </div>
                            <div className="bg-background rounded p-2 border border-border/50">
                              <div className="text-xs font-semibold text-muted-foreground">Quantity</div>
                              <div className="font-bold text-sm">{Number(o.quantity || 0)}</div>
                            </div>
                            <div className="bg-background rounded p-2 border border-border/50">
                              <div className="text-xs font-semibold text-muted-foreground">Unit Price</div>
                              <div className="font-bold text-sm">{Math.round(Number(o.unit_price || 0))} DZD</div>
                            </div>
                          </div>

                          {/* Notes + Edit inline */}
                          <div className="flex items-start gap-2">
                            <div className="flex-1 bg-background rounded p-2 border border-border/50">
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1">
                                <StickyNote className="h-3 w-3" /> Internal Note
                              </div>
                              <textarea
                                value={orderNotes[o.raw_id] || ''}
                                onChange={e => setOrderNotes(prev => ({ ...prev, [o.raw_id]: e.target.value }))}
                                onClick={e => e.stopPropagation()}
                                placeholder="Add a private note about this order..."
                                rows={1}
                                className="w-full text-xs rounded border border-border bg-muted/30 px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                              />
                            </div>
                            {localStorage.getItem('isStaff') !== 'true' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(o);
                                }}
                                className="inline-flex items-center rounded bg-primary/10 px-3 py-2 text-sm font-bold hover:bg-primary/20 transition-colors self-end"
                              >
                                ✎ Edit Order
                              </button>
                            )}
                          </div>

                          {/* Actions - Custom Statuses & Delete */}
                          <div className="flex flex-wrap gap-2">
                            {customStatuses.map(status => {
                              const translatedName = t(`orders.status.${status.key}`) || status.name;
                              return (
                                <button 
                                  key={status.id}
                                  onClick={() => setStatus(o.id, status.key)} 
                                  disabled={o.status === status.key}
                                  className="inline-flex items-center rounded px-3 py-2 text-sm font-bold transition-colors shadow h-9 disabled:opacity-30"
                                  style={{ 
                                    backgroundColor: status.color,
                                    color: 'white'
                                  }}
                                >
                                  {status.icon} {translatedName}
                                </button>
                              );
                            })}
                            <button 
                              onClick={() => setStatus(o.id, 'cancelled')} 
                              className="inline-flex items-center rounded bg-gradient-to-r from-red-500 to-red-600 px-3 py-2 text-sm font-bold text-white hover:from-red-600 hover:to-red-700 transition-colors shadow h-9"
                            >
                              ✕ {t('orders.action.cancel')}
                            </button>
                            <button
                              onClick={() => handleDeleteOrder(o.raw_id)}
                              className="inline-flex items-center rounded bg-gradient-to-r from-gray-700 to-red-700 px-3 py-2 text-sm font-bold text-white hover:from-red-800 hover:to-gray-800 transition-colors shadow h-9"
                            >
                              <Trash2 className="h-4 w-4 mr-1" /> Delete
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeliveryOrder(o); }}
                              className="inline-flex items-center rounded bg-gradient-to-r from-indigo-500 to-blue-600 px-3 py-2 text-sm font-bold text-white hover:from-indigo-600 hover:to-blue-700 transition-colors shadow h-9"
                            >
                              <Truck className="h-4 w-4 mr-1" /> Delivery
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          )}
        </div>

        {/* Pagination */}
        <div className="p-4 border-t-2 border-primary/10 flex items-center justify-between bg-muted/30">
          <div className="text-sm text-muted-foreground">
            {totalFilteredOrders === 0 ? t('orders.showingZero') : t('orders.showing').replace('{start}', startOrder.toString()).replace('{end}', endOrder.toString()).replace('{total}', totalFilteredOrders.toString())}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="rounded-lg border-2 border-primary/30 bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={currentPage === 1}
            >
              {t('orders.prev')}
            </button>
            <span className="text-sm font-medium px-2">
              {currentPage} / {Math.max(totalPages, 1)}
            </span>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-medium text-white hover:from-primary/90 hover:to-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              disabled={currentPage >= totalPages}
            >
              {t('orders.next')}
            </button>
          </div>
        </div>
      </div>

      {/* Edit Order Modal (store owner) */}
      {showEditOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
          <div className="bg-card rounded-lg border border-primary/20 shadow-xl max-w-lg w-full p-4 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">✎ Edit Order</h2>
                {editOrder?.id && <div className="text-xs text-muted-foreground">{editOrder.id}</div>}
              </div>
              <button
                onClick={() => {
                  setShowEditOrder(false);
                  setEditOrder(null);
                  setEditVariants([]);
                }}
                className="p-1 rounded hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-sm font-bold">Customer Name *</label>
                <input
                  type="text"
                  value={editForm.customer_name}
                  onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                  className="w-full mt-0.5 px-3 py-2 rounded border border-border/50 bg-background focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-bold">Phone</label>
                <input
                  type="tel"
                  value={editForm.customer_phone}
                  onChange={(e) => setEditForm({ ...editForm, customer_phone: e.target.value })}
                  className="w-full mt-0.5 px-3 py-2 rounded border border-border/50 bg-background focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                  placeholder="+213..."
                />
              </div>

              <div>
                <label className="text-sm font-bold">Email</label>
                <input
                  type="email"
                  value={editForm.customer_email}
                  onChange={(e) => setEditForm({ ...editForm, customer_email: e.target.value })}
                  className="w-full mt-0.5 px-3 py-2 rounded border border-border/50 bg-background focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-bold">Shipping Address</label>
                <input
                  type="text"
                  value={editForm.shipping_address}
                  onChange={(e) => setEditForm({ ...editForm, shipping_address: e.target.value })}
                  className="w-full mt-0.5 px-3 py-2 rounded border border-border/50 bg-background focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-bold">Wilaya</label>
                <select
                  value={editForm.shipping_wilaya_id}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      shipping_wilaya_id: e.target.value,
                      shipping_commune_id: '',
                    })
                  }
                  className="w-full mt-0.5 px-3 py-2 rounded border border-border/50 bg-background text-sm"
                >
                  <option value="">Select wilaya</option>
                  {dzWilayas.map((w) => (
                    <option key={String(w.id)} value={String(w.id)}>
                      {String(w.code).padStart(2, '0')} - {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-bold">Commune</label>
                <select
                  value={editForm.shipping_commune_id}
                  onChange={(e) => setEditForm({ ...editForm, shipping_commune_id: e.target.value })}
                  className="w-full mt-0.5 px-3 py-2 rounded border border-border/50 bg-background text-sm"
                  disabled={!editForm.shipping_wilaya_id}
                >
                  <option value="">Select commune</option>
                  {dzCommunesForEdit.map((c) => (
                    <option key={String(c.id)} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-bold">Hai (optional)</label>
                <input
                  type="text"
                  value={editForm.shipping_hai}
                  onChange={(e) => setEditForm({ ...editForm, shipping_hai: e.target.value })}
                  className="w-full mt-0.5 px-3 py-2 rounded border border-border/50 bg-background focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-bold">Delivery Type</label>
                <select
                  value={editForm.delivery_type}
                  onChange={(e) => setEditForm({ ...editForm, delivery_type: e.target.value as any })}
                  className="w-full mt-0.5 px-3 py-2 rounded border border-border/50 bg-background text-sm"
                >
                  <option value="home">Home</option>
                  <option value="desk">Desk</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-bold">Quantity</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({ ...editForm, quantity: Number(e.target.value) })}
                  className="w-full mt-0.5 px-3 py-2 rounded border border-border/50 bg-background focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-bold">Variant</label>
                <div className="text-xs text-muted-foreground mb-1">
                  {loadingEditVariants ? 'Loading variants…' : editVariants.length ? 'Select the exact color/size for this order.' : 'No variants for this product.'}
                </div>
                <select
                  value={editForm.variant_id}
                  onChange={(e) => setEditForm({ ...editForm, variant_id: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-border/50 bg-background text-sm"
                  disabled={loadingEditVariants || editVariants.length === 0}
                >
                  <option value="">{editVariants.length ? 'Select variant' : 'No variants'}</option>
                  {editVariants
                    .filter((v: any) => v?.is_active !== false)
                    .map((v: any) => {
                      const labelParts = [String(v.variant_name || '').trim(), String(v.color || '').trim(), String(v.size || '').trim()].filter(Boolean);
                      const label = labelParts.join(' / ') || `Variant #${v.id}`;
                      const stock = v.stock_quantity != null ? Number(v.stock_quantity) : null;
                      return (
                        <option key={String(v.id)} value={String(v.id)}>
                          {label}{stock != null ? ` (stock: ${stock})` : ''}
                        </option>
                      );
                    })}
                </select>
              </div>
            </div>

            {(() => {
              const hasVariants = editVariants.length > 0;
              const requiresVariant = hasVariants;
              const canSave =
                Boolean(editForm.customer_name.trim()) &&
                Number.isFinite(Number(editForm.quantity)) &&
                Number(editForm.quantity) >= 1 &&
                (!requiresVariant || Boolean(editForm.variant_id));

              return (
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setShowEditOrder(false);
                      setEditOrder(null);
                      setEditVariants([]);
                    }}
                    className="flex-1 px-3 py-2 rounded border border-primary/30 hover:bg-primary/10 transition-colors text-sm font-bold"
                    disabled={savingEditOrder}
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={saveOrderEdits}
                    className="flex-1 px-3 py-2 rounded bg-gradient-to-r from-primary to-accent text-white text-sm font-bold hover:from-primary/90 hover:to-accent/90 transition-colors shadow disabled:opacity-50"
                    disabled={savingEditOrder || !canSave}
                  >
                    {savingEditOrder ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Add Order Modal */}
      {showAddOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
          <div className="bg-card rounded-lg border border-primary/20 shadow-xl max-w-xs w-full p-3 space-y-2">
            <h2 className="text-lg font-bold">{t('orders.addNewOrderTitle')}</h2>
            
            <div>
              <label className="text-sm font-bold">{t('orders.customerNameRequired')}</label>
              <input
                type="text"
                value={newOrder.customer_name}
                onChange={(e) => setNewOrder({...newOrder, customer_name: e.target.value})}
                className="w-full mt-0.5 px-2 py-1 rounded border border-border/50 bg-background focus:outline-none focus:ring-1 focus:ring-primary h-9 text-sm"
                placeholder={t('orders.enterCustomerName')}
              />
            </div>

            <div>
              <label className="text-sm font-bold">{t('orders.phoneNumber')}</label>
              <input
                type="tel"
                value={newOrder.customer_phone}
                onChange={(e) => setNewOrder({...newOrder, customer_phone: e.target.value})}
                className="w-full mt-0.5 px-2 py-1 rounded border border-border/50 bg-background focus:outline-none focus:ring-1 focus:ring-primary h-9 text-sm"
                placeholder="+213..."
              />
            </div>

            <div>
              <label className="text-sm font-bold">{t('orders.address')}</label>
              <input
                type="text"
                value={newOrder.customer_address}
                onChange={(e) => setNewOrder({...newOrder, customer_address: e.target.value})}
                className="w-full mt-0.5 px-2 py-1 rounded border border-border/50 bg-background focus:outline-none focus:ring-1 focus:ring-primary h-9 text-sm"
                placeholder={t('orders.enterAddress')}
              />
            </div>

            <div>
              <label className="text-sm font-bold">{t('orders.totalRequired')}</label>
              <input
                type="number"
                value={newOrder.total_price}
                onChange={(e) => setNewOrder({...newOrder, total_price: e.target.value})}
                className="w-full mt-0.5 px-2 py-1 rounded border border-border/50 bg-background focus:outline-none focus:ring-1 focus:ring-primary h-9 text-sm"
                placeholder="0"
                step="0.01"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowAddOrder(false)}
                className="flex-1 px-3 py-2 rounded border border-primary/30 hover:bg-primary/10 transition-colors text-sm h-9 font-bold"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleAddOrder}
                className="flex-1 px-3 py-2 rounded bg-gradient-to-r from-green-500 to-green-600 text-white text-sm font-bold hover:from-green-600 hover:to-green-700 transition-colors shadow h-9"
              >
                {t('orders.addOrder')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Manager Modal */}
      {showStatusManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-3">
          <div className="bg-card rounded-[24px] border border-primary/20 shadow-xl max-w-md w-full flex flex-col max-h-[88vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/40 shrink-0">
              <h2 className="text-base font-bold">{t('orders.statusManager')}</h2>
              <button onClick={() => setShowStatusManager(false)} className="p-1 rounded hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Status list — scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
              {(() => {
                const groups = [
                  { label: 'Core',            keys: ['pending','confirmed','at_delivery'] },
                  { label: 'Success',         keys: ['completed','delivered'] },
                  { label: 'Failure',         keys: ['delivery_failed','returned','declined','didnt_pickup'] },
                  { label: 'Archived',        keys: ['failed','cancelled'] },
                  { label: 'Call Center',     keys: ['no_answer_1','no_answer_2','no_answer_3','waiting_callback','postponed'] },
                  { label: 'Quality Control', keys: ['fake','duplicate'] },
                ];

                const PRESET_CATALOG: Record<string, { name: string; color: string; icon: string }> = {
                  cancelled:        { name: 'Cancelled',        color: '#ef4444', icon: '✕'  },
                  failed:           { name: 'Failed',           color: '#ef4444', icon: '✕'  },
                  delivered:        { name: 'Delivered',        color: '#10b981', icon: '✓'  },
                  declined:         { name: 'Declined',         color: '#ef4444', icon: '✕'  },
                  delivery_failed:  { name: 'Delivery Failed',  color: '#ef4444', icon: '🚫' },
                  returned:         { name: 'Returned',         color: '#f97316', icon: '↩️' },
                  didnt_pickup:     { name: "Didn't Pickup",    color: '#f97316', icon: '⛔' },
                  no_answer_1:      { name: 'No Answer (1st)',  color: '#f59e0b', icon: '📞' },
                  no_answer_2:      { name: 'No Answer (2nd)',  color: '#f59e0b', icon: '📞' },
                  no_answer_3:      { name: 'No Answer (3rd)',  color: '#f59e0b', icon: '📞' },
                  waiting_callback: { name: 'Waiting Callback', color: '#3b82f6', icon: '📱' },
                  postponed:        { name: 'Postponed',        color: '#6366f1', icon: '⏰' },
                  fake:             { name: 'Fake',             color: '#dc2626', icon: '⚠️' },
                  duplicate:        { name: 'Duplicate',        color: '#9ca3af', icon: '📋' },
                };

                const activeKeys = new Set(customStatuses.map(s => s.key));
                const systemByKey = Object.fromEntries(customStatuses.filter(s => s.is_system).map(s => [s.key, s]));
                const customOnly = customStatuses.filter(s => !s.is_system);

                const handleRestorePreset = async (key: string) => {
                  try {
                    const res = await fetch('/api/client/order-statuses/restore-preset', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ key }),
                    });
                    if (res.ok) await loadStatuses();
                  } catch {}
                };

                const CORE_LOCKED_KEYS = new Set(['pending','confirmed','at_delivery','completed']);
                const StatusRow = ({ status, onDelete }: { status: any; onDelete?: () => void }) => (
                  <div className="flex items-center justify-between p-2 rounded-xl border border-border/50 bg-background">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-sm shrink-0" style={{ backgroundColor: status.color }}>
                        {status.icon}
                      </div>
                      <span className="font-semibold text-sm">{t(`orders.status.${status.key}`) || status.name}</span>
                      {status.is_system && CORE_LOCKED_KEYS.has(status.key) && <span className="text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded-md">🔒 Core</span>}
                      {status.counts_as_revenue && <span className="text-[10px] bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded-md">💰 Revenue</span>}
                    </div>
                    {onDelete && (
                      <button onClick={onDelete} className="p-1 rounded-lg hover:bg-red-500/15 text-red-400 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );

                return (
                  <>
                    {groups.map(g => {
                      const items = g.keys.map(k => systemByKey[k]).filter(Boolean);
                      if (!items.length) return null;
                      const CORE_LOCKED = new Set(['pending','confirmed','at_delivery','completed']);
                      return (
                        <div key={g.label} className="space-y-1.5">
                          <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground px-1">{g.label}</p>
                          {items.map(s => (
                            <StatusRow
                              key={s.id}
                              status={s}
                              onDelete={CORE_LOCKED.has(s.key) ? undefined : () => handleDeleteStatus(s.id)}
                            />
                          ))}
                        </div>
                      );
                    })}

                    {customOnly.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground px-1">Custom</p>
                        {customOnly.map(s => <StatusRow key={s.id} status={s} onDelete={() => handleDeleteStatus(s.id)} />)}
                      </div>
                    )}

                    {/* Available presets */}
                    {(() => {
                      const available = Object.entries(PRESET_CATALOG).filter(([k]) => !activeKeys.has(k));
                      if (!available.length) return null;
                      return (
                        <div className="space-y-1.5 pt-1 border-t border-border/40">
                          <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground px-1">Add Preset</p>
                          {available.map(([k, p]) => (
                            <button
                              key={k}
                              onClick={() => handleRestorePreset(k)}
                              className="w-full flex items-center justify-between p-2 rounded-xl border border-dashed border-border/50 bg-background/50 hover:bg-muted/50 hover:border-primary/40 transition-colors group"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-sm shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: p.color }}>
                                  {p.icon}
                                </div>
                                <span className="font-semibold text-sm text-muted-foreground group-hover:text-foreground transition-colors">{p.name}</span>
                              </div>
                              <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
            </div>

            {/* Add custom status — footer */}
            <div className="px-4 pb-4 pt-3 border-t border-border/40 space-y-2 shrink-0">
              <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{t('orders.addNewStatus')}</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newStatusName}
                  onChange={(e) => setNewStatusName(e.target.value)}
                  className="flex-1 px-3 h-9 rounded-xl border border-border/50 bg-background focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                  placeholder="Status name"
                />
                <input
                  type="color"
                  value={newStatusColor}
                  onChange={(e) => setNewStatusColor(e.target.value)}
                  className="w-9 h-9 rounded-xl border border-border/50 cursor-pointer p-0.5"
                />
                <select
                  value={newStatusIcon}
                  onChange={(e) => setNewStatusIcon(e.target.value)}
                  className="px-2 h-9 rounded-xl border border-border/50 bg-background text-sm"
                >
                  <option value="●">●</option>
                  <option value="✓">✓</option>
                  <option value="✕">✕</option>
                  <option value="◐">◐</option>
                  <option value="📦">📦</option>
                  <option value="🚚">🚚</option>
                  <option value="⏳">⏳</option>
                  <option value="💰">💰</option>
                  <option value="📞">📞</option>
                  <option value="🔄">🔄</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={newStatusCountsAsRevenue}
                    onChange={(e) => setNewStatusCountsAsRevenue(e.target.checked)}
                    className="w-4 h-4 rounded border-border accent-green-500"
                  />
                  <span className="text-sm text-muted-foreground">💰 Count as revenue</span>
                </label>
                <button
                  onClick={handleAddStatus}
                  disabled={!newStatusName.trim()}
                  className="px-4 h-9 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-bold hover:from-purple-600 hover:to-purple-700 transition-colors shadow disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => { setShowBulkUpload(false); setBulkUploadResult(null); }}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative rounded-[20px] bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/60 ring-1 ring-black/5 dark:ring-white/10 shadow-2xl shadow-blue-500/10 dark:shadow-black/50 max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col"
          >
            {/* Header gradient bar */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                  <Truck className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">Upload to Delivery</h2>
                  <p className="text-xs text-white/70">{selectedOrders.size} orders &middot; {orders.filter(o => selectedOrders.has(o.raw_id)).reduce((sum, o) => sum + (Number(o.total) || 0), 0).toLocaleString()} DZD</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowBulkUpload(false); setBulkUploadResult(null); }}
                className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* Delivery Company Selection */}
              {deliveryCompanies.filter(c => c.is_configured && c.has_api_key).length === 0 ? (
                <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-center">
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mx-auto mb-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-400">No delivery companies configured</p>
                  <p className="text-xs text-muted-foreground mt-1">Go to Settings → Delivery Companies to connect one</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Company</p>
                  <div className="grid gap-2">
                    {deliveryCompanies.filter(c => c.is_configured && c.has_api_key).map(company => {
                      const isSelected = selectedDeliveryCompany === company.id;
                      return (
                        <button
                          key={company.id}
                          onClick={() => setSelectedDeliveryCompany(company.id)}
                          className={`group relative p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-md shadow-blue-500/10'
                              : 'border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-blue-500 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600'
                            }`}>
                              {isSelected ? <Check className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-bold text-sm">{company.name}</span>
                              {company.features && (
                                <div className="flex gap-2 mt-0.5">
                                  {company.features.tracking && <span className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded-md font-medium">Tracking</span>}
                                  {company.features.cod && <span className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-md font-medium">COD</span>}
                                  {company.features.labels && <span className="text-[11px] text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 px-1.5 py-0.5 rounded-md font-medium">Labels</span>}
                                </div>
                              )}
                            </div>
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isSelected ? 'bg-blue-500 ring-4 ring-blue-500/20' : 'bg-slate-300 dark:bg-slate-600'}`} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Options */}
              {selectedDeliveryCompany && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40 p-3 space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isNoestSelected
                      ? 'Noest uses an Ecotrack-powered API. Configure your Noest Token + GUID in Settings → Delivery Companies, then enable "Generate labels".'
                      : '"Assign only" marks orders locally. Enable "Generate labels" to call the courier API and get tracking numbers.'}
                  </p>
                  <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700/40 transition-colors">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                      generateLabels 
                        ? 'bg-blue-500 border-blue-500' 
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                    }`}>
                      {generateLabels && <Check className="h-3.5 w-3.5 text-white" />}
                    </div>
                    <input
                      type="checkbox"
                      checked={generateLabels}
                      onChange={(e) => setGenerateLabels(e.target.checked)}
                      disabled={!canGenerateLabels}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium">Generate shipping labels</span>
                  </label>
                </div>
              )}

              {/* Results */}
              {bulkUploadResult && (
                <div className={`p-4 rounded-xl border ${
                  bulkUploadResult.failCount === 0 
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50' 
                    : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {bulkUploadResult.failCount === 0 
                      ? <CheckSquare className="h-5 w-5 text-emerald-600" />
                      : <AlertTriangle className="h-5 w-5 text-amber-600" />
                    }
                    <span className="font-bold text-sm">
                      {bulkUploadResult.failCount === 0 ? 'All orders uploaded!' : 'Some orders failed'}
                    </span>
                  </div>
                  <div className="flex gap-3 text-sm">
                    <span className="text-emerald-600 font-medium">{bulkUploadResult.successCount} successful</span>
                    {bulkUploadResult.failCount > 0 && (
                      <span className="text-red-500 font-medium">{bulkUploadResult.failCount} failed</span>
                    )}
                  </div>
                  {bulkUploadResult.failCount > 0 && (
                    <div className="mt-2 max-h-28 overflow-y-auto space-y-1">
                      {bulkUploadResult.results.filter(r => !r.success).map((r, i) => (
                        <div key={i} className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded">
                          Order #{r.orderId}: {r.error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="px-5 py-3 border-t border-slate-200/60 dark:border-slate-700/40 bg-slate-50/50 dark:bg-slate-800/30 flex gap-3">
              <button
                onClick={() => { setShowBulkUpload(false); setBulkUploadResult(null); }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {bulkUploadResult ? 'Close' : 'Cancel'}
              </button>
              {!bulkUploadResult && (
                <button
                  onClick={handleBulkUpload}
                  disabled={bulkUploading || !selectedDeliveryCompany}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2"
                >
                  {bulkUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload {selectedOrders.size} Orders
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delivery Management Dialog */}
      <Dialog open={!!deliveryOrder} onOpenChange={(open) => { if (!open) setDeliveryOrder(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" /> Delivery Management
            </DialogTitle>
          </DialogHeader>
          {deliveryOrder && (
            <OrderFulfillment
              order={{
                id: deliveryOrder.raw_id,
                customer_name: deliveryOrder.customer,
                customer_phone: deliveryOrder.phone || '',
                customer_address: deliveryOrder.address || '',
                total_price: Number(deliveryOrder.total) || 0,
                delivery_company_id: deliveryOrder.delivery_company_id,
                tracking_number: deliveryOrder.tracking_number,
                delivery_status: deliveryOrder.delivery_status,
                shipping_label_url: deliveryOrder.shipping_label_url
              }}
              onDeliveryAssigned={() => { loadOrders(); setDeliveryOrder(null); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
