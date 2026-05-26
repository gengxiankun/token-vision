const https = require('https');
const fs = require('fs');
const path = require('path');

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const DOMAIN = 'open.larksuite.com';

const SHEETS = {
  detail: { token: 'XMl5sSDuth18VLtKiMnl3wEYg4g', sheetId: 'ac0f6e' },
  simple: { token: 'S5WKsGVOJh0g0ktwQ7BlTpewgjv', sheetId: '0368a2' },
  summary: { token: 'OanxshujdhGeCctaTQ8lKxEugIb', sheetId: 'f727b2' },
};

function httpsPost(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(data);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = { hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, headers };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // 1. Get tenant access token
  const authResp = await httpsPost(
    `https://${DOMAIN}/open-apis/auth/v3/tenant_access_token/internal`,
    { app_id: APP_ID, app_secret: APP_SECRET }
  );
  const token = authResp.tenant_access_token;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 2. Fetch raw data from all 3 sheets
  const allData = {};
  for (const [key, sheet] of Object.entries(SHEETS)) {
    const resp = await httpsGet(
      `https://${DOMAIN}/open-apis/sheets/v2/spreadsheets/${sheet.token}/values/${sheet.sheetId}!A1:N200`,
      headers
    );
    allData[key] = resp.data?.valueRange?.values || [];
  }

  // 3. Parse summary sheet (main ranking data)
  const summaryRows = allData.summary || [];
  const ranking = [];
  for (const row of summaryRows) {
    if (!row[0] || !row[1] || row[0] === '排名' || String(row[0]) === '999') continue;
    ranking.push({
      rank: parseInt(row[0]) || 0,
      name: String(row[1]).trim(),
      totalTokens: parseInt(row[2]) || 0,
      cost: parseFloat(row[3]) || 0,
      sessions: parseInt(row[4]) || 0,
      sources: parseInt(row[5]) || 0,
      updatedAt: row[6] || '',
    });
  }

  // Sort by rank
  ranking.sort((a, b) => a.rank - b.rank);

  // 4. Parse detail sheet (per-instance data)
  const detailRows = allData.detail || [];
  const detail = [];
  let inPersonalSection = false;
  for (const row of detailRows) {
    const type = String(row[1] || '').trim();
    const name = String(row[2] || '').trim();
    if (type === '总览' && name === 'ALL') continue;
    if (type === '个人' && name) {
      inPersonalSection = true;
      const inputTokens = parseInt(row[4]) || 0;
      const outputTokens = parseInt(row[5]) || 0;
      const totalTokens = parseInt(row[6]) || 0;
      const cost = parseFloat(row[7]) || 0;
      const groups = String(row[8] || '');
      const sessions = parseInt(row[9]) || 0;
      const updatedAt = row[10] || '';
      const dmSessions = parseInt(row[11]) || 0;
      const groupSessions = parseInt(row[12]) || 0;
      detail.push({
        name,
        inputTokens,
        outputTokens,
        totalTokens,
        cost,
        groups,
        sessions,
        dmSessions,
        groupSessions,
        updatedAt,
      });
    }
  }

  // 5. Compute stats
  const totalTokens = ranking.reduce((s, r) => s + r.totalTokens, 0);
  const totalCost = ranking.reduce((s, r) => s + r.cost, 0);
  const totalSessions = ranking.reduce((s, r) => s + r.sessions, 0);
  const top5 = ranking.slice(0, 5);

  const output = {
    updatedAt: new Date().toISOString(),
    stats: {
      totalPeople: ranking.length,
      totalTokens,
      totalCost: Math.round(totalCost * 1000000) / 1000000,
      totalSessions,
      avgTokensPerPerson: Math.round(totalTokens / ranking.length),
      avgCostPerPerson: Math.round((totalCost / ranking.length) * 1000000) / 1000000,
      avgSessionsPerPerson: Math.round((totalSessions / ranking.length) * 10) / 10,
    },
    top5,
    ranking,
    detail,
  };

  // 6. Write data file
  const dataDir = path.join(__dirname, '..', 'public', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'data.json'), JSON.stringify(output, null, 2));

  console.log(`✅ Data fetched: ${ranking.length} people, ${totalTokens.toLocaleString()} total tokens`);
}

main().catch(console.error);
