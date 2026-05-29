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
    try {
      const container = containerRef.current;
      const svgEl = svgRef.current;
      if (!container || !svgEl || !data.length) return;

      // Wait until container has real dimensions
      const rawW = container.clientWidth;
      if (rawW < 100) return; // not laid out yet — ResizeObserver will retry

      const width = rawW - 4;
      const height = Math.max(500, Math.min(700, width * 0.6));
      const margin = 20;
      const innerW = width - margin * 2;
      const innerH = height - margin * 2;

      const sorted = [...data].sort((a, b) => b.wisdomScore - a.wisdomScore);

      // ── Pack layout ──
      const packData = sorted.map(d => ({
        name: d.name,
        wisdomScore: d.wisdomScore,
        value: d.wisdomScore,
        totalTokens: d.totalTokens,
        sessions: d.sessions,
        sources: d.sources,
      }));

      const root = d3.hierarchy<unknown>({ children: packData } as any)
        .sum(d => (d as any).value ?? 0)
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

      const pack = d3.pack<unknown>().size([innerW, innerH]).padding(4);
      pack(root);

      // ── SVG setup ──
      const svg = d3.select(svgEl);
      svg.selectAll('*').remove();

      svg
        .attr('width', width)
        .attr('height', height)
        .style('background', isDark ? '#080810' : '#e8e6e0')
        .style('border-radius', '4px')
        .style('display', 'block');

      // ── Background stars ──
      const bg = svg.append('g');
      const rng = (seed: number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
      const rand = rng(42);
      for (let i = 0; i < 80; i++) {
        bg.append('circle')
          .attr('cx', rand() * width)
          .attr('cy', rand() * height)
          .attr('r', rand() * 1.5 + 0.3)
          .attr('fill', isDark ? '#fff' : '#666')
          .attr('opacity', rand() * 0.3 + 0.05);
      }

      // ── Zoom ──
      const zoomG = svg.append('g');
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 8])
        .on('zoom', (event) => { zoomG.attr('transform', event.transform.toString()); });
      svg.call(zoom);

      // ── Tooltip (append to container, not svg) ──
      const tip = d3.select(container)
        .append('div')
        .attr('class', 'star-tooltip')
        .style('position', 'absolute')
        .style('pointer-events', 'none')
        .style('opacity', '0')
        .style('z-index', '100')
        .style('transition', 'opacity 0.15s');

      // ── Draw stars ──
      const leaves = root.leaves() as any[];
      const maxR = d3.max(leaves, d => d.r) ?? 50;

      leaves.forEach((d, i) => {
        const rank = i + 1;
        const spec = getSpectral(rank);
        const r = d.r;

        // Glow ring
        zoomG.append('circle')
          .attr('cx', d.x)
          .attr('cy', d.y)
          .attr('r', r * 1.2)
          .attr('fill', 'none')
          .attr('stroke', spec.color)
          .attr('stroke-width', Math.max(1, r * 0.12))
          .attr('opacity', 0.12 + (rank <= 10 ? 0.18 : 0));

        // Main circle
        const circle = zoomG.append('circle')
          .attr('cx', d.x)
          .attr('cy', d.y)
          .attr('r', 0)
          .attr('fill', spec.color)
          .attr('opacity', 0.88)
          .style('cursor', 'pointer')
          .style('filter', `drop-shadow(0 0 ${Math.min(r * 0.5, 18)}px ${spec.glow})`)
          .on('mouseenter', function () {
            d3.select(this).transition().duration(120).attr('opacity', 1).attr('stroke', '#fff').attr('stroke-width', 1.5);
            tip.style('opacity', '1')
              .html(`
                <div style="font-family:JetBrains Mono,monospace;font-size:11px;padding:8px 10px;
                      background:${isDark ? 'rgba(10,10,20,0.95)' : 'rgba(255,255,250,0.95)'};
                      color:${isDark ? '#c8c8c8' : '#1a1a1a'};
                      border:1px solid ${spec.color};border-radius:4px;min-width:150px">
                  <div style="font-weight:700;color:${spec.color};font-size:13px;margin-bottom:3px">★ ${d.data.name}</div>
                  <div style="color:${spec.color};font-size:10px;margin-bottom:4px">${spec.css} ${spec.label}</div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px 8px">
                    <span style="color:${isDark ? '#888' : '#999'}">wisdom</span><span style="font-weight:600">${d.data.wisdomScore}</span>
                    <span style="color:${isDark ? '#888' : '#999'}">tokens</span><span>${fmt(d.data.totalTokens)}</span>
                    <span style="color:${isDark ? '#888' : '#999'}">sessions</span><span>${d.data.sessions}</span>
                    <span style="color:${isDark ? '#888' : '#999'}">machines</span><span>${d.data.sources}</span>
                  </div>
                </div>
              `);
            const bx = d.x * 1.08 + 8;
            const by = d.y * 1.08 - 20;
            tip.style('left', Math.min(bx, width - 160) + 'px').style('top', Math.max(by, 8) + 'px');
          })
          .on('mouseleave', function () {
            d3.select(this).transition().duration(250).attr('opacity', 0.88).attr('stroke', 'none').attr('stroke-width', 0);
            tip.style('opacity', '0');
          });

        // Animate in
        circle.transition().duration(350).delay(i * 8).attr('r', r);

        // Label on larger stars
        if (r > 11 && d.data.name) {
          zoomG.append('text')
            .attr('x', d.x)
            .attr('y', d.y + 1)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('fill', isDark ? '#eee' : '#222')
            .attr('font-size', Math.min(r * 0.4, 13))
            .attr('font-family', 'JetBrains Mono, monospace')
            .attr('opacity', 0)
            .text(d.data.name.length > 9 ? d.data.name.slice(0, 8) + '…' : d.data.name)
            .transition().duration(450).delay(i * 8 + 250).attr('opacity', 0.9);

          // Wisdom value below name (only big stars)
          if (r > 18) {
            zoomG.append('text')
              .attr('x', d.x)
              .attr('y', d.y + 1 + Math.min(r * 0.4, 13) + 1)
              .attr('text-anchor', 'middle')
              .attr('fill', spec.color)
              .attr('font-size', Math.min(r * 0.22, 9))
              .attr('font-family', 'JetBrains Mono, monospace')
              .attr('opacity', 0)
              .text(`${d.data.wisdomScore}`)
              .transition().duration(450).delay(i * 8 + 350).attr('opacity', 0.6);
          }
        } else if (r > 7) {
          // Spectral badge for medium-small stars
          zoomG.append('text')
            .attr('x', d.x)
            .attr('y', d.y + 1)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('fill', '#fff')
            .attr('font-size', 7)
            .attr('font-family', 'JetBrains Mono, monospace')
            .attr('opacity', 0.5)
            .text(spec.css);
        }
      });

      // ── Center view on pack ──
      svg.call(zoom.transform, d3.zoomIdentity.translate(margin, margin).scale(1));
    } catch (err) {
      console.error('StarChart draw error:', err);
    }
  }, [data, isDark]);

  useEffect(() => {
    // Initial draw with small delay for layout to settle
    const t = setTimeout(draw, 80);

    // Redraw on resize
    const ro = new ResizeObserver(() => draw());
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      clearTimeout(t);
      ro.disconnect();
      // Cleanup tooltip
      containerRef.current?.querySelector('.star-tooltip')?.remove();
    };
  }, [draw]);

  return (
    <div className="term-body" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '7px 14px', flexShrink: 0,
        background: isDark ? '#0d0d18' : '#e0ded8',
        borderBottom: `1px solid ${isDark ? '#1a1a2a' : '#ccc'}`,
        fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
        color: isDark ? '#888' : '#666',
      }}>
        <span>
          <span style={{ color: '#4488ff', fontWeight: 700 }}>★ COSMIC WISDOM</span>
          <span style={{ marginLeft: 8, opacity: 0.6 }}>{data.length} stars · scroll to zoom · hover for details</span>
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: `1px solid ${isDark ? '#333' : '#bbb'}`,
          color: isDark ? '#888' : '#666', borderRadius: 3, padding: '2px 10px',
          cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
        }}>← back</button>
      </div>

      {/* Chart area — fills available height */}
      <div ref={containerRef} style={{
        flex: 1, position: 'relative', width: '100%', minHeight: 400,
        overflow: 'hidden',
      }}>
        <svg ref={svgRef} style={{ display: 'block' }} />
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '4px 14px', flexShrink: 0,
        padding: '5px 14px',
        background: isDark ? '#0d0d18' : '#e0ded8',
        borderTop: `1px solid ${isDark ? '#1a1a2a' : '#ccc'}`,
        fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
        color: isDark ? '#666' : '#888',
      }}>
        <span style={{ opacity: 0.5 }}>spectral:</span>
        {SPECTRAL.map(s => (
          <span key={s.css}><span style={{ color: s.color }}>●</span> {s.css} {s.label}</span>
        ))}
      </div>
    </div>
  );
}
