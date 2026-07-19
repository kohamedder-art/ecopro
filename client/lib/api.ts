import type { Product } from "@shared/types";

const API_URL = "/api";

// Vendor APIs removed (selling/store feature deprecated)
export async function fetchVendors(): Promise<never> {
  throw new Error('Vendors API removed');
}

export async function fetchVendorById(_id: string): Promise<never> {
  throw new Error('Vendors API removed');
}

export async function fetchVendorBySlug(_slug: string): Promise<never> {
  throw new Error('Vendors API removed');
}

export async function createVendor(): Promise<never> {
  throw new Error('Vendor creation removed');
}

export async function updateVendor(): Promise<never> {
  throw new Error('Vendor update removed');
}

// Products
export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(`${API_URL}/products`);
  return res.json();
}

export async function fetchVendorProducts(_vendorId: string): Promise<Product[]> {
  throw new Error('Vendor products API removed');
}

export async function createProduct(product: Product): Promise<Product> {
  const res = await fetch(`${API_URL}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(product),
  });
  return res.json();
}
// Public listing actions removed. The following functions are intentionally disabled.
export async function createPublicProduct(): Promise<never> {
  throw new Error('createPublicProduct is removed. Public listing feature disabled.');
}

// Upload an image as base64 JSON body
export async function uploadImage(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('image', file);
  // Read CSRF token from cookie (required for authenticated POST requests)
  const csrfToken = document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/)?.[1] || '';
  const res = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
    body: formData,
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Upload failed');
  }
  return res.json();
}

// Upload a file with progress tracking via XHR
export function uploadFileWithProgress(
  file: File,
  onProgress: (pct: number) => void,
  fieldName: string = 'image',
): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append(fieldName, file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/upload`);

    const csrfToken = document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/)?.[1] || '';
    if (csrfToken) xhr.setRequestHeader('X-CSRF-Token', csrfToken);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch {
          reject(new Error('Invalid server response'));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || 'Upload failed'));
        } catch {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}

export async function deletePublicProduct(productId: string, ownerKey: string): Promise<any> {
  const res = await fetch(`${API_URL}/products/${productId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerKey }),
  });
  return res.json();
}

export async function getProductsByOwnerKey(): Promise<never> {
  throw new Error('getProductsByOwnerKey is removed.');
}

export async function getProductsByOwnerEmail(): Promise<never> {
  throw new Error('getProductsByOwnerEmail is removed.');
}

export async function claimProduct(): Promise<never> {
  throw new Error('claimProduct is removed.');
}

export async function claimProductsByEmail(): Promise<never> {
  throw new Error('claimProductsByEmail is removed.');
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  const res = await fetch(`${API_URL}/products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return res.json();
}

export async function deleteProduct(id: string): Promise<void> {
  await fetch(`${API_URL}/products/${id}`, {
    method: "DELETE",
  });
}

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
  };

  if (init?.headers) {
    const extra = new Headers(init.headers as any);
    extra.forEach((value, key) => {
      headers[key] = value;
    });
  }

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || res.statusText);
  }
  return res.json();
}
