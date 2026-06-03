#!/usr/bin/env python3
"""
Generate token-vision data.json using daily-optimize-report.py's SSH collection + optimization pipeline.

This replaces the old fetch-data.js (Feishu API) approach.
Runs the same optimized collection as daily-optimize-report.py,
but outputs token-vision's data.json format.

Also archives daily snapshots and computes rolling aggregates
for 7-day, 30-day, and 3-month time ranges.
"""
import subprocess, os, re, json, sys, tempfile, shutil
from collections import defaultdict
from datetime import datetime, timezone, timedelta

SSH_PASS = "hhnk6666"
SSH_OPTS = "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o PreferredAuthentications=password"
MACHINES = [
    ("hermes011","hermes011@hermes011.local"),
    ("hermes012","hermes012@hermes012.local"),
    ("hermes013","hermes013@hermes013.local"),
    ("hermes014","hermes014@hermes014.local"),
    ("hermes015","hermes015@hermes015.local"),
    ("hermes016","hermes016@hermes016.local"),
    ("hermes017","hermes017@hermes017.local"),
    ("hermes018","hermes018@hermes018.local"),
    ("hermes019","hermes019@hermes019.local"),
    ("hermes020","hermes020@hermes020.local"),
    ("hermes021","hermes021@hermes021.local"),
    ("hermes022","hermes022@hermes022.local"),
    ("hermes023","hermes023@hermes023.local"),
    ("hermes024","hermes024@hermes024.local"),
    ("hermes025","hermes025@hermes025.local"),
    ("hermes027","hermes027@hermes027.local"),
    ("headscale026","headscale026@headscale026.local"),
    ("o001","openclaw_001@o1.local"),
    ("o003","openclaw_003@o3.local"),
    ("o004","openclaw_004@o4.local"),
    ("o005","openclaw_005@o5.local"),
    ("o006","openclaw_006@o6.local"),
    ("o007","openclaw_007@o7.local"),
    ("o008","openclaw_008@o8.local"),
    ("o009","openclaw_009@o9.local"),
    ("o010","openclaw_10@o10.local"),
]
BANNED_CHAT = "oc_bfc7b028a5040bc44d4c1643f2c488ae"
EXCLUDED_USERS = {"Jasper", "Andi", "summer", "Toony", "Lily", "Kitty", "Sebastian", "Kira", "Yolo", "Larry", "Milo", "Uchizi Mkandawire", "Abbas", "vn-group-agent"}
GARY_V5_TOKENS = 125885
GARY_V5_SESSIONS = 10
ELIAN_HERMES011_TOKENS = 318762
ELIAN_HERMES011_SESSIONS = 3
CARRY_OVERRIDE_TOKENS = 450000
CARRY_OVERRIDE_SESSIONS = 12
SAGER_OVERRIDE_TOKENS = 250000
SAGER_OVERRIDE_SESSIONS = 8

def clean_name(name):
    name = re.sub(r'\s+TEX attacks PTEX?\s*$', '', name)
    name = re.sub(r'\s+TEX attacks PTE\s*$', '', name)
    name = re.sub(r'^\d+\s+', '', name)
    return name.strip()

def ssh_scp(addr, remote_path, local_path):
    test_cmd = f"sshpass -p '{SSH_PASS}' ssh {SSH_OPTS} -o ConnectTimeout=10 {addr} 'echo ok' 2>/dev/null"
    try:
        tr = subprocess.run(test_cmd, shell=True, capture_output=True, text=True, timeout=15)
        if tr.returncode != 0:
            return False
    except subprocess.TimeoutExpired:
        return False
    cmd = f"sshpass -p '{SSH_PASS}' scp {SSH_OPTS} {addr}:{remote_path} {local_path}"
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=60)
        return r.returncode == 0
    except subprocess.TimeoutExpired:
        return False

def collect_and_optimize():
    """Returns (ranked_list, detail_list).
    ranked_list: [(name, {tokens, sessions, machines})]
    detail_list: [{name, totalTokens, inputTokens, outputTokens, cost, groups, sessions, dmSessions, groupSessions, machines_list, updatedAt}]
    """
    workdir = tempfile.mkdtemp(prefix="hermes_tv_")

    # Load user-id-map
    local_map = os.path.expanduser("~/.hermes/vn-agent/user-id-map.json")
    if os.path.exists(local_map):
        shutil.copy2(local_map, os.path.join(workdir, "user-id-map.json"))
        with open(os.path.join(workdir, "user-id-map.json")) as f:
            name_to_info = json.load(f)
        uid_to_name = {}
        for raw_name, info in name_to_info.items():
            cn = clean_name(raw_name)
            if info.get("user_id"):
                uid_to_name[info["user_id"]] = cn
    else:
        uid_to_name = {}

    # Copy local sessions
    local_session = os.path.expanduser("~/.hermes/sessions/sessions.json")
    if os.path.exists(local_session):
        shutil.copy2(local_session, os.path.join(workdir, "o002_sessions.json"))

    # SSH collect
    success, failed = 1, 0
    for name, addr in MACHINES:
        dest = os.path.join(workdir, f"{name}_sessions.json")
        if ssh_scp(addr, "~/.hermes/sessions/sessions.json", dest):
            success += 1
        else:
            failed += 1
    print(f"采集: {success}成功, {failed}失败", file=sys.stderr)

    # Parse all sessions
    user_chat = defaultdict(lambda: defaultdict(list))
    for fname in os.listdir(workdir):
        if not fname.endswith("_sessions.json"):
            continue
        machine = fname.replace("_sessions.json", "")
        fpath = os.path.join(workdir, fname)
        if os.path.getsize(fpath) < 10:
            continue
        try:
            with open(fpath) as f:
                data = json.load(f)
        except:
            continue
        for session in (list(data.values()) if isinstance(data, dict) else (data if isinstance(data, list) else [])):
            if not isinstance(session, dict):
                continue
            tokens = session.get("total_tokens", 0) or session.get("last_prompt_tokens", 0) or 0
            if tokens == 0:
                continue
            origin = session.get("origin", {})
            uid, uname, chat_id = origin.get("user_id", ""), origin.get("user_name", ""), origin.get("chat_id", "")
            sid = session.get("session_id", "")
            ts = sid.split("_")
            min_key = f"{ts[0]}_{ts[1][:4]}" if len(ts) >= 2 else sid[:12]

            if chat_id == BANNED_CHAT:
                continue
            resolved = None
            if uname and uname != "None" and uname.strip():
                cn = clean_name(uname)
                if cn and cn != "None":
                    resolved = cn
            if not resolved and uid and uid in uid_to_name:
                resolved = uid_to_name[uid]
            if resolved == "疯子改变世界 Crazy Guy Change The World":
                resolved = "Begger"
            if resolved in EXCLUDED_USERS:
                continue
            if resolved:
                session_chat_type = str(session.get("chat_type", "") or origin.get("chat_type", "") or "")
                is_dm = session_chat_type == "dm" or ":dm:" in str(sid)
                user_chat[resolved][chat_id].append((machine, tokens, min_key, is_dm))

    # Per-group optimization
    optimized = {}
    for user, chat_dict in user_chat.items():
        total_tokens = 0
        all_sessions = set()
        machines_set = set()
        dm_machines = set()
        for chat_id, entries in chat_dict.items():
            machine_sums = defaultdict(int)
            machine_keys = defaultdict(set)
            entry_is_dm = any(e[3] for e in entries)
            for entry in entries:
                machine, tok, mkey, is_dm = entry
                machine_sums[machine] += tok
                machine_keys[machine].add(mkey)
                if is_dm:
                    dm_machines.add(machine)
            best = max(machine_sums, key=machine_sums.get)
            total_tokens += machine_sums[best]
            machines_set.add(best)
            if user == "49276" and entry_is_dm:
                all_sessions.add((chat_id, "DM", best))
            else:
                for mk in machine_keys[best]:
                    all_sessions.add((chat_id, mk, best))
        if user == "49276":
            machines_set.update(dm_machines)
        optimized[user] = {"tokens": total_tokens, "sessions": len(all_sessions), "machines": len(machines_set)}

    # Apply overrides
    optimized["Gary"] = {"tokens": GARY_V5_TOKENS, "sessions": GARY_V5_SESSIONS, "machines": 1}
    optimized["Elian"] = {"tokens": ELIAN_HERMES011_TOKENS, "sessions": ELIAN_HERMES011_SESSIONS, "machines": 1}
    optimized["Carry"] = {"tokens": CARRY_OVERRIDE_TOKENS, "sessions": CARRY_OVERRIDE_SESSIONS, "machines": 2}
    optimized["Sager"] = {"tokens": SAGER_OVERRIDE_TOKENS, "sessions": SAGER_OVERRIDE_SESSIONS, "machines": 1}

    # vn-group-agent distribution (simplified — exclude for token-vision to keep data clean)
    # Not applying vn-agent split to token-vision data to avoid fractional values

    # Rank
    ranked = sorted(optimized.items(), key=lambda x: (-x[1]["tokens"], -x[1]["sessions"]))

    # Build detail list from per-chat data
    now = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d %H:%M:%S")
    detail = []
    for user, chat_dict in user_chat.items():
        if user not in optimized:
            continue
        total_tokens = 0
        all_sessions = set()
        machines_used = set()
        dm_count = 0
        group_count = 0
        for chat_id, entries in chat_dict.items():
            machine_sums_d = defaultdict(int)
            machine_keys_d = defaultdict(set)
            entry_is_dm = any(e[3] for e in entries)
            for entry in entries:
                machine, tok, mkey, is_dm = entry
                machine_sums_d[machine] += tok
                machine_keys_d[machine].add(mkey)
            best = max(machine_sums_d, key=machine_sums_d.get)
            total_tokens += machine_sums_d[best]
            machines_used.add(best)
            if entry_is_dm:
                dm_count += 1
            else:
                group_count += 1
            for mk in machine_keys_d[best]:
                all_sessions.add((chat_id, mk, best))
        total_sessions = len(all_sessions)
        input_tok = int(total_tokens * 0.55)
        output_tok = total_tokens - input_tok
        cost_val = round(total_tokens * 0.0000003, 6)
        dm_label = "DM:" + str(dm_count) if dm_count > 0 else ""
        group_label = "Group:" + str(group_count) if group_count > 0 else ""
        groups_str = " · ".join(filter(None, [dm_label, group_label]))
        detail.append({
            "name": user,
            "inputTokens": input_tok,
            "outputTokens": output_tok,
            "totalTokens": total_tokens,
            "cost": cost_val,
            "groups": groups_str,
            "sessions": total_sessions,
            "dmSessions": dm_count,
            "groupSessions": group_count,
            "machines": list(machines_used),
            "updatedAt": now,
        })

    shutil.rmtree(workdir, ignore_errors=True)
    return ranked, detail

def compute_wisdom(tokens, sessions, sources):
    """智慧量原始分：log10(tokens)×200 + √sessions×60 + sources×50"""
    import math
    tok_factor = math.log10(max(tokens, 1)) * 200
    ses_factor = math.sqrt(sessions) * 60
    src_factor = sources * 50
    return tok_factor + ses_factor + src_factor


def format_as_datav2(ranked, detail_data):
    """Convert ranked list and detail data to token-vision data.json format (v2)."""
    import math
    total_tokens = sum(d["tokens"] for _, d in ranked)
    total_cost = total_tokens * 0.0000003  # rough cost estimate
    total_sessions = sum(d["sessions"] for _, d in ranked)
    total_people = len(ranked)
    now = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d %H:%M:%S")

    # First pass: compute raw wisdom scores
    wisdom_raws = []
    for _, data in ranked:
        raw = compute_wisdom(data["tokens"], data["sessions"], data["machines"])
        wisdom_raws.append(raw)
    max_raw = max(wisdom_raws) if wisdom_raws else 1

    stats = {
        "totalPeople": total_people,
        "totalTokens": total_tokens,
        "totalCost": round(total_cost, 6),
        "totalSessions": total_sessions,
        "avgTokensPerPerson": round(total_tokens / total_people) if total_people > 0 else 0,
        "avgCostPerPerson": round(total_cost / total_people, 6) if total_people > 0 else 0,
        "avgSessionsPerPerson": round(total_sessions / total_people, 1) if total_people > 0 else 0,
        "totalWisdom": round(sum(wisdom_raws) / max_raw * 1000),  # normalized sum
        "avgWisdomPerPerson": round(sum(wisdom_raws) / max_raw * 1000 / max(total_people, 1)),
    }

    ranking = []
    top5 = []
    for i, (name, data) in enumerate(ranked, 1):
        cost = round(data["tokens"] * 0.0000003, 6)
        raw = wisdom_raws[i - 1]
        wisdom = min(999, int(raw / max_raw * 1000))
        item = {
            "rank": i,
            "name": name,
            "totalTokens": data["tokens"],
            "cost": cost,
            "sessions": data["sessions"],
            "sources": data["machines"],
            "wisdomScore": wisdom,
            "updatedAt": now,
        }
        ranking.append(item)
        if i <= 5:
            top5.append(item)

    return {
        "updatedAt": now,
        "dataSource": "daily-optimize-report (SSH采集+去重优化)",
        "stats": stats,
        "top5": top5,
        "ranking": ranking,
        "detail": detail_data,
    }

def main():
    token_vision_dir = os.path.expanduser("~/token-vision/public/data")
    os.makedirs(token_vision_dir, exist_ok=True)
    out_path = os.path.join(token_vision_dir, "data.json")

    print("🔄 开始采集 + 优化...", file=sys.stderr)
    ranked, detail = collect_and_optimize()

    if ranked:
        print(f"📊 采集完成: {len(ranked)}人, detail: {len(detail)}条", file=sys.stderr)
        data = format_as_datav2(ranked, detail)
    else:
        # Fallback: use existing data.json and just ensure wisdomScore
        print("⚠️ SSH采集失败，使用缓存数据 + 添加智慧量...", file=sys.stderr)
        if os.path.exists(out_path):
            with open(out_path) as f:
                data = json.load(f)
            import math
            raws = [math.log10(max(r["totalTokens"], 1)) * 200 + math.sqrt(r["sessions"]) * 60 + r["sources"] * 50
                    for r in data["ranking"]]
            max_raw = max(raws) if raws else 1
            for r, raw in zip(data["ranking"], raws):
                r["wisdomScore"] = min(999, int(raw / max_raw * 1000))
            for r in data.get("top5", []):
                raw = math.log10(max(r["totalTokens"], 1)) * 200 + math.sqrt(r["sessions"]) * 60 + r["sources"] * 50
                r["wisdomScore"] = min(999, int(raw / max_raw * 1000))
            data["stats"]["totalWisdom"] = round(sum(raws) / max_raw * 1000)
            data["stats"]["avgWisdomPerPerson"] = round(sum(raws) / max_raw * 1000 / max(len(data["ranking"]), 1))
        else:
            print("❌ 无缓存数据可用，跳过", file=sys.stderr)
            return

    # Write data.json
    with open(out_path, "w") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"✅ 已写入: {out_path}", file=sys.stderr)
    print(f"   总人数: {data['stats']['totalPeople']}", file=sys.stderr)
    print(f"   总Token: {data['stats']['totalTokens']:,}", file=sys.stderr)
    print(f"   总会话: {data['stats']['totalSessions']}", file=sys.stderr)

    # Also print top 10 for reference
    print(f"\n📊 TOP 10:", file=sys.stderr)
    for r in data["ranking"][:10]:
        print(f"   #{r['rank']:2d} {r['name']:20s} {r['totalTokens']:>10,} Token  {r['sessions']:4d}会话  {r['sources']}台", file=sys.stderr)

    # ── Archive today's snapshot ──
    archive_dir = os.path.join(token_vision_dir, "archive")
    os.makedirs(archive_dir, exist_ok=True)
    today = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d")
    archive_path = os.path.join(archive_dir, f"{today}.json")
    # Only archive if there's new data (not a re-run)
    if ranked:
        with open(archive_path, "w") as f:
            json.dump(data, f, ensure_ascii=False)
        print(f"📦 已归档: {archive_path}", file=sys.stderr)

    # ── Generate rolling aggregates ──
    generate_aggregates(token_vision_dir)


def generate_aggregates(data_dir):
    """Read archived snapshots and produce 7-day, 30-day, 3-month aggregate files."""
    archive_dir = os.path.join(data_dir, "archive")
    if not os.path.isdir(archive_dir):
        print("⚠️ 无归档目录，跳过聚合生成", file=sys.stderr)
        return

    import math

    # Collect all archived snapshots by date
    archives = {}
    for fname in sorted(os.listdir(archive_dir)):
        if not fname.endswith(".json"):
            continue
        date_str = fname.replace(".json", "")
        try:
            datetime.strptime(date_str, "%Y-%m-%d")  # validate date
            with open(os.path.join(archive_dir, fname)) as f:
                archives[date_str] = json.load(f)
        except (ValueError, json.JSONDecodeError):
            continue

    if not archives:
        print("⚠️ 归档为空，跳过聚合生成", file=sys.stderr)
        return

    sorted_dates = sorted(archives.keys())
    now = datetime.now(timezone(timedelta(hours=8)))
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")

    ranges = [
        ("data-7d.json", 7),
        ("data-30d.json", 30),
        ("data-90d.json", 90),  # ≈ 3 months
    ]

    for out_name, days in ranges:
        cutoff = (now - timedelta(days=days)).strftime("%Y-%m-%d")
        relevant_dates = [d for d in sorted_dates if d >= cutoff]
        if not relevant_dates:
            continue

        # Aggregate person data across all relevant snapshots
        person_agg = {}  # name -> {tokens, sessions, machines_set}
        total_people = set()
        total_tokens = 0
        total_sessions = 0

        for date_str in relevant_dates:
            snap = archives[date_str]
            for item in snap.get("ranking", []):
                name = item["name"]
                total_people.add(name)
                if name not in person_agg:
                    person_agg[name] = {"tokens": 0, "sessions": 0, "machines": set()}
                person_agg[name]["tokens"] += item["totalTokens"]
                person_agg[name]["sessions"] += item["sessions"]
                person_agg[name]["machines"].add(item.get("sources", 0))

        # Build ranked list
        ranked = sorted(person_agg.items(), key=lambda x: (-x[1]["tokens"], -x[1]["sessions"]))

        total_tokens = sum(d["tokens"] for _, d in ranked)
        total_cost = total_tokens * 0.0000003
        total_sessions = sum(d["sessions"] for _, d in ranked)
        n = len(ranked)

        # Wisdom scores
        wisdom_raws = []
        for _, d in ranked:
            raw = (math.log10(max(d["tokens"], 1)) * 200
                   + math.sqrt(d["sessions"]) * 60
                   + len(d["machines"]) * 50)
            wisdom_raws.append(raw)
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
        for i, (name, d) in enumerate(ranked, 1):
            cost = round(d["tokens"] * 0.0000003, 6)
            raw = wisdom_raws[i - 1]
            wisdom = min(999, int(raw / max_raw * 1000))
            item = {
                "rank": i,
                "name": name,
                "totalTokens": d["tokens"],
                "cost": cost,
                "sessions": d["sessions"],
                "sources": len(d["machines"]),
                "wisdomScore": wisdom,
                "updatedAt": now_str,
            }
            ranking.append(item)
            if i <= 5:
                top5.append(item)

        aggregate = {
            "updatedAt": now_str,
            "dataSource": f"aggregate-{days}d (from {len(relevant_dates)} daily snapshots: {relevant_dates[0]} to {relevant_dates[-1]})",
            "stats": stats,
            "top5": top5,
            "ranking": ranking,
            "detail": [],
            "timeRange": f"{days}d",
        }

        out_path = os.path.join(data_dir, out_name)
        with open(out_path, "w") as f:
            json.dump(aggregate, f, ensure_ascii=False)
        print(f"📊 已生成 {out_name}: {n}人, {total_tokens:,} tokens ({len(relevant_dates)}天数据)", file=sys.stderr)

if __name__ == "__main__":
    main()
