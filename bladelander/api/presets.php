<?php
header('Content-Type: application/json; charset=utf-8');
$f = __DIR__.'/presets.json';
$all = file_exists($f) ? json_decode(file_get_contents($f), true) : [];
if (!is_array($all)) $all = [];
$in   = json_decode(file_get_contents('php://input'), true) ?: [];
$acao = $in['acao'] ?? 'listar';
$nome = mb_substr(trim(strip_tags($in['nome'] ?? '')), 0, 60);

if ($acao === 'salvar' && $nome !== '' && is_array($in['config'] ?? null)) {
  $c = [];
  foreach ($in['config'] as $k => $v) if (is_bool($v) || is_numeric($v)) $c[$k] = $v;
  $all[$nome] = $c;
} elseif ($acao === 'apagar' && isset($all[$nome])) {
  unset($all[$nome]);
}
if ($acao === 'salvar' || $acao === 'apagar')
  file_put_contents($f, json_encode($all, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE), LOCK_EX);

echo json_encode((object)$all, JSON_UNESCAPED_UNICODE);