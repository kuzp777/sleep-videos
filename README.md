# 🌙 助眠视频集

一个简洁的助眠视频收集网站，部署在 GitHub Pages 上，支持关键词筛选、搜索、收藏、随机抽取、批量导入等功能。

## ✨ 功能

| 功能 | 说明 |
|------|------|
| 🔍 搜索 | 按视频名称、关键词模糊搜索 |
| 🏷 关键词筛选 | 点击标签筛选，支持多选 |
| 📅 时间排序 | 最新/最早优先，也支持名称、时长排序 |
| 🎲 随机抽取 | 随机推荐一个视频 |
| ⭐ 收藏 | 本地收藏，支持筛选仅看收藏 |
| ▶️ 播放 | 点击跳转原链接，或在页面内弹窗播放 |
| 📥 批量导入 | 支持 JSON / CSV 格式批量导入 |
| 😀 Emoji | 完整支持视频名称中的 emoji 表情 |
| 📱 响应式 | 适配手机、平板、桌面端 |

## 🚀 部署到 GitHub Pages

### 1. 创建仓库

```bash
# 在 GitHub 上创建一个新仓库，例如 sleep-videos
git init
git add .
git commit -m "🌙 init: 助眠视频集"
git remote add origin https://github.com/你的用户名/sleep-videos.git
git push -u origin main
```

### 2. 开启 GitHub Pages

1. 进入仓库 → **Settings** → **Pages**
2. Source 选择 **Deploy from a branch**
3. Branch 选择 `main`，目录选 `/ (root)`
4. 点击 **Save**
5. 等待几分钟，访问 `https://你的用户名.github.io/sleep-videos/`

### 3. 自定义域名（可选）

在仓库根目录创建 `CNAME` 文件，写入你的域名：
```
sleep.example.com
```

## 📁 项目结构

```
sleep-videos/
├── index.html          # 主页 - 视频浏览
├── styles.css          # 样式
├── app.js              # 主页逻辑
├── admin.html          # 管理后台 - 批量导入
├── admin.js            # 管理后台逻辑
├── data/
│   └── videos.json     # 视频数据
└── README.md
```

## 📥 如何添加视频

### 方法一：管理后台（推荐）

1. 打开 `admin.html`（本地或线上）
2. **单个添加**：填写表单后点击添加
3. **批量导入**：
   - 准备 CSV 或 JSON 文件
   - 拖拽上传或粘贴内容
   - 预览确认后导入
4. 导出 JSON 文件
5. 替换仓库中的 `data/videos.json`
6. 提交推送

### 方法二：直接编辑 JSON

编辑 `data/videos.json`，按照格式添加：

```json
{
  "id": "unique_id",
  "name": "🌊 海浪声 · 深夜助眠",
  "url": "https://www.bilibili.com/video/BV...",
  "cover": "https://i0.hdslb.com/...",
  "date": "2026-01-15",
  "duration": "1:30:00",
  "keywords": ["海浪", "白噪音", "深度睡眠"]
}
```

### CSV 格式说明

```csv
name,url,cover,date,duration,keywords
🌊 海浪声,https://...,https://...,2026-01-15,1:30:00,海浪|白噪音|助眠
```

关键词用 `|` 分隔（因为 CSV 中逗号是分隔符）。

## 📱 微信小程序接入（待定）

`data/videos.json` 的数据结构已预留接口字段，后续可通过小程序的 `wx.request` 直接读取 JSON 数据，或搭建简单 API 服务。

建议方案：
- 小程序直接请求 GitHub Raw 文件
- 或使用 Vercel / Cloudflare Workers 做一层 API 代理

## 🎨 自定义

### 修改主题色

编辑 `styles.css` 中的 CSS 变量：

```css
:root {
  --accent: #7c6ef0;        /* 主题色 */
  --accent-light: #9d92f8;  /* 主题色亮 */
  --gold: #f0c040;          /* 金色高亮 */
}
```

### 接入更多视频平台

当前 iframe 播放器支持 B站、YouTube 等主流平台。如需支持其他平台，可能需要调整 iframe 的 `src` 格式。

## 📄 License

MIT
