Page({
  data: {
    method: 'file',
    fileName: '',
    fileContent: null,
    pasteContent: '',
    preview: [],
    parsing: false,
    importing: false,
    importProgress: 0,
    msg: '',
    msgType: ''
  },

  switchMethod(e) {
    this.setData({
      method: e.currentTarget.dataset.method,
      preview: [],
      msg: ''
    })
  },

  // ===== 文件选择 =====
  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xlsx', 'xls', 'csv'],
      success: res => {
        const file = res.tempFiles[0]
        this.setData({ fileName: file.name })

        if (file.name.endsWith('.csv')) {
          // CSV 直接读取
          const fs = wx.getFileSystemManager()
          const content = fs.readFileSync(file.path, 'utf-8')
          this.setData({ fileContent: content, fileParsedAs: 'csv' })
        } else {
          // Excel 上传到云函数解析
          this.setData({ fileContent: file.path, fileParsedAs: 'excel' })
        }
      }
    })
  },

  clearFile() {
    this.setData({ fileName: '', fileContent: null, preview: [] })
  },

  // ===== 解析 =====
  onParse() {
    const { method, fileContent, fileParsedAs, pasteContent } = this.data

    if (method === 'file' && !fileContent) {
      return this.showMsg('请先选择文件', 'err')
    }
    if (method === 'paste' && !pasteContent.trim()) {
      return this.showMsg('请先粘贴内容', 'err')
    }

    this.setData({ parsing: true, preview: [], msg: '' })

    if (method === 'file') {
      if (fileParsedAs === 'csv') {
        // 本地解析 CSV
        try {
          const items = this.parseCSV(fileContent)
          this.setData({ preview: items, parsing: false })
          if (items.length === 0) this.showMsg('未解析到有效数据', 'err')
        } catch (e) {
          this.setData({ parsing: false })
          this.showMsg('CSV 解析失败: ' + e.message, 'err')
        }
      } else {
        // Excel → 云函数解析
        wx.cloud.uploadFile({
          cloudPath: `imports/${Date.now()}.xlsx`,
          filePath: fileContent,
          success: uploadRes => {
            wx.cloud.callFunction({
              name: 'parseExcel',
              data: { fileID: uploadRes.fileID },
              success: res => {
                this.setData({ parsing: false })
                if (res.result.success) {
                  this.setData({ preview: res.result.data })
                  if (res.result.data.length === 0) this.showMsg('未解析到有效数据', 'err')
                } else {
                  this.showMsg(res.result.error || '解析失败', 'err')
                }
              },
              fail: err => {
                this.setData({ parsing: false })
                this.showMsg('云函数调用失败: ' + err.errMsg, 'err')
              }
            })
          },
          fail: err => {
            this.setData({ parsing: false })
            this.showMsg('文件上传失败', 'err')
          }
        })
      }
    } else {
      // 粘贴解析
      try {
        const raw = pasteContent.trim()
        let items = []
        if (raw.startsWith('[') || raw.startsWith('{')) {
          items = JSON.parse(raw)
          if (!Array.isArray(items)) items = [items]
        } else {
          items = this.parseCSV(raw)
        }
        this.setData({ preview: items, parsing: false })
        if (items.length === 0) this.showMsg('未解析到有效数据', 'err')
      } catch (e) {
        this.setData({ parsing: false })
        this.showMsg('解析失败: ' + e.message, 'err')
      }
    }
  },

  // ===== CSV 解析 =====
  parseCSV(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return []

    const headers = this.parseCSVLine(lines[0])
    const idx = {
      name: headers.findIndex(h => /name|名称|标题/i.test(h)),
      url: headers.findIndex(h => /url|链接|地址/i.test(h)),
      cover: headers.findIndex(h => /cover|封面/i.test(h)),
      date: headers.findIndex(h => /date|日期/i.test(h)),
      duration: headers.findIndex(h => /duration|时长/i.test(h)),
      keywords: headers.findIndex(h => /keyword|关键词|标签/i.test(h))
    }

    if (idx.name === -1 || idx.url === -1) {
      throw new Error('CSV 需包含 name 和 url 列')
    }

    return lines.slice(1).map(line => {
      const cols = this.parseCSVLine(line)
      return {
        name: (cols[idx.name] || '').trim(),
        url: (cols[idx.url] || '').trim(),
        cover: idx.cover >= 0 ? (cols[idx.cover] || '').trim() : '',
        date: idx.date >= 0 ? (cols[idx.date] || '').trim() : '',
        duration: idx.duration >= 0 ? (cols[idx.duration] || '').trim() : '',
        keywords: idx.keywords >= 0
          ? (cols[idx.keywords] || '').split(/[,|｜]/).map(s => s.trim()).filter(Boolean)
          : []
      }
    }).filter(v => v.name && v.url)
  },

  parseCSVLine(line) {
    const result = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current)
    return result
  },

  // ===== 确认导入 =====
  onImport() {
    const { preview } = this.data
    if (preview.length === 0) return

    wx.showModal({
      title: '确认导入',
      content: `将导入 ${preview.length} 条视频数据`,
      success: res => {
        if (res.confirm) {
          this.doImport(preview)
        }
      }
    })
  },

  async doImport(items) {
    this.setData({ importing: true, importProgress: 0 })
    const db = wx.cloud.database()
    let success = 0
    let fail = 0

    for (let i = 0; i < items.length; i++) {
      const v = items[i]
      try {
        await db.collection('videos').add({
          data: {
            name: v.name,
            url: v.url,
            cover: v.cover || '',
            date: v.date || '',
            duration: v.duration || '',
            keywords: Array.isArray(v.keywords) ? v.keywords : [],
            createdAt: new Date()
          }
        })
        success++
      } catch (e) {
        console.error('导入失败:', v.name, e)
        fail++
      }
      this.setData({ importProgress: i + 1 })
    }

    this.setData({ importing: false, preview: [] })
    this.showMsg(`✅ 成功 ${success} 条${fail > 0 ? '，失败 ' + fail + ' 条' : ''}`, 'ok')
  },

  onCancel() {
    this.setData({ preview: [] })
  },

  // ===== 复制模板 =====
  copyTemplate() {
    wx.setClipboardData({
      data: 'name,url,cover,date,duration,keywords\n🌊 海浪声示例,https://example.com/video1,https://example.com/cover1.jpg,2026-01-15,1:30:00,海浪|白噪音|助眠'
    })
  },

  onPasteInput(e) {
    this.setData({ pasteContent: e.detail.value })
  },

  showMsg(text, type) {
    this.setData({ msg: text, msgType: 'msg-' + type })
    setTimeout(() => this.setData({ msg: '' }), 4000)
  }
})
