'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

interface RankingItem {
  rank: number;
  name: string;
  totalTokens: number;
  cost: number;
  sessions: number;
  sources: number;
  updatedAt: string;
}

interface DetailItem {
  name: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  groups: string;
  sessions: number;
  dmSessions: number;
  groupSessions: number;
  updatedAt: string;
}

interface Stats {
  totalPeople: number;
  totalTokens: number;
  totalCost: number;
  totalSessions: number;
  avgTokensPerPerson: number;
  avgCostPerPerson: number;
  avgSessionsPerPerson: number;
}

interface Data {
  updatedAt: string;
  stats: Stats;
  top5: RankingItem[];
  ranking: RankingItem[];
  detail: DetailItem[];
}

/* ── Helpers ────────────────────────────────── */
const fmt = (n: number): string => {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
};

const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-');
};

/* ── Bar character for mini graphs ──────────── */
const barChar = (pct: number, maxLen = 20): string => {
  const filled = Math.round((pct / 100) * maxLen);
  return '█'.repeat(filled) + '░'.repeat(maxLen - filled);
};

/* ── ASCII Banner ───────────────────────────── */
const AsciiBanner = () => (
  <pre className="ascii-banner leading-tight mb-3" style={{ fontSize: '10px' }}>
{'╔══════════════════════════════════════════════════╗\n' +
 '║              ████████  ██  ████████              ║\n' +
 '║              ██░░░░██  ██  ██░░░░                ║\n' +
 '║              ████████  ██  ███████  v1.0.0       ║\n' +
 '║              ██░░░░░░  ██  ██░░░░                ║\n' +
 '║              ██░░░░░░  ██  ████████              ║\n' +
 '╚══════════════════════════════════════════════════╝'}
  </pre>
);

/* ── TermBox wrapper ────────────────────────── */
function TermBox({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`term-box p-3 ${className}`}>
      {title && <div className="term-title-bar">{title}</div>}
      {children}
    </div>
  );
}

/* ── Stats line ─────────────────────────────── */
function StatsRow({ label, value, suffix, color = 'cyan' }: { label: string; value: string | number; suffix?: string; color?: string }) {
  return (
    <div className="flex items-baseline gap-2 py-1">
      <span className="stat-label min-w-[120px]">{label}</span>
      <span className="text-dots text-[var(--term-dim)]">:</span>
      <span className={`stat-value ${color}`}>
        {value}
        {suffix && <span className="text-xs text-[var(--term-dim)] ml-1">{suffix}</span>}
      </span>
    </div>
  );
}

/* ── Top N card (neofetch style) ────────────── */
function TopCard({ item, rank }: { item: RankingItem; rank: number }) {
  const maxTokens = item.totalTokens;
  const maxSessions = item.sessions;
  const colors = ['green', 'amber', 'cyan'] as const;
  const rankColor = ['#33ff33', '#ffb000', '#00ffff'][rank - 1];
  const rankLabel = ['● MASTER', '● NODE', '● PEER'][rank - 1] || `#${rank}`;

  return (
    <div className="term-box p-3 mb-2 term-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <span style={{ color: rankColor, fontSize: 14 }}>{['◆', '◇', '○'][rank - 1]}</span>
        <span className="text-xs text-[var(--term-dim)] uppercase tracking-[0.15em]">{rankLabel}</span>
      </div>
      <div className="text-sm font-bold text-[var(--term-highlight)] mb-2">{item.name}</div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--term-dim)] w-16">SESSIONS</span>
          <div className="term-bar-bg flex-1 max-w-[200px]">
            <div className={`term-bar-fill ${colors[(rank - 1) % 3]}`} style={{ width: '100%' }} />
          </div>
          <span className="text-xs text-[var(--term-fg)] w-16 text-right">{item.sessions}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--term-dim)] w-16">TOKENS</span>
          <div className="term-bar-bg flex-1 max-w-[200px]">
            <div className={`term-bar-fill ${colors[(rank - 1) % 3]}`} style={{ width: '85%' }} />
          </div>
          <span className="text-xs text-[var(--term-fg)] w-16 text-right">{fmt(item.totalTokens)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--term-dim)] w-16">COST</span>
          <div className="term-bar-bg flex-1 max-w-[200px]">
            <div className={`term-bar-fill ${colors[(rank - 1) % 3]}`} style={{ width: '60%' }} />
          </div>
          <span className="text-xs text-[var(--term-fg)] w-16 text-right">${item.cost.toFixed(4)}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Terminal Data Table ────────────────────── */
function TermDataTable({ data }: { data: RankingItem[] }) {
  const [sortKey, setSortKey] = useState<'sessions' | 'totalTokens' | 'cost'>('sessions');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      return sortDir === 'desc' ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey];
    });
  }, [data, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortArrow = (key: string) => {
    if (sortKey !== key) return '';
    return sortDir === 'desc' ? ' ▼' : ' ▲';
  };

  const maxVal = Math.max(...data.map(d => d[sortKey]));

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-xs text-[var(--term-dim)]">
        <span className="uppercase tracking-wider">sort:</span>
        <button onClick={() => toggleSort('sessions')} className="term-tab text-xs px-2 py-0.5">
          <span className="tab-num">1</span> sessions{sortArrow('sessions')}
        </button>
        <button onClick={() => toggleSort('totalTokens')} className="term-tab text-xs px-2 py-0.5">
          <span className="tab-num">2</span> tokens{sortArrow('totalTokens')}
        </button>
        <button onClick={() => toggleSort('cost')} className="term-tab text-xs px-2 py-0.5">
          <span className="tab-num">3</span> cost{sortArrow('cost')}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="term-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>name</th>
              <th style={{ width: 80 }} className="text-right">tokens</th>
              <th style={{ width: 80 }} className="text-right">sessions</th>
              <th style={{ width: 90 }} className="text-right">cost</th>
              <th className="hidden md:table-cell">bar</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, i) => {
              const barPct = (item[sortKey] / maxVal) * 100;
              const rankColor = item.rank === 1 ? '#33ff33' : item.rank === 2 ? '#ffb000' : item.rank === 3 ? '#00ffff' : '#555';
              return (
                <tr key={item.name} className="term-fade-in" style={{ animationDelay: `${i * 20}ms` }}>
                  <td style={{ color: rankColor }}>{item.rank <= 3 ? ['●', '◆', '◇'][item.rank - 1] : `#${item.rank}`}</td>
                  <td className="font-medium">{item.name}</td>
                  <td className="text-right font-mono text-xs">{fmt(item.totalTokens)}</td>
                  <td className="text-right font-mono text-xs">{item.sessions}</td>
                  <td className="text-right font-mono text-xs text-[var(--term-amber)]">${item.cost.toFixed(4)}</td>
                  <td className="hidden md:table-cell">
                    <span className="mini-graph text-xs">{barChar(barPct, 15)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Terminal Style Charts ──────────────────── */
const chartColors = ['#33ff33', '#ffb000', '#00ffff', '#ff3333', '#ff69b4', '#aa66ff', '#ffd700', '#00ff9d'];

function CostPie({ data }: { data: RankingItem[] }) {
  const top = [...data].sort((a, b) => b.cost - a.cost).slice(0, 8);
  const other = data.slice(8);
  const chartData = [
    ...top.map(r => ({ name: r.name, value: r.cost })),
    { name: 'others', value: other.reduce((s, r) => s + r.cost, 0) },
  ];

  return (
    <TermBox title="cost distribution">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={1} dataKey="value">
            {chartData.map((_, i) => (
              <Cell key={i} fill={chartColors[i % chartColors.length]} stroke="#0c0c0c" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 0, color: '#c8c8c8', fontFamily: 'monospace', fontSize: 12 }}
            formatter={(value: number) => [`$${value.toFixed(4)}`, 'cost']}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2 mt-2 text-xs font-mono">
        {chartData.map((item, i) => (
          <div key={item.name} className="flex items-center gap-1 text-[var(--term-dim)]">
            <span style={{ color: chartColors[i % chartColors.length] }}>■</span>
            <span>{item.name}</span>
          </div>
        ))}
      </div>
    </TermBox>
  );
}

function SessionsBar({ data }: { data: RankingItem[] }) {
  const top15 = [...data].sort((a, b) => b.sessions - a.sessions).slice(0, 15);

  return (
    <TermBox title="sessions top 15">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={top15} layout="vertical" margin={{ left: 20, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis type="number" tick={{ fill: '#555', fontSize: 11, fontFamily: 'monospace' }} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#888', fontSize: 11, fontFamily: 'monospace' }} width={70} />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 0, color: '#c8c8c8', fontFamily: 'monospace', fontSize: 12 }}
            formatter={(value: number) => [value, 'sessions']}
          />
          <Bar dataKey="sessions" radius={[0, 2, 2, 0]}>
            {top15.map((_, i) => (
              <Cell key={i} fill={chartColors[i % chartColors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </TermBox>
  );
}

function EfficiencyChart({ data }: { data: RankingItem[] }) {
  const top20 = [...data]
    .filter(r => r.sessions >= 5)
    .map(r => ({ name: r.name, value: Math.round(r.totalTokens * 0.4 / r.sessions) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 20);

  return (
    <TermBox title="tokens per session (est.)">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={top20} layout="vertical" margin={{ left: 20, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis type="number" tick={{ fill: '#555', fontSize: 11, fontFamily: 'monospace' }} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#888', fontSize: 11, fontFamily: 'monospace' }} width={70} />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 0, color: '#c8c8c8', fontFamily: 'monospace', fontSize: 12 }}
            formatter={(value: number) => [value.toLocaleString(), 'tokens/session']}
          />
          <Bar dataKey="value" radius={[0, 2, 2, 0]}>
            {top20.map((_, i) => (
              <Cell key={i} fill={`hsl(${120 + i * 8}, 100%, ${50 + i}%)`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </TermBox>
  );
}

/* ── Full ranking table card ────────────────── */
function FullRankingTable({ data }: { data: RankingItem[] }) {
  return (
    <TermBox title="full ranking">
      <div className="overflow-y-auto max-h-[350px]">
        <table className="term-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}>#</th>
              <th>name</th>
              <th className="text-right">tokens</th>
              <th className="text-right">sessions</th>
              <th className="text-right">cost</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => {
              const c = item.rank === 1 ? '#33ff33' : item.rank === 2 ? '#ffb000' : item.rank === 3 ? '#00ffff' : '#888';
              return (
                <tr key={item.name}>
                  <td style={{ color: c }}>#{item.rank}</td>
                  <td>{item.name}</td>
                  <td className="text-right font-mono text-[var(--term-cyan)]">{fmt(item.totalTokens)}</td>
                  <td className="text-right font-mono">{item.sessions}</td>
                  <td className="text-right font-mono text-[var(--term-amber)]">${item.cost.toFixed(4)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </TermBox>
  );
}

/* ── Tab nav item ───────────────────────────── */
function NavTab({ num, label, active, onClick }: { num: number; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`term-tab ${active ? 'active' : ''}`}
    >
      <span className="tab-num">[{num}]</span> {label}
    </button>
  );
}

/* ── Status bar ─────────────────────────────── */
function StatusBar({ text, items }: { text?: string; items?: { label: string; value: string }[] }) {
  return (
    <div className="flex items-center gap-4 text-[10px] text-[var(--term-dim)] font-mono border-t border-[var(--term-border)] pt-2 mt-4">
      {text && <span>{text}</span>}
      {items?.map((item, i) => (
        <span key={i}>
          <span className="text-[var(--term-green)]">{item.label}</span>={item.value}
        </span>
      ))}
      <span className="cursor-blink ml-auto" />
    </div>
  );
}

/* ── Main Page ──────────────────────────────── */
export default function Home() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'dashboard' | 'ranking' | 'charts'>('dashboard');

  useEffect(() => {
    fetch('./data/data.json')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <TermBox title="booting" className="text-center w-full max-w-md">
          <AsciiBanner />
          <hr className="term-sep" />
          <div className="text-xs text-[var(--term-dim)] mb-3">loading data from feishu sheets...</div>
          <div className="term-bar-bg w-full max-w-xs mx-auto">
            <div className="term-bar-fill green" style={{ width: '60%' }} />
          </div>
          <div className="text-xs text-[var(--term-green)] mt-2 text-blink">⟁</div>
        </TermBox>
      </div>
    );
  }

  /* ── Error ── */
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <TermBox title="error" className="text-center">
          <div className="text-[var(--term-red)] text-lg mb-2">✗</div>
          <div className="text-sm text-[var(--term-fg)] mb-1">Failed to load data.</div>
          <div className="text-xs text-[var(--term-dim)]">Run `node scripts/fetch-data.js` first.</div>
        </TermBox>
      </div>
    );
  }

  const { stats, top5, ranking } = data;

  return (
    <div className="min-h-screen p-4 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <TermBox className="mb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-[var(--term-green)] mb-1">
              <span className="term-prompt">./token-vision --monitor</span>
            </div>
            <AsciiBanner />
            <div className="text-[10px] text-[var(--term-dim)] tracking-[0.2em] uppercase">
              Hermes AI · Cross-Instance Token Consumption Monitor
            </div>
          </div>
          <div className="text-right text-[10px] text-[var(--term-dim)] font-mono">
            <div>UPDATED {fmtDate(data.updatedAt)}</div>
            <div className="text-[var(--term-green)]">{stats.totalPeople} ACTIVE USERS</div>
          </div>
        </div>
      </TermBox>

      {/* ── Navigation ── */}
      <div className="flex gap-1 mb-4 flex-wrap">
        <NavTab num={1} label="DASHBOARD" active={activeView === 'dashboard'} onClick={() => setActiveView('dashboard')} />
        <NavTab num={2} label="RANKING" active={activeView === 'ranking'} onClick={() => setActiveView('ranking')} />
        <NavTab num={3} label="CHARTS" active={activeView === 'charts'} onClick={() => setActiveView('charts')} />
      </div>

      {/* ── Dashboard ── */}
      {activeView === 'dashboard' && (
        <>
          {/* Stats */}
          <TermBox title="summary" className="mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <StatsRow label="TOTAL TOKENS" value={fmt(stats.totalTokens)} color="cyan" />
                <StatsRow label="TOTAL COST" value={`$${stats.totalCost}`} color="amber" />
              </div>
              <div>
                <StatsRow label="TOTAL SESSIONS" value={stats.totalSessions} color="green" />
                <StatsRow label="ACTIVE USERS" value={stats.totalPeople} color="green" />
              </div>
              <div>
                <StatsRow label="AVG TOKENS/USER" value={fmt(stats.avgTokensPerPerson)} color="cyan" />
                <StatsRow label="AVG COST/USER" value={`$${stats.avgCostPerPerson}`} color="amber" />
              </div>
              <div>
                <StatsRow label="AVG SESSIONS/USER" value={stats.avgSessionsPerPerson} color="green" />
              </div>
            </div>
          </TermBox>

          {/* Top 3 */}
          <div className="mb-4">
            <div className="text-xs text-[var(--term-dim)] uppercase tracking-[0.15em] mb-2">
              ▸ top operators
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {top5.slice(0, 3).map((item, i) => (
                <TopCard key={item.name} item={item} rank={i + 1} />
              ))}
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <CostPie data={ranking} />
            <SessionsBar data={ranking} />
          </div>

          <StatusBar
            items={[
              { label: 'view', value: 'dashboard' },
              { label: 'users', value: String(stats.totalPeople) },
              { label: 'total_tokens', value: fmt(stats.totalTokens) },
            ]}
          />
        </>
      )}

      {/* ── Ranking ── */}
      {activeView === 'ranking' && (
        <TermBox title="player ranking" className="mb-4">
          <TermDataTable data={ranking} />
          <StatusBar
            items={[
              { label: 'view', value: 'ranking' },
              { label: 'entries', value: String(ranking.length) },
              { label: 'sort', value: 'click tabs to change' },
            ]}
          />
        </TermBox>
      )}

      {/* ── Charts ── */}
      {activeView === 'charts' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <CostPie data={ranking} />
            <SessionsBar data={ranking} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <EfficiencyChart data={ranking} />
            <FullRankingTable data={ranking} />
          </div>
          <StatusBar
            items={[
              { label: 'view', value: 'charts' },
              { label: 'users', value: String(stats.totalPeople) },
            ]}
          />
        </>
      )}
    </div>
  );
}
