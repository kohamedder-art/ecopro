// Google Sheets Service
// Handles OAuth, sheet reading, and data import

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { pool } from '../utils/database';
import { encryptData, decryptData } from '../utils/encryption';
import { generateRequestId } from '../utils/delivery-logging';
import {
  SheetMetadata,
  ValuesResponse,
  OrderImportData,
  CustomerImportData,
  ProductImportData,
  OrderImportSchema,
  CustomerImportSchema,
  ProductImportSchema,
} from '../types/google-sheets';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/auth/google/callback';

export class GoogleSheetsService {
  private oauth2Client: OAuth2Client;
  private sheets: any;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    this.sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });
  }

  /**
   * Get OAuth authorization URL for user consent
   */
  getAuthorizationUrl(state?: string): string {
    // Full spreadsheets scope: read (import) + write (order export).
    // Users connected with the old readonly scope must reconnect once.
    const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state || generateRequestId(),
      prompt: 'consent',
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      return {
        access_token: tokens.access_token || '',
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expiry_date
          ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
          : 3600,
      };
    } catch (error: any) {
      throw new Error(`Failed to exchange code for tokens: ${error.message}`);
    }
  }

  /**
   * Save Google tokens to database
   */
  async saveTokens(clientId: number, tokens: {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }): Promise<void> {
    try {
      const encryptedAccessToken = encryptData(tokens.access_token);
      const encryptedRefreshToken = tokens.refresh_token
        ? encryptData(tokens.refresh_token)
        : null;

      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

      await pool.query(
        `INSERT INTO google_tokens (client_id, access_token_encrypted, refresh_token_encrypted, expires_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (client_id)
         DO UPDATE SET
           access_token_encrypted = $2,
           refresh_token_encrypted = $3,
           expires_at = $4,
           last_refreshed_at = NOW(),
           updated_at = NOW()`,
        [clientId, encryptedAccessToken, encryptedRefreshToken, expiresAt]
      );
    } catch (error: any) {
      throw new Error(`Failed to save tokens: ${error.message}`);
    }
  }

  /**
   * Get stored tokens and refresh if needed
   */
  async getValidTokens(clientId: number): Promise<string> {
    try {
      const result = await pool.query(
        'SELECT access_token_encrypted, refresh_token_encrypted, expires_at FROM google_tokens WHERE client_id = $1 AND is_active = true',
        [clientId]
      );

      if (result.rows.length === 0) {
        throw new Error('No Google tokens found');
      }

      const tokenData = result.rows[0];
      const expiresAt = new Date(tokenData.expires_at);

      // Check if token needs refresh
      if (expiresAt < new Date(Date.now() + 5 * 60 * 1000)) {
        // Refresh if expiring in less than 5 minutes
        if (tokenData.refresh_token_encrypted) {
          const refreshToken = decryptData(tokenData.refresh_token_encrypted);
          const newTokens = await this.refreshToken(refreshToken);
          await this.saveTokens(clientId, newTokens);
          return newTokens.access_token;
        }
      }

      return decryptData(tokenData.access_token_encrypted);
    } catch (error: any) {
      throw new Error(`Failed to get valid tokens: ${error.message}`);
    }
  }

  /**
   * Refresh expired access token
   */
  private async refreshToken(refreshToken: string): Promise<{
    access_token: string;
    expires_in: number;
  }> {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      return {
        access_token: credentials.access_token || '',
        expires_in: credentials.expiry_date
          ? Math.floor((credentials.expiry_date - Date.now()) / 1000)
          : 3600,
      };
    } catch (error: any) {
      throw new Error(`Failed to refresh token: ${error.message}`);
    }
  }

  /**
   * List sheets in a spreadsheet
   */
  async listSheets(accessToken: string, spreadsheetId: string): Promise<SheetMetadata> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'spreadsheetId,properties,sheets.properties',
      });

      return {
        spreadsheetId: response.data.spreadsheetId,
        title: response.data.properties?.title || '',
        sheets: (response.data.sheets || []).map((sheet: any) => ({
          sheetId: sheet.properties.sheetId,
          title: sheet.properties.title,
          index: sheet.properties.index,
          gridProperties: sheet.properties.gridProperties,
        })),
      };
    } catch (error: any) {
      throw new Error(`Failed to list sheets: ${error.message}`);
    }
  }

  /**
   * Read data from a sheet range
   */
  async readRange(
    accessToken: string,
    spreadsheetId: string,
    range: string
  ): Promise<Array<Record<string, any>>> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        majorDimension: 'ROWS',
      });

      const values = response.data.values || [];
      if (values.length === 0) {
        return [];
      }

      // First row is headers
      const headers = values[0];
      const rows = values.slice(1);

      return rows
        .filter((row: any[]) => row.some((cell: any) => cell)) // Filter empty rows
        .map((row: any[]) => {
          const obj: Record<string, any> = {};
          headers.forEach((header: string, index: number) => {
            obj[header] = row[index] || '';
          });
          return obj;
        });
    } catch (error: any) {
      throw new Error(`Failed to read range: ${error.message}`);
    }
  }

  /**
   * Append rows to a sheet. If the sheet is empty, the header row is
   * written first. Returns the number of data rows appended.
   */
  async appendRows(
    accessToken: string,
    spreadsheetId: string,
    sheetName: string,
    header: string[],
    rows: any[][]
  ): Promise<number> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      const quoted = `'${String(sheetName).replace(/'/g, "''")}'`;

      const first = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${quoted}!A1:Z1`,
        majorDimension: 'ROWS',
      });
      const hasHeader = (first.data.values || []).some((r: any[]) => r.some((c: any) => c));
      const values = hasHeader ? rows : [header, ...rows];
      if (values.length === 0) return 0;

      await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${quoted}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values },
      });
      return rows.length;
    } catch (error: any) {
      const msg = String(error?.message || '');
      if (msg.includes('403') || /insufficient|permission/i.test(msg)) {
        throw new Error('Google denied write access — reconnect your Google account to grant spreadsheet write permission, then retry.');
      }
      throw new Error(`Failed to write to sheet: ${msg}`);
    }
  }

  /**
   * Map rows to Order objects with validation
   */
  mapRowsToOrders(
    rows: Array<Record<string, any>>,
    columnMap: Record<string, string>
  ): { valid: OrderImportData[]; errors: Map<number, string> } {
    const valid: OrderImportData[] = [];
    const errors = new Map<number, string>();

    rows.forEach((row, index) => {
      try {
        const mapped: any = {};

        Object.entries(columnMap).forEach(([ecoProField, sheetColumn]) => {
          mapped[ecoProField] = row[sheetColumn];
        });

        const validated = OrderImportSchema.parse(mapped);
        valid.push(validated);
      } catch (error: any) {
        errors.set(index + 1, error.message || 'Validation failed');
      }
    });

    return { valid, errors };
  }

  /**
   * Map rows to Customer objects with validation
   */
  mapRowsToCustomers(
    rows: Array<Record<string, any>>,
    columnMap: Record<string, string>
  ): { valid: CustomerImportData[]; errors: Map<number, string> } {
    const valid: CustomerImportData[] = [];
    const errors = new Map<number, string>();

    rows.forEach((row, index) => {
      try {
        const mapped: any = {};

        Object.entries(columnMap).forEach(([ecoProField, sheetColumn]) => {
          mapped[ecoProField] = row[sheetColumn];
        });

        const validated = CustomerImportSchema.parse(mapped);
        valid.push(validated);
      } catch (error: any) {
        errors.set(index + 1, error.message || 'Validation failed');
      }
    });

    return { valid, errors };
  }

  /**
   * Map rows to Product objects with validation
   */
  mapRowsToProducts(
    rows: Array<Record<string, any>>,
    columnMap: Record<string, string>
  ): { valid: ProductImportData[]; errors: Map<number, string> } {
    const valid: ProductImportData[] = [];
    const errors = new Map<number, string>();

    rows.forEach((row, index) => {
      try {
        const mapped: any = {};

        Object.entries(columnMap).forEach(([ecoProField, sheetColumn]) => {
          mapped[ecoProField] = row[sheetColumn];
        });

        const validated = ProductImportSchema.parse(mapped);
        valid.push(validated);
      } catch (error: any) {
        errors.set(index + 1, error.message || 'Validation failed');
      }
    });

    return { valid, errors };
  }
}

// Export singleton instance
export const googleSheetsService = new GoogleSheetsService();
