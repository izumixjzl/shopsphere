import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { compact, humanize, money } from '../lib/format'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Tooltip, Legend)
ChartJS.defaults.font.family = 'Figtree, system-ui, sans-serif'
ChartJS.defaults.color = '#7c82a3'

const SPHERE = '#4f3bd9'
const MANGO = '#ffb020'

/** Gross sales (line) over daily order counts (bars). */
export function SalesChart({ series }) {
  if (!series) return null
  const labels = series.labels.map((d) => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }))
  return (
    <div className="h-72">
      <Line
        data={{
          labels,
          datasets: [
            {
              type: 'line', label: 'Gross sales', data: series.sales, yAxisID: 'y', borderColor: SPHERE, borderWidth: 2.5,
              backgroundColor: 'rgba(79,59,217,0.08)', fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 5,
            },
            { type: 'bar', label: 'Orders', data: series.orders, yAxisID: 'y1', backgroundColor: MANGO, borderRadius: 4, maxBarThickness: 14 },
          ],
        }}
        options={{
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top', align: 'end', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } },
            tooltip: { callbacks: { label: (c) => (c.dataset.yAxisID === 'y' ? ` Sales: ${money(c.raw)}` : ` Orders: ${c.raw}`) } },
          },
          scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } },
            y: { grid: { color: '#eef0f7' }, border: { display: false }, ticks: { callback: (v) => `₱${compact(v)}` } },
            y1: { position: 'right', grid: { display: false }, border: { display: false }, ticks: { precision: 0 } },
          },
        }}
      />
    </div>
  )
}

const STATUS_COLORS = {
  pending: '#ffb020', confirmed: '#8b7cf0', packed: '#6a58e6', shipped: '#4f3bd9',
  delivered: '#1f9d6b', cancelled: '#e5484d', returned: '#7c82a3',
}

export function StatusDoughnut({ breakdown }) {
  const entries = Object.entries(breakdown || {})
  if (!entries.length) return <p className="py-16 text-center text-sm text-ink-mute">No orders in this period.</p>
  return (
    <div className="h-64">
      <Doughnut
        data={{
          labels: entries.map(([k]) => humanize(k)),
          datasets: [{ data: entries.map(([, v]) => v), backgroundColor: entries.map(([k]) => STATUS_COLORS[k] || '#ccc'), borderWidth: 0 }],
        }}
        options={{ maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'right', labels: { boxWidth: 10, usePointStyle: true } } } }}
      />
    </div>
  )
}

export function BarList({ rows, valueKey = 'revenue', labelKey = 'name' }) {
  if (!rows?.length) return <p className="py-10 text-center text-sm text-ink-mute">No sales yet.</p>
  return (
    <div className="h-64">
      <Bar
        data={{ labels: rows.map((r) => r[labelKey]), datasets: [{ data: rows.map((r) => r[valueKey]), backgroundColor: SPHERE, borderRadius: 6, maxBarThickness: 22 }] }}
        options={{
          indexAxis: 'y', maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${money(c.raw)}` } } },
          scales: { x: { grid: { color: '#eef0f7' }, ticks: { callback: (v) => `₱${compact(v)}` } }, y: { grid: { display: false }, ticks: { autoSkip: false } } },
        }}
      />
    </div>
  )
}

export function StatCard({ label, value, note, tone }) {
  const toneCls = tone === 'warn' ? 'text-[#8a5a00]' : tone === 'up' ? 'text-leaf' : tone === 'down' ? 'text-coral' : 'text-ink-mute'
  return (
    <div className="card p-5">
      <div className="text-sm text-ink-soft">{label}</div>
      <div className="mt-2 font-display text-[1.7rem] font-bold leading-none tabular-nums">{value}</div>
      {note && <div className={`mt-2 text-xs ${toneCls}`}>{note}</div>}
    </div>
  )
}
