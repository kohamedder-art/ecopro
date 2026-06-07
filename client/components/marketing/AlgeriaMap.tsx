import { useMemo, useState } from 'react';
import { fmtNum, fmtCurrency } from './helpers';

interface WilayaData {
  wilayaId: number;
  wilayaName: string;
  orders: number;
  revenue: number;
  customers: number;
}

interface AlgeriaMapProps {
  data: WilayaData[];
}

const WILAYA_COORDS: Record<number, [number, number]> = {
  1: [28.02, -0.26], 2: [36.16, 1.34], 3: [33.81, 2.86], 4: [35.87, 7.11],
  5: [35.56, 6.19], 6: [36.75, 5.06], 7: [36.37, 2.83], 8: [36.90, 3.97],
  9: [36.72, 5.08], 10: [36.83, 6.91], 11: [34.88, -1.31], 12: [34.68, 3.26],
  13: [32.92, 1.29], 14: [35.40, 4.74], 15: [34.38, 3.67], 16: [36.17, 4.42],
  17: [35.39, 6.17], 18: [35.69, 5.37], 19: [34.67, 0.45], 20: [35.77, 0.56],
  21: [36.62, 1.48], 22: [35.17, 1.28], 23: [34.42, 1.66], 24: [32.49, 3.66],
  25: [35.41, 4.18], 26: [34.88, 5.73], 27: [35.26, 7.32], 28: [33.38, -0.63],
  29: [36.07, 1.82], 30: [35.69, -0.64], 31: [34.74, -1.70], 32: [36.36, 2.55],
  33: [35.60, 3.17], 34: [33.50, -0.59], 35: [35.10, -1.31], 36: [36.50, 4.74],
  37: [36.38, 6.61], 38: [35.90, 6.86], 39: [36.09, 5.34], 40: [35.85, 7.12],
  41: [36.06, 4.50], 42: [36.00, 1.27], 43: [34.68, 2.10], 44: [32.63, 3.03],
  45: [35.76, 0.55], 46: [33.23, 0.86], 47: [32.93, 0.58], 48: [32.09, 1.85],
  49: [33.80, 1.03], 50: [31.75, -2.22], 51: [31.63, -4.09], 52: [28.97, -1.06],
  53: [32.76, 0.57], 54: [33.07, 0.79], 55: [34.07, -1.31], 56: [32.55, -1.25],
  57: [33.36, -0.63], 58: [27.40, -1.81],
};

export function AlgeriaMap({ data }: AlgeriaMapProps) {
  const [hovered, setHovered] = useState<WilayaData | null>(null);

  const dataMap = useMemo(() => {
    const m = new Map<number, WilayaData>();
    for (const d of data) m.set(d.wilayaId, d);
    return m;
  }, [data]);

  const maxOrders = useMemo(() => {
    if (data.length === 0) return 1;
    return Math.max(...data.map(d => d.orders), 1);
  }, [data]);

  const svgWidth = 400;
  const svgHeight = 500;

  const project = (lat: number, lng: number): [number, number] => {
    const x = ((lng + 9) / 13) * svgWidth;
    const y = ((37.5 - lat) / 12) * svgHeight;
    return [x, y];
  };

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-auto"
        style={{ maxHeight: '400px' }}
      >
        {/* Background */}
        <rect width={svgWidth} height={svgHeight} fill="transparent" />

        {/* Algeria outline (simplified) */}
        <path
          d="M 48 30 L 140 15 L 220 10 L 300 20 L 350 40 L 380 80 L 390 140 L 385 200 L 370 260 L 340 300 L 300 340 L 260 370 L 220 390 L 180 400 L 140 395 L 100 380 L 60 350 L 30 310 L 15 260 L 10 200 L 15 140 L 25 80 Z"
          fill="var(--muted)"
          opacity={0.3}
          stroke="var(--border)"
          strokeWidth={1}
        />

        {/* Wilaya dots */}
        {Object.entries(WILAYA_COORDS).map(([idStr, [lat, lng]]) => {
          const id = Number(idStr);
          const [cx, cy] = project(lat, lng);
          const d = dataMap.get(id);
          const orders = d?.orders || 0;
          const intensity = orders > 0 ? Math.min(orders / maxOrders, 1) : 0;
          const r = orders > 0 ? 4 + intensity * 8 : 3;
          const isHovered = hovered?.wilayaId === id;

          return (
            <g key={id}>
              {/* Glow for active wilayas */}
              {orders > 0 && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={r + 4}
                  fill={`rgba(59, 130, 246, ${0.15 + intensity * 0.2})`}
                  className="transition-all duration-200"
                />
              )}
              {/* Dot */}
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? r + 2 : r}
                fill={orders > 0 ? `rgba(59, 130, 246, ${0.4 + intensity * 0.6})` : 'var(--muted-foreground)'}
                opacity={orders > 0 ? 1 : 0.3}
                stroke={isHovered ? '#3b82f6' : 'transparent'}
                strokeWidth={isHovered ? 2 : 0}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => d && setHovered(d)}
                onMouseLeave={() => setHovered(null)}
              />
              {/* Order count label for top wilayas */}
              {orders > 0 && orders >= maxOrders * 0.3 && (
                <text
                  x={cx}
                  y={cy - r - 4}
                  textAnchor="middle"
                  className="fill-slate-900 dark:fill-white text-[8px] font-bold pointer-events-none"
                >
                  {orders}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hovered && (
        <div className="absolute top-4 right-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-lg z-10 min-w-[160px]">
          <p className="text-sm font-bold text-slate-900 dark:text-white">{hovered.wilayaName}</p>
          <div className="mt-1.5 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">الطلبات</span>
              <span className="font-bold text-slate-900 dark:text-white">{fmtNum(hovered.orders)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">الإيرادات</span>
              <span className="font-bold text-slate-900 dark:text-white">{fmtCurrency(hovered.revenue)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">العملاء</span>
              <span className="font-bold text-slate-900 dark:text-white">{fmtNum(hovered.customers)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
