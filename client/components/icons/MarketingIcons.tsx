import * as React from 'react';

type Props = React.SVGProps<SVGSVGElement>;

function sr() {
  return { fill: 'none', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
}

export function MkrDashboard(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <rect x="3" y="10" width="4" height="7" rx="1" />
      <rect x="8" y="4" width="4" height="13" rx="1" />
      <rect x="13" y="7" width="4" height="10" rx="1" />
    </svg>
  );
}

export function MkrInsights(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <polyline points="2,14 6,9 10,12 14,5 18,8" />
      <line x1="14" y1="5" x2="18" y2="8" />
      <path d="M17 2v3l-8 8" />
      <circle cx="5.5" cy="15.5" r="2.5" />
    </svg>
  );
}

export function MkrMegaphone(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <path d="M2 8c0-1.1.9-3 2-3h1l9-3v14l-9-3H4c-1.1 0-2-1.34-2-3V8z" />
      <path d="M14 13a3 3 0 010-6" />
      <path d="M17 12a1 1 0 000-4" />
    </svg>
  );
}

export function MkrAudience(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <circle cx="7" cy="6" r="3" />
      <circle cx="14" cy="6" r="2.5" />
      <path d="M2 16c0-3 2.2-5 5-5s5 2 5 5" />
      <path d="M12 12c0-2.2 1.8-4 4-4s4 1.8 4 4" />
    </svg>
  );
}

export function MkrConfigure(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <line x1="4" y1="5" x2="16" y2="5" />
      <circle cx="4" cy="5" r="2" fill="currentColor" />
      <line x1="4" y1="15" x2="16" y2="15" />
      <circle cx="16" cy="15" r="2" fill="currentColor" />
      <line x1="12" y1="10" x2="4" y2="10" />
      <circle cx="12" cy="10" r="2" fill="currentColor" />
    </svg>
  );
}

export function MkrBrain(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <path d="M7 2a3 3 0 00-3 3v1.5A3 3 0 002 9.5v1a3 3 0 002 2.83V15a3 3 0 003 3h6a3 3 0 003-3v-1.67a3 3 0 002-2.83v-1a3 3 0 00-2-2.83V5a3 3 0 00-3-3H7z" />
      <path d="M7 8l2 2-2 2" />
      <path d="M13 8l-2 2 2 2" />
    </svg>
  );
}

export function MkrPerson(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <circle cx="10" cy="6" r="3.5" />
      <path d="M3 17c0-3.9 3.1-6 7-6s7 2.1 7 6" />
    </svg>
  );
}

export function MkrCart(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <path d="M2 3h2l1 3h11l2 6H6L4 4H2" />
      <circle cx="7" cy="16" r="1.5" />
      <circle cx="14" cy="16" r="1.5" />
      <path d="M6 10h11" />
    </svg>
  );
}

export function MkrCheck(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <circle cx="10" cy="10" r="7" />
      <polyline points="6,10 9,13 14,8" />
    </svg>
  );
}

export function MkrDollar(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <circle cx="10" cy="10" r="7" />
      <path d="M12 7.5c-.5-1-2-1.5-3-1-1.5.7-1 2.5 0 3 1.5.7 4 .5 4 3 0 1.5-1.5 2.5-3 2.5-1.5 0-2.5-.5-3-1.5" />
      <line x1="10" y1="4" x2="10" y2="16" />
    </svg>
  );
}

export function MkrPackage(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <path d="M3 6l7-3 7 3v8l-7 3-7-3V6z" />
      <polyline points="3,6 10,9 17,6" />
      <line x1="10" y1="9" x2="10" y2="17" />
    </svg>
  );
}

export function MkrRepeat(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <polyline points="16,3 19,6 16,9" />
      <path d="M4 14a6 6 0 016-6h9" />
      <polyline points="4,17 1,14 4,11" />
      <path d="M16 6a6 6 0 01-6 6H1" />
    </svg>
  );
}

export function MkrTarget(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3" />
      <circle cx="10" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}

export function MkrPulse(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <polyline points="1,11 5,11 7,4 10,16 12,8 15,11 19,11" />
    </svg>
  );
}

export function MkrAlert(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <path d="M10 2L1 17h18L10 2z" />
      <line x1="10" y1="7" x2="10" y2="12" />
      <circle cx="10" cy="14.5" r=".5" fill="currentColor" />
    </svg>
  );
}

export function MkrChevron(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <polyline points="6,8 10,12 14,8" />
    </svg>
  );
}

export function MkrCrown(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <path d="M2 16h16l-1.5-10-4.5 3-2-5-2 5-4.5-3L2 16z" />
      <circle cx="10" cy="6" r=".8" fill="currentColor" />
    </svg>
  );
}

export function MkrPin(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <path d="M10 2c-3 0-5.5 2.5-5.5 5.5 0 4 5.5 9.5 5.5 9.5s5.5-5.5 5.5-9.5C15.5 4.5 13 2 10 2z" />
      <circle cx="10" cy="7.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function MkrTrend(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <polyline points="2,14 7,9 11,12 18,4" />
      <polyline points="13,4 18,4 18,9" />
    </svg>
  );
}

export function MkrPhone(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <rect x="5" y="1" width="10" height="18" rx="2" />
      <line x1="8" y1="15" x2="12" y2="15" />
    </svg>
  );
}

export function MkrMonitor(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <rect x="2" y="2" width="16" height="11" rx="1.5" />
      <line x1="10" y1="13" x2="10" y2="17" />
      <line x1="5" y1="17" x2="15" y2="17" />
    </svg>
  );
}

export function MkrTablet(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <rect x="3" y="1" width="14" height="18" rx="2" />
      <circle cx="10" cy="16" r=".8" fill="currentColor" />
    </svg>
  );
}

export function MkrUserCheck(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <circle cx="8" cy="6" r="3" />
      <path d="M2 16c0-2.8 2.5-4.5 6-4.5" />
      <polyline points="13,13 15,15 18,11" />
    </svg>
  );
}

export function MkrScroll(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <path d="M5 2h8a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V4a2 2 0 012-2z" />
      <line x1="7" y1="6" x2="13" y2="6" />
      <line x1="7" y1="9" x2="13" y2="9" />
      <line x1="7" y1="12" x2="11" y2="12" />
    </svg>
  );
}

export function MkrClock(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <circle cx="10" cy="10" r="7" />
      <polyline points="10,6 10,10 13,12" />
    </svg>
  );
}

export function MkrGrid(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <rect x="2" y="2" width="7" height="7" rx="1" />
      <rect x="11" y="2" width="7" height="7" rx="1" />
      <rect x="2" y="11" width="7" height="7" rx="1" />
      <rect x="11" y="11" width="7" height="7" rx="1" />
    </svg>
  );
}

export function MkrRefresh(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <path d="M16 8a6 6 0 10-2 7" />
      <polyline points="13,8 16,8 16,5" />
    </svg>
  );
}

export function MkrPlus(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <line x1="10" y1="4" x2="10" y2="16" />
      <line x1="4" y1="10" x2="16" y2="10" />
    </svg>
  );
}

export function MkrTrash(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <polyline points="3,5 17,5" />
      <path d="M6 5V3a1 1 0 011-1h6a1 1 0 011 1v2" />
      <path d="M5 5l1 12a1 1 0 001 1h6a1 1 0 001-1l1-12" />
    </svg>
  );
}

export function MkrSave(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <path d="M15 2H4a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V5l-3-3z" />
      <path d="M5 2v5h7V2" />
      <rect x="5" y="11" width="10" height="7" rx="1" />
    </svg>
  );
}

export function MkrX(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <line x1="5" y1="5" x2="15" y2="15" />
      <line x1="15" y1="5" x2="5" y2="15" />
    </svg>
  );
}

export function MkrDownload(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <path d="M10 2v11" />
      <polyline points="6,9 10,13 14,9" />
      <path d="M3 16v1a1 1 0 001 1h12a1 1 0 001-1v-1" />
    </svg>
  );
}

export function MkrUpload(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <path d="M10 14V3" />
      <polyline points="6,7 10,3 14,7" />
      <path d="M3 16v1a1 1 0 001 1h12a1 1 0 001-1v-1" />
    </svg>
  );
}

export function MkrGear(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.4 4.4l1.4 1.4M14.2 14.2l1.4 1.4M4.4 15.6l1.4-1.4M14.2 5.8l1.4-1.4" />
    </svg>
  );
}

export function MkrChart(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <rect x="2" y="12" width="3" height="5" rx=".5" />
      <rect x="7" y="7" width="3" height="10" rx=".5" />
      <rect x="12" y="3" width="3" height="14" rx=".5" />
      <rect x="17" y="9" width="1" height="8" rx=".5" />
    </svg>
  );
}

export function MkrFacebook(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <circle cx="10" cy="10" r="8" />
      <path d="M12 3c-2 0-3 1.5-3 3v2H7v3h2v7h3v-7h2l1-3h-3V7c0-.5.5-1 1-1h2V3h-2z" fill="currentColor" />
    </svg>
  );
}

export function MkrBolt(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <polygon points="11,1 4,11 9,11 8,19 16,9 11,9" />
    </svg>
  );
}

export function MkrBulb(props: Props) {
  return (
    <svg viewBox="0 0 20 20" {...sr()} {...props}>
      <path d="M10 2a5 5 0 00-3 9c1 .6 1 1.5 1 2.5V15a1 1 0 001 1h2a1 1 0 001-1v-1.5c0-1 .1-1.9 1-2.5A5 5 0 0010 2z" />
      <line x1="8" y1="17" x2="12" y2="17" />
      <line x1="9" y1="18" x2="11" y2="18" />
    </svg>
  );
}
