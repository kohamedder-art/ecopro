// Delivery integration types and schemas
import { z } from 'zod';

// Delivery Company Types
export interface DeliveryCompany {
  id: number;
  name: string;
  api_url: string;
  contact_email: string;
  contact_phone?: string;
  features: {
    supports_cod: boolean;
    supports_tracking: boolean;
    supports_labels: boolean;
  };
  is_active: boolean;
}

// Delivery Status Enum
export enum DeliveryStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_TRANSIT = 'in_transit',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETURNED = 'returned',
}

// Order with Delivery Info
export interface OrderWithDelivery {
  id: number;
  client_id: number;
  product_id?: number;
  quantity: number;
  total_price: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  delivery_company_id?: number;
  tracking_number?: string;
  delivery_status: DeliveryStatus;
  shipping_label_url?: string;
  label_generated_at?: Date;
  cod_amount?: number;
  cod_settlement_status?: string;
  courier_response?: any;
  created_at: Date;
  updated_at?: Date;
}

// Shipping Label
export interface ShippingLabel {
  id: number;
  order_id: number;
  client_id: number;
  delivery_company_id: number;
  tracking_number: string;
  label_url?: string;
  label_format: string;
  generated_at: Date;
  expires_at?: Date;
}

// Delivery Event
export interface DeliveryEvent {
  id: number;
  order_id: number;
  client_id: number;
  delivery_company_id: number;
  tracking_number: string;
  event_type: 'pickup' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed' | 'returned';
  event_status: 'pending' | 'completed' | 'failed';
  description?: string;
  location?: string;
  courier_timestamp?: Date;
  webhook_verified: boolean;
  created_at: Date;
}

// Delivery Integration
export interface DeliveryIntegration {
  id: number;
  client_id: number;
  delivery_company_id: number;
  account_number?: string;
  merchant_id?: string;
  is_enabled: boolean;
  configured_at: Date;
  updated_at: Date;
}

// ================== Validation Schemas ==================

// Assign Delivery Company to Order
export const AssignDeliverySchema = z.object({
  order_id: z.number().int().positive('Order ID must be a positive integer'),
  delivery_company_id: z.number().int().positive('Delivery company ID must be a positive integer'),
  cod_amount: z.number().optional().nullable(),
});

export type AssignDeliveryInput = z.infer<typeof AssignDeliverySchema>;

// Generate Shipping Label Request
export const GenerateLabelSchema = z.object({
  order_id: z.number().int().positive('Order ID must be a positive integer'),
  delivery_company_id: z.number().int().positive('Delivery company ID must be a positive integer'),
});

export type GenerateLabelInput = z.infer<typeof GenerateLabelSchema>;

// Shipment Creation (for courier API)
// Extended for Algerian delivery providers (Yalidine, Guepex, etc.)
export const ShipmentSchema = z.object({
  // Customer info
  customer_name: z.string().min(1, 'Customer name required'),
  customer_phone: z.string().min(1, 'Phone number required'),
  customer_email: z.string().email().optional(),
  delivery_address: z.string().min(1, 'Delivery address required'),
  
  // Algeria-specific location (required for all Algerian providers)
  wilaya: z.string().optional(), // Province name, e.g., "Alger", "Constantine"
  commune: z.string().optional(), // Municipality name
  
  // Product/Order info
  product_description: z.string().optional(),
  quantity: z.number().int().positive().default(1),
  weight: z.number().positive().optional(),
  cod_amount: z.number().nonnegative().optional(), // Cash on delivery amount in DZD
  reference_id: z.string(), // Order ID from our system
  
  // Delivery options
  is_stopdesk: z.boolean().optional(), // Pickup from desk vs home delivery
  notes: z.string().optional(), // Special delivery instructions
  
  // For aggregators like Dolivroo
  provider: z.string().optional(), // Specify provider: 'yalidine', 'ecotrack', 'auto'
});

export type ShipmentInput = z.infer<typeof ShipmentSchema>;

// Webhook Payload (from courier)
export const WebhookPayloadSchema = z.object({
  event_type: z.enum(['pickup', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned']),
  tracking_number: z.string(),
  status: z.string(),
  timestamp: z.string().datetime().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  signature: z.string().optional(), // HMAC signature from courier
});

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

// Configure Delivery Integration
export const ConfigureIntegrationSchema = z.object({
  delivery_company_id: z.number().int().positive(),
  api_key: z.string().min(1, 'API key required'),
  api_secret: z.string().optional(),
  account_number: z.string().optional(),
  merchant_id: z.string().optional(),
  webhook_secret: z.string().optional(),
});

export type ConfigureIntegrationInput = z.infer<typeof ConfigureIntegrationSchema>;

// Courier API Response (createShipment)
export interface CourierShipmentResponse {
  success: boolean;
  tracking_number: string;
  label_url?: string;
  label_data?: string; // Base64 encoded PDF
  reference_id?: string;
  estimated_delivery?: string;
  company_code?: string;
  provider?: string;
  error?: string;
}

// Courier API Response (getStatus)
export interface CourierStatusResponse {
  tracking_number: string;
  status: string;
  last_update?: string;
  location?: string;
  events?: Array<{
    type: string;
    timestamp: string;
    description?: string;
    location?: string;
  }>;
  error?: string;
}
