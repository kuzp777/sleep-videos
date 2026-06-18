Page({
  data: {
    form: {
      name: '',
      url: '',
      cover: '',
      date: '',
      duration: '',
      keywords: ''
    },
    isEdit: false,
    editId: '',
    submitting: false,
    msg: '',
    msgType: ''
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ isEdit: true, editId: options.id })
      wx.setNavigationBarTitle({ title: '📝 编辑视频' })
      this.loadVideo(options.id)
    }
  },

  loadVideo(id) {
    wx.cloud.database().collection('videos').doc(id).get().then(res => {
      const v = res.data
      this.setData({
        form: {
          name: v.name || '',
          url: v.url || '',
          cover: v.cover || '',
          date: v.date || '',
          duration: v.duration || '',
          keywords: (v.keywords || []).join(', ')
        }
      })
    })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  onDateChange(e) {
    this.setData({ 'form.date': e.detail.value })
  },

  onSubmit() {
    const { form, isEdit, editId } = this.data

    // 校验
    if (!form.name.trim()) {
      return this.showMsg('请输入视频名称', 'err')
    }
    if (!form.url.trim()) {
      return this.showMsg('请输入视频链接', 'err')
    }

    const video = {
      name: form.name.trim(),
      url: form.url.trim(),
      cover: form.cover.trim(),
      date: form.date || '',
      duration: form.duration.trim(),
      keywords: form.keywords
        .split(/[,，|]/)
        .map(s => s.trim())
        .filter(Boolean)
    }

    this.setData({ submitting: true })

    const db = wx.cloud.database()
    const action = isEdit
      ? db.collection('videos').doc(editId).update({ data: video })
      : db.collection('videos').add({ data: video })

    action.then(() => {
      this.setData({ submitting: false })
      wx.showToast({ title: isEdit ? '已保存' : '已添加', icon: 'success' })
      if (!isEdit) this.onReset()
      setTimeout(() => wx.navigateBack(), 800)
    }).catch(err => {
      this.setData({ submitting: false })
      this.showMsg('操作失败: ' + err.message, 'err')
    })
  },

  onReset() {
    this.setData({
      form: { name: '', url: '', cover: '', date: '', duration: '', keywords: '' },
      msg: ''
    })
  },

  showMsg(text, type) {
    this.setData({ msg: text, msgType: 'msg-' + type })
    setTimeout(() => this.setData({ msg: '' }), 3000)
  }
})
