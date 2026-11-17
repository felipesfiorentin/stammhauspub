/**
 * Das Stammhaus Pub — Confirmação de presença dos CONVIDADOS (semana de inauguração) + painel.
 * Web app (Apps Script) vinculado à planilha. Arquivos: Code.gs (único) + Index.html + Painel.html
 */
function ss_() {
  var x = SpreadsheetApp.getActiveSpreadsheet();
  if (!x) throw new Error('DADOS: planilha não vinculada ao script (crie o script por Extensões > Apps Script dentro da planilha)');
  return x;
}

/* Página dos convidados (padrão) ou painel de métricas + gestão (?p=painel; exige login por usuário e senha). */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.p === 'painel' || p.p === 'gestao' || p.p === 'metricas') {   // página única (login por usuário e senha); gestao/metricas = links antigos
    return HtmlService.createHtmlOutputFromFile('Painel').setTitle('Painel · Das Stammhaus Pub')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Das Stammhaus Pub · Confirmação de presença')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function convidados_() {
  var sh = aba_(ABA.CONV), n = sh.getLastRow();
  if (n < 2) throw new Error('LISTA_VAZIA: a aba Convidados não tem linhas');
  return sh.getRange(2, 1, n - 1, 7).getValues().filter(function (r) { return r[0]; }).map(function (r) {
    return {id: String(r[0]), nome: String(r[1]).trim(), dia: Number(r[2]), estilo: String(r[3]), grupo: String(r[4]),
            acomp: Number(r[5]) === 1 ? 1 : 0, busca: String(r[6] || '')};
  });
}

function pub_(c, prog) {
  var p = prog[c.dia] || {};
  return {id: c.id, nome: c.nome, dia: c.dia, diaLabel: p.label || '', atracao: p.atracao || '', acomp: c.acomp};
}

/* ---------- validação ---------- */
function validar_(p, g) {
  var tn = limpaNome_(p.titNome), tt = String(p.titTel || '').trim();
  if (!NOME_RE.test(tn) || tn.split(' ').length < 2) return {campo: 'titNome', msg: 'Informe seu nome completo (nome e sobrenome).'};
  if (!nomeTitularValido_(tn, g.nome)) return {campo: 'titNome', msg: 'O nome do convite não pode ser trocado. Você pode completá-lo com seus outros sobrenomes, mas as palavras do nome original precisam permanecer.'};
  if (!TEL_RE.test(tt)) return {campo: 'titTel', msg: 'Informe seu celular no formato (42) 99999-9999.'};
  var out = {titNome: tn, titTel: tt, acNome: '', acTel: ''};
  if (p.vaiAcomp) {
    if (!g.acomp) return {campo: 'acNome', msg: 'Este convite não inclui acompanhante.'};
    var an = limpaNome_(p.acNome), at = String(p.acTel || '').trim();
    if (!NOME_RE.test(an) || an.split(' ').length < 2) return {campo: 'acNome', msg: 'Informe o nome completo do seu acompanhante.'};
    if (!TEL_RE.test(at)) return {campo: 'acTel', msg: 'Informe o celular do acompanhante no formato (42) 99999-9999.'};
    if (digitos_(at) === digitos_(tt)) return {campo: 'acTel', msg: 'Cada pessoa precisa de um número próprio. Use outro telefone para o acompanhante.'};
    out.acNome = an; out.acTel = at;
  }
  return {dados: out};
}

function telEmUso_(tels, confs, ignorarLinha) {
  var usados = {};
  confs.forEach(function (c) {
    if (c.status !== 'Confirmado' || c.linha === ignorarLinha) return;
    usados[digitos_(c.titTel)] = 1; if (c.acTel) usados[digitos_(c.acTel)] = 1;
  });
  return tels.filter(Boolean).some(function (t) { return usados[digitos_(t)]; });
}

function simId_(x, y) {
  if (x === y) return 1;
  // só a vogal final muda (Juliano/Juliana, Luciano/Luciana): são pessoas diferentes
  if (x.length >= 4 && x.length === y.length && x.slice(0, -1) === y.slice(0, -1) && /[aoe]$/.test(x) && /[aoe]$/.test(y)) return 0.5;
  if (buscaFonetica_(x) === buscaFonetica_(y)) return 0.95;
  return 1 - buscaDist_(x, y) / Math.max(x.length, y.length);
}
// MESMA PESSOA (critério estrito): mesma quantidade de palavras e cada palavra igual, com/sem acento ou de grafia
// foneticamente idêntica (Henckels/Henkels). Uma letra diferente NÃO basta: Helon e Heron são pessoas distintas.
function nomesIguais_(a, b) {
  var ta = buscaNormalizar_(a), tb = buscaNormalizar_(b);
  if (ta.length < 2 || ta.length !== tb.length) return false;
  var usados = {}, i, j;
  for (i = 0; i < ta.length; i++) {
    var melhor = 0, k = -1;
    for (j = 0; j < tb.length; j++) {
      if (usados[j]) continue;
      var s = simId_(ta[i], tb[j]);
      if (s > melhor) { melhor = s; k = j; }
    }
    if (k < 0 || melhor < 0.95) return false;
    usados[k] = 1;
  }
  return true;
}

var TITULOS_ = {dr: 1, dra: 1, sr: 1, sra: 1, prefeito: 1, prefeita: 1};

function tokensConvite_(nome) {
  return buscaNormalizar_(String(nome).replace(/\s*\(.*?\)/g, '')).filter(function (w) { return !TITULOS_[w]; });
}

/**
 * NOME TRAVADO: o nome digitado precisa conter TODAS as palavras do nome do convite
 * (tolera acento, 1 letra trocada e grafia parecida) e pode ter até 2 palavras a mais (outros sobrenomes).
 * Não é possível trocar o nome por outra pessoa nem remover palavras do nome original.
 */
function nomeTitularValido_(digitado, nomeLista) { return pontuaTitular_(digitado, nomeLista) > 0; }

/** 0 se o nome digitado não vale para o nome do convite; senão a média de semelhança (1 = idêntico). */
function pontuaTitular_(digitado, nomeLista) {
  var tl = tokensConvite_(nomeLista), td = tokensConvite_(digitado);
  if (!tl.length || td.length < tl.length || td.length > tl.length + 2) return 0;
  var usados = {}, soma = 0, i, j;
  for (i = 0; i < tl.length; i++) {
    var melhor = 0, k = -1;
    for (j = 0; j < td.length; j++) {
      if (usados[j]) continue;
      var sc = simId_(tl[i], td[j]);
      if (sc > melhor) { melhor = sc; k = j; }
    }
    if (k < 0 || melhor < 0.80) return 0;
    usados[k] = 1; soma += melhor;
  }
  return soma / tl.length >= 0.90 ? soma / tl.length : 0;
}

function nomesEmUso_(confs, ignorarLinha) {
  var v = [];
  confs.forEach(function (c) {
    if (c.status !== 'Confirmado' || c.linha === ignorarLinha) return;
    v.push(c.titNome); if (c.acNome) v.push(c.acNome);
  });
  return v;
}

/** Regras de unicidade. Retorna {code,msg} ou null. */
function regrasUnicidade_(g, d, confs, todos, ignorarLinha) {
  var usados = nomesEmUso_(confs, ignorarLinha), i;
  var dup = function (n) { return usados.some(function (u) { return nomesIguais_(n, u); }); };
  if (dup(d.titNome)) return {code: 'nome_duplicado', msg: 'Já existe uma confirmação com este nome. Cada pessoa é confirmada uma única vez.'};
  // titular digitou o nome de OUTRO convidado (igual, ou um nome mais completo que contém o de outro convite)
  // quem entrou pelo próprio convite e digitou o próprio nome (ex.: Helon, com um Heron também convidado) nunca é barrado aqui
  var nTok = tokensConvite_(g.nome).length, propria = pontuaTitular_(d.titNome, g.nome), exatoProprio = nomesIguais_(d.titNome, g.nome);
  for (i = 0; i < todos.length && !exatoProprio; i++) {
    var o = todos[i];
    if (o.id === g.id) continue;
    var po = pontuaTitular_(d.titNome, o.nome);
    if (po < propria || (po === propria && !(tokensConvite_(o.nome).length > nTok))) continue;   // só barra se o nome digitado combina melhor com o de outro convite
    if (nomesIguais_(d.titNome, o.nome) || (tokensConvite_(o.nome).length > nTok && nomeTitularValido_(d.titNome, o.nome))) {
      return {code: 'titular_outro_convidado', msg: 'O nome digitado pertence a outro convite. Para confirmar essa pessoa, volte, busque o nome dela e use o convite dela.'};
    }
  }
  if (d.acNome) {
    if (nomesIguais_(d.acNome, d.titNome)) return {code: 'acomp_igual_titular', msg: 'O acompanhante precisa ser outra pessoa, diferente do convidado.'};
    if (dup(d.acNome)) return {code: 'nome_duplicado', msg: 'O acompanhante informado já consta em outra confirmação. Cada pessoa é confirmada uma única vez.'};
    for (i = 0; i < todos.length; i++) {
      if (nomesIguais_(d.acNome, todos[i].nome)) {
        return {code: 'acomp_e_convidado', msg: 'Este nome pertence a uma pessoa que recebeu convite próprio, e ela confirma a presença pelo próprio convite. Para levar um acompanhante, informe alguém que não tenha convite.'};
      }
    }
  }
  return null;
}

function resumo_(g, d, prog) {
  var p = prog[g.dia] || {};
  return {nome: g.nome, diaLabel: p.label || '', atracao: p.atracao || '', horario: cfg_().horario,
          titNome: d.titNome, titTel: d.titTel, acNome: d.acNome, acTel: d.acTel, pessoas: d.acNome ? 2 : 1};
}

/* ---------- API chamada pela página (cada função pública é protegida por api_) ---------- */
function config_() {
  var c = cfg_();
  return {whatsapp: c.whatsapp, horario: c.horario};
}

function buscar_(q, cliente) {
  if (!limite_('g', 600, 60) || !limite_('c' + cli_(cliente), 25, 600)) return {status: 'limite'};
  var prog = prog_(), r = buscarNome(String(q || '').slice(0, 80), convidados_());
  return {status: r.status, candidatos: r.candidatos.map(function (c) { return pub_(c, prog); })};
}

function estado_(id) {
  var g = convidados_().filter(function (c) { return c.id === id; })[0];
  if (!g) return {ok: false};
  var cs = confs_(), ja = cs.some(function (c) { return c.id === id && c.status === 'Confirmado'; });
  var nao = !ja && cs.some(function (c) { return c.id === id && c.status === STATUS_NAO; });
  return {ok: true, convidado: pub_(g, prog_()), jaConfirmado: ja, jaNaoVai: nao};
}

function confirmar_(p) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var g = convidados_().filter(function (c) { return c.id === String(p.id); })[0];
    if (!g) return {ok: false, code: 'nao_encontrado'};
    var confs = confs_();
    if (confs.some(function (c) { return c.id === g.id && c.status === 'Confirmado'; })) return {ok: false, code: 'ja_confirmado'};
    var antes = confs.filter(function (c) { return c.id === g.id && c.status === STATUS_NAO; })[0];
    if (antes) {
      if (!limite_('v' + cli_(g.id), 12, 900)) return {ok: false, code: 'limite'};
      if (digitos_(antes.titTel) !== digitos_(p.telAtual)) return {ok: false, code: 'tel_incorreto'};
    }
    var v = validar_(p, g); if (!v.dados) return {ok: false, code: 'invalido', campo: v.campo, msg: v.msg};
    var d = v.dados;
    if (telEmUso_([d.titTel, d.acTel], confs, 0)) return {ok: false, code: 'tel_duplicado',
      msg: 'Este telefone já está em outra confirmação. Confira o número ou fale com a nossa equipe.'};
    var todos = convidados_(), un = regrasUnicidade_(g, d, confs, todos, 0);
    if (un) return {ok: false, code: un.code, msg: un.msg};
    var pessoas = d.acNome ? 2 : 1;
    if (pessoas > 1 + g.acomp) return {ok: false, code: 'invalido', campo: 'acNome', msg: 'Este convite permite no máximo ' + g.acomp + ' acompanhante(s).'};
    var cfgv = cfg_(), delta = pessoas - contribConv_(g, confs, cfgv);   // a lista já conta o convidado; só barra se a resposta AUMENTA o total
    if (delta > 0 && contagem_(g.dia, cfgv, todos, confs, reservas_()).total + delta > cfgv.teto) return {ok: false, code: 'lotado'};
    var agora = new Date(), sh = aba_(ABA.CONF), linha = proximaLinha_(sh);
    if (linha > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
    sh.getRange(linha, 1, 1, 13).setValues([[agora, g.id, g.nome, g.dia, d.titNome, d.titTel, d.acNome, d.acTel,
      pessoas, 'Confirmado', 'Sim (aceite ao confirmar)', '', agora]]);
    SpreadsheetApp.flush();
    if (String(sh.getRange(linha, 2).getValue()) !== g.id) throw new Error('ESCRITA_FALHOU: linha ' + linha + ' não confirmada');
    if (antes) sh.getRange(antes.linha, 10).setValue('Substituído');
    atualizarPainelSeguro_();
    enfileirarWhats_('C', g.id, g.dia, [{nome: d.titNome, tel: d.titTel}].concat(d.acNome ? [{nome: d.acNome, tel: d.acTel || d.titTel}] : []));
    var res = resumo_(g, d, prog_()); res.protocolo = 'C' + linha;
    return {ok: true, resumo: res};
  } finally { lock.releaseLock(); }
}

/* Registra que o convidado NÃO poderá comparecer (nome vem da lista; pede só o celular, para ele poder mudar de ideia depois). */
function recusar_(p) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var g = convidados_().filter(function (c) { return c.id === String(p.id); })[0];
    if (!g) return {ok: false, code: 'nao_encontrado'};
    var confs = confs_();
    if (confs.some(function (c) { return c.id === g.id && c.status === 'Confirmado'; })) return {ok: false, code: 'ja_confirmado'};
    if (confs.some(function (c) { return c.id === g.id && c.status === STATUS_NAO; })) return {ok: false, code: 'ja_nao_vai'};
    var tel = String(p.titTel || '').trim();
    if (!TEL_RE.test(tel)) return {ok: false, code: 'invalido', campo: 'titTel', msg: 'Informe seu celular com DDD no formato (42) 99999-9999.'};
    var agora = new Date(), sh = aba_(ABA.CONF), linha = proximaLinha_(sh);
    if (linha > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
    sh.getRange(linha, 1, 1, 13).setValues([[agora, g.id, g.nome, g.dia, g.nome, tel, '', '', 0, STATUS_NAO, 'Sim (aceite ao registrar)', '', agora]]);
    SpreadsheetApp.flush();
    if (String(sh.getRange(linha, 2).getValue()) !== g.id) throw new Error('ESCRITA_FALHOU: linha ' + linha + ' não confirmada');
    atualizarPainelSeguro_();
    var res = resumo_(g, {titNome: g.nome, titTel: tel, acNome: '', acTel: ''}, prog_()); res.pessoas = 0; res.protocolo = 'C' + linha;
    return {ok: true, resumo: res};
  } finally { lock.releaseLock(); }
}

function linhaVerificada_(id, tel, confs, status) {
  var c = confs.filter(function (x) { return x.id === String(id) && x.status === (status || 'Confirmado'); })[0];
  return c && digitos_(c.titTel) === digitos_(tel) ? c : null;
}

function abrir_(id, tel) {
  if (!limite_('v' + cli_(id), 6, 900)) return {ok: false, code: 'limite'};
  var cs = confs_(), c = linhaVerificada_(id, tel, cs);
  if (!c) {
    var n = linhaVerificada_(id, tel, cs, STATUS_NAO);
    if (!n) return {ok: false, code: 'tel_incorreto'};
    return {ok: true, status: STATUS_NAO, convidado: pub_(convidados_().filter(function (x) { return x.id === n.id; })[0], prog_())};
  }
  var g = convidados_().filter(function (x) { return x.id === c.id; })[0];
  return {ok: true, status: 'Confirmado', convidado: pub_(g, prog_()),
          dados: {titNome: c.titNome, titTel: c.titTel, acNome: c.acNome, acTel: c.acTel}};
}

function atualizar_(p) {
  if (!limite_('v' + cli_(p.id), 12, 900)) return {ok: false, code: 'limite'};
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var confs = confs_(), c = linhaVerificada_(p.id, p.telAtual, confs);
    if (!c) return {ok: false, code: 'tel_incorreto'};
    var g = convidados_().filter(function (x) { return x.id === c.id; })[0];
    var v = validar_(p, g); if (!v.dados) return {ok: false, code: 'invalido', campo: v.campo, msg: v.msg};
    var d = v.dados;
    if (telEmUso_([d.titTel, d.acTel], confs, c.linha)) return {ok: false, code: 'tel_duplicado',
      msg: 'Este telefone já está em outra confirmação. Confira o número ou fale com a nossa equipe.'};
    var todos = convidados_(), un = regrasUnicidade_(g, d, confs, todos, c.linha);
    if (un) return {ok: false, code: un.code, msg: un.msg};
    var pessoas = d.acNome ? 2 : 1;
    if (pessoas > 1 + g.acomp) return {ok: false, code: 'invalido', campo: 'acNome', msg: 'Este convite permite no máximo ' + g.acomp + ' acompanhante(s).'};
    var cfgv = cfg_(), delta = pessoas - contribConv_(g, confs, cfgv);
    if (delta > 0 && contagem_(g.dia, cfgv, todos, confs, reservas_()).total + delta > cfgv.teto) return {ok: false, code: 'lotado'};
    aba_(ABA.CONF).getRange(c.linha, 5, 1, 5).setValues([[d.titNome, d.titTel, d.acNome, d.acTel, pessoas]]);
    aba_(ABA.CONF).getRange(c.linha, 13).setValue(new Date());
    atualizarPainelSeguro_();
    enfileirarWhats_('C', g.id, g.dia, [{nome: d.titNome, tel: d.titTel}].concat(d.acNome ? [{nome: d.acNome, tel: d.acTel || d.titTel}] : []));
    var res = resumo_(g, d, prog_()); res.protocolo = 'C' + c.linha;
    return {ok: true, resumo: res};
  } finally { lock.releaseLock(); }
}

function cancelar_(id, tel) {
  if (!limite_('v' + cli_(id), 12, 900)) return {ok: false, code: 'limite'};
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var c = linhaVerificada_(id, tel, confs_());
    if (!c) return {ok: false, code: 'tel_incorreto'};
    var sh = aba_(ABA.CONF);
    sh.getRange(c.linha, 10).setValue('Cancelado'); sh.getRange(c.linha, 13).setValue(new Date());
    cancelarFilaWhats_('C', c.id, null);
    atualizarPainelSeguro_();
    return {ok: true};
  } finally { lock.releaseLock(); }
}

function config()           { return api_('config',    config_,    arguments); }
function buscar(q, cli)     { return api_('buscar',    buscar_,    arguments); }
function estado(id)         { return api_('estado',    estado_,    arguments); }
function confirmar(p)       { return api_('confirmar', confirmar_, arguments); }
function abrir(id, tel)     { return api_('abrir',     abrir_,     arguments); }
function recusar(p)         { return api_('recusar',   recusar_,   arguments); }
function atualizar(p)       { return api_('atualizar', atualizar_, arguments); }
function cancelar(id, tel)  { return api_('cancelar',  cancelar_,  arguments); }

/* ---------- DIAGNÓSTICO (menu "Stammhaus" na planilha) ---------- */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Stammhaus').addItem('Diagnóstico do sistema', 'diagnostico')
    .addItem('Sincronizar lista de convidados (telefones)', 'sincronizarListaMenu')
    .addItem('Atualizar painel de lotação', 'atualizarPainelMenu')
    .addItem('Preparar reservas e métricas (1ª vez)', 'prepararReservas').addToUi();
}

function diagnostico() {
  var L = [], ok = function (c, m) { L.push((c ? '✔ ' : '✘ ') + m); return c; };
  function t(nome, fn) { try { return fn(); } catch (e) { ok(false, nome + ' → ' + classificar_(e.message) + ' · ' + String(e.message).slice(0, 120)); return null; } }
  var ssd = ss_();
  L.push('Planilha ligada ao script: ' + ssd.getName(), 'ID: ' + ssd.getId(), 'Link: ' + ssd.getUrl(), '');
  [ABA.CONV, ABA.CONF, ABA.PROG, ABA.CFG].forEach(function (n) { ok(!!ss_().getSheetByName(n), 'Aba "' + n + '" existe'); });
  var conv = t('Ler Convidados', function () { var c = convidados_(); ok(c.length > 0, 'Convidados lidos: ' + c.length); return c; });
  t('Ler Programacao', function () { var p = prog_(), n = Object.keys(p).length; ok(n === 4, 'Programação: ' + n + ' dias (esperado 4)'); Object.keys(p).forEach(function (k) { ok(/\d\d\/\d\d/.test(p[k].label), 'Dia ' + k + ' com data válida: ' + p[k].label); }); });
  t('Ler Config', function () { var c = cfg_(); ok(c.capacidade > 0, 'Capacidade por noite: ' + c.capacidade); });
  t('Ler Confirmacoes', function () { ok(true, 'Confirmações lidas: ' + confs_().length); });
  ok(typeof buscarNome === 'function', 'Código completo (função buscarNome carregada)');
  ok(typeof ''.normalize === 'function', 'Runtime V8 ativo (String.normalize)');
  if (conv && typeof buscarNome === 'function' && typeof ''.normalize === 'function') {
    t('Busca de teste', function () { var r = buscarNome(conv[0].nome, conv); ok(r.status === 'achei' || r.status === 'sugestoes', 'Busca de teste com "' + conv[0].nome + '": ' + r.status); });
  }
  t('Cache', function () { CacheService.getScriptCache().put('diag', '1', 30); ok(CacheService.getScriptCache().get('diag') === '1', 'Cache funcionando'); });
  t('Lock', function () { var l = LockService.getScriptLock(); ok(l.tryLock(3000), 'Lock funcionando'); l.releaseLock(); });
  t('Página', function () { HtmlService.createHtmlOutputFromFile('Index'); ok(true, 'Arquivo Index (HTML) encontrado'); });
  var sh = ss_().getSheetByName('Erros');
  if (sh && sh.getLastRow() > 1) {
    var n = sh.getLastRow(), de = Math.max(2, n - 4), v = sh.getRange(de, 1, n - de + 1, 5).getValues();
    L.push('', 'Últimos erros registrados (aba Erros):');
    v.forEach(function (r) { L.push('• ' + r[1] + ' · ' + r[2] + ' · ' + r[3] + ' · ' + String(r[4]).slice(0, 90)); });
  } else { L.push('', 'Aba Erros: nenhum erro registrado ainda.'); }
  L.push('', 'Lembrete: depois de alterar o código, faça Implantar → Gerenciar implantações → Editar → Nova versão.');
  SpreadsheetApp.getUi().alert('Diagnóstico do sistema', L.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}
