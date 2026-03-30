import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Permission mapping for routes/pages
export const PAGE_PERMISSIONS: Record<string, string> = {
  '/dashboard': 'view_dashboard',
  '/dashboard/profile': 'view_settings',
  '/dashboard/preview': 'view_products_list',
  '/dashboard/stock': 'view_inventory',
  '/dashboard/orders': 'view_orders_list',
  '/dashboard/delivery': 'edit_delivery_settings',
  '/dashboard/bot-settings': 'manage_bot_settings',
  '/dashboard/staff': 'view_staff',
};

// Action permissions mapping
export const ACTION_PERMISSIONS: Record<string, string> = {
  'edit_order': 'edit_order_status',
  'delete_order': 'delete_orders',
  'add_product': 'add_products',
  'edit_product': 'edit_products',
  'delete_product': 'delete_products',
  'manage_stock': 'manage_stock',
  'edit_settings': 'edit_store_info',
  'invite_staff': 'invite_staff',
  'manage_staff': 'manage_staff',
  'export_data': 'export_data',
  'bulk_actions': 'bulk_order_actions',
};

interface StaffUser {
  id: number;
  email: string;
  role: 'manager' | 'staff';
  permissions: Record<string, boolean>;
  store_name?: string;
  storeName?: string;
  status: string;
  client_id?: number;
}

interface StaffPermissionContextType {
  isStaff: boolean;
  staffUser: StaffUser | null;
  permissions: Record<string, boolean>;
  loading: boolean;
  hasPermission: (permission: string) => boolean;
  hasPagePermission: (path: string) => boolean;
  hasActionPermission: (action: string) => boolean;
  canView: (permission: string) => boolean;
  canEdit: (permission: string) => boolean;
  refreshPermissions: () => Promise<void>;
  logout: () => void;
}

const StaffPermissionContext = createContext<StaffPermissionContextType | null>(null);

export function StaffPermissionProvider({ children }: { children: ReactNode }) {
  const [isStaff, setIsStaff] = useState(false);
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const loadStaffData = async () => {
    const isStaffFlag = localStorage.getItem('isStaff') === 'true';
    
    if (!isStaffFlag) {
      setIsStaff(false);
      setStaffUser(null);
      setPermissions({});
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/staff/me');
      if (res.ok) {
        const data = await res.json();
        setIsStaff(true);
        setStaffUser(data.user);
        setPermissions(data.user?.permissions || {});
      } else {
        // Invalid staff session
        localStorage.removeItem('isStaff');
        localStorage.removeItem('staffId');
        setIsStaff(false);
        setStaffUser(null);
        setPermissions({});
      }
    } catch (error) {
      console.error('[StaffPermission] Error loading staff data:', error);
      setIsStaff(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaffData();
  }, []);

  const hasPermission = (permission: string): boolean => {
    if (!isStaff) return true; // Non-staff (store owners) have all permissions
    return permissions[permission] === true;
  };

  const hasPagePermission = (path: string): boolean => {
    if (!isStaff) return true;

    // Find the most specific matching permission for path.
    // Important: '/dashboard' must not shadow '/dashboard/preview', etc.
    const entries = Object.entries(PAGE_PERMISSIONS).sort((a, b) => b[0].length - a[0].length);
    for (const [route, perm] of entries) {
      if (path === route) return permissions[perm] === true;
      if (path.startsWith(route + '/')) return permissions[perm] === true;
    }
    
    // Default: allow if no specific permission defined
    return true;
  };

  const hasActionPermission = (action: string): boolean => {
    if (!isStaff) return true;
    const perm = ACTION_PERMISSIONS[action];
    if (!perm) return true;
    return permissions[perm] === true;
  };

  const canView = (permission: string): boolean => {
    if (!isStaff) return true;
    return permissions[`view_${permission}`] === true || permissions[permission] === true;
  };

  const canEdit = (permission: string): boolean => {
    if (!isStaff) return true;
    return permissions[`edit_${permission}`] === true || permissions[permission] === true;
  };

  const refreshPermissions = async () => {
    await loadStaffData();
  };

  const logout = () => {
    localStorage.removeItem('isStaff');
    localStorage.removeItem('staffId');
    localStorage.removeItem('user');
    setIsStaff(false);
    setStaffUser(null);
    setPermissions({});
    fetch('/api/staff/logout', { method: 'POST' }).catch(() => {});
  };

  return (
    <StaffPermissionContext.Provider
      value={{
        isStaff,
        staffUser,
        permissions,
        loading,
        hasPermission,
        hasPagePermission,
        hasActionPermission,
        canView,
        canEdit,
        refreshPermissions,
        logout,
      }}
    >
      {children}
    </StaffPermissionContext.Provider>
  );
}

export function useStaffPermissions() {
  const context = useContext(StaffPermissionContext);
  if (!context) {
    // Return default values if used outside provider (for non-staff users)
    return {
      isStaff: false,
      staffUser: null,
      permissions: {},
      loading: false,
      hasPermission: () => true,
      hasPagePermission: () => true,
      hasActionPermission: () => true,
      canView: () => true,
      canEdit: () => true,
      refreshPermissions: async () => {},
      logout: () => {},
    };
  }
  return context;
}
