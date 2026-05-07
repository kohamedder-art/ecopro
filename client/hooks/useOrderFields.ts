import { useMemo } from 'react';

export interface OrderFieldConfig {
  showAddress: boolean;
  showCommune: boolean;
  showNotes: boolean;
  showHomeDelivery: boolean;
  showDeskDelivery: boolean;
}

/**
 * Reads order field visibility from store settings.
 * Returns which optional checkout fields should be displayed.
 * When deliveryType is 'desk', address and commune are auto-hidden
 * (customers pick up from desk office — only wilaya needed).
 */
export function useOrderFields(settings: Record<string, any> | undefined, deliveryType?: 'home' | 'desk'): OrderFieldConfig {
  return useMemo(() => {
    const isDesk = deliveryType === 'desk';
    return {
      showAddress: !isDesk && settings?.order_field_address === true,
      showCommune: settings?.order_field_commune === true,
      showNotes: settings?.order_field_notes === true,
      showHomeDelivery: settings?.delivery_type_home !== false,
      showDeskDelivery: settings?.delivery_type_desk !== false,
    };
  }, [
    settings?.order_field_address,
    settings?.order_field_commune,
    settings?.order_field_notes,
    settings?.delivery_type_home,
    settings?.delivery_type_desk,
    deliveryType,
  ]);
}
