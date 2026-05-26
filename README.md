# TOKEN VISION 🚀

**Hermes AI Token 消耗监控系统** — 科幻风格可视化 Dashboard

跨 30+ Hermes AI 实例的 Token 消耗数据可视化，每天自动从飞书表格拉取数据，实时刷新。

## 🌌 功能

- **总览面板** — 总Token、总费用、总会话、活跃人数实时统计
- **排名榜** — 按会话次数/Token/费用多维排序，顶部大卡片展示TOP3
- **数据图表** — 费用分布饼图、会话次数柱状图、产出效率分析
- **科幻风格** — 深空主题、霓虹渐变、粒子背景、扫描线动画
- **自动更新** — 每小时从飞书同步数据，自动部署到 GitHub Pages

## 🛠 技术栈

- **框架**: Next.js 14 (Static Export)
- **图表**: Recharts
- **样式**: Tailwind CSS + 自定义科幻主题
- **部署**: GitHub Pages + GitHub Actions
- **数据源**: 飞书表格 Open API

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 拉取数据
FEISHU_APP_ID=xxx FEISHU_APP_SECRET=xxx npm run fetch-data

# 本地开发
npm run dev

# 构建
npm run build
```

## 🤖 自动更新

GitHub Actions 每 2 小时自动运行：
1. 通过飞书 API 拉取最新数据
2. 生成 `public/data/data.json`
3. 构建并部署到 GitHub Pages

需要在 GitHub 仓库设置 Secrets：
- `FEISHU_APP_ID` — 飞书应用的 App ID
- `FEISHU_APP_SECRET` — 飞书应用的 App Secret

## 📊 数据源

| 表格 | 说明 |
|------|------|
| Token 数据明细 | 每台机器每人的详细数据 |
| Token 使用统计 | 每人汇总（跨实例共存） |
| 全员汇总 | 全部实例合并排名 |

## 🎨 设计灵感

赛博朋克 + 深空科幻风格。颜色主题以 `#00f0ff`（霓虹青）和 `#ff00ff`（霓虹紫红）为主，配合粒子效果和扫描线动画，打造沉浸式数据监控体验。
