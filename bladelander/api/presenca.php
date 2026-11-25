<?php
/* ============================================================
   api/presenca.php — jogadores online (geral e por fase) + quem está online (borda verde dos avatares)

   O jogo manda um POST JSON a cada ~40 s ("estou aqui, na fase X") e na hora em que entra ou sai de uma fase:
       {"a":"ping","s":"<uuid da aba>","f":3}                 f = número da fase, 0 = só no menu/intro
       {"a":"ping","s":"...","f":0,"t":"<token do Supabase>"}  t só vai quando o jogador loga (o PHP confere o token com o Supabase)
       {"a":"ping","s":"...","f":0,"lo":1}                     lo = o jogador saiu da conta
       {"a":"sair","s":"<uuid da aba>"}                         (sendBeacon ao fechar a aba)
   A resposta já traz os números: {"t":hora,"total":128,"fases":{"1":40,"3":12},"ttl":100} (+ "v" e "u" quando veio token).
   No máximo a cada JSON_MIN segundos o PHP reescreve api/online.json (mesmo formato), que o jogo lê a cada 3 s sem passar pelo PHP.
   Quem fica TTL segundos sem bater deixa de contar. Configuração e funções: presenca_lib.php. PHP 7.4+ com pdo_sqlite.
   ============================================================ */
require __DIR__ . '/presenca_lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
ignore_user_abort(true);   // o "sair" (sendBeacon) termina mesmo com a aba já fechada

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    resp(405, ['erro' => 'metodo']);
}

$raw = file_get_contents('php://input', false, null, 0, CORPO_MAX + 1);
if ($raw === false || strlen($raw) > CORPO_MAX) resp(413, ['erro' => 'grande']);
$d = json_decode($raw, true);
if (!is_array($d)) resp(400, ['erro' => 'json']);

$acao   = (isset($d['a']) && $d['a'] === 'sair') ? 'sair' : 'ping';
$sessao = (isset($d['s']) && is_string($d['s'])) ? strtolower($d['s']) : '';
if (!preg_match(UUID_RE, $sessao)) resp(400, ['erro' => 'sessao']);
$fase = isset($d['f']) ? (int)$d['f'] : 0;
if ($fase < 0 || $fase > FASES_MAX) $fase = 0;
$token  = (isset($d['t']) && is_string($d['t'])) ? $d['t'] : '';
$logout = !empty($d['lo']);

try {
    $pdo   = abre_db();
    $agora = time();
    $ip    = ip_hash();

    /* login: confere o token com o Supabase (fora da transação, para não segurar a trava do banco; limitado por IP) */
    $user = null;
    if ($acao === 'ping' && $token !== '') {
        $pdo->exec('BEGIN IMMEDIATE');
        $liberado = limita($pdo, 'v' . $ip, IP_MAX_VERIF, $agora);
        $pdo->exec('COMMIT');
        if ($liberado) $user = verifica_token($token);
    }
    $mudaUser = ($user !== null) || $logout;

    $pdo->exec('BEGIN IMMEDIATE');
    try {
        if ($acao === 'sair') {
            $pdo->prepare('DELETE FROM presenca WHERE sessao = ?')->execute([$sessao]);
        } elseif (limita($pdo, 'p' . $ip, IP_MAX_MIN, $agora)) {
            $st = $pdo->prepare('SELECT fase, visto_em FROM presenca WHERE sessao = ?');
            $st->execute([$sessao]);
            $ex = $st->fetch(PDO::FETCH_ASSOC);
            if ($ex) {
                if (($agora - (int)$ex['visto_em']) >= SESSAO_MIN || (int)$ex['fase'] !== $fase || $mudaUser) {
                    if ($user !== null) {
                        $pdo->prepare('UPDATE presenca SET fase = ?, visto_em = ?, user_id = ?, username = ? WHERE sessao = ?')
                            ->execute([$fase, $agora, $user['id'], $user['username'], $sessao]);
                    } elseif ($logout) {
                        $pdo->prepare('UPDATE presenca SET fase = ?, visto_em = ?, user_id = NULL, username = NULL WHERE sessao = ?')
                            ->execute([$fase, $agora, $sessao]);
                    } else {
                        $pdo->prepare('UPDATE presenca SET fase = ?, visto_em = ? WHERE sessao = ?')->execute([$fase, $agora, $sessao]);
                    }
                }
            } else {
                $st = $pdo->prepare('SELECT COUNT(*) FROM presenca WHERE ip = ? AND visto_em >= ?');
                $st->execute([$ip, $agora - TTL]);
                if ((int)$st->fetchColumn() < IP_MAX_SESS) {
                    $pdo->prepare('INSERT INTO presenca (sessao, fase, user_id, username, ip, visto_em) VALUES (?, ?, ?, ?, ?, ?)
                                   ON CONFLICT(sessao) DO UPDATE SET fase = excluded.fase, visto_em = excluded.visto_em, user_id = excluded.user_id, username = excluded.username')
                        ->execute([$sessao, $fase, $user ? $user['id'] : null, $user ? $user['username'] : null, $ip, $agora]);
                }
            }
        }
        /* limpeza ocasional: linhas muito velhas e contadores de IP antigos */
        if (mt_rand(1, 50) === 1) {
            $pdo->prepare('DELETE FROM presenca WHERE visto_em < ?')->execute([$agora - TTL * 3]);
            $pdo->prepare('DELETE FROM limite WHERE janela < ?')->execute([intdiv($agora, 60) - 5]);
        }
        $pdo->exec('COMMIT');
    } catch (Throwable $e) {
        $pdo->exec('ROLLBACK');
        throw $e;
    }

    $dados = conta($pdo, $agora);
    grava_json($dados, $acao === 'sair');
    if ($token !== '') { $dados['v'] = ($user !== null); $dados['u'] = $user ? $user['username'] : null; }   // confirmação do login (não vai para o online.json)
    resp(200, $dados);
} catch (Throwable $e) {
    error_log('presenca.php: ' . $e->getMessage());
    resp(500, ['erro' => 'interno']);
}
