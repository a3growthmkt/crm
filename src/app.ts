// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from './config';

/* =============================================
   A3 FLOW – app.ts (CRM Imobiliário)
   ============================================= */

// ─── State ────────────────────────────────────
const state = {
  currentPage: null,
  draggedCard: null,
  draggedCardData: null,
  draggingType: null,
  searchQuery: '',
  sidebarOpen: false,
  activeKanbanCol: 0,

  toggleSidebar() {
    state.sidebarOpen = !state.sidebarOpen;
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('mobile-open', state.sidebarOpen);
    if (overlay) overlay.classList.toggle('active', state.sidebarOpen);
  },

  tasks: [
    { id: 1, name: 'Ligar para proprietário João', time: '14:00', detail: 'Agendar visita', done: false },
    { id: 2, name: 'Enviar documentação do imóvel', time: '10:00', detail: 'Matrícula atualizada', done: false },
    { id: 3, name: 'Revisar imóveis da semana', time: 'Hoje', detail: 'Atualizar preços', done: false },
  ],

  activities: [
    { text: 'Maria cadastrou novo imóvel no Centro', time: 'Há 15 minutos', icon: '🏠' },
    { text: 'João moveu terreno para Vendido', time: 'Há 2 horas', icon: '🔀' },
    { text: 'Novo loteamento adicionado ao pipeline', time: 'Há 4 horas', icon: '✨' },
  ],

  leads: [],

  propertyColumns: [
    { id: 'prop-0', name: 'Terreno',     color: '#A8E6CF' },
    { id: 'prop-1', name: 'Casa',        color: '#FFD3B6' },
    { id: 'prop-2', name: 'Loteamento',  color: '#A2D5F2' },
    { id: 'prop-3', name: 'Apartamento', color: '#D4C5F9' },
    { id: 'prop-4', name: 'Vendido',     color: '#b9f6ca' },
  ],

  imoveis: [
    { id: 'i1', tipo: 'Apartamento', address: 'Rua das Flores, 123 - Centro, São Paulo-SP', price: 'R$ 450.000', area: '85', rooms: 2, bathrooms: 1, parking: 1, owner: 'João Silva', ownerPhone: '5511999999999', description: 'Apartamento novo, próximo ao metro, ótimo estado.', col: 3, color: '#fb6551' },
    { id: 'i2', tipo: 'Loteamento', address: 'Av. Principal, 500 - Jardim Primavera, Campinas-SP', price: 'R$ 280.000', area: '250', rooms: 0, bathrooms: 0, parking: 0, owner: 'Maria Oliveira', ownerPhone: '5511988888888', description: 'Lote amplo em bairro planejado, frente para parque.', col: 2, color: '#a2d5f2' },
    { id: 'i3', tipo: 'Terreno', address: 'Estrada Rural, Km 15 - Zona Rural, Holambra-SP', price: 'R$ 180.000', area: '5000', rooms: 0, bathrooms: 0, parking: 0, owner: 'Pedro Santos', ownerPhone: '5511977777777', description: 'Terreno agrícola, ótimo para investimento.', col: 0, color: '#a8e6cf' },
  ],
};

// ─── Supabase Client ──────────────────────────
let supabase = null;

async function initSupabase() {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    console.warn('Supabase config ausente; usando somente estado local.');
    return;
  }
  supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: { persistSession: false },
    global: { headers: { 'x-client-info': 'a3flow-crm' } },
  });
  await fetchImoveisFromSupabase();
  await fetchLeadsFromSupabase();
  setupRealtime();
}

function setupRealtime() {
  if (!supabase) return;

  supabase.channel('public:imoveis')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'imoveis' }, payload => {
      handleRealtimeUpdate('imoveis', payload);
    })
    .subscribe();

  supabase.channel('public:leads')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, payload => {
      handleRealtimeUpdate('leads', payload);
    })
    .subscribe();
}

function handleRealtimeUpdate(table, payload) {
  const { eventType, new: newRec, old: oldRec } = payload;
  
  if (table === 'imoveis') {
    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const { ownerphone, ...rest } = newRec;
      const formatted = { 
        ...rest, 
        ownerPhone: ownerphone || rest.ownerPhone || '',
        photos: rest.photos || [], 
        color: rest.color || '#fb6551' 
      };
      
      const idx = state.imoveis.findIndex(i => i.id === formatted.id);
      if (idx !== -1) {
        state.imoveis[idx] = { ...state.imoveis[idx], ...formatted };
      } else if (eventType === 'INSERT') {
        const checkExistsAgain = state.imoveis.find(i => i.id === formatted.id);
        if(!checkExistsAgain) {
          state.imoveis.unshift(formatted);
        }
      }
    } else if (eventType === 'DELETE') {
      state.imoveis = state.imoveis.filter(i => i.id !== oldRec.id);
    }
    saveLocal('imoveis', state.imoveis);
    renderKanban();
    if(state.currentPage === 'settings') renderPipelineStages();
  } else if (table === 'leads') {
    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const formatted = {
        ...newRec,
        value: newRec.value || '',
        createdAt: newRec.created_at ? new Date(newRec.created_at).getTime() : Date.now()
      };
      
      const idx = state.leads.findIndex(l => l.id === formatted.id);
      if (idx !== -1) {
        state.leads[idx] = { ...state.leads[idx], ...formatted };
      } else if (eventType === 'INSERT') {
        const checkExistsAgain = state.leads.find(l => l.id === formatted.id);
        if(!checkExistsAgain) {
          state.leads.unshift(formatted);
        }
      }
    } else if (eventType === 'DELETE') {
      state.leads = state.leads.filter(l => l.id !== oldRec.id);
    }
    saveLocal('leads', state.leads);
  }
}

async function fetchLeadsFromSupabase() {
  const localData = loadLocal('leads');
  if (localData) {
    state.leads = localData;
  }
  if (!supabase) return;
  const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
  if (error) return;
  if (data) {
    state.leads = data.map(l => ({
      ...l,
      value: l.value || '',
      createdAt: new Date(l.created_at).getTime()
    }));
    saveLocal('leads', state.leads);
  }
}

async function fetchImoveisFromSupabase() {
  // Tenta carregar do LocalStorage primeiro (para velocidade e offline)
  const localData = loadLocal('imoveis');
  if (localData) {
    state.imoveis = localData;
    renderKanban();
  }

  if (!supabase) return;
  const { data, error } = await supabase.from('imoveis').select('*').order('created_at', { ascending: false });
  
  if (error) { 
    console.warn('Erro Supabase (usando local):', error.message);
    if (error.message.includes('relation "public.imoveis" does not exist')) {
      showToast('Modo Local: Tabelas não encontradas no Supabase.', 'info');
    }
    return; 
  }

  if (data) {
    state.imoveis = data.map(im => {
      const { ownerphone, ...rest } = im;
      return {
        ...rest,
        ownerPhone: ownerphone || rest.ownerPhone || '',
        photos: rest.photos || [],
        color: rest.color || '#fb6551'
      };
    });
    saveLocal('imoveis', state.imoveis);
    renderKanban();
    renderPipelineStages();
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatWhatsUrl(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}

// ─── Router ───────────────────────────────────
function navigate(page) {
  ['dashboard','kanban','settings','profile'].forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) {
      el.style.display = (p === page) ? 'block' : 'none';
      el.classList.toggle('page-active', p === page);
    }
  });
  document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(item =>
    item.classList.toggle('active', item.dataset.view === page));
  const backBtn = document.getElementById('mobile-back-btn');
  if (backBtn) {
    backBtn.style.display = (page !== 'dashboard') ? 'flex' : 'none';
  }

  state.currentPage = page;
  if (page === 'dashboard')    renderDashboard();
  if (page === 'kanban')       renderKanban();
  if (page === 'settings')     renderSettings();

  // Fecha o menu mobile ao navegar se estiver aberto
  if (state.sidebarOpen) state.toggleSidebar();
}

function handleMobileBack() {
  // Se houver algum modal aberto, feche-o primeiro
  const openModal = document.querySelector('.modal-overlay.open');
  if (openModal) {
    openModal.classList.remove('open');
    return;
  }
  
  // Caso contrário, se não estiver na home, volte para a home
  if (state.currentPage !== 'dashboard') {
    navigate('dashboard');
  }
}

// ─── Auth ──────────────────────────────────────
function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value.trim();
  if (!email || !pass) { shakeInputs(); return; }
  const btn = document.getElementById('login-btn');
  btn.innerHTML = '<span class="material-symbols-rounded" style="font-size:1.1rem">progress_activity</span> Entrando...';
  btn.disabled = true;
  setTimeout(showAppShell, 900);
}

function shakeInputs() {
  ['login-email','login-password'].forEach(id => {
    const el = document.getElementById(id);
    el.classList.add('error','shake');
    setTimeout(() => el.classList.remove('shake'), 500);
  });
}

function showAppShell() {
  document.getElementById('view-login').classList.remove('active');
  document.getElementById('app-shell').classList.add('active');
  navigate('dashboard');
}

function handleLogout() {
  document.getElementById('app-shell').classList.remove('active');
  document.getElementById('view-login').classList.add('active');
  const btn = document.getElementById('login-btn');
  btn.innerHTML = '<span class="material-symbols-rounded" style="font-size:1.1rem">login</span> Entrar no workspace';
  btn.disabled = false;
}

// ─── Dashboard ────────────────────────────────
function renderDashboard() { renderTasksList(); renderActivityFeed(); }

function renderTasksList() {
  const container = document.getElementById('tasks-list');
  if (!container) return;
  
  // Sort tasks: pending first
  const sortedTasks = [...state.tasks].sort((a, b) => Number(a.done) - Number(b.done));

  container.innerHTML = sortedTasks.map(t => {
    // Ensure ID is handled correctly as string for onclick attribute
    const idStr = String(t.id);
    return `
      <div class="task-item ${t.done ? 'done' : ''}" 
           style="cursor:pointer"
           onclick="openTaskDetail('${idStr}')">
        <div class="task-checkbox" onclick="toggleTask('${idStr}', event)">
          ${t.done ? '<span class="material-symbols-rounded" style="font-size:0.9rem">check</span>' : ''}
        </div>
        <div class="task-content">
          <div class="task-name">${t.name}</div>
          <div class="task-meta">
            <span class="material-symbols-rounded" style="font-size:0.75rem">schedule</span>
            ${t.time} · ${t.detail}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleTask(id, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  console.log('Toggling task:', id);
  const task = state.tasks.find(t => String(t.id) === String(id));
  if (task) { 
    task.done = !task.done; 
    renderTasksList();
    if (task.done) {
      showToast('Tarefa concluída!', 'success');
    }
  }
}

function openTaskDetail(id) {
  console.log('Opening task detail:', id);
  const task = state.tasks.find(t => String(t.id) === String(id));
  if (!task) {
    console.error('Task not found for ID:', id);
    return;
  }
  
  const idEl = document.getElementById('edit-task-id');
  const nameEl = document.getElementById('edit-task-name');
  const timeEl = document.getElementById('edit-task-time');
  const detailEl = document.getElementById('edit-task-detail');
  
  if (idEl) idEl.value = task.id;
  if (nameEl) nameEl.value = task.name;
  if (timeEl) timeEl.value = task.time;
  if (detailEl) detailEl.value = task.detail;
  
  const modal = document.getElementById('modal-task-edit');
  if (modal) {
    modal.classList.add('open');
  } else {
    console.error('Modal modal-task-edit not found');
  }
}

function saveTask() {
  const id = parseInt(document.getElementById('edit-task-id').value);
  const task = state.tasks.find(t => t.id === id);
  if (task) {
    task.name = document.getElementById('edit-task-name').value;
    task.time = document.getElementById('edit-task-time').value;
    task.detail = document.getElementById('edit-task-detail').value;
    renderTasksList();
    closeModal('modal-task-edit');
    showToast('Tarefa atualizada!', 'success');
  }
}

function renderActivityFeed() {
  const container = document.getElementById('activity-list');
  if (!container) return;
  container.innerHTML = state.activities.map(a => `
    <div class="activity-item">
      <div class="activity-dot"></div>
      <div class="activity-content">
        <div class="activity-text">${a.icon} ${a.text}</div>
        <div class="activity-time">${a.time}</div>
      </div>
    </div>
  `).join('');
}

// ─── Kanban ───────────────────────────────────
function renderKanban() {
  const board = document.getElementById('kanban-board');
  if (!board) return;

  const isMobile = window.innerWidth <= 768;
  const q = (state.searchQuery || '').toLowerCase();

  // Renderiza Abas no Mobile
  let tabsHTML = '';
  if (isMobile) {
    tabsHTML = `
      <div class="kanban-mobile-tabs">
        ${state.propertyColumns.map((col, idx) => {
          const count = state.imoveis.filter(i => i.col === idx).length;
          const activeClass = state.activeKanbanCol === idx ? 'active' : '';
          return `
            <button class="kanban-tab-pill ${activeClass}" onclick="switchKanbanCol(${idx})">
              <span class="tab-pill-dot" style="background:${col.color}"></span>
              ${col.name} <span class="tab-pill-count">${count}</span>
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  const columnsToRender = isMobile 
    ? [state.propertyColumns[state.activeKanbanCol]] 
    : state.propertyColumns;

  const actualStartIndex = isMobile ? state.activeKanbanCol : 0;

  board.innerHTML = tabsHTML + columnsToRender.map((col, relativeIdx) => {
    const idx = isMobile ? state.activeKanbanCol : relativeIdx;
    const imoveisNaColuna = state.imoveis.filter(i => {
      const matchCol = i.col === idx;
      const matchQuery = !q || 
        (i.address || '').toLowerCase().includes(q) || 
        (i.owner || '').toLowerCase().includes(q) || 
        (i.tipo || '').toLowerCase().includes(q);
      return matchCol && matchQuery;
    });
    return `
    <div class="kanban-col ${isMobile ? 'mobile-single' : ''}" id="${col.id}"
      ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event, ${idx})">
      ${!isMobile ? `
      <div class="kanban-col-header">
        <div class="kanban-col-top" style="background:${col.color}"></div>
        <div class="kanban-col-title" style="padding-top:8px">
          ${col.name}<span class="kanban-col-count">${imoveisNaColuna.length}</span>
        </div>
      </div>
      ` : ''}
      <div class="kanban-cards" id="cards-prop-${idx}">
        ${imoveisNaColuna.map(imovel => renderImovelCard(imovel)).join('')}
      </div>
      <button class="kanban-add-btn" onclick="openAddImovelModalForCol(${idx})">
        <span class="material-symbols-rounded" style="font-size:1rem">add</span> Adicionar imóvel
      </button>
    </div>`;
  }).join('');

  board.querySelectorAll('.kanban-card').forEach(card => {
    card.addEventListener('dragstart', onDragStart);
    card.addEventListener('dragend',   onDragEnd);
  });
}

function renderImovelCard(imovel) {
  const tipoIcon = { 'Terreno': '🏞️', 'Casa': '🏠', 'Loteamento': '🏘️', 'Apartamento': '🏢' }[imovel.tipo] || '🏠';
  const ownerLine = imovel.owner ? `<div class="imovel-card-owner">👤 ${imovel.owner}${imovel.ownerPhone ? `<br>${imovel.ownerPhone}` : ''}</div>` : '';
  const photo = (imovel.photos && imovel.photos[0]) || null;
  return `
    <div class="kanban-card" id="card-${imovel.id}" draggable="true"
      data-imovel-id="${imovel.id}" onclick="openImovelDetail('${imovel.id}', event)">
      <div class="card-quick-actions">
        <button class="quick-action-btn" title="Editar" onclick="openEditImovelModal('${imovel.id}', event)">
          <span class="material-symbols-rounded" style="font-size:0.85rem">edit</span>
        </button>
        <button class="quick-action-btn" title="Excluir" onclick="deleteImovel('${imovel.id}', event)" style="color:var(--danger-text)">
          <span class="material-symbols-rounded" style="font-size:0.85rem">delete</span>
        </button>
      </div>
      ${photo ? `<div class="imovel-card-cover"><img src="${photo}" alt="Foto do imóvel" /></div>` : ''}
      ${ownerLine}
      <div class="imovel-card-tipo">${tipoIcon} ${imovel.tipo}</div>
      <div class="imovel-card-address">${imovel.address}</div>
      <div class="imovel-card-price">${imovel.price}</div>
      <div class="imovel-card-details">
        ${imovel.area ? `<span>📐 ${imovel.area}m²</span>` : ''}
        ${imovel.rooms ? `<span>🛏️ ${imovel.rooms}</span>` : ''}
        ${imovel.bathrooms ? `<span>🚿 ${imovel.bathrooms}</span>` : ''}
        ${imovel.parking ? `<span>🚗 ${imovel.parking}</span>` : ''}
      </div>
    </div>`;
}

// ─── Drag & Drop ──────────────────────────────
function onDragStart(e) {
  const card = e.currentTarget;
  state.draggedCard = card;
  state.draggedCardData = card.dataset.imovelId;
  setTimeout(() => card.classList.add('dragging'), 0);
  e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd(e) {
  if (state.draggedCard) state.draggedCard.classList.remove('dragging');
  document.querySelectorAll('.kanban-col').forEach(col => col.classList.remove('drag-over'));
  state.draggedCard = null;
  state.draggedCardData = null;
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function onDragLeave(e) {
  const col = e.currentTarget;
  if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over');
}

function onDrop(e, colIndex) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const imovelId = state.draggedCardData;
  if (!imovelId) return;
  const imovel = state.imoveis.find(i => i.id === imovelId);
  if (!imovel || imovel.col === colIndex) return;
  imovel.col = colIndex;
  state.activities.unshift({ text: `Imóvel movido para ${state.propertyColumns[colIndex].name}`, time: 'Agora mesmo', icon: '🏠' });
  renderKanban();
  spawnConfetti(e.clientX, e.clientY);
  persistImovel(imovelId, { col: colIndex });
}

function switchKanbanCol(idx) {
  state.activeKanbanCol = idx;
  renderKanban();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Confetti ─────────────────────────────────
function spawnConfetti(x, y) {
  const colors = ['#fb6551','#A8E6CF','#FFD3B6','#A2D5F2','#D4C5F9','#FFD700'];
  for (let i = 0; i < 30; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.cssText = `left:${x+(Math.random()-.5)*100}px;top:${y+(Math.random()-.5)*60}px;background:${colors[Math.floor(Math.random()*colors.length)]};width:${6+Math.random()*8}px;height:${6+Math.random()*8}px;border-radius:${Math.random()>.5?'50%':'2px'};animation-duration:${.7+Math.random()*.8}s;animation-delay:${Math.random()*.2}s;`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 1200);
  }
}

// ─── Detail Modal ─────────────────────────────
function openImovelDetail(imovelId, event) {
  if (event && event.target.closest('.card-quick-actions')) return;
  const imovel = state.imoveis.find(i => i.id === imovelId);
  if (!imovel) return;

  const tipoIcon = { 'Terreno': '🏞️', 'Casa': '🏠', 'Loteamento': '🏘️', 'Apartamento': '🏢' }[imovel.tipo] || '🏠';

  document.getElementById('detail-avatar').textContent = tipoIcon;
  document.getElementById('detail-avatar').style.background = `linear-gradient(135deg, ${imovel.color}, #a2d5f2)`;
  document.getElementById('detail-title').textContent = imovel.owner || imovel.address;
  document.getElementById('detail-subtitle').textContent = imovel.address;

  const waUrl = formatWhatsUrl(imovel.ownerPhone);

  document.getElementById('detail-actions').innerHTML = `
    <button class="btn btn-primary btn-sm" onclick="openEditImovelModal('${imovel.id}')">
      <span class="material-symbols-rounded" style="font-size:0.9rem">edit</span> Editar
    </button>
    ${waUrl ? `<button class="btn btn-ghost btn-sm" onclick="window.open('${waUrl}')">
      <span class="material-symbols-rounded" style="font-size:0.9rem">whatsapp</span> WhatsApp
    </button>` : ''}
  `;

  let bodyHTML = '';

  if (imovel.photos && imovel.photos.length) {
    bodyHTML += `<div class="detail-section">
      <div class="detail-section-title">Fotos</div>
      <div class="detail-gallery">
        ${imovel.photos.map(p => `<img class="detail-photo" src="${p}" alt="Foto do imóvel" />`).join('')}
      </div>
    </div>`;
  }

  if (imovel.owner) {
    bodyHTML += `<div class="detail-section">
      <div class="detail-section-title">Proprietário</div>
      <div class="detail-row">
        <div class="detail-row-icon"><span class="material-symbols-rounded">person</span></div>
        <div class="detail-row-content">
          <div class="detail-row-label">Nome</div>
          <div class="detail-row-value">${imovel.owner}</div>
        </div>
      </div>
      ${imovel.ownerPhone ? `<div class="detail-row">
        <div class="detail-row-icon"><span class="material-symbols-rounded">phone</span></div>
        <div class="detail-row-content">
          <div class="detail-row-label">Telefone</div>
          <div class="detail-row-value">${imovel.ownerPhone}</div>
        </div>
      </div>` : ''}
    </div>`;
  }

  if (imovel.description) {
    bodyHTML += `<div class="detail-section">
      <div class="detail-section-title">Descrição</div>
      <p style="font-size:0.9rem;color:var(--text);line-height:1.5">${imovel.description}</p>
    </div>`;
  }

  bodyHTML += `<div class="detail-section">
    <div class="detail-section-title">Detalhes do Imóvel</div>
    <div class="detail-row">
      <div class="detail-row-icon"><span class="material-symbols-rounded">location_on</span></div>
      <div class="detail-row-content">
        <div class="detail-row-label">Endereço</div>
        <div class="detail-row-value">${imovel.address}</div>
      </div>
    </div>
    <div class="detail-row">
      <div class="detail-row-icon"><span class="material-symbols-rounded">attach_money</span></div>
      <div class="detail-row-content">
        <div class="detail-row-label">Preço</div>
        <div class="detail-row-value" style="color:var(--primary)">${imovel.price}</div>
      </div>
    </div>`;

  if (imovel.area) {
    bodyHTML += `<div class="detail-row">
      <div class="detail-row-icon"><span class="material-symbols-rounded">square_foot</span></div>
      <div class="detail-row-content">
        <div class="detail-row-label">Área</div>
        <div class="detail-row-value">${imovel.area}m²</div>
      </div>
    </div>`;
  }
  if (imovel.rooms) {
    bodyHTML += `<div class="detail-row">
      <div class="detail-row-icon"><span class="material-symbols-rounded">bed</span></div>
      <div class="detail-row-content">
        <div class="detail-row-label">Quartos</div>
        <div class="detail-row-value">${imovel.rooms}</div>
      </div>
    </div>`;
  }
  if (imovel.bathrooms) {
    bodyHTML += `<div class="detail-row">
      <div class="detail-row-icon"><span class="material-symbols-rounded">shower</span></div>
      <div class="detail-row-content">
        <div class="detail-row-label">Banheiros</div>
        <div class="detail-row-value">${imovel.bathrooms}</div>
      </div>
    </div>`;
  }
  if (imovel.parking) {
    bodyHTML += `<div class="detail-row">
      <div class="detail-row-icon"><span class="material-symbols-rounded">garage</span></div>
      <div class="detail-row-content">
        <div class="detail-row-label">Vagas</div>
        <div class="detail-row-value">${imovel.parking}</div>
      </div>
    </div>`;
  }

  bodyHTML += `<div class="detail-row">
      <div class="detail-row-icon"><span class="material-symbols-rounded">view_kanban</span></div>
      <div class="detail-row-content">
        <div class="detail-row-label">Tipo</div>
        <div class="detail-row-value">
          <span class="detail-badge" style="background:${state.propertyColumns[imovel.col].color};color:var(--text)">${imovel.tipo}</span>
        </div>
      </div>
    </div>
  </div>`;

  document.getElementById('detail-body').innerHTML = bodyHTML;
  document.getElementById('detail-overlay').classList.add('open');
}

function closeDetailModal(event) {
  if (event && event.target && !event.target.classList.contains('detail-overlay') && !event.target.closest('.detail-close-btn')) return;
  document.getElementById('detail-overlay').classList.remove('open');
}

async function deleteImovel(imovelId, event) {
  event.stopPropagation();
  state.imoveis = state.imoveis.filter(i => i.id !== imovelId);
  renderKanban();
  if (supabase) {
    const { error } = await supabase.from('imoveis').delete().eq('id', imovelId);
    if (error) { console.error('Erro ao deletar imóvel', error); showToast('Erro ao deletar no Supabase', 'error'); }
  }
}

// ─── Settings ─────────────────────────────────
function renderSettings() { renderPipelineStages(); }

function renderPipelineStages() {
  const container = document.getElementById('pipeline-stages-list');
  if (!container) return;
  container.innerHTML = state.propertyColumns.map((stage, i) => `
    <div class="pipeline-stage-item">
      <div class="stage-color" style="background:${stage.color}"></div>
      <div class="stage-label">${stage.name}</div>
      <div class="stage-count">${state.imoveis.filter(im => im.col === i).length} imóveis</div>
    </div>
  `).join('');
}

function switchSettingsTab(btn, tabId) {
  document.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
  document.querySelectorAll('.settings-tab').forEach(t => t.style.display = 'none');
  btn.classList.add('active');
  const tab = document.getElementById(tabId);
  if (tab) tab.style.display = 'block';
}

// ─── Imóveis Modals ─────────────────────────────
let _editingImovelId = null;
let _photoQueue = [];

function openEditImovelModal(imovelId, event) {
  if (event) event.stopPropagation();
  const imovel = state.imoveis.find(i => i.id === imovelId);
  if (!imovel) return;
  _editingImovelId = imovelId;
  document.getElementById('new-imovel-tipo').value = imovel.col;
  document.getElementById('new-imovel-address').value = imovel.address;
  document.getElementById('new-imovel-price').value = imovel.price;
  document.getElementById('new-imovel-area').value = imovel.area;
  document.getElementById('new-imovel-rooms').value = imovel.rooms;
  document.getElementById('new-imovel-bathrooms').value = imovel.bathrooms;
  document.getElementById('new-imovel-parking').value = imovel.parking;
  document.getElementById('new-imovel-owner').value = imovel.owner;
  document.getElementById('new-imovel-owner-phone').value = imovel.ownerPhone;
  document.getElementById('new-imovel-description').value = imovel.description;
  _photoQueue = (imovel.photos || []).slice(0, 5).map(url => ({ kind: 'existing', url }));
  renderPhotoPreview(_photoQueue.map(p => p.url));
  
  const modal = document.getElementById('modal-add-imovel');
  if (modal) {
    const title = modal.querySelector('h3');
    if (title) title.textContent = 'Editar Imóvel';
    const btn = modal.querySelector('button.btn-primary');
    if (btn) btn.textContent = 'Salvar Alterações';
    modal.classList.add('open'); 
  }
}

function openAddImovelModalForCol(colIndex) {
  openAddImovelModal();
  const tipoSelect = document.getElementById('new-imovel-tipo');
  if (tipoSelect) tipoSelect.value = String(colIndex);
}

function openAddImovelModal() { 
  _editingImovelId = null;
  const modal = document.getElementById('modal-add-imovel');
  if (modal) {
    const title = modal.querySelector('h3');
    if (title) title.textContent = 'Novo Imóvel';
    const btn = modal.querySelector('button.btn-primary');
    if (btn) btn.textContent = 'Adicionar Imóvel';
    clearModalFields(['new-imovel-tipo','new-imovel-address','new-imovel-price','new-imovel-area','new-imovel-rooms','new-imovel-bathrooms','new-imovel-parking','new-imovel-owner','new-imovel-owner-phone','new-imovel-description']);
    _photoQueue = [];
    renderPhotoPreview([]);
    modal.classList.add('open'); 
  }
}

async function addNewImovel() {
  const col           = parseInt(document.getElementById('new-imovel-tipo').value, 10) || 0;
  const tipo          = state.propertyColumns[col]?.name || 'Casa';
  const address       = document.getElementById('new-imovel-address').value.trim();
  const price         = document.getElementById('new-imovel-price').value.trim() || 'R$ 0';
  const area          = document.getElementById('new-imovel-area').value.trim() || null;
  const rooms         = document.getElementById('new-imovel-rooms').value.trim() || null;
  const bathrooms     = document.getElementById('new-imovel-bathrooms').value.trim() || null;
  const parking       = document.getElementById('new-imovel-parking').value.trim() || null;
  const owner         = document.getElementById('new-imovel-owner').value.trim();
  const ownerPhone    = document.getElementById('new-imovel-owner-phone').value.trim();
  const description   = document.getElementById('new-imovel-description').value.trim();
  const tempIdForPhotos = _editingImovelId || ('tmp-' + Date.now());
  const photos      = await uploadPhotoQueue(_photoQueue, tempIdForPhotos);
  
  if (!address) return;

  if (_editingImovelId) {
    const imovel = state.imoveis.find(i => i.id === _editingImovelId);
    if (imovel) {
      Object.assign(imovel, { tipo, address, price, area, rooms, bathrooms, parking, owner, ownerPhone, description, col, photos });
      state.activities.unshift({ text: `Imóvel ${address} atualizado`, time: 'Agora mesmo', icon: '📝' });
      await persistImovel(imovel.id, imovel, true);
    }
  } else {
    const colors = ['#fb6551','#a2d5f2','#a8e6cf','#d4c5f9','#ffd3b6'];
    const tempId = 'i' + Date.now();
    const newImovel = {
      id: tempId, tipo, address, price, area, rooms, bathrooms, parking, owner, ownerPhone, description, col,
      color: colors[state.imoveis.length % colors.length],
      photos,
    };
    state.imoveis.push(newImovel);
    state.activities.unshift({ text: `Novo imóvel adicionado: ${address}`, time: 'Agora mesmo', icon: '🏠' });
    const created = await persistImovel(null, newImovel, true);
    if (created?.id) {
      newImovel.id = created.id;
    }
  }

  closeModal('modal-add-imovel');
  if (state.currentPage === 'kanban') renderKanban();
}

function openAddTaskModal()        { document.getElementById('modal-add-task').classList.add('open'); }
function closeModal(id)            { document.getElementById(id)?.classList.remove('open'); }

function addNewTask() {
  const desc = document.getElementById('new-task-desc').value.trim();
  const time = document.getElementById('new-task-time').value || '09:00';
  if (!desc) return;
  state.tasks.unshift({ id: Date.now(), name: desc, time, detail: 'Nova tarefa', done: false });
  closeModal('modal-add-task');
  clearModalFields(['new-task-desc']);
  if (state.currentPage === 'dashboard') renderTasksList();
}

async function uploadPhotoQueue(queue, imovelId) {
  if (!supabase || !supabaseConfig.storageBucket) {
    return queue.filter(p => p.url).map(p => p.url); // fallback local
  }
  const bucket = supabaseConfig.storageBucket;
  const urls = [];

  for (const item of queue) {
    if (item.kind === 'existing') { urls.push(item.url); continue; }
    if (!item.file) continue;
    const fileExt = (item.file.name.split('.').pop() || 'jpg').toLowerCase();
    const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}.${fileExt}`;
    const path = `imoveis/${imovelId || 'temp'}/${filename}`;
    const { error } = await supabase.storage.from(bucket).upload(path, item.file, { upsert: true, contentType: item.file.type });
    if (error) { 
      console.error('Upload erro', error); 
      showToast('Erro no Cloud: Usando foto local temporária.', 'warning');
      urls.push(item.url); // Mantém o blob local como fallback
      continue; 
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    if (data?.publicUrl) urls.push(data.publicUrl);
  }
  return urls.slice(0, 5);
}

async function persistImovel(id, payload, returnRow) {
  // Sincroniza localmente sempre
  setTimeout(() => saveLocal('imoveis', state.imoveis), 0);

  if (!supabase) return null;

  const { ownerPhone, ...restPayload } = payload;
  const dbPayload = { ...restPayload };
  if (ownerPhone !== undefined) dbPayload.ownerphone = ownerPhone;

  if (id) {
    const { data, error } = await supabase
      .from('imoveis')
      .update({ ...dbPayload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) { console.error('Erro ao atualizar imóvel', error); return null; }
    return data || null;
  }
  const { data, error } = await supabase
    .from('imoveis')
    .insert({ ...dbPayload })
    .select()
    .maybeSingle();
  if (error) { console.error('Erro ao criar imóvel', error); return null; }
  return data || null;
}

async function persistLead(id, payload) {
  setTimeout(() => saveLocal('leads', state.leads), 0);
  if (!supabase) return null;
  
  if (id && !id.startsWith('l')) { // startsWith('l') means it's a temporary local ID, we shouldn't update it to DB yet
    const { data, error } = await supabase
      .from('leads')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) { console.error('Erro ao atualizar lead', error); return null; }
    return data || null;
  }
  
  const { createdAt, ...cleanPayload } = payload;
  const { data, error } = await supabase
    .from('leads')
    .insert({ ...cleanPayload })
    .select()
    .maybeSingle();
  if (error) { console.error('Erro ao criar lead no supabase', error); return null; }
  return data || null;
}

// ─── Fotos do imóvel ──────────────────────────
function handleImovelPhotosChange(files) {
  const maxPhotos = 5;
  const maxSizeMB = 2;
  const selected = Array.from(files || []);
  for (const file of selected) {
    if (!file.type.startsWith('image/')) continue;
    if (file.size > maxSizeMB * 1024 * 1024) {
      showToast(`Imagem '${file.name}' maior que ${maxSizeMB}MB`, 'warning');
      continue;
    }
    if (_photoQueue.length >= maxPhotos) break;
    const preview = URL.createObjectURL(file);
    _photoQueue.push({ kind: 'new', file, url: preview });
  }
  renderPhotoPreview(_photoQueue.map(p => p.url));
}

function removePhotoAt(index) {
  const removed = _photoQueue.splice(index, 1)[0];
  if (removed?.kind === 'new' && removed.url) URL.revokeObjectURL(removed.url);
  renderPhotoPreview(_photoQueue.map(p => p.url));
}

function renderPhotoPreview(list) {
  const container = document.getElementById('imovel-photos-preview');
  if (!container) return;
  container.innerHTML = (list || []).map((src, idx) => `
    <div class="photo-thumb">
      <img src="${src}" alt="foto-${idx}" />
      <button class="photo-remove" onclick="removePhotoAt(${idx})">×</button>
    </div>
  `).join('');
}

// ─── Leads (mínimo para evitar erros) ─────────────────
function openAddLeadModal() {
  const modal = document.getElementById('modal-add-lead');
  if (modal) modal.classList.add('open');
}

async function addNewLead() {
  const name     = document.getElementById('new-lead-name')?.value.trim();
  const company  = document.getElementById('new-lead-company')?.value.trim();
  const role     = document.getElementById('new-lead-role')?.value.trim();
  const email    = document.getElementById('new-lead-email')?.value.trim();
  const phone    = document.getElementById('new-lead-phone')?.value.trim();
  const value    = parseFloat(document.getElementById('new-lead-value')?.value.trim()) || 0;
  const col      = parseInt(document.getElementById('new-lead-col')?.value ?? '0', 10) || 0;

  if (!name || !phone) { showToast('Preencha nome e telefone do lead', 'warning'); return; }

  const tempId = 'l' + Date.now();
  const lead = { id: tempId, name, company, role, email, phone, value, col, createdAt: Date.now() };
  state.leads.unshift(lead);
  state.activities.unshift({ text: `Novo lead adicionado: ${name}`, time: 'Agora mesmo', icon: '👤' });
  
  const created = await persistLead(null, lead);
  if (created?.id) {
    const localLead = state.leads.find(l => l.id === tempId);
    if (localLead) localLead.id = created.id; // substitui ID temporário pelo ID do banco (UUID)
  }
  
  saveLocal('leads', state.leads);
  closeModal('modal-add-lead');
  clearModalFields(['new-lead-name','new-lead-company','new-lead-role','new-lead-email','new-lead-phone','new-lead-value']);
  const colSelect = document.getElementById('new-lead-col');
  if (colSelect) colSelect.value = '0';
  showToast('Lead salvo e enviado para nuvem!', 'success');
}

function openLeadDetail(leadId, event) {
  if (event && event.stopPropagation) event.stopPropagation();
  const lead = state.leads.find(l => l.id === leadId);
  if (!lead) { showToast('Lead não encontrado', 'error'); return; }

  const avatar = document.getElementById('detail-avatar');
  if (avatar) avatar.textContent = '👤';
  document.getElementById('detail-title').textContent = lead.name;
  document.getElementById('detail-subtitle').textContent = lead.company || 'Lead';
  document.getElementById('detail-actions').innerHTML = lead.phone ? `
    <button class="btn btn-ghost btn-sm" onclick="window.open('https://wa.me/${lead.phone.replace(/\D/g,'')}')">
      <span class="material-symbols-rounded" style="font-size:0.9rem">whatsapp</span> WhatsApp
    </button>` : '';
  document.getElementById('detail-body').innerHTML = `
    <div class="detail-section">
      <div class="detail-section-title">Contato</div>
      <div class="detail-row">
        <div class="detail-row-icon"><span class="material-symbols-rounded">person</span></div>
        <div class="detail-row-content"><div class="detail-row-label">Nome</div><div class="detail-row-value">${escapeHtml(lead.name)}</div></div>
      </div>
      ${lead.phone ? `<div class="detail-row"><div class="detail-row-icon"><span class="material-symbols-rounded">call</span></div><div class="detail-row-content"><div class="detail-row-label">Telefone</div><div class="detail-row-value">${escapeHtml(lead.phone)}</div></div></div>` : ''}
      ${lead.email ? `<div class="detail-row"><div class="detail-row-icon"><span class="material-symbols-rounded">mail</span></div><div class="detail-row-content"><div class="detail-row-label">E-mail</div><div class="detail-row-value">${escapeHtml(lead.email)}</div></div></div>` : ''}
      ${lead.company ? `<div class="detail-row"><div class="detail-row-icon"><span class="material-symbols-rounded">business</span></div><div class="detail-row-content"><div class="detail-row-label">Empresa</div><div class="detail-row-value">${escapeHtml(lead.company)}</div></div></div>` : ''}
    </div>`;

  document.getElementById('detail-overlay').classList.add('open');
}

function switchLeadTab() { /* aba única no modo demo */ }

function sendWhatsAppMessage() {
  showToast('Mensagem enviada (simulação)', 'info');
  return Promise.resolve(true);
}

function clearModalFields(ids) {
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  _photoQueue = [];
  renderPhotoPreview([]);
}

// ─── Profile ──────────────────────────────────
function toggleChange(checkbox, key) { console.log(`[Notif] ${key} = ${checkbox.checked}`); }

function setTheme(mode) {
  document.getElementById('theme-light').style.borderColor = mode === 'light' ? 'var(--primary)' : 'var(--border)';
  document.getElementById('theme-dark').style.borderColor  = mode === 'dark'  ? 'var(--primary)' : 'var(--border)';
}

// ─── Toast Notification ───────────────────────
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span style="flex:1">${message}</span><span class="material-symbols-rounded" style="font-size:1rem;opacity:0.5">close</span>`;
  toast.onclick = () => dismissToast(toast);
  container.appendChild(toast);
  setTimeout(() => dismissToast(toast), duration);
}

function dismissToast(toast) {
  toast.classList.add('hiding');
  setTimeout(() => toast.remove(), 350);
}

// ─── Persistence Helpers ──────────────────────
function saveLocal(key, data) {
  try { localStorage.setItem(`a3flow_${key}`, JSON.stringify(data)); } catch(e) {}
}
function loadLocal(key) {
  try {
    const d = localStorage.getItem(`a3flow_${key}`);
    return d ? JSON.parse(d) : null;
  } catch(e) { return null; }
}

function handleSearch(query) {
  state.searchQuery = query;
  renderKanban();
}

// ─── Keyboard shortcuts ───────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeDetailModal();
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

// ─── Init ─────────────────────────────────────
(function init() {
  document.getElementById('view-login').classList.add('active');
  const photoInput = document.getElementById('new-imovel-photos');
  if (photoInput) {
    photoInput.addEventListener('change', e => handleImovelPhotosChange(e.target.files));
  }
  
  // Carrega leads locais
  const localLeads = loadLocal('leads');
  if (localLeads) state.leads = localLeads;

  initSupabase();

  // Re-renderiza Kanban/Dashboard ao redimensionar (Abas vs Colunas)
  window.addEventListener('resize', () => {
    if (state.currentPage === 'kanban') renderKanban();
    else if (state.currentPage === 'dashboard') renderDashboard();
  });
})();

// ─── Expose to window for inline handlers ─────
const g = window as any;
Object.assign(g, {
  openTaskDetail,
  toggleTask,
  saveTask,
  handleMobileBack,
  navigate,
  handleLogin,
  handleLogout,
  openAddImovelModal,
  openAddImovelModalForCol,
  openEditImovelModal,
  addNewImovel,
  deleteImovel,
  openImovelDetail,
  closeDetailModal,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  openAddTaskModal,
  addNewTask,
  openAddLeadModal,
  addNewLead,
  openLeadDetail,
  switchLeadTab,
  sendWhatsAppMessage,
  toggleChange,
  setTheme,
  closeModal,
  removePhotoAt,
  handleImovelPhotosChange,
  handleSearch,
  toggleSidebar: state.toggleSidebar,
  switchKanbanCol,
});
