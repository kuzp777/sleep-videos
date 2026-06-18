# 🌙 助眠视频集 - 微信小程序

管理助眠视频数据的微信小程序，支持单个添加、Excel/CSV 批量导入，并可一键同步到 GitHub Pages 网站。

## 功能

- 📋 **视频列表** — 浏览、搜索、删除视频
- ➕ **单个添加** — 表单填写，支持 emoji
- 📥 **批量导入** — 支持 Excel (.xlsx) / CSV 文件导入，也支持粘贴
- 🔄 **一键同步** — 将数据同步到 GitHub Pages 网站

## 快速开始

### 1. 注册小程序

去 [mp.weixin.qq.com](https://mp.weixin.qq.com) 注册一个小程序账号。

### 2. 开通云开发

1. 打开微信开发者工具，导入本项目
2. 点击「云开发」按钮，开通云开发
3. 记下你的**环境 ID**（形如 `sleep-videos-xxx`）

### 3. 修改配置

编辑 `app.js`，把环境 ID 替换为你自己的：

```javascript
wx.cloud.init({
  env: '你的云开发环境ID',  // ← 改这里
  traceUser: true
})
```

### 4. 创建数据库集合

在云开发控制台 → 数据库，创建集合：`videos`

### 5. 部署云函数

在微信开发者工具中：
1. 右键 `cloud/functions/parseExcel` → 上传并部署：云端安装依赖
2. 右键 `cloud/functions/syncToGithub` → 上传并部署：云端安装依赖

### 6. 配置同步功能（可选）

如果要同步到 GitHub Pages，在云开发控制台 → 设置 → 环境变量，添加：

| 变量名 | 值 |
|--------|-----|
| `GITHUB_TOKEN` | 你的 GitHub Personal Access Token |
| `GITHUB_OWNER` | `kuzp777` |
| `GITHUB_REPO` | `sleep-videos` |

### 7. 填写 AppID

编辑 `project.config.json`，把 `appid` 改为你的小程序 AppID。

## Excel 导入格式

| name | url | cover | date | duration | keywords |
|------|-----|-------|------|----------|----------|
| 🌊 海浪声 | https://... | https://... | 2026-01-15 | 1:30:00 | 海浪\|白噪音\|助眠 |
| 🌧️ 雨声 | https://... | | 2026-02-20 | 2:00:00 | 雨声\|助眠 |

- 列名支持中英文：name/名称、url/链接、cover/封面、date/日期、duration/时长、keywords/关键词
- keywords 用 `|` 分隔多个标签

## 项目结构

```
sleep-videos-mini/
├── project.config.json      # 项目配置
├── app.js                   # 入口
├── app.json                 # 页面路由 & tabBar
├── app.wxss                 # 全局样式（暗色主题）
├── pages/
│   ├── index/               # 首页 — 视频列表 + 搜索 + 同步
│   ├── add/                 # 单个添加 / 编辑
│   └── import/              # 批量导入（Excel/CSV/粘贴）
└── cloud/functions/
    ├── parseExcel/          # 云函数：解析 Excel 文件
    └── syncToGithub/        # 云函数：同步到 GitHub
```
