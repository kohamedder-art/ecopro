/**
 * Secure API client with token management
 */

// Use relative /api path by default (works in both dev and production)
// Only use VITE_API_URL if explicitly set to an absolute URL
const VITE_API_URL = String(import.meta.env.VITE_API_URL || '').trim();

function normalizeApiBaseUrl(value: string): string {
  const v = String(value || '').trim();
  if (!v) return '/api';
  // Absolute URLs are allowed (e.g. https://api.example.com/api)
  if (/^https?:\/\//i.test(v)) return v.replace(/\/+$/, '');
  // Support relative '/api' and fix common misconfig like 'api'
  if (v.startsWith('/')) return v.replace(/\/+$/, '');
  return `/${v}`.replace(/\/+$/, '');
}

const API_BASE_URL = normalizeApiBaseUrl(VITE_API_URL);

export interface AuthResponse {
  message: string;
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    user_type?: string;
    is_paid_client?: boolean;
    is_locked?: boolean;
    locked_reason?: string | null;
    lock_type?: 'payment' | 'critical' | null;
  };
}

export interface ApiError {
  error: string;
  errors?: Array<{ msg: string; param: string }>;
}

/**
 * Get stored auth token
 */
export function getAuthToken(): string | null {
  // Tokens are now stored in HttpOnly cookies (not accessible to JS)
  return null;
}

/**
 * Store auth token
 */
export function setAuthToken(token: string): void {
  // No-op: token stored in HttpOnly cookie server-side
  void token;
}

/**
 * Remove auth token
 */
export function removeAuthToken(): void {
  localStorage.removeItem("authToken");
  localStorage.removeItem("token");
  localStorage.removeItem("auth_token");
  localStorage.removeItem("user");
}

/**
 * Sync auth state with server - validates session and updates localStorage
 * Call this on app startup to keep client state in sync with server cookies
 */
export async function syncAuthState(): Promise<boolean> {
  try {
    // Check for OAuth token stored during Google login
    const oauthToken = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {};
    if (oauthToken) {
      headers['Authorization'] = `Bearer ${oauthToken}`;
      console.log('[Auth] OAuth token found, adding to Authorization header');
    }

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      credentials: 'include',
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
    
    if (response.ok) {
      const userData = await response.json();
      console.log('[Auth] User validated from server:', { id: userData.id, email: userData.email });
      // Update localStorage with fresh user data from server
      localStorage.setItem("user", JSON.stringify(userData));
      localStorage.removeItem('auth_token'); // clear OAuth token once session confirmed
      if (userData.role === "admin") {
        localStorage.setItem("isAdmin", "true");
      }
      return true;
    } else if (response.status === 401) {
      console.log('[Auth] Received 401, attempting token refresh...');
      // Try to refresh the token
      const refreshed = await refreshAuthToken();
      if (refreshed) {
        console.log('[Auth] Token refreshed successfully, retrying syncAuthState...');
        return syncAuthState(); // Retry after refresh
      }
      // Session invalid - clear stale localStorage
      console.log('[Auth] Token refresh failed, clearing localStorage');
      removeAuthToken();
      return false;
    } else {
      console.error('[Auth] Unexpected response status from /auth/me:', response.status);
      return false;
    }
  } catch (error) {
    // Network error - don't clear localStorage, user might just be offline
    console.error('[Auth] Network error during syncAuthState:', error);
    return !!localStorage.getItem("user");
  }
}

/**
 * Refresh the auth token using the refresh cookie
 */
export async function refreshAuthToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Auto-refresh interval ID
let autoRefreshIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start auto-refreshing the auth token periodically
 * This keeps the session alive without requiring re-login
 */
export function startAutoRefresh(): void {
  if (autoRefreshIntervalId) return; // Already running
  
  // Refresh every 5 minutes to keep session alive
  autoRefreshIntervalId = setInterval(async () => {
    const user = getCurrentUser();
    if (user) {
      await refreshAuthToken();
    }
  }, 5 * 60 * 1000);
}

/**
 * Stop auto-refreshing
 */
export function stopAutoRefresh(): void {
  if (autoRefreshIntervalId) {
    clearInterval(autoRefreshIntervalId);
    autoRefreshIntervalId = null;
  }
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      error: "An error occurred",
    }));
    throw new Error(error.error || "Request failed");
  }

  return response.json();
}

/**
 * Auth API
 */
export const authApi = {
  /**
   * Register new user
   */
  register: async (data: {
    email: string;
    password: string;
    name: string;
    role?: string;
  }): Promise<AuthResponse> => {
    const response = await apiRequest<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    // Token stored in HttpOnly cookie by server
    localStorage.setItem("user", JSON.stringify(response.user));
    return response;
  },

  /**
   * Login user
   */
  login: async (data: {
    email: string;
    password: string;
  }): Promise<AuthResponse> => {
    const response = await apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
    // Token stored in HttpOnly cookie by server
    localStorage.setItem("user", JSON.stringify(response.user));
    if (response.user.role === "admin") {
      localStorage.setItem("isAdmin", "true");
    } else {
      localStorage.removeItem("isAdmin");
    }
    // Start auto-refresh to keep session alive
    startAutoRefresh();
    return response;
  },

  /**
   * Get current user
   */
  me: async (): Promise<{ id: string; email: string; name: string; role: string }> => {
    return apiRequest("/auth/me");
  },

  refresh: async (): Promise<{ ok: boolean }> => {
    return apiRequest("/auth/refresh", { method: 'POST' });
  },

  /**
   * Change password
   */
  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ message: string }> => {
    return apiRequest("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Logout user
   */
  logout: () => {
    // Best-effort server logout to clear cookies
    void apiRequest("/auth/logout", { method: 'POST' }).catch(() => null);
    removeAuthToken();
    window.location.href = "/";
  },

  /**
   * Promote an existing user to admin (platform owner only)
   */
  promoteToAdmin: async (email: string): Promise<{ message: string; user?: any }> => {
    return apiRequest("/admin/promote", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  /**
   * Upgrade current user to VIP (paid client)
   */
  upgradeToVIP: async (): Promise<{ message: string }> => {
    // No-op: platform is 100% free, VIP upgrades removed.
    return Promise.resolve({ message: 'Platform is free — no upgrade available' });
  },
};

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  // Check if user exists in localStorage (tokens are stored in httpOnly cookies)
  const user = getCurrentUser();
  return user !== null && user !== undefined;
}

/**
 * Get current user from localStorage
 */
export function getCurrentUser(): {
  id: string;
  email: string;
  name: string;
  role: string;
  user_type?: string;
  is_paid_client?: boolean;
  is_locked?: boolean;
  locked_reason?: string | null;
  lock_type?: 'payment' | 'critical' | null;
} | null {
  const userStr = localStorage.getItem("user");
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Admin utilities (client-side wrappers)
 */
export const adminApi = {
  listUsers: async (): Promise<any[]> => {
    return apiRequest("/admin/users");
  },
};
