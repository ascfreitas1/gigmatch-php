// GigMatch Frontend App
const API = '/api'
let currentUser = null
let currentProfile = null
let authToken = localStorage.getItem('gm_token')
let currentBookingsFilter = ''
let searchDebounceTimer = null
let perfPage = 1
let eventPage = 1

// =====================
// UTILITY FUNCTIONS
// =====================
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast')
  t.textContent = msg
  t.className = `toast ${type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-yellow-600'}`
  t.classList.remove('hidden')
  setTimeout(() => t.classList.add('hidden'), 4000)
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.getElementById(id)?.classList.add('active')
  window.scrollTo(0, 0)
}

function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'))
  document.getElementById(id)?.classList.add('active')
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'))
  document.querySelector(`[data-section="${id}"]`)?.classList.add('active')
  
  // Load section data
  if (id === 'dashboard-section') loadDashboard()
  else if (id === 'performers-section') { loadMeta(); loadPerformers() }
  else if (id === 'events-section') { loadEventMeta(); loadEvents() }
  else if (id === 'bookings-section') loadBookings()
  else if (id === 'profile-section') loadProfile()
  else if (id === 'messages-section') loadConversations()
  else if (id === 'notifications-section') loadNotifications()
  else if (id === 'admin-section') loadAdminStats()
  else if (id === 'social-section') loadSocialSection()
}

function openModal(id) { document.getElementById(id)?.classList.add('open') }
function closeModal(id) { document.getElementById(id)?.classList.remove('open') }

function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open')
}

async function apiCall(method, path, data = null) {
  const config = {
    method,
    url: API + path,
    headers: { 'Content-Type': 'application/json' }
  }
  if (authToken) config.headers['Authorization'] = `Bearer ${authToken}`
  if (data) config.data = data
  try {
    const res = await axios(config)
    return { ok: true, data: res.data }
  } catch (err) {
    const msg = err.response?.data?.error || err.message || 'Network error'
    return { ok: false, error: msg }
  }
}

function stars(rating, max = 5) {
  let html = ''
  for (let i = 1; i <= max; i++) {
    html += `<i class="fas fa-star ${i <= Math.round(rating) ? 'star' : 'star empty'}"></i>`
  }
  return html
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const isPt = currentLang === 'pt'
  if (mins < 1) return isPt ? 'agora mesmo' : 'just now'
  if (mins < 60) return isPt ? `${mins}min atrás` : `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return isPt ? `${hrs}h atrás` : `${hrs}h ago`
  return isPt ? `${Math.floor(hrs/24)}d atrás` : `${Math.floor(hrs/24)}d ago`
}

function statusBadge(status) {
  const map = {
    pending:   ['yellow',  currentLang==='pt'?'Pendente':'Pending'],
    accepted:  ['blue',    currentLang==='pt'?'Aceito':'Accepted'],
    rejected:  ['red',     currentLang==='pt'?'Rejeitado':'Rejected'],
    escrow:    ['purple',  currentLang==='pt'?'Em Custódia':'In Escrow'],
    completed: ['green',   currentLang==='pt'?'Concluído':'Completed'],
    disputed:  ['red',     currentLang==='pt'?'Em Disputa':'Disputed'],
    refunded:  ['yellow',  currentLang==='pt'?'Reembolsado':'Refunded'],
    cancelled: ['red',     currentLang==='pt'?'Cancelado':'Cancelled'],
    paid:      ['blue',    currentLang==='pt'?'Pago':'Paid'],
    open:      ['green',   currentLang==='pt'?'Aberto':'Open'],
    filled:    ['blue',    currentLang==='pt'?'Preenchido':'Filled'],
    performer: ['purple',  currentLang==='pt'?'Artista':'Performer'],
    host:      ['yellow',  currentLang==='pt'?'Contratante':'Host'],
    admin:     ['red',     'Admin'],
  }
  const [color, label] = map[status] || ['yellow', status]
  return `<span class="badge badge-${color}">${label}</span>`
}

function debounceSearch(type) {
  clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    if (type === 'performers') loadPerformers()
    else if (type === 'events') loadEvents()
  }, 400)
}

// =====================
// AUTH
// =====================
function showRegisterAs(role) {
  showPage('register-page')
  selectRole(role)
}

function selectRole(role) {
  document.getElementById('reg-role').value = role
  const pBtn = document.getElementById('role-performer-btn')
  const hBtn = document.getElementById('role-host-btn')
  if (role === 'performer') {
    pBtn.style.borderColor = '#7C3AED'; pBtn.style.background = 'rgba(124,58,237,0.2)'
    hBtn.style.borderColor = 'rgba(255,255,255,0.1)'; hBtn.style.background = 'rgba(255,255,255,0.03)'
  } else {
    hBtn.style.borderColor = '#F59E0B'; hBtn.style.background = 'rgba(245,158,11,0.2)'
    pBtn.style.borderColor = 'rgba(255,255,255,0.1)'; pBtn.style.background = 'rgba(255,255,255,0.03)'
  }
}

async function handleLogin(e) {
  e.preventDefault()
  const email = document.getElementById('login-email').value
  const password = document.getElementById('login-password').value
  const errEl = document.getElementById('login-error')
  
  const res = await apiCall('POST', '/auth/login', { email, password })
  if (!res.ok) {
    errEl.textContent = res.error; errEl.classList.remove('hidden'); return
  }
  
  authToken = res.data.token
  localStorage.setItem('gm_token', authToken)
  currentUser = res.data.user
  currentProfile = res.data.profile
  errEl.classList.add('hidden')
  initApp()
}

async function demoLogin(role) {
  const demos = {
    performer: { email: 'performer@demo.com', password: 'Demo@1234' },
    host: { email: 'host@demo.com', password: 'Demo@1234' },
    admin: { email: 'admin@gigmatch.com', password: 'Admin@123!' }
  }
  
  // Try to register demo accounts first
  if (role !== 'admin') {
    const demo = demos[role]
    await apiCall('POST', '/auth/register', {
      email: demo.email, password: demo.password,
      name: role === 'performer' ? 'Demo Performer' : 'Demo Host',
      role, city: 'New York', country: 'USA', latitude: 40.7128, longitude: -74.0060
    })
  }
  
  document.getElementById('login-email').value = demos[role].email
  document.getElementById('login-password').value = demos[role].password
  
  const res = await apiCall('POST', '/auth/login', demos[role])
  if (!res.ok) { showToast(res.error, 'error'); return }
  
  authToken = res.data.token
  localStorage.setItem('gm_token', authToken)
  currentUser = res.data.user
  currentProfile = res.data.profile
  initApp()
}

async function handleRegister(e) {
  e.preventDefault()
  const errEl = document.getElementById('reg-error')
  const successEl = document.getElementById('reg-success')
  
  const data = {
    email: document.getElementById('reg-email').value,
    password: document.getElementById('reg-password').value,
    name: document.getElementById('reg-name').value,
    phone: document.getElementById('reg-phone').value,
    city: document.getElementById('reg-city').value,
    country: document.getElementById('reg-country').value,
    role: document.getElementById('reg-role').value
  }
  
  const res = await apiCall('POST', '/auth/register', data)
  if (!res.ok) {
    errEl.textContent = res.error; errEl.classList.remove('hidden')
    successEl.classList.add('hidden'); return
  }
  
  authToken = res.data.token
  localStorage.setItem('gm_token', authToken)
  currentUser = res.data.user
  currentProfile = res.data.profile
  successEl.textContent = 'Account created! Redirecting...'
  successEl.classList.remove('hidden')
  errEl.classList.add('hidden')
  setTimeout(initApp, 1000)
}

function handleLogout() {
  authToken = null; currentUser = null; currentProfile = null
  localStorage.removeItem('gm_token')
  showPage('landing-page')
  showToast('Signed out successfully')
}

// =====================
// APP INIT
// =====================
async function initApp() {
  if (!authToken) { showPage('landing-page'); return }
  
  const res = await apiCall('GET', '/users/me')
  if (!res.ok) { handleLogout(); return }
  
  currentUser = res.data.user
  currentProfile = res.data.profile
  
  setupSidebar()
  showPage('app-page')
  showSection('dashboard-section')
  loadNotifCount()
  setInterval(loadNotifCount, 30000)
}

function setupSidebar() {
  const user = currentUser
  const avatarEl = document.getElementById('sidebar-avatar')
  const nameEl = document.getElementById('sidebar-name')
  const roleEl = document.getElementById('sidebar-role-badge')
  
  nameEl.textContent = user.name
  avatarEl.textContent = user.name.charAt(0).toUpperCase()
  if (user.avatar_url) {
    avatarEl.innerHTML = `<img src="${user.avatar_url}" class="w-full h-full rounded-full object-cover">`
  }
  
  const roleColors = { performer: 'badge-purple', host: 'badge-yellow', admin: 'badge-red' }
  const roleIcons  = { performer: '🎸', host: '🎪', admin: '⚡' }
  const oauthIcon  = user.oauth_provider === 'google' ? '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style="width:10px;height:10px;"> Google'
                   : user.oauth_provider === 'facebook' ? '<i class="fab fa-facebook-f" style="color:#1877F2;font-size:9px;"></i> Facebook'
                   : ''
  roleEl.innerHTML = `
    <span class="badge ${roleColors[user.role] || 'badge-blue'} text-xs">${roleIcons[user.role] || ''} ${user.role}</span>
    ${oauthIcon ? `<span class="oauth-badge text-xs ml-1" style="background:rgba(255,255,255,.08);color:#94A3B8;">${oauthIcon}</span>` : ''}
  `
  
  const links = getNavLinks(user.role)
  const navEl = document.getElementById('nav-links')
  navEl.innerHTML = links.map(l => `
    <button onclick="showSection('${l.section}')" data-section="${l.section}"
      class="nav-link w-full text-left flex items-center gap-3">
      <i class="${l.icon} w-5"></i> ${l.label}
      ${l.badge ? `<span id="${l.badge}" class="ml-auto badge badge-red text-xs hidden">0</span>` : ''}
    </button>
  `).join('')
  
  // Show create event button for hosts
  if (user.role === 'host') {
    document.getElementById('create-event-btn')?.classList.remove('hidden')
  }
}

function getNavLinks(role) {
  const base = [
    { section: 'dashboard-section',       icon: 'fas fa-home',       label: t('dashboard') },
    { section: 'performers-section',       icon: 'fas fa-music',      label: t('find_performers') },
    { section: 'events-section',           icon: 'fas fa-calendar',   label: t('browse_events') },
    { section: 'bookings-section',         icon: 'fas fa-handshake',  label: t('my_bookings') },
    { section: 'messages-section',         icon: 'fas fa-comments',   label: t('messages'), badge: 'msg-badge' },
    { section: 'notifications-section',    icon: 'fas fa-bell',       label: t('notifications'), badge: 'notif-badge' },
    { section: 'profile-section',          icon: 'fas fa-user',       label: t('my_profile') },
  ]
  if (role === 'performer') {
    base.push({ section: 'social-section', icon: 'fas fa-share-alt', label: t('platform_score') })
  }
  if (role === 'admin') {
    base.push({ section: 'admin-section', icon: 'fas fa-shield-alt', label: t('admin_panel') })
  }
  return base
}

// =====================
// DASHBOARD
// =====================
async function loadDashboard() {
  const isPt = currentLang === 'pt'
  document.getElementById('welcome-message').textContent =
    isPt ? `Bem-vindo de volta, ${currentUser?.name || ''}! 👋` : `Welcome back, ${currentUser?.name || ''}! 👋`
  await Promise.all([loadDashboardStats(), loadDashboardActivity(), loadDashboardNotifications()])
}

async function loadDashboardStats() {
  const statsEl = document.getElementById('dashboard-stats')
  
  if (currentUser?.role === 'admin') {
    const res = await apiCall('GET', '/admin/stats')
    if (!res.ok) return
    const s = res.data
    statsEl.innerHTML = `
      <div class="card text-center"><div class="text-3xl font-black text-purple-400">${s.users}</div><div class="text-slate-400 text-sm mt-1">Total Users</div></div>
      <div class="card text-center"><div class="text-3xl font-black text-blue-400">${s.bookings}</div><div class="text-slate-400 text-sm mt-1">Bookings</div></div>
      <div class="card text-center"><div class="text-3xl font-black text-green-400">$${s.revenue.toFixed(0)}</div><div class="text-slate-400 text-sm mt-1">Platform Revenue</div></div>
      <div class="card text-center"><div class="text-3xl font-black text-red-400">${s.open_disputes}</div><div class="text-slate-400 text-sm mt-1">Open Disputes</div></div>
    `
  } else if (currentUser?.role === 'performer') {
    const res = await apiCall('GET', '/bookings/my')
    if (!res.ok) return
    const bookings = res.data.items || []
    const completed = bookings.filter(b => b.status === 'completed').length
    const inEscrow = bookings.filter(b => b.status === 'escrow').length
    const earned = bookings.filter(b => b.status === 'completed' && b.escrow_released).reduce((s, b) => s + b.performer_payout, 0)
    statsEl.innerHTML = `
      <div class="card text-center"><div class="text-3xl font-black text-purple-400">${currentProfile?.platform_score || 0}</div><div class="text-slate-400 text-sm mt-1">Platform Score</div></div>
      <div class="card text-center"><div class="text-3xl font-black text-yellow-400">${currentProfile?.avg_rating?.toFixed(1) || '—'}</div><div class="text-slate-400 text-sm mt-1">Avg Rating</div></div>
      <div class="card text-center"><div class="text-3xl font-black text-blue-400">${inEscrow}</div><div class="text-slate-400 text-sm mt-1">Active Gigs</div></div>
      <div class="card text-center"><div class="text-3xl font-black text-green-400">$${earned.toFixed(0)}</div><div class="text-slate-400 text-sm mt-1">Total Earned</div></div>
    `
  } else if (currentUser?.role === 'host') {
    const res = await apiCall('GET', '/events/host/my-events')
    if (!res.ok) return
    const evts = res.data || []
    const open = evts.filter(e => e.status === 'open').length
    const completed = evts.filter(e => e.status === 'completed').length
    statsEl.innerHTML = `
      <div class="card text-center"><div class="text-3xl font-black text-purple-400">${evts.length}</div><div class="text-slate-400 text-sm mt-1">Total Events</div></div>
      <div class="card text-center"><div class="text-3xl font-black text-green-400">${open}</div><div class="text-slate-400 text-sm mt-1">Open Events</div></div>
      <div class="card text-center"><div class="text-3xl font-black text-blue-400">${completed}</div><div class="text-slate-400 text-sm mt-1">Completed</div></div>
      <div class="card text-center"><div class="text-3xl font-black text-yellow-400">${currentProfile?.avg_rating?.toFixed(1) || '—'}</div><div class="text-slate-400 text-sm mt-1">Rating</div></div>
    `
  }
}

async function loadDashboardActivity() {
  const el = document.getElementById('dashboard-activity')
  const res = await apiCall('GET', '/bookings/my?limit=5')
  if (!res.ok) { el.innerHTML = '<p class="text-slate-400 text-sm">No activity yet</p>'; return }
  const items = res.data.items || []
  if (!items.length) { el.innerHTML = '<p class="text-slate-400 text-sm">No bookings yet</p>'; return }
  el.innerHTML = items.map(b => `
    <div class="card cursor-pointer hover:border-purple-500" onclick="showBookingDetail('${b.id}')">
      <div class="flex items-center gap-3">
        <div class="text-2xl">${bookingIcon(b.status)}</div>
        <div class="flex-1 min-w-0">
          <div class="text-white font-medium text-sm truncate">${b.event_title || b.act_name || 'Booking'}</div>
          <div class="text-slate-400 text-xs">${timeAgo(b.created_at)}</div>
        </div>
        ${statusBadge(b.status)}
      </div>
    </div>
  `).join('')
}

async function loadDashboardNotifications() {
  const el = document.getElementById('dashboard-notifications')
  const res = await apiCall('GET', '/notifications?limit=5&unread_only=true')
  if (!res.ok) { el.innerHTML = ''; return }
  const items = res.data.items || []
  if (!items.length) { el.innerHTML = '<p class="text-slate-400 text-sm">No new notifications</p>'; return }
  el.innerHTML = items.map(n => `
    <div class="card cursor-pointer" onclick="markRead('${n.id}')">
      <div class="flex gap-3">
        <div class="text-xl">${notifIcon(n.type)}</div>
        <div>
          <div class="text-white text-sm font-medium">${n.title}</div>
          <div class="text-slate-400 text-xs mt-1">${n.message}</div>
          <div class="text-slate-500 text-xs mt-1">${timeAgo(n.created_at)}</div>
        </div>
      </div>
    </div>
  `).join('')
}

function bookingIcon(status) {
  const map = { pending: '⏳', accepted: '✅', escrow: '💰', completed: '🎉', disputed: '⚠️', rejected: '❌' }
  return map[status] || '📋'
}

function notifIcon(type) {
  const map = { new_event: '🎵', booking_request: '🎸', booking_accepted: '✅', booking_rejected: '❌',
    payment_escrowed: '💰', payment_released: '💸', rate_event: '⭐', new_dispute: '⚠️', dispute_resolved: '⚖️', event_cancelled: '🚫' }
  return map[type] || '🔔'
}

// =====================
// NOTIFICATIONS
// =====================
async function loadNotifCount() {
  const res = await apiCall('GET', '/notifications?limit=1')
  if (res.ok) {
    const count = res.data.unread_count || 0
    const badges = ['notif-badge']
    badges.forEach(id => {
      const el = document.getElementById(id)
      if (el) { el.textContent = count; el.classList.toggle('hidden', count === 0) }
    })
    const dot = document.getElementById('notif-dot-mobile')
    if (dot) dot.classList.toggle('hidden', count === 0)
  }
}

async function loadNotifications() {
  const el = document.getElementById('notifications-list')
  const res = await apiCall('GET', '/notifications?limit=50')
  if (!res.ok) { el.innerHTML = `<p class="text-red-400">${res.error}</p>`; return }
  const items = res.data.items || []
  if (!items.length) { el.innerHTML = '<div class="text-center text-slate-400 py-10">No notifications</div>'; return }
  el.innerHTML = items.map(n => `
    <div class="card ${!n.is_read ? 'border-purple-500/30' : ''}" id="notif-${n.id}">
      <div class="flex gap-4 items-start">
        <div class="text-2xl">${notifIcon(n.type)}</div>
        <div class="flex-1">
          <div class="flex items-start justify-between gap-2">
            <div class="text-white font-semibold">${n.title}</div>
            <div class="text-slate-500 text-xs whitespace-nowrap">${timeAgo(n.created_at)}</div>
          </div>
          <p class="text-slate-300 text-sm mt-1">${n.message}</p>
          ${n.data?.booking_id ? `<button onclick="showBookingDetail('${n.data.booking_id}')" class="text-purple-400 text-xs mt-2 hover:underline">View Booking →</button>` : ''}
        </div>
        ${!n.is_read ? `<button onclick="markRead('${n.id}')" class="text-slate-400 hover:text-white text-xs">✓</button>` : ''}
      </div>
    </div>
  `).join('')
}

async function markRead(id) {
  await apiCall('PUT', `/notifications/${id}/read`)
  document.getElementById(`notif-${id}`)?.querySelector('.border-purple-500\\/30')?.classList.remove('border-purple-500/30')
  loadNotifCount()
}

async function markAllRead() {
  await apiCall('PUT', '/notifications/read/all')
  loadNotifications(); loadNotifCount()
  showToast('All notifications marked as read')
}

// =====================
// PERFORMERS
// =====================
let actTypes = [], genres = []

async function loadMeta() {
  const res = await apiCall('GET', '/performers/meta/act-types')
  if (!res.ok) return
  actTypes = res.data.actTypes || []
  genres = res.data.genres || []
  
  const actFilter = document.getElementById('perf-act-filter')
  actTypes.forEach(t => actFilter.innerHTML += `<option value="${t}">${t}</option>`)
  
  const genreFilter = document.getElementById('perf-genre-filter')
  genres.forEach(g => genreFilter.innerHTML += `<option value="${g}">${g}</option>`)
}

async function loadPerformers() {
  const grid = document.getElementById('performers-grid')
  grid.innerHTML = '<div class="loading"><div class="spinner"></div></div>'
  
  const q = document.getElementById('perf-search')?.value || ''
  const act_type = document.getElementById('perf-act-filter')?.value || ''
  const genre = document.getElementById('perf-genre-filter')?.value || ''
  
  let url = `/performers?page=${perfPage}&limit=12`
  if (q) url += `&q=${encodeURIComponent(q)}`
  if (act_type) url += `&act_type=${encodeURIComponent(act_type)}`
  if (genre) url += `&genre=${encodeURIComponent(genre)}`
  
  const res = await apiCall('GET', url)
  if (!res.ok) { grid.innerHTML = `<p class="text-red-400">${res.error}</p>`; return }
  
  const { items, total, totalPages } = res.data
  if (!items.length) { grid.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10"><div class="text-4xl mb-3">🎵</div><p>No performers found</p></div>'; return }
  
  const isPt = currentLang === 'pt'
  grid.innerHTML = items.map(p => {
    const avatarBg = p.avatar_url
      ? `<img src="${p.avatar_url}" class="perf-card-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span style="display:none;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#7C3AED,#5B21B6);align-items:center;justify-content:center;color:white;font-weight:700;font-size:1.2rem;flex-shrink:0;">${(p.name||'?').charAt(0)}</span>`
      : `<span style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#7C3AED,#5B21B6);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:1.2rem;flex-shrink:0;">${(p.name||'?').charAt(0)}</span>`
    return `
    <div class="card cursor-pointer" style="transition:all .2s;position:relative;overflow:hidden;" onclick="viewPerformer('${p.id}')"
      onmouseenter="this.style.borderColor='rgba(124,58,237,.5)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(124,58,237,.2)'"
      onmouseleave="this.style.borderColor='';this.style.transform='';this.style.boxShadow=''">
      ${p.platform_score > 100 ? `<div style="position:absolute;top:10px;right:10px;background:linear-gradient(135deg,#F59E0B,#D97706);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;">⚡ TOP</div>` : ''}
      <div class="flex items-start gap-3 mb-3">
        ${avatarBg}
        <div class="flex-1 min-w-0">
          <div class="text-white font-bold truncate">${p.act_name || p.name}</div>
          <div class="text-slate-400 text-xs">${p.name}</div>
          <div class="flex items-center gap-1 mt-1">
            ${stars(p.avg_rating || 0)}
            <span class="text-slate-400 text-xs ml-0.5">${p.avg_rating ? p.avg_rating.toFixed(1) : (isPt?'Novo':'New')}</span>
          </div>
        </div>
        ${p.is_verified ? '<span class="text-blue-400 mt-0.5 flex-shrink-0" title="Verified"><i class="fas fa-check-circle"></i></span>' : ''}
      </div>
      
      <div class="flex flex-wrap gap-1 mb-3">
        <span class="badge badge-purple text-xs">${p.act_type || 'Performer'}</span>
        ${(p.genres || []).slice(0,2).map(g => `<span class="badge badge-blue text-xs">${g}</span>`).join('')}
      </div>
      
      ${p.profile_headline ? `<p class="text-slate-400 text-xs italic mb-3 truncate">"${p.profile_headline}"</p>` : ''}
      
      <div class="flex items-center justify-between mt-auto pt-3" style="border-top: 1px solid rgba(255,255,255,0.08);">
        <div class="text-purple-400 font-bold text-lg">R$${p.hourly_rate}<span class="text-xs font-normal text-slate-400">/h</span></div>
        <div class="text-right">
          <div class="text-slate-400 text-xs"><i class="fas fa-map-marker-alt mr-1"></i>${p.city || (isPt?'Desconhecido':'Unknown')}${p.distance_km !== undefined ? ` · ${p.distance_km}km` : ''}</div>
          <div class="text-slate-500 text-xs">${p.total_gigs || 0} ${isPt?'shows':'gigs'}</div>
        </div>
      </div>
    </div>
  `}).join('')
  
  // Pagination
  const pagEl = document.getElementById('performers-pagination')
  if (pagEl && totalPages > 1) {
    pagEl.innerHTML = `
      <button onclick="perfPage=Math.max(1,perfPage-1);loadPerformers()" class="btn-secondary py-2 px-4" ${perfPage===1?'disabled':''}>← Prev</button>
      <span class="text-slate-400 py-2">Page ${perfPage} of ${totalPages}</span>
      <button onclick="perfPage=Math.min(${totalPages},perfPage+1);loadPerformers()" class="btn-secondary py-2 px-4" ${perfPage>=totalPages?'disabled':''}>Next →</button>
    `
  } else if (pagEl) pagEl.innerHTML = ''
}

async function viewPerformer(id) {
  openModal('performer-detail-modal')
  const el = document.getElementById('performer-detail-content')
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>'

  const res = await apiCall('GET', `/performers/${id}`)
  if (!res.ok) { el.innerHTML = `<p class="text-red-400">${res.error}</p>`; return }
  const p = res.data
  const isPt = currentLang === 'pt'
  const isHost = currentUser?.role === 'host'
  const ytLinks   = Array.isArray(p.youtube_links)  ? p.youtube_links  : []
  const audioLinks= Array.isArray(p.audio_links)    ? p.audio_links    : []
  const setlist   = Array.isArray(p.setlist)         ? p.setlist        : []
  const perfTypes = Array.isArray(p.performance_types) ? p.performance_types : []
  const pLangs    = Array.isArray(p.languages)       ? p.languages      : []

  el.innerHTML = `
    <!-- Header -->
    <div class="flex gap-4 mb-5 flex-wrap">
      <div style="width:88px;height:88px;border-radius:50%;background:linear-gradient(135deg,#7C3AED,#5B21B6);display:flex;align-items:center;justify-content:center;color:white;font-size:2.2rem;font-weight:700;flex-shrink:0;overflow:hidden;">
        ${p.avatar_url ? `<img src="${p.avatar_url}" style="width:88px;height:88px;object-fit:cover;">` : (p.name||'?').charAt(0)}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <h3 class="text-xl font-bold text-white">${p.act_name||p.name}</h3>
          ${p.is_verified ? '<span class="text-blue-400" title="Verified"><i class="fas fa-check-circle"></i></span>' : ''}
        </div>
        <div class="text-slate-400 text-sm">${p.name}</div>
        ${p.profile_headline ? `<p class="text-slate-300 text-xs italic mt-1">"${p.profile_headline}"</p>` : ''}
        <div class="flex items-center gap-1 mt-1">${stars(p.avg_rating)}
          <span class="text-slate-400 text-sm ml-1">${p.avg_rating?.toFixed(1)||'Novo'} · ${p.total_gigs||0} ${isPt?'shows':'gigs'}</span>
        </div>
        <div class="flex flex-wrap gap-1 mt-2">
          <span class="badge badge-purple">${p.act_type}</span>
          ${(p.genres||[]).map(g=>`<span class="badge badge-blue text-xs">${g}</span>`).join('')}
        </div>
      </div>
      <div class="text-right flex-shrink-0">
        <div class="text-2xl font-black text-purple-400">R$${p.hourly_rate}<span class="text-base font-normal">/h</span></div>
        <div class="text-slate-400 text-sm">${p.experience_years||0} ${isPt?'anos exp.':'yrs exp.'}</div>
        <div class="text-slate-400 text-sm"><i class="fas fa-map-marker-alt mr-1"></i>${p.city||''}${p.distance_km!==undefined?` · ${p.distance_km}km`:''}</div>
        <div class="text-yellow-400 text-sm mt-1">⚡ ${p.platform_score||0} pts</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="profile-tab-bar mb-4" id="view-tab-bar">
      <button class="profile-tab active" onclick="switchViewTab('about')">${isPt?'ℹ️ Sobre':'ℹ️ About'}</button>
      ${ytLinks.length||audioLinks.length ? `<button class="profile-tab" onclick="switchViewTab('media')">🎬 ${isPt?'Mídia':'Media'}</button>` : ''}
      ${(p.spotify_url||p.soundcloud_url||p.bandcamp_url||p.apple_music_url||p.youtube_channel) ? `<button class="profile-tab" onclick="switchViewTab('streaming')">🎵 Streaming</button>` : ''}
      ${(setlist.length||perfTypes.length||pLangs.length) ? `<button class="profile-tab" onclick="switchViewTab('services')">🎭 ${isPt?'Serviços':'Services'}</button>` : ''}
      ${(p.ratings||[]).length ? `<button class="profile-tab" onclick="switchViewTab('reviews')">⭐ ${isPt?'Avaliações':'Reviews'}</button>` : ''}
    </div>

    <!-- TAB: ABOUT -->
    <div id="vtab-about" class="vtab-content space-y-4">
      ${p.bio ? `<div><h4 class="text-white font-semibold mb-2">${isPt?'Sobre':'About'}</h4><p class="text-slate-300 text-sm leading-relaxed">${p.bio}</p></div>` : ''}
      ${p.experience_description ? `<div><h4 class="text-white font-semibold mb-2">${isPt?'Experiência':'Experience'}</h4><p class="text-slate-300 text-sm leading-relaxed">${p.experience_description}</p></div>` : ''}
      <div class="grid grid-cols-2 gap-3">
        <div class="card-flat"><div class="text-slate-400 text-xs mb-1">${isPt?'Tipo de Ato':'Act Type'}</div><div class="text-white text-sm font-semibold">${p.act_type||'—'}</div></div>
        <div class="card-flat"><div class="text-slate-400 text-xs mb-1">${isPt?'Taxa por Hora':'Hourly Rate'}</div><div class="text-purple-400 font-bold">R$${p.hourly_rate}/h</div></div>
        <div class="card-flat"><div class="text-slate-400 text-xs mb-1">${isPt?'Experiência':'Experience'}</div><div class="text-white text-sm">${p.experience_years||0} ${isPt?'anos':'yrs'}</div></div>
        <div class="card-flat"><div class="text-slate-400 text-xs mb-1">${isPt?'Raio de Viagem':'Travel Radius'}</div><div class="text-white text-sm">${p.max_travel_km||50}km</div></div>
        <div class="card-flat"><div class="text-slate-400 text-xs mb-1">${isPt?'Mín. horas':'Min hours'}</div><div class="text-white text-sm">${p.min_hours||1}h</div></div>
        <div class="card-flat"><div class="text-slate-400 text-xs mb-1">${isPt?'Localização':'Location'}</div><div class="text-white text-sm">${p.city||'—'}, ${p.country||''}</div></div>
      </div>
      ${p.equipment ? `<div><h4 class="text-white font-semibold mb-2">${isPt?'Equipamentos':'Equipment'}</h4><p class="text-slate-300 text-sm">${p.equipment}</p></div>` : ''}
      ${p.awards ? `<div><h4 class="text-white font-semibold mb-2"><i class="fas fa-trophy text-yellow-400 mr-1"></i>${isPt?'Prêmios':'Awards'}</h4><p class="text-slate-300 text-sm">${p.awards}</p></div>` : ''}
      ${p.press_quotes ? `<div class="card" style="background:rgba(59,130,246,.06);border-color:rgba(59,130,246,.2);"><i class="fas fa-quote-left text-blue-400 mr-2"></i><span class="text-slate-300 text-sm italic">${p.press_quotes}</span></div>` : ''}
      ${p.rider_requirements ? `<div><h4 class="text-white font-semibold mb-2">${isPt?'Rider Técnico':'Technical Rider'}</h4><p class="text-slate-300 text-sm">${p.rider_requirements}</p></div>` : ''}
      ${p.cancellation_policy ? `<div><h4 class="text-white font-semibold mb-2">${isPt?'Política de Cancelamento':'Cancellation Policy'}</h4><p class="text-slate-300 text-sm">${p.cancellation_policy}</p></div>` : ''}
      ${(p.website_url||p.whatsapp) ? `<div class="flex gap-3 flex-wrap">
        ${p.website_url ? `<a href="${p.website_url}" target="_blank" class="streaming-link text-sm"><i class="fas fa-globe mr-1"></i>Website</a>` : ''}
        ${p.whatsapp ? `<a href="https://wa.me/${p.whatsapp.replace(/\D/g,'')}" target="_blank" class="streaming-link text-sm"><i class="fab fa-whatsapp text-green-400 mr-1"></i>WhatsApp</a>` : ''}
      </div>` : ''}
    </div>

    <!-- TAB: MEDIA -->
    <div id="vtab-media" class="vtab-content" style="display:none;">
      ${ytLinks.length ? `
        <h4 class="text-white font-semibold mb-4"><i class="fab fa-youtube text-red-400 mr-2"></i>${isPt?'Vídeos de Performance':'Performance Videos'}</h4>
        <div class="media-grid mb-6">
          ${ytLinks.map(url => {
            const vid = getVideoId(url)
            return vid ? `
              <div class="yt-thumb">
                <iframe src="https://www.youtube.com/embed/${vid}" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
              </div>` : ''
          }).join('')}
        </div>` : ''}
      ${audioLinks.length ? `
        <h4 class="text-white font-semibold mb-4"><i class="fas fa-headphones text-purple-400 mr-2"></i>${isPt?'Áudios / Demos':'Audio / Demos'}</h4>
        <div class="space-y-3">
          ${audioLinks.map(a => {
            const url   = typeof a === 'string' ? a : a.url
            const label = typeof a === 'object' && a.label ? a.label : url
            // Check if it's a direct audio file
            const isDirect = /\.(mp3|ogg|wav|m4a)(\?.*)?$/i.test(url)
            return `<div class="audio-card">
              <div class="text-white text-sm font-medium mb-2">${label}</div>
              ${isDirect
                ? `<audio class="audio-player" controls src="${url}"></audio>`
                : `<a href="${url}" target="_blank" class="streaming-link text-sm"><i class="fas fa-external-link-alt mr-2"></i>${isPt?'Ouvir':'Listen'}</a>`}
            </div>`
          }).join('')}
        </div>` : ''}
    </div>

    <!-- TAB: STREAMING -->
    <div id="vtab-streaming" class="vtab-content" style="display:none;">
      <h4 class="text-white font-semibold mb-4">${isPt?'Ouça nas plataformas':'Listen on platforms'}</h4>
      <div class="space-y-2">
        ${p.spotify_url     ? `<a href="${p.spotify_url}" target="_blank" class="streaming-link"><i class="fab fa-spotify text-green-400 text-xl mr-2"></i>Spotify</a>` : ''}
        ${p.soundcloud_url  ? `<a href="${p.soundcloud_url}" target="_blank" class="streaming-link"><i class="fab fa-soundcloud text-orange-400 text-xl mr-2"></i>SoundCloud</a>` : ''}
        ${p.bandcamp_url    ? `<a href="${p.bandcamp_url}" target="_blank" class="streaming-link"><i class="fas fa-music text-teal-400 text-xl mr-2"></i>Bandcamp</a>` : ''}
        ${p.apple_music_url ? `<a href="${p.apple_music_url}" target="_blank" class="streaming-link"><i class="fab fa-apple text-pink-400 text-xl mr-2"></i>Apple Music</a>` : ''}
        ${p.youtube_channel ? `<a href="${p.youtube_channel}" target="_blank" class="streaming-link"><i class="fab fa-youtube text-red-400 text-xl mr-2"></i>YouTube Channel</a>` : ''}
      </div>
      ${(p.instagram_handle||p.tiktok_handle||p.facebook_handle||p.twitter_handle) ? `
      <h4 class="text-white font-semibold mt-5 mb-3">${isPt?'Redes Sociais':'Social Media'}</h4>
      <div class="space-y-2">
        ${p.instagram_handle ? `<a href="https://instagram.com/${p.instagram_handle.replace('@','')}" target="_blank" class="streaming-link"><i class="fab fa-instagram text-pink-400 text-xl mr-2"></i>@${p.instagram_handle}</a>` : ''}
        ${p.tiktok_handle    ? `<a href="https://tiktok.com/@${p.tiktok_handle.replace('@','')}" target="_blank" class="streaming-link"><i class="fab fa-tiktok text-cyan-400 text-xl mr-2"></i>@${p.tiktok_handle}</a>` : ''}
        ${p.facebook_handle  ? `<a href="https://facebook.com/${p.facebook_handle}" target="_blank" class="streaming-link"><i class="fab fa-facebook text-blue-400 text-xl mr-2"></i>${p.facebook_handle}</a>` : ''}
        ${p.twitter_handle   ? `<a href="https://twitter.com/${p.twitter_handle.replace('@','')}" target="_blank" class="streaming-link"><i class="fab fa-twitter text-sky-400 text-xl mr-2"></i>@${p.twitter_handle}</a>` : ''}
      </div>` : ''}
    </div>

    <!-- TAB: SERVICES -->
    <div id="vtab-services" class="vtab-content" style="display:none;">
      ${perfTypes.length ? `<div class="mb-4"><h4 class="text-white font-semibold mb-3">${isPt?'Tipos de Performance':'Performance Types'}</h4><div class="flex flex-wrap gap-2">${perfTypes.map(pt=>`<span class="badge badge-purple">${pt}</span>`).join('')}</div></div>` : ''}
      ${pLangs.length    ? `<div class="mb-4"><h4 class="text-white font-semibold mb-3">${isPt?'Idiomas':'Languages'}</h4><div class="flex flex-wrap gap-2">${pLangs.map(l=>`<span class="badge badge-blue">${l}</span>`).join('')}</div></div>` : ''}
      ${setlist.length   ? `<div><h4 class="text-white font-semibold mb-3">${isPt?'Setlist / Repertório':'Setlist / Repertoire'}</h4><div class="grid grid-cols-2 gap-1">${setlist.map(s=>`<div class="text-slate-300 text-sm py-1 px-2 rounded" style="background:rgba(255,255,255,.04);">🎵 ${s}</div>`).join('')}</div></div>` : ''}
    </div>

    <!-- TAB: REVIEWS -->
    <div id="vtab-reviews" class="vtab-content" style="display:none;">
      <div class="space-y-3">
        ${(p.ratings||[]).map(r=>`
          <div class="card">
            <div class="flex items-center gap-2 mb-2">
              <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#F59E0B,#D97706);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:12px;flex-shrink:0;">${(r.rater_name||'?').charAt(0)}</div>
              <div class="font-semibold text-white text-sm">${r.rater_name}</div>
              <div class="flex gap-0.5">${stars(r.score)}</div>
              <div class="ml-auto text-slate-500 text-xs">${timeAgo(r.created_at)}</div>
            </div>
            ${r.comment ? `<p class="text-slate-300 text-sm">${r.comment}</p>` : ''}
          </div>`).join('')}
      </div>
    </div>

    <!-- Actions -->
    <div class="flex gap-3 mt-5 pt-4" style="border-top:1px solid rgba(255,255,255,.08);">
      ${isHost ? `<button onclick="openBookingForPerformer('${p.id}','${(p.act_name||p.name).replace(/'/g,"\\'")}','${p.hourly_rate}')" class="btn-primary flex-1"><i class="fas fa-handshake mr-2"></i>${isPt?'Contratar Artista':'Book Performer'}</button>` : ''}
      <button onclick="openChat('${p.user_id}','${(p.name||'').replace(/'/g,"\\'")}');closeModal('performer-detail-modal')" class="btn-secondary flex-1"><i class="fas fa-comment mr-2"></i>${isPt?'Enviar Mensagem':'Message'}</button>
    </div>
  `
}

function switchViewTab(tab) {
  document.querySelectorAll('.vtab-content').forEach(el => el.style.display = 'none')
  document.querySelectorAll('#view-tab-bar .profile-tab').forEach(btn => btn.classList.remove('active'))
  const el = document.getElementById(`vtab-${tab}`)
  if (el) el.style.display = 'block'
  document.querySelectorAll('#view-tab-bar .profile-tab').forEach(btn => {
    if (btn.getAttribute('onclick')?.includes(`'${tab}'`)) btn.classList.add('active')
  })
}

function openBookingForPerformer(performerId, actName, rate) {
  closeModal('performer-detail-modal')
  showToast(currentLang==='pt'
    ? 'Para contratar: publique um evento e o artista se candidatará. Ou use Mensagens para combinar diretamente.'
    : 'To book: post an event and the performer will apply. Or use Messages to discuss directly.', 'info')
}

function getVideoId(url) {
  const m = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  return m ? m[1] : null
}

// =====================
// EVENTS
// =====================
let eventTypes = []

async function loadEventMeta() {
  const res = await apiCall('GET', '/events/meta/event-types')
  if (!res.ok) return
  eventTypes = res.data.eventTypes || []
  
  const etFilter = document.getElementById('event-type-filter')
  if (etFilter) {
    // Clear duplicates
    while (etFilter.options.length > 1) etFilter.remove(1)
    eventTypes.forEach(t => etFilter.innerHTML += `<option value="${t}">${t}</option>`)
  }
  
  // Load act types meta for wizard
  const metaRes = await apiCall('GET', '/performers/meta/act-types')
  if (metaRes.ok) {
    wizardEventMeta.eventTypes = eventTypes
    wizardEventMeta.actTypes = metaRes.data.actTypes || []
    wizardEventMeta.genres = metaRes.data.genres || []
  }
}

async function loadEvents() {
  const grid = document.getElementById('events-grid')
  grid.innerHTML = '<div class="loading"><div class="spinner"></div></div>'
  
  const q = document.getElementById('event-search')?.value || ''
  const event_type = document.getElementById('event-type-filter')?.value || ''
  
  let url = `/events?page=1&limit=12`
  if (q) url += `&q=${encodeURIComponent(q)}`
  if (event_type) url += `&event_type=${encodeURIComponent(event_type)}`
  
  const res = await apiCall('GET', url)
  if (!res.ok) { grid.innerHTML = `<p class="text-red-400">${res.error}</p>`; return }
  
  const { items } = res.data
  if (!items.length) { grid.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10"><div class="text-4xl mb-3">🎪</div><p>No events found</p></div>'; return }
  
  grid.innerHTML = items.map(e => `
    <div class="card cursor-pointer hover:border-yellow-500/50" onclick="viewEvent('${e.id}')">
      <div class="flex items-start justify-between mb-3">
        <div>
          <h3 class="text-white font-bold">${e.title}</h3>
          <div class="text-slate-400 text-sm mt-1"><i class="fas fa-map-marker-alt mr-1"></i>${e.city}, ${e.country}</div>
        </div>
        ${statusBadge(e.status)}
      </div>
      
      <div class="flex flex-wrap gap-1 mb-3">
        <span class="badge badge-yellow text-xs">${e.event_type}</span>
        ${(e.act_types_needed||[]).slice(0,2).map(a=>`<span class="badge badge-purple text-xs">${a}</span>`).join('')}
      </div>
      
      <div class="grid grid-cols-2 gap-2 text-sm mb-3">
        <div class="text-slate-400"><i class="fas fa-calendar mr-1"></i>${e.event_date}</div>
        <div class="text-slate-400"><i class="fas fa-clock mr-1"></i>${e.start_time} - ${e.end_time}</div>
        <div class="text-slate-400"><i class="fas fa-users mr-1"></i>${e.expected_audience || '?'} guests</div>
        <div class="text-slate-400"><i class="fas fa-hourglass mr-1"></i>${e.duration_hours}h</div>
      </div>
      
      ${e.budget_max ? `<div class="text-green-400 text-sm font-semibold">💰 Budget: $${e.budget_min||0}-$${e.budget_max}/hr</div>` : ''}
      
      <div class="flex items-center justify-between mt-3 pt-3" style="border-top: 1px solid rgba(255,255,255,0.08);">
        <div class="text-slate-400 text-xs">By ${e.host_name}</div>
        <div class="text-xs text-slate-500">${timeAgo(e.created_at)}</div>
      </div>
    </div>
  `).join('')
}

async function viewEvent(id) {
  openModal('event-detail-modal')
  const el = document.getElementById('event-detail-content')
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>'
  
  const res = await apiCall('GET', `/events/${id}`)
  if (!res.ok) { el.innerHTML = `<p class="text-red-400">${res.error}</p>`; return }
  const e = res.data
  
  const isPerformer = currentUser?.role === 'performer'
  const infra = e.infrastructure || []
  const actTypes = e.act_types_needed || []
  const genres = e.genres_preferred || []
  
  el.innerHTML = `
    <div class="mb-4">
      <div class="flex items-start justify-between mb-2">
        <h3 class="text-xl font-bold text-white">${e.title}</h3>
        ${statusBadge(e.status)}
      </div>
      <div class="flex flex-wrap gap-2 mb-3">
        <span class="badge badge-yellow">${e.event_type}</span>
        ${actTypes.map(a=>`<span class="badge badge-purple text-xs">${a}</span>`).join('')}
        ${genres.map(g=>`<span class="badge badge-blue text-xs">${g}</span>`).join('')}
      </div>
    </div>
    
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div class="card">
        <div class="text-slate-400 text-xs mb-1">📅 Date & Time</div>
        <div class="text-white font-semibold">${e.event_date}</div>
        <div class="text-slate-300 text-sm">${e.start_time} → ${e.end_time} (${e.duration_hours}h)</div>
      </div>
      <div class="card">
        <div class="text-slate-400 text-xs mb-1">📍 Location</div>
        <div class="text-white font-semibold">${e.venue_name || e.city}</div>
        <div class="text-slate-300 text-sm">${e.address}, ${e.city}</div>
      </div>
      <div class="card">
        <div class="text-slate-400 text-xs mb-1">👥 Audience</div>
        <div class="text-white font-semibold">${e.expected_audience || 'Not specified'} guests</div>
      </div>
      <div class="card">
        <div class="text-slate-400 text-xs mb-1">💰 Budget</div>
        <div class="text-white font-semibold">${e.budget_max ? `$${e.budget_min||0} - $${e.budget_max}/hr` : 'Flexible'}</div>
      </div>
    </div>
    
    ${e.description ? `<div class="mb-4"><h4 class="text-white font-semibold mb-2">Description</h4><p class="text-slate-300 text-sm">${e.description}</p></div>` : ''}
    ${e.musical_taste ? `<div class="mb-3"><h4 class="text-white font-semibold mb-1">Musical Taste</h4><p class="text-slate-300 text-sm">${e.musical_taste}</p></div>` : ''}
    ${e.objective ? `<div class="mb-3"><h4 class="text-white font-semibold mb-1">Objective</h4><p class="text-slate-300 text-sm">${e.objective}</p></div>` : ''}
    ${infra.length ? `<div class="mb-4"><h4 class="text-white font-semibold mb-2">Infrastructure Provided</h4><div class="flex flex-wrap gap-2">${infra.map(i=>`<span class="badge badge-green text-xs">${i}</span>`).join('')}</div></div>` : ''}
    
    <div class="card mb-4">
      <div class="flex items-center gap-3">
        <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#F59E0B,#D97706);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;">${(e.host_name||'H').charAt(0)}</div>
        <div>
          <div class="text-white font-semibold">${e.host_name}</div>
          <div class="text-slate-400 text-sm">${e.company_name||''} · ${e.total_events||0} events · ${e.host_rating?.toFixed(1)||'New'} ⭐</div>
        </div>
        ${e.host_verified ? '<span class="ml-auto text-blue-400"><i class="fas fa-check-circle"></i></span>' : ''}
      </div>
    </div>
    
    ${isPerformer && e.status === 'open' ? `
      <button onclick="openBookingForEvent('${e.id}','${e.title}')" class="btn-primary w-full mb-2">
        <i class="fas fa-music mr-2"></i>Apply for This Event
      </button>
    ` : ''}
  `
}

// =====================
// BOOKINGS
// =====================
async function loadBookings(status = currentBookingsFilter) {
  currentBookingsFilter = status
  const el = document.getElementById('bookings-list')
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>'
  
  let url = '/bookings/my?limit=50'
  if (status) url += `&status=${status}`
  
  const res = await apiCall('GET', url)
  if (!res.ok) { el.innerHTML = `<p class="text-red-400">${res.error}</p>`; return }
  
  const items = res.data.items || []
  if (!items.length) { el.innerHTML = '<div class="text-center text-slate-400 py-10"><div class="text-4xl mb-3">📋</div><p>No bookings found</p></div>'; return }
  
  el.innerHTML = items.map(b => {
    const isHost = currentUser?.role === 'host'
    const isPerformer = currentUser?.role === 'performer'
    return `
      <div class="card">
        <div class="flex flex-col md:flex-row gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <div class="text-2xl">${bookingIcon(b.status)}</div>
              <div>
                <div class="text-white font-bold">${b.event_title || 'Booking'}</div>
                <div class="text-slate-400 text-sm">${b.event_date || ''} · ${b.event_city || ''}</div>
              </div>
              <div class="ml-auto">${statusBadge(b.status)}</div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span class="text-slate-400">Hours:</span> <span class="text-white">${b.hours_booked}h</span></div>
              <div><span class="text-slate-400">Rate:</span> <span class="text-white">$${b.hourly_rate}/hr</span></div>
              <div><span class="text-slate-400">Total:</span> <span class="text-white">$${b.total_amount?.toFixed(2)}</span></div>
              ${isPerformer ? `<div><span class="text-slate-400">Your Pay:</span> <span class="text-green-400">$${b.performer_payout?.toFixed(2)}</span></div>` : `<div><span class="text-slate-400">Commission:</span> <span class="text-slate-300">$${b.commission?.toFixed(2)}</span></div>`}
            </div>
            ${isPerformer ? `<div class="text-slate-400 text-xs mt-2">Host: ${b.host_name}</div>` : `<div class="text-slate-400 text-xs mt-2">Performer: ${b.performer_name} (${b.act_type})</div>`}
          </div>
          <div class="flex flex-wrap gap-2">
            ${isHost && b.status === 'pending' ? `
              <button onclick="acceptBooking('${b.id}')" class="btn-success text-xs py-1 px-3">✓ Accept</button>
              <button onclick="rejectBooking('${b.id}')" class="btn-danger text-xs py-1 px-3">✗ Reject</button>
            ` : ''}
            ${b.status === 'accepted' ? `<button onclick="processPayment('${b.id}')" class="btn-primary text-xs py-1 px-3">💳 Pay</button>` : ''}
            ${b.status === 'escrow' ? `<button onclick="completeBooking('${b.id}')" class="btn-success text-xs py-1 px-3">✓ Complete</button>` : ''}
            ${b.status === 'completed' && !b.performer_rated && isPerformer ? `<button onclick="openRating('${b.id}')" class="btn-warning text-xs py-1 px-3">⭐ Rate</button>` : ''}
            ${b.status === 'completed' && !b.host_rated && isHost ? `<button onclick="openRating('${b.id}')" class="btn-warning text-xs py-1 px-3">⭐ Rate</button>` : ''}
            ${['escrow','completed'].includes(b.status) ? `<button onclick="openDispute('${b.id}')" class="btn-danger text-xs py-1 px-3">⚠️ Dispute</button>` : ''}
          </div>
        </div>
      </div>
    `
  }).join('')
}

function filterBookings(status) {
  document.querySelectorAll('[id^="tab-"]').forEach(t => t.classList.remove('active'))
  document.getElementById(`tab-${status || 'all'}`)?.classList.add('active')
  loadBookings(status)
}

async function acceptBooking(id) {
  const res = await apiCall('PUT', `/bookings/${id}/status`, { action: 'accept' })
  if (res.ok) { showToast('Booking accepted!'); loadBookings() }
  else showToast(res.error, 'error')
}

async function rejectBooking(id) {
  if (!confirm('Reject this booking request?')) return
  const res = await apiCall('PUT', `/bookings/${id}/status`, { action: 'reject' })
  if (res.ok) { showToast('Booking rejected'); loadBookings() }
  else showToast(res.error, 'error')
}

async function processPayment(id) {
  if (!confirm('Process payment? Funds will be held in escrow until the event is completed.')) return
  const res = await apiCall('POST', `/bookings/${id}/pay`)
  if (res.ok) { showToast('Payment processed! Funds held in escrow. 💰'); loadBookings() }
  else showToast(res.error, 'error')
}

async function completeBooking(id) {
  if (!confirm('Mark this event as completed?')) return
  const res = await apiCall('POST', `/bookings/${id}/complete`)
  if (res.ok) { showToast(res.data.message || 'Marked complete!'); loadBookings() }
  else showToast(res.error, 'error')
}

function openRating(bookingId) {
  openModal('rating-modal')
  document.getElementById('rating-content').innerHTML = `
    <p class="text-slate-300 mb-6">How was your experience? Your rating helps release the payment.</p>
    <div class="flex gap-3 justify-center mb-4" id="star-selector">
      ${[1,2,3,4,5].map(s=>`<button onclick="selectStar(${s})" class="text-3xl star-btn" data-val="${s}">☆</button>`).join('')}
    </div>
    <div id="selected-score" class="text-center text-slate-400 mb-4">Click a star to rate</div>
    <textarea id="rating-comment" class="input-field mb-4" rows="3" placeholder="Leave a comment (optional)..."></textarea>
    <button onclick="submitRating('${bookingId}')" class="btn-primary w-full">Submit Rating</button>
  `
}

let selectedScore = 0
function selectStar(score) {
  selectedScore = score
  document.querySelectorAll('.star-btn').forEach((btn, i) => {
    btn.textContent = i < score ? '⭐' : '☆'
  })
  document.getElementById('selected-score').textContent = `${score} star${score > 1 ? 's' : ''}`
}

async function submitRating(bookingId) {
  if (!selectedScore) { showToast('Please select a rating', 'error'); return }
  const comment = document.getElementById('rating-comment')?.value
  const res = await apiCall('POST', `/bookings/${bookingId}/rate`, { score: selectedScore, comment })
  if (res.ok) {
    closeModal('rating-modal'); selectedScore = 0
    showToast(res.data.escrow_released ? '⭐ Rated! Payment released to performer!' : '⭐ Rating submitted!')
    loadBookings()
  } else showToast(res.error, 'error')
}

function openDispute(bookingId) {
  openModal('dispute-modal')
  document.getElementById('dispute-content').innerHTML = `
    <p class="text-slate-300 mb-4">Please describe the issue. Our team will review within 24-48 hours.</p>
    <div class="mb-4">
      <label class="block text-sm text-slate-300 mb-2">Reason</label>
      <select id="dispute-reason" class="select-field">
        <option value="performer_no_show">Performer No Show</option>
        <option value="performance_quality">Performance Quality Issues</option>
        <option value="payment_dispute">Payment Dispute</option>
        <option value="contract_breach">Contract Breach</option>
        <option value="other">Other</option>
      </select>
    </div>
    <div class="mb-4">
      <label class="block text-sm text-slate-300 mb-2">Description *</label>
      <textarea id="dispute-desc" class="input-field" rows="4" placeholder="Describe the issue in detail..." required></textarea>
    </div>
    <div class="flex gap-3">
      <button onclick="submitDispute('${bookingId}')" class="btn-danger flex-1">Open Dispute</button>
      <button onclick="closeModal('dispute-modal')" class="btn-secondary flex-1">Cancel</button>
    </div>
  `
}

async function submitDispute(bookingId) {
  const reason = document.getElementById('dispute-reason')?.value
  const description = document.getElementById('dispute-desc')?.value
  if (!description) { showToast('Description required', 'error'); return }
  const res = await apiCall('POST', `/bookings/${bookingId}/dispute`, { reason, description })
  if (res.ok) {
    closeModal('dispute-modal'); showToast('⚠️ Dispute opened. We will review shortly.')
    loadBookings()
  } else showToast(res.error, 'error')
}

function openBookingForEvent(eventId, eventTitle) {
  closeModal('event-detail-modal')
  openModal('booking-request-modal')
  document.getElementById('booking-request-content').innerHTML = `
    <p class="text-slate-300 mb-4">You're applying to: <strong class="text-white">${eventTitle}</strong></p>
    <div class="card mb-4">
      <div class="text-slate-400 text-sm mb-2">Your quote will be based on:</div>
      <div class="text-white">Rate: <strong>$${currentProfile?.hourly_rate || 0}/hr</strong></div>
      <div class="text-slate-400 text-xs mt-1">The host will review your application and can accept or reject.</div>
    </div>
    <div class="mb-4">
      <label class="block text-sm text-slate-300 mb-2">Message to host (optional)</label>
      <textarea id="booking-notes" class="input-field" rows="3" placeholder="Introduce yourself, mention relevant experience..."></textarea>
    </div>
    <div class="flex gap-3">
      <button onclick="submitBookingRequest('${eventId}')" class="btn-primary flex-1">Send Application</button>
      <button onclick="closeModal('booking-request-modal')" class="btn-secondary flex-1">Cancel</button>
    </div>
  `
}

function openBookingRequest(performerId, actName, rate) {
  closeModal('performer-detail-modal')
  showToast(currentLang==='pt'
    ? 'Para contratar: publique um evento e o artista se candidatará. Ou use Mensagens para combinar diretamente.'
    : 'To book: post an event and the performer will apply. Or use Messages to discuss directly.', 'info')
}

async function submitBookingRequest(eventId) {
  const notes = document.getElementById('booking-notes')?.value
  const res = await apiCall('POST', '/bookings/request', { event_id: eventId, notes })
  if (res.ok) {
    closeModal('booking-request-modal')
    showToast('🎸 Application sent! The host will review your request.')
    showSection('bookings-section')
  } else showToast(res.error, 'error')
}

// =====================
// PROFILE
// =====================
async function loadProfile() {
  const el = document.getElementById('profile-content')
  
  const res = await apiCall('GET', '/users/me')
  if (!res.ok) { el.innerHTML = `<p class="text-red-400">${res.error}</p>`; return }
  
  const { user, profile } = res.data
  currentUser = user; currentProfile = profile
  
  if (user.role === 'performer') renderPerformerProfile(el, user, profile)
  else if (user.role === 'host') renderHostProfile(el, user, profile)
  else renderAdminProfile(el, user)
}

function renderPerformerProfile(el, user, profile) {
  const isPt = currentLang === 'pt'
  const ytLinks  = Array.isArray(profile?.youtube_links)  ? profile.youtube_links  : []
  const audioLinks = Array.isArray(profile?.audio_links)  ? profile.audio_links    : []
  const genreList  = Array.isArray(profile?.genres)       ? profile.genres         : []
  const setlist    = Array.isArray(profile?.setlist)      ? profile.setlist        : []
  const langs      = Array.isArray(profile?.languages)    ? profile.languages      : []
  const perfTypes  = Array.isArray(profile?.performance_types) ? profile.performance_types : []

  el.innerHTML = `
  <div class="grid md:grid-cols-3 gap-6">
    <!-- LEFT SIDEBAR -->
    <div class="space-y-4">
      <!-- Avatar & name card -->
      <div class="card text-center">
        <div style="width:90px;height:90px;border-radius:50%;background:linear-gradient(135deg,#7C3AED,#5B21B6);display:flex;align-items:center;justify-content:center;color:white;font-size:2.2rem;font-weight:700;margin:0 auto 12px;overflow:hidden;">
          ${user.avatar_url
            ? `<img src="${user.avatar_url}" style="width:90px;height:90px;object-fit:cover;">`
            : user.name.charAt(0)}
        </div>
        <div class="text-white font-bold text-lg">${profile?.act_name || user.name}</div>
        <div class="text-slate-400 text-sm mb-2">${user.name}</div>
        <div class="flex items-center justify-center gap-1 mb-2">${stars(profile?.avg_rating||0)}
          <span class="text-slate-400 text-xs ml-1">${profile?.avg_rating?.toFixed(1)||'Novo'}</span>
        </div>
        <span class="badge badge-purple">${profile?.act_type || (isPt?'Artista':'Performer')}</span>
        ${user.is_verified ? '<div class="text-blue-400 text-sm mt-2"><i class="fas fa-check-circle mr-1"></i>'+(isPt?'Verificado':'Verified')+'</div>' : ''}
        ${profile?.profile_headline ? `<p class="text-slate-300 text-xs mt-3 italic">"${profile.profile_headline}"</p>` : ''}
      </div>

      <!-- Stats -->
      <div class="card">
        <h4 class="text-white font-semibold mb-3">${isPt?'Estatísticas':'Stats'}</h4>
        <div class="space-y-2 text-sm">
          <div class="info-row"><span class="info-label">${isPt?'Shows':'Gigs'}</span><span class="info-value">${profile?.total_gigs||0}</span></div>
          <div class="info-row"><span class="info-label">${isPt?'Avaliação':'Rating'}</span><span class="info-value">${profile?.avg_rating?.toFixed(1)||'—'}</span></div>
          <div class="info-row"><span class="info-label">${isPt?'Taxa/hora':'Rate/hr'}</span><span class="info-value text-purple-400 font-bold">R$${profile?.hourly_rate||0}</span></div>
          <div class="info-row"><span class="info-label">${isPt?'Mín. horas':'Min hours'}</span><span class="info-value">${profile?.min_hours||1}h</span></div>
          <div class="info-row"><span class="info-label">${isPt?'Raio de viagem':'Travel radius'}</span><span class="info-value">${profile?.max_travel_km||50}km</span></div>
          <div class="info-row"><span class="info-label">${isPt?'Experiência':'Experience'}</span><span class="info-value">${profile?.experience_years||0} ${isPt?'anos':'yrs'}</span></div>
        </div>
      </div>

      <!-- Platform Score -->
      <div class="card">
        <h4 class="text-white font-semibold mb-2">${isPt?'Pontuação na Plataforma':'Platform Score'}</h4>
        <div class="text-3xl font-black text-yellow-400 mb-2">${profile?.platform_score||0}</div>
        <div class="score-bar mb-2"><div class="score-fill" style="width:${Math.min(100,(profile?.platform_score||0)/10)}%"></div></div>
        <p class="text-slate-400 text-xs">${isPt?'Compartilhe nas redes para ganhar mais pontos!':'Share on social media to earn more points!'}</p>
        <button onclick="showSection('social-section')" class="btn-primary w-full mt-3 text-sm py-2">${isPt?'Ganhar Pontos →':'Earn Points →'}</button>
      </div>

      <!-- Streaming links -->
      ${(profile?.spotify_url || profile?.soundcloud_url || profile?.bandcamp_url || profile?.apple_music_url || profile?.youtube_channel) ? `
      <div class="card">
        <h4 class="text-white font-semibold mb-3">${isPt?'Streaming':'Streaming'}</h4>
        <div class="space-y-2">
          ${profile?.spotify_url      ? `<a href="${profile.spotify_url}" target="_blank" class="streaming-link"><i class="fab fa-spotify text-green-400"></i> Spotify</a>` : ''}
          ${profile?.soundcloud_url   ? `<a href="${profile.soundcloud_url}" target="_blank" class="streaming-link"><i class="fab fa-soundcloud text-orange-400"></i> SoundCloud</a>` : ''}
          ${profile?.bandcamp_url     ? `<a href="${profile.bandcamp_url}" target="_blank" class="streaming-link"><i class="fas fa-music text-teal-400"></i> Bandcamp</a>` : ''}
          ${profile?.apple_music_url  ? `<a href="${profile.apple_music_url}" target="_blank" class="streaming-link"><i class="fab fa-apple text-pink-400"></i> Apple Music</a>` : ''}
          ${profile?.youtube_channel  ? `<a href="${profile.youtube_channel}" target="_blank" class="streaming-link"><i class="fab fa-youtube text-red-400"></i> YouTube Channel</a>` : ''}
        </div>
      </div>` : ''}

      <!-- Social handles -->
      ${(profile?.instagram_handle||profile?.tiktok_handle||profile?.facebook_handle||profile?.twitter_handle) ? `
      <div class="card">
        <h4 class="text-white font-semibold mb-3">${isPt?'Redes Sociais':'Social Media'}</h4>
        <div class="space-y-1 text-sm">
          ${profile?.instagram_handle ? `<div class="text-slate-300"><i class="fab fa-instagram text-pink-400 mr-2"></i>@${profile.instagram_handle}</div>` : ''}
          ${profile?.tiktok_handle    ? `<div class="text-slate-300"><i class="fab fa-tiktok text-cyan-400 mr-2"></i>@${profile.tiktok_handle}</div>` : ''}
          ${profile?.facebook_handle  ? `<div class="text-slate-300"><i class="fab fa-facebook text-blue-400 mr-2"></i>${profile.facebook_handle}</div>` : ''}
          ${profile?.twitter_handle   ? `<div class="text-slate-300"><i class="fab fa-twitter text-sky-400 mr-2"></i>@${profile.twitter_handle}</div>` : ''}
        </div>
      </div>` : ''}
    </div>

    <!-- RIGHT: TABBED EDIT FORM -->
    <div class="md:col-span-2">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-white">${isPt?'Editar Perfil':'Edit Profile'}</h3>
      </div>

      <!-- Profile Tabs -->
      <div class="profile-tab-bar" id="profile-tab-bar">
        <button class="profile-tab active" onclick="switchProfileTab('basic')">${isPt?'ℹ️ Básico':'ℹ️ Basic'}</button>
        <button class="profile-tab" onclick="switchProfileTab('media')">${isPt?'🎬 Mídia':'🎬 Media'}</button>
        <button class="profile-tab" onclick="switchProfileTab('streaming')">${isPt?'🎵 Streaming':'🎵 Streaming'}</button>
        <button class="profile-tab" onclick="switchProfileTab('services')">${isPt?'🎭 Serviços':'🎭 Services'}</button>
        <button class="profile-tab" onclick="switchProfileTab('social')">${isPt?'📱 Social':'📱 Social'}</button>
      </div>

      <form onsubmit="savePerformerProfile(event)" id="performer-profile-form">

        <!-- TAB: BASIC -->
        <div id="ptab-basic" class="ptab-content space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
              <label class="block text-sm text-slate-300 mb-1">${isPt?'Manchete / Tagline':'Headline / Tagline'}</label>
              <input type="text" id="p-headline" class="input-field" value="${profile?.profile_headline||''}" placeholder="${isPt?'Ex: Jazz ao vivo para casamentos e eventos corporativos':'e.g. Live jazz for weddings & corporate events'}">
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">${isPt?'Nome do Ato *':'Act Name *'}</label>
              <input type="text" id="p-act-name" class="input-field" value="${profile?.act_name||''}" required>
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">${isPt?'Nome Exibido':'Display Name'}</label>
              <input type="text" id="p-name" class="input-field" value="${user.name||''}">
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">${isPt?'Tipo de Ato *':'Act Type *'}</label>
              <select id="p-act-type" class="select-field">
                ${['Banda / Band','Artista Solo / Solo Artist','DJ','Violinista / Violinist','Pequena Orquestra / Small Orchestra','Banda de Jazz / Jazz Band','Cantor(a) / Singer','Guitarrista / Guitarist','Pianista / Pianist','Baterista / Drummer','Quarteto de Cordas / String Quartet','Banda Cover / Cover Band','Dupla Acústica / Acoustic Duo','Artista Eletrônico / Electronic Artist','Mariachi','Conjunto Clássico / Classical Ensemble','Coral / Choir','Percussionista / Percussionist','Saxofonista / Saxophonist','Outro / Other'].map(tp=>`<option value="${tp}" ${profile?.act_type===tp?'selected':''}>${tp}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">${isPt?'Taxa por Hora (R$) *':'Hourly Rate (R$) *'}</label>
              <input type="number" id="p-rate" class="input-field" value="${profile?.hourly_rate||0}" min="0" required>
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">${isPt?'Experiência (anos)':'Experience (years)'}</label>
              <input type="number" id="p-exp" class="input-field" value="${profile?.experience_years||0}" min="0">
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">${isPt?'Mín. horas por Show':'Min hours per Gig'}</label>
              <input type="number" id="p-min-hours" class="input-field" value="${profile?.min_hours||1}" min="1">
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">${isPt?'Raio de Viagem (km)':'Travel Radius (km)'}</label>
              <input type="number" id="p-travel" class="input-field" value="${profile?.max_travel_km||50}" min="0">
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">${isPt?'Cidade':'City'}</label>
              <input type="text" id="p-city" class="input-field" value="${user.city||''}">
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">${isPt?'Estado / Região':'State / Region'}</label>
              <input type="text" id="p-state" class="input-field" value="${user.state||''}">
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">${isPt?'País':'Country'}</label>
              <input type="text" id="p-country" class="input-field" value="${user.country||''}">
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">Latitude</label>
              <input type="number" id="p-lat" class="input-field" step="any" value="${user.latitude||''}">
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">Longitude</label>
              <input type="number" id="p-lon" class="input-field" step="any" value="${user.longitude||''}">
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">${isPt?'Avatar (URL da imagem)':'Avatar (Image URL)'}</label>
              <input type="url" id="p-avatar" class="input-field" value="${user.avatar_url||''}" placeholder="https://...">
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">${isPt?'Telefone / WhatsApp':'Phone / WhatsApp'}</label>
              <input type="text" id="p-whatsapp" class="input-field" value="${profile?.whatsapp||''}" placeholder="+55 11 9...">
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">${isPt?'Website':'Website'}</label>
              <input type="url" id="p-website" class="input-field" value="${profile?.website_url||''}" placeholder="https://...">
            </div>
          </div>
          <div>
            <label class="block text-sm text-slate-300 mb-1">${isPt?'Bio / Sobre':'Bio / About'}</label>
            <textarea id="p-bio" class="input-field" rows="3" placeholder="${isPt?'Conte sobre você e sua música...':'Tell us about yourself and your music...'}">${user.bio||''}</textarea>
          </div>
          <div>
            <label class="block text-sm text-slate-300 mb-1">${isPt?'Descrição da Experiência':'Experience Description'}</label>
            <textarea id="p-exp-desc" class="input-field" rows="3" placeholder="${isPt?'Descreva sua trajetória, conquistas, formação musical...':'Describe your journey, achievements, musical training...'}">${profile?.experience_description||''}</textarea>
          </div>
          <div>
            <label class="block text-sm text-slate-300 mb-1">${isPt?'Equipamentos':'Equipment'}</label>
            <input type="text" id="p-equipment" class="input-field" value="${profile?.equipment||''}" placeholder="${isPt?'Ex: Sistema de som próprio, instrumentos, iluminação...':'e.g. Own PA system, instruments, lighting...'}">
          </div>
          <div>
            <label class="block text-sm text-slate-300 mb-1">${isPt?'Gêneros Musicais (Ctrl/Cmd para múltiplos)':'Music Genres (Ctrl/Cmd for multiple)'}</label>
            <select id="p-genres" class="select-field" multiple style="height:110px;">
              ${['Pop','Rock','Jazz','Clássico / Classical','Eletrônico / Electronic','Hip-Hop','R&B / Soul','Sertanejo','Forró','Samba','MPB','Bossa Nova','Pagode','Axé','Funk','Baile Funk','Country','Folk','Blues','Latin / Latino','Reggae','Metal','Indie','Música de Casamento / Wedding Music','Corporativo / Corporate','Dance','Gospel','Alternativo / Alternative','Trap'].map(g=>`<option value="${g}" ${genreList.includes(g)?'selected':''}>${g}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- TAB: MEDIA -->
        <div id="ptab-media" class="ptab-content space-y-6" style="display:none;">
          <!-- YouTube Videos -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <label class="text-white font-semibold"><i class="fab fa-youtube text-red-400 mr-2"></i>${isPt?'Vídeos do YouTube':'YouTube Videos'}</label>
              <button type="button" onclick="addYouTubeField()" class="btn-secondary text-xs py-1 px-3">+ ${isPt?'Adicionar vídeo':'Add video'}</button>
            </div>
            <p class="text-slate-400 text-xs mb-3">${isPt?'Adicione links dos seus vídeos de performances. Ex: https://youtube.com/watch?v=abc123':'Add links to your performance videos. E.g. https://youtube.com/watch?v=abc123'}</p>
            <div id="youtube-inputs" class="space-y-2">
              ${ytLinks.length ? ytLinks.map((url,i) => `
                <div class="flex gap-2 items-center yt-row">
                  <input type="url" class="input-field yt-link flex-1" value="${url}" placeholder="https://youtube.com/watch?v=...">
                  ${url ? `<div class="yt-thumb" style="width:80px;height:45px;flex-shrink:0;cursor:pointer;" onclick="window.open('${url}','_blank')">
                    <img src="https://img.youtube.com/vi/${getVideoId(url)}/mqdefault.jpg" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">
                  </div>` : ''}
                  <button type="button" onclick="this.closest('.yt-row').remove()" class="btn-danger py-2 px-3 flex-shrink-0">✕</button>
                </div>`).join('') : `
                <div class="flex gap-2 items-center yt-row">
                  <input type="url" class="input-field yt-link flex-1" placeholder="https://youtube.com/watch?v=...">
                  <button type="button" onclick="this.closest('.yt-row').remove()" class="btn-danger py-2 px-3 flex-shrink-0">✕</button>
                </div>`}
            </div>
          </div>

          <!-- Audio Links -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <label class="text-white font-semibold"><i class="fas fa-headphones text-purple-400 mr-2"></i>${isPt?'Áudios / Demos':'Audio / Demos'}</label>
              <button type="button" onclick="addAudioField()" class="btn-secondary text-xs py-1 px-3">+ ${isPt?'Adicionar áudio':'Add audio'}</button>
            </div>
            <p class="text-slate-400 text-xs mb-3">${isPt?'Links diretos para arquivos de áudio (MP3, SoundCloud, Google Drive, etc.)':'Direct links to audio files (MP3, SoundCloud, Google Drive, etc.)'}</p>
            <div id="audio-inputs" class="space-y-2">
              ${audioLinks.length ? audioLinks.map(a => {
                const url = typeof a === 'string' ? a : a.url
                const label = typeof a === 'object' && a.label ? a.label : ''
                return `<div class="flex gap-2 items-center audio-row">
                  <input type="text" class="input-field audio-label" style="width:35%;" value="${label}" placeholder="${isPt?'Título do áudio...':'Audio title...'}">
                  <input type="url" class="input-field audio-url flex-1" value="${url}" placeholder="https://...">
                  <button type="button" onclick="this.closest('.audio-row').remove()" class="btn-danger py-2 px-3 flex-shrink-0">✕</button>
                </div>`}).join('') : `
                <div class="flex gap-2 items-center audio-row">
                  <input type="text" class="input-field audio-label" style="width:35%;" placeholder="${isPt?'Título do áudio...':'Audio title...'}">
                  <input type="url" class="input-field audio-url flex-1" placeholder="https://...">
                  <button type="button" onclick="this.closest('.audio-row').remove()" class="btn-danger py-2 px-3 flex-shrink-0">✕</button>
                </div>`}
            </div>
          </div>

          <!-- Awards & Press -->
          <div class="grid grid-cols-1 gap-4">
            <div>
              <label class="block text-sm text-slate-300 mb-1"><i class="fas fa-trophy text-yellow-400 mr-1"></i>${isPt?'Prêmios & Conquistas':'Awards & Achievements'}</label>
              <textarea id="p-awards" class="input-field" rows="3" placeholder="${isPt?'Liste prêmios, reconhecimentos, participações em festivais...':'List awards, recognitions, festival appearances...'}">${profile?.awards||''}</textarea>
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1"><i class="fas fa-quote-left text-blue-400 mr-1"></i>${isPt?'Depoimentos de Imprensa':'Press Quotes'}</label>
              <textarea id="p-press" class="input-field" rows="3" placeholder="${isPt?'\"Uma das melhores bandas do Brasil\" - Revista XYZ':'"One of the best bands in Brazil" - XYZ Magazine'}">${profile?.press_quotes||''}</textarea>
            </div>
          </div>
        </div>

        <!-- TAB: STREAMING -->
        <div id="ptab-streaming" class="ptab-content space-y-4" style="display:none;">
          <p class="text-slate-400 text-sm">${isPt?'Adicione seus perfis em plataformas de streaming para que contratantes possam ouvir seu trabalho.':'Add your streaming platform profiles so hosts can listen to your work.'}</p>
          <div>
            <label class="block text-sm text-slate-300 mb-1"><i class="fab fa-spotify text-green-400 mr-2"></i>Spotify</label>
            <input type="url" id="p-spotify" class="input-field" value="${profile?.spotify_url||''}" placeholder="https://open.spotify.com/artist/...">
          </div>
          <div>
            <label class="block text-sm text-slate-300 mb-1"><i class="fab fa-soundcloud text-orange-400 mr-2"></i>SoundCloud</label>
            <input type="url" id="p-soundcloud" class="input-field" value="${profile?.soundcloud_url||''}" placeholder="https://soundcloud.com/...">
          </div>
          <div>
            <label class="block text-sm text-slate-300 mb-1"><i class="fas fa-music text-teal-400 mr-2"></i>Bandcamp</label>
            <input type="url" id="p-bandcamp" class="input-field" value="${profile?.bandcamp_url||''}" placeholder="https://yourname.bandcamp.com">
          </div>
          <div>
            <label class="block text-sm text-slate-300 mb-1"><i class="fab fa-apple text-pink-400 mr-2"></i>Apple Music</label>
            <input type="url" id="p-apple" class="input-field" value="${profile?.apple_music_url||''}" placeholder="https://music.apple.com/...">
          </div>
          <div>
            <label class="block text-sm text-slate-300 mb-1"><i class="fab fa-youtube text-red-400 mr-2"></i>${isPt?'Canal do YouTube':'YouTube Channel'}</label>
            <input type="url" id="p-yt-channel" class="input-field" value="${profile?.youtube_channel||''}" placeholder="https://youtube.com/@...">
          </div>
        </div>

        <!-- TAB: SERVICES -->
        <div id="ptab-services" class="ptab-content space-y-4" style="display:none;">
          <div>
            <label class="block text-sm text-slate-300 mb-1">${isPt?'Tipos de Performance (Ctrl para múltiplos)':'Performance Types (Ctrl for multiple)'}</label>
            <select id="p-perf-types" class="select-field" multiple style="height:130px;">
              ${['Show ao Vivo / Live Show','Cerimônia / Ceremony','Jantar / Dinner','Dança / Dance Set','Acústico / Acoustic Set','DJ Set','Recepção / Reception','Pós-festa / After Party','Apresentação Corporativa / Corporate Presentation','Festival','Sessão de Estúdio / Studio Session'].map(pt=>`<option value="${pt}" ${perfTypes.includes(pt)?'selected':''}>${pt}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm text-slate-300 mb-1">${isPt?'Idiomas que Performa':'Performance Languages'}</label>
            <select id="p-languages" class="select-field" multiple style="height:110px;">
              ${['Português','English','Español','Français','Deutsch','Italiano','Japonês / Japanese','Mandarim / Mandarin'].map(l=>`<option value="${l}" ${langs.includes(l)?'selected':''}>${l}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm text-slate-300 mb-1">${isPt?'Setlist / Repertório':'Setlist / Repertoire'}</label>
            <p class="text-slate-500 text-xs mb-2">${isPt?'Uma música por linha':'One song per line'}</p>
            <textarea id="p-setlist" class="input-field" rows="6" placeholder="${isPt?'Garota de Ipanema\nThe Girl from Ipanema\nWave\nSo Danco Samba...':'Shape of You\nBlinding Lights\nUptown Funk...'}">${setlist.join('\n')}</textarea>
          </div>
          <div>
            <label class="block text-sm text-slate-300 mb-1">${isPt?'Rider Técnico':'Technical Rider'}</label>
            <textarea id="p-rider" class="input-field" rows="3" placeholder="${isPt?'Equipamentos necessários, camarins, alimentação, etc.':'Required equipment, dressing room, catering, etc.'}">${profile?.rider_requirements||''}</textarea>
          </div>
          <div>
            <label class="block text-sm text-slate-300 mb-1">${isPt?'Política de Cancelamento':'Cancellation Policy'}</label>
            <textarea id="p-cancel" class="input-field" rows="3" placeholder="${isPt?'Ex: Cancelamentos com menos de 48h perdem 50% do valor...':'e.g. Cancellations less than 48h before the event forfeit 50%...'}">${profile?.cancellation_policy||''}</textarea>
          </div>
        </div>

        <!-- TAB: SOCIAL -->
        <div id="ptab-social" class="ptab-content space-y-4" style="display:none;">
          <p class="text-slate-400 text-sm">${isPt?'Conecte suas redes sociais para aumentar sua visibilidade e ganhar pontos na plataforma.':'Connect your social networks to increase visibility and earn platform points.'}</p>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-slate-300 mb-1"><i class="fab fa-instagram text-pink-400 mr-1"></i>Instagram</label>
              <input type="text" id="p-instagram" class="input-field" value="${profile?.instagram_handle||''}" placeholder="@handle">
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1"><i class="fab fa-tiktok text-cyan-400 mr-1"></i>TikTok</label>
              <input type="text" id="p-tiktok" class="input-field" value="${profile?.tiktok_handle||''}" placeholder="@handle">
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1"><i class="fab fa-facebook text-blue-400 mr-1"></i>Facebook</label>
              <input type="text" id="p-facebook" class="input-field" value="${profile?.facebook_handle||''}" placeholder="${isPt?'nome da página':'page name'}">
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1"><i class="fab fa-twitter text-sky-400 mr-1"></i>Twitter / X</label>
              <input type="text" id="p-twitter" class="input-field" value="${profile?.twitter_handle||''}" placeholder="@handle">
            </div>
          </div>
          <div class="card" style="background:rgba(124,58,237,.08);border-color:rgba(124,58,237,.2);">
            <h4 class="text-white font-semibold mb-3">⚡ ${isPt?'Ganhe Pontos Compartilhando':'Earn Points by Sharing'}</h4>
            <p class="text-slate-400 text-sm mb-3">${isPt?'Vá para Pontuação & Redes Sociais para registrar seus compartilhamentos e ganhar pontos que melhoram seu ranking!':'Go to Score & Social Media to log your shares and earn points that improve your ranking!'}</p>
            <button type="button" onclick="showSection('social-section')" class="btn-primary text-sm py-2">${isPt?'Ir para Pontuação →':'Go to Score →'}</button>
          </div>
        </div>

        <!-- SAVE BUTTON always visible -->
        <div class="pt-4 mt-4" style="border-top:1px solid rgba(255,255,255,0.08);">
          <button type="submit" class="btn-primary w-full py-3 text-base font-bold">
            <i class="fas fa-save mr-2"></i>${isPt?'Salvar Perfil':'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  </div>`
}

function switchProfileTab(tab) {
  document.querySelectorAll('.ptab-content').forEach(el => el.style.display = 'none')
  document.querySelectorAll('.profile-tab').forEach(btn => btn.classList.remove('active'))
  document.getElementById(`ptab-${tab}`).style.display = 'block'
  // Find the clicked button by matching text content
  document.querySelectorAll('.profile-tab').forEach(btn => {
    if (btn.getAttribute('onclick')?.includes(`'${tab}'`)) btn.classList.add('active')
  })
}

function addYouTubeField() {
  const el = document.getElementById('youtube-inputs')
  const isPt = currentLang === 'pt'
  const div = document.createElement('div')
  div.className = 'flex gap-2 items-center yt-row'
  div.innerHTML = `
    <input type="url" class="input-field yt-link flex-1" placeholder="https://youtube.com/watch?v=...">
    <button type="button" onclick="this.closest('.yt-row').remove()" class="btn-danger py-2 px-3 flex-shrink-0">✕</button>
  `
  el.appendChild(div)
}

function addAudioField() {
  const el = document.getElementById('audio-inputs')
  const isPt = currentLang === 'pt'
  const div = document.createElement('div')
  div.className = 'flex gap-2 items-center audio-row'
  div.innerHTML = `
    <input type="text" class="input-field audio-label" style="width:35%;" placeholder="${isPt?'Título...':'Title...'}">
    <input type="url" class="input-field audio-url flex-1" placeholder="https://...">
    <button type="button" onclick="this.closest('.audio-row').remove()" class="btn-danger py-2 px-3 flex-shrink-0">✕</button>
  `
  el.appendChild(div)
}

async function savePerformerProfile(e) {
  e.preventDefault()
  const isPt = currentLang === 'pt'

  const genres   = Array.from(document.getElementById('p-genres')?.selectedOptions||[]).map(o=>o.value)
  const ytLinks  = Array.from(document.querySelectorAll('.yt-link')).map(i=>i.value.trim()).filter(Boolean)
  const perfTypes= Array.from(document.getElementById('p-perf-types')?.selectedOptions||[]).map(o=>o.value)
  const langs    = Array.from(document.getElementById('p-languages')?.selectedOptions||[]).map(o=>o.value)

  // Collect audio links
  const audioRows = document.querySelectorAll('.audio-row')
  const audioLinks = []
  audioRows.forEach(row => {
    const url   = row.querySelector('.audio-url')?.value.trim()
    const label = row.querySelector('.audio-label')?.value.trim()
    if (url) audioLinks.push({ url, label: label||'' })
  })

  // Setlist: one per line
  const setlistRaw = document.getElementById('p-setlist')?.value || ''
  const setlist = setlistRaw.split('\n').map(s=>s.trim()).filter(Boolean)

  const data = {
    // Basic
    act_name:               document.getElementById('p-act-name')?.value,
    name:                   document.getElementById('p-name')?.value,
    act_type:               document.getElementById('p-act-type')?.value,
    hourly_rate:            parseFloat(document.getElementById('p-rate')?.value)||0,
    experience_years:       parseInt(document.getElementById('p-exp')?.value)||0,
    min_hours:              parseInt(document.getElementById('p-min-hours')?.value)||1,
    max_travel_km:          parseInt(document.getElementById('p-travel')?.value)||50,
    bio:                    document.getElementById('p-bio')?.value,
    experience_description: document.getElementById('p-exp-desc')?.value,
    equipment:              document.getElementById('p-equipment')?.value,
    profile_headline:       document.getElementById('p-headline')?.value,
    website_url:            document.getElementById('p-website')?.value,
    whatsapp:               document.getElementById('p-whatsapp')?.value,
    avatar_url:             document.getElementById('p-avatar')?.value,
    city:                   document.getElementById('p-city')?.value,
    state:                  document.getElementById('p-state')?.value,
    country:                document.getElementById('p-country')?.value,
    latitude:               parseFloat(document.getElementById('p-lat')?.value)||null,
    longitude:              parseFloat(document.getElementById('p-lon')?.value)||null,
    genres,
    // Media
    youtube_links:          ytLinks,
    audio_links:            audioLinks,
    awards:                 document.getElementById('p-awards')?.value,
    press_quotes:           document.getElementById('p-press')?.value,
    // Streaming
    spotify_url:            document.getElementById('p-spotify')?.value,
    soundcloud_url:         document.getElementById('p-soundcloud')?.value,
    bandcamp_url:           document.getElementById('p-bandcamp')?.value,
    apple_music_url:        document.getElementById('p-apple')?.value,
    youtube_channel:        document.getElementById('p-yt-channel')?.value,
    // Services
    performance_types:      perfTypes,
    languages:              langs,
    setlist,
    rider_requirements:     document.getElementById('p-rider')?.value,
    cancellation_policy:    document.getElementById('p-cancel')?.value,
    // Social
    instagram_handle:       document.getElementById('p-instagram')?.value,
    tiktok_handle:          document.getElementById('p-tiktok')?.value,
    facebook_handle:        document.getElementById('p-facebook')?.value,
    twitter_handle:         document.getElementById('p-twitter')?.value,
  }

  const res = await apiCall('PUT', '/performers/profile', data)
  if (res.ok) {
    showToast(isPt ? '✅ Perfil salvo com sucesso!' : '✅ Profile saved!')
    currentProfile = res.data
    setupSidebar()
    loadProfile() // reload to reflect changes
  } else showToast(res.error, 'error')
}

function renderHostProfile(el, user, profile) {
  const isPt = currentLang === 'pt'
  el.innerHTML = `
    <div class="grid md:grid-cols-3 gap-6">
      <!-- LEFT -->
      <div class="space-y-4">
        <div class="card text-center">
          <div style="width:90px;height:90px;border-radius:50%;background:linear-gradient(135deg,#F59E0B,#D97706);display:flex;align-items:center;justify-content:center;color:white;font-size:2.2rem;font-weight:700;margin:0 auto 14px;overflow:hidden;">
            ${user.avatar_url ? `<img src="${user.avatar_url}" style="width:90px;height:90px;object-fit:cover;">` : user.name.charAt(0)}
          </div>
          <div class="text-white font-bold text-lg">${user.name}</div>
          ${profile?.company_name ? `<div class="text-slate-400 text-sm mt-1">${profile.company_name}</div>` : ''}
          <div class="mt-2"><span class="badge badge-yellow">${profile?.host_type||'Event Host'}</span></div>
          ${user.is_verified ? `<div class="text-blue-400 text-sm mt-2"><i class="fas fa-check-circle mr-1"></i>${isPt?'Verificado':'Verified'}</div>` : ''}
        </div>
        <div class="card">
          <h4 class="host-section-title">${isPt?'📊 Estatísticas':'📊 Stats'}</h4>
          <div class="space-y-2 text-sm">
            <div class="info-row"><span class="info-label">${isPt?'Total de Eventos':'Total Events'}</span><span class="info-value">${profile?.total_events||0}</span></div>
            <div class="info-row"><span class="info-label">${isPt?'Avaliação Média':'Avg Rating'}</span><span class="info-value">${profile?.avg_rating?.toFixed(1)||'—'} ⭐</span></div>
            <div class="info-row"><span class="info-label">${isPt?'Membro desde':'Member since'}</span><span class="info-value">${user.created_at ? new Date(user.created_at).getFullYear() : '—'}</span></div>
          </div>
        </div>
        <div class="card">
          <h4 class="host-section-title">💡 ${isPt?'Dica':'Tip'}</h4>
          <p class="text-slate-400 text-sm">${isPt?'Use o botão "Novo Evento" para publicar um evento e receber candidaturas de artistas próximos!':'Use the "New Event" button to post an event and receive applications from nearby artists!'}</p>
          <button onclick="openEventWizard()" class="btn-primary w-full mt-3 text-sm py-2">
            <i class="fas fa-plus mr-2"></i>${isPt?'Criar Evento →':'Create Event →'}
          </button>
        </div>
      </div>

      <!-- RIGHT: EDIT FORM -->
      <div class="md:col-span-2">
        <h3 class="text-lg font-bold text-white mb-5">${isPt?'✏️ Editar Perfil':'✏️ Edit Profile'}</h3>
        <form onsubmit="saveHostProfile(event)" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
              <label class="block text-sm text-slate-300 mb-1">${isPt?'Nome Completo':'Full Name'}</label>
              <input type="text" id="h-name" class="input-field" value="${user.name||''}">
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">${isPt?'Nome da Empresa / Organização':'Company / Organization'}</label>
              <input type="text" id="h-company" class="input-field" value="${profile?.company_name||''}" placeholder="${isPt?'Opcional':'Optional'}">
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">${isPt?'Tipo de Contratante':'Host Type'}</label>
              <select id="h-type" class="select-field">
                ${[
                  ['Individual', isPt?'Pessoa Física':'Individual'],
                  ['Wedding Planner', isPt?'Cerimonialista / Wedding Planner':'Wedding Planner'],
                  ['Event Company', isPt?'Empresa de Eventos':'Event Company'],
                  ['Bar/Club Owner', isPt?'Bar / Clube':'Bar / Club Owner'],
                  ['Corporate', isPt?'Corporativo':'Corporate'],
                  ['Restaurant', isPt?'Restaurante':'Restaurant'],
                  ['Other', isPt?'Outro':'Other']
                ].map(([v,l])=>`<option value="${v}" ${profile?.host_type===v?'selected':''}>${l}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">${isPt?'Telefone':'Phone'}</label>
              <input type="tel" id="h-phone" class="input-field" value="${user.phone||''}" placeholder="+55 11 9...">
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">${isPt?'Avatar (URL)':'Avatar (URL)'}</label>
              <input type="url" id="h-avatar" class="input-field" value="${user.avatar_url||''}" placeholder="https://...">
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">${isPt?'Cidade':'City'}</label>
              <input type="text" id="h-city" class="input-field" value="${user.city||''}">
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">${isPt?'País':'Country'}</label>
              <input type="text" id="h-country" class="input-field" value="${user.country||''}">
            </div>
          </div>
          <div>
            <label class="block text-sm text-slate-300 mb-1">${isPt?'Sobre você / sua empresa':'About you / your company'}</label>
            <textarea id="h-bio" class="input-field" rows="4" placeholder="${isPt?'Conte sobre você, seus eventos, o que você prioriza nos artistas contratados...':'Tell us about yourself, your events, what you look for in performers...'}">${user.bio||''}</textarea>
          </div>
          <button type="submit" class="btn-primary w-full py-3">
            <i class="fas fa-save mr-2"></i>${isPt?'Salvar Perfil':'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  `
}

async function saveHostProfile(e) {
  e.preventDefault()
  const data = {
    name: document.getElementById('h-name').value,
    company_name: document.getElementById('h-company').value,
    host_type: document.getElementById('h-type').value,
    bio: document.getElementById('h-bio').value,
    city: document.getElementById('h-city').value,
    country: document.getElementById('h-country').value,
    phone: document.getElementById('h-phone').value,
    avatar_url: document.getElementById('h-avatar').value
  }
  const res = await apiCall('PUT', '/users/me', data)
  if (res.ok) showToast('Profile saved! ✅')
  else showToast(res.error, 'error')
}

function renderAdminProfile(el, user) {
  el.innerHTML = `
    <div class="card max-w-md">
      <h3 class="text-lg font-bold text-white mb-4">Admin Account</h3>
      <div class="space-y-2 text-sm">
        <div class="flex justify-between"><span class="text-slate-400">Name</span><span class="text-white">${user.name}</span></div>
        <div class="flex justify-between"><span class="text-slate-400">Email</span><span class="text-white">${user.email}</span></div>
        <div class="flex justify-between"><span class="text-slate-400">Role</span><span class="badge badge-red">Admin</span></div>
      </div>
    </div>
  `
}

// =====================
// EVENTS (Create)
// =====================
async function handleCreateEvent(e) {
  e.preventDefault()
  
  const actTypes = Array.from(document.getElementById('ev-act-types').selectedOptions).map(o => o.value)
  const genres = Array.from(document.getElementById('ev-genres').selectedOptions).map(o => o.value)
  
  if (actTypes.length === 0) { showToast('Select at least one act type', 'error'); return }
  
  const data = {
    title: document.getElementById('ev-title').value,
    event_type: document.getElementById('ev-type').value,
    description: document.getElementById('ev-desc').value,
    venue_name: document.getElementById('ev-venue').value,
    address: document.getElementById('ev-address').value,
    city: document.getElementById('ev-city').value,
    country: document.getElementById('ev-country').value,
    latitude: parseFloat(document.getElementById('ev-lat').value),
    longitude: parseFloat(document.getElementById('ev-lon').value),
    event_date: document.getElementById('ev-date').value,
    start_time: document.getElementById('ev-start').value,
    end_time: document.getElementById('ev-end').value,
    duration_hours: parseFloat(document.getElementById('ev-duration').value),
    expected_audience: parseInt(document.getElementById('ev-audience').value) || null,
    budget_min: parseFloat(document.getElementById('ev-budget-min').value) || null,
    budget_max: parseFloat(document.getElementById('ev-budget-max').value) || null,
    objective: document.getElementById('ev-objective').value,
    musical_taste: document.getElementById('ev-musical-taste').value,
    act_types_needed: actTypes,
    genres_preferred: genres
  }
  
  const res = await apiCall('POST', '/events', data)
  if (res.ok) {
    closeModal('create-event-modal')
    showToast('🎪 Event created! Matching performers have been notified.')
    showSection('events-section')
  } else showToast(res.error, 'error')
}

// =====================
// MESSAGES
// =====================
let currentChatUserId = null

async function loadConversations() {
  const el = document.getElementById('conversations-list')
  const res = await apiCall('GET', '/messages/conversations')
  if (!res.ok) { el.innerHTML = ''; return }
  
  const convos = res.data || []
  if (!convos.length) { el.innerHTML = '<p class="text-slate-400 text-sm">No conversations yet</p>'; return }
  
  el.innerHTML = convos.map(c => `
    <div class="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-white/5" onclick="openChat('${c.other_user_id}','${c.other_name}')">
      <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#7C3AED,#5B21B6);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;flex-shrink:0;">${c.other_name?.charAt(0)||'?'}</div>
      <div class="flex-1 min-w-0">
        <div class="text-white text-sm font-medium">${c.other_name}</div>
        <div class="text-slate-400 text-xs truncate">${c.last_message||''}</div>
      </div>
      ${c.unread_count > 0 ? `<span class="badge badge-red text-xs">${c.unread_count}</span>` : ''}
    </div>
  `).join('')
}

async function openChat(userId, userName) {
  currentChatUserId = userId
  const el = document.getElementById('chat-area')
  el.innerHTML = `
    <div class="flex items-center gap-3 mb-4 pb-4" style="border-bottom:1px solid rgba(255,255,255,0.08);">
      <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#7C3AED,#5B21B6);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;">${userName?.charAt(0)||'?'}</div>
      <div class="text-white font-semibold">${userName}</div>
    </div>
    <div id="messages-feed" class="overflow-y-auto space-y-3 mb-4" style="height:300px;"></div>
    <div class="flex gap-2">
      <input type="text" id="msg-input" class="input-field flex-1" placeholder="Type a message..." onkeydown="if(event.key==='Enter')sendMessage()">
      <button onclick="sendMessage()" class="btn-primary py-2 px-4"><i class="fas fa-paper-plane"></i></button>
    </div>
  `
  
  const res = await apiCall('GET', `/messages/${userId}`)
  if (!res.ok) return
  
  const feed = document.getElementById('messages-feed')
  const msgs = res.data || []
  
  feed.innerHTML = msgs.map(m => `
    <div class="flex ${m.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}">
      <div class="max-w-xs px-3 py-2 rounded-lg text-sm ${m.sender_id === currentUser?.id ? 'bg-purple-600 text-white' : 'bg-white/10 text-white'}">
        ${m.message}
        <div class="text-xs opacity-60 mt-1">${timeAgo(m.created_at)}</div>
      </div>
    </div>
  `).join('')
  
  feed.scrollTop = feed.scrollHeight
}

async function sendMessage() {
  const input = document.getElementById('msg-input')
  if (!input?.value.trim() || !currentChatUserId) return
  const msg = input.value.trim()
  input.value = ''
  
  await apiCall('POST', '/messages', { receiver_id: currentChatUserId, message: msg })
  openChat(currentChatUserId, document.querySelector('#chat-area .text-white.font-semibold')?.textContent)
}

// =====================
// SOCIAL SCORE
// =====================
async function loadSocialSection() {
  const el = document.getElementById('social-content')
  
  const res = await apiCall('GET', '/performers/me/profile')
  if (!res.ok) { el.innerHTML = '<p class="text-red-400">Not a performer</p>'; return }
  const profile = res.data
  
  el.innerHTML = `
    <div class="grid md:grid-cols-2 gap-6">
      <div class="card text-center">
        <div class="text-6xl font-black text-yellow-400 mb-2">${profile.platform_score}</div>
        <div class="text-white text-lg font-semibold mb-2">Your Platform Score</div>
        <div class="score-bar mb-3"><div class="score-fill" style="width:${Math.min(100,(profile.platform_score||0)/10)}%"></div></div>
        <p class="text-slate-400 text-sm">Higher score = higher position in search results</p>
        <div class="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div class="card text-center p-3"><div class="text-2xl font-bold text-white">${profile.total_gigs}</div><div class="text-slate-400 text-xs">Gigs</div></div>
          <div class="card text-center p-3"><div class="text-2xl font-bold text-white">${profile.avg_rating?.toFixed(1)||'—'}</div><div class="text-slate-400 text-xs">Rating</div></div>
          <div class="card text-center p-3"><div class="text-2xl font-bold text-white">${profile.platform_score}</div><div class="text-slate-400 text-xs">Points</div></div>
        </div>
      </div>
      
      <div>
        <h3 class="text-lg font-bold text-white mb-4">Earn Points by Sharing</h3>
        <div class="space-y-3">
          ${[
            {id:'instagram', icon:'fab fa-instagram', color:'#E1306C', name:'Instagram', pts:10},
            {id:'facebook', icon:'fab fa-facebook', color:'#1877F2', name:'Facebook', pts:10},
            {id:'tiktok', icon:'fab fa-tiktok', color:'#69C9D0', name:'TikTok', pts:10},
            {id:'twitter', icon:'fab fa-twitter', color:'#1DA1F2', name:'Twitter/X', pts:10},
            {id:'linkedin', icon:'fab fa-linkedin', color:'#0A66C2', name:'LinkedIn', pts:10}
          ].map(s => `
            <div class="card flex items-center gap-4">
              <div class="w-10 h-10 rounded-full flex items-center justify-center" style="background:${s.color}20;border:1px solid ${s.color}40;">
                <i class="${s.icon}" style="color:${s.color}"></i>
              </div>
              <div class="flex-1">
                <div class="text-white font-semibold">${s.name}</div>
                <div class="text-slate-400 text-xs">Share your GigMatch profile</div>
              </div>
              <span class="badge badge-yellow text-xs">+${s.pts} pts</span>
              <button onclick="logShare('${s.id}')" class="btn-primary text-xs py-1 px-3">Share</button>
            </div>
          `).join('')}
        </div>
        
        <div class="mt-6 card">
          <h4 class="text-white font-semibold mb-3">How Points Work</h4>
          <div class="space-y-2 text-sm text-slate-400">
            <div class="flex gap-2"><span class="text-yellow-400">+10</span> Share profile on social media</div>
            <div class="flex gap-2"><span class="text-yellow-400">+5</span> Complete a booking & rate</div>
            <div class="flex gap-2"><span class="text-yellow-400">+20</span> Get a 5-star review</div>
            <div class="flex gap-2"><span class="text-yellow-400">+50</span> Get verified by GigMatch</div>
          </div>
        </div>
      </div>
    </div>
  `
}

async function logShare(platform) {
  const profileUrl = `${window.location.origin}/?performer=${currentProfile?.id}`
  const shareText = `Check out my music profile on GigMatch! 🎵 ${profileUrl}`
  
  const shareUrls = {
    instagram: `https://www.instagram.com/`, // Instagram doesn't support URL sharing
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`,
    tiktok: `https://www.tiktok.com/`
  }
  
  window.open(shareUrls[platform], '_blank')
  
  // Log the share for points
  const res = await apiCall('POST', '/performers/social-share', { platform, post_url: profileUrl })
  if (res.ok) {
    showToast(`${res.data.message} 🎉`)
    setTimeout(loadSocialSection, 1000)
  } else showToast(res.error, 'error')
}

// =====================
// ADMIN
// =====================
async function loadAdminStats() {
  const res = await apiCall('GET', '/admin/stats')
  if (!res.ok) return
  const s = res.data
  
  document.getElementById('admin-content').innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div class="card text-center"><div class="text-3xl font-black text-purple-400">${s.users}</div><div class="text-slate-400 text-sm">Users</div></div>
      <div class="card text-center"><div class="text-3xl font-black text-blue-400">${s.performers}</div><div class="text-slate-400 text-sm">Performers</div></div>
      <div class="card text-center"><div class="text-3xl font-black text-yellow-400">${s.hosts}</div><div class="text-slate-400 text-sm">Hosts</div></div>
      <div class="card text-center"><div class="text-3xl font-black text-green-400">${s.events}</div><div class="text-slate-400 text-sm">Events</div></div>
      <div class="card text-center"><div class="text-3xl font-black text-cyan-400">${s.bookings}</div><div class="text-slate-400 text-sm">Bookings</div></div>
      <div class="card text-center"><div class="text-3xl font-black text-orange-400">$${s.escrow_total?.toFixed(0)||0}</div><div class="text-slate-400 text-sm">In Escrow</div></div>
      <div class="card text-center"><div class="text-3xl font-black text-emerald-400">$${s.revenue?.toFixed(0)||0}</div><div class="text-slate-400 text-sm">Revenue (20%)</div></div>
      <div class="card text-center"><div class="text-3xl font-black text-red-400">${s.open_disputes}</div><div class="text-slate-400 text-sm">Open Disputes</div></div>
    </div>
    <div class="grid md:grid-cols-2 gap-4">
      <div class="card">
        <h3 class="font-bold text-white mb-3">Quick Actions</h3>
        <div class="space-y-2">
          <button onclick="switchAdminTab('users')" class="btn-secondary w-full text-left text-sm py-2"><i class="fas fa-users mr-2"></i>Manage Users</button>
          <button onclick="switchAdminTab('disputes')" class="btn-secondary w-full text-left text-sm py-2"><i class="fas fa-gavel mr-2"></i>Review Disputes (${s.open_disputes})</button>
          <button onclick="switchAdminTab('bookings')" class="btn-secondary w-full text-left text-sm py-2"><i class="fas fa-handshake mr-2"></i>All Bookings</button>
        </div>
      </div>
      <div class="card">
        <h3 class="font-bold text-white mb-3">Platform Health</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between"><span class="text-slate-400">Avg Rating</span><span class="text-white">${s.avg_rating} ⭐</span></div>
          <div class="flex justify-between"><span class="text-slate-400">Open Events</span><span class="text-white">${s.open_events}</span></div>
          <div class="flex justify-between"><span class="text-slate-400">Completed Bookings</span><span class="text-green-400">${s.completed_bookings}</span></div>
        </div>
      </div>
    </div>
  `
}

async function switchAdminTab(tab) {
  document.querySelectorAll('#admin-tabs .tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab)
  })
  
  const el = document.getElementById('admin-content')
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>'
  
  if (tab === 'stats') { loadAdminStats(); return }
  
  if (tab === 'users') {
    const res = await apiCall('GET', '/admin/users?limit=50')
    if (!res.ok) { el.innerHTML = `<p class="text-red-400">${res.error}</p>`; return }
    el.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="text-slate-400 text-left border-b border-white/10">
            <th class="pb-3 pr-4">Name</th><th class="pb-3 pr-4">Email</th><th class="pb-3 pr-4">Role</th>
            <th class="pb-3 pr-4">City</th><th class="pb-3 pr-4">Status</th><th class="pb-3">Actions</th>
          </tr></thead>
          <tbody class="space-y-2">
            ${(res.data.items||[]).map(u=>`
              <tr class="border-b border-white/5">
                <td class="py-3 pr-4 text-white">${u.name}</td>
                <td class="py-3 pr-4 text-slate-300">${u.email}</td>
                <td class="py-3 pr-4">${statusBadge(u.role)}</td>
                <td class="py-3 pr-4 text-slate-400">${u.city||'—'}</td>
                <td class="py-3 pr-4">${u.is_active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-red">Disabled</span>'}</td>
                <td class="py-3">
                  <button onclick="toggleUser('${u.id}')" class="text-xs ${u.is_active?'text-red-400':'text-green-400'} hover:underline mr-3">${u.is_active?'Disable':'Enable'}</button>
                  ${!u.is_verified ? `<button onclick="verifyUser('${u.id}')" class="text-xs text-blue-400 hover:underline">Verify</button>` : '<span class="text-xs text-blue-400"><i class="fas fa-check-circle"></i></span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
  }
  
  if (tab === 'bookings') {
    const res = await apiCall('GET', '/admin/bookings?limit=50')
    if (!res.ok) { el.innerHTML = ''; return }
    el.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="text-slate-400 text-left border-b border-white/10">
            <th class="pb-3 pr-4">Event</th><th class="pb-3 pr-4">Performer</th><th class="pb-3 pr-4">Host</th>
            <th class="pb-3 pr-4">Amount</th><th class="pb-3 pr-4">Status</th><th class="pb-3">Date</th>
          </tr></thead>
          <tbody>
            ${(res.data||[]).map(b=>`
              <tr class="border-b border-white/5">
                <td class="py-3 pr-4 text-white text-xs">${b.event_title}</td>
                <td class="py-3 pr-4 text-slate-300 text-xs">${b.performer_name}</td>
                <td class="py-3 pr-4 text-slate-300 text-xs">${b.host_name}</td>
                <td class="py-3 pr-4 text-green-400 font-semibold">$${b.total_amount?.toFixed(2)}</td>
                <td class="py-3 pr-4">${statusBadge(b.status)}</td>
                <td class="py-3 text-slate-500 text-xs">${b.event_date}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
  }
  
  if (tab === 'disputes') {
    const res = await apiCall('GET', '/admin/disputes')
    if (!res.ok) { el.innerHTML = ''; return }
    const disputes = res.data || []
    if (!disputes.length) { el.innerHTML = '<p class="text-green-400">No disputes! 🎉</p>'; return }
    el.innerHTML = disputes.map(d => `
      <div class="card mb-4">
        <div class="flex items-start justify-between mb-3">
          <div>
            <div class="text-white font-bold">${d.event_title}</div>
            <div class="text-slate-400 text-sm">Raised by: ${d.raised_by_name} · $${d.total_amount?.toFixed(2)} in escrow</div>
          </div>
          <span class="badge ${d.status==='open'?'badge-red':'badge-green'}">${d.status}</span>
        </div>
        <div class="text-slate-300 text-sm mb-3"><strong>Reason:</strong> ${d.reason}</div>
        <div class="text-slate-300 text-sm mb-4">${d.description}</div>
        ${d.status === 'open' ? `
          <div class="flex gap-2 flex-wrap">
            <button onclick="resolveDispute('${d.id}','resolved_performer')" class="btn-success text-xs py-1 px-3">Pay Performer</button>
            <button onclick="resolveDispute('${d.id}','resolved_host')" class="btn-danger text-xs py-1 px-3">Refund Host</button>
            <button onclick="resolveDispute('${d.id}','refunded')" class="btn-warning text-xs py-1 px-3">Split/Refund</button>
          </div>
        ` : '<span class="text-green-400 text-sm">✓ Resolved</span>'}
      </div>
    `).join('')
  }
  
  if (tab === 'events') {
    const res = await apiCall('GET', '/admin/events')
    if (!res.ok) { el.innerHTML = ''; return }
    el.innerHTML = `
      <div class="space-y-3">
        ${(res.data||[]).map(e=>`
          <div class="card flex items-center gap-4">
            <div class="flex-1">
              <div class="text-white font-semibold">${e.title}</div>
              <div class="text-slate-400 text-xs">${e.city} · ${e.event_date} · ${e.host_name}</div>
            </div>
            <span class="badge badge-yellow text-xs">${e.event_type}</span>
            ${statusBadge(e.status)}
          </div>
        `).join('')}
      </div>
    `
  }
}

async function toggleUser(id) {
  const res = await apiCall('PUT', `/admin/users/${id}/toggle`)
  if (res.ok) { showToast(res.data.message); switchAdminTab('users') }
  else showToast(res.error, 'error')
}

async function verifyUser(id) {
  const res = await apiCall('PUT', `/admin/users/${id}/verify`)
  if (res.ok) { showToast('User verified ✓'); switchAdminTab('users') }
  else showToast(res.error, 'error')
}

async function resolveDispute(id, resolution) {
  const notes = prompt('Resolution notes (optional):') || ''
  const res = await apiCall('PUT', `/admin/disputes/${id}/resolve`, { resolution, resolution_notes: notes })
  if (res.ok) { showToast('Dispute resolved'); switchAdminTab('disputes') }
  else showToast(res.error, 'error')
}

async function showBookingDetail(id) {
  showSection('bookings-section')
}

// =====================
// OAUTH / SOCIAL LOGIN
// =====================

// Stores pending OAuth data when a new user needs to pick a role
let pendingOAuth = null

// ── Google OAuth ──────────────────────────────────────────────────────────────
// Uses Google Identity Services (GSI) one-tap / popup flow
function socialLogin(provider) {
  if (provider === 'google') triggerGoogleLogin(null)
  else if (provider === 'facebook') triggerFacebookLogin(null)
}

// Called from the Register page — passes current role selection
function socialLoginWithRole(provider) {
  const role = document.getElementById('reg-role')?.value || null
  if (provider === 'google') triggerGoogleLogin(role)
  else if (provider === 'facebook') triggerFacebookLogin(role)
}

// ── Google ────────────────────────────────────────────────────────────────────
function triggerGoogleLogin(role) {
  if (typeof google === 'undefined' || !google?.accounts?.id) {
    showToast(currentLang==='pt'
      ? 'Google SDK ainda carregando. Tente novamente em um segundo.'
      : 'Google SDK still loading. Try again in a moment.', 'info')
    return
  }

  // IMPORTANT: Replace with your real Google Client ID in production
  // Get one at: https://console.cloud.google.com/apis/credentials
  const GOOGLE_CLIENT_ID = window.GOOGLE_CLIENT_ID ||
    '26276205789-placeholder.apps.googleusercontent.com'

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => handleGoogleCallback(response, role),
    auto_select: false,
  })
  google.accounts.id.prompt((notification) => {
    // Fallback to renderButton if prompt is suppressed
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      // Create a hidden div and render into it for the popup
      let div = document.getElementById('gsi-fallback-div')
      if (!div) { div = document.createElement('div'); div.id = 'gsi-fallback-div'; div.style.display = 'none'; document.body.appendChild(div) }
      google.accounts.id.renderButton(div, { theme: 'outline', size: 'large', type: 'standard' })
      div.querySelector('div[role=button]')?.click()
    }
  })
}

async function handleGoogleCallback(response, role) {
  const id_token = response.credential
  if (!id_token) { showToast('Google sign-in cancelled', 'error'); return }
  await finishOAuth('/auth/google', { id_token, role })
}

// ── Facebook ──────────────────────────────────────────────────────────────────
function triggerFacebookLogin(role) {
  if (typeof FB === 'undefined') {
    showToast(currentLang==='pt'
      ? 'Facebook SDK ainda carregando. Tente novamente.'
      : 'Facebook SDK still loading. Try again.', 'info')
    return
  }
  FB.login((response) => {
    if (response.authResponse) {
      handleFacebookCallback(response.authResponse.accessToken, role)
    } else {
      showToast(currentLang==='pt' ? 'Login com Facebook cancelado.' : 'Facebook login cancelled.', 'info')
    }
  }, { scope: 'public_profile,email' })
}

async function handleFacebookCallback(access_token, role) {
  await finishOAuth('/auth/facebook', { access_token, role })
}

// ── Common OAuth finish ────────────────────────────────────────────────────────
async function finishOAuth(endpoint, payload) {
  const isPt = currentLang === 'pt'

  // Disable social buttons to prevent double-click
  document.querySelectorAll('.social-oauth-btn').forEach(b => b.disabled = true)

  const res = await apiCall('POST', endpoint, payload)

  document.querySelectorAll('.social-oauth-btn').forEach(b => b.disabled = false)

  if (!res.ok) {
    showToast(res.error || (isPt ? 'Erro no login social.' : 'Social login error.'), 'error')
    return
  }

  // New user: needs to pick a role
  if (res.data.needs_role) {
    pendingOAuth = { endpoint, payload: { ...payload, _needsRole: true } }
    showOAuthRolePicker(res.data)
    return
  }

  // Success — log in
  authToken = res.data.token
  localStorage.setItem('gm_token', authToken)
  currentUser = res.data.user
  currentProfile = res.data.profile
  showToast(isPt ? `✅ Bem-vindo, ${currentUser.name}!` : `✅ Welcome, ${currentUser.name}!`)
  initApp()
}

// ── Role picker for new OAuth users ───────────────────────────────────────────
function showOAuthRolePicker(data) {
  const isPt = currentLang === 'pt'
  const title = document.getElementById('oauth-role-title')
  const sub   = document.getElementById('oauth-role-sub')
  const avatar= document.getElementById('oauth-role-avatar')

  if (title) title.textContent = isPt ? `Bem-vindo, ${data.name || ''}!` : `Welcome, ${data.name || ''}!`
  if (sub)   sub.textContent   = isPt ? 'Como você quer usar o GigMatch?' : 'How do you want to use GigMatch?'
  if (avatar) {
    if (data.avatar_url) {
      avatar.innerHTML = `<img src="${data.avatar_url}" style="width:100%;height:100%;object-fit:cover;">`
    } else {
      avatar.textContent = (data.name || '?').charAt(0).toUpperCase()
    }
  }

  // Store pending data
  pendingOAuth = { ...pendingOAuth, name: data.name, email: data.email,
                   google_id: data.google_id, fb_id: data.fb_id, avatar_url: data.avatar_url }
  openModal('oauth-role-modal')
}

async function completeOAuthRole(role) {
  closeModal('oauth-role-modal')
  if (!pendingOAuth) return

  // Re-call the same endpoint but now with role
  const { endpoint, payload } = pendingOAuth
  pendingOAuth = null
  await finishOAuth(endpoint, { ...payload, role })
}

// ── Update i18n strings for social buttons ────────────────────────────────────
function updateSocialButtonLabels() {
  const isPt = currentLang === 'pt'
  const loginOr = document.getElementById('login-social-or')
  const regOr   = document.getElementById('reg-social-or')
  if (loginOr) loginOr.textContent = isPt ? 'ou continue com' : 'or continue with'
  if (regOr)   regOr.textContent   = isPt ? 'ou cadastre com' : 'or register with'
}

// =====================
// I18N / LANGUAGE
// =====================
let currentLang = localStorage.getItem('gm_lang') || 'pt'

const T = {
  pt: {
    // Nav
    nav_how: 'Como Funciona', nav_performers: 'Para Artistas', nav_hosts: 'Para Contratantes',
    nav_signin: 'Entrar', nav_start: 'Começar',
    // Hero
    hero_badge: '🚀 O Futuro da Contratação de Música ao Vivo',
    hero_h1a: 'Conecte Música ao Vivo', hero_h1b: 'ao Evento Perfeito',
    hero_sub: 'Conecte bandas, DJs, solistas e conjuntos com contratantes. Pagamentos seguros em custódia, perfis verificados e tecnologia de geo-localização.',
    hero_btn_performer: '🎸 Sou Artista / Músico', hero_btn_host: '🎪 Preciso de Entretenimento',
    stat_artists: 'Artistas', stat_events: 'Shows Realizados', stat_sat: 'Satisfação', stat_cities: 'Cidades',
    // How
    how_title: 'Como Funciona o GigMatch', how_sub: 'Simples, seguro e sem complicações',
    how_1_title: '1. Crie seu Perfil', how_1_desc: 'Artistas adicionam portfólio, vídeos e valores. Contratantes descrevem o evento.',
    how_2_title: '2. Match por Localização', how_2_desc: 'Nosso algoritmo encontra artistas próximos que combinam com o evento.',
    how_3_title: '3. Contrate com Segurança', how_3_desc: 'Pagamentos em custódia. Liberados após ambas as partes avaliarem.',
    // For performers
    perf_title: 'Para Artistas & Músicos',
    perf_f1_t: 'Notificações georreferenciadas', perf_f1_d: 'Seja avisado quando eventos compatíveis forem postados na sua região.',
    perf_f2_t: 'Sistema de pontuação', perf_f2_d: 'Compartilhe nas redes sociais para ganhar pontos e subir nas buscas.',
    perf_f3_t: 'Pagamento garantido em custódia', perf_f3_d: 'Receba de forma confiável após cada show — 80% do valor contratado.',
    perf_f4_t: 'Portfólio multimídia', perf_f4_d: 'Exiba vídeos do YouTube, áudios, Spotify, SoundCloud e muito mais.',
    perf_cta: 'Cadastrar como Artista →',
    // For hosts
    host_title: 'Para Contratantes & Organizadores',
    host_f1_t: 'Match inteligente', host_f1_d: 'Filtre por gênero, tipo de atração, orçamento, distância e avaliações.',
    host_f2_t: 'Todos os tipos de evento', host_f2_d: 'Casamentos, corporativos, bares, lançamentos, festas e muito mais.',
    host_f3_t: 'Proteção contra disputas', host_f3_d: 'Dinheiro liberado somente após sua confirmação.',
    host_f4_t: 'Artistas verificados', host_f4_d: 'Perfis completos com avaliações verificadas e portfólios reais.',
    host_cta: 'Publicar Evento →',
    // CTA
    cta_title: 'Pronto para Fazer a Música Acontecer?', cta_sub: 'Junte-se a milhares de artistas e contratantes no GigMatch',
    cta_btn1: 'Começar a Tocar', cta_btn2: 'Organizar Evento',
    // Auth
    back: 'Voltar', login_title: 'Bem-vindo de Volta', login_sub: 'Entre na sua conta GigMatch',
    email: 'E-mail', password: 'Senha', login_btn: 'Entrar', login_no_acc: 'Não tem conta?', register: 'Cadastre-se',
    reg_title: 'Crie sua Conta', role_performer: 'Artista / Músico', role_performer_sub: 'Músicos, DJs, Artistas',
    role_host: 'Contratante', role_host_sub: 'Organizadores, Locais, Clientes',
    full_name: 'Nome Completo *', phone: 'Telefone', password_min: 'Senha * (mín. 8 caracteres)',
    city: 'Cidade', country: 'País', create_account: 'Criar Conta', have_acc: 'Já tem conta?', signin: 'Entrar',
    // Sidebar / Nav
    dashboard: 'Painel', find_performers: 'Encontrar Artistas', find_performers_sub: 'Navegue por músicos, bandas e artistas locais',
    browse_events: 'Explorar Eventos', browse_events_sub: 'Encontre eventos compatíveis com o seu estilo',
    my_bookings: 'Meus Contratos', my_bookings_sub: 'Gerencie seus shows e reservas',
    my_profile: 'Meu Perfil', my_profile_sub: 'Gerencie suas informações e portfólio',
    messages: 'Mensagens', notifications: 'Notificações', platform_score: 'Pontuação & Redes Sociais',
    platform_score_sub: 'Compartilhe seu perfil para ganhar pontos e aparecer primeiro nas buscas',
    admin_panel: 'Painel Admin', signout: 'Sair',
    // Sections
    recent_activity: 'Atividade Recente', select_conv: 'Selecione uma conversa',
    mark_all_read: 'Marcar todas como lidas', conversations: 'Conversas',
    // Bookings tabs
    all: 'Todos', pending: 'Pendente', active: 'Ativo', done: 'Concluído',
    // Event form
    create_event: 'Criar Novo Evento', event_title: 'Título do Evento *', event_type: 'Tipo de Evento *',
    expected_audience: 'Público Esperado', event_date: 'Data *', start_time: 'Início *', end_time: 'Fim *',
    duration_h: 'Duração (horas) *', venue_name: 'Nome do Local', address: 'Endereço *',
    budget_min: 'Orçamento Mín. (R$/h)', budget_max: 'Orçamento Máx. (R$/h)',
    act_types_needed: 'Tipos de Atração Necessários * (Ctrl+clique para múltiplos)',
    genres_preferred: 'Gêneros Preferidos', description: 'Descrição', objective: 'Objetivo do Evento',
    musical_taste: 'Preferência Musical', cancel: 'Cancelar', select: 'Selecione...',
    // Performer profile
    performer_profile: 'Perfil do Artista', event_details: 'Detalhes do Evento',
    apply_event: 'Candidatar-se ao Evento', rate_experience: 'Avaliar Experiência', open_dispute: 'Abrir Disputa',
    // Admin tabs
    overview: 'Visão Geral', users: 'Usuários', bookings: 'Contratos', disputes: 'Disputas', events_tab: 'Eventos',
    // Misc
    search: 'Buscar...', all_acts: 'Todos os Tipos', all_genres: 'Todos os Gêneros', all_types: 'Todos os Tipos',
    new_event: 'Novo Evento',
    // Carousel
    carousel_title: 'Conheça os Artistas', carousel_sub: 'De bandas de jazz a DJs, encontramos o talento perfeito para o seu evento',
  },
  en: {
    // Nav
    nav_how: 'How It Works', nav_performers: 'For Performers', nav_hosts: 'For Hosts',
    nav_signin: 'Sign In', nav_start: 'Get Started',
    // Hero
    hero_badge: '🚀 The Future of Live Music Booking',
    hero_h1a: 'Connect Live Music', hero_h1b: 'to the Perfect Event',
    hero_sub: 'Connect bands, DJs, soloists and ensembles with event hosts. Secure escrow payments, verified profiles and geo-location technology.',
    hero_btn_performer: '🎸 I\'m a Performer', hero_btn_host: '🎪 I Need Entertainment',
    stat_artists: 'Artists', stat_events: 'Shows Done', stat_sat: 'Satisfaction', stat_cities: 'Cities',
    // How
    how_title: 'How GigMatch Works', how_sub: 'Simple, secure and hassle-free',
    how_1_title: '1. Create Your Profile', how_1_desc: 'Performers add portfolio, videos and rates. Hosts describe the event.',
    how_2_title: '2. Location Match', how_2_desc: 'Our algorithm finds nearby performers matching the event criteria.',
    how_3_title: '3. Book Safely', how_3_desc: 'Funds held in escrow. Released after both parties rate.',
    // For performers
    perf_title: 'For Artists & Musicians',
    perf_f1_t: 'Geo-referenced notifications', perf_f1_d: 'Get notified when compatible events are posted in your area.',
    perf_f2_t: 'Scoring system', perf_f2_d: 'Share on social media to earn points and rank higher in searches.',
    perf_f3_t: 'Guaranteed escrow payment', perf_f3_d: 'Get paid reliably after each show — 80% of the contracted value.',
    perf_f4_t: 'Multimedia portfolio', perf_f4_d: 'Show YouTube videos, audio, Spotify, SoundCloud and more.',
    perf_cta: 'Register as Performer →',
    // For hosts
    host_title: 'For Event Hosts & Organizers',
    host_f1_t: 'Smart matching', host_f1_d: 'Filter by genre, act type, budget, distance and ratings.',
    host_f2_t: 'All event types', host_f2_d: 'Weddings, corporate, bars, launches, parties and more.',
    host_f3_t: 'Dispute protection', host_f3_d: 'Funds released only after your confirmation.',
    host_f4_t: 'Verified performers', host_f4_d: 'Complete profiles with verified ratings and real portfolios.',
    host_cta: 'Post an Event →',
    // CTA
    cta_title: 'Ready to Make Music Happen?', cta_sub: 'Join thousands of performers and hosts on GigMatch',
    cta_btn1: 'Start Performing', cta_btn2: 'Organize Event',
    // Auth
    back: 'Back', login_title: 'Welcome Back', login_sub: 'Sign in to your GigMatch account',
    email: 'Email', password: 'Password', login_btn: 'Sign In', login_no_acc: 'Don\'t have an account?', register: 'Register',
    reg_title: 'Create Your Account', role_performer: 'Performer / Musician', role_performer_sub: 'Musicians, DJs, Artists',
    role_host: 'Event Host', role_host_sub: 'Organizers, Venues, Clients',
    full_name: 'Full Name *', phone: 'Phone', password_min: 'Password * (min. 8 characters)',
    city: 'City', country: 'Country', create_account: 'Create Account', have_acc: 'Already have an account?', signin: 'Sign In',
    // Sidebar / Nav
    dashboard: 'Dashboard', find_performers: 'Find Performers', find_performers_sub: 'Browse local musicians, bands and artists',
    browse_events: 'Browse Events', browse_events_sub: 'Find events that match your style',
    my_bookings: 'My Bookings', my_bookings_sub: 'Manage your gigs and reservations',
    my_profile: 'My Profile', my_profile_sub: 'Manage your info and portfolio',
    messages: 'Messages', notifications: 'Notifications', platform_score: 'Score & Social Media',
    platform_score_sub: 'Share your profile to earn points and appear first in searches',
    admin_panel: 'Admin Panel', signout: 'Sign Out',
    // Sections
    recent_activity: 'Recent Activity', select_conv: 'Select a conversation',
    mark_all_read: 'Mark all as read', conversations: 'Conversations',
    // Bookings tabs
    all: 'All', pending: 'Pending', active: 'Active', done: 'Done',
    // Event form
    create_event: 'Create New Event', event_title: 'Event Title *', event_type: 'Event Type *',
    expected_audience: 'Expected Audience', event_date: 'Date *', start_time: 'Start Time *', end_time: 'End Time *',
    duration_h: 'Duration (hours) *', venue_name: 'Venue Name', address: 'Address *',
    budget_min: 'Min Budget ($/h)', budget_max: 'Max Budget ($/h)',
    act_types_needed: 'Act Types Needed * (Ctrl+click for multiple)',
    genres_preferred: 'Preferred Genres', description: 'Description', objective: 'Event Objective',
    musical_taste: 'Musical Preference', cancel: 'Cancel', select: 'Select...',
    // Performer profile
    performer_profile: 'Performer Profile', event_details: 'Event Details',
    apply_event: 'Apply for Event', rate_experience: 'Rate Experience', open_dispute: 'Open Dispute',
    // Admin tabs
    overview: 'Overview', users: 'Users', bookings: 'Bookings', disputes: 'Disputes', events_tab: 'Events',
    // Misc
    search: 'Search...', all_acts: 'All Types', all_genres: 'All Genres', all_types: 'All Types',
    new_event: 'New Event',
    // Carousel
    carousel_title: 'Meet the Artists', carousel_sub: 'From jazz bands to DJs, we find the perfect talent for your event',
  }
}

function t(key) {
  return T[currentLang]?.[key] || T['pt'][key] || key
}

function setLang(lang) {
  currentLang = lang
  localStorage.setItem('gm_lang', lang)
  // Update all lang buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim().toLowerCase() === lang)
  })
  // Update all data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n')
    if (T[lang]?.[key]) el.textContent = T[lang][key]
  })
  // Update placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder')
    if (T[lang]?.[key]) el.placeholder = T[lang][key]
  })
  // Re-render nav links with new language
  if (currentUser) setupSidebar()
  // Update social button labels
  updateSocialButtonLabels()
}

// =====================
// ARTIST CAROUSEL
// =====================
const ARTIST_CARDS = [
  {
    img: 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=480',
    type: '🎸 Banda / Band', genre: 'Rock · Pop · Indie',
    name: 'The Soundwaves', rate: 'R$400/h', emoji: '🎸'
  },
  {
    img: 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=480',
    type: '🎧 DJ', genre: 'Electronic · Dance · House',
    name: 'DJ Nova', rate: 'R$350/h', emoji: '🎧'
  },
  {
    img: 'https://images.pexels.com/photos/995301/pexels-photo-995301.jpeg?auto=compress&cs=tinysrgb&w=480',
    type: '🎻 Quarteto de Cordas', genre: 'Clássico · Romântico',
    name: 'Ensemble Bravo', rate: 'R$500/h', emoji: '🎻'
  },
  {
    img: 'https://images.pexels.com/photos/1771838/pexels-photo-1771838.jpeg?auto=compress&cs=tinysrgb&w=480',
    type: '🎹 Pianista Solo', genre: 'Jazz · Clássico · MPB',
    name: 'Clara Mendes', rate: 'R$250/h', emoji: '🎹'
  },
  {
    img: 'https://images.pexels.com/photos/167636/pexels-photo-167636.jpeg?auto=compress&cs=tinysrgb&w=480',
    type: '🎷 Banda de Jazz', genre: 'Jazz · Blues · Swing',
    name: 'Jazz Collective', rate: 'R$600/h', emoji: '🎷'
  },
  {
    img: 'https://images.pexels.com/photos/1699161/pexels-photo-1699161.jpeg?auto=compress&cs=tinysrgb&w=480',
    type: '🎤 Cantor(a) Solo', genre: 'Pop · R&B · Soul',
    name: 'Ana Lima', rate: 'R$300/h', emoji: '🎤'
  },
  {
    img: 'https://images.pexels.com/photos/210887/pexels-photo-210887.jpeg?auto=compress&cs=tinysrgb&w=480',
    type: '🥁 Baterista', genre: 'Rock · Funk · Jazz',
    name: 'Marcos Batista', rate: 'R$200/h', emoji: '🥁'
  },
  {
    img: 'https://images.pexels.com/photos/1021876/pexels-photo-1021876.jpeg?auto=compress&cs=tinysrgb&w=480',
    type: '🎸 Dupla Acústica', genre: 'Folk · MPB · Bossa Nova',
    name: 'Acoustic Duo', rate: 'R$280/h', emoji: '🎸'
  },
]

let carouselIndex = 0
let carouselAutoTimer = null

function initCarousel() {
  const track = document.getElementById('artist-carousel')
  const dotsEl = document.getElementById('carousel-dots')
  if (!track) return

  track.innerHTML = ARTIST_CARDS.map((card, i) => `
    <div class="carousel-card" onclick="showRegisterAs('host')">
      <img src="${card.img}" alt="${card.type}" loading="lazy" onerror="this.src='https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&w=480'">
      <div class="carousel-card-overlay">
        <div class="text-white font-bold text-sm">${card.name}</div>
        <div class="text-slate-300 text-xs">${card.type}</div>
        <div class="text-slate-400 text-xs">${card.genre}</div>
        <div class="text-purple-400 font-bold text-sm mt-1">${card.rate}</div>
      </div>
    </div>
  `).join('')

  // Dots
  const visibleCount = Math.ceil(ARTIST_CARDS.length / 3)
  if (dotsEl) {
    dotsEl.innerHTML = ARTIST_CARDS.map((_, i) =>
      `<button class="carousel-dot ${i===0?'active':''}" onclick="goToCarousel(${i})"></button>`
    ).join('')
  }

  // Auto-play
  carouselAutoTimer = setInterval(carouselNext, 3500)
}

function carouselNext() {
  carouselIndex = (carouselIndex + 1) % ARTIST_CARDS.length
  updateCarousel()
}

function carouselPrev() {
  carouselIndex = (carouselIndex - 1 + ARTIST_CARDS.length) % ARTIST_CARDS.length
  updateCarousel()
}

function goToCarousel(i) {
  carouselIndex = i
  updateCarousel()
  clearInterval(carouselAutoTimer)
  carouselAutoTimer = setInterval(carouselNext, 3500)
}

function updateCarousel() {
  const track = document.getElementById('artist-carousel')
  if (!track) return
  // Calculate card width + gap = 240 + 16 = 256px
  const offset = carouselIndex * 256
  track.style.transform = `translateX(-${offset}px)`
  document.querySelectorAll('.carousel-dot').forEach((d, i) => {
    d.classList.toggle('active', i === carouselIndex)
  })
}

// =====================
// EVENT WIZARD
// =====================
let wizardStep = 0
let wizardData = {}
let wizardEventMeta = { eventTypes: [], actTypes: [], genres: [] }

const WIZARD_STEPS = [
  { id: 'type',      emoji: '🎪', titlePt: 'Que tipo de evento é?',           titleEn: 'What kind of event is it?',
    hintPt: 'Escolha o tipo que melhor descreve sua festa ou evento. Isso nos ajuda a encontrar os artistas certos!',
    hintEn: 'Pick the type that best describes your event. This helps us find the right artists!' },
  { id: 'vibe',      emoji: '🎵', titlePt: 'Qual é o clima da festa?',         titleEn: "What's the vibe?",
    hintPt: 'Nos conte sobre o estilo musical e a atmosfera que você quer criar. Não tem resposta errada!',
    hintEn: 'Tell us about the musical style and atmosphere you want to create. There\'s no wrong answer!' },
  { id: 'details',   emoji: '📅', titlePt: 'Quando e onde vai acontecer?',     titleEn: 'When and where?',
    hintPt: 'Informe a data, hora e local do evento. Artistas próximos serão notificados automaticamente!',
    hintEn: 'Tell us the date, time and location. Nearby artists will be notified automatically!' },
  { id: 'artists',   emoji: '🎸', titlePt: 'Que artistas você precisa?',       titleEn: 'What artists do you need?',
    hintPt: 'Selecione os tipos de atrações que você quer. Pode escolher mais de um!',
    hintEn: 'Select the types of acts you want. You can pick more than one!' },
  { id: 'budget',    emoji: '💰', titlePt: 'Qual é o seu orçamento?',          titleEn: "What's your budget?",
    hintPt: 'Sem pressão! Isso é só para ajudar os artistas a fazerem propostas compatíveis com o seu bolso.',
    hintEn: 'No pressure! This just helps artists make proposals that fit your budget.' },
  { id: 'final',     emoji: '✨', titlePt: 'Últimos detalhes!',               titleEn: 'Final details!',
    hintPt: 'Quase lá! Adicione um título bacana e qualquer informação extra que os artistas devem saber.',
    hintEn: "Almost there! Add a cool title and any extra info the artists should know." },
]

const EVENT_TYPE_EMOJIS = {
  'Casamento / Wedding': '💍', 'Aniversário / Birthday': '🎂', 'Corporativo / Corporate': '💼',
  'Bar / Clube / Bar Club': '🍸', 'Festival': '🎪', 'Formatura / Graduation': '🎓',
  'Batizado / Baptism': '✝️', 'Confraternização / Company Party': '🥂',
  'Show Privado / Private Show': '🎭', 'Restaurante / Restaurant': '🍽️',
  'Cerimônia / Ceremony': '🕊️', 'Outro / Other': '✨'
}

const ACT_EMOJIS = {
  'Banda / Band': '🎸', 'Artista Solo / Solo Artist': '🎤', 'DJ': '🎧',
  'Violinista / Violinist': '🎻', 'Pianista / Pianist': '🎹', 'Banda de Jazz / Jazz Band': '🎷',
  'Cantor(a) / Singer': '🎤', 'Guitarrista / Guitarist': '🎸', 'Baterista / Drummer': '🥁',
  'Quarteto de Cordas / String Quartet': '🎻', 'Banda Cover / Cover Band': '🎵',
  'Dupla Acústica / Acoustic Duo': '🎸', 'Artista Eletrônico / Electronic Artist': '🎧',
  'Saxofonista / Saxophonist': '🎷', 'Outro / Other': '🎵'
}

const VIBE_OPTIONS = [
  { key: 'romantic',    labelPt: 'Romântico & Elegante',       labelEn: 'Romantic & Elegant',        emoji: '🌹' },
  { key: 'party',       labelPt: 'Animado & Dançante',         labelEn: 'Energetic & Dance',          emoji: '🕺' },
  { key: 'corporate',   labelPt: 'Profissional & Corporativo', labelEn: 'Professional & Corporate',  emoji: '🤵' },
  { key: 'acoustic',    labelPt: 'Acústico & Intimista',       labelEn: 'Acoustic & Intimate',        emoji: '🎸' },
  { key: 'classic',     labelPt: 'Clássico & Sofisticado',     labelEn: 'Classic & Sophisticated',   emoji: '🎻' },
  { key: 'fun',         labelPt: 'Descontraído & Divertido',   labelEn: 'Relaxed & Fun',              emoji: '😄' },
  { key: 'jazz',        labelPt: 'Jazz & Blues',                labelEn: 'Jazz & Blues',               emoji: '🎷' },
  { key: 'electronic',  labelPt: 'Eletrônico & Moderno',       labelEn: 'Electronic & Modern',       emoji: '🎧' },
]

const BUDGET_OPTIONS = [
  { labelPt: 'Flexível — vou ver as propostas',   labelEn: 'Flexible — I\'ll review proposals',     min: null, max: null },
  { labelPt: 'Econômico (até R$200/h)',           labelEn: 'Budget (up to R$200/h)',                 min: 0, max: 200 },
  { labelPt: 'Moderado (R$200 – R$400/h)',        labelEn: 'Moderate (R$200 – R$400/h)',             min: 200, max: 400 },
  { labelPt: 'Confortável (R$400 – R$700/h)',     labelEn: 'Comfortable (R$400 – R$700/h)',          min: 400, max: 700 },
  { labelPt: 'Premium (acima de R$700/h)',        labelEn: 'Premium (above R$700/h)',                min: 700, max: null },
]

function openEventWizard() {
  wizardStep = 0
  wizardData = { selectedActTypes: [], selectedGenres: [], selectedVibe: '' }
  openModal('create-event-modal')
  loadEventMeta().then(() => renderWizardStep())
}

function renderWizardStep() {
  const isPt = currentLang === 'pt'
  const step = WIZARD_STEPS[wizardStep]
  const total = WIZARD_STEPS.length
  const pct = Math.round(((wizardStep + 1) / total) * 100)

  document.getElementById('wizard-title').textContent = `${step.emoji} ${isPt ? step.titlePt : step.titleEn}`
  document.getElementById('wizard-step-label').textContent = isPt ? `Passo ${wizardStep + 1} de ${total}` : `Step ${wizardStep + 1} of ${total}`
  document.getElementById('wizard-step-count').textContent = `${pct}%`
  document.getElementById('wizard-progress').style.width = pct + '%'
  document.getElementById('wizard-back-btn').style.display = wizardStep > 0 ? '' : 'none'
  document.getElementById('wizard-back-label').textContent = isPt ? 'Voltar' : 'Back'
  document.getElementById('wizard-next-label').textContent =
    wizardStep === total - 1 ? (isPt ? '🚀 Publicar Evento!' : '🚀 Publish Event!') : (isPt ? 'Próximo →' : 'Next →')

  const hint = isPt ? step.hintPt : step.hintEn
  const content = document.getElementById('wizard-step-content')

  if (step.id === 'type') {
    const types = wizardEventMeta.eventTypes.length
      ? wizardEventMeta.eventTypes
      : Object.keys(EVENT_TYPE_EMOJIS)
    content.innerHTML = `
      <div class="wizard-hint">💡 ${hint}</div>
      <div class="wizard-option-grid">
        ${types.map(tp => `
          <button type="button" class="wizard-option ${wizardData.eventType === tp ? 'selected' : ''}" onclick="wSelectType('${tp.replace(/'/g,"\\'")}')">
            <span class="wizard-emoji">${EVENT_TYPE_EMOJIS[tp] || '🎪'}</span>
            <div class="font-semibold text-sm">${tp}</div>
          </button>
        `).join('')}
      </div>
    `
  }

  else if (step.id === 'vibe') {
    content.innerHTML = `
      <div class="wizard-hint">💡 ${hint}</div>
      <div class="wizard-option-grid">
        ${VIBE_OPTIONS.map(v => `
          <button type="button" class="wizard-option ${wizardData.selectedVibe === v.key ? 'selected' : ''}" onclick="wSelectVibe('${v.key}')">
            <span class="wizard-emoji">${v.emoji}</span>
            <div class="font-semibold text-sm">${isPt ? v.labelPt : v.labelEn}</div>
          </button>
        `).join('')}
      </div>
      <div class="mt-4">
        <label class="block text-sm text-slate-300 mb-2">${isPt ? '🎵 Gêneros Musicais Preferidos (opcional)' : '🎵 Preferred Music Genres (optional)'}</label>
        <div class="flex flex-wrap">
          ${(wizardEventMeta.genres || []).slice(0, 20).map(g => `
            <span class="act-chip ${(wizardData.selectedGenres||[]).includes(g) ? 'selected' : ''}" onclick="wToggleGenre('${g.replace(/'/g,"\\'")}')">
              ${g}
            </span>`).join('')}
        </div>
      </div>
    `
  }

  else if (step.id === 'details') {
    const today = new Date().toISOString().split('T')[0]
    content.innerHTML = `
      <div class="wizard-hint">💡 ${hint}</div>
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm text-slate-300 mb-1">📅 ${isPt ? 'Data do Evento *' : 'Event Date *'}</label>
            <input type="date" id="wiz-date" class="input-field" value="${wizardData.date || ''}" min="${today}" oninput="wizardData.date=this.value">
          </div>
          <div>
            <label class="block text-sm text-slate-300 mb-1">👥 ${isPt ? 'Quantas pessoas?' : 'How many guests?'}</label>
            <input type="number" id="wiz-audience" class="input-field" value="${wizardData.audience || ''}" placeholder="100" oninput="wizardData.audience=this.value">
          </div>
          <div>
            <label class="block text-sm text-slate-300 mb-1">🕐 ${isPt ? 'Hora de Início *' : 'Start Time *'}</label>
            <input type="time" id="wiz-start" class="input-field" value="${wizardData.startTime || '19:00'}" oninput="wizardData.startTime=this.value">
          </div>
          <div>
            <label class="block text-sm text-slate-300 mb-1">🕕 ${isPt ? 'Hora de Término *' : 'End Time *'}</label>
            <input type="time" id="wiz-end" class="input-field" value="${wizardData.endTime || '23:00'}" oninput="wizardData.endTime=this.value">
          </div>
        </div>
        <div>
          <label class="block text-sm text-slate-300 mb-1">🏛️ ${isPt ? 'Nome do Local' : 'Venue Name'}</label>
          <input type="text" id="wiz-venue" class="input-field" value="${wizardData.venue || ''}" placeholder="${isPt ? 'Ex: Espaço Villa, Sítio das Rosas...' : 'e.g. Grand Ballroom, Rooftop Bar...'}" oninput="wizardData.venue=this.value">
        </div>
        <div>
          <label class="block text-sm text-slate-300 mb-1">📍 ${isPt ? 'Endereço *' : 'Address *'}</label>
          <input type="text" id="wiz-address" class="input-field" value="${wizardData.address || ''}" placeholder="${isPt ? 'Rua, número, bairro...' : 'Street, number, neighborhood...'}" oninput="wizardData.address=this.value">
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm text-slate-300 mb-1">🌆 ${isPt ? 'Cidade *' : 'City *'}</label>
            <input type="text" id="wiz-city" class="input-field" value="${wizardData.city || ''}" oninput="wizardData.city=this.value">
          </div>
          <div>
            <label class="block text-sm text-slate-300 mb-1">🌎 ${isPt ? 'País *' : 'Country *'}</label>
            <input type="text" id="wiz-country" class="input-field" value="${wizardData.country || 'Brasil'}" oninput="wizardData.country=this.value">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm text-slate-300 mb-1">📐 Latitude <span class="text-slate-500 text-xs">(${isPt ? 'opcional' : 'optional'})</span></label>
            <input type="number" id="wiz-lat" class="input-field" step="any" value="${wizardData.lat || ''}" placeholder="-23.5505" oninput="wizardData.lat=parseFloat(this.value)||null">
          </div>
          <div>
            <label class="block text-sm text-slate-300 mb-1">📐 Longitude <span class="text-slate-500 text-xs">(${isPt ? 'opcional' : 'optional'})</span></label>
            <input type="number" id="wiz-lon" class="input-field" step="any" value="${wizardData.lon || ''}" placeholder="-46.6333" oninput="wizardData.lon=parseFloat(this.value)||null">
          </div>
        </div>
        <div class="flex gap-2">
          <button type="button" id="wiz-gps-btn" onclick="wGetLocation(this)" class="btn-secondary text-sm py-2 flex-1">
            📍 ${isPt ? 'Usar minha localização atual' : 'Use my current location'}
          </button>
          <button type="button" id="wiz-geocode-btn" onclick="wGeocodeCity(this)" class="btn-secondary text-sm py-2 flex-1">
            🔍 ${isPt ? 'Buscar coordenadas pela cidade' : 'Look up city coordinates'}
          </button>
        </div>
        ${wizardData.lat && wizardData.lon ? `<p class="text-xs text-green-400">✅ ${isPt ? 'Coordenadas definidas:' : 'Coordinates set:'} ${Number(wizardData.lat).toFixed(4)}, ${Number(wizardData.lon).toFixed(4)}</p>` : `<p class="text-xs text-slate-500">ℹ️ ${isPt ? 'Coordenadas são opcionais – a cidade é suficiente.' : 'Coordinates are optional – city is enough to save the event.'}</p>`}
      </div>
    `
  }

  else if (step.id === 'artists') {
    const acts = wizardEventMeta.actTypes.length
      ? wizardEventMeta.actTypes
      : Object.keys(ACT_EMOJIS)
    content.innerHTML = `
      <div class="wizard-hint">💡 ${hint}</div>
      <p class="text-slate-400 text-sm mb-4">${isPt ? 'Clique para selecionar (pode escolher vários)' : 'Click to select (you can pick several)'}</p>
      <div class="flex flex-wrap">
        ${acts.map(a => `
          <span class="act-chip ${(wizardData.selectedActTypes||[]).includes(a) ? 'selected' : ''}" onclick="wToggleActType('${a.replace(/'/g,"\\'")}')">
            ${ACT_EMOJIS[a] || '🎵'} ${a}
          </span>`).join('')}
      </div>
    `
  }

  else if (step.id === 'budget') {
    content.innerHTML = `
      <div class="wizard-hint">💡 ${hint}</div>
      <div class="space-y-3">
        ${BUDGET_OPTIONS.map((b, i) => `
          <button type="button" class="wizard-option ${wizardData.budgetIndex === i ? 'selected' : ''} flex items-center gap-3"
            onclick="wSelectBudget(${i},${b.min},${b.max})">
            <span class="text-xl">${['🤷','💚','💛','💜','💎'][i]}</span>
            <span class="font-medium">${isPt ? b.labelPt : b.labelEn}</span>
          </button>
        `).join('')}
      </div>
      <div class="mt-4">
        <label class="block text-sm text-slate-300 mb-1">⏱️ ${isPt ? 'Duração do Show (horas) *' : 'Show Duration (hours) *'}</label>
        <div class="flex gap-3 flex-wrap">
          ${[1,2,3,4,5,6].map(h => `
            <button type="button" class="act-chip ${wizardData.duration === h ? 'selected' : ''}" onclick="wSelectDuration(${h})">
              ${h}h
            </button>`).join('')}
        </div>
      </div>
    `
  }

  else if (step.id === 'final') {
    const vibeLabel = VIBE_OPTIONS.find(v => v.key === wizardData.selectedVibe)
    const vibeTxt = vibeLabel ? (isPt ? vibeLabel.labelPt : vibeLabel.labelEn) : ''
    content.innerHTML = `
      <div class="wizard-hint">💡 ${hint}</div>
      <div class="space-y-4">
        <div>
          <label class="block text-sm text-slate-300 mb-1">✏️ ${isPt ? 'Título do Evento *' : 'Event Title *'}
            <span class="text-slate-500 text-xs ml-2">${isPt ? '(dê um nome bacana para o seu evento!)' : '(give your event a cool name!)'}</span>
          </label>
          <input type="text" id="wiz-title" class="input-field" value="${wizardData.title || ''}"
            placeholder="${isPt ? 'Ex: Casamento dos Sonhos da Ana & João 💍' : 'e.g. Ana & João\'s Dream Wedding 💍'}"
            oninput="wizardData.title=this.value">
        </div>
        <div>
          <label class="block text-sm text-slate-300 mb-1">📝 ${isPt ? 'Conte mais sobre o evento' : 'Tell us more about the event'}
            <span class="text-slate-500 text-xs ml-2">${isPt ? '(opcional, mas ajuda muito!)' : '(optional, but really helps!)'}</span>
          </label>
          <textarea id="wiz-desc" class="input-field" rows="3"
            placeholder="${isPt ? 'Ex: Casamento ao ar livre com 150 convidados. Queremos música ao vivo durante o jantar e festa depois...' : 'e.g. Outdoor wedding with 150 guests. We want live music during dinner and dancing after...'}"
            oninput="wizardData.description=this.value">${wizardData.description || ''}</textarea>
        </div>
        <div>
          <label class="block text-sm text-slate-300 mb-1">🎯 ${isPt ? 'Objetivo do evento' : 'Event objective'}
            <span class="text-slate-500 text-xs ml-2">${isPt ? '(para que tipo de experiência você quer criar?)' : '(what experience do you want to create?)'}</span>
          </label>
          <input type="text" id="wiz-objective" class="input-field" value="${wizardData.objective || ''}"
            placeholder="${isPt ? 'Ex: Emocionar os noivos e convidados, criar um ambiente inesquecível...' : 'e.g. Create an unforgettable atmosphere, wow the guests...'}"
            oninput="wizardData.objective=this.value">
        </div>
        <!-- Summary card -->
        <div class="card" style="background:rgba(124,58,237,.08);border-color:rgba(124,58,237,.2);">
          <h4 class="text-purple-300 font-semibold mb-3">📋 ${isPt ? 'Resumo do Evento' : 'Event Summary'}</h4>
          <div class="space-y-1 text-sm">
            ${wizardData.eventType ? `<div><span class="text-slate-400">${isPt?'Tipo:':'Type:'}</span> <span class="text-white">${EVENT_TYPE_EMOJIS[wizardData.eventType]||'🎪'} ${wizardData.eventType}</span></div>` : ''}
            ${wizardData.date ? `<div><span class="text-slate-400">${isPt?'Data:':'Date:'}</span> <span class="text-white">${wizardData.date}</span></div>` : ''}
            ${wizardData.city ? `<div><span class="text-slate-400">${isPt?'Cidade:':'City:'}</span> <span class="text-white">${wizardData.city}</span></div>` : ''}
            ${wizardData.selectedActTypes?.length ? `<div><span class="text-slate-400">${isPt?'Atrações:':'Acts:'}</span> <span class="text-white">${wizardData.selectedActTypes.join(', ')}</span></div>` : ''}
            ${wizardData.budgetIndex !== undefined ? `<div><span class="text-slate-400">${isPt?'Orçamento:':'Budget:'}</span> <span class="text-green-400">${isPt ? BUDGET_OPTIONS[wizardData.budgetIndex].labelPt : BUDGET_OPTIONS[wizardData.budgetIndex].labelEn}</span></div>` : ''}
            ${vibeTxt ? `<div><span class="text-slate-400">${isPt?'Clima:':'Vibe:'}</span> <span class="text-white">${vibeTxt}</span></div>` : ''}
          </div>
        </div>
      </div>
    `
  }
}

function wSelectType(tp) {
  wizardData.eventType = tp
  renderWizardStep()
}

function wSelectVibe(key) {
  wizardData.selectedVibe = key
  const vibeLabel = VIBE_OPTIONS.find(v => v.key === key)
  const isPt = currentLang === 'pt'
  wizardData.musicalTaste = isPt ? vibeLabel?.labelPt : vibeLabel?.labelEn
  renderWizardStep()
}

function wToggleGenre(g) {
  if (!wizardData.selectedGenres) wizardData.selectedGenres = []
  const idx = wizardData.selectedGenres.indexOf(g)
  if (idx > -1) wizardData.selectedGenres.splice(idx, 1)
  else wizardData.selectedGenres.push(g)
  renderWizardStep()
}

function wToggleActType(a) {
  if (!wizardData.selectedActTypes) wizardData.selectedActTypes = []
  const idx = wizardData.selectedActTypes.indexOf(a)
  if (idx > -1) wizardData.selectedActTypes.splice(idx, 1)
  else wizardData.selectedActTypes.push(a)
  renderWizardStep()
}

function wSelectBudget(i, min, max) {
  wizardData.budgetIndex = i
  wizardData.budgetMin = min
  wizardData.budgetMax = max
  renderWizardStep()
}

function wSelectDuration(h) {
  wizardData.duration = h
  renderWizardStep()
}

function wGetLocation(btn) {
  const isPt = currentLang === 'pt'
  if (!navigator.geolocation) {
    showToast(isPt ? 'Geolocalização não suportada neste navegador.' : 'Geolocation not supported in this browser.', 'error')
    return
  }
  btn.textContent = isPt ? '⏳ Obtendo localização...' : '⏳ Getting location...'
  btn.disabled = true
  navigator.geolocation.getCurrentPosition(pos => {
    wizardData.lat = pos.coords.latitude
    wizardData.lon = pos.coords.longitude
    const latEl = document.getElementById('wiz-lat')
    const lonEl = document.getElementById('wiz-lon')
    if (latEl) latEl.value = wizardData.lat.toFixed(6)
    if (lonEl) lonEl.value = wizardData.lon.toFixed(6)
    btn.textContent = `✅ ${isPt ? 'Localização obtida!' : 'Location obtained!'}`
    btn.disabled = false
    showToast(isPt ? '📍 Coordenadas obtidas com sucesso!' : '📍 Coordinates obtained successfully!')
  }, (err) => {
    btn.textContent = isPt ? '📍 Usar minha localização atual' : '📍 Use my current location'
    btn.disabled = false
    const msg = err.code === 1
      ? (isPt ? 'Permissão de localização negada. Use "Buscar pela cidade" ou preencha manualmente.' : 'Location permission denied. Use "Look up city" or fill manually.')
      : (isPt ? 'Não foi possível obter localização. Tente buscar pela cidade.' : 'Could not get location. Try looking up by city.')
    showToast(msg, 'info')
  }, { timeout: 10000 })
}

async function wGeocodeCity(btn) {
  const isPt = currentLang === 'pt'
  const city = document.getElementById('wiz-city')?.value?.trim()
  const country = document.getElementById('wiz-country')?.value?.trim()
  if (!city) {
    showToast(isPt ? 'Preencha a cidade primeiro!' : 'Please fill in the city first!', 'info')
    return
  }
  btn.textContent = isPt ? '⏳ Buscando...' : '⏳ Looking up...'
  btn.disabled = true
  try {
    const q = encodeURIComponent(`${city}${country ? ', ' + country : ''}`)
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
      headers: { 'Accept-Language': isPt ? 'pt' : 'en', 'User-Agent': 'GigMatch/1.0' }
    })
    const data = await res.json()
    if (data && data[0]) {
      wizardData.lat = parseFloat(data[0].lat)
      wizardData.lon = parseFloat(data[0].lon)
      const latEl = document.getElementById('wiz-lat')
      const lonEl = document.getElementById('wiz-lon')
      if (latEl) latEl.value = wizardData.lat.toFixed(6)
      if (lonEl) lonEl.value = wizardData.lon.toFixed(6)
      btn.textContent = `✅ ${isPt ? 'Encontrado!' : 'Found!'}`
      showToast(isPt ? `📍 Coordenadas de "${city}" encontradas!` : `📍 Coordinates for "${city}" found!`)
    } else {
      btn.textContent = isPt ? '🔍 Buscar coordenadas pela cidade' : '🔍 Look up city coordinates'
      showToast(isPt ? `Cidade "${city}" não encontrada. Verifique o nome.` : `City "${city}" not found. Check the spelling.`, 'error')
    }
  } catch (e) {
    btn.textContent = isPt ? '🔍 Buscar coordenadas pela cidade' : '🔍 Look up city coordinates'
    showToast(isPt ? 'Erro ao buscar coordenadas. Tente mais tarde.' : 'Error looking up coordinates. Try again later.', 'error')
  }
  btn.disabled = false
}

function wizardNext() {
  const isPt = currentLang === 'pt'
  const step = WIZARD_STEPS[wizardStep]

  // Collect values from DOM if any
  if (step.id === 'details') {
    wizardData.date = document.getElementById('wiz-date')?.value
    wizardData.startTime = document.getElementById('wiz-start')?.value
    wizardData.endTime = document.getElementById('wiz-end')?.value
    wizardData.venue = document.getElementById('wiz-venue')?.value
    wizardData.address = document.getElementById('wiz-address')?.value
    wizardData.city = document.getElementById('wiz-city')?.value
    wizardData.country = document.getElementById('wiz-country')?.value
    wizardData.audience = document.getElementById('wiz-audience')?.value
    const lat = document.getElementById('wiz-lat')?.value
    const lon = document.getElementById('wiz-lon')?.value
    if (lat) wizardData.lat = parseFloat(lat)
    if (lon) wizardData.lon = parseFloat(lon)
  }

  if (step.id === 'final') {
    wizardData.title = document.getElementById('wiz-title')?.value
    wizardData.description = document.getElementById('wiz-desc')?.value
    wizardData.objective = document.getElementById('wiz-objective')?.value
    submitWizardEvent()
    return
  }

  // Validation per step
  if (step.id === 'type' && !wizardData.eventType) {
    showToast(isPt ? 'Selecione o tipo de evento primeiro! 👆' : 'Please select an event type first! 👆', 'info'); return
  }
  if (step.id === 'details') {
    if (!wizardData.date) { showToast(isPt ? 'Escolha uma data para o evento! 📅' : 'Pick a date for the event! 📅', 'info'); return }
    if (!wizardData.address) { showToast(isPt ? 'Informe o endereço! 📍' : 'Please provide the address! 📍', 'info'); return }
    if (!wizardData.city) { showToast(isPt ? 'Informe a cidade! 🌆' : 'Please provide the city! 🌆', 'info'); return }
    // Auto-calc duration from times
    if (wizardData.startTime && wizardData.endTime) {
      const [sh, sm] = wizardData.startTime.split(':').map(Number)
      const [eh, em] = wizardData.endTime.split(':').map(Number)
      let dur = (eh * 60 + em - sh * 60 - sm) / 60
      if (dur <= 0) dur += 24
      wizardData.duration = wizardData.duration || Math.round(dur)
    }
  }
  if (step.id === 'artists' && !wizardData.selectedActTypes?.length) {
    showToast(isPt ? 'Selecione pelo menos um tipo de artista! 🎸' : 'Select at least one type of act! 🎸', 'info'); return
  }

  wizardStep++
  renderWizardStep()
}

function wizardBack() {
  if (wizardStep > 0) { wizardStep--; renderWizardStep() }
}

async function submitWizardEvent() {
  const isPt = currentLang === 'pt'
  if (!wizardData.title) {
    showToast(isPt ? 'Dê um título ao seu evento! ✏️' : 'Give your event a title! ✏️', 'info'); return
  }

  // Calculate duration if not set
  if (!wizardData.duration) {
    if (wizardData.startTime && wizardData.endTime) {
      const [sh, sm] = wizardData.startTime.split(':').map(Number)
      const [eh, em] = wizardData.endTime.split(':').map(Number)
      let dur = (eh * 60 + em - sh * 60 - sm) / 60
      if (dur <= 0) dur += 24
      wizardData.duration = Math.round(dur)
    } else {
      wizardData.duration = 3
    }
  }

  const payload = {
    title: wizardData.title,
    event_type: wizardData.eventType,
    description: wizardData.description || '',
    venue_name: wizardData.venue || '',
    address: wizardData.address || '',
    city: wizardData.city || '',
    country: wizardData.country || 'Brasil',
    latitude: wizardData.lat || 0,
    longitude: wizardData.lon || 0,
    event_date: wizardData.date,
    start_time: wizardData.startTime || '19:00',
    end_time: wizardData.endTime || '23:00',
    duration_hours: wizardData.duration,
    expected_audience: parseInt(wizardData.audience) || null,
    budget_min: wizardData.budgetMin,
    budget_max: wizardData.budgetMax,
    objective: wizardData.objective || '',
    musical_taste: wizardData.musicalTaste || '',
    act_types_needed: wizardData.selectedActTypes || [],
    genres_preferred: wizardData.selectedGenres || [],
  }

  const btn = document.getElementById('wizard-next-btn')
  btn.disabled = true
  btn.querySelector('#wizard-next-label').textContent = isPt ? '⏳ Publicando...' : '⏳ Publishing...'

  const res = await apiCall('POST', '/events', payload)
  btn.disabled = false

  if (res.ok) {
    closeModal('create-event-modal')
    showToast(isPt ? '🎪 Evento publicado! Artistas próximos foram notificados! 🎉' : '🎪 Event published! Nearby artists have been notified! 🎉')
    showSection('events-section')
  } else {
    showToast(res.error, 'error')
    document.getElementById('wizard-next-label').textContent = isPt ? '🚀 Publicar Evento!' : '🚀 Publish Event!'
  }
}

// =====================
// BOOT
// =====================
window.addEventListener('DOMContentLoaded', async () => {
  // Apply saved language on boot
  setLang(currentLang)

  // Init artist carousel on landing
  initCarousel()

  if (authToken) await initApp()
  
  // Auto-fill location for new event
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      window.userLat = pos.coords.latitude
      window.userLon = pos.coords.longitude
    })
  }
})
