import React from "react";

type GaugeStatus = "good" | "warn" | "bad" | "neutral";

interface BigCarGaugeProps {
  title: string;
  mainValue: number | null;
  mainLabel: string;
  mainUnit?: string;
  secondaryValue?: number | null;
  secondaryLabel?: string;
  secondaryUnit?: string;
  icon?: React.ReactNode;
  goodThreshold?: number;
  warnThreshold?: number;
  trend?: "higher-is-worse" | "higher-is-better" | "neutral";
  statusOverride?: GaugeStatus;
}

function getStatus(
  value: number | null,
  goodThreshold: number,
  warnThreshold: number,
  trend: "higher-is-worse" | "higher-is-better" | "neutral"
): GaugeStatus {
  if (value === null) return "neutral";
  
  if (trend === "higher-is-worse") {
    if (value <= goodThreshold) return "good";
    if (value <= warnThreshold) return "warn";
    return "bad";
  } else if (trend === "higher-is-better") {
    if (value >= warnThreshold) return "good";
    if (value >= goodThreshold) return "warn";
    return "bad";
  }
  return "neutral";
}

const statusColors = {
  good: {
    needle: "#10b981",
    glow: "rgba(16, 185, 129, 0.4)",
    text: "text-emerald-400",
    bg: "from-emerald-500/20 to-emerald-600/5",
    border: "border-emerald-500/30",
    arcActive: "#10b981",
  },
  warn: {
    needle: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.4)",
    text: "text-amber-400",
    bg: "from-amber-500/20 to-amber-600/5",
    border: "border-amber-500/30",
    arcActive: "#f59e0b",
  },
  bad: {
    needle: "#ef4444",
    glow: "rgba(239, 68, 68, 0.4)",
    text: "text-red-400",
    bg: "from-red-500/20 to-red-600/5",
    border: "border-red-500/30",
    arcActive: "#ef4444",
  },
  neutral: {
    needle: "#6b7280",
    glow: "rgba(107, 114, 128, 0.3)",
    text: "text-gray-500 dark:text-slate-400",
    bg: "from-slate-500/20 to-slate-600/5",
    border: "border-slate-500/30",
    arcActive: "#6b7280",
  },
};

export function BigCarGauge({
  title,
  mainValue,
  mainLabel,
  mainUnit = "%",
  secondaryValue,
  secondaryLabel,
  secondaryUnit = "%",
  icon,
  goodThreshold = 50,
  warnThreshold = 80,
  trend = "higher-is-worse",
  statusOverride,
}: BigCarGaugeProps) {
  const status = statusOverride ?? getStatus(mainValue, goodThreshold, warnThreshold, trend);
  const colors = statusColors[status];
  
  // SVG dimensions
  const size = 200;
  const cx = size / 2;
  const cy = size / 2 + 20;
  const radius = 80;
  const strokeWidth = 12;
  
  // Arc angles (from -135 to 135 degrees = 270 degree sweep)
  const startAngle = -135;
  const endAngle = 135;
  const angleRange = endAngle - startAngle;
  
  // Calculate needle angle
  const normalizedValue = mainValue !== null ? Math.min(100, Math.max(0, mainValue)) : 0;
  const needleAngle = startAngle + (normalizedValue / 100) * angleRange;
  const needleRadians = (needleAngle * Math.PI) / 180;
  
  // Calculate arc path
  const polarToCartesian = (angle: number, r: number) => {
    const radians = (angle * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(radians),
      y: cy + r * Math.sin(radians),
    };
  };
  
  const createArc = (start: number, end: number, r: number) => {
    const startPoint = polarToCartesian(start, r);
    const endPoint = polarToCartesian(end, r);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${startPoint.x} ${startPoint.y} A ${r} ${r} 0 ${largeArc} 1 ${endPoint.x} ${endPoint.y}`;
  };
  
  // Background arc (full)
  const bgArc = createArc(startAngle, endAngle, radius);
  
  // Value arc (partial, based on value)
  const valueEndAngle = startAngle + (normalizedValue / 100) * angleRange;
  const valueArc = normalizedValue > 0 ? createArc(startAngle, valueEndAngle, radius) : "";
  
  // Tick marks
  const ticks = [0, 25, 50, 75, 100];
  const tickMarks = ticks.map(tick => {
    const angle = startAngle + (tick / 100) * angleRange;
    const innerPoint = polarToCartesian(angle, radius - strokeWidth / 2 - 4);
    const outerPoint = polarToCartesian(angle, radius - strokeWidth / 2 - 12);
    const labelPoint = polarToCartesian(angle, radius - strokeWidth / 2 - 22);
    return { tick, innerPoint, outerPoint, labelPoint };
  });
  
  // Needle endpoint
  const needleLength = radius - strokeWidth / 2 - 15;
  const needleEndX = cx + needleLength * Math.cos(needleRadians);
  const needleEndY = cy + needleLength * Math.sin(needleRadians);

  return (
    <div className={`relative rounded-2xl border ${colors.border} bg-gradient-to-br ${colors.bg} backdrop-blur-sm overflow-hidden`}>
      {/* Subtle glow effect */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(ellipse at 50% 30%, ${colors.glow} 0%, transparent 70%)`,
        }}
      />
      
      <div className="relative p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          {icon && <div className={`${colors.text}`}>{icon}</div>}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
        
        {/* Main Gauge */}
        <div className="flex justify-center">
          <svg width={size} height={size - 30} viewBox={`0 0 ${size} ${size - 30}`}>
            <defs>
              {/* Gradient for the arc */}
              <linearGradient id={`arcGrad-${title}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
              
              {/* Glow filter for needle */}
              <filter id={`needleGlow-${title}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            
            {/* Background arc (darker) */}
            <path
              d={bgArc}
              fill="none"
              stroke="rgba(100, 116, 139, 0.3)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            
            {/* Colored segments on background */}
            <path
              d={createArc(startAngle, startAngle + angleRange * 0.5, radius)}
              fill="none"
              stroke="rgba(16, 185, 129, 0.2)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            <path
              d={createArc(startAngle + angleRange * 0.5, startAngle + angleRange * 0.8, radius)}
              fill="none"
              stroke="rgba(245, 158, 11, 0.2)"
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
            />
            <path
              d={createArc(startAngle + angleRange * 0.8, endAngle, radius)}
              fill="none"
              stroke="rgba(239, 68, 68, 0.2)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            
            {/* Active value arc */}
            {valueArc && (
              <path
                d={valueArc}
                fill="none"
                stroke={colors.arcActive}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                style={{
                  filter: `drop-shadow(0 0 8px ${colors.glow})`,
                }}
              />
            )}
            
            {/* Tick marks */}
            {tickMarks.map(({ tick, innerPoint, outerPoint, labelPoint }) => (
              <g key={tick}>
                <line
                  x1={innerPoint.x}
                  y1={innerPoint.y}
                  x2={outerPoint.x}
                  y2={outerPoint.y}
                  stroke="rgba(148, 163, 184, 0.5)"
                  strokeWidth="2"
                />
                <text
                  x={labelPoint.x}
                  y={labelPoint.y}
                  fill="rgba(148, 163, 184, 0.7)"
                  fontSize="10"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {tick}
                </text>
              </g>
            ))}
            
            {/* Center circle */}
            <circle
              cx={cx}
              cy={cy}
              r={16}
              fill="rgba(30, 41, 59, 0.9)"
              stroke="rgba(100, 116, 139, 0.5)"
              strokeWidth="2"
            />
            
            {/* Needle */}
            <line
              x1={cx}
              y1={cy}
              x2={needleEndX}
              y2={needleEndY}
              stroke={colors.needle}
              strokeWidth="4"
              strokeLinecap="round"
              filter={`url(#needleGlow-${title})`}
            />
            
            {/* Center cap */}
            <circle
              cx={cx}
              cy={cy}
              r={8}
              fill={colors.needle}
              style={{
                filter: `drop-shadow(0 0 6px ${colors.glow})`,
              }}
            />
            
            {/* Value display */}
            <text
              x={cx}
              y={cy + 45}
              fill="white"
              fontSize="28"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {mainValue !== null ? mainValue.toFixed(1) : "--"}
              <tspan fontSize="14" fill="rgba(148, 163, 184, 0.8)">{mainUnit}</tspan>
            </text>
            
            <text
              x={cx}
              y={cy + 68}
              fill="rgba(148, 163, 184, 0.8)"
              fontSize="12"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {mainLabel}
            </text>
          </svg>
        </div>
        
        {/* Secondary metric */}
        {secondaryValue !== undefined && secondaryLabel && (
          <div className="flex items-center justify-center gap-4 mt-2 pt-3 border-t border-gray-200 dark:border-slate-700/50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-violet-500" />
              <span className="text-gray-500 dark:text-slate-400 text-sm">{secondaryLabel}:</span>
              <span className={`font-semibold ${colors.text}`}>
                {secondaryValue !== null ? secondaryValue.toFixed(1) : "--"}{secondaryUnit}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BigCarGauge;
