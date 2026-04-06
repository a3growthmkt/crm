/* =============================================
   A3 FLOW – config.js
   Configuração de ambiente (dev / produção)
   ============================================= */

const A3_CONFIG = {
  // ─── Ambiente ──────────────────────────────
  // Detecta automaticamente se está em produção (https) ou dev (file://)
  isProduction: window.location.protocol === 'https:',
  siteUrl: window.location.origin,

  // ─── Evolution API ─────────────────────────
  // Defaults (sobrescritos pelo localStorage quando o usuário salva)
  evo: {
    url:      'https://n8n-evolution-api.70zt7a.easypanel.host',
    key:      '',
    instance: 'cesar',
  },

  // ─── Webhook (Hostinger) ───────────────────
  // Em produção, o webhook.php recebe eventos da Evolution API
  // e armazena em messages.json para o CRM consumir
  webhookEndpoint: '/webhook.php',    // caminho relativo ao site
  webhookMessagesFile: '/messages.json',

  // ─── WebSocket ─────────────────────────────
  wsEnabled: true,           // tenta WebSocket primeiro
  wsReconnectInterval: 5000, // ms para reconectar se cair

  // ─── Polling ───────────────────────────────
  pollingInterval: 15000,    // ms (fallback se WS não disponível)
  pollingEnabled: true,

  // ─── App ───────────────────────────────────
  appName: 'A3 FLOW',
  version: '1.0.0',
};

// Disponível globalmente como window.A3_CONFIG
window.A3_CONFIG = A3_CONFIG;
