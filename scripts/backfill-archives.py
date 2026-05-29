#!/usr/bin/env python3
"""Backfill token-vision archives from historical daily ranking markdown reports."""
import json, re, os, math
from collections import defaultdict
from datetime import datetime, timezone, timedelta

TOKEN_VISION_DIR = os.path.expanduser("~/token-vision/public/data")
ARCHIVE_DIR = os.path.join(TOKEN_VISION_DIR, "archive")
os.makedirs(ARCHIVE_DIR, exist_ok=True)

# Source daily reports
REPORTS = {
    "2026-05-27": os.path.expanduser("~/.hermes/token-ranking/2026-05-27.md"),
    "2026-05-28": os.path.expanduser("~/.hermes/token-ranking/2026-05-28.md"),
}

# Load current data to extract approximate sources per person
current_path = os.path.join(TOKEN_VISION_DIR, "data.json")
sources_map = {}
if os.path.exists(current_path):
    with open(current_path) as f:
        current = json.load(f)
    for r in current.get("ranking", []):
        sources_map[r["name"]] = r.get("sources", 1)

def parse_markdown_report(path):
    """Extract (name, tokens, sessions) tuples from daily markdown ranking table."""
    results = []
    with open(path) as f:
        for line in f:
            m = re.match(r'\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([\d,]+)\s*\|\s*(\d+)\s*\|', line)
            if m:
                name = m.group(2).strip()
                tokens = int(m.group(3).replace(',', ''))
                sessions = int(m.group(4))
                results.append((name, tokens, sessions))
    return results

def format_as_archive(entries, date_str, sources_map):
    """Convert parsed entries to token-vision archive format."""
    now = f"{date_str} 23:59:59"
    
    total_tokens = sum(e[1] for e in entries)
    total_cost = total_tokens * 0.0000003
    total_sessions = sum(e[2] for e in entries)
    n = len(entries)
    
    # Wisdom scores
    wisdom_raws = []
    ranked = []
    for i, (name, tokens, sessions) in enumerate(entries):
        sources = sources_map.get(name, 1)
        raw = math.log10(max(tokens, 1)) * 200 + math.sqrt(sessions) * 60 + sources * 50
        wisdom_raws.append(raw)
        ranked.append((name, tokens, sessions, sources))
    
    max_raw = max(wisdom_raws) if wisdom_raws else 1
    
    stats = {
        "totalPeople": n,
        "totalTokens": total_tokens,
        "totalCost": round(total_cost, 6),
        "totalSessions": total_sessions,
        "avgTokensPerPerson": round(total_tokens / n) if n > 0 else 0,
        "avgCostPerPerson": round(total_cost / n, 6) if n > 0 else 0,
        "avgSessionsPerPerson": round(total_sessions / n, 1) if n > 0 else 0,
        "totalWisdom": round(sum(wisdom_raws) / max_raw * 1000),
        "avgWisdomPerPerson": round(sum(wisdom_raws) / max_raw * 1000 / max(n, 1)),
    }
    
    ranking = []
    top5 = []
    for i, (name, tokens, sessions, sources) in enumerate(ranked, 1):
        cost = round(tokens * 0.0000003, 6)
        raw = wisdom_raws[i - 1]
        wisdom = min(999, int(raw / max_raw * 1000))
        item = {
            "rank": i,
            "name": name,
            "totalTokens": tokens,
            "cost": cost,
            "sessions": sessions,
            "sources": sources,
            "wisdomScore": wisdom,
            "updatedAt": now,
        }
        ranking.append(item)
        if i <= 5:
            top5.append(item)
    
    return {
        "updatedAt": now,
        "dataSource": f"backfilled from daily ranking report ({date_str})",
        "stats": stats,
        "top5": top5,
        "ranking": ranking,
        "detail": [],
    }

for date_str, report_path in REPORTS.items():
    if not os.path.exists(report_path):
        print(f"⚠️ 未找到报告: {report_path}")
        continue
    
    archive_path = os.path.join(ARCHIVE_DIR, f"{date_str}.json")
    if os.path.exists(archive_path):
        print(f"⏭️ 已存在: {archive_path}")
        continue
    
    entries = parse_markdown_report(report_path)
    if not entries:
        print(f"❌ 无法解析: {report_path}")
        continue
    
    print(f"📄 {date_str}: 解析到 {len(entries)} 人")
    data = format_as_archive(entries, date_str, sources_map)
    
    with open(archive_path, "w") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"📦 已归档: {archive_path}")

print("\n✅ 回填完成")
print(f"   现在需要重新生成聚合文件!")
