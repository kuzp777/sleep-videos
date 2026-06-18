/* ===== Sleep Video Collection - Admin Panel ===== */
(function () {
  'use strict';

  // --- State ---
  let videos = [];
  let pendingImport = [];

  // --- DOM ---
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // Tabs
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b => b.classList.remove('active'));
      $$('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $(`#tab-${btn.dataset.tab}`).classList.add('active');
      if (btn.dataset.tab === 'manage') renderManageList();
      if (btn.dataset.tab === 'export') renderExport();
    });
  });

  // --- Load existing data ---
  async function loadData() {
    try {
      const resp = await fetch('data/videos.json');
      const data = await resp.json();
      videos = (data.videos || []).map(normalizeVideo);
    } catch { videos = []; }
  }

  function normalizeVideo(v, idx) {
    return {
      id: v.id || genId(),
      name: v.name || '未命名',
      url: v.url || '',
      cover: v.cover || '',
      date: v.date || '',
      duration: v.duration || '',
      keywords: Array.isArray(v.keywords) ? v.keywords : (typeof v.keywords === 'string' ? v.keywords.split(/[,|]/).map(s => s.trim()).filter(Boolean) : []),
    };
  }

  function genId() {
    return 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  }

  // --- Save to localStorage (working copy) ---
  function saveLocal() {
    localStorage.setItem('sleep_admin_videos', JSON.stringify(videos));
  }
  function loadLocal() {
    try {
      const stored = JSON.parse(localStorage.getItem('sleep_admin_videos'));
      if (Array.isArray(stored) && stored.length > 0) return stored;
    } catch {}
    return null;
  }

  // --- Init ---
  async function init() {
    const local = loadLocal();
    if (local) {
      videos = local;
    } else {
      await loadData();
      saveLocal();
    }
    bindAddForm();
    bindBulkImport();
    bindManage();
    bindExport();
  }

  // ===========================
  // Tab 1: Add Single Video
  // ===========================
  function bindAddForm() {
    $('#btn-add-single').addEventListener('click', addSingle);
    $('#btn-add-clear').addEventListener('click', () => {
      ['#add-name','#add-url','#add-cover','#add-date','#add-duration','#add-keywords'].forEach(s => $(s).value = '');
      showMsg('#add-msg', '', '');
    });
  }

  function addSingle() {
    const name = $('#add-name').value.trim();
    const url = $('#add-url').value.trim();
    if (!name) return showMsg('#add-msg', '请输入视频名称', 'err');
    if (!url) return showMsg('#add-msg', '请输入视频链接', 'err');

    const video = {
      id: genId(),
      name,
      url,
      cover: $('#add-cover').value.trim(),
      date: $('#add-date').value || '',
      duration: $('#add-duration').value.trim(),
      keywords: $('#add-keywords').value.split(/[,|，]/).map(s => s.trim()).filter(Boolean),
    };
    videos.push(video);
    saveLocal();
    showMsg('#add-msg', `✅ 已添加：${name}`, 'ok');
    // Clear form
    ['#add-name','#add-url','#add-cover','#add-duration','#add-keywords'].forEach(s => $(s).value = '');
    $('#add-date').value = '';
  }

  // ===========================
  // Tab 2: Bulk Import
  // ===========================
  function bindBulkImport() {
    const dropZone = $('#drop-zone');
    const fileInput = $('#file-input');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) readFile(file);
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) readFile(e.target.files[0]);
    });

    $('#btn-parse').addEventListener('click', parseBulkInput);
    $('#btn-bulk-clear').addEventListener('click', () => {
      $('#bulk-input').value = '';
      $('#preview-area').style.display = 'none';
      showMsg('#bulk-msg', '', '');
    });
    $('#btn-import').addEventListener('click', confirmImport);
    $('#btn-cancel-import').addEventListener('click', () => {
      pendingImport = [];
      $('#preview-area').style.display = 'none';
    });
    $('#btn-copy-template').addEventListener('click', () => {
      navigator.clipboard.writeText($('#csv-template').value).then(() => {
        showMsg('#bulk-msg', '📋 已复制到剪贴板', 'ok');
      });
    });
  }

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      $('#bulk-input').value = e.target.result;
      showMsg('#bulk-msg', `📂 已加载文件：${file.name}`, 'info');
    };
    reader.readAsText(file);
  }

  function parseBulkInput() {
    const raw = $('#bulk-input').value.trim();
    if (!raw) return showMsg('#bulk-msg', '请输入或上传数据', 'err');

    let items = [];
    try {
      // Try JSON first
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        items = parsed;
      } else {
        return showMsg('#bulk-msg', 'JSON 需为数组格式', 'err');
      }
    } catch {
      // Try CSV
      items = parseCSV(raw);
    }

    if (items.length === 0) return showMsg('#bulk-msg', '未解析到有效数据', 'err');

    pendingImport = items.map(normalizeVideo);
    renderPreview();
    showMsg('#bulk-msg', `✅ 解析成功，共 ${pendingImport.length} 条`, 'ok');
  }

  function parseCSV(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]);
    const nameIdx = headers.findIndex(h => /name|名称|标题/i.test(h));
    const urlIdx = headers.findIndex(h => /url|链接|地址/i.test(h));
    const coverIdx = headers.findIndex(h => /cover|封面/i.test(h));
    const dateIdx = headers.findIndex(h => /date|日期/i.test(h));
    const durIdx = headers.findIndex(h => /duration|时长/i.test(h));
    const kwIdx = headers.findIndex(h => /keyword|关键词|标签/i.test(h));

    if (nameIdx === -1 || urlIdx === -1) return [];

    return lines.slice(1).map(line => {
      const cols = parseCSVLine(line);
      return {
        name: cols[nameIdx] || '',
        url: cols[urlIdx] || '',
        cover: coverIdx >= 0 ? cols[coverIdx] : '',
        date: dateIdx >= 0 ? cols[dateIdx] : '',
        duration: durIdx >= 0 ? cols[durIdx] : '',
        keywords: kwIdx >= 0 ? (cols[kwIdx] || '').split(/[,|｜]/).map(s => s.trim()).filter(Boolean) : [],
      };
    }).filter(v => v.name && v.url);
  }

  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  function renderPreview() {
    const tbody = $('#preview-body');
    $('#preview-count').textContent = pendingImport.length;
    tbody.innerHTML = pendingImport.map(v => `
      <tr>
        <td title="${escAttr(v.name)}">${escHtml(v.name)}</td>
        <td title="${escAttr(v.url)}">${escHtml(truncate(v.url, 40))}</td>
        <td>${escHtml(v.date)}</td>
        <td>${escHtml(v.duration)}</td>
        <td>${v.keywords.map(k => `<span class="tag">${escHtml(k)}</span>`).join('')}</td>
      </tr>
    `).join('');
    $('#preview-area').style.display = '';
  }

  function confirmImport() {
    if (pendingImport.length === 0) return;
    videos.push(...pendingImport);
    saveLocal();
    const count = pendingImport.length;
    pendingImport = [];
    $('#preview-area').style.display = 'none';
    $('#bulk-input').value = '';
    showMsg('#bulk-msg', `✅ 成功导入 ${count} 条视频`, 'ok');
  }

  // ===========================
  // Tab 3: Manage
  // ===========================
  function bindManage() {
    $('#btn-clear-all').addEventListener('click', () => {
      if (confirm('确定清空全部数据？此操作不可撤销。')) {
        videos = [];
        saveLocal();
        renderManageList();
      }
    });
    $('#manage-search').addEventListener('input', renderManageList);
  }

  function renderManageList() {
    const query = ($('#manage-search').value || '').toLowerCase();
    const filtered = query ? videos.filter(v =>
      (v.name + ' ' + v.keywords.join(' ')).toLowerCase().includes(query)
    ) : videos;

    $('#data-count').textContent = videos.length;
    const list = $('#data-list');

    if (filtered.length === 0) {
      list.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">暂无数据</div>';
      return;
    }

    list.innerHTML = filtered.map(v => {
      const coverSrc = v.cover || '';
      return `
        <div class="data-item" data-id="${escAttr(v.id)}">
          ${coverSrc ? `<img class="thumb" src="${escAttr(coverSrc)}" onerror="this.style.display='none'">` : '<div class="thumb"></div>'}
          <div class="info">
            <div class="name">${escHtml(v.name)}</div>
            <div class="meta">${escHtml(v.date || '')} · ${escHtml(v.duration || '')} · ${v.keywords.map(k => '#'+k).join(' ')}</div>
          </div>
          <button class="del-btn" data-id="${escAttr(v.id)}" title="删除">🗑️</button>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id;
        const v = videos.find(x => x.id === id);
        if (v && confirm(`删除「${v.name}」？`)) {
          videos = videos.filter(x => x.id !== id);
          saveLocal();
          renderManageList();
        }
      });
    });
  }

  // ===========================
  // Tab 4: Export
  // ===========================
  function bindExport() {
    $('#btn-export-json').addEventListener('click', () => {
      const json = buildJSON();
      downloadFile('videos.json', json, 'application/json');
      showMsg('#export-msg', '✅ 已下载 videos.json', 'ok');
    });
    $('#btn-export-csv').addEventListener('click', () => {
      const csv = buildCSV();
      downloadFile('videos.csv', csv, 'text/csv');
      showMsg('#export-msg', '✅ 已下载 videos.csv', 'ok');
    });
    $('#btn-copy-json').addEventListener('click', () => {
      const json = buildJSON();
      navigator.clipboard.writeText(json).then(() => {
        showMsg('#export-msg', '📋 已复制 JSON 到剪贴板', 'ok');
      });
    });
  }

  function renderExport() {
    $('#json-preview').value = buildJSON();
  }

  function buildJSON() {
    const data = {
      meta: {
        version: '1.0.0',
        lastUpdated: new Date().toISOString().split('T')[0],
        totalVideos: videos.length,
        categories: [...new Set(videos.flatMap(v => v.keywords))].sort(),
      },
      videos: videos,
    };
    return JSON.stringify(data, null, 2);
  }

  function buildCSV() {
    const header = 'name,url,cover,date,duration,keywords';
    const rows = videos.map(v => {
      return [
        csvEscape(v.name),
        csvEscape(v.url),
        csvEscape(v.cover),
        csvEscape(v.date),
        csvEscape(v.duration),
        csvEscape(v.keywords.join('|')),
      ].join(',');
    });
    return [header, ...rows].join('\n');
  }

  function csvEscape(s) {
    if (!s) return '';
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ===========================
  // Utils
  // ===========================
  function showMsg(selector, text, type) {
    const el = $(selector);
    if (!text) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="msg msg-${type}">${text}</div>`;
  }

  function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function escAttr(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function truncate(s, len) {
    return s && s.length > len ? s.substring(0, len) + '…' : s;
  }

  // --- Start ---
  init();
})();
