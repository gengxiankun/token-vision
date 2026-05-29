'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import StarChart from './star-chart';

/* ── Types ──────────────────────────────────── */
interface RankingItem {
  rank: number;
  name: string;
  totalTokens: number;
  cost: number;
  sessions: number;
  sources: number;
  wisdomScore?: number;
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
  totalWisdom?: number;
  avgWisdomPerPerson?: number;
}

interface Data {
  updatedAt: string;
  dataSource?: string;
  timeRange?: string;
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

const bar = (pct: number, len = 24): string => {
  const f = Math.round((pct / 100) * len);
  return '█'.repeat(Math.max(0, f)) + '░'.repeat(Math.max(0, len - f));
};

/* ── Terminal line types ────────────────────── */
type TermLine =
  | { type: 'header'; text: string }
  | { type: 'info'; text: string }
  | { type: 'data'; text: string }
  | { type: 'dim'; text: string }
  | { type: 'green'; text: string }
  | { type: 'cyan'; text: string }
  | { type: 'amber'; text: string }
  | { type: 'red'; text: string }
  | { type: 'sep' }
  | { type: 'raw'; text: string }
  | { type: 'html'; html: string };

/* ── Main Page ──────────────────────────────── */
export default function Home() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootPhase, setBootPhase] = useState<'booting' | 'ready'>('booting');
  const [outputLines, setOutputLines] = useState<TermLine[]>([]);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [cmdIdx, setCmdIdx] = useState(-1);
  const [input, setInput] = useState('');
  const [starMode, setStarMode] = useState(false);
  /* ── Time range: today | 7d | 30d | 3m ── */
  const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d' | '3m'>('today');
  const [timeRangeLabel, setTimeRangeLabel] = useState('Today');
  const rangeFileMap: Record<string, string> = {
    today: './data/data.json',
    '7d': './data/data-7d.json',
    '30d': './data/data-30d.json',
    '3m': './data/data-90d.json',
  };
  const rangeLabels: Record<string, string> = {
    today: 'Today',
    '7d': '7d',
    '30d': '30d',
    '3m': '3m',
  };
  /* ── Theme: system default + localStorage persistence ── */
  const getInitialMode = (): 'dark' | 'light' => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('token-vision-theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    }
    return 'dark';
  };
  const [mode, setMode] = useState<'dark' | 'light'>(getInitialMode);

  /* ── Persist theme preference ── */
  useEffect(() => {
    localStorage.setItem('token-vision-theme', mode);
  }, [mode]);

  /* ── Boot sequence ── */
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [bootDots, setBootDots] = useState('');

  /* ── Fetch data by time range ── */
  const fetchDataByRange = useCallback((range: string) => {
    const url = rangeFileMap[range] || rangeFileMap.today;
    return fetch(url)
      .then(r => r.json())
      .then((d: Data) => {
        setData(d);
        setTimeRangeLabel(rangeLabels[range] || 'Today');
        return d;
      });
  }, []);

  const appendLines = useCallback((...newLines: TermLine[]) => {
    setOutputLines(prev => [...prev, ...newLines]);
  }, []);

  /* ── Toggle mode ── */
  const toggleMode = useCallback(() => {
    setMode(m => m === 'dark' ? 'light' : 'dark');
  }, []);

  /* ── Boot sequence ── */
  useEffect(() => {
    const ts = () => '[' + new Date().toLocaleTimeString() + ']';
    const bootMsg1: TermLine[] = [
      { type: 'dim', text: ts() + ' initializing TOKEN VISION monitor...' },
      { type: 'dim', text: ts() + ' loading kernel modules...' },
      { type: 'dim', text: ts() + ' connecting to data sources...' },
    ];
    setOutputLines(bootMsg1);

    const t1 = setTimeout(() => {
      appendLines(
        { type: 'green', text: '[OK] kernel modules loaded' },
        { type: 'green', text: '[OK] feishu sheets interface ready' },
        { type: 'dim', text: ts() + ' fetching telemetry data...' },
      );
    }, 400);

    const t2 = setTimeout(() => {
      fetch(rangeFileMap.today)
        .then(r => r.json())
        .then((d: Data) => {
          setData(d);
          setLoading(false);
          appendLines(
            { type: 'green', text: '[OK] data received — ' + d.stats.totalPeople + ' nodes online' },
            { type: 'sep' },
          );
          setBootPhase('ready');
        })
        .catch(() => {
          setLoading(false);
          appendLines(
            { type: 'red', text: '[ERR] failed to fetch telemetry data' },
            { type: 'red', text: '[ERR] run `npm run fetch-data` to populate data' },
            { type: 'sep' },
          );
          setBootPhase('ready');
        });
    }, 800);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [appendLines]);

  /* ── Cursor blink for boot ── */
  useEffect(() => {
    if (bootPhase !== 'booting') return;
    const interval = setInterval(() => {
      setBootDots(d => d.length >= 3 ? '' : d + '.');
    }, 400);
    return () => clearInterval(interval);
  }, [bootPhase]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [outputLines]);

  /* ── Command handler ── */
  const execCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();
    const parts = trimmed.split(/\s+/);
    const command = parts[0];
    const arg = parts[1];

    setCmdHistory(h => [...h, cmd]);
    setCmdIdx(-1);

    appendLines(
      { type: 'raw', text: '$ ' + cmd },
    );

    if (!data && command !== 'help' && command !== 'clear') {
      appendLines({ type: 'red', text: 'error: data not loaded. wait for boot sequence.' });
      return;
    }

    const { stats, ranking, top5 } = data || { stats: null, ranking: [], top5: [] };

    switch (command) {
      case 'dashboard': {
        appendLines(
          { type: 'header', text: 'SYSTEM OVERVIEW' },
          { type: 'sep' },
        );
        if (stats) {
          appendLines(
            { type: 'raw', text: '' },
            { type: 'html', html: `<span class="ascii-banner" style="font-size:9px;line-height:1.15;color:var(--c-green)">${[
              '╔══════════════════════════════════════════════╗',
              '║  ████████  ██  ████████  TOKEN VISION v2.0  ║',
              '║  ██░░░░██  ██  ██░░░░    HERMES AI          ║',
              '║  ████████  ██  ███████   TOKEN CONSUMPTION  ║',
              '║  ██░░░░░░  ██  ██░░░░    MONITOR             ║',
              '║  ██░░░░░░  ██  ████████                      ║',
              '╚══════════════════════════════════════════════╝',
            ].join('\n')}</span>` },
            { type: 'raw', text: '' },
            { type: 'dim', text: '  updated: ' + fmtDate(data!.updatedAt) + '   |   nodes: ' + stats.totalPeople + ' active' },
            { type: 'sep' },
          );

          // Stats grid
          appendLines(
            { type: 'raw', text: '' },
            { type: 'html', html: [
              '<div class="stats-grid">',
              `  <div class="stat-card"><span class="stat-label">total tokens</span><span class="stat-value cyan">${fmt(stats.totalTokens)}</span></div>`,
              `  <div class="stat-card"><span class="stat-label">total cost</span><span class="stat-value amber">$${stats.totalCost.toFixed(2)}</span></div>`,
              `  <div class="stat-card"><span class="stat-label">sessions</span><span class="stat-value green">${stats.totalSessions}</span></div>`,
              `  <div class="stat-card"><span class="stat-label">avg tokens/user</span><span class="stat-value cyan">${fmt(Math.round(stats.avgTokensPerPerson))}</span></div>`,
              `  <div class="stat-card"><span class="stat-label">total wisdom</span><span class="stat-value" style="color:var(--c-cyan)">${stats.totalWisdom ?? '—'}</span></div>`,
              '</div>',
            ].join('\n') },
            { type: 'raw', text: '' },
            { type: 'sep' },
          );
        }

        // ── TOP 10 ──
        const sortedAll = [...ranking].sort((a, b) => b.totalTokens - a.totalTokens);
        const top10 = sortedAll.slice(0, 10);
        if (top10.length > 0) {
          appendLines({ type: 'header', text: 'OPERATOR RANKINGS' }, { type: 'sep' });
          appendLines({
            type: 'html', html: `<div class="tier-section"><span class="tier-section-label top">⬥ TOP 10</span><div class="tier-section-line top"></div><span class="tier-count">${top10.length} operators</span></div>`
          });
          const badges = ['●', '◆', '○'];
          const colors = ['green', 'amber', 'cyan'];
          const hexColors = ['var(--c-green)', 'var(--c-amber)', 'var(--c-cyan)'];
          const maxTok = Math.max(...top10.map(r => r.totalTokens));
          const rows: string[] = ['<div class="top-grid">'];
          top10.forEach((item, i) => {
            const badge = i < 3 ? badges[i] : `#${i + 1}`;
            const badgeColor = i < 3 ? hexColors[i] : 'var(--c-dim)';
            const clr = i < 3 ? colors[i] : 'dim';
            const tokPct = (item.totalTokens / maxTok) * 100;
            rows.push(
              `<div class="top-card">`,
              `  <div class="top-card-header">`,
              `    <span class="top-card-badge" style="color:${badgeColor}">${badge}</span>`,
              `    <span class="top-card-name">${item.name}</span>`,
              `  </div>`,
              `  <div class="top-card-metrics">`,
              `    <div class="top-card-metric"><span class="metric-label">tokens</span><span class="metric-value ${clr}">${fmt(item.totalTokens)}</span></div>`,
              `    <div class="top-card-metric"><span class="metric-label">sessions</span><span class="metric-value">${item.sessions}</span></div>`,
              `    <div class="top-card-metric"><span class="metric-label">cost</span><span class="metric-value amber">$${item.cost.toFixed(3)}</span></div>`,
              `    <div class="top-card-metric"><span class="metric-label">machines</span><span class="metric-value dim">${item.sources}</span></div>`,
              `    <div class="top-card-metric"><span class="metric-label">wisdom</span><span class="metric-value cyan">${item.wisdomScore ?? '—'}</span></div>`,
              `  </div>`,
              `  <div class="top-card-bar"><div class="top-card-bar-fill ${clr}" style="width:${tokPct}%"></div></div>`,
              `</div>`,
            );
          });
          rows.push('</div>');
          appendLines({ type: 'html', html: rows.join('\n') });
        }

        // ── MIDDLE TIER ──
        const totalN = sortedAll.length;
        const midStart = 10;
        const midEnd = Math.max(10, totalN - 10);
        const middle = sortedAll.slice(midStart, midEnd);
        if (middle.length > 0) {
          appendLines({ type: 'raw', text: '' });
          appendLines({
            type: 'html', html: `<div class="tier-section"><span class="tier-section-label middle">⬡ MIDDLE TIER</span><div class="tier-section-line middle"></div><span class="tier-count">${middle.length} operators</span></div>`
          });
          const maxTokMid = Math.max(...middle.map(r => r.totalTokens));
          middle.forEach((item) => {
            const barPct = (item.totalTokens / maxTokMid) * 100;
            appendLines({
              type: 'html', html: `<div class="tier-row middle"><span class="tier-row-rank middle">#${item.rank}</span><span class="tier-row-name">${item.name}</span><span class="tier-row-tokens middle">${fmt(item.totalTokens)}</span><span class="tier-row-sessions middle">${item.sessions}s</span><span class="tier-row-cost middle">$${item.cost.toFixed(3)}</span><span class="tier-row-sources middle" style="min-width:22px;text-align:right;font-size:10px">${item.sources}</span><span class="tier-row-wisdom middle" style="min-width:22px;text-align:right;font-size:10px">${item.wisdomScore ?? '—'}</span><div class="tier-bar-wrap"><div class="tier-bar-fill middle" style="width:${barPct}%"></div></div></div>`
            });
          });
        }

        // ── BOTTOM 10 ──
        const bottom = sortedAll.slice(midEnd);
        if (bottom.length > 0) {
          appendLines({ type: 'raw', text: '' });
          appendLines({
            type: 'html', html: `<div class="tier-section"><span class="tier-section-label bottom">⬡ BOTTOM 10</span><div class="tier-section-line bottom"></div><span class="tier-count">${bottom.length} operators</span></div>`
          });
          const maxTokBot = Math.max(...bottom.map(r => r.totalTokens));
          bottom.forEach((item) => {
            const barPct = maxTokBot > 0 ? (item.totalTokens / maxTokBot) * 100 : 0;
            appendLines({
              type: 'html', html: `<div class="tier-row bottom"><span class="tier-row-rank bottom">#${item.rank}</span><span class="tier-row-name">${item.name}</span><span class="tier-row-tokens bottom">${fmt(item.totalTokens)}</span><span class="tier-row-sessions bottom">${item.sessions}s</span><span class="tier-row-cost bottom">$${item.cost.toFixed(3)}</span><span class="tier-row-sources bottom" style="min-width:22px;text-align:right;font-size:10px">${item.sources}</span><span class="tier-row-wisdom bottom" style="min-width:22px;text-align:right;font-size:10px">${item.wisdomScore ?? '—'}</span><div class="tier-bar-wrap"><div class="tier-bar-fill bottom" style="width:${barPct}%"></div></div></div>`
            });
          });
        }
        appendLines({ type: 'raw', text: '' });
        break;
      }

      case 'top': {
        const count = parseInt(arg || '10');
        const topN = [...ranking].sort((a, b) => b.totalTokens - a.totalTokens).slice(0, Math.min(count, 50));
        appendLines({ type: 'header', text: `TOP ${topN.length} BY TOKENS` }, { type: 'sep' });
        const maxV = Math.max(...topN.map(r => r.totalTokens));
        topN.forEach((item, i) => {
          const pct = (item.totalTokens / maxV) * 100;
          const badge = i === 0 ? '●' : i === 1 ? '◆' : i === 2 ? '○' : ' ';
          const clr = i === 0 ? 'green' : i === 1 ? 'amber' : i === 2 ? 'cyan' : 'dim';
          appendLines(
            { type: 'html', html: `<div class="top-line"><span class="term-${clr}" style="min-width:16px;font-weight:700">${badge}</span><span style="min-width:80px">${item.name}</span><div class="term-pbar-bg" style="flex:1"><div class="term-pbar-fill ${clr}" style="width:${pct}%"></div></div><span style="min-width:70px;text-align:right;font-size:11px" class="term-${clr}">${fmt(item.totalTokens)}</span><span style="min-width:36px;text-align:right;font-size:10px" class="term-dim">${item.sessions}s</span></div>` },
          );
        });
        appendLines({ type: 'raw', text: '' });
        break;
      }

      case 'ranking': {
        const sorted = [...ranking].sort((a, b) => a.rank - b.rank);
        const total = sorted.length;
        const bottomStart = total - 10;
        appendLines({ type: 'header', text: 'FULL RANKING — HIERARCHICAL VIEW' }, { type: 'sep' });

        const badges = ['●', '◆', '○'];
        const hexColors = ['var(--c-green)', 'var(--c-amber)', 'var(--c-cyan)'];
        const colors = ['green', 'amber', 'cyan'];
        const maxTok = Math.max(...sorted.map(r => r.totalTokens));

        const renderTier = (items: typeof sorted, tier: 'top' | 'mid' | 'bot') => {
          const rows: string[] = [];
          items.forEach((item, i) => {
            const actualIdx = item.rank - 1;
            const badge = actualIdx < 3 ? badges[actualIdx] : '#' + String(item.rank);
            const badgeColor = actualIdx < 3 ? hexColors[actualIdx] : (tier === 'bot' ? 'var(--c-red)' : 'var(--c-dim)');
            const clr = actualIdx < 3 ? colors[actualIdx] : (tier === 'bot' ? 'red' : 'dim');
            const tokPct = (item.totalTokens / maxTok) * 100;
            rows.push(
              `<div class="top-card ${tier === 'bot' ? 'bot-card' : ''}">`,
              `  <div class="top-card-header">`,
              `    <span class="top-card-badge" style="color:${badgeColor}">${badge}</span>`,
              `    <span class="top-card-name" style="${tier === 'bot' ? 'color:var(--c-red);' : ''}">${item.name}</span>`,
              `  </div>`,
              `  <div class="top-card-metrics">`,
              `    <div class="top-card-metric"><span class="metric-label">tokens</span><span class="metric-value ${clr}">${fmt(item.totalTokens)}</span></div>`,
              `    <div class="top-card-metric"><span class="metric-label">sessions</span><span class="metric-value">${item.sessions}</span></div>`,
              `    <div class="top-card-metric"><span class="metric-label">cost</span><span class="metric-value amber">$${item.cost.toFixed(3)}</span></div>`,
              `    <div class="top-card-metric"><span class="metric-label">machines</span><span class="metric-value dim">${item.sources}</span></div>`,
              `    <div class="top-card-metric"><span class="metric-label">wisdom</span><span class="metric-value cyan">${item.wisdomScore ?? '—'}</span></div>`,
              `  </div>`,
              `  <div class="top-card-bar"><div class="top-card-bar-fill ${clr}" style="width:${tokPct}%"></div></div>`,
              `</div>`,
            );
          });
          return rows;
        };

        // TOP 10
        appendLines(
          { type: 'header', text: '🏆 TOP 10' },
          { type: 'sep' },
        );
        const top10 = sorted.slice(0, 10);
        const topRows = renderTier(top10, 'top');
        appendLines(
          { type: 'html', html: '<div class="top-grid">' + topRows.join('\n') + '</div>' },
          { type: 'raw', text: '' },
        );

        // MIDDLE
        const midCount = total - 20;
        if (midCount > 0) {
          appendLines(
            { type: 'header', text: '─ MIDDLE RANK (' + midCount + ' operators) ─' },
            { type: 'sep' },
          );
          const mid = sorted.slice(10, bottomStart);
          const midRows = renderTier(mid, 'mid');
          appendLines(
            { type: 'html', html: '<div class="top-grid">' + midRows.join('\n') + '</div>' },
            { type: 'raw', text: '' },
          );
        }

        // BOTTOM 10
        appendLines(
          { type: 'header', text: '⚠ BOTTOM 10' },
          { type: 'sep' },
        );
        const bot10 = sorted.slice(bottomStart);
        const botRows = renderTier(bot10, 'bot');
        appendLines(
          { type: 'html', html: '<div class="top-grid">' + botRows.join('\n') + '</div>' },
          { type: 'raw', text: '' },
        );

        appendLines({ type: 'raw', text: '' });
        break;
      }

      case 'search': {
        const query = (arg || '').toLowerCase().trim();
        if (!query) {
          // Show ALL operators with tiered hierarchy
          const allSorted = [...ranking].sort((a, b) => b.totalTokens - a.totalTokens);
          const totalN = allSorted.length;
          const midEnd = Math.max(10, totalN - 10);
          appendLines({ type: 'header', text: 'ALL OPERATORS (' + totalN + ')' }, { type: 'sep' });

          // TOP 10
          const top10 = allSorted.slice(0, 10);
          appendLines({
            type: 'html', html: `<div class="tier-section"><span class="tier-section-label top">⬥ TOP 10</span><div class="tier-section-line top"></div><span class="tier-count">${top10.length} operators</span></div>`
          });
          const topBadges = ['●', '◆', '○'];
          const topColors = ['green', 'amber', 'cyan'];
          const maxTok = Math.max(...top10.map(r => r.totalTokens));
          top10.forEach((item, i) => {
            const badge = i < 3 ? topBadges[i] : `#${i + 1}`;
            const badgeCls = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
            const barPct = (item.totalTokens / maxTok) * 100;
            const clr = i < 3 ? topColors[i] : 'top';
            appendLines({
              type: 'html', html: `<div class="tier-row top"><span class="tier-row-badge ${badgeCls}" style="min-width:16px">${badge}</span><span class="tier-row-name">${item.name}</span><span class="tier-row-tokens top">${fmt(item.totalTokens)}</span><span class="tier-row-sessions" style="color:var(--c-dim);min-width:32px;text-align:right;font-size:10px">${item.sessions}s</span><span class="tier-row-cost" style="color:var(--c-dim);min-width:60px;text-align:right;font-size:10px">$${item.cost.toFixed(3)}</span><div class="tier-bar-wrap"><div class="tier-bar-fill top" style="width:${barPct}%"></div></div></div>`
            });
          });

          // MIDDLE
          const middle = allSorted.slice(10, midEnd);
          if (middle.length > 0) {
            appendLines({ type: 'raw', text: '' });
            appendLines({
              type: 'html', html: `<div class="tier-section"><span class="tier-section-label middle">⬡ MIDDLE TIER</span><div class="tier-section-line middle"></div><span class="tier-count">${middle.length} operators</span></div>`
            });
            const maxTokMid = Math.max(...middle.map(r => r.totalTokens));
            middle.forEach((item) => {
              const barPct = (item.totalTokens / maxTokMid) * 100;
              appendLines({
                type: 'html', html: `<div class="tier-row middle"><span class="tier-row-rank middle">#${item.rank}</span><span class="tier-row-name">${item.name}</span><span class="tier-row-tokens middle">${fmt(item.totalTokens)}</span><span class="tier-row-sessions middle">${item.sessions}s</span><span class="tier-row-cost middle">$${item.cost.toFixed(3)}</span><span class="tier-row-sources middle" style="min-width:22px;text-align:right;font-size:10px">${item.sources}</span><span class="tier-row-wisdom middle" style="min-width:22px;text-align:right;font-size:10px">${item.wisdomScore ?? '—'}</span><div class="tier-bar-wrap"><div class="tier-bar-fill middle" style="width:${barPct}%"></div></div></div>`
              });
            });
          }

          // BOTTOM 10
          const bottom = allSorted.slice(midEnd);
          if (bottom.length > 0) {
            appendLines({ type: 'raw', text: '' });
            appendLines({
              type: 'html', html: `<div class="tier-section"><span class="tier-section-label bottom">⬡ BOTTOM 10</span><div class="tier-section-line bottom"></div><span class="tier-count">${bottom.length} operators</span></div>`
            });
            const maxTokBot = Math.max(...bottom.map(r => r.totalTokens));
            bottom.forEach((item) => {
              const barPct = maxTokBot > 0 ? (item.totalTokens / maxTokBot) * 100 : 0;
              appendLines({
                type: 'html', html: `<div class="tier-row bottom"><span class="tier-row-rank bottom">#${item.rank}</span><span class="tier-row-name">${item.name}</span><span class="tier-row-tokens bottom">${fmt(item.totalTokens)}</span><span class="tier-row-sessions bottom">${item.sessions}s</span><span class="tier-row-cost bottom">$${item.cost.toFixed(3)}</span><span class="tier-row-sources bottom" style="min-width:22px;text-align:right;font-size:10px">${item.sources}</span><span class="tier-row-wisdom bottom" style="min-width:22px;text-align:right;font-size:10px">${item.wisdomScore ?? '—'}</span><div class="tier-bar-wrap"><div class="tier-bar-fill bottom" style="width:${barPct}%"></div></div></div>`
              });
            });
          }
          appendLines({ type: 'raw', text: '' });
          break;
        } else {
        const matches = ranking.filter(r => r.name.toLowerCase().includes(query));
        if (matches.length === 0) {
          appendLines(
            { type: 'amber', text: 'no results found for: ' + query },
            { type: 'raw', text: '' },
          );
          break;
        }
        const allSorted = [...matches].sort((a, b) => b.totalTokens - a.totalTokens);
        const maxTokS = Math.max(...allSorted.map(r => r.totalTokens));
        const badges = ['●', '◆', '○'];
        const hexColors = ['var(--c-green)', 'var(--c-amber)', 'var(--c-cyan)'];
        const colors = ['green', 'amber', 'cyan'];
        const rows: string[] = ['<div class="top-grid">'];
        allSorted.forEach((item, i) => {
          const badge = i < 3 ? badges[i] : `#${i + 1}`;
          const badgeColor = i < 3 ? hexColors[i] : 'var(--c-dim)';
          const clr = i < 3 ? colors[i] : 'dim';
          const tokPct = (item.totalTokens / maxTokS) * 100;
          rows.push(
            `<div class="top-card">`,
            `  <div class="top-card-header">`,
            `    <span class="top-card-badge" style="color:${badgeColor}">${badge}</span>`,
            `    <span class="top-card-name">${item.name}</span>`,
            `  </div>`,
            `  <div class="top-card-metrics">`,
            `    <div class="top-card-metric"><span class="metric-label">tokens</span><span class="metric-value ${clr}">${fmt(item.totalTokens)}</span></div>`,
            `    <div class="top-card-metric"><span class="metric-label">sessions</span><span class="metric-value">${item.sessions}</span></div>`,
            `    <div class="top-card-metric"><span class="metric-label">cost</span><span class="metric-value amber">$${item.cost.toFixed(3)}</span></div>`,
            `    <div class="top-card-metric"><span class="metric-label">machines</span><span class="metric-value dim">${item.sources}</span></div>`,
            `    <div class="top-card-metric"><span class="metric-label">wisdom</span><span class="metric-value cyan">${item.wisdomScore ?? '—'}</span></div>`,
            `  </div>`,
            `  <div class="top-card-bar"><div class="top-card-bar-fill ${clr}" style="width:${tokPct}%"></div></div>`,
            `</div>`,
          );
        });
        rows.push('</div>');
        appendLines(
          { type: 'header', text: 'SEARCH RESULTS (' + matches.length + ' match' + (matches.length > 1 ? 'es' : '') + ')' },
          { type: 'sep' },
          { type: 'html', html: rows.join('\n') },
          { type: 'raw', text: '' },
        );
        break;
      }
    }

      case 'charts': {
        appendLines({ type: 'header', text: 'TOKEN DISTRIBUTION' }, { type: 'sep' });
        appendLines({ type: 'raw', text: '' });

        // Cost donut using CSS conic gradient
        const sortedByCost = [...ranking].sort((a, b) => b.cost - a.cost);
        const chartColors = ['#33ff33', '#ffb000', '#00ffff', '#ff3333', '#ff69b4', '#aa66ff', '#ffd700', '#00ff9d', '#555555'];
        const topCost = sortedByCost.slice(0, 8);
        const totalCost = sortedByCost.reduce((s, r) => s + r.cost, 0);
        const gradientStops = topCost.map((r, i) => {
          const pct = (r.cost / totalCost) * 100;
          const start = topCost.slice(0, i).reduce((s, r2) => s + (r2.cost / totalCost) * 100, 0);
          return `${chartColors[i % chartColors.length]} ${start}% ${start + pct}%`;
        }).join(', ');
        const othersPct = sortedByCost.slice(8).reduce((s, r) => s + (r.cost / totalCost) * 100, 0);
        const finalGradient = gradientStops + (othersPct > 0 ? `, #333 ${100 - othersPct}% 100%` : '');

        appendLines({
          type: 'html', html: [
            '<div class="chart-area">',
            '  <div class="donut-container">',
            `    <div class="donut" style="background: conic-gradient(${finalGradient})">`,
            '      <div class="donut-hole"><span class="term-amber">$' + totalCost.toFixed(2) + '</span><span class="term-dim" style="font-size:9px">total</span></div>',
            '    </div>',
            '  </div>',
            '  <div class="chart-legend">',
            ...topCost.map((r, i) =>
              `  <div class="legend-item"><span style="color:${chartColors[i]}">■</span><span>${r.name}</span><span class="term-dim">${(r.cost / totalCost * 100).toFixed(1)}%</span></div>`
            ),
            (othersPct > 0 ? `  <div class="legend-item"><span style="color:#555">■</span><span>others</span><span class="term-dim">${othersPct.toFixed(1)}%</span></div>` : ''),
            '  </div>',
            '</div>',
          ].join('\n')
        });

        appendLines({ type: 'raw', text: '' }, { type: 'sep' }, { type: 'header', text: 'SESSIONS TOP 15' }, { type: 'sep' });
        const topSess = [...ranking].sort((a, b) => b.sessions - a.sessions).slice(0, 15);
        const maxSess = Math.max(...topSess.map(r => r.sessions));
        topSess.forEach(item => {
          const pct = (item.sessions / maxSess) * 100;
          appendLines(
            { type: 'html', html: `<div class="top-line"><span style="min-width:80px">${item.name}</span><div class="term-pbar-bg" style="flex:1"><div class="term-pbar-fill" style="width:${pct}%;background:hsl(${120 + (item.sessions / maxSess) * 60}, 100%, 50%)"></div></div><span style="min-width:36px;text-align:right;font-size:11px">${item.sessions}</span></div>` },
          );
        });

        appendLines({ type: 'raw', text: '' }, { type: 'sep' }, { type: 'header', text: 'TOKENS PER SESSION (EST.)' }, { type: 'sep' });
        const topEff = [...ranking]
          .filter(r => r.sessions >= 5)
          .map(r => ({ name: r.name, value: Math.round(r.totalTokens * 0.4 / r.sessions) }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 15);
        const maxEff = Math.max(...topEff.map(r => r.value));
        topEff.forEach(item => {
          const pct = (item.value / maxEff) * 100;
          appendLines(
            { type: 'html', html: `<div class="top-line"><span style="min-width:80px">${item.name}</span><div class="term-pbar-bg" style="flex:1"><div class="term-pbar-fill" style="width:${pct}%;background:hsl(${180 + (item.value / maxEff) * 60}, 100%, 50%)"></div></div><span style="min-width:60px;text-align:right;font-size:11px">${item.value.toLocaleString()}</span></div>` },
          );
        });

        appendLines({ type: 'raw', text: '' });
        break;
      }

      case 'refresh': {
        const now = new Date();
        appendLines(
          { type: 'amber', text: `[REFRESH] re-fetching ${timeRangeLabel} data...` },
        );
        fetch(rangeFileMap[timeRange])
          .then(r => r.json())
          .then((d: Data) => {
            setData(d);
            const dataTs = new Date(d.updatedAt);
            const diffMin = Math.round((now.getTime() - dataTs.getTime()) / 60000);
            const staleLabel = diffMin < 15 ? 'fresh' : diffMin < 60 ? diffMin + 'm stale' : '>1h stale';
            appendLines(
              { type: 'green', text: '[OK] data refreshed — ' + d.stats.totalPeople + ' nodes, ' + fmt(d.stats.totalTokens) + ' tokens' },
              { type: 'dim', text: '  data timestamp: ' + fmtDate(d.updatedAt) + ' (' + staleLabel + ')' },
              { type: 'sep' },
              { type: 'header', text: 'DATA PIPELINE' },
              { type: 'raw', text: '' },
              { type: 'dim', text: '  Auto-update: every 15min via GitHub Actions' },
              { type: 'dim', text: '  Source: token-tracker → Feishu → GH Actions → GH Pages' },
              { type: 'dim', text: '  Trigger: https://github.com/gengxiankun/token-vision/actions/workflows/deploy.yml' },
              { type: 'raw', text: '' },
              { type: 'dim', text: '  Tip: type `help` to see all available commands.' },
              { type: 'sep' },
            );
          })
          .catch(() => {
            appendLines(
              { type: 'red', text: '[ERR] failed to refresh data' },
              { type: 'raw', text: '' },
            );
          });
        break;
      }

      case 'wisdom':
      case 'smart': {
        const sorted = [...ranking].sort((a, b) => (b.wisdomScore ?? 0) - (a.wisdomScore ?? 0));
        const total = sorted.length;
        appendLines({ type: 'header', text: '🏛 WISDOM RANKING — 智慧量排行' }, { type: 'sep' });
        appendLines({ type: 'dim', text: '  智慧量 = log₁₀(tokens)×200 + √sessions×60 + sources×50 → 归一化 0-999' });
        appendLines({ type: 'sep' }, { type: 'raw', text: '' });

        const badges = ['●', '◆', '○'];
        const hexColors = ['var(--c-green)', 'var(--c-amber)', 'var(--c-cyan)'];
        const colors = ['green', 'amber', 'cyan'];
        const maxTok = Math.max(...sorted.map(r => r.totalTokens));

        const tiers = [
          { label: '🏆 TOP 10', cls: 'top', items: sorted.slice(0, 10) },
          { label: `⬡ MIDDLE ${total - 20}`, cls: 'middle', items: sorted.slice(10, total - 10) },
          { label: '⚠ BOTTOM 10', cls: 'bottom', items: sorted.slice(total - 10) },
        ];

        for (const tier of tiers) {
          if (tier.items.length === 0) continue;
          appendLines({ type: 'html', html: `<div class="tier-section"><span class="tier-section-label ${tier.cls}">${tier.label}</span><div class="tier-section-line ${tier.cls}"></div><span class="tier-count">${tier.items.length} operators</span></div>` });
          const maxV = Math.max(...tier.items.map(r => r.totalTokens));
          const rows: string[] = ['<div class="top-grid">'];
          tier.items.forEach((item, i) => {
            const offset = tier.cls === 'top' ? 0 : tier.cls === 'middle' ? 10 : total - 10;
            const wisdomRank = offset + i + 1;
            const idx = wisdomRank - 1;
            const badge = idx < 3 ? badges[idx] : '#' + String(wisdomRank);
            const badgeColor = idx < 3 ? hexColors[idx] : (tier.cls === 'bottom' ? 'var(--c-red)' : 'var(--c-dim)');
            const clr = idx < 3 ? colors[idx] : (tier.cls === 'bottom' ? 'red' : 'dim');
            const tokPct = (item.totalTokens / maxV) * 100;
            rows.push(
              `<div class="top-card ${tier.cls === 'bottom' ? 'bot-card' : ''}">`,
              `  <div class="top-card-header">`,
              `    <span class="top-card-badge" style="color:${badgeColor}">${badge}</span>`,
              `    <span class="top-card-name">${item.name}</span>`,
              `  </div>`,
              `  <div class="top-card-metrics">`,
              `    <div class="top-card-metric"><span class="metric-label">wisdom</span><span class="metric-value cyan" style="font-size:16px;font-weight:700">${item.wisdomScore ?? '—'}</span></div>`,
              `    <div class="top-card-metric"><span class="metric-label">tokens</span><span class="metric-value ${clr}">${fmt(item.totalTokens)}</span></div>`,
              `    <div class="top-card-metric"><span class="metric-label">sessions</span><span class="metric-value">${item.sessions}</span></div>`,
              `    <div class="top-card-metric"><span class="metric-label">machines</span><span class="metric-value dim">${item.sources}</span></div>`,
              `  </div>`,
              `  <div class="top-card-bar"><div class="top-card-bar-fill ${clr}" style="width:${tokPct}%"></div></div>`,
              `</div>`,
            );
          });
          rows.push('</div>');
          appendLines({ type: 'html', html: rows.join('\\n') });
          appendLines({ type: 'raw', text: '' });
        }

        appendLines({ type: 'sep' });
        break;
      }

      case 'stars':
      case 'cosmos':
      case 'galaxy': {
        setStarMode(true);
        appendLines(
          { type: 'green', text: '★ rendering cosmic wisdom star map...' },
          { type: 'sep' },
        );
        break;
      }

      case 'help': {
        appendLines(
          { type: 'header', text: 'AVAILABLE COMMANDS' },
          { type: 'sep' },
          { type: 'raw', text: '  dashboard  —  System overview with top 10 operators' },
          { type: 'raw', text: '  cards      —  Show ALL operators as card grid' },
          { type: 'raw', text: '  search     —  Search operators by name (e.g. search alice)' },
          { type: 'raw', text: '  top [N]    —  Show top N operators by tokens (default 10)' },
          { type: 'raw', text: '  ranking    —  Full ranking table' },
          { type: 'raw', text: '  wisdom     —  Wisdom score ranking (alias: smart)' },
          { type: 'raw', text: '  stars      —  Cosmic wisdom star map (alias: cosmos, galaxy)' },
          { type: 'raw', text: '  charts     —  Token distribution & session charts' },
          { type: 'raw', text: '  refresh    —  Re-fetch telemetry data from server' },
          { type: 'raw', text: '  help       —  Show this help' },
          { type: 'raw', text: '  clear      —  Clear terminal screen' },
          { type: 'raw', text: '  about      —  About TOKEN VISION' },
          { type: 'sep' },
          { type: 'dim', text: '  Tip: press ↑/↓ to navigate command history. Use title bar buttons to switch time range (Today / 7d / 30d / 3m).' },
          { type: 'raw', text: '' },
        );
        break;
      }

      case 'about': {
        appendLines(
          { type: 'header', text: 'ABOUT TOKEN VISION' },
          { type: 'sep' },
          { type: 'raw', text: '  TOKEN VISION v2.0.0' },
          { type: 'raw', text: '  Hermes AI Cross-Instance Token Consumption Monitor' },
          { type: 'raw', text: '' },
          { type: 'dim', text: '  Built with: Next.js + Tailwind CSS v4 + TypeScript' },
          { type: 'dim', text: '  Data source: Feishu Sheets (auto-fetched via GitHub Actions)' },
          { type: 'dim', text: '  Deployment: GitHub Pages (auto-deploy, updated every 15min)' },
          { type: 'raw', text: '' },
          { type: 'raw', text: '  Commands: dashboard | cards | top | ranking | charts | wisdom | stars | search | refresh | help | clear' },
          { type: 'raw', text: '  Mode: ☀ Click the sun/moon icon in top-right to toggle day/night' },
          { type: 'raw', text: '' },
        );
        break;
      }

      case 'clear': {
        setOutputLines([]);
        return;
      }

      default: {
        appendLines(
          { type: 'red', text: 'error: unknown command "' + command + '". type `help` for available commands.' },
          { type: 'raw', text: '' },
        );
      }
    }
  }, [data, appendLines]);

  /* ── Input handling ── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      execCommand(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const newIdx = cmdIdx === -1 ? cmdHistory.length - 1 : Math.max(0, cmdIdx - 1);
        setCmdIdx(newIdx);
        setInput(cmdHistory[newIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (cmdIdx >= 0) {
        const newIdx = cmdIdx + 1;
        if (newIdx >= cmdHistory.length) {
          setCmdIdx(-1);
          setInput('');
        } else {
          setCmdIdx(newIdx);
          setInput(cmdHistory[newIdx]);
        }
      }
    }
  };

  /* ── Auto-run dashboard on boot ── */
  useEffect(() => {
    if (bootPhase === 'ready' && data) {
      const t = setTimeout(() => {
        execCommand('dashboard');
      }, 300);
      return () => clearTimeout(t);
    }
  }, [bootPhase, data]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Click to focus ── */
  const focusInput = () => inputRef.current?.focus();

  /* ── Render ── */
  return (
    <div className={`terminal-root ${mode}`} onClick={focusInput}>
      {/* Title bar */}
      <div className="term-titlebar">
        <div className="term-titlebar-dots">
          <span className="dot dot-red" />
          <span className="dot dot-amber" />
          <span className="dot dot-green" />
        </div>
        <span className="term-titlebar-text">
          TOKEN VISION v2 — {mode === 'dark' ? 'DARK' : 'LIGHT'} MODE
          <span className="term-titlebar-range"> | {timeRangeLabel}</span>
        </span>
        <div className="term-range-selector">
          {(['today', '7d', '30d', '3m'] as const).map(r => (
            <button
              key={r}
              className={`term-range-btn ${timeRange === r ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (r === timeRange) return;
                setTimeRange(r);
                setTimeRangeLabel(rangeLabels[r]);
                appendLines(
                  { type: 'dim', text: `[RANGE] switching to ${rangeLabels[r]}...` },
                );
                fetchDataByRange(r).then(() => {
                  setOutputLines([]);
                  execCommand('dashboard');
                }).catch(() => {
                  appendLines(
                    { type: 'red', text: `[ERR] failed to load ${rangeLabels[r]} data` },
                  );
                });
              }}
            >
              {rangeLabels[r]}
            </button>
          ))}
        </div>
        <button
          className="mode-toggle"
          onClick={(e) => { e.stopPropagation(); toggleMode(); }}
          title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
        >
          {mode === 'dark' ? '☀' : '☾'}
        </button>
      </div>

      {/* Star Chart (D3) or Terminal Output */}
      {starMode && data ? (
        <StarChart
          data={data.ranking.map(r => ({
            name: r.name,
            wisdomScore: r.wisdomScore ?? 0,
            totalTokens: r.totalTokens,
            sessions: r.sessions,
            sources: r.sources,
          }))}
          mode={mode}
          onClose={() => setStarMode(false)}
        />
      ) : (
      <div className="term-body" ref={scrollRef}>
        {outputLines.map((line, i) => {
          if (line.type === 'sep') return <hr key={i} className="term-hr" />;
          if (line.type === 'raw') return <div key={i} className="term-line term-dim" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{line.text}</div>;
          if (line.type === 'html') return <div key={i} className="term-line" dangerouslySetInnerHTML={{ __html: line.html }} />;
          return <div key={i} className={`term-line term-${line.type}`}>{line.text}</div>;
        })}

        {/* Boot phase cursor */}
        {bootPhase === 'booting' && (
          <div className="term-line term-dim" style={{ display: 'flex', gap: 4 }}>
            <span className="term-green">⟁</span>
            <span>booting{bootDots}</span>
          </div>
        )}

        {/* Prompt */}
        {bootPhase === 'ready' && (
          <div className="term-prompt-line">
            <span className="term-prompt-label">./token-vision</span>
            <span className="term-prompt-sep">λ</span>
            <input
              ref={inputRef}
              type="text"
              className="term-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="type `help` for commands..."
              spellCheck={false}
              autoComplete="off"
              autoFocus
            />
          </div>
        )}

        {/* Bottom padding */}
        <div style={{ height: 4 }} />
      </div>
      )}

      {/* Status bar */}
      <div className="term-statusbar">
        <span className="term-dim">{mode === 'dark' ? 'DARK' : 'LIGHT'}</span>
        <span className="term-green">●</span>
        <span className="term-dim">
          {data
            ? `${timeRangeLabel} · ${data.stats.totalPeople} nodes · ${fmt(data.stats.totalTokens)} tokens · updated ${fmtDate(data.updatedAt)}`
            : 'initializing...'}
        </span>
        {bootPhase === 'ready' && <span className="cursor-blink-sm" />}
      </div>
    </div>
  );
}
