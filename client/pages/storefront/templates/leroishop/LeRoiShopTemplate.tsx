import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import { isValidAlgerianPhone } from '@/lib/utils';
import { getFraudData } from '@/lib/fingerprint';
import { getAlgeriaCommunesByWilayaId, getAlgeriaCommuneById, communeDisplayName } from '@/lib/algeriaGeo';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import { trackAllPixels, PixelEvents } from '@/components/storefront/PixelScripts';
import { buildStoreUrl } from '@/lib/resolvedStore';
import LazyVideo from '@/components/storefront/LazyVideo';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   LeRoi Shop — Multi-product catalog + product detail + order form
   Layout: Announcement → Header → Catalog Grid ↔ Product Detail
   ═══════════════════════════════════════════════════════════ */

export default function LeRoiShopTemplate({
  settings,
  products,
  canManage,
  storeSlug,
  primaryColor: propPrimaryColor,
  onProductView,
  initialProductSlug,
  navigate,
}: TemplateProps) {

  /* ── Colors ───────────────────────────────────────────── */
  const accentColor = settings?.template_accent_color || propPrimaryColor || settings?.primary_color || '#f59e0b';
  const bgColor = settings?.template_bg_color || '#fafafa';
  const primaryColor = settings?.primary_color || '#1f2937';
  const rawBgImage = settings?.template_bg_image || '';
  const bgImageCss = rawBgImage
    ? (rawBgImage.startsWith('linear') || rawBgImage.startsWith('radial') || rawBgImage.startsWith('url(')
      ? rawBgImage
      : `url(${rawBgImage})`)
    : '';

  const isDark = useMemo(() => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }, [bgColor]);

  const headerColor = settings?.iyco_header_color || (isDark ? '#1e293b' : '#ffffff');

  const isHeaderDark = useMemo(() => {
    const hex = headerColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }, [headerColor]);

  const isLight = (hex: string) => {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 >= 128;
  };

  const textColor = isDark ? (isLight(primaryColor) ? primaryColor : '#f1f5f9') : primaryColor;
  const textMuted = isDark ? (isLight(primaryColor) ? primaryColor + 'aa' : '#94a3b8') : '#6b7280';
  const borderColor = isDark ? '#334155' : '#e5e7eb';
  const surfaceMuted = isDark ? '#0f172a' : '#f9fafb';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#eeeeee';
  const surfaceTextColor = isHeaderDark ? (isLight(primaryColor) ? primaryColor : '#f1f5f9') : primaryColor;
  const surfaceBorderColor = isHeaderDark ? '#334155' : '#e5e7eb';
  const inputBorderColor = isDark ? '#475569' : '#dddddd';
  const inputBg = isDark ? '#1e293b' : '#ffffff';
  const formBg = isDark ? '#0f172a' : '#f9fafb';
  const currency = settings?.currency_code || 'د.ج';

  /* ── State ────────────────────────────────────────────── */
  const [headerHidden, setHeaderHidden] = useState(false);
  const [mounted, setMounted] = useState(false);
  const lastScrollY = useRef(0);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      const diff = currentY - lastScrollY.current;
      if (Math.abs(diff) > 10) {
        setHeaderHidden(diff > 0 && currentY > 80);
      }
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const [view, setView] = useState<'catalog' | 'product'>('catalog');
  const [descExpanded, setDescExpanded] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  useEffect(() => {
    if (!initialProductSlug) { setView('catalog'); setSelectedProduct(null); return; }
    if (products?.length) { const p = products.find((x: any) => x.slug === initialProductSlug); if (p) { setSelectedProduct(p); setView('product'); } }
  }, [initialProductSlug, products]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);
  const [lastCustomerPhone, setLastCustomerPhone] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImgIdx, setLightboxImgIdx] = useState(0);
  useEffect(() => {
    if (lightboxOpen) {
      // Map realMediaIndex to image-only index (subtract 1 if video is first)
      setLightboxImgIdx(videoEmbed ? Math.max(0, realMediaIndex - 1) : realMediaIndex);
    }
  }, [lightboxOpen]);
  const [emblaApi, setEmblaApi] = useState<any>(null);
  const galleryStripRef = useRef<HTMLDivElement>(null);
  const thumbnailRowRef = useRef<HTMLDivElement>(null);
  const galleryIdxRef = useRef(0);
  const wrapRef = useRef(false);
  galleryIdxRef.current = activeImageIndex;
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'home' | 'desk'>('home');
  const { showAddress, showCommune, showNotes, showHomeDelivery, showDeskDelivery } = useOrderFields(settings, selectedDeliveryType);
  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  useEffect(() => { if (wilayas.length > 0) { const stillValid = wilayas.some(w => w.id === selectedWilayaId); if (!selectedWilayaId || !stillValid) setSelectedWilayaId(wilayas[0].id); } }, [wilayas]);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const [communeId, setCommuneId] = useState('');
  const communes = useMemo(() => getAlgeriaCommunesByWilayaId(selectedWilayaId), [selectedWilayaId]);
  useEffect(() => { setCommuneId(''); }, [selectedWilayaId]);
  const baseDeliveryFee = selectedWilaya ? (selectedDeliveryType === 'home' ? selectedWilaya.homePrice : (selectedWilaya.deskPrice ?? selectedWilaya.homePrice)) : 0;

  // Offers state (populated after activeProduct is known)
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);

  const handleOfferSelect = (offer: SelectedOffer | null) => {
    setSelectedOffer(offer);
    if (offer) setQuantity(1);
    else setQuantity(1);
  };

  // Info images (editor-uploadable)
  const [infoImg1, setInfoImg1] = useState(settings?.lrs_info_img1 || '');
  const [infoImg2, setInfoImg2] = useState(settings?.lrs_info_img2 || '');
  const info1Ref = useRef<HTMLInputElement>(null);
  const info2Ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings?.lrs_info_img1) setInfoImg1(settings.lrs_info_img1);
    if (settings?.lrs_info_img2) setInfoImg2(settings.lrs_info_img2);
  }, [settings]);

  // Current product for product view
  const activeProduct = selectedProduct || products?.[0];

  // Variant system
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);

  // Offers system — must come after activeProduct
  const { offers, loading: offersLoading } = useProductOffers(storeSlug, activeProduct?.id);

  // Build unified media array: video (if exists) + images, all swipable
  const videoUrl = (activeProduct as any)?.metadata?.video_url || '';
  const videoEmbed = useMemo(() => {
    if (!videoUrl) return null;
    const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (yt) return { type: 'youtube' as const, id: yt[1] };
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) return { type: 'video' as const, url: videoUrl };
    return { type: 'iframe' as const, url: videoUrl };
  }, [videoUrl]);
  const enabledVideo = Boolean(videoEmbed);
  const allMedia = useMemo(() => {
    const items: ({ type: 'video'; embed: typeof videoEmbed } | { type: 'image'; src: string })[] = [];
    if (videoEmbed) items.push({ type: 'video', embed: videoEmbed });
    (activeProduct?.images?.filter(Boolean) || []).forEach((src: string) => items.push({ type: 'image', src }));
    return items;
  }, [videoEmbed, activeProduct?.images]);

  // Reset offer and gallery index when active product changes
  useEffect(() => {
    setSelectedOffer(null);
    setActiveImageIndex(allMedia.length > 1 ? 1 : 0);
  }, [activeProduct?.id]);
  // Clamp index when media count shrinks (e.g., multi-image → single-image)
  useEffect(() => {
    if (allMedia.length <= 1) setActiveImageIndex(0);
  }, [allMedia.length]);

  const loopedMedia = useMemo(() => {
    const len = allMedia.length;
    if (len <= 1) return allMedia;
    return [allMedia[len - 1], ...allMedia, allMedia[0]];
  }, [allMedia]);

  // Map looped index → real allMedia index
  const realMediaIndex = useMemo(() => {
    const n = allMedia.length;
    if (n <= 1) return 0;
    if (activeImageIndex === 0) return n - 1;
    if (activeImageIndex === loopedMedia.length - 1) return 0;
    return activeImageIndex - 1;
  }, [activeImageIndex, allMedia, loopedMedia]);

  // Auto-scroll thumbnails when active media changes
  useEffect(() => {
    if (!thumbnailRowRef.current) return;
    const container = thumbnailRowRef.current;
    const thumb = container.children[realMediaIndex] as HTMLElement | undefined;
    if (thumb) {
      thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [realMediaIndex]);

  // Infinite loop: when reaching a clone, snap to the real item after transition
  useEffect(() => {
    if (allMedia.length <= 1) return;
    const idx = activeImageIndex;
    const len = loopedMedia.length;
    if (idx === len - 1) {
      const timer = setTimeout(() => {
        wrapRef.current = true;
        galleryIdxRef.current = 1;
        setActiveImageIndex(1);
      }, 300);
      return () => { clearTimeout(timer); wrapRef.current = false; };
    } else if (idx === 0) {
      const timer = setTimeout(() => {
        wrapRef.current = true;
        galleryIdxRef.current = allMedia.length;
        setActiveImageIndex(allMedia.length);
      }, 300);
      return () => { clearTimeout(timer); wrapRef.current = false; };
    } else {
      wrapRef.current = false;
    }
  }, [activeImageIndex, allMedia.length, loopedMedia.length]);

  const comparePrice = (activeProduct as any)?.compare_at_price;
  const unitPrice = activeProduct?.price || 0;
  const deliveryFee = resolveDeliveryFee(activeProduct, selectedOffer, baseDeliveryFee);
  const productTotal = selectedOffer ? selectedOffer.bundle_price * quantity : unitPrice * quantity;
  const grandTotal = productTotal + deliveryFee;

  // Related products (exclude active product) - show more like Temu
  const relatedProducts = useMemo(() =>
    (products || []).filter(p => p.id !== activeProduct?.id).slice(0, 10),
    [products, activeProduct?.id]
  );

  useEffect(() => { if (activeProduct && onProductView) onProductView(activeProduct); }, [activeProduct?.id]);

  /* ── Font ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!document.getElementById('cairo-font')) {
      const link = document.createElement('link');
      link.id = 'cairo-font';
      link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }, []);

  /* ── Handlers ─────────────────────────────────────────── */
  const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.setAttribute('data-setting-key', key);
    const text = e.currentTarget.textContent || '';
    window.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value: text }, '*');
  };

  const handleImageUpload = (settingKey: string, setter: React.Dispatch<React.SetStateAction<string>>) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (!evt.target?.result) return;
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          const MAX = 800;
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
            else { w = Math.round((w * MAX) / h); h = MAX; }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setter(dataUrl);
            window.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key: settingKey, value: dataUrl }, '*');
          }
        };
        img.src = evt.target.result as string;
      };
      reader.readAsDataURL(file);
    };

  const openProduct = (product: any) => {
    setSelectedProduct(product);
    const imgCount = product.images?.filter(Boolean)?.length || 0;
    const hasVideo = Boolean((product as any)?.metadata?.video_url);
    setActiveImageIndex((imgCount + (hasVideo ? 1 : 0)) > 1 ? 1 : 0);
    setView('product');
    setQuantity(1);
    setDescExpanded(false);
    setOrderSuccess(false);
    setSelectedWilayaId(null);
    if (product?.slug && navigate) navigate(buildStoreUrl(storeSlug, product.slug));
  };

  const goToCatalog = () => {
    setView('catalog');
    setSelectedProduct(null);
    setOrderSuccess(false);
    if (navigate) navigate(buildStoreUrl(storeSlug, '/'));
  };

  const scrollToForm = () => {
    document.getElementById('lrs-order-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  /* ── Order submission ─────────────────────────────────── */
  const handleOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get('name') as string;
    const phone = fd.get('phone') as string;
    if (!name || !phone || !selectedWilayaId || !activeProduct) {
      setOrderError('الرجاء تعبئة جميع الحقول المطلوبة');
      return;
    }
    if (!isValidAlgerianPhone(phone)) {
      setOrderError('رقم الهاتف غير صحيح — يجب أن يبدأ بـ 05، 06 أو 07 ويكون 10 أرقام');
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_slug: storeSlug,
          product_id: activeProduct.id,
          ...(selectedVariant ? { variant_id: selectedVariant.id } : {}),
          quantity,
          ...(selectedOffer ? { offer_id: selectedOffer.offer_id } : {}),
          total_price: productTotal,
          delivery_fee: deliveryFee,
          delivery_type: selectedDeliveryType,
          customer_name: name,
          customer_phone: phone,
          customer_notes: fd.get('notes') as string,
          customer_address: [selectedWilaya?.labelAR || '', communeDisplayName(getAlgeriaCommuneById(communeId)!) || fd.get('commune'), fd.get('address')].filter(Boolean).join(' - '),
          shipping_wilaya_id: selectedWilayaId,
          shipping_commune_id: Number(communeId) || undefined,
          product_name: activeProduct.title || activeProduct.name || '',
          ...getFraudData(),
        }),
      });
      const data = await res.json();
      setLastOrderId(data.order?.id || null);
      setLastTelegramUrl(data.telegramStartUrl || null);
      setLastCustomerPhone(phone);
      if (res.ok) {
        setOrderSuccess(true);
        trackAllPixels(PixelEvents.PURCHASE, {
          content_name: activeProduct?.title || activeProduct?.name || '',
          content_ids: activeProduct?.id ? [activeProduct.id] : [],
          content_type: 'product',
          value: productTotal,
          currency: settings?.currency_code || 'DZD',
          num_items: quantity,
          order_id: data?.order?.id || null,
        });
      } else {
        let errMsg: string;
        if (data.fields) {
          const list = Object.values(data.fields).map((m: any) => `• ${m}`).join('\n');
          errMsg = (data.error || 'يرجى تصحيح البيانات') + '\n' + list;
        } else {
          errMsg = data.error || 'حدث خطأ أثناء إرسال الطلب';
        }
        setOrderError(errMsg);
      }
    } catch {
      setOrderError('حدث خطأ أثناء إرسال الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Image slot (editor-only upload) ─────────────────── */
  const ImageSlot = ({ src, settingKey, setter, inputRef, className = '', placeholder = 'رفع صورة' }: {
    src: string; settingKey: string; setter: React.Dispatch<React.SetStateAction<string>>;
    inputRef: React.RefObject<HTMLInputElement>; className?: string; placeholder?: string;
  }) => (
    <div className={`relative ${className}`} style={{ backgroundColor: surfaceMuted, minHeight: src ? undefined : 200 }}>
      {src ? (
        <img src={src} alt="" className="w-full h-auto block" loading="lazy" decoding="async" style={{ contentVisibility: 'auto' }} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ color: textMuted }}>
          <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
          {canManage && <span className="text-sm font-bold">{placeholder}</span>}
        </div>
      )}
      {canManage && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 transition-colors cursor-pointer group" data-upload-trigger onClick={() => inputRef.current?.click()}>
          <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-bold bg-black/60 px-4 py-2 rounded-xl transition-opacity">
            {src ? 'تغيير الصورة' : 'رفع صورة'}
          </span>
        </div>
      )}
      <input type="file" ref={inputRef} className="hidden" accept="image/*" onChange={handleImageUpload(settingKey, setter)} />
    </div>
  );

  /* ── Star rating component ───────────────────────────── */
  const Stars = () => (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="18" height="18" viewBox="0 0 24 24" fill={accentColor}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </div>
  );

  /* ══════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════ */
  return (
    <div style={{ fontFamily: "'Cairo', sans-serif", backgroundColor: bgColor, backgroundImage: bgImageCss || undefined, backgroundSize: 'cover', backgroundPosition: 'center', color: textColor, minHeight: '100dvh' }} dir="rtl">
      <style>{`
        [contenteditable="true"]:focus { outline: 2px solid ${accentColor}; border-radius: 4px; }
        .lrs-card { transition: all 0.3s ease; }
        .lrs-card:hover { box-shadow: 0 4px 15px rgba(0,0,0,0.05); transform: translateY(-2px); }
        .lrs-offer-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; cursor: pointer; }
        .lrs-offer-row input[type="radio"] { accent-color: ${accentColor}; width: 16px; height: 16px; }
        .lrs-fullbleed { width: 100vw; margin-inline: calc(-50vw + 50%); }
        @media (min-width: 768px) { .lrs-fullbleed { width: 100%; margin-inline: 0; } }
      `}</style>

      {/* ── ANNOUNCEMENT BAR + HEADER (hide on scroll down) ── */}
      <div className={`sticky top-0 z-40 ${mounted ? 'transition-transform duration-300' : ''} ${headerHidden ? '-translate-y-full' : 'translate-y-0'}`}>
      <div className="text-center py-1.5 text-xs md:text-sm font-semibold" style={{ backgroundColor: accentColor, color: '#fff' }}>
        <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lrs_announcement')}>
          {settings?.lrs_announcement || `${settings?.store_name || 'متجري'} — منصة التسوق الإلكتروني | قدم طلبك من هنا 👉`}
        </span>
      </div>

      {/* ── HEADER ────────────────────────────────────── */}
      <header className="shadow-sm" style={{ backgroundColor: bgImageCss ? 'transparent' : headerColor, backdropFilter: bgImageCss ? 'blur(12px)' : 'none', WebkitBackdropFilter: bgImageCss ? 'blur(12px)' : 'none', borderBottom: `1px solid ${surfaceBorderColor}` }}>
        <div className="max-w-screen-xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={goToCatalog} className="font-bold text-sm transition-colors hover:opacity-80" style={{ color: surfaceTextColor }}>
              الرئيسية
            </button>
          </div>
          <div className="flex items-center gap-2 cursor-pointer" onClick={goToCatalog}>
            {settings?.store_logo ? (
              <img src={settings.store_logo} alt="" className="w-8 h-8 rounded-full object-cover" loading="lazy" decoding="async" width="32" height="32" style={{ contentVisibility: 'auto' }} />
            ) : null}
            <span className="text-xl md:text-2xl font-black tracking-tight" style={{ color: surfaceTextColor }}>
              {settings?.store_name || 'متجري'}
              <span style={{ color: accentColor }}> ♛</span>
            </span>
          </div>
          {view === 'product' ? (
            <button onClick={goToCatalog} className="text-sm font-bold" style={{ color: surfaceTextColor }}>← رجوع</button>
          ) : (
            <div className="w-16" />
          )}
        </div>
      </header>
      </div>

      <main className="max-w-screen-xl mx-auto px-0 sm:px-3 py-3 mb-20">

        {/* ════════════════════════════════════════════════
            CATALOG VIEW
            ════════════════════════════════════════════════ */}
        {view === 'catalog' && (
          <div className="px-2 sm:px-0">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold inline-block pb-2" style={{ borderBottom: `2px solid ${accentColor}` }}
                contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lrs_catalog_title')}>
                {settings?.lrs_catalog_title || 'منتجات حصرية'}
              </h2>
              <p className="text-sm mt-2" style={{ color: textMuted }}
                contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lrs_catalog_subtitle')}>
                {settings?.lrs_catalog_subtitle || 'تصفح أحدث المنتجات لدينا'}
              </p>
            </div>

            {/* No products placeholder (editor) */}
            {canManage && (!products || products.length === 0) && (
              <div className="py-16 text-center rounded-xl" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, color: textMuted }}>
                <p className="font-bold">أضف منتجات من لوحة التحكم</p>
              </div>
            )}

            {/* Product Grid - Temu Style */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {(products || []).map((product) => {
                const discount = product.original_price 
                  ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
                  : 0;
                const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= 5;
                
                return (
                  <div
                    key={product.id}
                    className="group cursor-pointer rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
                    style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
                    onClick={() => openProduct(product)}
                  >
                    {/* Image / Video */}
                    <div className="relative overflow-hidden" style={{ aspectRatio: '3 / 4', backgroundColor: surfaceMuted }}>
                      {(product as any)?.metadata?.video_url?.match(/\.(mp4|webm|ogg)(\?|$)/i)
                        ? <LazyVideo src={(product as any).metadata.video_url} poster={product.images?.[0] || ''}
                            onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                            onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                            className="w-full h-full object-cover" />
                      : (product as any)?.metadata?.video_url?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
                        ? <iframe className="w-full h-full pointer-events-none" src={`https://www.youtube.com/embed/${(product as any).metadata.video_url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1]}?autoplay=1&mute=1&loop=1&playlist=${(product as any).metadata.video_url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1]}&controls=0`} allow="autoplay; encrypted-media" />
                        : <img
                            src={product.images?.[0] || '/placeholder.png'}
                            alt={product.title}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                      }
                      <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        {discount > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow">
                            -{discount}%
                          </span>
                        )}
                        {isLowStock && (
                          <span className="bg-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow">
                            ⚡ {product.stock_quantity} left
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Info */}
                    <div className="p-3">
                      <h3 className="text-xs font-semibold leading-snug mb-2 line-clamp-2 text-right" style={{ color: textColor }}>
                        {product.title}
                      </h3>
                      {product.original_price && (
                        <div className="text-[10px] line-through text-right mb-0.5" style={{ color: textMuted }}>
                          {Math.round(product.original_price).toLocaleString()} {currency}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-base" style={{ color: accentColor }}>
                          {Math.round(product.price ?? 0).toLocaleString()} <span className="text-xs font-semibold">{currency}</span>
                        </span>
                        {product.views > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(249,115,22,0.1)', color: textMuted }}>
                            🔥 {product.views > 1000 ? `${Math.floor(product.views/1000)}K+` : `${product.views}+`} sold
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            PRODUCT DETAIL VIEW
            ════════════════════════════════════════════════ */}
        {view === 'product' && activeProduct && (
          <div className="px-2 sm:px-0">
            {/* Badge */}
            <div className="inline-block px-3 py-1 rounded text-xs font-bold mb-4" style={{ backgroundColor: accentColor + '20', color: accentColor }}
              contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lrs_product_badge')}>
              {settings?.lrs_product_badge || 'منتج مميز ⭐'}
            </div>

            {/* Main Product Area */}
            <div className="flex flex-col md:flex-row md:items-stretch gap-8 md:p-8 md:rounded-xl shadow-sm md:overflow-hidden" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}>

              {/* Image */}
              {(() => {
                const goTo = (idx: number) => {
                  const clamped = Math.max(0, Math.min(idx, loopedMedia.length - 1));
                  galleryIdxRef.current = clamped;
                  setActiveImageIndex(clamped);
                };
                // Map looped index → real index for dots
                const dotIndex = (() => {
                  const i = activeImageIndex;
                  const n = allMedia.length;
                  if (n <= 1) return i;
                  if (i === 0) return n - 1;
                  if (i === loopedMedia.length - 1) return 0;
                  return i - 1;
                })();

                return (
                  <div className="w-full md:w-1/2 flex flex-col">
                    {/* Main image viewport */}
                    <div className="aspect-[4/5] md:aspect-auto md:flex-1 md:min-h-[400px] md:max-h-[75vh] md:rounded-xl select-none" style={{ backgroundColor: surfaceMuted, position: 'relative', touchAction: 'pan-y', overflow: 'hidden' }}
                      onTouchStart={e => {
                        const t = e.currentTarget as any;
                        t._ts = e.touches[0].clientX;
                        t._tsy = e.touches[0].clientY;
                      }}
                      onTouchEnd={e => {
                        const t = e.currentTarget as any;
                        const dx = t._ts - e.changedTouches[0].clientX;
                        const dy = t._tsy - e.changedTouches[0].clientY;
                        if (t._ts == null || Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
                        dx > 0 ? goTo(galleryIdxRef.current + 1) : goTo(galleryIdxRef.current - 1);
                      }}>
                      {allMedia.length > 0 ? (
                        <div ref={galleryStripRef}
                          style={{ position: 'absolute', top: 0, left: 0, bottom: 0, display: 'flex', direction: 'ltr', transform: `translateX(-${(activeImageIndex * 100) / loopedMedia.length}%)`, transition: `transform ${wrapRef.current ? '0s' : '0.3s'} ease`, willChange: 'transform', width: `${loopedMedia.length * 100}%` }}>
                          {loopedMedia.map((item, i) => (
                            <div key={i} style={{ width: `${100 / loopedMedia.length}%`, flexShrink: 0, height: '100%', overflow: 'hidden' }} onClick={() => item.type === 'image' && setLightboxOpen(true)}>
                              {item.type === 'video' ? (
                                item.embed.type === 'youtube' ? (
                                  <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${item.embed.id}?autoplay=1&mute=1&loop=1&playlist=${item.embed.id}`} allow="autoplay; encrypted-media" allowFullScreen />
                                ) : item.embed.type === 'video' ? (
                                  <video className="w-full h-full object-cover" src={item.embed.url} autoPlay muted loop playsInline preload="metadata" />
                                ) : (
                                  <iframe className="w-full h-full" src={item.embed.url} allowFullScreen />
                                )
                              ) : (
                                <img src={item.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', cursor: 'pointer' }} loading="lazy" decoding="async" />
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textMuted }}><span>لا توجد صور</span></div>
                      )}
                      {allMedia.length > 1 && (
                        <>
                          <button onClick={e => { e.stopPropagation(); goTo(galleryIdxRef.current - 1); }} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center z-10 opacity-70 hover:opacity-100 transition-opacity" style={{ backgroundColor: 'rgba(0,0,0,0.45)', color: '#fff' }}><ChevronLeft className="w-5 h-5" /></button>
                          <button onClick={e => { e.stopPropagation(); goTo(galleryIdxRef.current + 1); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center z-10 opacity-70 hover:opacity-100 transition-opacity" style={{ backgroundColor: 'rgba(0,0,0,0.45)', color: '#fff' }}><ChevronRight className="w-5 h-5" /></button>
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                            {allMedia.map((_, i) => <span key={i} className="w-1.5 h-1.5 rounded-full transition-all" style={{ backgroundColor: i === dotIndex ? '#fff' : 'rgba(255,255,255,0.4)', transform: i === dotIndex ? 'scale(1.4)' : 'scale(1)' }} />)}
                          </div>
                        </>
                      )}
                    </div>
                    {/* Thumbnails */}
                    {allMedia.length > 1 && (
                      <div ref={thumbnailRowRef} className="flex gap-3 mt-4 overflow-x-auto pb-1 px-2 md:px-0" style={{ direction: 'ltr' }}>
                        {allMedia.map((item, i) => (
                          <button key={i} onClick={() => goTo(i + 1)} className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden cursor-pointer transition-all" style={{ border: `3px solid ${i === dotIndex ? accentColor : 'transparent'}`, opacity: i === dotIndex ? 1 : 0.6 }}>
                            {item.type === 'video' ? (
                              <div className="w-full h-full relative">
                                {item.embed.type === 'youtube' ? (
                                  <img src={`https://img.youtube.com/vi/${item.embed.id}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" style={{ contentVisibility: 'auto' }} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: '#000' }} />
                                )}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white" className="drop-shadow-lg"><polygon points="5,3 19,12 5,21"/></svg>
                                </div>
                              </div>
                            ) : (
                              <img src={item.src} alt="" className="w-full h-full object-contain" loading="lazy" decoding="async" style={{ contentVisibility: 'auto' }} />
                            )}
                          </button>
                        ))}
                      </div>)}
                  </div>
                );
              })()}

              {/* Details + Form */}
              <div className="w-full md:w-1/2 flex flex-col justify-center px-4 pb-4 md:px-0 md:pb-0">
                <h1 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: textColor }}>
                  {activeProduct.title}
                </h1>

                <div className="flex items-center gap-2 mb-2"><Stars /></div>

                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl font-black" style={{ color: accentColor }}>{Math.round(activeProduct.price ?? 0).toLocaleString()} {currency}</span>
                  {comparePrice && (
                    <span className="text-lg line-through" style={{ color: textMuted }}>{Math.round(comparePrice ?? 0).toLocaleString()} {currency}</span>
                  )}
                </div>

                {/* Trust badges — Hijab Saba style */}
                <div className="flex items-center justify-center gap-6 py-3 mb-4 border rounded-xl" style={{ borderColor: borderColor, backgroundColor: surfaceMuted }}>
                  <div className="flex flex-col items-center gap-1">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5a2 2 0 01-2 2h-1"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                    <span className="text-[10px] font-bold" style={{ color: textColor }}>توصيل 1-3 أيام</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1018 0 9 9 0 00-18 0"/><path d="M12 8v4l2 2"/></svg>
                    <span className="text-[10px] font-bold" style={{ color: textColor }}>إمكانية الإرجاع</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
                    <span className="text-[10px] font-bold" style={{ color: textColor }}>الدفع عند الاستلام</span>
                  </div>
                </div>

                {/* Free shipping banner */}
                <div className="text-center py-2.5 mb-4 rounded-xl text-sm font-bold" style={{ backgroundColor: accentColor + '15', color: accentColor }}>
                  🚚 التوصيل ابتداءً من 300 دج
                </div>

                {/* Product description — structured */}
                {activeProduct.description && (
                  <div className="relative mb-4">
                    <div
                      className="text-sm leading-loose overflow-hidden transition-all duration-300 text-left"
                      style={{
                        color: textColor,
                        display: '-webkit-box',
                        WebkitLineClamp: descExpanded ? 'unset' : 4,
                        WebkitBoxOrient: 'vertical',
                      }}
                      dangerouslySetInnerHTML={{ __html: activeProduct.description }}
                    />
                    {activeProduct.description.split('\n').length > 4 && (
                      <button
                        onClick={() => setDescExpanded(!descExpanded)}
                        className="text-xs font-bold mt-1 text-center w-full"
                        style={{ color: accentColor }}
                      >
                        {descExpanded ? 'عرض أقل ▲' : 'عرض المزيد ▼'}
                      </button>
                    )}
                  </div>
                )}

                {/* Feature bullets (editable) */}
                <ul className="space-y-2 text-sm mb-6 font-semibold text-left" style={{ color: textMuted }}>
                  {[
                    { key: 'lrs_bullet1', def: '👑 جودة عالية - منتج أصلي وموثوق' },
                    { key: 'lrs_bullet2', def: '💼 شحن سريع إلى 58 ولاية' },
                  ].map(({ key, def }) => (
                    <li key={key} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit(key)}>
                      {settings?.[key] || def}
                    </li>
                  ))}
                </ul>

                {/* ── Order Form ────────────────────────── */}
                <div id="lrs-order-form" className="p-4 md:p-5 rounded-xl" style={{ backgroundColor: formBg, border: `1px solid ${borderColor}` }}>
                  <h3 className="font-black text-lg mb-4 text-center" style={{ color: textColor }}>أكمل طلبك</h3>
                  {orderSuccess ? (
                    <div className="py-8 text-center">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: accentColor + '20' }}>
                        <svg width="28" height="28" fill="none" stroke={accentColor} strokeWidth="3" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
                      </div>
                      <h3 className="text-xl font-black mb-1" style={{ color: textColor }}>تم تسجيل طلبك بنجاح! 🎉</h3>
                      <p className="text-sm mb-4" style={{ color: textMuted }}>سنتصل بك قريباً لتأكيد الطلب</p>
        <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={lastCustomerPhone || undefined} />
                      <div className="text-right rounded-xl p-4 mb-4 space-y-2" style={{ backgroundColor: surfaceMuted }}>
                        <div className="flex justify-between text-sm">
                          <span>{activeProduct.title} × {quantity}</span>
                          <span className="font-bold">{Math.round(productTotal ?? 0).toLocaleString()} {currency}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span style={{ color: textMuted }}>التوصيل</span>
                          <span className="font-bold">{deliveryFee === 0 ? 'مجاني ✅' : `${deliveryFee} ${currency}`}</span>
                        </div>
                        <div style={{ height: '1px', backgroundColor: borderColor }} className="my-1" />
                        <div className="flex justify-between font-black">
                          <span>المجموع</span>
                          <span style={{ color: accentColor }}>{Math.round(grandTotal ?? 0).toLocaleString()} {currency}</span>
                        </div>
                      </div>
                      <button onClick={goToCatalog} className="px-6 py-2 rounded-lg text-white font-bold" style={{ backgroundColor: accentColor }}>
                        تسوق مرة أخرى
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleOrder} className="space-y-4">

                      {/* 1 ── Offers ───────────────────── */}
                      {offers.length > 0 && (
                        <OfferSelector
                          offers={offers}
                          unitPrice={unitPrice}
                          currency={currency}
                          selectedOfferId={selectedOffer?.offer_id ?? null}
                          onSelect={handleOfferSelect}
                          accentColor={accentColor}
                          textColor={textColor}
                          borderColor={inputBorderColor}
                          bgColor={cardBg}
                        />
                      )}

                      {/* 2 ── Colors / Sizes (variants) ── */}
                      {activeProduct?.variants && activeProduct.variants.length > 0 && (
                        <VariantSelector
                          variants={activeProduct.variants}
                          selected={selectedVariant}
                          onSelect={setSelectedVariant}
                          accentColor={accentColor}
                          currency={currency}
                          basePrice={activeProduct.price}
                        />
                      )}

                      {/* 3 ── Customer fields ─────────── */}
                      <div className="grid grid-cols-2 gap-4">
                        <input required name="name" type="text" placeholder="الإسم واللقب" className="w-full px-4 py-3.5 rounded-xl text-base md:text-sm outline-none transition-colors" style={{ border: `1px solid ${inputBorderColor}`, backgroundColor: inputBg, color: textColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = inputBorderColor} />
                        <input required name="phone" type="tel" maxLength={10} placeholder="رقم الهاتف" className="w-full px-4 py-3.5 rounded-xl text-base md:text-sm outline-none transition-colors text-right" dir="ltr" style={{ border: `1px solid ${inputBorderColor}`, backgroundColor: inputBg, color: textColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = inputBorderColor} />
                      </div>
                      <div className={`grid gap-4 ${showCommune ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        <select required name="wilaya" value={selectedWilayaId ?? ''} onChange={(e) => setSelectedWilayaId(Number(e.target.value) || null)} className="w-full px-4 py-3.5 rounded-xl text-base md:text-sm outline-none appearance-none transition-colors" style={{ border: `1px solid ${inputBorderColor}`, backgroundColor: inputBg, color: textColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = inputBorderColor}>
                          <option value="">الولاية</option>
                          {wilayas.map(w => <option key={w.id} value={w.id}>{w.labelAR}</option>)}
                        </select>
                        {showCommune && (
                          <div className="relative">
                            <select name="commune" required disabled={!selectedWilayaId} value={communeId} onChange={(e) => setCommuneId(e.target.value)} className="w-full px-4 py-3.5 rounded-xl text-base md:text-sm outline-none appearance-none transition-colors disabled:opacity-50" style={{ border: `1px solid ${inputBorderColor}`, backgroundColor: inputBg, color: textColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = inputBorderColor}>
                              <option value="">{selectedWilayaId ? 'البلدية' : 'اختر الولاية أولاً'}</option>
                              {communes.map(c => <option key={c.id} value={c.id}>{communeDisplayName(c)}</option>)}
                            </select>
                            <ChevronDown size={18} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: textMuted }} />
                          </div>)}
                      </div>
                      <div className="flex gap-3">
                        {showHomeDelivery && (
                          <button type="button" onClick={() => setSelectedDeliveryType('home')} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
                            style={{ backgroundColor: selectedDeliveryType === 'home' ? accentColor : inputBg, border: `1px solid ${inputBorderColor}`, color: selectedDeliveryType === 'home' ? '#ffffff' : textColor }}>
                            <span>توصيل للمنزل</span>
                          </button>
                        )}
                        {showDeskDelivery && (
                          <button type="button" onClick={() => setSelectedDeliveryType('desk')} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
                            style={{ backgroundColor: selectedDeliveryType === 'desk' ? accentColor : inputBg, border: `1px solid ${inputBorderColor}`, color: selectedDeliveryType === 'desk' ? '#ffffff' : textColor }}>
                            <span>استلام من المكتب</span>
                          </button>
                        )}
                      </div>
                      {showAddress && (
                        <input name="address" type="text" placeholder="العنوان الكامل (إختياري)" className="w-full px-4 py-3.5 rounded-xl text-base md:text-sm outline-none transition-colors" style={{ border: `1px solid ${inputBorderColor}`, backgroundColor: inputBg, color: textColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = inputBorderColor} />
                      )}
                      {showNotes && (
                        <textarea name="notes" placeholder="ملاحظات إضافية" rows={2} className="w-full px-4 py-3.5 rounded-xl text-base md:text-sm outline-none resize-none transition-colors" style={{ border: `1px solid ${inputBorderColor}`, backgroundColor: inputBg, color: textColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = inputBorderColor} />
                      )}

                      {/* 4 ── Quantity ─────────────────── */}
                      <div className="flex items-center gap-3 pt-1">
                        <span className="text-sm font-bold" style={{ color: textMuted }}>الكمية</span>
                        <div className="flex items-center rounded-xl px-2" style={{ border: `1px solid ${borderColor}`, backgroundColor: inputBg }}>
                          <button type="button" className="px-3 py-1 font-bold text-lg hover:opacity-70" style={{ color: textMuted }} onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
                          <span className="w-8 text-center font-bold text-sm" style={{ color: textColor }}>{quantity}</span>
                          <button type="button" className="px-3 py-1 font-bold text-lg hover:opacity-70" style={{ color: textMuted }} onClick={() => setQuantity(q => q + 1)}>+</button>
                        </div>
                        <span className="text-sm font-semibold" style={{ color: accentColor }}>
                          {Math.round(productTotal ?? 0).toLocaleString()} {currency}
                        </span>
                      </div>

                      {/* 5 ── Order summary ────────────── */}
                      {selectedWilayaId && (
                        <div className="pt-2 space-y-1 text-sm" style={{ borderTop: `1px solid ${borderColor}` }}>
                          <div className="flex justify-between">
                            <span className="font-bold">{Math.round(productTotal ?? 0).toLocaleString()} {currency}</span>
                            <span style={{ color: textMuted }}>سعر المنتجات</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-bold">{deliveryFee === 0 ? 'مجاني ✅' : `${deliveryFee} ${currency}`}</span>
                            <span style={{ color: textMuted }}>التوصيل</span>
                          </div>
                          <div className="flex justify-between pt-2" style={{ borderTop: `1px solid ${borderColor}` }}>
                            <span className="font-black text-lg" style={{ color: accentColor }}>{Math.round(grandTotal ?? 0).toLocaleString()} {currency}</span>
                            <span className="font-bold">المجموع</span>
                          </div>
                        </div>
                      )}

                      {/* ── Error banner ────────────────────────── */}
                      {orderError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-bold px-4 py-3 rounded-xl text-center whitespace-pre-line text-start mb-3" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#dc2626' }}>
                          {orderError}
                        </div>
                      )}

                      {/* 6 ── Submit button ────────────── */}
                      <button disabled={isSubmitting} type="submit" className="w-full font-bold py-4 px-4 rounded-xl text-white shadow-md transition-transform hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 text-base" style={{ backgroundColor: accentColor }}>
                        {isSubmitting ? 'جاري المعالجة...' : 'اطلب الآن'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>

            {/* ── Info images (uploadable) ──────────────── */}
            {(canManage || infoImg1 || infoImg2) && (
            <div className="my-10 max-w-2xl mx-auto rounded-xl overflow-hidden shadow-sm">
              {(canManage || infoImg1) && (
              <ImageSlot src={infoImg1} settingKey="lrs_info_img1" setter={setInfoImg1}
                inputRef={info1Ref as React.RefObject<HTMLInputElement>} className="w-full" placeholder="رفع صورة (مزايا المنتج)" />
              )}
              {(canManage || infoImg2) && (
              <ImageSlot src={infoImg2} settingKey="lrs_info_img2" setter={setInfoImg2}
                inputRef={info2Ref as React.RefObject<HTMLInputElement>} className="w-full mt-2" placeholder="رفع صورة (تفاصيل إضافية)" />
              )}
            </div>
            )}

            {/* ── Related Products ──────────────────────── */}
            {relatedProducts.length > 0 && (
              <div className="mt-16">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold" style={{ color: textColor }}
                    contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lrs_related_title')}>
                    {settings?.lrs_related_title || 'منتجات أخرى تهمك'}
                  </h2>
                  <p className="text-sm mt-1" style={{ color: textMuted }}
                    contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lrs_related_subtitle')}>
                    {settings?.lrs_related_subtitle || 'توصيل مجاني عند طلب أكثر من منتج'}
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                  {relatedProducts.map((product) => {
                    const discount = product.original_price 
                      ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
                      : 0;
                    const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= 5;
                    
                    return (
                      <div
                        key={product.id}
                        className="group cursor-pointer rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
                        style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
                        onClick={() => { openProduct(product); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      >
                        {/* Image / Video */}
                        <div className="relative overflow-hidden" style={{ aspectRatio: '3 / 4', backgroundColor: surfaceMuted }}>
                          {(product as any)?.metadata?.video_url?.match(/\.(mp4|webm|ogg)(\?|$)/i)
                            ? <LazyVideo src={(product as any).metadata.video_url} poster={product.images?.[0] || ''}
                                onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                                onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                                className="w-full h-full object-cover" />
                          : (product as any)?.metadata?.video_url?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
                            ? <iframe className="w-full h-full pointer-events-none" src={`https://www.youtube.com/embed/${(product as any).metadata.video_url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1]}?autoplay=1&mute=1&loop=1&playlist=${(product as any).metadata.video_url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1]}&controls=0`} allow="autoplay; encrypted-media" />
                            : <img
                                src={product.images?.[0] || '/placeholder.png'}
                                alt={product.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                          }
                          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          <div className="absolute top-2 left-2 flex flex-col gap-1">
                            {discount > 0 && (
                              <span className="bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow">
                                -{discount}%
                              </span>
                            )}
                            {isLowStock && (
                              <span className="bg-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow">
                                ⚡ {product.stock_quantity} left
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Info */}
                        <div className="p-3">
                          <h3 className="text-xs font-semibold leading-snug mb-2 line-clamp-2 text-right" style={{ color: textColor }}>
                            {product.title}
                          </h3>
                          {product.original_price && (
                            <div className="text-[10px] line-through text-right mb-0.5" style={{ color: textMuted }}>
                              {Math.round(product.original_price).toLocaleString()} {currency}
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-base" style={{ color: accentColor }}>
                              {Math.round(product.price ?? 0).toLocaleString()} <span className="text-xs font-semibold">{currency}</span>
                            </span>
                            {product.views > 0 && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(249,115,22,0.1)', color: textMuted }}>
                                🔥 {product.views > 1000 ? `${Math.floor(product.views/1000)}K+` : `${product.views}+`} sold
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── FOOTER ────────────────────────────────────── */}
      <footer className="py-6 text-center text-xs" style={{ color: textMuted, borderTop: `1px solid ${borderColor}` }}>
        © {new Date().getFullYear()} {settings?.store_name || 'متجري'}. جميع الحقوق محفوظة · صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a>
      </footer>

      {/* ── STICKY BOTTOM CTA (product view, mobile only) */}
      {view === 'product' && !orderSuccess && (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden" style={{ backgroundColor: cardBg, boxShadow: '0 -2px 10px rgba(0,0,0,0.1)', padding: '10px 20px' }}>
          <button onClick={scrollToForm} className="w-full font-bold py-3 rounded text-lg shadow-lg text-white" style={{ backgroundColor: accentColor }}>
            اطلب الآن
          </button>
        </div>
      )}

      {/* ── LIGHTBOX ──────────────────────────────────── */}
      {lightboxOpen && activeProduct && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90" onClick={() => setLightboxOpen(false)}>
          <button className="absolute top-4 right-4 text-white text-4xl font-bold hover:opacity-70 z-10" onClick={() => setLightboxOpen(false)}>✕</button>
          {activeProduct.images?.length > 1 && (
            <>
              <button className="absolute left-4 text-white text-4xl font-bold hover:opacity-70 z-10" onClick={(e) => { e.stopPropagation(); setLightboxImgIdx(i => (i + 1) % activeProduct.images.length); }}>‹</button>
              <button className="absolute right-14 text-white text-4xl font-bold hover:opacity-70 z-10" onClick={(e) => { e.stopPropagation(); setLightboxImgIdx(i => (i - 1 + activeProduct.images.length) % activeProduct.images.length); }}>›</button>
            </>
          )}
          <img
            src={activeProduct.images?.[lightboxImgIdx] || activeProduct.images?.[0] || '/placeholder.png'}
            alt={activeProduct.title}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
