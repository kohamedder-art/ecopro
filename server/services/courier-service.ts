// Base service for courier integrations
// Each courier implements this interface

import { CourierShipmentResponse, CourierStatusResponse, ShipmentInput } from '../types/delivery';

export interface CourierTestResult {
  success: boolean;
  message: string;
  /** Optional account/company name returned by the API */
  accountName?: string;
}

export interface CourierService {
  /**
   * Create a shipment with the courier
   * @param shipment Shipment details
   * @param apiKey API key for the courier
   * @returns Tracking number and label URL/data
   */
  createShipment(
    shipment: ShipmentInput,
    apiKey: string,
    secondaryCredential?: string
  ): Promise<CourierShipmentResponse>;

  /**
   * Get delivery status for a shipment
   * @param trackingNumber Tracking number
   * @param apiKey API key for the courier
   * @returns Current status and events
   */
  getStatus(
    trackingNumber: string,
    apiKey: string,
    secondaryCredential?: string
  ): Promise<CourierStatusResponse>;

  /**
   * Verify webhook signature from courier
   * @param payload Webhook payload
   * @param signature Signature from courier
   * @param secret Webhook secret
   * @returns true if signature is valid
   */
  verifyWebhook(payload: any, signature: string, secret: string): boolean;

  /**
   * Parse webhook payload and extract delivery event
   * @param payload Webhook payload from courier
   * @returns Parsed event data
   */
  parseWebhookPayload(payload: any): {
    tracking_number: string;
    event_type: string;
    status: string;
    timestamp?: string;
    location?: string;
    description?: string;
  };

  /**
   * Test whether the provided credentials are valid by making a lightweight API call.
   * @param apiKey Primary credential (API token / key)
   * @param secondaryCredential Optional secondary credential (GUID, API ID, store ID, etc.)
   * @returns Success/failure with a human-readable message
   */
  testCredentials(apiKey: string, secondaryCredential?: string): Promise<CourierTestResult>;

  /**
   * Register a webhook URL with the courier's API so they send status updates
   * to our server automatically. Only supported by some couriers.
   * @param webhookUrl The URL the courier should send webhook events to
   * @param apiKey Primary credential
   * @param secondaryCredential Optional secondary credential
   * @returns Whether registration is supported and success/failure
   */
  registerWebhook?(webhookUrl: string, apiKey: string, secondaryCredential?: string): Promise<{
    success: boolean;
    supported: boolean;
    webhookSecret?: string;
    error?: string;
  }>;
}

// Service Registry
export const courierServices: Record<string, () => CourierService> = {};

// Register courier services
export function registerCourierService(companyName: string, ServiceClass: new () => CourierService) {
  courierServices[companyName.toLowerCase()] = () => new ServiceClass();
}

// Get courier service by company name
export function getCourierService(companyName: string): CourierService | null {
  const serviceFn = courierServices[companyName.toLowerCase()];
  return serviceFn ? serviceFn() : null;
}
