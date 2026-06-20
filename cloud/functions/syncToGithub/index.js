const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// ===== 配置 =====
// 在云开发控制台设置以下环境变量，不要硬编码
const CONFIG = {
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',    // GitHub Personal Access Token
  GITHUB_OWNER: process.env.GITHUB_OWNER || '',    // GitHub 用户名
  GITHUB_REPO: process.env.GITHUB_REPO || '',      // 仓库名，如 jysasmr
}

exports.main = async () => {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = CONFIG

  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    return { success: false, error: '请先配置环境变量 GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO' }
  }

  try {
    // 1. 从云数据库读取所有视频
    const db = cloud.database()
    const countRes = await db.collection('videos').count()
    const total = countRes.total
    const batchSize = 100
    const allVideos = []

    for (let i = 0; i < total; i += batchSize) {
      const res = await db.collection('videos')
        .orderBy('date', 'desc')
        .skip(i)
        .limit(batchSize)
        .get()
      allVideos.push(...res.data)
    }

    // 2. 构建 videos.json（字段映射：小程序 → 网站）
    const videos = allVideos.map(v => {
      let cover = v.cover || ''

      // 封面路径处理：确保网站能正确加载
      if (cover && !cover.startsWith('http') && !cover.startsWith('data:')) {
        // 已有 covers/ 前缀的保持不变
        if (!cover.startsWith('covers/')) {
          cover = 'covers/' + cover
        }
      }

      // 关键词：移除特殊标签
      const kw = (v.keywords || []).filter(k => k !== '充电专属' && k !== '直播回放')

      // 字段映射：小程序 url → 网站 link，小程序 date → 网站 uploadTime
      return {
        name: v.name || '',
        link: v.url || '',
        cover: cover,
        uploadTime: v.date ? v.date + ' 00:00:00' : '',
        keywords: kw,
        isPremium: (v.keywords || []).includes('充电专属'),
        isLiveReplay: v.name.includes('直播回放') || (v.keywords || []).includes('直播回放')
      }
    })

    const jsonData = JSON.stringify(videos, null, 2)

    // 3. 获取当前文件 SHA（更新时需要）
    const currentSha = await getFileSha(GITHUB_OWNER, GITHUB_REPO, 'videos.json', GITHUB_TOKEN)

    // 4. 更新文件
    const content = Buffer.from(jsonData, 'utf-8').toString('base64')
    const body = JSON.stringify({
      message: `🌙 sync: 更新视频数据 (${videos.length} 条)`,
      content,
      ...(currentSha ? { sha: currentSha } : {})
    })

    await githubRequest(
      'PUT',
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/videos.json`,
      body,
      GITHUB_TOKEN
    )

    return {
      success: true,
      count: videos.length,
      url: `https://${GITHUB_OWNER}.github.io/${GITHUB_REPO}/`
    }
  } catch (err) {
    console.error('同步失败:', err)
    return { success: false, error: err.message }
  }
}

function getFileSha(owner, repo, path, token) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/contents/${path}`,
      method: 'GET',
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'sleep-videos-mini',
        'Accept': 'application/vnd.github.v3+json'
      }
    }

    const req = https.request(options, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve(json.sha || null)
        } catch {
          resolve(null)
        }
      })
    })

    req.on('error', () => resolve(null))
    req.end()
  })
}

function githubRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'sleep-videos-mini',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    }

    const req = https.request(options, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data))
        } else {
          reject(new Error(`GitHub API ${res.statusCode}: ${data}`))
        }
      })
    })

    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}
