const pageLoadTime = Date.now();

function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function getFingerprint(): string {
  if (typeof window === 'undefined') return '';
  const parts = [
    navigator.userAgent,
    navigator.platform,
    screen.width,
    screen.height,
    screen.colorDepth,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency,
    !!navigator.maxTouchPoints,
  ];
  return simpleHash(parts.join('|'));
}

let cachedFingerprint: string | null = null;

export function getBrowserFingerprint(): string {
  if (!cachedFingerprint) {
    cachedFingerprint = getFingerprint();
  }
  return cachedFingerprint;
}

export function getFormFillTimeMs(): number {
  return Date.now() - pageLoadTime;
}

export function getFraudData(): { browser_fingerprint: string; form_fill_time_ms: number } {
  return {
    browser_fingerprint: getBrowserFingerprint(),
    form_fill_time_ms: getFormFillTimeMs(),
  };
}
