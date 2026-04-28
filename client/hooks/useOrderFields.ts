import { useMemo } from 'react';

export interface OrderFieldConfig {
  showAddress: boolean;
  showCommune: boolean;
  showNotes: boolean;
}

/**
 * Reads order field visibility from store settings.
 * Returns which optional checkout fields should be displayed.
 */
export function useOrderFields(settings: Record<string, any> | undefined): OrderFieldConfig {
  return useMemo(() => ({
    showAddress: settings?.order_field_address === true,
    showCommune: settings?.order_field_commune === true,
    showNotes: settings?.order_field_notes === true,
  }), [
    settings?.order_field_address,
    settings?.order_field_commune,
    settings?.order_field_notes,
  ]);
}
