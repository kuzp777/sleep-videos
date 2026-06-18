const cloud = require('wx-server-sdk')
const XLSX = require('xlsx')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  const { fileID } = event

  try {
    // 下载文件
    const res = await cloud.downloadFile({ fileID })
    const buffer = res.fileContent

    // 解析 Excel
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet)

    if (rows.length === 0) {
      return { success: true, data: [] }
    }

    // 映射列名
    const data = rows.map(row => {
      const keys = Object.keys(row)
      const get = (patterns) => {
        for (const p of patterns) {
          const key = keys.find(k => new RegExp(p, 'i').test(k))
          if (key) return String(row[key] || '').trim()
        }
        return ''
      }

      const kwStr = get(['keyword', '关键词', '标签', 'tags'])
      const keywords = kwStr
        ? kwStr.split(/[,|｜、]/).map(s => s.trim()).filter(Boolean)
        : []

      return {
        name: get(['name', '名称', '标题', 'title']),
        url: get(['url', '链接', '地址', 'link']),
        cover: get(['cover', '封面', '封面图', 'thumbnail', 'image']),
        date: get(['date', '日期', '时间', 'time']),
        duration: get(['duration', '时长', '长度']),
        keywords
      }
    }).filter(v => v.name && v.url)

    // 清理临时文件
    await cloud.deleteFile({ fileList: [fileID] })

    return { success: true, data }
  } catch (err) {
    console.error('解析失败:', err)
    return { success: false, error: err.message }
  }
}
