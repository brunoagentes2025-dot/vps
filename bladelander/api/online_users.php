<?php
/* ============================================================
   api/online_users.php — quais destes @ estão online agora (borda verde dos avatares)
       GET api/online_users.php?u=bruno,bruno7,fulano     (até 100 nomes por pedido)
   Resposta: {"on":["bruno","fulano"],"t":hora}. Só leitura; não guarda nada.
   Online = tem uma aba logada que bateu em presenca.php nos últimos TTL segundos.
   ============================================================ */
require __DIR__ . '/presenca_lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$lista = isset($_GET['u']) && is_string($_GET['u']) ? $_GET['u'] : '';
$nomes = [];
foreach (explode(',', strtolower($lista)) as $n) {
    $n = ltrim(trim($n), '@');
    if (preg_match('/^[a-z0-9_]{1,20}$/', $n)) $nomes[$n] = true;
    if (count($nomes) >= 100) break;
}
$nomes = array_keys($nomes);
$agora = time();
if (!$nomes) resp(200, ['on' => [], 't' => $agora]);

try {
    $pdo = abre_db_leitura();
    if (!$pdo) resp(200, ['on' => [], 't' => $agora]);
    $in = implode(',', array_fill(0, count($nomes), '?'));
    $st = $pdo->prepare('SELECT DISTINCT username FROM presenca WHERE visto_em >= ? AND username IN (' . $in . ')');
    $st->execute(array_merge([$agora - TTL], $nomes));
    resp(200, ['on' => array_values($st->fetchAll(PDO::FETCH_COLUMN)), 't' => $agora]);
} catch (Throwable $e) {
    error_log('online_users.php: ' . $e->getMessage());
    resp(200, ['on' => [], 't' => $agora]);     // erro (ex.: banco ainda sem a coluna): sem borda verde, nada quebra
}
