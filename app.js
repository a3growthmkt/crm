/* =============================================
   A3 FLOW – app.js  (CRM Imobiliário)
   ============================================= */
'use strict';

// ─── State ────────────────────────────────────
const state = {
  currentPage: null,
  draggedCard: null,
  draggedCardData: null,
  draggingType: null,

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

// ─── Persistence ──────────────────────────────
function loadImoveisFromStorage() {
  try {
    const version = localStorage.getItem('a3flow_version');
    if (version !== '4') {
      localStorage.removeItem('a3flow_imoveis');
      localStorage.removeItem('a3flow_leads');
      localStorage.setItem('a3flow_version', '4');
      return;
    }
    const saved = localStorage.getItem('a3flow_imoveis');
    if (saved) {
      state.imoveis = JSON.parse(saved);
      state.imoveis.forEach(im => {
        if (!im.tipo && im.category) {
          const map = { 'loteamento': 'Loteamento', 'imovel': 'Casa', 'terreno': 'Terreno' };
          im.tipo = map[im.category] || 'Casa';
          delete im.category;
        }
        if (!im.tipo) im.tipo = 'Casa';
        if (!im.photos) im.photos = [];
      });
      saveImoveisToStorage();
    }
  } catch(e) {}
}
function saveImoveisToStorage() {
  localStorage.setItem('a3flow_imoveis', JSON.stringify(state.imoveis));
}
loadImoveisFromStorage();

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
  document.querySelectorAll('.nav-item').forEach(item =>
    item.classList.toggle('active', item.dataset.view === page));
  state.currentPage = page;
  if (page === 'dashboard')    renderDashboard();
  if (page === 'kanban')       renderKanban();
  if (page === 'settings')     renderSettings();
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
  container.innerHTML = state.tasks.map(t => `
    <div class="task-item ${t.done ? 'done' : ''}" onclick="toggleTask(${t.id})">
      <div class="task-checkbox">
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
  `).join('');
}

function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (task) { task.done = !task.done; renderTasksList(); }
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

function renderKanban() {
  const board = document.getElementById('kanban-board');
  if (!board) return;

  board.innerHTML = state.propertyColumns.map((col, idx) => {
    const imoveisNaColuna = state.imoveis.filter(i => i.col === idx);
    return `
    <div class="kanban-col" id="${col.id}"
      ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event, ${idx})">
      <div class="kanban-col-header">
        <div class="kanban-col-top" style="background:${col.color}"></div>
        <div class="kanban-col-title" style="padding-top:8px">
          ${col.name}<span class="kanban-col-count">${imoveisNaColuna.length}</span>
        </div>
      </div>
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
  saveImoveisToStorage();
  state.activities.unshift({ text: `Imóvel movido para ${state.propertyColumns[colIndex].name}`, time: 'Agora mesmo', icon: '🏠' });
  renderKanban();
  spawnConfetti(e.clientX, e.clientY);
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

function deleteImovel(imovelId, event) {
  event.stopPropagation();
  state.imoveis = state.imoveis.filter(i => i.id !== imovelId);
  saveImoveisToStorage();
  renderKanban();
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

function openEditImovelModal(imovelId, event) {
  if (event) event.stopPropagation();
  const imovel = state.imoveis.find(i => i.id === imovelId);
  if (!imovel) return;
  _editingImovelId = imovelId;
  document.getElementById('new-imovel-tipo').value = imovel.tipo;
  document.getElementById('new-imovel-address').value = imovel.address;
  document.getElementById('new-imovel-price').value = imovel.price;
  document.getElementById('new-imovel-area').value = imovel.area;
  document.getElementById('new-imovel-rooms').value = imovel.rooms;
  document.getElementById('new-imovel-bathrooms').value = imovel.bathrooms;
  document.getElementById('new-imovel-parking').value = imovel.parking;
  document.getElementById('new-imovel-owner').value = imovel.owner;
  document.getElementById('new-imovel-owner-phone').value = imovel.ownerPhone;
  document.getElementById('new-imovel-description').value = imovel.description;
  document.getElementById('new-imovel-col').value = imovel.col;
  _pendingPhotos = (imovel.photos || []).slice(0, 5);
  renderPhotoPreview(_pendingPhotos);
  
  const modal = document.getElementById('modal-add-imovel');
  if (modal) {
    const title = modal.querySelector('h3');
    if (title) title.textContent = 'Editar Imóvel';
    const btn = modal.querySelector('button.btn-primary');
    if (btn) btn.textContent = 'Salvar Alterações';
    modal.classList.add('open');
  }
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
    modal.classList.add('open'); 
  }
}
function openAddImovelModalForCol(i) { openAddImovelModal(); document.getElementById('new-imovel-col').value = i; }

function addNewImovel() {
  const tipo        = document.getElementById('new-imovel-tipo').value;
  const address     = document.getElementById('new-imovel-address').value.trim();
  const price       = document.getElementById('new-imovel-price').value.trim() || 'R$ 0';
  const area        = document.getElementById('new-imovel-area').value.trim();
  const rooms       = document.getElementById('new-imovel-rooms').value.trim();
  const bathrooms   = document.getElementById('new-imovel-bathrooms').value.trim();
  const parking     = document.getElementById('new-imovel-parking').value.trim();
  const owner       = document.getElementById('new-imovel-owner').value.trim();
  const ownerPhone  = document.getElementById('new-imovel-owner-phone').value.trim();
  const description = document.getElementById('new-imovel-description').value.trim();
  const col         = parseInt(document.getElementById('new-imovel-col').value, 10);
  const photos      = (_pendingPhotos || []).slice(0, 5);
  
  if (!address) return;

  if (_editingImovelId) {
    const imovel = state.imoveis.find(i => i.id === _editingImovelId);
    if (imovel) {
      imovel.tipo = tipo;
      imovel.address = address;
      imovel.price = price;
      imovel.area = area;
      imovel.rooms = rooms;
      imovel.bathrooms = bathrooms;
      imovel.parking = parking;
      imovel.owner = owner;
      imovel.ownerPhone = ownerPhone;
      imovel.description = description;
      imovel.col = col;
      imovel.photos = photos;
      state.activities.unshift({ text: `Imóvel ${address} atualizado`, time: 'Agora mesmo', icon: '📝' });
    }
  } else {
    const colors = ['#fb6551','#a2d5f2','#a8e6cf','#d4c5f9','#ffd3b6'];
    state.imoveis.push({
      id: 'i' + Date.now(), tipo, address, price, area, rooms, bathrooms, parking, owner, ownerPhone, description, col,
      color: colors[state.imoveis.length % colors.length],
      photos,
    });
    state.activities.unshift({ text: `Novo imóvel adicionado: ${address}`, time: 'Agora mesmo', icon: '🏠' });
  }

  saveImoveisToStorage();
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

// ─── Fotos do imóvel ──────────────────────────
let _pendingPhotos = [];

function handleImovelPhotosChange(files) {
  const maxPhotos = 5;
  const maxSizeMB = 2;
  const selected = Array.from(files || []);
  const filtered = [];

  for (const file of selected) {
    if (!file.type.startsWith('image/')) continue;
    if (file.size > maxSizeMB * 1024 * 1024) {
      showToast(`Imagem '${file.name}' maior que ${maxSizeMB}MB`, 'warning');
      continue;
    }
    filtered.push(file);
    if (filtered.length >= maxPhotos) break;
  }

  if (!filtered.length) return;

  const readers = filtered.map(f => new Promise(resolve => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => resolve(null);
    fr.readAsDataURL(f);
  }));

  Promise.all(readers).then(results => {
    _pendingPhotos = results.filter(Boolean).slice(0, maxPhotos);
    renderPhotoPreview(_pendingPhotos);
  });
}

function removePhotoAt(index) {
  _pendingPhotos.splice(index, 1);
  renderPhotoPreview(_pendingPhotos);
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

function addNewLead() {
  const name     = document.getElementById('new-lead-name')?.value.trim();
  const company  = document.getElementById('new-lead-company')?.value.trim();
  const role     = document.getElementById('new-lead-role')?.value.trim();
  const email    = document.getElementById('new-lead-email')?.value.trim();
  const phone    = document.getElementById('new-lead-phone')?.value.trim();
  const value    = document.getElementById('new-lead-value')?.value.trim();
  const col      = parseInt(document.getElementById('new-lead-col')?.value ?? '0', 10) || 0;

  if (!name || !phone) { showToast('Preencha nome e telefone do lead', 'warning'); return; }

  const lead = { id: 'l' + Date.now(), name, company, role, email, phone, value, col, createdAt: Date.now() };
  state.leads.unshift(lead);
  state.activities.unshift({ text: `Novo lead adicionado: ${name}`, time: 'Agora mesmo', icon: '👤' });
  closeModal('modal-add-lead');
  clearModalFields(['new-lead-name','new-lead-company','new-lead-role','new-lead-email','new-lead-phone','new-lead-value']);
  const colSelect = document.getElementById('new-lead-col');
  if (colSelect) colSelect.value = '0';
  showToast('Lead salvo (demo)', 'success');
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
  _pendingPhotos = [];
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

// ─── Keyboard shortcuts ───────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeDetailModal();
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      overlay.classList.remove('open');
    }
  });
});

// ─── Init ─────────────────────────────────────
(function init() {
  document.getElementById('view-login').classList.add('active');
  const photoInput = document.getElementById('new-imovel-photos');
  if (photoInput) {
    photoInput.addEventListener('change', e => handleImovelPhotosChange(e.target.files));
  }
})();
