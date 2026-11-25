<?php
/* ============================================================
   avatar_upload.php — foto de perfil do jogador.
   Recebe a foto (POST), confere quem está logado perguntando ao Supabase, corta em quadrado e grava 3 tamanhos em WebP
   (qualidade 75) em uploads/avatars/<id>_146.webp, _30.webp e _15.webp. Devolve {ok:true, v:"uploads/avatars/<id>?v=<hora>"};
   o jogo grava esse valor em profiles.avatar_url com a sessão do próprio jogador.
   Precisa da extensão GD do PHP com suporte a WebP (XAMPP: já vem; confira com gd_info()['WebP Support']).
   ============================================================ */

const SUPABASE_URL = 'https://qeqbijdrrupkgqeutzeu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ak9f8hTRX0dVgptIxOcL2g_8XfRLjGx';   // chave PÚBLICA (a mesma do index.html)
const SSL_VERIFY   = true;                 // XAMPP/Windows com erro de certificado (curl 60)? ponha false SÓ no localhost
const TAMANHOS     = [146, 30, 15];        // px: página de perfil | busca e ranking | ranking do menu das fases e da tela da fase
const QUALIDADE    = 75;                   // WebP
const MAX_BYTES    = 4 * 1024 * 1024;      // o jogo já reduz a foto antes de enviar; isto é só a trava do servidor
const MAX_LADO     = 4096;                 // px (evita imagens gigantes que estouram a memória)

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function sai($cod, $arr) { http_response_code($cod); echo json_encode($arr); exit; }

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') sai(405, ['ok' => false, 'erro' => 'metodo']);

/* ---- 1) quem é? (o token vem no corpo do POST: alguns Apache descartam o cabeçalho Authorization) ---- */
$token = (string)($_POST['token'] ?? '');
if (!preg_match('/^[A-Za-z0-9._-]{20,4096}$/', $token)) sai(401, ['ok' => false, 'erro' => 'sem_login']);

function supa_usuario($token) {
    if (!function_exists('curl_init')) return '';
    $ch = curl_init(SUPABASE_URL . '/auth/v1/user');
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER     => ['apikey: ' . SUPABASE_KEY, 'Authorization: Bearer ' . $token, 'Accept: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT        => 6,
        CURLOPT_SSL_VERIFYPEER => SSL_VERIFY,
        CURLOPT_SSL_VERIFYHOST => SSL_VERIFY ? 2 : 0,
    ]);
    $corpo = curl_exec($ch);
    $http  = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($corpo === false || $http !== 200) return '';
    $d = json_decode($corpo, true);
    $id = is_array($d) ? (string)($d['id'] ?? '') : '';
    return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $id) ? strtolower($id) : '';
}
$uid = supa_usuario($token);
if ($uid === '') sai(401, ['ok' => false, 'erro' => 'sem_login']);

/* ---- 2) pasta de destino (sem execução de PHP dentro dela) ---- */
$dir = __DIR__ . '/uploads/avatars';
if (!is_dir($dir) && !@mkdir($dir, 0755, true)) sai(500, ['ok' => false, 'erro' => 'pasta']);
$ht = $dir . '/.htaccess';
if (!is_file($ht)) @file_put_contents($ht, "Options -ExecCGI -Indexes\n<FilesMatch \"\\.(php|phtml|phar|php[0-9])$\">\n  Require all denied\n</FilesMatch>\n<IfModule mod_headers.c>\n  Header set Cache-Control \"public, max-age=31536000, immutable\"\n</IfModule>\n");
$arq = function ($t) use ($dir, $uid) { return $dir . '/' . $uid . '_' . $t . '.webp'; };

/* ---- 3) remover (voltou para um avatar padrão) ---- */
if (($_POST['acao'] ?? '') === 'remover') {
    foreach (TAMANHOS as $t) if (is_file($arq($t))) @unlink($arq($t));
    sai(200, ['ok' => true]);
}

/* ---- 4) enviar ---- */
if (!function_exists('imagewebp') || !function_exists('imagecreatefromstring')) sai(501, ['ok' => false, 'erro' => 'gd_webp']);
$f = $_FILES['foto'] ?? null;
if (!$f || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    $e = $f['error'] ?? UPLOAD_ERR_NO_FILE;
    sai(400, ['ok' => false, 'erro' => ($e === UPLOAD_ERR_INI_SIZE || $e === UPLOAD_ERR_FORM_SIZE) ? 'arquivo_grande' : 'sem_arquivo']);
}
if ($f['size'] > MAX_BYTES) sai(413, ['ok' => false, 'erro' => 'arquivo_grande']);
if (is_file($arq(TAMANHOS[0])) && time() - filemtime($arq(TAMANHOS[0])) < 3) sai(429, ['ok' => false, 'erro' => 'devagar']);   // anti-spam

$info = @getimagesize($f['tmp_name']);
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
if (!$info || !in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) sai(415, ['ok' => false, 'erro' => 'formato']);
if ($info[0] < 16 || $info[1] < 16 || $info[0] > MAX_LADO || $info[1] > MAX_LADO) sai(415, ['ok' => false, 'erro' => 'dimensao']);

$src = @imagecreatefromstring((string)file_get_contents($f['tmp_name']));
if (!$src) sai(415, ['ok' => false, 'erro' => 'formato']);

$w = imagesx($src); $h = imagesy($src); $l = min($w, $h);            // corta no centro, em quadrado
$sx = (int)(($w - $l) / 2); $sy = (int)(($h - $l) / 2);

function quadrado($src, $sx, $sy, $l, $t) {                          // $t x $t, com transparência preservada
    $d = imagecreatetruecolor($t, $t);
    imagealphablending($d, false); imagesavealpha($d, true);
    imagefill($d, 0, 0, imagecolorallocatealpha($d, 0, 0, 0, 127));
    imagecopyresampled($d, $src, 0, 0, $sx, $sy, $t, $t, $l, $l);
    return $d;
}
$grande = quadrado($src, $sx, $sy, $l, TAMANHOS[0]);                 // os menores saem do 146 (reduz serrilhado)
imagedestroy($src);

$tmps = []; $erro = false;
foreach (TAMANHOS as $i => $t) {
    $im  = $i === 0 ? $grande : quadrado($grande, 0, 0, TAMANHOS[0], $t);
    $tmp = $arq($t) . '.tmp';
    if (!imagewebp($im, $tmp, QUALIDADE)) $erro = true;
    $tmps[$t] = $tmp;
    if ($i > 0) imagedestroy($im);
}
imagedestroy($grande);
if ($erro) { foreach ($tmps as $x) @unlink($x); sai(500, ['ok' => false, 'erro' => 'gravar']); }
foreach ($tmps as $t => $x) rename($x, $arq($t));

sai(200, ['ok' => true, 'v' => 'uploads/avatars/' . $uid . '?v=' . time()]);
