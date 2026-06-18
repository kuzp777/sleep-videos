/* ===== Sleep Video Collection - Main App ===== */
(function () {
  'use strict';

  // --- State ---
  let allVideos = [];
  let filteredVideos = [];
  let favorites = new Set();
  let activeKeywords = new Set();
  let showFavOnly = false;
  let debounceTimer = null;

  // --- DOM ---
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const searchInput = $('#search-input');
  const btnClear = $('#btn-clear-search');
  const sortSelect = $('#sort-select');
  const kwChips = $('#kw-chips');
  const videoGrid = $('#video-grid');
  const emptyState = $('#empty-state');
  const loading = $('#loading');
  const statsText = $('#stats-text');
  const btnFav = $('#btn-favorites');
  const favCount = $('#fav-count');
  const btnRandom = $('#btn-random');
  const playerModal = $('#player-modal');
  const playerIframe = $('#player-iframe');
  const modalTitle = $('#modal-title');
  const modalMeta = $('#modal-meta');
  const modalKeywords = $('#modal-keywords');
  const modalClose = $('#modal-close');
  const randomModal = $('#random-modal');
  const randomTitle = $('#random-title');
  const randomMeta = $('#random-meta');
  const randomClose = $('#random-close');
  const randomPlay = $('#random-play');
  const randomAnother = $('#random-another');

  // --- Init ---
  async function init() {
    loadFavorites();
    try {
      const resp = await fetch('data/videos.json');
      const data = await resp.json();
      allVideos = (data.videos || []).map(normalizeVideo);
    } catch (e) {
      console.error('Failed to load videos:', e);
      allVideos = [];
    }
    loading.style.display = 'none';
    buildKeywordChips();
    applyFilters();
    bindEvents();
  }

  // --- Normalize ---
  function normalizeVideo(v) {
    return {
      id: v.id || '',
      name: v.name || '未命名',
      url: v.url || '',
      cover: v.cover || '',
      date: v.date || '',
      duration: v.duration || '',
      durationSec: parseDuration(v.duration),
      keywords: Array.isArray(v.keywords) ? v.keywords : [],
    };
  }

  function parseDuration(str) {
    if (!str) return 0;
    const parts = str.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
  }

  // --- Favorites ---
  function loadFavorites() {
    try {
      const stored = JSON.parse(localStorage.getItem('sleep_favs') || '[]');
      favorites = new Set(stored);
    } catch { favorites = new Set(); }
    updateFavBadge();
  }

  function saveFavorites() {
    localStorage.setItem('sleep_favs', JSON.stringify([...favorites]));
    updateFavBadge();
  }

  function toggleFav(id) {
    if (favorites.has(id)) favorites.delete(id);
    else favorites.add(id);
    saveFavorites();
    renderCards();
  }

  function updateFavBadge() {
    const n = favorites.size;
    if (n > 0) {
      favCount.textContent = n;
      favCount.style.display = '';
    } else {
      favCount.style.display = 'none';
    }
    btnFav.classList.toggle('active', showFavOnly);
  }

  // --- Keywords ---
  function buildKeywordChips() {
    const map = {};
    allVideos.forEach(v => {
      v.keywords.forEach(k => { map[k] = (map[k] || 0) + 1; });
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    kwChips.innerHTML = sorted.map(([k, c]) =>
      `<span class="kw-chip" data-kw="${escHtml(k)}">${escHtml(k)} <span class="count">${c}</span></span>`
    ).join('');
    // Bind clicks
    kwChips.querySelectorAll('.kw-chip').forEach(el => {
      el.addEventListener('click', () => {
        const kw = el.dataset.kw;
        if (activeKeywords.has(kw)) {
          activeKeywords.delete(kw);
          el.classList.remove('active');
        } else {
          activeKeywords.add(kw);
          el.classList.add('active');
        }
        applyFilters();
      });
    });
  }

  // --- Filter & Sort ---
  function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();
    filteredVideos = allVideos.filter(v => {
      if (showFavOnly && !favorites.has(v.id)) return false;
      if (activeKeywords.size > 0) {
        const has = [...activeKeywords].some(k => v.keywords.includes(k));
        if (!has) return false;
      }
      if (query) {
        const hay = (v.name + ' ' + v.keywords.join(' ')).toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
    sortVideos();
    renderCards();
  }

  function sortVideos() {
    const mode = sortSelect.value;
    filteredVideos.sort((a, b) => {
      switch (mode) {
        case 'date-desc': return (b.date || '').localeCompare(a.date || '');
        case 'date-asc': return (a.date || '').localeCompare(b.date || '');
        case 'name-asc': return a.name.localeCompare(b.name, 'zh');
        case 'name-desc': return b.name.localeCompare(a.name, 'zh');
        case 'duration-asc': return a.durationSec - b.durationSec;
        case 'duration-desc': return b.durationSec - a.durationSec;
        case 'random': return Math.random() - 0.5;
        default: return 0;
      }
    });
  }

  // --- Render ---
  function renderCards() {
    statsText.textContent = `共 ${allVideos.length} 个视频，当前显示 ${filteredVideos.length} 个`;
    if (filteredVideos.length === 0) {
      videoGrid.innerHTML = '';
      emptyState.style.display = '';
      return;
    }
    emptyState.style.display = 'none';
    videoGrid.innerHTML = filteredVideos.map(v => {
      const isFav = favorites.has(v.id);
      const coverSrc = v.cover || 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect fill="#1a2035" width="320" height="180"/><text x="160" y="100" text-anchor="middle" fill="#3a4160" font-size="48">🌙</text></svg>'
      );
      return `
        <article class="video-card" data-id="${escAttr(v.id)}">
          <button class="card-fav ${isFav ? 'is-fav' : ''}" data-id="${escAttr(v.id)}" title="收藏">
            ${isFav ? '⭐' : '☆'}
          </button>
          <div class="card-cover">
            <img src="${escAttr(coverSrc)}" alt="${escAttr(v.name)}" loading="lazy" onerror="this.style.display='none'">
            ${v.duration ? `<span class="duration-badge">${escHtml(v.duration)}</span>` : ''}
            <div class="play-overlay"><div class="play-icon">▶</div></div>
          </div>
          <div class="card-body">
            <h3 class="card-title">${escHtml(v.name)}</h3>
            <div class="card-meta">
              ${v.date ? `<span>📅 ${escHtml(v.date)}</span>` : ''}
              ${v.duration ? `<span>⏱ ${escHtml(v.duration)}</span>` : ''}
            </div>
            <div class="card-keywords">
              ${v.keywords.map(k => `<span class="tag">${escHtml(k)}</span>`).join('')}
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  // --- Events ---
  function bindEvents() {
    // Search
    searchInput.addEventListener('input', () => {
      btnClear.style.display = searchInput.value ? '' : 'none';
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(applyFilters, 200);
    });
    btnClear.addEventListener('click', () => {
      searchInput.value = '';
      btnClear.style.display = 'none';
      applyFilters();
    });

    // Sort
    sortSelect.addEventListener('change', applyFilters);

    // Favorites toggle
    btnFav.addEventListener('click', () => {
      showFavOnly = !showFavOnly;
      applyFilters();
    });

    // Random
    btnRandom.addEventListener('click', showRandom);
    randomAnother.addEventListener('click', showRandom);
    randomPlay.addEventListener('click', () => {
      const id = randomPlay.dataset.id;
      if (id) openPlayer(id);
      randomModal.classList.remove('active');
    });

    // Card click (delegate)
    videoGrid.addEventListener('click', (e) => {
      const favBtn = e.target.closest('.card-fav');
      if (favBtn) {
        e.stopPropagation();
        toggleFav(favBtn.dataset.id);
        return;
      }
      const card = e.target.closest('.video-card');
      if (card) openPlayer(card.dataset.id);
    });

    // Modal close
    modalClose.addEventListener('click', closePlayer);
    randomClose.addEventListener('click', () => randomModal.classList.remove('active'));
    [playerModal, randomModal].forEach(m => {
      m.addEventListener('click', (e) => {
        if (e.target === m) {
          m.classList.remove('active');
          if (m === playerModal) closePlayer();
        }
      });
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closePlayer();
        randomModal.classList.remove('active');
      }
    });
  }

  // --- Player ---
  function openPlayer(id) {
    const v = allVideos.find(x => x.id === id);
    if (!v) return;
    playerIframe.src = v.url;
    modalTitle.textContent = v.name;
    modalMeta.innerHTML = [
      v.date ? `<span>📅 ${escHtml(v.date)}</span>` : '',
      v.duration ? `<span>⏱ ${escHtml(v.duration)}</span>` : '',
    ].filter(Boolean).join('');
    modalKeywords.innerHTML = v.keywords.map(k =>
      `<span class="tag">${escHtml(k)}</span>`
    ).join('');
    playerModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closePlayer() {
    playerModal.classList.remove('active');
    playerIframe.src = '';
    document.body.style.overflow = '';
  }

  // --- Random ---
  function showRandom() {
    const pool = filteredVideos.length > 0 ? filteredVideos : allVideos;
    if (pool.length === 0) return;
    const v = pool[Math.floor(Math.random() * pool.length)];
    randomTitle.textContent = v.name;
    randomMeta.textContent = [
      v.date ? `📅 ${v.date}` : '',
      v.duration ? `⏱ ${v.duration}` : '',
      v.keywords.length > 0 ? `🏷 ${v.keywords.join(', ')}` : '',
    ].filter(Boolean).join('  ·  ');
    randomPlay.dataset.id = v.id;
    randomModal.classList.add('active');
  }

  // --- Utils ---
  function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
  function escAttr(s) {
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // --- Start ---
  init();
})();
