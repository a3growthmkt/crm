/**
 * A3 FLOW CRM – Script de Automação de Demo
 * Cole e execute no Console do browser (F12 > Console) enquanto estiver em http://localhost:3000
 */
(async function run() {
  const delay = ms => new Promise(r => setTimeout(r, ms));

  console.log('🚀 [A3 FLOW Demo] Iniciando automação...');

  // ── ETAPA 1: LOGIN ──────────────────────────────────
  console.log('🔐 Etapa 1: Fazendo login...');
  const emailEl = document.getElementById('login-email');
  const passEl  = document.getElementById('login-password');
  const form    = document.getElementById('login-form');

  if (!emailEl || !passEl || !form) {
    console.error('❌ Página de login não encontrada. Certifique-se de estar em http://localhost:3000');
    return;
  }

  emailEl.value = 'carlos@empresa.com';
  passEl.value  = '123456';
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await delay(1200);
  console.log('✅ Login efetuado!');

  // ── ETAPA 2: NAVEGAR PARA KANBAN ────────────────────
  console.log('📋 Etapa 2: Navegando para Kanban...');
  if (typeof navigate === 'function') {
    navigate('kanban');
  } else {
    console.error('❌ Função navigate() não encontrada.');
    return;
  }
  await delay(600);
  console.log('✅ Kanban carregado!');

  // ── ETAPA 3: CRIAR LEAD ──────────────────────────────
  console.log('➕ Etapa 3: Criando novo lead...');
  if (typeof openAddLeadModal === 'function') {
    openAddLeadModal();
  } else {
    console.error('❌ Função openAddLeadModal() não encontrada.');
    return;
  }
  await delay(400);

  // Confirmar que o modal abriu
  const modal = document.getElementById('modal-add-lead');
  if (!modal || !modal.classList.contains('open')) {
    console.warn('⚠️ Modal não abriu, tentando novamente...');
    openAddLeadModal();
    await delay(400);
  }

  // Preencher campos
  const setValue = (id, val) => {
    const el = document.getElementById(id);
    if (el) { el.value = val; el.dispatchEvent(new Event('input')); }
    else console.warn(`⚠️ Campo ${id} não encontrado`);
  };

  setValue('new-lead-name',    'Contato WhatsApp');
  setValue('new-lead-company', 'Teste WA');
  setValue('new-lead-role',    'Cliente');
  setValue('new-lead-phone',   '55999414301');
  setValue('new-lead-value',   'R$ 0');
  setValue('new-lead-col',     '0');

  await delay(300);

  // Submeter o lead
  if (typeof addNewLead === 'function') {
    addNewLead();
  } else {
    // Tentar clicar no botão
    const addBtn = Array.from(document.querySelectorAll('#modal-add-lead button'))
      .find(b => b.textContent.includes('Adicionar'));
    if (addBtn) addBtn.click();
    else { console.error('❌ Botão Adicionar Lead não encontrado.'); return; }
  }

  await delay(600);
  console.log('✅ Lead criado!');

  // ── ETAPA 4: ABRIR CHAT DO LEAD ─────────────────────
  console.log('💬 Etapa 4: Abrindo chat WhatsApp do lead...');

  // Encontrar o lead recém criado
  const lead = (typeof state !== 'undefined' && state.leads)
    ? state.leads.find(l => l.phone && l.phone.replace(/\D/g, '') === '55999414301')
    : null;

  if (!lead) {
    console.error('❌ Lead com número 55999414301 não encontrado no state.');
    return;
  }

  console.log(`✅ Lead encontrado: ${lead.name} (id: ${lead.id})`);

  // Abrir o slide-out do lead
  if (typeof openLeadDetail === 'function') {
    openLeadDetail(lead.id, { stopPropagation: () => {} });
  } else {
    console.error('❌ Função openLeadDetail() não encontrada.');
    return;
  }
  await delay(500);

  // Trocar para a aba de chat
  if (typeof switchLeadTab === 'function') {
    switchLeadTab('chat');
  } else {
    const chatTab = document.querySelector('.so-tab[data-tab="chat"]');
    if (chatTab) chatTab.click();
  }
  await delay(2000); // Aguarda carregar mensagens

  console.log('✅ Chat WhatsApp aberto!');

  // ── ETAPA 5: ENVIAR MENSAGEM ─────────────────────────
  console.log('📤 Etapa 5: Enviando mensagem WhatsApp...');

  const chatInput = document.getElementById('chat-input');
  if (!chatInput) {
    console.error('❌ Campo de chat não encontrado.');
    return;
  }

  chatInput.value = 'Olá! Tudo bem? Entrando em contato pelo A3 FLOW CRM.';
  chatInput.dispatchEvent(new Event('input'));

  if (typeof sendWhatsAppMessage === 'function') {
    await sendWhatsAppMessage();
  } else {
    chatInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }

  await delay(3000);
  console.log('🏁 [A3 FLOW Demo] Automação concluída! Verifique o resultado na tela.');
})();
