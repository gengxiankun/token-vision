'use client';

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
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

const COLORS = ['#00f0ff', '#ff00ff', '#7b2fff', '#00ff9d', '#ffd700', '#ff6b6b', '#48dbfb', '#ff9ff3'];

function formatTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function formatCost(n: number): string {
  return '$' + n.toFixed(4);
}

function GlowingStatCard({ label, value, suffix, color }: { label: string; value: string | number; suffix?: string; color: string }) {
  return (
    <div className="glass-card p-6 relative overflow-hidden card-scanline" style={{ borderColor: `${color}33` }}>
      <div className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-2 font-medium">{label}</div>
      <div className="text-3xl font-bold" style={{ color }}>
        {value}
        {suffix && <span className="text-sm text-gray-500 ml-1">{suffix}</span>}
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg rank-gold">🥇</span>;
  if (rank === 2) return <span className="text-lg rank-silver">🥈</span>;
  if (rank === 3) return <span className="text-lg rank-bronze">🥉</span>;
  return <span className="text-gray-500 font-mono text-sm">#{rank}</span>;
}

function TokenBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = (value / max) * 100;
  return (
    <div className="h-3 rounded-full overflow-hidden bg-[rgba(255,255,255,0.05)]">
      <div
        className="h-full rounded-full transition-all duration-1000 ease-out"
        style={{
          width: `${Math.max(pct, 1)}%`,
          background: `linear-gradient(90deg, ${color}66, ${color})`,
          boxShadow: `0 0 10px ${color}44`,
        }}
      />
    </div>
  );
}

function DataTable({ data }: { data: RankingItem[] }) {
  const [sortKey, setSortKey] = useState<'sessions' | 'totalTokens' | 'cost'>('sessions');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const sorted = [...data].sort((a, b) => {
    const diff = sortDir === 'desc' ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey];
    return diff;
  });

  const maxTokens = Math.max(...data.map(d => d.totalTokens));
  const maxSessions = Math.max(...data.map(d => d.sessions));

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <span className="text-xs text-gray-500 uppercase tracking-wider">排序：</span>
        {(['sessions', 'totalTokens', 'cost'] as const).map(key => (
          <button
            key={key}
            onClick={() => {
              if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
              else { setSortKey(key); setSortDir('desc'); }
            }}
            className={`text-xs px-3 py-1.5 rounded-full transition-all ${
              sortKey === key
                ? 'bg-[rgba(0,240,255,0.15)] text-[#00f0ff] border border-[rgba(0,240,255,0.3)]'
                : 'bg-[rgba(255,255,255,0.03)] text-gray-500 border border-transparent hover:text-gray-300'
            }`}
          >
            {key === 'sessions' ? '会话次数' : key === 'totalTokens' ? '总Token' : '费用'}
            {sortKey === key && (sortDir === 'desc' ? ' ↓' : ' ↑')}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {sorted.map((item, i) => {
          const barColor = item.rank <= 3 ? COLORS[item.rank - 1] : '#4a4a8a';
          return (
            <div
              key={item.name}
              className="glass-card p-4 flex items-center gap-4 animate-count"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="w-10 text-center">
                <RankBadge rank={item.rank} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm truncate text-gray-200">{item.name}</span>
                  <span className="text-xs text-gray-500 font-mono">{formatTokens(item.totalTokens)}</span>
                </div>
                <div className="flex gap-6">
                  <div className="flex-1">
                    <TokenBar value={item.sessions} max={maxSessions} color={barColor} />
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-gray-600">会话</span>
                      <span className="text-[10px] font-mono" style={{ color: barColor }}>{item.sessions}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-mono text-gray-400">{formatCost(item.cost)}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CostPieChart({ data }: { data: RankingItem[] }) {
  // Top 8 by cost
  const top = [...data].sort((a, b) => b.cost - a.cost).slice(0, 8);
  const other = data.slice(8);
  const otherCost = other.reduce((s, r) => s + r.cost, 0);
  const chartData = [
    ...top.map(r => ({ name: r.name, value: r.cost })),
    { name: '其他', value: otherCost },
  ];

  return (
    <div className="glass-card p-6 card-scanline">
      <h3 className="text-sm uppercase tracking-[0.2em] text-gray-400 mb-4">费用分布</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={110}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="rgba(0,0,0,0.3)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: 'rgba(10,10,26,0.95)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '12px', color: '#e0e0ff' }}
            formatter={(value: number) => [formatCost(value), '费用']}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2 mt-2">
        {chartData.map((item, i) => (
          <div key={item.name} className="flex items-center gap-1.5 text-xs text-gray-400">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span>{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SessionsBarChart({ data }: { data: RankingItem[] }) {
  const top15 = [...data].sort((a, b) => b.sessions - a.sessions).slice(0, 15);

  return (
    <div className="glass-card p-6 card-scanline">
      <h3 className="text-sm uppercase tracking-[0.2em] text-gray-400 mb-4">会话次数 Top 15</h3>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={top15} layout="vertical" margin={{ left: 20, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis type="number" tick={{ fill: '#666', fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#aaa', fontSize: 11 }} width={80} />
          <Tooltip
            contentStyle={{ background: 'rgba(10,10,26,0.95)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '12px', color: '#e0e0ff' }}
            formatter={(value: number) => [value, '会话次数']}
          />
          <Bar dataKey="sessions" radius={[0, 4, 4, 0]}>
            {top15.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TokenEfficiencyChart({ data }: { data: RankingItem[] }) {
  const top20 = [...data]
    .filter(r => r.sessions >= 5)
    .map(r => ({ name: r.name, outputPerSession: Math.round(r.totalTokens * 0.4 / r.sessions) }))
    .sort((a, b) => b.outputPerSession - a.outputPerSession)
    .slice(0, 20);

  return (
    <div className="glass-card p-6 card-scanline">
      <h3 className="text-sm uppercase tracking-[0.2em] text-gray-400 mb-4">每次会话产出 Token (估算)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={top20} layout="vertical" margin={{ left: 20, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis type="number" tick={{ fill: '#666', fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#aaa', fontSize: 11 }} width={80} />
          <Tooltip
            contentStyle={{ background: 'rgba(10,10,26,0.95)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '12px', color: '#e0e0ff' }}
            formatter={(value: number) => [value.toLocaleString(), 'Token/会话']}
          />
          <Bar dataKey="outputPerSession" radius={[0, 4, 4, 0]}>
            {top20.map((_, i) => (
              <Cell key={i} fill={`hsl(${180 + i * 12}, 100%, 60%)`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TopSection({ top5 }: { top5: RankingItem[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {top5.map((item, i) => (
        <div
          key={item.name}
          className={`glass-card p-6 relative glow-border animate-count card-scanline`}
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="flex items-center gap-3 mb-3">
            <RankBadge rank={item.rank} />
            <div className="text-lg font-bold text-gray-100">{item.name}</div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-600">会话</div>
              <div className="text-lg font-bold font-mono text-[#00f0ff]">{item.sessions}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-600">Token</div>
              <div className="text-lg font-bold font-mono text-[#ff00ff]">{formatTokens(item.totalTokens)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-600">费用</div>
              <div className="text-lg font-bold font-mono text-[#00ff9d]">{formatCost(item.cost)}</div>
            </div>
          </div>
          {item.rank === 1 && (
            <div className="absolute -top-3 -right-3 text-2xl pulse-glow">👑</div>
          )}
        </div>
      ))}
    </div>
  );
}

function StarField() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: Math.random() > 0.7 ? '#00f0ff' : Math.random() > 0.5 ? '#7b2fff' : '#ffffff',
            opacity: Math.random() * 0.5 + 0.2,
            animation: `glowPulse ${Math.random() * 3 + 2}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
            width: `${Math.random() * 2 + 1}px`,
            height: `${Math.random() * 2 + 1}px`,
          }}
        />
      ))}
    </div>
  );
}

function HackerRain() {
  // Digital rain effect column labels
  return (
    <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.02] overflow-hidden text-[#00f0ff] text-[10px] font-mono leading-tight">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="absolute" style={{ left: `${i * 14}%`, top: 0 }}>
          {Array.from({ length: 20 }).map((_, j) => (
            <div key={j} style={{ opacity: 1 - j * 0.05 }}>{'01001101'.substring(j % 8)}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'dashboard' | 'ranking' | 'charts'>('dashboard');

  useEffect(() => {
    fetch('/data/data.json')
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">⟁</div>
          <div className="text-[#00f0ff] text-sm uppercase tracking-[0.3em] animate-pulse">INITIALIZING... </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card p-8 text-center">
          <div className="text-4xl mb-4">⚠</div>
          <div className="text-gray-400">数据载入失败。请先运行 `npm run fetch-data`</div>
        </div>
      </div>
    );
  }

  const { stats, top5, ranking, detail } = data;
  const rankTop3 = ranking.slice(0, 3);

  return (
    <>
      <StarField />
      <HackerRain />

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-4xl font-black neon-text tracking-tight">
                TOKEN VISION
              </h1>
              <p className="text-gray-600 text-sm mt-1 tracking-wide">
                Hermes AI · 跨实例 Token 消耗监控系统
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-600 font-mono">
                更新于 {data.updatedAt}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {stats.totalPeople} 位活跃用户
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex gap-2 mt-6">
            {([
              { key: 'dashboard', label: '总览', icon: '◆' },
              { key: 'ranking', label: '排名', icon: '▲' },
              { key: 'charts', label: '图表', icon: '■' },
            ] as const).map(nav => (
              <button
                key={nav.key}
                onClick={() => setActiveView(nav.key)}
                className={`px-5 py-2 rounded-full text-sm transition-all ${
                  activeView === nav.key
                    ? 'bg-[rgba(0,240,255,0.1)] text-[#00f0ff] border border-[rgba(0,240,255,0.3)]'
                    : 'text-gray-500 hover:text-gray-300 border border-transparent'
                }`}
              >
                {nav.icon} {nav.label}
              </button>
            ))}
          </nav>
        </header>

        {activeView === 'dashboard' && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <GlowingStatCard label="总 Token" value={formatTokens(stats.totalTokens)} color="#00f0ff" />
              <GlowingStatCard label="总费用" value={`$${stats.totalCost}`} color="#ff00ff" />
              <GlowingStatCard label="总会话" value={stats.totalSessions} color="#7b2fff" />
              <GlowingStatCard label="活跃人数" value={stats.totalPeople} color="#00ff9d" />
            </div>

            {/* Top 3 */}
            <div className="mb-8">
              <h2 className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-4">🏆 前三名</h2>
              <TopSection top5={top5} />
            </div>

            {/* Avg stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="glass-card p-4 text-center">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">人均 Token</div>
                <div className="text-xl font-bold text-[#00f0ff]">{formatTokens(stats.avgTokensPerPerson)}</div>
              </div>
              <div className="glass-card p-4 text-center">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">人均费用</div>
                <div className="text-xl font-bold text-[#ff00ff]">${stats.avgCostPerPerson}</div>
              </div>
              <div className="glass-card p-4 text-center">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">人均会话</div>
                <div className="text-xl font-bold text-[#00ff9d]">{stats.avgSessionsPerPerson}</div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <CostPieChart data={ranking} />
              <SessionsBarChart data={ranking} />
            </div>
          </>
        )}

        {activeView === 'ranking' && (
          <div className="max-w-3xl mx-auto">
            <DataTable data={ranking} />
          </div>
        )}

        {activeView === 'charts' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <CostPieChart data={ranking} />
              <SessionsBarChart data={ranking} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TokenEfficiencyChart data={ranking} />
              {/* Summary table card */}
              <div className="glass-card p-6 card-scanline">
                <h3 className="text-sm uppercase tracking-[0.2em] text-gray-400 mb-4">完整排名</h3>
                <div className="overflow-y-auto max-h-[400px]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-[10px] uppercase tracking-wider border-b border-[rgba(255,255,255,0.05)]">
                        <th className="text-left py-2">#</th>
                        <th className="text-left py-2">姓名</th>
                        <th className="text-right py-2">Token</th>
                        <th className="text-right py-2">会话</th>
                        <th className="text-right py-2">费用</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.map((item) => (
                        <tr key={item.name} className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)]">
                          <td className="py-2 font-mono text-gray-500">{item.rank}</td>
                          <td className="py-2 text-gray-300">{item.name}</td>
                          <td className="py-2 text-right font-mono text-[#00f0ff]">{formatTokens(item.totalTokens)}</td>
                          <td className="py-2 text-right font-mono text-[#ff00ff]">{item.sessions}</td>
                          <td className="py-2 text-right font-mono text-[#00ff9d]">{formatCost(item.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <footer className="mt-16 pb-8 text-center">
          <div className="text-[10px] text-gray-700 uppercase tracking-[0.4em]">
            <span className="text-[#00f0ff]">✦</span> POWERED BY HERMES AI <span className="text-[#ff00ff]">✦</span>
          </div>
          <div className="text-[10px] text-gray-700 mt-2 font-mono">
            token-vision v0.1 · 数据每小时自动同步
          </div>
        </footer>
      </div>
    </>
  );
}
