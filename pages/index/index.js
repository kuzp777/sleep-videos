Page({
  data: {
    videos: [],
    totalCount: 0,
    searchText: '',
    loading: true
  },

  onShow() {
    this.loadVideos()
  },

  loadVideos() {
    this.setData({ loading: true })
    const db = wx.cloud.database()
    const _ = db.command

    // 获取总数
    db.collection('videos').count().then(res => {
      this.setData({ totalCount: res.total })
    })

    // 分批获取所有数据（云开发单次最多20条）
    this.getAllVideos().then(all => {
      this._allVideos = all
      this.filterAndSort()
      this.setData({ loading: false })
    }).catch(err => {
      console.error('加载失败:', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'error' })
    })
  },

  async getAllVideos() {
    const db = wx.cloud.database()
    const countRes = await db.collection('videos').count()
    const total = countRes.total
    const batchSize = 20
    const tasks = []

    for (let i = 0; i < total; i += batchSize) {
      tasks.push(
        db.collection('videos')
          .orderBy('date', 'desc')
          .skip(i)
          .limit(batchSize)
          .get()
          .then(res => res.data)
      )
    }

    const results = await Promise.all(tasks)
    return results.flat()
  },

  filterAndSort() {
    let list = this._allVideos || []
    const q = this.data.searchText.toLowerCase().trim()

    if (q) {
      list = list.filter(v => {
        const hay = (v.name + ' ' + (v.keywords || []).join(' ')).toLowerCase()
        return hay.includes(q)
      })
    }

    this.setData({ videos: list })
  },

  onSearch(e) {
    this.setData({ searchText: e.detail.value })
    this.filterAndSort()
  },

  clearSearch() {
    this.setData({ searchText: '' })
    this.filterAndSort()
  },

  onTapVideo(e) {
    const id = e.currentTarget.dataset.id
    const v = this._allVideos.find(x => x._id === id)
    if (!v) return

    wx.showActionSheet({
      itemList: ['📋 复制链接', '📝 编辑', '🗑️ 删除'],
      success: res => {
        if (res.tapIndex === 0) {
          wx.setClipboardData({ data: v.url })
        } else if (res.tapIndex === 1) {
          wx.navigateTo({ url: `/pages/add/add?id=${id}` })
        } else if (res.tapIndex === 2) {
          this.doDelete(id, v.name)
        }
      }
    })
  },

  onDelete(e) {
    const { id, name } = e.currentTarget.dataset
    this.doDelete(id, name)
  },

  doDelete(id, name) {
    wx.showModal({
      title: '确认删除',
      content: `删除「${name}」？`,
      confirmColor: '#e04040',
      success: res => {
        if (res.confirm) {
          wx.cloud.database().collection('videos').doc(id).remove().then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadVideos()
          })
        }
      }
    })
  },

  onSync() {
    wx.showModal({
      title: '同步到网站',
      content: '将所有视频数据同步到 GitHub Pages 网站',
      success: res => {
        if (res.confirm) {
          wx.showLoading({ title: '同步中…' })
          wx.cloud.callFunction({
            name: 'syncToGithub',
            success: res => {
              wx.hideLoading()
              if (res.result.success) {
                wx.showToast({ title: `已同步 ${res.result.count} 条`, icon: 'success' })
              } else {
                wx.showModal({
                  title: '同步失败',
                  content: res.result.error,
                  showCancel: false
                })
              }
            },
            fail: err => {
              wx.hideLoading()
              wx.showModal({
                title: '同步失败',
                content: err.errMsg,
                showCancel: false
              })
            }
          })
        }
      }
    })
  }
})
