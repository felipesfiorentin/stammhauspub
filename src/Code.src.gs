/**
 * Das Stammhaus Pub — projeto de GESTÃO (painel interno com login). Arquivos: Code.gs (único) + Painel.html
 * Web app (Apps Script) vinculado à planilha. A página de convidados foi desativada em 25/11/2026 (só reservas).
 */
function ss_() {
  var x = SpreadsheetApp.getActiveSpreadsheet();
  if (!x) throw new Error('DADOS: planilha não vinculada ao script (crie o script por Extensões > Apps Script dentro da planilha)');
  return x;
}

/* Painel de gestão (login por usuário e senha). Qualquer endereço do app abre o painel. */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Painel').setTitle('Painel · Das Stammhaus Pub')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---------- DIAGNÓSTICO (menu "Stammhaus" na planilha) ---------- */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Stammhaus').addItem('Diagnóstico do sistema', 'diagnostico')
    .addItem('Atualizar painel de lotação', 'atualizarPainelMenu')
    .addItem('Preparar reservas e métricas (1ª vez)', 'prepararReservas').addToUi();
}

function diagnostico() {
  var L = [], ok = function (c, m) { L.push((c ? '✔ ' : '✘ ') + m); return c; };
  function t(nome, fn) { try { return fn(); } catch (e) { ok(false, nome + ' → ' + classificar_(e.message) + ' · ' + String(e.message).slice(0, 120)); return null; } }
  var ssd = ss_();
  L.push('Planilha ligada ao script: ' + ssd.getName(), 'ID: ' + ssd.getId(), 'Link: ' + ssd.getUrl(), '');
  [ABA.PROG, ABA.CFG, ABA.RES].forEach(function (n) { ok(!!ss_().getSheetByName(n), 'Aba "' + n + '" existe'); });
  t('Ler Programacao', function () { var p = prog_(), n = Object.keys(p).length; ok(n > 0, 'Programação: ' + n + ' dias'); });
  t('Ler Config', function () { var c = cfg_(); ok(c.capacidade > 0, 'Capacidade por noite: ' + c.capacidade); });
  t('Ler Reservas', function () { ok(true, 'Linhas de reservas: ' + reservas_().length); });
  ok(typeof ''.normalize === 'function', 'Runtime V8 ativo (String.normalize)');
  t('Cache', function () { CacheService.getScriptCache().put('diag', '1', 30); ok(CacheService.getScriptCache().get('diag') === '1', 'Cache funcionando'); });
  t('Lock', function () { var l = LockService.getScriptLock(); ok(l.tryLock(3000), 'Lock funcionando'); l.releaseLock(); });
  t('Página', function () { HtmlService.createHtmlOutputFromFile('Painel'); ok(true, 'Arquivo Painel (HTML) encontrado'); });
  var sh = ss_().getSheetByName('Erros');
  if (sh && sh.getLastRow() > 1) {
    var n = sh.getLastRow(), de = Math.max(2, n - 4), v = sh.getRange(de, 1, n - de + 1, 5).getValues();
    L.push('', 'Últimos erros registrados (aba Erros):');
    v.forEach(function (r) { L.push('• ' + r[1] + ' · ' + r[2] + ' · ' + r[3] + ' · ' + String(r[4]).slice(0, 90)); });
  } else { L.push('', 'Aba Erros: nenhum erro registrado ainda.'); }
  L.push('', 'Lembrete: depois de alterar o código, faça Implantar → Gerenciar implantações → Editar → Nova versão.');
  SpreadsheetApp.getUi().alert('Diagnóstico do sistema', L.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}
