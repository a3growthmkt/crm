<?php
/**
 * A3 FLOW – webhook.php
 * Receptor de webhooks da Evolution API para o servidor Hostinger
 *
 * Configuração na Evolution API:
 *   URL: https://seusite.com/webhook.php
 *   Eventos: MESSAGES_UPSERT, CONNECTION_UPDATE, QRCODE_UPDATED
 *
 * Como funciona:
 *   1. Evolution API envia um POST com payload JSON
 *   2. Este script valida e armazena em messages.json
 *   3. O CRM lê messages.json periodicamente para exibir as mensagens
 */

// ─── Segurança ─────────────────────────────────
define('MAX_MESSAGES', 500);  // máximo de mensagens armazenadas
define('MESSAGES_FILE', __DIR__ . '/messages.json');
define('LOG_FILE', __DIR__ . '/webhook.log');

// Validar método
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

// Headers CORS para o CRM poder ler
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, apikey');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ─── Ler payload ───────────────────────────────
$raw   = file_get_contents('php://input');
$data  = json_decode($raw, true);

if (!$data || !isset($data['event'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid payload']);
    exit;
}

$event    = $data['event'];
$instance = $data['instance'] ?? 'unknown';

// ─── Processar evento ──────────────────────────
switch ($event) {
    case 'messages.upsert':
        handleMessages($data['data'] ?? [], $instance);
        break;

    case 'connection.update':
        handleConnectionUpdate($data['data'] ?? [], $instance);
        break;

    case 'qrcode.updated':
        handleQRCode($data['data'] ?? [], $instance);
        break;

    default:
        // Evento não tratado — apenas log
        logEvent("Unhandled event: $event");
        break;
}

echo json_encode(['status' => 'ok', 'event' => $event]);

// ─── Handlers ──────────────────────────────────

function handleMessages(array $messages, string $instance): void {
    if (empty($messages)) return;

    $stored = loadMessages();

    foreach ($messages as $msg) {
        // Normalizar estrutura
        $normalized = [
            'id'               => $msg['key']['id'] ?? uniqid(),
            'remoteJid'        => $msg['key']['remoteJid'] ?? '',
            'fromMe'           => $msg['key']['fromMe'] ?? false,
            'pushName'         => $msg['pushName'] ?? '',
            'messageTimestamp' => $msg['messageTimestamp'] ?? time(),
            'body'             => extractBody($msg),
            'instance'         => $instance,
            'receivedAt'       => time(),
        ];

        // Evitar duplicatas
        $exists = false;
        foreach ($stored['messages'] as $s) {
            if ($s['id'] === $normalized['id']) { $exists = true; break; }
        }
        if (!$exists) {
            array_unshift($stored['messages'], $normalized);
        }
    }

    // Limitar tamanho
    if (count($stored['messages']) > MAX_MESSAGES) {
        $stored['messages'] = array_slice($stored['messages'], 0, MAX_MESSAGES);
    }

    $stored['lastUpdated'] = time();
    saveMessages($stored);
    logEvent("Stored " . count($messages) . " message(s) for instance $instance");
}

function handleConnectionUpdate(array $data, string $instance): void {
    $stored = loadMessages();
    $stored['connection'] = [
        'state'     => $data['state'] ?? 'unknown',
        'instance'  => $instance,
        'updatedAt' => time(),
    ];
    saveMessages($stored);
    logEvent("Connection update for $instance: " . ($data['state'] ?? 'unknown'));
}

function handleQRCode(array $data, string $instance): void {
    $stored = loadMessages();
    $stored['qrcode'] = [
        'base64'    => $data['qrcode']['base64'] ?? $data['base64'] ?? '',
        'instance'  => $instance,
        'updatedAt' => time(),
    ];
    saveMessages($stored);
    logEvent("QR code updated for instance $instance");
}

// ─── Helpers ───────────────────────────────────

function extractBody(array $msg): string {
    return $msg['message']['conversation']
        ?? $msg['message']['extendedTextMessage']['text']
        ?? $msg['message']['imageMessage']['caption']
        ?? $msg['message']['videoMessage']['caption']
        ?? $msg['message']['documentMessage']['title']
        ?? '[mídia]';
}

function loadMessages(): array {
    if (!file_exists(MESSAGES_FILE)) {
        return ['messages' => [], 'connection' => [], 'qrcode' => [], 'lastUpdated' => 0];
    }
    $content = file_get_contents(MESSAGES_FILE);
    $decoded = json_decode($content, true);
    return is_array($decoded) ? $decoded : ['messages' => [], 'connection' => [], 'qrcode' => [], 'lastUpdated' => 0];
}

function saveMessages(array $data): void {
    file_put_contents(MESSAGES_FILE, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
}

function logEvent(string $msg): void {
    $line = date('[Y-m-d H:i:s]') . ' ' . $msg . PHP_EOL;
    file_put_contents(LOG_FILE, $line, FILE_APPEND | LOCK_EX);
}
