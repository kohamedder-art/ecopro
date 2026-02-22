import React from 'react';
import {
  formatWilayaLabel,
  getAlgeriaCommuneById,
  getAlgeriaCommunesByWilayaId,
  getAlgeriaWilayaById,
  getAlgeriaWilayas,
} from '@/lib/algeriaGeo';

type Theme = {
  bg: string;
  text: string;
  muted: string;
  accent: string;
  cardBg: string;
  border: string;
};

type ProductLike = {
  id: number;
  title?: string;
  name?: string;
  price: number;
  images?: string[];
  stock_quantity?: number;
  metadata?: any;
};

export default function EmbeddedCheckout(props: {
  storeSlug: string;
  product?: ProductLike;
  formatPrice: (n: number) => string;
  theme: Theme;
  disabled?: boolean;
  heading?: string;
  subheading?: string;
  dir?: 'rtl' | 'ltr';
}) {
  const {
    storeSlug,
    product,
    formatPrice,
    theme,
    disabled = false,
    heading = 'Checkout',
    subheading,
    dir = 'ltr',
  } = props;

  const dzWilayas = getAlgeriaWilayas();

  const [quantity, setQuantity] = React.useState(1);
  const [deliveryType, setDeliveryType] = React.useState<'home' | 'desk'>('home');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [orderStatus, setOrderStatus] = React.useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });
  const [telegramStartUrl, setTelegramStartUrl] = React.useState<string | null>(null);

  const [telegramBotInfo, setTelegramBotInfo] = React.useState<
    | {
        enabled?: boolean;
        botUsername?: string;
        botUrl?: string;
        storeName?: string;
      }
    | null
  >(null);
  const [telegramConnected, setTelegramConnected] = React.useState(false);
  const [checkingTelegramConnection, setCheckingTelegramConnection] = React.useState(false);

  const [messengerInfo, setMessengerInfo] = React.useState<
    | {
        enabled?: boolean;
        storeName?: string;
        pageId?: string;
        url?: string;
        refToken?: string;
      }
    | null
  >(null);
  const [messengerConnected, setMessengerConnected] = React.useState(false);
  const [checkingMessengerConnection, setCheckingMessengerConnection] = React.useState(false);
  const [waitingForMessengerConnection, setWaitingForMessengerConnection] = React.useState(false);

  const [formData, setFormData] = React.useState({
    fullName: '',
    phone: '',
    address: '',
    wilayaId: '',
    communeId: '',
  });

  const [haiSuggestions, setHaiSuggestions] = React.useState<string[]>([]);
  const [haiSuggestionsSupported, setHaiSuggestionsSupported] = React.useState(true);

  const [deliveryPriceHome, setDeliveryPriceHome] = React.useState<number | null>(null);
  const [deliveryPriceDesk, setDeliveryPriceDesk] = React.useState<number | null>(null);
  const [loadingDeliveryPrice, setLoadingDeliveryPrice] = React.useState(false);

  const dzCommunes = getAlgeriaCommunesByWilayaId(formData.wilayaId);

  React.useEffect(() => {
    setTelegramStartUrl(null);
    setOrderStatus({ type: null, message: '' });
  }, [product?.id]);

  React.useEffect(() => {
    // Reset delivery type when switching products.
    setDeliveryType('home');
  }, [product?.id]);

  // Fetch Telegram bot info for this store
  React.useEffect(() => {
    const fetchTelegramInfo = async () => {
      if (!storeSlug) return;
      try {
        const res = await fetch(`/api/telegram/bot-link/${encodeURIComponent(storeSlug)}`);
        if (res.ok) {
          const data = await res.json();
          setTelegramBotInfo(data);
        }
      } catch (error) {
        console.error('Failed to fetch Telegram info:', error);
      }
    };
    fetchTelegramInfo();
  }, [storeSlug]);

  // Fetch Messenger info for this store
  React.useEffect(() => {
    const fetchMessengerInfo = async () => {
      if (!storeSlug) return;
      try {
        const res = await fetch(`/api/messenger/page-link/${encodeURIComponent(storeSlug)}`);
        if (res.ok) {
          const data = await res.json();
          setMessengerInfo(data);
        }
      } catch (error) {
        console.error('Failed to fetch Messenger info:', error);
      }
    };
    fetchMessengerInfo();
  }, [storeSlug]);

  // Check Telegram connection when phone changes
  React.useEffect(() => {
    const checkConnection = async () => {
      const normalizedPhone = (formData.phone || '').replace(/\D/g, '');
      if (!storeSlug || normalizedPhone.length < 9) {
        setTelegramConnected(false);
        return;
      }

      setCheckingTelegramConnection(true);
      try {
        const res = await fetch(
          `/api/telegram/check-connection/${encodeURIComponent(storeSlug)}?phone=${encodeURIComponent(normalizedPhone)}`
        );
        if (res.ok) {
          const data = await res.json();
          setTelegramConnected(Boolean(data?.connected));
        }
      } catch (error) {
        console.error('Failed to check Telegram connection:', error);
      } finally {
        setCheckingTelegramConnection(false);
      }
    };

    const timeout = window.setTimeout(checkConnection, 500);
    return () => window.clearTimeout(timeout);
  }, [storeSlug, formData.phone]);

  // Check Messenger connection when phone changes
  React.useEffect(() => {
    const checkConnection = async () => {
      const normalizedPhone = (formData.phone || '').replace(/\D/g, '');
      if (!storeSlug || normalizedPhone.length < 9) {
        setMessengerConnected(false);
        return;
      }

      setCheckingMessengerConnection(true);
      try {
        const res = await fetch(
          `/api/messenger/check-connection/${encodeURIComponent(storeSlug)}?phone=${encodeURIComponent(normalizedPhone)}`
        );
        if (res.ok) {
          const data = await res.json();
          setMessengerConnected(Boolean(data?.connected));
          if (data?.connected) setWaitingForMessengerConnection(false);
        }
      } catch (error) {
        console.error('Failed to check Messenger connection:', error);
      } finally {
        setCheckingMessengerConnection(false);
      }
    };

    const timeout = window.setTimeout(checkConnection, 500);
    return () => window.clearTimeout(timeout);
  }, [storeSlug, formData.phone]);

  React.useEffect(() => {
    let stopped = false;

    const loadHaiSuggestions = async () => {
      if (disabled || !haiSuggestionsSupported || !storeSlug || !formData.communeId) {
        setHaiSuggestions([]);
        return;
      }

      try {
        const res = await fetch(
          `/api/storefront/${encodeURIComponent(String(storeSlug))}/address/hai-suggestions?communeId=${encodeURIComponent(
            formData.communeId
          )}`
        );

        if (res.status === 404) {
          if (!stopped) {
            setHaiSuggestions([]);
            setHaiSuggestionsSupported(false);
          }
          return;
        }

        if (!res.ok) {
          if (!stopped) setHaiSuggestions([]);
          return;
        }

        const data = await res.json();
        const values = Array.isArray(data?.suggestions)
          ? data.suggestions
              .map((s: any) => String(s?.value || '').trim())
              .filter((v: string) => v.length > 0)
          : [];
        if (!stopped) setHaiSuggestions(values);
      } catch {
        if (!stopped) setHaiSuggestions([]);
      }
    };

    loadHaiSuggestions();
    return () => {
      stopped = true;
    };
  }, [disabled, haiSuggestionsSupported, storeSlug, formData.communeId]);

  React.useEffect(() => {
    let cancelled = false;

    const fetchDeliveryPrice = async () => {
      const shippingMeta: any = (product as any)?.metadata?.shipping || null;
      const shippingMode = shippingMeta?.mode || shippingMeta?.shipping_mode || null;
      if (shippingMode === 'free') {
        setDeliveryPriceHome(0);
        setDeliveryPriceDesk(0);
        setLoadingDeliveryPrice(false);
        return;
      }
      if (shippingMode === 'flat') {
        const fee = Number(shippingMeta?.flat_fee ?? shippingMeta?.flatFee ?? shippingMeta?.shipping_flat_fee ?? 0);
        const safeFee = Number.isFinite(fee) && fee >= 0 ? fee : 0;
        setDeliveryPriceHome(safeFee);
        setDeliveryPriceDesk(safeFee);
        setLoadingDeliveryPrice(false);
        return;
      }

      if (disabled || !storeSlug || !formData.wilayaId) {
        setDeliveryPriceHome(null);
        setDeliveryPriceDesk(null);
        setLoadingDeliveryPrice(false);
        return;
      }

      setLoadingDeliveryPrice(true);
      try {
        const res = await fetch(
          `/api/storefront/${encodeURIComponent(String(storeSlug))}/delivery-prices?wilaya_id=${encodeURIComponent(
            String(formData.wilayaId)
          )}`
        );

        if (!res.ok) {
          if (!cancelled) {
            setDeliveryPriceHome(null);
            setDeliveryPriceDesk(null);
          }
          return;
        }

        const data = await res.json();
        if (data?.price) {
          const home = data.price.home_delivery_price;
          const desk = data.price.desk_delivery_price;
          if (!cancelled) {
            setDeliveryPriceHome(home == null ? null : Number(home));
            setDeliveryPriceDesk(desk == null ? null : Number(desk));
          }
        } else if (data?.default_price != null) {
          const fallback = Number(data.default_price);
          if (!cancelled) {
            setDeliveryPriceHome(Number.isFinite(fallback) ? fallback : null);
            setDeliveryPriceDesk(null);
          }
        } else {
          if (!cancelled) {
            setDeliveryPriceHome(null);
            setDeliveryPriceDesk(null);
          }
        }
      } catch {
        if (!cancelled) {
          setDeliveryPriceHome(null);
          setDeliveryPriceDesk(null);
        }
      } finally {
        if (!cancelled) setLoadingDeliveryPrice(false);
      }
    };

    fetchDeliveryPrice();
    return () => {
      cancelled = true;
    };
  }, [disabled, storeSlug, formData.wilayaId, product]);

  const title = product ? String(product.title || product.name || 'Product') : 'Product';
  const price = product ? Number(product.price) || 0 : 0;
  const subtotal = price * quantity;
  const deliveryFee = deliveryType === 'desk' ? (deliveryPriceDesk ?? deliveryPriceHome) : deliveryPriceHome;
  const total = subtotal + (deliveryFee || 0);

  const deskUnavailable = deliveryPriceDesk == null && deliveryPriceHome != null;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    padding: '7px 10px',
    background: disabled ? 'rgba(0,0,0,0.03)' : theme.bg,
    color: theme.text,
    outline: 'none',
    fontSize: 12,
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'none',
  };

  const handleConnectTelegram = async () => {
    const botUsername = telegramBotInfo?.botUsername;
    if (!storeSlug || !botUsername) return;

    // Open window synchronously to avoid popup blocker
    const win = window.open('about:blank', '_blank');
    let url = `https://t.me/${botUsername}`;
    const normalizedPhone = (formData.phone || '').replace(/\D/g, '');
    if (normalizedPhone.length >= 9) {
      try {
        const res = await fetch(
          `/api/telegram/bot-link/${encodeURIComponent(storeSlug)}?phone=${encodeURIComponent(normalizedPhone)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.botUrl) url = String(data.botUrl);
        }
      } catch (error) {
        console.error('Failed to get Telegram link:', error);
      }
    }

    if (win) {
      win.location.href = url;
    } else {
      window.open(url, '_blank');
    }
  };

  const handleConnectMessenger = async () => {
    const normalizedPhone = (formData.phone || '').replace(/\D/g, '');
    const pageId = messengerInfo?.pageId;
    if (!storeSlug || !pageId) return;

    // Open window synchronously to avoid popup blocker
    const win = window.open('about:blank', '_blank');
    let url = messengerInfo?.url || `https://m.me/${encodeURIComponent(pageId)}`;
    if (normalizedPhone.length >= 9) {
      try {
        const res = await fetch(
          `/api/messenger/page-link/${encodeURIComponent(storeSlug)}?phone=${encodeURIComponent(normalizedPhone)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.url) url = String(data.url);
        }
      } catch (error) {
        console.error('Failed to get Messenger link:', error);
      }
    }

    setWaitingForMessengerConnection(true);
    if (win) {
      win.location.href = url;
    } else {
      window.open(url, '_blank');
    }
  };

  const submit = async () => {
    setOrderStatus({ type: null, message: '' });
    setTelegramStartUrl(null);

    if (disabled) return;
    if (!storeSlug) {
      setOrderStatus({ type: 'error', message: 'Store not ready. Please refresh.' });
      return;
    }
    if (!product?.id) {
      setOrderStatus({ type: 'error', message: 'Please select a product first.' });
      return;
    }

    if (deliveryType === 'desk' && deskUnavailable) {
      setOrderStatus({
        type: 'error',
        message: dir === 'rtl' ? 'توصيل إلى مكتب غير متوفر لهذه الولاية' : 'Desk delivery is not available for this state.',
      });
      return;
    }

    const missing: string[] = [];
    if (!formData.fullName.trim()) missing.push(dir === 'rtl' ? 'الاسم الكامل' : 'Full Name');
    if (!formData.phone.trim()) missing.push(dir === 'rtl' ? 'رقم الهاتف' : 'Phone');
    if (formData.phone && !/^\+?[0-9]{7,}$/.test(formData.phone.replace(/\s/g, ''))) {
      setOrderStatus({ type: 'error', message: dir === 'rtl' ? 'رقم الهاتف غير صالح' : 'Invalid phone number' });
      return;
    }
    if (!formData.wilayaId) missing.push(dir === 'rtl' ? 'الولاية' : 'State');
    if (!formData.communeId) missing.push(dir === 'rtl' ? 'البلدية' : 'City');
    if (deliveryType === 'home' && !formData.address.trim()) missing.push(dir === 'rtl' ? 'العنوان' : 'Address');

    if (missing.length) {
      setOrderStatus({ type: 'error', message: `${dir === 'rtl' ? 'يرجى ملء' : 'Please fill'}: ${missing.join(', ')}` });
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedWilaya = getAlgeriaWilayaById(formData.wilayaId);
      const selectedCommune = getAlgeriaCommuneById(formData.communeId);

      const addressParts =
        deliveryType === 'home'
          ? [formData.address, selectedCommune?.name || '', selectedWilaya?.name || '']
          : [selectedCommune?.name || '', selectedWilaya?.name || ''];

      const customerName = formData.fullName.trim();
      const orderData: any = {
        product_id: product.id,
        quantity,
        total_price: price * quantity + (deliveryFee || 0),
        delivery_fee: deliveryFee || 0,
        delivery_type: deliveryType,
        customer_name: customerName,
        customer_phone: formData.phone.trim(),
        shipping_wilaya_id: formData.wilayaId ? Number(formData.wilayaId) : null,
        shipping_commune_id: formData.communeId ? Number(formData.communeId) : null,
        customer_address: addressParts.filter(Boolean).join(', '),
      };

      const endpoint = `/api/storefront/${encodeURIComponent(String(storeSlug))}/orders`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setOrderStatus({ type: 'error', message: String(data?.error || 'Order failed. Please try again.') });
        return;
      }

      if (data?.telegramStartUrl) {
        setTelegramStartUrl(String(data.telegramStartUrl));
      }

      setOrderStatus({
        type: 'success',
        message: dir === 'rtl' ? 'تم إرسال الطلب بنجاح ✅' : 'Order placed successfully ✅',
      });
    } catch {
      setOrderStatus({ type: 'error', message: dir === 'rtl' ? 'فشل إرسال الطلب' : 'Failed to place order.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        background: theme.cardBg,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        padding: 12,
        direction: dir,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 13 }}>{heading}</div>
      {subheading ? <div style={{ marginTop: 2, color: theme.muted, fontSize: 11 }}>{subheading}</div> : null}

      <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <div style={{ fontWeight: 900, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          <div style={{ fontWeight: 900, color: theme.accent, fontSize: 13 }}>{formatPrice(price)}</div>
        </div>

        {/* Row 1: Full Name + Phone */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <label style={{ display: 'grid', gap: 3 }}>
            <span style={{ fontSize: 11, color: theme.muted }}>{dir === 'rtl' ? 'الاسم الكامل' : 'Full Name'} *</span>
            <input
              value={formData.fullName}
              disabled={disabled}
              onChange={(e) => setFormData((s) => ({ ...s, fullName: e.target.value }))}
              style={inputStyle}
              placeholder={dir === 'rtl' ? 'الاسم الكامل' : 'Full name'}
            />
          </label>
          <label style={{ display: 'grid', gap: 3 }}>
            <span style={{ fontSize: 11, color: theme.muted }}>{dir === 'rtl' ? 'رقم الهاتف' : 'Phone'} *</span>
            <input
              type="tel"
              value={formData.phone}
              disabled={disabled}
              onChange={(e) => setFormData((s) => ({ ...s, phone: e.target.value }))}
              style={inputStyle}
              placeholder="0XXX XXX XXX"
              dir="ltr"
            />
          </label>
        </div>
        {formData.phone && !/^\+?[0-9]{7,}$/.test(formData.phone.replace(/\s/g, '')) && (
          <span style={{ fontSize: 11, color: '#ef4444', marginTop: -4 }}>{dir === 'rtl' ? 'رقم الهاتف غير صالح' : 'Invalid phone number'}</span>
        )}

        {/* Row 2: Wilaya + Commune */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <label style={{ display: 'grid', gap: 3 }}>
            <span style={{ fontSize: 11, color: theme.muted }}>{dir === 'rtl' ? 'الولاية' : 'State'} *</span>
            <select
              value={formData.wilayaId}
              disabled={disabled}
              onChange={(e) => setFormData((s) => ({ ...s, wilayaId: e.target.value, communeId: '' }))}
              style={selectStyle}
            >
              <option value="">{dir === 'rtl' ? 'اختر ولاية' : 'Select state'}</option>
              {dzWilayas.map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {formatWilayaLabel(w)}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 3 }}>
            <span style={{ fontSize: 11, color: theme.muted }}>{dir === 'rtl' ? 'البلدية' : 'City'} *</span>
            <select
              value={formData.communeId}
              disabled={disabled || !formData.wilayaId}
              onChange={(e) => setFormData((s) => ({ ...s, communeId: e.target.value }))}
              style={{ ...selectStyle, opacity: !formData.wilayaId ? 0.6 : 1 }}
            >
              <option value="">{formData.wilayaId ? (dir === 'rtl' ? 'اختر بلدية' : 'Select city') : (dir === 'rtl' ? 'اختر الولاية أولاً' : 'Select state first')}</option>
              {dzCommunes.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Delivery Type */}
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ fontSize: 11, color: theme.muted }}>{dir === 'rtl' ? 'نوع التوصيل' : 'Delivery type'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              type="button"
              disabled={disabled || deskUnavailable}
              onClick={() => {
                if (disabled || deskUnavailable) return;
                setDeliveryType('desk');
                setFormData((s) => ({ ...s, address: '' }));
              }}
              style={{
                borderRadius: 8,
                border: `1px solid ${theme.border}`,
                padding: '7px 10px',
                background: deliveryType === 'desk' ? theme.accent : theme.bg,
                color: deliveryType === 'desk' ? '#fff' : theme.text,
                cursor: disabled || deskUnavailable ? 'not-allowed' : 'pointer',
                fontWeight: 900,
                fontSize: 12,
                opacity: deskUnavailable ? 0.6 : 1,
                textAlign: dir === 'rtl' ? 'right' : 'left',
              }}
            >
              {dir === 'rtl' ? 'إلى المكتب' : 'Desk'}
              <div style={{ marginTop: 1, fontSize: 10, fontWeight: 700, opacity: deliveryType === 'desk' ? 0.85 : 0.7 }}>
                {deskUnavailable
                  ? dir === 'rtl'
                    ? 'غير متوفر'
                    : 'Unavailable'
                  : deliveryPriceDesk != null
                    ? formatPrice(deliveryPriceDesk)
                    : loadingDeliveryPrice
                    ? 'Loading…'
                    : 'TBD'}
              </div>
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                setDeliveryType('home');
              }}
              style={{
                borderRadius: 8,
                border: `1px solid ${theme.border}`,
                padding: '7px 10px',
                background: deliveryType === 'home' ? theme.accent : theme.bg,
                color: deliveryType === 'home' ? '#fff' : theme.text,
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontWeight: 900,
                fontSize: 12,
                textAlign: dir === 'rtl' ? 'right' : 'left',
              }}
            >
              {dir === 'rtl' ? 'إلى المنزل' : 'Home'}
              <div style={{ marginTop: 1, fontSize: 10, fontWeight: 700, opacity: deliveryType === 'home' ? 0.85 : 0.7 }}>
                {deliveryPriceHome != null ? formatPrice(deliveryPriceHome) : loadingDeliveryPrice ? 'Loading…' : 'TBD'}
              </div>
            </button>
          </div>
        </div>

        {/* Address (only for home delivery) */}
        {deliveryType === 'home' && (
          <label style={{ display: 'grid', gap: 3 }}>
            <span style={{ fontSize: 11, color: theme.muted }}>{dir === 'rtl' ? 'العنوان' : 'Address'} *</span>
            <input
              value={formData.address}
              disabled={disabled}
              onChange={(e) => setFormData((s) => ({ ...s, address: e.target.value }))}
              style={inputStyle}
              placeholder={dir === 'rtl' ? 'شارع، حي...' : 'Street, neighborhood...'}
            />
          </label>
        )}

        {telegramBotInfo && storeSlug && (
          <div style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.cardBg }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 900, opacity: 0.75 }}>Telegram (Optional)</div>
              <div style={{ fontSize: 10 }}>
                {checkingTelegramConnection
                  ? 'Checking…'
                  : telegramConnected
                  ? 'Connected ✓'
                  : telegramBotInfo.enabled
                  ? 'Not connected'
                  : 'Unavailable'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleConnectTelegram}
              disabled={
                !telegramBotInfo.enabled ||
                (formData.phone || '').replace(/\D/g, '').length < 9
              }
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: 8,
                border: `1px solid ${theme.border}`,
                background: theme.accent,
                color: '#fff',
                fontWeight: 900,
                fontSize: 11,
                cursor: !telegramBotInfo.enabled || (formData.phone || '').replace(/\D/g, '').length < 9 ? 'not-allowed' : 'pointer',
                opacity: !telegramBotInfo.enabled || (formData.phone || '').replace(/\D/g, '').length < 9 ? 0.6 : 1,
              }}
            >
              {telegramBotInfo.enabled ? 'Connect Telegram' : 'Telegram Unavailable'}
            </button>
            {!telegramBotInfo.enabled && (
              <div style={{ marginTop: 4, fontSize: 9, opacity: 0.6 }}>Telegram is not configured for this store.</div>
            )}
            <div style={{ marginTop: 4, fontSize: 9, opacity: 0.6 }}>Add your phone number first, then connect to receive instant order updates.</div>
          </div>
        )}

        {messengerInfo && storeSlug && (
          <div style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.cardBg }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 900, opacity: 0.75 }}>ماسنجر (اختياري)</div>
              <div style={{ fontSize: 10 }}>
                {checkingMessengerConnection
                  ? 'Checking…'
                  : messengerConnected
                  ? 'Connected ✓'
                  : waitingForMessengerConnection
                  ? 'Waiting…'
                  : messengerInfo.enabled
                  ? 'Not connected'
                  : 'Unavailable'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleConnectMessenger}
              disabled={
                !messengerInfo.enabled ||
                (formData.phone || '').replace(/\D/g, '').length < 9 ||
                waitingForMessengerConnection
              }
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: 8,
                border: `1px solid ${theme.border}`,
                background: theme.accent,
                color: '#fff',
                fontWeight: 900,
                fontSize: 11,
                cursor:
                  !messengerInfo.enabled ||
                  (formData.phone || '').replace(/\D/g, '').length < 9 ||
                  waitingForMessengerConnection
                    ? 'not-allowed'
                    : 'pointer',
                opacity:
                  !messengerInfo.enabled ||
                  (formData.phone || '').replace(/\D/g, '').length < 9 ||
                  waitingForMessengerConnection
                    ? 0.6
                    : 1,
              }}
            >
              {waitingForMessengerConnection
                ? 'Connecting…'
                : messengerInfo.enabled
                ? 'Connect Messenger'
                : 'Messenger Unavailable'}
            </button>
            {!messengerInfo.enabled && (
              <div style={{ marginTop: 4, fontSize: 9, opacity: 0.6 }}>Messenger is not configured for this store.</div>
            )}
            <div style={{ marginTop: 4, fontSize: 9, opacity: 0.6 }}>Add your phone number first, then connect to receive instant order updates.</div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', border: `1px solid ${theme.border}`, borderRadius: 8, padding: '8px 10px', background: 'rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 11, color: theme.muted }}>{dir === 'rtl' ? 'الكمية' : 'Quantity'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.bg, cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 900, color: theme.text, fontSize: 13 }}
            >
              −
            </button>
            <div style={{ fontWeight: 900, minWidth: 16, textAlign: 'center', fontSize: 13 }}>{quantity}</div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.bg, cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 900, color: theme.text, fontSize: 13 }}
            >
              +
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, color: theme.muted }}>
            <span>{dir === 'rtl' ? 'المجموع' : 'Subtotal'}</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, color: theme.muted }}>
            <span>{dir === 'rtl' ? 'التوصيل' : 'Delivery'}</span>
            <span>
              {loadingDeliveryPrice
                ? dir === 'rtl'
                  ? '...جارٍ'
                  : '...'
                : formatPrice(deliveryFee || 0)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, fontWeight: 900 }}>
            <span>{dir === 'rtl' ? 'الإجمالي' : 'Total'}</span>
            <span style={{ color: theme.accent }}>{formatPrice(total)}</span>
          </div>
        </div>

        <button
          type="button"
          disabled={disabled || isSubmitting}
          onClick={submit}
          style={{
            width: '100%',
            background: theme.accent,
            border: 0,
            borderRadius: 10,
            padding: '10px 14px',
            fontWeight: 950,
            cursor: disabled || isSubmitting ? 'not-allowed' : 'pointer',
            color: '#fff',
            fontSize: 13,
            opacity: disabled || isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting ? (dir === 'rtl' ? 'جارٍ الإرسال...' : 'Processing...') : dir === 'rtl' ? 'إرسال الطلب' : 'Place Order'}
        </button>

        {orderStatus.type && (
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              background: orderStatus.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${orderStatus.type === 'success' ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)'}`,
              color: orderStatus.type === 'success' ? '#166534' : '#991b1b',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {orderStatus.message}
          </div>
        )}

        {telegramStartUrl ? (
          <a
            href={telegramStartUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'block',
              textAlign: 'center',
              padding: 10,
              borderRadius: 8,
              border: `1px solid ${theme.border}`,
              color: theme.text,
              fontWeight: 900,
              textDecoration: 'none',
              background: theme.bg,
            }}
          >
            {dir === 'rtl' ? 'تتبع الطلب عبر تيليجرام' : 'Track on Telegram'}
          </a>
        ) : null}

        <div style={{ textAlign: 'center', color: theme.muted, fontSize: 10 }}>
          {dir === 'rtl' ? 'الدفع عند الاستلام • توصيل سريع' : 'Cash on delivery • Fast delivery'}
        </div>
      </div>
    </div>
  );
}
