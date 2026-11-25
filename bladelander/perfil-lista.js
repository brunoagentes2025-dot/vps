/* ============================================================
   perfil-lista.js — janela "Seguidores / Seguindo" do perfil (estilo Instagram).
   Usada pelas DUAS telas do perfil: a página /jogador (perfil.php) e a janela por cima do jogo (index.html).
   Abre ao clicar em qualquer elemento com  data-lista="seguidores|seguindo"  e  data-u="nomedojogador".
   Quem usa configura  window.PerfilListaCfg  (tudo opcional; pode ser definido antes ou depois deste arquivo):
     t(chave)            -> texto traduzido (se devolver a própria chave, usa o texto de reserva daqui)
     sb()                -> cliente Supabase com sessão (só se o jogador estiver logado); sem isso, a lista é só leitura
     eu()                -> @ do jogador logado ('' se ninguém)
     url, key            -> Supabase (usados quando não há sb(): leitura anônima por fetch)
     raiz()              -> elemento onde a janela é encaixada (sem isso: <body>, tela cheia)
     flag(el, pais)      -> pinta a bandeira (sem isso usa as classes do flag-icons)
     href(u) / base      -> endereço do perfil de um jogador
     abre(evento, u)     -> abre o perfil por cima do jogo (sem isso, o link navega normalmente)
     confirma(u, fn)     -> pede confirmação antes de remover (sem isso, remove direto)
     onlUrl              -> api/online_users.php: borda verde nos avatares de quem está online (sem isso, sem borda)
   Funções no Supabase: perfil_seguidores / perfil_seguindo (perfil_listas.sql), adicionar_amigo, remover_amigo.
   ============================================================ */
(function(){
'use strict';
if(window.PerfilLista)return;

var PAG=30, S=null;

/* textos de reserva (só entram se a chave não existir no textos.js / TXF do jogo) */
var DEF={
  perfil_pag_seguidores:{pt:'seguidores',en:'followers',es:'seguidores'},
  perfil_pag_seguindo:{pt:'seguindo',en:'following',es:'siguiendo'},
  pl_busca_ph:{pt:'Buscar',en:'Search',es:'Buscar'},
  pl_vazio_seguidores:{pt:'Ainda não tem seguidores.',en:'No followers yet.',es:'Aún no tiene seguidores.'},
  pl_vazio_seguindo:{pt:'Ainda não segue ninguém.',en:'Not following anyone yet.',es:'Aún no sigue a nadie.'},
  pl_nada:{pt:'Nenhum jogador encontrado.',en:'No players found.',es:'No se encontraron jugadores.'},
  pl_erro:{pt:'Não foi possível carregar a lista.',en:'Could not load the list.',es:'No se pudo cargar la lista.'},
  pl_erro_acao:{pt:'Não foi possível concluir. Tente de novo.',en:'Something went wrong. Try again.',es:'No se pudo completar. Inténtalo de nuevo.'},
  pl_limite:{pt:'Você atingiu o limite de amigos.',en:'You reached the friends limit.',es:'Alcanzaste el límite de amigos.'},
  pl_add:{pt:'Adicionar',en:'Add',es:'Agregar'},
  pl_rem:{pt:'Remover',en:'Remove',es:'Quitar'},
  pl_entre:{pt:'Entre no jogo para adicionar jogadores.',en:'Log in to the game to add players.',es:'Inicia sesión en el juego para agregar jugadores.'},
  pl_fechar:{pt:'Fechar',en:'Close',es:'Cerrar'},
  pl_carregando:{pt:'Carregando…',en:'Loading…',es:'Cargando…'}
};

function cfg(){return window.PerfilListaCfg||{}}
function lang(){return String(document.documentElement.lang||'pt').toLowerCase().slice(0,2)}
function T(k){
  var s;try{s=cfg().t?cfg().t(k):k}catch(e){s=k}
  if(s&&s!==k)return s;
  var d=DEF[k];return d?(d[lang()]||d.en||d.pt):k;
}
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e}
function logado(){var C=cfg();return !!(C.sb&&C.sb()&&C.eu&&C.eu())}

/* chamada ao Supabase: com sessão (sb) ou anônima (fetch com a chave pública) */
function rpc(nome,args){
  var C=cfg(),sb=C.sb&&C.sb();
  if(sb)return Promise.resolve(sb.rpc(nome,args));
  if(!C.url||!C.key)return Promise.resolve({error:{message:'sem configuração'}});
  return fetch(C.url+'/rest/v1/rpc/'+nome,{method:'POST',headers:{'apikey':C.key,'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(args)})
    .then(function(r){return r.json().catch(function(){return null}).then(function(d){return r.ok?{data:d}:{error:d||{message:'HTTP '+r.status}}})});
}

/* ---------- estilo (px, não depende do tamanho do jogo; reseta botões/inputs para não herdar regras do index.html) ---------- */
var CSS=[
'.pl-ov{position:absolute;inset:0;z-index:13;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;background:rgba(0,0,0,.66);',
' font-family:"TikTok Sans",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;font-weight:400;font-stretch:100%;letter-spacing:normal;text-transform:none;text-align:left;color:#fff;line-height:1.3;animation:plIn .18s ease}',
'.pl-ov.fixo{position:fixed}',
'@keyframes plIn{from{opacity:0}to{opacity:1}}',
'@media (prefers-reduced-motion:reduce){.pl-ov{animation:none}}',
'.pl-ov *{box-sizing:border-box}',
'.pl-box{width:min(440px,100%);height:min(600px,100%);display:flex;flex-direction:column;background:#141414;border:1px solid rgba(255,255,255,.16);border-radius:16px;box-shadow:0 10px 48px rgba(0,0,0,.6);overflow:hidden}',
'.pl-hd{position:relative;flex:none;padding:14px 52px;text-align:center;font-weight:800;font-size:16px;text-transform:capitalize;border-bottom:1px solid rgba(255,255,255,.12)}',
'.pl-x{all:unset;box-sizing:border-box;position:absolute;right:8px;top:50%;transform:translateY(-50%);width:32px;height:32px;padding:6px;cursor:pointer;opacity:.7;color:#fff}',
'.pl-x:hover,.pl-x:focus-visible{opacity:1}',
'.pl-x svg{width:100%;height:100%;display:block}',
'.pl-bs{flex:none;padding:10px 14px}',
'.pl-q{all:unset;box-sizing:border-box;display:block;width:100%;height:38px;padding:0 14px;border-radius:10px;background:rgba(255,255,255,.09);color:#fff;font-size:14px;-webkit-user-select:text;user-select:text}',
'.pl-q::placeholder{color:rgba(255,255,255,.5)}',
'.pl-q:focus{background:rgba(255,255,255,.14)}',
'.pl-ls{flex:1 1 auto;min-height:0;overflow:auto;padding:4px 8px 8px}',
'.pl-l{display:flex;align-items:center;gap:12px;padding:8px;border-radius:10px}',
'.pl-l:hover{background:rgba(255,255,255,.05)}',
'.pl-av.avOn{box-shadow:0 0 0 2px #00ffb1;border-color:#00ffb1}',
'.pl-av{flex:none;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#3a3a3a,#161616);border:1px solid rgba(255,255,255,.22);font-weight:800;font-size:17px;text-transform:uppercase}',
'.pl-nome{all:unset;box-sizing:border-box;flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;font-size:15px;color:#fff;cursor:pointer}',
'.pl-nome:hover,.pl-nome:focus-visible{text-decoration:underline}',
'.pl-ov .fi{flex:none;display:inline-block;width:1.333em;line-height:1em;font-size:16px;background-size:contain;background-position:50%;background-repeat:no-repeat;border-radius:2px;box-shadow:0 0 0 1px rgba(255,255,255,.28)}',
'.pl-ov .fi:before{content:"\\00a0"}',
'.pl-ov .fi.fiNone{background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 4 3\'%3E%3Crect width=\'4\' height=\'3\' fill=\'%23444\'/%3E%3Ccircle cx=\'2\' cy=\'1.5\' r=\'.95\' fill=\'none\' stroke=\'%23bbb\' stroke-width=\'.16\'/%3E%3Cpath d=\'M1.05 1.5h1.9M2 .55v1.9\' stroke=\'%23bbb\' stroke-width=\'.12\'/%3E%3C/svg%3E")}',
'.pl-btn{all:unset;box-sizing:border-box;flex:none;display:flex;align-items:center;justify-content:center;height:32px;padding:0 16px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;transition:filter .15s,background .15s,opacity .15s}',
'.pl-btn.pri{background:#00ffb1;color:#000}',
'.pl-btn.pri:hover:not(:disabled){filter:brightness(1.1)}',
'.pl-btn.rem{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4)}',
'.pl-btn.rem:hover:not(:disabled){background:rgba(255,255,255,.14);border-color:#fff}',
'.pl-btn:disabled{opacity:.5;cursor:default}',
'.pl-x:focus-visible,.pl-nome:focus-visible,.pl-btn:focus-visible,.pl-q:focus-visible{outline:2px solid #6b9bff;outline-offset:2px}',
'.pl-ms{padding:26px 12px;text-align:center;font-size:14px;opacity:.7}',
'.pl-ms.err{color:#ff9a9a;opacity:1}',
'.pl-nt{flex:none;padding:10px 14px;text-align:center;font-size:12.5px;opacity:.75;border-top:1px solid rgba(255,255,255,.12)}',
'.pl-nt:empty{display:none}',
'.pl-nt.err{color:#ff9a9a;opacity:1}',
'@media (max-width:520px){.pl-ov{padding:0;align-items:flex-end}.pl-box{width:100%;height:min(82%,600px);border-radius:16px 16px 0 0}}'
].join('\n');
var X_SVG='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
function injetaCss(){
  if(document.getElementById('pl-css'))return;
  var s=document.createElement('style');s.id='pl-css';s.textContent=CSS;document.head.appendChild(s);
}

/* ---------- janela ---------- */
function abre(u,tipo,origem){
  u=String(u||'').replace(/^@/,'').toLowerCase();
  if(!/^[a-z0-9_]{1,15}$/.test(u)||(tipo!=='seguidores'&&tipo!=='seguindo'))return;
  if(S)fecha(true);
  injetaCss();
  var C=cfg(),raiz=C.raiz?C.raiz():null;
  S={u:u,tipo:tipo,q:'',depois:null,fim:false,carregando:false,seq:0,n:0,timer:0,foco:origem||document.activeElement,pop:function(){fecha(true)}};

  var ov=el('div','pl-ov'+(raiz?'':' fixo'));ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');
  var box=el('div','pl-box'),hd=el('div','pl-hd',T('perfil_pag_'+tipo));hd.setAttribute('role','heading');hd.setAttribute('aria-level','2');
  ov.setAttribute('aria-label',hd.textContent);
  var x=el('button','pl-x');x.type='button';x.title=T('pl_fechar');x.setAttribute('aria-label',x.title);x.innerHTML=X_SVG;
  x.addEventListener('click',function(){fecha()});
  hd.appendChild(x);

  var bs=el('div','pl-bs'),q=el('input','pl-q');
  q.type='text';q.maxLength=15;q.autocomplete='off';q.setAttribute('autocapitalize','none');q.setAttribute('autocorrect','off');q.spellcheck=false;
  q.placeholder=T('pl_busca_ph');q.setAttribute('aria-label',q.placeholder);
  q.addEventListener('input',function(){
    var v=q.value.toLowerCase().replace(/^@/,'').replace(/[^a-z0-9_]/g,'');
    if(v===S.q)return;
    S.q=v;clearTimeout(S.timer);S.timer=setTimeout(function(){carrega(true)},250);
  });
  bs.appendChild(q);

  var ls=el('div','pl-ls');
  ls.addEventListener('scroll',function(){if(ls.scrollTop+ls.clientHeight>=ls.scrollHeight-80)carrega(false)});
  var nt=el('div','pl-nt');nt.setAttribute('role','status');

  box.appendChild(hd);box.appendChild(bs);box.appendChild(ls);box.appendChild(nt);ov.appendChild(box);
  S.ov=ov;S.lista=ls;S.nota=nt;S.q_el=q;

  ov.addEventListener('click',function(e){if(e.target===ov)fecha()});
  ov.addEventListener('keydown',function(e){
    e.stopPropagation();                                   // o jogo não recebe as teclas (nem o Esc, que fecharia o perfil de baixo)
    if(e.key==='Escape'){e.preventDefault();fecha();return}
    if(e.key==='Tab'){
      var f=ov.querySelectorAll('input,button:not(:disabled),a[href]');if(!f.length)return;
      var a=f[0],z=f[f.length-1];
      if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}
      else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}
    }
  });
  ov.addEventListener('keyup',function(e){e.stopPropagation()});
  window.addEventListener('popstate',S.pop);
  S.tOn=setInterval(onlMarca,10000);                         // borda verde: reconsulta enquanto a janela estiver aberta                // botão voltar do navegador fecha a janela

  (raiz||document.body).appendChild(ov);
  if(!logado())nota(T('pl_entre'));
  if(!(window.matchMedia&&matchMedia('(pointer:coarse)').matches))q.focus();else x.focus();
  carrega(true);
}
function fecha(semFoco){
  if(!S)return;
  var s=S;S=null;
  clearTimeout(s.timer);clearInterval(s.tOn);window.removeEventListener('popstate',s.pop);
  if(s.ov.parentNode)s.ov.parentNode.removeChild(s.ov);
  if(!semFoco&&s.foco&&s.foco.focus&&document.contains(s.foco))try{s.foco.focus()}catch(e){}
}
function nota(msg,erro){if(!S)return;S.nota.textContent=msg||'';S.nota.className='pl-nt'+(erro?' err':'')}

/* ---------- lista (paginada por cursor = último @ recebido; busca feita no servidor) ---------- */
function carrega(reset){
  if(!S)return;
  if(reset){S.seq++;S.depois=null;S.fim=false;S.carregando=false;S.n=0;S.lista.textContent='';S.lista.scrollTop=0}
  if(S.carregando||S.fim)return;
  var eu=S.seq,ld=el('div','pl-ms',T('pl_carregando'));
  S.carregando=true;S.lista.appendChild(ld);
  rpc(S.tipo==='seguidores'?'perfil_seguidores':'perfil_seguindo',{p_username:S.u,p_q:S.q||null,p_depois:S.depois,p_limite:PAG}).then(function(r){
    if(!S||eu!==S.seq)return;                               // fechou, ou a busca mudou enquanto carregava
    ld.remove();S.carregando=false;
    if(r.error)throw r.error;
    var rows=Array.isArray(r.data)?r.data:[];
    rows.forEach(function(x){S.lista.appendChild(linha(x));S.n++});
    if(rows.length<PAG)S.fim=true;else S.depois=rows[rows.length-1].username;
    if(!S.n)S.lista.appendChild(el('div','pl-ms',T(S.q?'pl_nada':'pl_vazio_'+S.tipo)));
    else if(!S.fim&&S.lista.scrollHeight<=S.lista.clientHeight+40)carrega(false);
    onlMarca();   // lista curta demais para rolar: já pega a próxima página
  }).catch(function(){
    if(!S||eu!==S.seq)return;
    ld.remove();S.carregando=false;S.fim=true;
    S.lista.appendChild(el('div','pl-ms err',T('pl_erro')));
  });
}
function linha(x){
  var C=cfg(),u=String(x.username||''),d=el('div','pl-l');
  var av=el('span','pl-av',u.charAt(0));av.setAttribute('data-onl-l',u.toLowerCase());d.appendChild(av);
  var a=el('a','pl-nome','@'+u);a.href=C.href?C.href(u):((C.base||'')+encodeURIComponent(u));
  a.addEventListener('click',function(e){
    if(e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;   // Ctrl/Cmd/botão do meio: nova aba normal
    if(C.abre){fecha(true);C.abre(e,u)}                    // no jogo: troca o perfil por cima, sem recarregar
  });
  d.appendChild(a);
  var f=el('span','fi');
  if(C.flag)C.flag(f,x.pais);else f.className='fi '+(/^[A-Z]{2}$/.test(x.pais||'')?'fi-'+x.pais.toLowerCase():'fiNone');
  d.appendChild(f);
  if(logado()&&!x.sou_eu)d.appendChild(botao(x));
  return d;
}

/* ---------- borda verde: quem da lista está online (consulta api/online_users.php, em blocos de 100) ---------- */
function onlMarca(){
  var C=cfg();if(!S||!C.onlUrl||document.hidden)return;
  var s=S,els=s.lista.querySelectorAll('.pl-av[data-onl-l]'),nomes=[],vistos={};
  Array.prototype.forEach.call(els,function(e){var n=e.getAttribute('data-onl-l');if(!vistos[n]){vistos[n]=1;nomes.push(n)}});
  if(!nomes.length)return;
  var partes=[];for(var i=0;i<nomes.length&&i<300;i+=100)partes.push(nomes.slice(i,i+100));
  Promise.all(partes.map(function(p){return fetch(C.onlUrl+'?u='+p.join(','),{cache:'no-store'}).then(function(r){return r.ok?r.json():{on:[]}})})).then(function(rs){
    if(S!==s)return;
    var on={};rs.forEach(function(d){(d&&d.on||[]).forEach(function(n){on[String(n).toLowerCase()]=1})});
    Array.prototype.forEach.call(s.lista.querySelectorAll('.pl-av[data-onl-l]'),function(e){e.classList.toggle('avOn',!!on[e.getAttribute('data-onl-l')])});
  }).catch(function(){});
}

/* ---------- adicionar / remover ---------- */
function botao(x){
  var b=el('button','pl-btn');b.type='button';
  function pinta(){b.className='pl-btn '+(x.ja_amigo?'rem':'pri');b.textContent=T(x.ja_amigo?'pl_rem':'pl_add')}
  pinta();
  b.addEventListener('click',function(){
    if(b.disabled)return;
    if(x.ja_amigo){var C=cfg();if(C.confirma)C.confirma(x.username,function(){troca(b,x,false,pinta)});else troca(b,x,false,pinta)}
    else troca(b,x,true,pinta);
  });
  return b;
}
function troca(b,x,add,pinta){
  var dono=S&&S.u;
  b.disabled=true;nota('');
  rpc(add?'adicionar_amigo':'remover_amigo',{p_username:x.username}).then(function(r){
    if(r.error)throw r.error;
    var st=r.data;
    if(add&&st!=='ok'&&st!=='ja_amigo'){b.disabled=false;nota(T(st==='limite'?'pl_limite':'pl_erro_acao'),true);return}
    x.ja_amigo=add;
    if(add?st==='ok':true)conta(dono,add?1:-1);
    b.disabled=false;pinta();
  }).catch(function(){b.disabled=false;nota(T('pl_erro_acao'),true)});
}
function conta(dono,d){                                     // só muda o número do cabeçalho quando é o perfil do próprio jogador (o "seguindo" dele)
  var C=cfg(),eu=C.eu?C.eu():'';
  if(!eu||dono!==eu)return;
  var b=document.querySelector('.pf-stat[data-lista="seguindo"] b');
  if(b)b.textContent=Math.max(0,(parseInt(b.textContent,10)||0)+d);
}

/* clique em "seguidores" / "seguindo" (funciona também no miolo injetado pelo jogo) */
document.addEventListener('click',function(e){
  var b=e.target&&e.target.closest?e.target.closest('[data-lista]'):null;
  if(!b||(S&&S.ov.contains(b)))return;
  e.preventDefault();abre(b.getAttribute('data-u'),b.getAttribute('data-lista'),b);
});

window.PerfilLista={abre:abre,fecha:fecha};
})();