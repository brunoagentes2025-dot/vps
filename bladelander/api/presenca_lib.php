<?php
/* ============================================================
   api/presenca_lib.php — configuração e funções compartilhadas por presenca.php e online_users.php.
   Não imprime nada (se alguém abrir este arquivo no navegador, vê uma página em branco).
   ============================================================ */

/* ---- configuração ---- */
const DATA_DIR    = __DIR__ . '/../data';      // banco SQLite. PRODUÇÃO (VPS): ponha FORA da pasta pública, ex.: '/var/lib/muskfest' (dono = usuário do PHP)
const ONLINE_JSON = __DIR__ . '/online.json';  // arquivo público lido pelo jogo (esta pasta precisa permitir escrita pelo PHP)
const FASES_MAX   = 99;    // maior número de fase aceito
const TTL         = 100;   // segundos sem batida = saiu
const JSON_MIN    = 3;     // idade mínima (s) do online.json para ser reescrito
const SESSAO_MIN  = 8;     // intervalo mínimo (s) entre batidas da mesma aba (mudar de fase/conta passa direto)
const IP_MAX_SESS = 60;    // abas ativas por IP (escola/NAT cabem; quem tenta inflar o contador não)
const IP_MAX_MIN  = 120;   // batidas por IP por minuto
const IP_MAX_VERIF= 20;    // verificações de login (chamadas ao Supabase) por IP por minuto
const CORPO_MAX   = 6144;  // bytes aceitos no corpo do pedido (o token de login tem ~1 a 2 KB)

/* Supabase: a mesma URL e a chave PÚBLICA (publishable) do index.html. NUNCA coloque a secret/service_role. */
const SUPABASE_URL = 'https://qeqbijdrrupkgqeutzeu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ak9f8hTRX0dVgptIxOcL2g_8XfRLjGx';
const SSL_VERIFY   = true;   // XAMPP/Windows com erro de certificado ("curl 60" no log)? ponha false SÓ no localhost (igual ao perfil.php)

const UUID_RE = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/';

function resp($codigo, $dados) {
    http_response_code($codigo);
    echo json_encode($dados);
    exit;
}

/* hash do IP com sal (o IP em si nunca é guardado) */
function ip_hash() {
    $arq = DATA_DIR . '/sal.txt';
    $sal = @file_get_contents($arq);
    if ($sal === false || $sal === '') {
        $sal = bin2hex(random_bytes(16));
        @file_put_contents($arq, $sal, LOCK_EX);
    }
    return substr(hash_hmac('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? ''), $sal), 0, 16);
}

/* banco completo (cria/atualiza as tabelas): usado por quem ESCREVE */
function abre_db() {
    if (!is_dir(DATA_DIR) && !@mkdir(DATA_DIR, 0775, true)) throw new RuntimeException('sem pasta de dados: ' . DATA_DIR);
    $novo = !file_exists(DATA_DIR . '/presenca.db');
    $pdo = new PDO('sqlite:' . DATA_DIR . '/presenca.db', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 4]);
    $pdo->exec('PRAGMA busy_timeout = 4000');
    if ($novo) $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA synchronous = NORMAL');
    $pdo->exec('CREATE TABLE IF NOT EXISTS presenca (
        sessao   TEXT PRIMARY KEY,
        fase     INTEGER NOT NULL DEFAULT 0,
        user_id  TEXT,                          -- jogador logado (verificado pelo token do Supabase)
        username TEXT,                          -- @ dele em minúsculas (para a borda verde dos avatares)
        ip       TEXT NOT NULL,
        visto_em INTEGER NOT NULL
    )');
    $cols = $pdo->query('PRAGMA table_info(presenca)')->fetchAll(PDO::FETCH_COLUMN, 1);
    if (!in_array('username', $cols, true)) $pdo->exec('ALTER TABLE presenca ADD COLUMN username TEXT');   // banco criado antes da borda verde
    $pdo->exec('CREATE INDEX IF NOT EXISTS presenca_visto ON presenca (visto_em)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS presenca_ip ON presenca (ip)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS presenca_user ON presenca (username)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS limite (ip TEXT PRIMARY KEY, janela INTEGER NOT NULL, n INTEGER NOT NULL)');
    return $pdo;
}

/* banco só para LER (consultas de quem está online): não mexe no esquema, então não disputa trava de escrita */
function abre_db_leitura() {
    $arq = DATA_DIR . '/presenca.db';
    if (!file_exists($arq)) return null;
    $pdo = new PDO('sqlite:' . $arq, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 4]);
    $pdo->exec('PRAGMA busy_timeout = 4000');
    return $pdo;
}

/* conta uma ação na janela de 1 minuto (dentro de uma transação). true = dentro do limite */
function limita($pdo, $chave, $max, $agora) {
    $janela = intdiv($agora, 60);
    $pdo->prepare('INSERT INTO limite (ip, janela, n) VALUES (?, ?, 1)
                   ON CONFLICT(ip) DO UPDATE SET n = CASE WHEN limite.janela = excluded.janela THEN limite.n + 1 ELSE 1 END, janela = excluded.janela')
        ->execute([$chave, $janela]);
    $st = $pdo->prepare('SELECT n FROM limite WHERE ip = ?');
    $st->execute([$chave]);
    return (int)$st->fetchColumn() <= $max;
}

function conta($pdo, $agora) {
    $st = $pdo->prepare('SELECT fase, COUNT(*) AS n FROM presenca WHERE visto_em >= ? GROUP BY fase');
    $st->execute([$agora - TTL]);
    $total = 0;
    $fases = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $n = (int)$r['n'];
        $total += $n;
        if ((int)$r['fase'] > 0) $fases[(string)(int)$r['fase']] = $n;
    }
    return ['t' => $agora, 'total' => $total, 'fases' => (object)$fases, 'ttl' => TTL];
}

/* reescreve o online.json (só um processo por vez; grava num temporário e renomeia, então o jogo nunca lê um JSON pela metade) */
function grava_json($dados, $forcar) {
    $lock = @fopen(DATA_DIR . '/online.lock', 'c');
    if (!$lock) return;
    if (!flock($lock, LOCK_EX | LOCK_NB)) { fclose($lock); return; }      // outro pedido já está escrevendo
    clearstatcache(true, ONLINE_JSON);
    $idade = file_exists(ONLINE_JSON) ? (time() - (int)filemtime(ONLINE_JSON)) : PHP_INT_MAX;
    if ($forcar || $idade >= JSON_MIN) {
        $tmp = ONLINE_JSON . '.tmp';
        if (@file_put_contents($tmp, json_encode($dados), LOCK_EX) !== false) {
            if (!@rename($tmp, ONLINE_JSON)) { @copy($tmp, ONLINE_JSON); @unlink($tmp); }
        }
    }
    flock($lock, LOCK_UN);
    fclose($lock);
}

/* GET no Supabase com o token do jogador (devolve o JSON decodificado, ou null) */
function supabase_get($caminho, $token) {
    if (!function_exists('curl_init')) { error_log('presenca: extensão curl desativada no PHP'); return null; }
    $ch = curl_init(SUPABASE_URL . $caminho);
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER     => ['apikey: ' . SUPABASE_KEY, 'Authorization: Bearer ' . $token, 'Accept: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT        => 5,
        CURLOPT_SSL_VERIFYPEER => SSL_VERIFY,
        CURLOPT_SSL_VERIFYHOST => SSL_VERIFY ? 2 : 0,
    ]);
    $corpo = curl_exec($ch);
    $http  = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $err   = curl_error($ch);
    curl_close($ch);
    if ($corpo === false || $http < 200 || $http >= 300) {
        error_log('presenca: Supabase ' . $caminho . ' HTTP ' . $http . ' | ' . $err . ' | ' . substr((string)$corpo, 0, 120));
        return null;
    }
    $d = json_decode($corpo, true);
    return is_array($d) ? $d : null;
}

/* confere o token de login com o Supabase. Devolve ['id' => uuid, 'username' => '@ em minúsculas' ou null], ou null se o token não vale */
function verifica_token($token) {
    if (!is_string($token) || strlen($token) > 4096 || !preg_match('/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/', $token)) return null;
    $u = supabase_get('/auth/v1/user', $token);                              // só responde se o token for válido e não tiver expirado
    if (!$u || empty($u['id']) || !is_string($u['id']) || !preg_match(UUID_RE, strtolower($u['id']))) return null;
    $id = strtolower($u['id']);
    $p  = supabase_get('/rest/v1/profiles?select=username&id=eq.' . $id, $token);   // o próprio perfil, lido com o token dele
    $nome = null;
    if ($p && isset($p[0]['username']) && is_string($p[0]['username']) && preg_match('/^[A-Za-z0-9_]{1,20}$/', $p[0]['username'])) $nome = strtolower($p[0]['username']);
    return ['id' => $id, 'username' => $nome];
}
