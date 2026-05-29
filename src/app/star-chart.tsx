'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';

interface StarPerson {
  name: string;
  wisdomScore: number;
  totalTokens: number;
  sessions: number;
  sources: number;
}

interface Props {
  data: StarPerson[];
  mode: 'dark' | 'light';
  onClose: () => void;
}

/* ── Spectral classification ── */
const SPECTRAL = [
  { maxRank: 3,  css: 'O',  label: 'Blue Supergiant', color: '#4488ff', glow: 'rgba(68,136,255,0.5)' },
  { maxRank: 10, css: 'B',  label: 'Blue Giant',      color: '#6699ff', glow: 'rgba(102,153,255,0.4)' },
  { maxRank: 20, css: 'A',  label: 'Main Sequence',   color: '#bbbcdd', glow: 'rgba(187,188,221,0.3)' },
  { maxRank: 30, css: 'F',  label: 'Yellow-White',    color: '#ffdd88', glow: 'rgba(255,221,136,0.25)' },
  { maxRank: 40, css: 'G',  label: 'Yellow Dwarf',    color: '#ffcc44', glow: 'rgba(255,204,68,0.2)' },
  { maxRank: 99, css: 'M',  label: 'Red Dwarf',       color: '#ff8844', glow: 'rgba(255,136,68,0.15)' },
];

const getSpectral = (rank: number) => SPECTRAL.find(s => rank <= s.maxRank) ?? SPECTRAL[5];

/* ── Format helpers ── */
const fmt = (n: number) => {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
};

export default function StarChart({ data, mode, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const isDark = mode === 'dark';

  const draw = useCallback(() => {
    const container = containerRef.current;
    const svgEl = svgRef.current;
    if (!container || !svgEl || !data.length) return;

    const width = container.clientWidth - 4;
    const height = Math.max(520, Math.min(700, width * 0.62));
    const margin = 20;

    // Sort by wisdom descending
    const sorted = [...data].sort((a, b) => b.wisdomScore - a.wisdomScore);

    // ── Prepare pack layout data ──
    const packData = sorted.map(d => ({
      name: d.name,
      wisdomScore: d.wisdomScore,
      totalTokens: d.totalTokens,
      sessions: d.sessions,
      sources: d.sources,
      value: d.wisdomScore,
    }));

    const root = d3.hierarchy<unknown>({ children: packData } as any)
      .sum(d => (d as any).value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const pack = d3.pack<unknown>()
      .size([width - margin * 2, height - margin * 2])
      .padding(5);

    pack(root);

    // ── Setup SVG ──
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    svg
      .attr('width', width)
      .attr('height', height)
      .style('background', isDark ? '#080810' : '#e8e6e0')
      .style('border-radius', '6px')
      .style('cursor', 'grab');

    // ── Background stars ──
    const bgGroup = svg.append('g');
    const rng = (seed: number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
    const rand = rng(42);
    for (let i = 0; i < 80; i++) {
      bgGroup.append('circle')
        .attr('cx', rand() * width)
        .attr('cy', rand() * height)
        .attr('r', rand() * 1.5 + 0.3)
        .attr('fill', isDark ? '#fff' : '#666')
        .attr('opacity', rand() * 0.3 + 0.05);
    }

    // ── Zoom + pan ──
    const zoomGroup = svg.append('g');
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.6, 6])
      .on('zoom', (event) => {
        zoomGroup.attr('transform', event.transform.toString());
      });
    svg.call(zoom);

    // ── Tooltip ──
    const tooltip = d3.select(container)
      .append('div')
      .attr('class', 'star-tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 100);

    // ── Draw stars ──
    const leaves = root.leaves() as any[];
    const minR = 6;
    const sizeScale = d3.scaleSqrt()
      .domain([0, d3.max(leaves, d => d.r) ?? 100])
      .range([minR, (d3.max(leaves, d => d.r) ?? 100)]);

    leaves.forEach((d, i) => {
      const rank = i + 1;
      const spec = getSpectral(rank);
      const r = Math.max(minR, sizeScale(d.r) - 1);

      // Glow halo
      zoomGroup.append('circle')
        .attr('cx', d.x)
        .attr('cy', d.y)
        .attr('r', r * 1.3)
        .attr('fill', 'none')
        .attr('stroke', spec.color)
        .attr('stroke-width', r * 0.15)
        .attr('opacity', 0.15 + (rank <= 10 ? 0.2 : 0));

      // Main circle
      const circle = zoomGroup.append('circle')
        .attr('cx', d.x)
        .attr('cy', d.y)
        .attr('r', 0)  // animate in
        .attr('fill', spec.color)
        .attr('opacity', 0.85)
        .style('cursor', 'pointer')
        .style('filter', `drop-shadow(0 0 ${Math.min(r * 0.6, 20)}px ${spec.glow})`)
        .on('mouseenter', function () {
          d3.select(this)
            .transition().duration(150)
            .attr('opacity', 1)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5);

          tooltip
            .style('opacity', 1)
            .html(`
              <div style="font-family:JetBrains Mono,monospace;font-size:11px;padding:8px 10px;
                    background:${isDark ? 'rgba(10,10,20,0.95)' : 'rgba(255,255,250,0.95)'};
                    color:${isDark ? '#c8c8c8' : '#1a1a1a'};
                    border:1px solid ${spec.color};border-radius:4px;
                    min-width:160px">
                <div style="font-weight:700;color:${spec.color};font-size:13px;margin-bottom:4px">
                  ★ ${d.data.name}
                </div>
                <div style="color:${spec.color}">${spec.css} ${spec.label}</div>
                <div style="margin-top:4px;display:grid;grid-template-columns:1fr 1fr;gap:2px 8px">
                  <span style="color:${isDark ? '#777' : '#999'}">wisdom</span><span style="font-weight:600">${d.data.wisdomScore}</span>
                  <span style="color:${isDark ? '#777' : '#999'}">tokens</span><span>${fmt(d.data.totalTokens)}</span>
                  <span style="color:${isDark ? '#777' : '#999'}">sessions</span><span>${d.data.sessions}</span>
                  <span style="color:${isDark ? '#777' : '#999'}">machines</span><span>${d.data.sources}</span>
                </div>
              </div>
            `);

          // Position tooltip
          const rect = container.getBoundingClientRect();
          const tx = d.x * 1.15 + 10;
          const ty = d.y * 1.15 - 30;
          tooltip
            .style('left', Math.min(tx, width - 170) + 'px')
            .style('top', Math.max(ty, 10) + 'px');
        })
        .on('mouseleave', function () {
          d3.select(this)
            .transition().duration(300)
            .attr('opacity', 0.85)
            .attr('stroke', 'none')
            .attr('stroke-width', 0);
          tooltip.style('opacity', 0);
        });

      // Animate in
      circle.transition()
        .duration(400)
        .delay(i * 10)
        .attr('r', r);

      // Name label (only for r > 12)
      if (r > 12 && d.data.name) {
        const label = zoomGroup.append('text')
          .attr('x', d.x)
          .attr('y', d.y + 3)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('fill', isDark ? '#eee' : '#222')
          .attr('font-size', Math.min(r * 0.38, 13))
          .attr('font-family', 'JetBrains Mono, monospace')
          .attr('opacity', 0)
          .text(d.data.name.length > 9 ? d.data.name.slice(0, 8) + '…' : d.data.name);

        label.transition()
          .duration(500)
          .delay(i * 10 + 300)
          .attr('opacity', 0.9);

        // Wisdom score label (smaller, below name)
        if (r > 20) {
          const wsLabel = zoomGroup.append('text')
            .attr('x', d.x)
            .attr('y', d.y + 3 + Math.min(r * 0.38, 13) + 1)
            .attr('text-anchor', 'middle')
            .attr('fill', spec.color)
            .attr('font-size', Math.min(r * 0.25, 10))
            .attr('font-family', 'JetBrains Mono, monospace')
            .attr('opacity', 0)
            .text(`${d.data.wisdomScore}`);

          wsLabel.transition()
            .duration(500)
            .delay(i * 10 + 400)
            .attr('opacity', 0.7);
        }
      }

      // Spectral class badge (for medium stars)
      if (r > 8 && r <= 12) {
        zoomGroup.append('text')
          .attr('x', d.x)
          .attr('y', d.y + 1)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('fill', '#fff')
          .attr('font-size', 7)
          .attr('font-family', 'JetBrains Mono, monospace')
          .attr('opacity', 0.6)
          .text(spec.css);
      }
    });

    // ── Center on largest star ──
    const firstLeaf = leaves[0];
    if (firstLeaf) {
      const scale = 0.85;
      const tx = width / 2 - firstLeaf.x * scale;
      const ty = height / 2 - firstLeaf.y * scale;
      svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    }

    // Cleanup tooltip on unmount
    return () => tooltip.remove();
  }, [data, isDark]);

  useEffect(() => {
    const timer = setTimeout(draw, 50);
    const ro = new ResizeObserver(() => draw());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
      // Cleanup tooltip
      const tip = containerRef.current?.querySelector('.star-tooltip');
      tip?.remove();
    };
  }, [draw]);

  return (
    <div className="term-body" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 14px',
        background: isDark ? '#0d0d18' : '#e0ded8',
        borderBottom: `1px solid ${isDark ? '#1a1a2a' : '#ccc'}`,
        fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
        color: isDark ? '#888' : '#666',
      }}>
        <span>
          <span style={{ color: '#4488ff', fontWeight: 700 }}>★ COSMIC WISDOM</span>
          <span style={{ marginLeft: 8, opacity: 0.6 }}>{data.length} stars · scroll to zoom · hover for details</span>
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: `1px solid ${isDark ? '#333' : '#bbb'}`,
            color: isDark ? '#888' : '#666',
            borderRadius: 3, padding: '2px 10px', cursor: 'pointer',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
          }}
        >
          ← back
        </button>
      </div>

      {/* Chart container */}
      <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
        <svg ref={svgRef} />
      </div>

      {/* Spectral legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '4px 14px',
        padding: '6px 14px',
        background: isDark ? '#0d0d18' : '#e0ded8',
        borderTop: `1px solid ${isDark ? '#1a1a2a' : '#ccc'}`,
        fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
        color: isDark ? '#666' : '#888',
      }}>
        <span style={{ opacity: 0.5 }}>spectral:</span>
        {SPECTRAL.map(s => (
          <span key={s.css}>
            <span style={{ color: s.color }}>●</span> {s.css} {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
