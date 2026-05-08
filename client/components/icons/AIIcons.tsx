import * as React from 'react';

type Props = React.SVGProps<SVGSVGElement>;

function sr() {
  return { fill: 'none', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
}

export function MkrAiBrain(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><path d="M10 2.5A3.5 3.5 0 006.5 6v.5M10 2.5A3.5 3.5 0 0113.5 6v.5M10 2.5v3" /><path d="M6.5 6.5A2.5 2.5 0 004 9v2a2.5 2.5 0 002.5 2.5M13.5 6.5A2.5 2.5 0 0116 9v2a2.5 2.5 0 01-2.5 2.5" /><path d="M6.5 13.5v1A2.5 2.5 0 009 17h2a2.5 2.5 0 002.5-2.5v-1" /><circle cx="7.5" cy="10" r="1" fill="currentColor" /><circle cx="12.5" cy="10" r="1" fill="currentColor" /></svg>);
}

export function MkrAiShield(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><path d="M10 2l6 2.5v4c0 4.5-3 8-6 9-3-1-6-4.5-6-9v-4L10 2z" /><path d="M7.5 10l2 2 3-4" /></svg>);
}

export function MkrAiStore(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><path d="M2 4h16l-1.5 4H3.5L2 4z" /><rect x="3" y="8" width="14" height="9" rx="1" /><circle cx="7" cy="13" r="1.5" fill="currentColor" /><circle cx="13" cy="13" r="1.5" fill="currentColor" /></svg>);
}

export function MkrAiFile(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><path d="M4 2.5h7l4 4v11H4V2.5z" /><path d="M11 2.5v4h4" /><line x1="6" y1="10" x2="14" y2="10" /><line x1="6" y1="13" x2="12" y2="13" /></svg>);
}

export function MkrAiDollar(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><circle cx="10" cy="10" r="7" /><line x1="10" y1="5" x2="10" y2="15" /><path d="M7.5 12.5c0 1 1.1 2 2.5 2s2.5-.9 2.5-2c0-2.5-5-1.5-5-5 0-1.1 1.1-2 2.5-2s2.5.9 2.5 2" /></svg>);
}

export function MkrAiImage(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><rect x="2" y="3" width="16" height="14" rx="2" /><circle cx="7" cy="8" r="2" fill="currentColor" /><path d="M2 14l4-4 3 3 3-2 4 3" /></svg>);
}

export function MkrAiScan(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><circle cx="10" cy="10" r="5" /><circle cx="10" cy="10" r="1.5" fill="currentColor" /><line x1="3" y1="10" x2="5" y2="10" /><line x1="15" y1="10" x2="17" y2="10" /></svg>);
}

export function MkrAiChart(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><rect x="2" y="12" width="3" height="5" /><rect x="8" y="7" width="3" height="10" /><rect x="14" y="3" width="3" height="14" /><path d="M2 2l4 4 4-4 3 4 3-3" /></svg>);
}

export function MkrAiBox(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><path d="M3 6.5l7-3 7 3v7l-7 3-7-3V6.5z" /><polyline points="3,6.5 10,9.5 17,6.5" /><line x1="10" y1="9.5" x2="10" y2="16.5" /></svg>);
}

export function MkrAiClipboard(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><path d="M7 3H5a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V4a1 1 0 00-1-1h-2" /><path d="M7 3V2a1 1 0 011-1h4a1 1 0 011 1v1H7z" /><line x1="7" y1="9" x2="13" y2="9" /><line x1="7" y1="12" x2="13" y2="12" /></svg>);
}

export function MkrAiAlert(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><path d="M10 2L2 17h16L10 2z" /><line x1="10" y1="8" x2="10" y2="12" /><circle cx="10" cy="14.5" r="1" fill="currentColor" /></svg>);
}

export function MkrAiTrendDown(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><polyline points="2,5 6,9 10,6 14,10 18,7" /><polyline points="14,10 18,10 18,7" /><line x1="2" y1="14" x2="18" y2="14" /></svg>);
}

export function MkrAiReply(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><path d="M3 10l5-5v3c4 0 7 1 9 4-1-3-4-6-9-6V5L3 10z" /><path d="M3 10l5 5v-3" /></svg>);
}

export function MkrAiBroadcast(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><circle cx="10" cy="10" r="2" fill="currentColor" /><path d="M5 10c0-2.8 2.2-5 5-5s5 2.2 5 5" /><path d="M2 10c0-4.4 3.6-8 8-8s8 3.6 8 8" /></svg>);
}

export function MkrAiRadar(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><circle cx="10" cy="10" r="7" /><path d="M10 3v7l5 5" /><circle cx="10" cy="10" r="1.5" fill="currentColor" /></svg>);
}

export function MkrAiRefresh(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><polyline points="16,3 16,8 11,8" /><path d="M4 10a6 6 0 0110.2-4.2L16 8M4 17l-.2-5 5-.2" /><polyline points="4,17 4,12 9,12" /><path d="M16 10a6 6 0 01-10.2 4.2L4 12" /></svg>);
}

export function MkrAiPlus(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><circle cx="10" cy="10" r="7" /><line x1="10" y1="6" x2="10" y2="14" /><line x1="6" y1="10" x2="14" y2="10" /></svg>);
}

export function MkrAiPencil(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><path d="M14.5 2.5a2 2 0 012.8 2.8L6 17H3v-3L14.5 2.5z" /><line x1="12" y1="4" x2="16" y2="8" /></svg>);
}

export function MkrAiTrash(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><polyline points="3,5 5,5 17,5" /><path d="M6 5V3a1 1 0 011-1h6a1 1 0 011 1v2" /><path d="M8 9v5M12 9v5M5 5l1 12h8l1-12" /></svg>);
}

export function MkrAiPalette(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><circle cx="10" cy="10" r="7" /><circle cx="7" cy="8" r="1.5" fill="currentColor" /><circle cx="13" cy="8" r="1.5" fill="currentColor" /><circle cx="8" cy="13" r="1.5" fill="currentColor" /><path d="M14 12c-.5 0-1 .5-1 1.5s.5 2 1 2c1.5 0 2.5-2 2-4" /></svg>);
}

export function MkrAiBot(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><rect x="3" y="5" width="14" height="10" rx="2" /><circle cx="7" cy="10" r="1.5" fill="currentColor" /><circle cx="13" cy="10" r="1.5" fill="currentColor" /><path d="M10 2v3M7 15v2M13 15v2" /></svg>);
}

export function MkrAiZap(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><polygon points="11,2 4,11 9,11 8,18 16,9 11,9" /></svg>);
}

export function MkrAiSave(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><path d="M4 3h9l4 4v10a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" /><path d="M7 3v4h5V3" /><path d="M7 11h6v6H7V11z" /></svg>);
}

export function MkrAiSpinner(props: Props) {
  return (<svg viewBox="0 0 20 20" fill="none" className="animate-spin" {...props}><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" opacity="0.3" /><path d="M17 10a7 7 0 00-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>);
}

export function MkrAiCheck(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><circle cx="10" cy="10" r="7" /><path d="M6 10l3 3 5-5" /></svg>);
}

export function MkrAiX(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><circle cx="10" cy="10" r="7" /><line x1="7" y1="7" x2="13" y2="13" /><line x1="13" y1="7" x2="7" y2="13" /></svg>);
}

export function MkrAiMsg(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><path d="M18 10c0 4-3.6 7-8 7-1 0-2-.2-3-.5L3 18l1.5-4A6.5 6.5 0 012 10c0-4 3.6-7 8-7s8 3 8 7z" /></svg>);
}

export function MkrAiSend(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><line x1="2" y1="10" x2="18" y2="10" /><polyline points="12,4 18,10 12,16" /><line x1="2" y1="6" x2="8" y2="10" /><line x1="2" y1="14" x2="8" y2="10" /></svg>);
}

export function MkrAiInsta(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><rect x="2.5" y="2.5" width="15" height="15" rx="4" /><circle cx="10" cy="10" r="3.5" /><circle cx="15" cy="5" r="1" fill="currentColor" /></svg>);
}

export function MkrAiPhone(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><rect x="5" y="1" width="10" height="18" rx="2" /><line x1="9" y1="15" x2="11" y2="15" /></svg>);
}

export function MkrAiSparkle(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><path d="M10 2l1.5 4.5L16 8l-4.5 1.5L10 14l-1.5-4.5L4 8l4.5-1.5L10 2z" /><path d="M6 14l1 1.5M14 14l-1 1.5M10 16v2" /></svg>);
}

export function MkrAiChevron(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><polyline points="8,4 14,10 8,16" /></svg>);
}

export function MkrAiInfo(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><circle cx="10" cy="10" r="7" /><line x1="10" y1="8" x2="10" y2="14" /><circle cx="10" cy="6.5" r="1" fill="currentColor" /></svg>);
}

export function MkrAiGlobe(props: Props) {
  return (<svg viewBox="0 0 20 20" {...sr()} {...props}><circle cx="10" cy="10" r="7" /><ellipse cx="10" cy="10" rx="4" ry="7" /><line x1="3" y1="10" x2="17" y2="10" /></svg>);
}
