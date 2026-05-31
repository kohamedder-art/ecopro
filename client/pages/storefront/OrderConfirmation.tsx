import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, XCircle, Edit2 } from "lucide-react";
import { useTranslation } from '@/lib/i18n';
import { getResolvedStoreSlug } from '@/lib/resolvedStore';

export default function OrderConfirmation() {
  const { storeSlug: urlSlug, orderId } = useParams<{ storeSlug: string; orderId: string }>();
  const storeSlug = urlSlug || getResolvedStoreSlug() || '';
  const navigate = useNavigate();
  const location = useLocation();
  const { t, locale, setLocale } = useTranslation();
  const token = new URLSearchParams(location.search).get('t') || new URLSearchParams(location.search).get('token') || '';

  // Force Arabic-only UI for the public confirmation flow
  useEffect(() => {
    const prev = locale;
    if (prev !== 'ar') setLocale('ar');
    return () => {
      if (prev !== 'ar') setLocale(prev);
    };
  }, [locale, setLocale]);
  
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedOrder, setEditedOrder] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      if (!token) {
        throw new Error(t('orderConfirmation.error.missingToken'));
      }
      const res = await fetch(`/api/storefront/${storeSlug}/order/${orderId}?t=${encodeURIComponent(token)}`);
      
      if (!res.ok) {
        throw new Error(t('orderConfirmation.error.notFoundOrExpired'));
      }

      const data = await res.json();
      setOrder(data.order);
      setEditedOrder(data.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('orderConfirmation.error.failedLoad'));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      setSubmitting(true);
      if (!token) throw new Error(t('orderConfirmation.error.missingToken'));
      const res = await fetch(`/api/storefront/${storeSlug}/order/${orderId}/confirm?t=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          orderData: order
        })
      });

      if (!res.ok) throw new Error(t('orderConfirmation.error.failedConfirm'));

      const data = await res.json();
      alert(t('orderConfirmation.alert.confirmed'));
      navigate(`/store/${storeSlug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('orderConfirmation.error.failedConfirm'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!window.confirm(t('orderConfirmation.confirm.declinePrompt'))) return;

    try {
      setSubmitting(true);
      if (!token) throw new Error(t('orderConfirmation.error.missingToken'));
      const res = await fetch(`/api/storefront/${storeSlug}/order/${orderId}/confirm?t=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "decline"
        })
      });

      if (!res.ok) throw new Error(t('orderConfirmation.error.failedDecline'));

      alert(t('orderConfirmation.alert.declined'));
      navigate(`/store/${storeSlug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('orderConfirmation.error.failedDecline'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveChanges = async () => {
    try {
      setSubmitting(true);
      if (!token) throw new Error(t('orderConfirmation.error.missingToken'));
      const res = await fetch(`/api/storefront/${storeSlug}/order/${orderId}/update?t=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editedOrder)
      });

      if (!res.ok) throw new Error(t('orderConfirmation.error.failedUpdate'));

      const data = await res.json();
      setOrder(data.order);
      setIsEditing(false);
      alert(t('orderConfirmation.alert.updated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('orderConfirmation.error.failedUpdate'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">{t('orderConfirmation.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100 p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-2">{t('orderConfirmation.errorTitle')}</h1>
          <p className="text-sm md:text-base text-gray-600 mb-4">{error || t('orderConfirmation.errorDescDefault')}</p>
          <Button onClick={() => navigate(storeSlug ? `/store/${storeSlug}` : "/")} className="w-full">
            {t('common.backToHome')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl md:text-xl md:text-2xl lg:text-lg md:text-xl md:text-2xl font-bold text-gray-800 mb-1">{t('orderConfirmation.title')}</h1>
          <p className="text-xs md:text-sm text-gray-600">{t('orderConfirmation.orderNumber', { id: String(order.id) })}</p>
        </div>

        {/* Order Details */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
          {!isEditing ? (
            <>
              {/* Product Info */}
              <div className="mb-4 pb-4 border-b">
                <h2 className="text-xl font-bold text-gray-800 mb-4">📦 {t('orderConfirmation.productDetails')}</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('orderConfirmation.label.product')}:</span>
                    <span className="font-semibold text-gray-800">{order.product_title}</span>
                  </div>
                  {(order.variant_name || order.variant_color || order.variant_size) && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('orderConfirmation.label.variant')}:</span>
                      <span className="font-semibold text-gray-800">
                        {String(order.variant_name || '').trim() ||
                          [String(order.variant_color || '').trim(), String(order.variant_size || '').trim()]
                            .filter(Boolean)
                            .join(' / ')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('orderConfirmation.label.quantity')}:</span>
                    <span className="font-semibold text-gray-800">{order.quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('orderConfirmation.label.price')}:</span>
                    <span className="font-semibold text-gray-800">{order.total_price} DZD</span>
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              <div className="mb-6 pb-6 border-b">
                <h2 className="text-xl font-bold text-gray-800 mb-4">👤 {t('orderConfirmation.customerInfo')}</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('orderConfirmation.label.name')}:</span>
                    <span className="font-semibold text-gray-800">{order.customer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('orderConfirmation.label.phone')}:</span>
                    <span className="font-semibold text-gray-800">{order.customer_phone}</span>
                  </div>
                  {order.customer_email && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('orderConfirmation.label.email')}:</span>
                      <span className="font-semibold text-gray-800">{order.customer_email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Shipping Address */}
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">📍 {t('orderConfirmation.shippingAddress')}</h2>
                <p className="text-gray-800 bg-gray-50 p-4 rounded">
                  {order.shipping_address || t('orderConfirmation.noAddressProvided')}
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Editable Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('orderConfirmation.edit.customerName')}
                  </label>
                  <input
                    type="text"
                    value={editedOrder.customer_name}
                    onChange={(e) =>
                      setEditedOrder({ ...editedOrder, customer_name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('orderConfirmation.edit.phoneNumber')}
                  </label>
                  <input
                    type="tel"
                    value={editedOrder.customer_phone}
                    onChange={(e) =>
                      setEditedOrder({ ...editedOrder, customer_phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('orderConfirmation.edit.emailOptional')}
                  </label>
                  <input
                    type="email"
                    value={editedOrder.customer_email || ""}
                    onChange={(e) =>
                      setEditedOrder({ ...editedOrder, customer_email: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('orderConfirmation.edit.shippingAddress')}
                  </label>
                  <textarea
                    value={editedOrder.shipping_address || ""}
                    onChange={(e) =>
                      setEditedOrder({ ...editedOrder, shipping_address: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('orderConfirmation.edit.quantity')}
                  </label>
                  <input
                    type="number"
                    value={editedOrder.quantity}
                    onChange={(e) =>
                      setEditedOrder({ ...editedOrder, quantity: parseInt(e.target.value) })
                    }
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {!isEditing ? (
            <>
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                className="w-full flex items-center justify-center gap-2"
                disabled={submitting}
              >
                <Edit2 className="w-4 h-4" />
                {t('orderConfirmation.action.changeDetails')}
              </Button>

              <Button
                onClick={handleDecline}
                variant="destructive"
                className="w-full flex items-center justify-center gap-2"
                disabled={submitting}
              >
                <XCircle className="w-4 h-4" />
                {t('orderConfirmation.action.decline')}
              </Button>

              <Button
                onClick={handleApprove}
                className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
                disabled={submitting}
              >
                <CheckCircle className="w-4 h-4" />
                {submitting ? t('orderConfirmation.action.approving') : t('orderConfirmation.action.approve')}
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => setIsEditing(false)}
                variant="outline"
                className="w-full"
                disabled={submitting}
              >
                {t('orderConfirmation.action.cancel')}
              </Button>

              <Button
                onClick={handleSaveChanges}
                className="w-full md:col-span-2 bg-green-600 hover:bg-green-700 text-white"
                disabled={submitting}
              >
                {submitting ? t('orderConfirmation.action.saving') : t('orderConfirmation.action.saveContinue')}
              </Button>
            </>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Info Message */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-700 text-sm">
            ⏰ {t('orderConfirmation.info.expiry')}
          </p>
        </div>
      </div>
    </div>
  );
}
