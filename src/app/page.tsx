'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

/* ── Types ──────────────────────────────────── */
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

/* ── Stats line ─────────────────────────────── */
function StatLine({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="terminal-line" style={{ display: 'flex', gap: 16 }}>
      <span className="term-dim" style={{ minWidth: 140, flexShrink: 0 }}>
        {label}
      </span>
      <span className="term-dots term-dim">:</span>
      <span className="term-cyan">{value}</span>
      {suffix && <span className="term-dim" style={{ fontSize: 10 }}>{suffix}</span>}
    </div>
  );
}

/* ── Terminal output renderer ──────────────── */
function TerminalOutput({ lines }: { lines: TermLine[] }) {
  return (
    <div className="terminal-output">
      {lines.map((line, i) => {
        if (line.type === 'sep') return <hr key={i} className="term-hr" />;
        if (line.type === 'raw') return <div key={i} className="term-dim" style={{ whiteSpace: 'pre', lineHeight: 1.4 }}>{line.text}</div>;
        if (line.type === 'html') return <div key={i} dangerouslySetInnerHTML={{ __html: line.html }} className="terminal-line" />;
        return (
          <div key={i} className={`terminal-line term-${line.type}`}>
            {line.type === 'header' && <span className="term-arrow">▶ </span>}
            {line.text}
          </div>
        );
      })}
    </div>
  );
}

/* ── Terminal progress bar ──────────────────── */
function TermProgress({ label, pct, value, color = 'green' }: { label: string; pct: number; value: string; color?: string }) {
  return (
    <div className="term-progress-line">
      <span className="term-dim" style={{ minWidth: 100, flexShrink: 0 }}>{label}</span>
      <div className="term-pbar-bg">
        <div className={`term-pbar-fill ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="term-fg" style={{ minWidth: 80, textAlign: 'right', fontSize: 11 }}>{value}</span>
    </div>
  );
}

/* ── ASCII table ────────────────────────────── */
function AsciiTable({
  headers,
  rows,
  widths,
}: {
  headers: string[];
  rows: string[][];
  widths: number[];
}) {
  const hLine = '─'.repeat(widths.reduce((a, b) => a + b + 3, 1));
  return (
    <pre className="term-table-pre">
      {'┌' + '─'.repeat(widths.reduce((a, b) => a + b + 3, 1) - 2) + '┐'}{'\n'}
      {'│ ' + headers.map((h, i) => h.padEnd(widths[i])).join(' │ ') + ' │'}{'\n'}
      {'├' + widths.map(w => '─'.repeat(w + 2)).join('┼') + '┤'}{'\n'}
      {rows.map((row, ri) =>
        '│ ' + row.map((cell, ci) => cell.padEnd(widths[ci])).join(' │ ') + ' │' + (ri < rows.length - 1 ? '\n' : '')
      ).join('\n')}{'\n'}
      {'└' + widths.map(w => '─'.repeat(w + 2)).join('┴') + '┘'}
    </pre>
  );
}

/* ── Main Page ──────────────────────────────── */
export default function Home() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootPhase, setBootPhase] = useState<'booting' | 'ready'>('booting');
  const [outputLines, setOutputLines] = useState<TermLine[]>([]);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [cmdIdx, setCmdIdx] = useState(-1);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [bootDots, setBootDots] = useState('');

  const appendLines = useCallback((...newLines: TermLine[]) => {
    setOutputLines(prev => [...prev, ...newLines]);
  }, []);

  /* ── Boot sequence ── */
  useEffect(() => {
    const bootMsg1: TermLine[] = [
      { type: 'dim', text: '[' + new Date().toLocaleTimeString() + '] initializing TOKEN VISION monitor...' },
      { type: 'dim', text: '[' + new Date().toLocaleTimeString() + '] loading kernel modules...' },
      { type: 'dim', text: '[' + new Date().toLocaleTimeString() + '] connecting to data sources...' },
    ];
    setOutputLines(bootMsg1);

    const t1 = setTimeout(() => {
      appendLines(
        { type: 'green', text: '[OK] kernel modules loaded' },
        { type: 'green', text: '[OK] feishu sheets interface ready' },
        { type: 'dim', text: '[' + new Date().toLocaleTimeString() + '] fetching telemetry data...' },
      );
    }, 400);

    const t2 = setTimeout(() => {
      fetch('./data/data.json')
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
              '║  ████████  ██  ████████  TOKEN VISION v1.0  ║',
              '║  ██░░░░██  ██  ██░░░░    HERMES AI          ║',
              '║  ████████  ██  ███████   TOKEN CONSUMPTION  ║',
              '║  ██░░░░░░  ██  ██░░░░    MONITOR v1.0       ║',
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
              '</div>',
            ].join('\n') },
            { type: 'raw', text: '' },
            { type: 'sep' },
          );
        }

        // Top 3
        if (top5 && top5.length >= 3) {
          appendLines({ type: 'header', text: 'TOP OPERATORS' });
          const maxT = Math.max(...top5.slice(0, 3).map(r => r.totalTokens));
          const maxS = Math.max(...top5.slice(0, 3).map(r => r.sessions));
          const maxC = Math.max(...top5.slice(0, 3).map(r => r.cost));
          const badges = ['● MASTER', '◆ NODE', '○ PEER'];
          const colors = ['var(--c-green)', 'var(--c-amber)', 'var(--c-cyan)'];
          top5.slice(0, 3).forEach((item, i) => {
            appendLines(
              { type: 'raw', text: '' },
              { type: 'html', html: [
                `<div class="top-card">`,
                `  <div style="color:${colors[i]};font-size:11px;margin-bottom:4px">${badges[i]}</div>`,
                `  <div style="font-weight:700;margin-bottom:6px">${item.name}</div>`,
                `  <div class="top-bar-row"><span>sessions</span><div class="term-pbar-bg" style="flex:1;max-width:200px"><div class="term-pbar-fill ${['green','amber','cyan'][i]}" style="width:${(item.sessions / maxS) * 100}%"></div></div><span>${item.sessions}</span></div>`,
                `  <div class="top-bar-row"><span>tokens</span><div class="term-pbar-bg" style="flex:1;max-width:200px"><div class="term-pbar-fill ${['green','amber','cyan'][i]}" style="width:${(item.totalTokens / maxT) * 100}%"></div></div><span>${fmt(item.totalTokens)}</span></div>`,
                `  <div class="top-bar-row"><span>cost</span><div class="term-pbar-bg" style="flex:1;max-width:200px"><div class="term-pbar-fill ${['green','amber','cyan'][i]}" style="width:${(item.cost / maxC) * 100}%"></div></div><span>$${item.cost.toFixed(4)}</span></div>`,
                `</div>`,
              ].join('\n') },
            );
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
        appendLines({ type: 'header', text: 'FULL RANKING TABLE' }, { type: 'sep' });
        appendLines(
          { type: 'html', html: `<div class="ascii-table-wrap">${sorted.map(r => {
            const rankStr = r.rank <= 3 ? ['●','◆','○'][r.rank - 1] : '#' + String(r.rank).padStart(2);
            return `${rankStr.padStart(3)}  ${r.name.padEnd(14)} ${fmt(r.totalTokens).padStart(8)}  ${String(r.sessions).padStart(4)}s  $${r.cost.toFixed(4).padStart(9)}`;
          }).join('\n')}</div>` },
        );
        appendLines({ type: 'raw', text: '' });
        break;
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
        // Remaining goes to "others"
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
        appendLines(
          { type: 'amber', text: '[REFRESH] re-fetching telemetry data...' },
        );
        fetch('./data/data.json')
          .then(r => r.json())
          .then((d: Data) => {
            setData(d);
            appendLines(
              { type: 'green', text: '[OK] data refreshed — ' + d.stats.totalPeople + ' nodes, ' + fmt(d.stats.totalTokens) + ' tokens' },
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

      case 'help': {
        appendLines(
          { type: 'header', text: 'AVAILABLE COMMANDS' },
          { type: 'sep' },
          { type: 'raw', text: '  dashboard  —  System overview with top 3 operators' },
          { type: 'raw', text: '  top [N]    —  Show top N operators by tokens (default 10)' },
          { type: 'raw', text: '  ranking    —  Full ranking table' },
          { type: 'raw', text: '  charts     —  Token distribution & session charts' },
          { type: 'raw', text: '  refresh    —  Re-fetch telemetry data from server' },
          { type: 'raw', text: '  help       —  Show this help' },
          { type: 'raw', text: '  clear      —  Clear terminal screen' },
          { type: 'raw', text: '  about      —  About TOKEN VISION' },
          { type: 'sep' },
          { type: 'dim', text: '  Tip: press ↑/↓ to navigate command history. Tab to autocomplete.' },
          { type: 'raw', text: '' },
        );
        break;
      }

      case 'about': {
        appendLines(
          { type: 'header', text: 'ABOUT TOKEN VISION' },
          { type: 'sep' },
          { type: 'raw', text: '  TOKEN VISION v1.0.0' },
          { type: 'raw', text: '  Hermes AI Cross-Instance Token Consumption Monitor' },
          { type: 'raw', text: '' },
          { type: 'dim', text: '  Built with: Next.js + Tailwind CSS + TypeScript' },
          { type: 'dim', text: '  Data source: Feishu Sheets (auto-fetched via GitHub Actions)' },
          { type: 'dim', text: '  Deployment: GitHub Pages (auto-deploy, updated every 2h)' },
          { type: 'raw', text: '' },
          { type: 'raw', text: '  Commands: dashboard | top | ranking | charts | refresh | help | clear' },
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
    <div className="terminal-root" onClick={focusInput}>
      {/* Title bar */}
      <div className="term-titlebar">
        <div className="term-titlebar-dots">
          <span className="dot dot-red" />
          <span className="dot dot-amber" />
          <span className="dot dot-green" />
        </div>
        <span className="term-titlebar-text">TOKEN VISION — Hermes AI Token Monitor</span>
        <div style={{ width: 60 }} />
      </div>

      {/* Output */}
      <div className="term-body" ref={scrollRef}>
        {/* Boot phase output */}
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

      {/* Status bar */}
      <div className="term-statusbar">
        <span className="term-dim">NORMAL</span>
        <span className="term-green">●</span>
        <span className="term-dim">
          {data
            ? `${data.stats.totalPeople} nodes · ${fmt(data.stats.totalTokens)} tokens · updated ${fmtDate(data.updatedAt)}`
            : 'initializing...'}
        </span>
        {bootPhase === 'ready' && <span className="cursor-blink-sm" />}
      </div>
    </div>
  );
}
