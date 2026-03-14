'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

/** A single share class holding for a stakeholder. */
interface Holding {
  share_class_id: string;
  share_class_name: string;
  shares_held: number;
  ownership_percentage: number;
}

/** A stakeholder with their aggregated holdings. */
export interface ChartStakeholder {
  id: string;
  name: string;
  email: string | null;
  role_title: string | null;
  holdings: Holding[];
  total_shares: number;
  total_ownership_percentage: number;
}

export interface OwnershipChartProps {
  /** Array of stakeholders with ownership data. */
  stakeholders: ChartStakeholder[];
  /** Total number of issued shares across all stakeholders. */
  totalIssued: number;
}

/**
 * Predefined color palette for the pie chart slices.
 * Provides 10 distinct, visually accessible colors.
 */
const CHART_COLORS = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#3b82f6', // blue
  '#84cc16', // lime
];

/** Recharts tooltip payload shape. */
interface TooltipPayloadEntry {
  payload: {
    name: string;
    shares: number;
    percentage: number;
    fill: string;
  };
}

/**
 * Custom tooltip showing stakeholder name, shares held, and ownership percentage.
 */
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;

  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
      <p className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: entry.fill }}
        />
        <span className="font-medium">{entry.name}</span>
      </p>
      <p className="text-muted-foreground mt-1">
        {entry.shares.toLocaleString()} shares
      </p>
      <p className="text-muted-foreground">
        {entry.percentage.toFixed(4)}% ownership
      </p>
    </div>
  );
}

/**
 * Donut chart displaying ownership distribution across stakeholders.
 * Shows total issued shares in the center of the donut.
 */
export function OwnershipChart({ stakeholders, totalIssued }: OwnershipChartProps) {
  if (stakeholders.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No ownership data to display.
      </div>
    );
  }

  const chartData = stakeholders.map((s, index) => ({
    name: s.name,
    shares: s.total_shares,
    percentage: s.total_ownership_percentage,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          dataKey="shares"
          nameKey="name"
        >
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        {/* Center text showing total issued shares */}
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
          <tspan x="50%" dy="-10" fontSize="12" fill="#6b7280">
            Total Issued
          </tspan>
          <tspan x="50%" dy="22" fontSize="18" fontWeight="bold" fill="#111827">
            {totalIssued.toLocaleString()}
          </tspan>
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}
