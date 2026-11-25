<?php
/* teste de carga do api/presenca.php — rode no terminal:
     php tools/teste_presenca.php http://localhost/muskfest/api/presenca.php 1000
   Simula N abas (ids sorteados) batendo ao mesmo tempo e mostra o tempo e a contagem devolvida.
   ATENÇÃO: todas as abas simuladas vêm do mesmo IP, então, para o teste, suba IP_MAX_SESS e IP_MAX_MIN no presenca.php
   (por exemplo 100000) e DEPOIS devolva aos valores normais. */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$url = $argv[1] ?? 'http://localhost/muskfest/api/presenca.php';
$n   = max(1, (int)($argv[2] ?? 500));
function uuid() { $b = random_bytes(16); $b[6] = chr((ord($b[6]) & 0x0f) | 0x40); $b[8] = chr((ord($b[8]) & 0x3f) | 0x80); $h = bin2hex($b); return substr($h,0,8).'-'.substr($h,8,4).'-'.substr($h,12,4).'-'.substr($h,16,4).'-'.substr($h,20); }
$mh = curl_multi_init(); $hs = [];
$t0 = microtime(true);
for ($i = 0; $i < $n; $i++) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['a' => 'ping', 's' => uuid(), 'f' => mt_rand(0, 3)])]);
    curl_multi_add_handle($mh, $ch); $hs[] = $ch;
}
do { curl_multi_exec($mh, $run); curl_multi_select($mh, 0.2); } while ($run > 0);
$ok = 0; $erro = 0; $ult = '';
foreach ($hs as $ch) { $c = curl_getinfo($ch, CURLINFO_RESPONSE_CODE); if ($c === 200) { $ok++; $ult = curl_multi_getcontent($ch); } else { $erro++; } curl_multi_remove_handle($mh, $ch); }
printf("%d pedidos em %.2f s  |  ok: %d  erro: %d\n", $n, microtime(true) - $t0, $ok, $erro);
echo "última resposta: $ult\n";
