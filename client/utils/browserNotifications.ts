/**
 * Browser Notifications Utility
 * Handles requesting permission and showing browser notifications
 */

// Check if browser supports notifications
export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

// Request permission for notifications
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    console.log('Browser does not support notifications');
    return 'denied';
  }
  
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }
  
  return Notification.permission;
}

// Check current permission status
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
}

// Show a browser notification
export function showBrowserNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    tag?: string;
    onClick?: () => void;
    requireInteraction?: boolean;
  }
): Notification | null {
  if (!isNotificationSupported()) {
    return null;
  }
  
  if (Notification.permission !== 'granted') {
    return null;
  }
  
  try {
    const notification = new Notification(title, {
      body: options?.body,
      icon: options?.icon || '/favicon.ico',
      tag: options?.tag, // Prevents duplicate notifications with same tag
      requireInteraction: options?.requireInteraction || false,
    });
    
    if (options?.onClick) {
      notification.onclick = () => {
        window.focus();
        options.onClick?.();
        notification.close();
      };
    }
    
    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);
    
    return notification;
  } catch (error) {
    console.error('Error showing notification:', error);
    return null;
  }
}

// Show notification for new order
export function notifyNewOrder(orderCount: number, onClick?: () => void, locale?: string): Notification | null {
  const isAr = locale === 'ar';
  const title = isAr
    ? orderCount === 1 ? '🛒 طلب جديد!' : `🛒 ${orderCount} طلبات جديدة!`
    : orderCount === 1 ? '🛒 New Order!' : `🛒 ${orderCount} New Orders!`;
  const body = isAr
    ? orderCount === 1 ? 'لديك طلب جديد بانتظار التأكيد' : `لديك ${orderCount} طلبات جديدة بانتظار التأكيد`
    : orderCount === 1 ? 'You have a new order waiting for confirmation' : `You have ${orderCount} new orders waiting`;
  
  return showBrowserNotification(title, {
    body,
    tag: 'new-order', // Replaces previous order notifications
    onClick,
    requireInteraction: true,
  });
}

// Show notification for new message
export function notifyNewMessage(messageCount: number, onClick?: () => void, locale?: string): Notification | null {
  const isAr = locale === 'ar';
  const title = isAr
    ? messageCount === 1 ? '💬 رسالة جديدة!' : `💬 ${messageCount} رسائل جديدة!`
    : messageCount === 1 ? '💬 New Message!' : `💬 ${messageCount} New Messages!`;
  const body = isAr
    ? messageCount === 1 ? 'لديك رسالة جديدة من الدعم' : `لديك ${messageCount} رسائل غير مقروءة`
    : messageCount === 1 ? 'You have a new message from support' : `You have ${messageCount} unread messages`;
  
  return showBrowserNotification(title, {
    body,
    tag: 'new-message', // Replaces previous message notifications
    onClick,
  });
}

// Play notification sound (optional)
export function playNotificationSound(): void {
  try {
    const audio = new Audio('/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Ignore errors if sound can't play
    });
  } catch {
    // Ignore errors
  }
}
