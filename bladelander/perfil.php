<?php
/* ============================================================
   perfil.php — página pública do jogador:  jogo.com/nomedojogador
   Chamado pelo .htaccess (RewriteRule). Por enquanto mostra só o @.
   Os textos vêm do textos.js (chaves perfil_pag_*), no idioma que o jogador escolheu no jogo.
   ============================================================ */

const SUPABASE_URL = 'https://qeqbijdrrupkgqeutzeu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ak9f8hTRX0dVgptIxOcL2g_8XfRLjGx';   // chave PÚBLICA (a mesma do index.html). NUNCA coloque a secret/service_role
const SSL_VERIFY   = true;            // XAMPP/Windows com erro de certificado (aparece "curl 60" no log)? ponha false SÓ no localhost
const OG_IMAGE     = 'img/logo.webp'; // imagem do preview ao compartilhar o link (caminho a partir da pasta do jogo)

/* pasta do jogo: "/muskfest/" no localhost, "/" quando estiver na raiz do domínio */
$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/') . '/';

/* ---- 1) o @ pedido ---- */
$pedido = isset($_GET['u']) ? (string)$_GET['u'] : '';
$u = strtolower(ltrim($pedido, '@'));
$formatoOk = (bool)preg_match('/^[a-z0-9_]{1,15}$/', $u);

if ($formatoOk && $pedido !== $u) {                 // /Fulano  ->  /fulano
    header('Location: ' . $base . $u, true, 301);
    exit;
}

/* ---- 2) busca no Supabase (função perfil_publico_v2: devolve só campos públicos) ---- */
function perfil_busca($u) {                         // retorna [estado, linha]  estado: ok | nao_achou | erro
    if (!function_exists('curl_init')) { error_log('perfil.php: extensão curl desativada no PHP'); return ['erro', null]; }
    $ch = curl_init(SUPABASE_URL . '/rest/v1/rpc/perfil_publico_v2');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(['p_username' => $u]),
        CURLOPT_HTTPHEADER     => ['apikey: ' . SUPABASE_KEY, 'Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT        => 6,
        CURLOPT_SSL_VERIFYPEER => SSL_VERIFY,
        CURLOPT_SSL_VERIFYHOST => SSL_VERIFY ? 2 : 0,
    ]);
    $corpo = curl_exec($ch);
    $http  = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $err   = curl_error($ch);
    curl_close($ch);
    if ($corpo === false || $http < 200 || $http >= 300) {
        error_log('perfil.php: Supabase HTTP ' . $http . ' | ' . $err . ' | ' . substr((string)$corpo, 0, 200));
        return ['erro', null];
    }
    $d = json_decode($corpo, true);
    if (!is_array($d)) return ['erro', null];
    if (!$d) return ['nao_achou', null];
    return ['ok', $d[0]];
}

/* foto de perfil: função pública avatar_publico (SQL em supabase_avatar.sql). Se ainda não existir no Supabase, o perfil só fica sem foto */
function perfil_avatar($u) {
    if (!function_exists('curl_init')) return '';
    $ch = curl_init(SUPABASE_URL . '/rest/v1/rpc/avatar_publico');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(['p_username' => $u]),
        CURLOPT_HTTPHEADER     => ['apikey: ' . SUPABASE_KEY, 'Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT        => 4,
        CURLOPT_SSL_VERIFYPEER => SSL_VERIFY,
        CURLOPT_SSL_VERIFYHOST => SSL_VERIFY ? 2 : 0,
    ]);
    $corpo = curl_exec($ch);
    $http  = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($corpo === false || $http < 200 || $http >= 300) return '';
    $v = json_decode($corpo, true);
    return is_string($v) ? $v : '';
}
function avatar_src($v, $base) {                    // só aceita os avatares padrão (padrao:1..3) e as fotos enviadas pelo jogo; qualquer outra coisa = sem foto
    if (preg_match('/^padrao:([1-3])$/', $v, $m)) return $base . 'img/avatars/avatar' . $m[1] . '.webp';
    if (preg_match('#^uploads/avatars/([A-Za-z0-9-]+)(\?v=\d+)?$#', $v, $m)) return $base . 'uploads/avatars/' . $m[1] . '_146.webp' . ($m[2] ?? '');
    if (preg_match('#^https://[a-z0-9-]+\.googleusercontent\.com/[^\s"\'<>]+$#i', $v)) return preg_replace('/=s\d+(-[a-z]+)?$/', '=s292-c', $v);   // foto do login Google
    return '';
}

$estado = 'nao_achou';
$dados  = null;
if ($formatoOk) { list($estado, $dados) = perfil_busca($u); }

$nome = ($estado === 'ok' && !empty($dados['username'])) ? (string)$dados['username'] : '';
$avatarSrc = $nome !== '' ? avatar_src(perfil_avatar($nome), $base) : '';

/* ---- 3) resposta ---- */
if ($estado === 'nao_achou') http_response_code(404);
if ($estado === 'erro')      http_response_code(503);
header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Vary: X-Requested-With');            // mesma URL devolve duas coisas (página inteira ou só o miolo): o cache precisa saber
if ($estado !== 'ok') header('Cache-Control: no-store');

function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

/* miolo do perfil: usado pela página inteira (abaixo) e pela janela por cima do jogo (index.html pede com X-Requested-With: fetch) */
ob_start();
if ($estado === 'ok'):
  $seguidores = (int)($dados['seguidores'] ?? 0);
  $seguindo   = (int)($dados['seguindo'] ?? 0);
  $inicial    = mb_strtoupper(mb_substr($nome, 0, 1, 'UTF-8'), 'UTF-8'); ?>
  <style>
  /* estilo do miolo: igual na página /jogador e na janela por cima do jogo (px/clamp, não depende do tamanho do jogo) */
  .pf{width:100%;max-width:1000px;margin:0 auto;flex:1 1 auto;display:flex;flex-direction:column;text-align:left}
  .pf-topo{display:flex;align-items:center;gap:clamp(18px,4.5vw,52px);padding:clamp(12px,3vw,32px) 0 clamp(20px,3.2vw,32px);border-bottom:1px solid rgba(255,255,255,.14)}
  .pf-avatar{flex:0 0 auto;width:clamp(84px,17vw,146px);height:clamp(84px,17vw,146px);border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;
    background:linear-gradient(135deg,#3a3a3a,#161616);border:2px solid rgba(255,255,255,.22);font-weight:800;font-stretch:125%;font-size:clamp(36px,7.5vw,66px);line-height:1;text-transform:uppercase}
  .pf-avatar img{width:100%;height:100%;object-fit:cover;display:block}
  .pf-info{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:clamp(10px,1.8vw,18px)}
  .pf-nome{margin:0;font-family:'TikTok Sans',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;letter-spacing:normal;text-transform:none;font-weight:800;font-stretch:125%;font-size:clamp(20px,4vw,34px);line-height:1.15;overflow-wrap:anywhere}
  .pf-stats{display:flex;gap:clamp(20px,4vw,40px)}
  .pf-stat{all:unset;box-sizing:border-box;display:flex;align-items:baseline;gap:7px;font-size:clamp(13px,1.8vw,16px);color:#fff;cursor:pointer}
  .pf-stat:hover span,.pf-stat:focus-visible span{text-decoration:underline}
  .pf-stat:focus-visible{outline:2px solid #6b9bff;outline-offset:4px;border-radius:4px}
  .pf-stat b{font-weight:800;font-stretch:125%;font-size:clamp(16px,2.4vw,22px);line-height:1}
  .pf-stat span{opacity:.75}
  .pf-linha{display:flex;align-items:center;flex-wrap:wrap;gap:clamp(8px,1.6vw,16px)}
  .pf-avatar{position:relative}
  .pf-avatar.avOn{box-shadow:0 0 0 3px #00ffb1;border-color:#00ffb1}   /* borda verde: jogador online */
  .pf-av-in{display:flex;align-items:center;justify-content:center;width:100%;height:100%}
  .pf-av-cam{display:none;position:absolute;left:0;right:0;bottom:0;height:30%;align-items:center;justify-content:center;background:rgba(0,0,0,.6);color:#fff}
  .pf-av-cam svg{height:62%;width:auto}
  .pf-av-edit{cursor:pointer;transition:border-color .15s}
  .pf-av-edit .pf-av-cam{display:flex}
  .pf-av-edit:hover{border-color:rgba(255,255,255,.75)}
  .pf-av-edit:focus-visible{outline:2px solid #6b9bff;outline-offset:4px}
  .pf-edit{display:inline-flex;align-items:center;gap:8px;height:clamp(30px,4.2vw,36px);padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.08);color:#fff;font-family:inherit;font-weight:700;font-size:clamp(12px,1.6vw,14px);cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s}
  .pf-edit[hidden]{display:none}
  .pf-edit:hover,.pf-edit:focus-visible{background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.7);outline:0}
  .pf-edit svg{width:1.25em;height:1.25em;flex:none}
  .pf-corpo{flex:1 1 auto}   /* espaço do conteúdo futuro (recordes, bio, etc.), abaixo do cabeçalho */
  .pf-vazio{margin:auto;display:flex;flex-direction:column;align-items:center;gap:12px;padding:40px 16px;text-align:center}
  .pf-vazio h1{margin:0;font-family:'TikTok Sans',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;letter-spacing:normal;text-transform:none;font-weight:800;font-stretch:125%;font-size:clamp(20px,4vw,30px);line-height:1.15;overflow-wrap:anywhere}
  .pf-vazio p{margin:0;opacity:.75;font-size:15px;line-height:1.4}
  </style>
  <section class="pf">
    <div class="pf-topo">
      <!-- FOTO DE PERFIL (futuro): trocar a inicial por <img src="..."> dentro do .pf-avatar -->
      <div class="pf-avatar" data-onl="<?= h(strtolower($nome)) ?>"><span class="pf-av-in"><?php if ($avatarSrc !== ''): ?><img src="<?= h($avatarSrc) ?>" alt=""><?php else: echo h($inicial); endif; ?></span><span class="pf-av-cam" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM9 2 7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9z"/></svg></span></div>
      <div class="pf-info">
        <div class="pf-linha"><h1 class="pf-nome">@<?= h($nome) ?></h1><button type="button" class="pf-edit" hidden data-u="<?= h($nome) ?>"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg><span data-t="perfil_pag_editar">editar perfil</span></button></div>
        <div class="pf-stats">
          <button type="button" class="pf-stat" data-lista="seguidores" data-u="<?= h($nome) ?>"><b><?= $seguidores ?></b><span data-t="perfil_pag_seguidores">seguidores</span></button>
          <button type="button" class="pf-stat" data-lista="seguindo" data-u="<?= h($nome) ?>"><b><?= $seguindo ?></b><span data-t="perfil_pag_seguindo">seguindo</span></button>
        </div>
      </div>
    </div>
    <div class="pf-corpo"></div>
  </section>
<?php elseif ($estado === 'erro'): ?>
  <style>
  .pf-vazio{margin:auto;display:flex;flex-direction:column;align-items:center;gap:12px;padding:40px 16px;text-align:center}
  .pf-vazio h1{margin:0;font-family:'TikTok Sans',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;letter-spacing:normal;text-transform:none;font-weight:800;font-stretch:125%;font-size:clamp(20px,4vw,30px);line-height:1.15;overflow-wrap:anywhere}
  .pf-vazio p{margin:0;opacity:.75;font-size:15px;line-height:1.4}
  </style>
  <div class="pf-vazio">
    <h1 data-t="perfil_pag_erro">Não foi possível carregar o perfil</h1>
    <p data-t="perfil_pag_erro_sub">Tente de novo em alguns instantes.</p>
  </div>
<?php else: ?>
  <style>
  .pf-vazio{margin:auto;display:flex;flex-direction:column;align-items:center;gap:12px;padding:40px 16px;text-align:center}
  .pf-vazio h1{margin:0;font-family:'TikTok Sans',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;letter-spacing:normal;text-transform:none;font-weight:800;font-stretch:125%;font-size:clamp(20px,4vw,30px);line-height:1.15;overflow-wrap:anywhere}
  .pf-vazio p{margin:0;opacity:.75;font-size:15px;line-height:1.4}
  </style>
  <div class="pf-vazio">
    <h1 data-t="perfil_pag_nao_achou">Jogador não encontrado</h1>
    <p data-t="perfil_pag_nao_achou_sub">Confira o endereço ou procure o jogador pelo @ dentro do jogo.</p>
  </div>
<?php endif;
$conteudo = ob_get_clean();

if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === 'fetch') {   // pedido do jogo (AJAX): só o miolo, sem <html>
    echo '<div data-frag="1" data-estado="' . h($estado) . '">' . $conteudo . '</div>';
    exit;
}

$esquema = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$site    = $esquema . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $base;
$titulo  = $nome !== '' ? '@' . $nome . ' — MuskFest' : 'MuskFest';
?>
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?= h($titulo) ?></title>
<?php if ($estado === 'ok'): ?>
<meta property="og:type" content="profile">
<meta property="og:site_name" content="MuskFest">
<meta property="og:title" content="<?= h($titulo) ?>">
<meta property="og:url" content="<?= h($site . $nome) ?>">
<meta property="og:image" content="<?= h($site . OG_IMAGE) ?>">
<meta name="twitter:card" content="summary">
<?php else: ?>
<meta name="robots" content="noindex">
<?php endif; ?>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.3.2/css/flag-icons.min.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=TikTok+Sans:opsz,slnt,wdth,wght@12..36,-12..0,100..150,300..900&display=swap">
<style>
*{box-sizing:border-box}
html{min-height:100%;background:#030303}
body{margin:0;min-height:100vh;display:flex;flex-direction:column;color:#fff;
  background:radial-gradient(ellipse at 50% 30%,#262626 0%,#0c0c0c 70%,#030303 100%) fixed;
  font-family:'TikTok Sans',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-weight:400}
/* moldura em tela cheia: barra do topo (logo + jogar) e o miolo do perfil logo abaixo */
.barra{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px clamp(16px,4vw,40px);border-bottom:1px solid rgba(255,255,255,.1)}
.logo{display:block;max-width:130px;max-height:44px;height:auto;width:auto}
main{flex:1 1 auto;display:flex;flex-direction:column;padding:0 clamp(16px,4vw,40px) 40px}
.btn{display:inline-block;padding:10px 22px;border-radius:999px;background:#fff;color:#0c0c0c;text-decoration:none;white-space:nowrap;
  font-weight:700;font-stretch:125%;font-size:13px;letter-spacing:.02em;transition:transform .15s,opacity .15s}
.btn:hover{transform:translateY(-1px);opacity:.9}
.btn:focus-visible{outline:3px solid #6b9bff;outline-offset:3px}
</style>
</head>
<body>
<header class="barra">
  <a href="<?= h($base) ?>" aria-label="MuskFest"><img class="logo" src="<?= h($base) ?>img/logo.webp" alt="MuskFest" onerror="this.parentNode.style.display='none'"></a>
  <a class="btn" href="<?= h($base) ?>" data-t="perfil_pag_jogar">Jogar MuskFest</a>
</header>
<main>
<?= $conteudo ?>
</main>

<script src="<?= h($base) ?>textos.js"></script>
<script>
/* idioma: o mesmo que o jogador escolheu no jogo (cookie/localStorage "lunarJogador"); sem isso, o do navegador */
(function(){
  var TX=window.TEXTOS;if(!TX)return;
  function ok(id){return (TX.idiomas||[]).some(function(l){return l.id===id})}
  var LANG='';
  try{
    var m=document.cookie.match(/(?:^|;\s*)lunarJogador=([^;]*)/),raw=m?decodeURIComponent(m[1]):localStorage.getItem('lunarJogador');
    if(raw){var o=JSON.parse(raw);if(o&&o.idioma)LANG=String(o.idioma)}
  }catch(e){}
  if(!ok(LANG)){
    var n=String(navigator.language||'').toLowerCase(),c=n.slice(0,2);
    if(c==='pt')c=/^pt-(pt|ao|mz)/.test(n)?'pt':'ptbr';
    LANG=ok(c)?c:(TX.padrao||'ptbr');
  }
  var L=TX[LANG]||{},D=TX[TX.padrao||'ptbr']||{};
  (TX.idiomas||[]).forEach(function(l){if(l.id===LANG&&l.html)document.documentElement.lang=l.html});
  window.PF_T=function(k){var s=L[k];if(s===undefined)s=D[k];return s===undefined?k:s};   // usado pela janela de seguidores/seguindo
  Array.prototype.forEach.call(document.querySelectorAll('[data-t]'),function(el){
    var s=L[el.getAttribute('data-t')];if(s===undefined)s=D[el.getAttribute('data-t')];
    if(s!==undefined)el.textContent=s;
  });
})();
</script>
<script src="<?= h($base) ?>perfil-lista.js"></script>
<script>
/* janela de seguidores/seguindo (perfil-lista.js): aqui é só leitura (sem sessão do jogo) */
window.PerfilListaCfg={
  url:<?= json_encode(SUPABASE_URL, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?>,
  key:<?= json_encode(SUPABASE_KEY, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?>,
  base:<?= json_encode($base, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?>,
  onlUrl:<?= json_encode($base . 'api/online_users.php', JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?>,
  t:function(k){return window.PF_T?window.PF_T(k):k}
};
</script>
<?php if ($estado === 'ok'): ?>
<script>
/* borda verde no avatar quando o jogador está online (esta página não tem a sessão do jogo: só consulta api/online_users.php) */
(function(){
  var av=document.querySelector('.pf-avatar[data-onl]');if(!av)return;
  var n=av.getAttribute('data-onl'),url=<?= json_encode($base . 'api/online_users.php', JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?>+'?u='+encodeURIComponent(n);
  function ver(){
    if(document.hidden)return;
    fetch(url,{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(d){if(d)av.classList.toggle('avOn',(d.on||[]).indexOf(n)>=0)}).catch(function(){});
  }
  ver();setInterval(ver,10000);document.addEventListener('visibilitychange',ver);
})();
</script>
<?php endif; ?>
<?php if ($estado === 'ok'): ?>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.js" integrity="sha384-uteMfOloLDGt042uDz+xHGF3ym63/WQ6rFq7murQRG8Ih7QrXGEGNtWd8688sb4O" crossorigin="anonymous"></script>
<script>
/* página /jogador (fora do jogo): se quem está logado é o dono do perfil, libera "editar perfil" e a troca de foto; os dois levam ao jogo, que abre a tela certa */
(function(){
  var bt=document.querySelector('.pf-edit'),av=document.querySelector('.pf-avatar');
  if(!bt||!av||!window.supabase||!window.supabase.createClient)return;
  var u=String(bt.getAttribute('data-u')||'').toLowerCase(),base=<?= json_encode($base, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?>;
  try{
    var sb=window.supabase.createClient(<?= json_encode(SUPABASE_URL, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?>,<?= json_encode(SUPABASE_KEY, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?>,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    sb.auth.getSession().then(function(r){
      var s=r&&r.data&&r.data.session;if(!s)return;
      return sb.from('profiles').select('username').eq('id',s.user.id).maybeSingle().then(function(q){
        var n=q&&q.data&&q.data.username;if(!n||String(n).toLowerCase()!==u)return;
        bt.hidden=false;bt.onclick=function(){location.href=base+'?editar=perfil'};
        av.classList.add('pf-av-edit');av.setAttribute('role','button');av.tabIndex=0;av.title=window.PF_T?window.PF_T('avatar_titulo'):'';
        av.onclick=function(){location.href=base+'?editar=foto'};
        av.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();av.onclick()}};
      });
    }).catch(function(){});
  }catch(e){}
})();
</script>
<?php endif; ?>
</body>
</html>