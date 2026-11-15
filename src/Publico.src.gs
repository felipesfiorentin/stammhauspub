/**
 * Das Stammhaus Pub — RESERVAS DO PÚBLICO GERAL (semana de inauguração).
 * Projeto SEPARADO do dos convidados: não tem busca nem lista de nomes de convidados; só lê números de lotação.
 * Arquivos: Code.gs (único) + Index.html. Liga-se à mesma planilha pelo ID (constante SHEET_ID abaixo).
 */
var SHEET_ID = '__SHEET_ID__';

function ss_() {
  if (!SHEET_ID || SHEET_ID.indexOf('__') === 0) throw new Error('DADOS: SHEET_ID não configurado no Code.gs');
  return SpreadsheetApp.openById(SHEET_ID);
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Das Stammhaus Pub · Reservas')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function normNome_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function pubInfo_(cfg) {
  return {valor: cfg.valor, ate: cfg.reservaAte, max: cfg.maxPessoas, whatsapp: cfg.whatsapp};
}

/* Noites, com situação (Disponível/Lotado). Não expõe contagens: só "vagas" até o máximo por reserva. */
function dados_() {
  var cfg = cfg_(), prog = prog_(), conv = convLeve_(), confs = confs_(), resv = reservas_();
  var noites = Object.keys(prog).map(Number).sort().map(function (d) {
    var c = contagem_(d, cfg, conv, confs, resv), p = prog[d];
    return {dia: d, label: p.label, atracao: p.atracao, lotado: c.lotado, vagas: Math.min(c.restantes, cfg.maxPessoas)};
  });
  return {ok: true, noites: noites, info: pubInfo_(cfg)};
}

function validarReserva_(p, cfg, prog) {
  var dia = Number(p.dia);
  if (!prog[dia]) return {campo: 'geral', msg: 'Noite inválida. Escolha uma das noites da programação.'};
  var ps = Array.isArray(p.pessoas) ? p.pessoas : [];
  if (ps.length < 1 || ps.length > cfg.maxPessoas) return {campo: 'qtd', msg: 'Cada reserva é de 1 a ' + cfg.maxPessoas + ' pessoas.'};
  var out = [], tels = {}, nomes = {};
  for (var i = 0; i < ps.length; i++) {
    var n = limpaNome_(ps[i] && ps[i].nome), t = String(ps[i] && ps[i].tel || '').trim(), q = i === 0 ? 'Você' : 'Pessoa ' + (i + 1);
    if (!NOME_RE.test(n) || n.split(' ').length < 2) return {campo: 'nome' + i, msg: (i === 0 ? 'Informe o seu nome completo (nome e sobrenome).' : 'Informe o nome completo da pessoa ' + (i + 1) + ' (nome e sobrenome).')};
    if (!TEL_RE.test(t)) return {campo: 'tel' + i, msg: (i === 0 ? 'Informe o seu celular' : 'Informe o celular da pessoa ' + (i + 1)) + ' no formato (42) 99999-9999.'};
    var d = digitos_(t), nn = normNome_(n);
    if (tels[d]) return {campo: 'tel' + i, msg: 'Cada pessoa precisa de um número de celular próprio.'};
    if (nomes[nn]) return {campo: 'nome' + i, msg: 'Este nome aparece duas vezes na reserva.'};
    tels[d] = 1; nomes[nn] = 1; out.push({nome: n, tel: t});
  }
  return {dia: dia, pessoas: out};
}

function resumoRes_(prot, dia, prog, pessoas, cfg) {
  var p = prog[dia] || {};
  return {protocolo: prot, dia: dia, diaLabel: p.label || '', atracao: p.atracao || '', pessoas: pessoas, valor: cfg.valor, ate: cfg.reservaAte};
}

function reservar_(p) {
  if (String(p && p.site || '') !== '') return {ok: false, code: 'invalido', campo: 'geral', msg: 'Não foi possível concluir.'};   // campo-isca (robôs)
  if (!limite_('rg', 400, 60) || !limite_('rc' + cli_(p && p.cli), 6, 900)) return {ok: false, code: 'limite'};
  var cfg = cfg_(), prog = prog_(), v = validarReserva_(p || {}, cfg, prog);
  if (!v.pessoas) return {ok: false, code: 'invalido', campo: v.campo, msg: v.msg};
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var conv = convLeve_(), confs = confs_(), resv = reservas_(), cnt = contagem_(v.dia, cfg, conv, confs, resv), n = v.pessoas.length;
    if (cnt.restantes <= 0) return {ok: false, code: 'lotado'};
    if (n > cnt.restantes) return {ok: false, code: 'sem_vagas', restantes: cnt.restantes};
    // já consta na noite? (reserva do público ou confirmação de convidado, por celular ou nome)
    var usadosTel = {}, usadosNome = {};
    resv.forEach(function (r) { if (r.dia === v.dia && r.status === 'Confirmado') { usadosTel[digitos_(r.tel)] = 1; usadosNome[normNome_(r.nome)] = 1; } });
    confs.forEach(function (c) {
      if (c.dia !== v.dia || c.status !== 'Confirmado') return;
      usadosTel[digitos_(c.titTel)] = 1; if (c.acTel) usadosTel[digitos_(c.acTel)] = 1;
      usadosNome[normNome_(c.titNome)] = 1; if (c.acNome) usadosNome[normNome_(c.acNome)] = 1;
    });
    for (var i = 0; i < n; i++) {
      if (usadosTel[digitos_(v.pessoas[i].tel)]) return {ok: false, code: 'ja_consta', campo: 'tel' + i, msg: 'Este celular já consta em uma reserva ou confirmação para esta noite. Se for seu, fale com a nossa equipe.'};
      if (usadosNome[normNome_(v.pessoas[i].nome)]) return {ok: false, code: 'ja_consta', campo: 'nome' + i, msg: 'Este nome já consta em uma reserva ou confirmação para esta noite. Se for você, fale com a nossa equipe.'};
    }
    var sh = aba_(ABA.RES), linha = proximaLinha_(sh), prot = 'R' + linha, agora = new Date();
    if (linha + n - 1 > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
    var rows = v.pessoas.map(function (x, i) { return [agora, prot, v.dia, i + 1, x.nome, x.tel, 'Confirmado', v.pessoas[0].tel, 'Sim (aceite ao reservar)', '', agora]; });
    sh.getRange(linha, 1, n, 11).setValues(rows);
    SpreadsheetApp.flush();
    if (String(sh.getRange(linha, 2).getValue()) !== prot || String(sh.getRange(linha + n - 1, 5).getValue()) !== v.pessoas[n - 1].nome) throw new Error('ESCRITA_FALHOU: linha ' + linha + ' não confirmada');
    atualizarPainelSeguro_();
    return {ok: true, resumo: resumoRes_(prot, v.dia, prog, v.pessoas, cfg)};
  } finally { lock.releaseLock(); }
}

function achaReserva_(prot, tel) {
  var d = digitos_(tel), rows = reservas_().filter(function (r) { return r.prot === String(prot).trim().toUpperCase() && r.status === 'Confirmado'; });
  return rows.length && digitos_(rows[0].titTel) === d ? rows : null;
}

function abrirReserva_(prot, tel) {
  if (!limite_('rv' + cli_(String(prot)), 8, 900)) return {ok: false, code: 'limite'};
  var rows = achaReserva_(prot, tel);
  if (!rows) return {ok: false, code: 'nao_achou'};
  var cfg = cfg_();
  return {ok: true, resumo: resumoRes_(rows[0].prot, rows[0].dia, prog_(), rows.map(function (r) { return {nome: r.nome, tel: r.tel}; }), cfg)};
}

function cancelarReserva_(prot, tel) {
  if (!limite_('rv' + cli_(String(prot)), 8, 900)) return {ok: false, code: 'limite'};
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var rows = achaReserva_(prot, tel);
    if (!rows) return {ok: false, code: 'nao_achou'};
    var sh = aba_(ABA.RES), agora = new Date();
    rows.forEach(function (r) { sh.getRange(r.linha, 7).setValue('Cancelado'); sh.getRange(r.linha, 11).setValue(agora); });
    atualizarPainelSeguro_();
    return {ok: true};
  } finally { lock.releaseLock(); }
}

function dados()                   { return api_('dados',    dados_,           arguments); }
function reservar(p)               { return api_('reservar', reservar_,        arguments); }
function abrirReserva(prot, tel)   { return api_('abrir',    abrirReserva_,    arguments); }
function cancelarReserva(prot, tel){ return api_('cancelar', cancelarReserva_, arguments); }
