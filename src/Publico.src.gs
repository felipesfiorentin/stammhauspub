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

/* programação pública (lida pelo site institucional): só dados já públicos, vindos da aba Programacao gerida pela equipe */
function programacaoPublica_() {
  var ch = cacheGet_('prog_v2'); if (ch) return ch;
  var prog = prog_(), hoje = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var lim = isoMais_(hoje, cfg_().reservaDias);   // só os próximos 30 dias (reserva_antecedencia_dias)
  var out = {ok: true, noites: ordemDias_(prog).filter(function (d) { return prog[d].iso && prog[d].iso >= hoje && prog[d].iso <= lim && prog[d].aberto; }).map(function (d) {
    var p = prog[d]; return {iso: p.iso, label: p.label, atracao: p.atracao, estilo: p.estilo, show: p.show};
  })};
  cachePut_('prog_v2', out, 60); return out;
}

function doGet(e) {
  if (e && e.parameter && e.parameter.p === 'programacao') {
    var out;
    try { out = programacaoPublica_(); } catch (err) { out = {ok: false, noites: [], erro: String(err && err.message || err).slice(0, 120)}; }
    return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Das Stammhaus Pub · Reservas')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function normNome_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function pubInfo_(cfg) {
  return {valor: cfg.valor, ate: cfg.reservaAte, max: cfg.maxPessoas, whatsapp: cfg.whatsapp, dias: cfg.reservaDias};
}

/* Noites, com situação (Disponível/Lotado). Não expõe contagens: só "vagas" até o máximo por reserva. */
function cacheGet_(k) { try { var h = CacheService.getScriptCache().get(k); return h ? JSON.parse(h) : null; } catch (e) { return null; } }
function cachePut_(k, v, seg) { try { CacheService.getScriptCache().put(k, JSON.stringify(v), seg); } catch (e) {} }
function cacheLimpa_() { try { CacheService.getScriptCache().remove('dados_v2'); } catch (e) {} }

/* Noites, com situação (Disponível/Lotado). Não expõe contagens: só "vagas" até o máximo por reserva.
   Só as noites abertas de hoje até hoje + reserva_antecedencia_dias (30). Resposta em cache por 25 s (limpo a cada reserva/cancelamento). */
function dados_() {
  var ch = cacheGet_('dados_v2'); if (ch) return ch;
  var cfg = cfg_(), prog = prog_();
  var hoje = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), lim = isoMais_(hoje, cfg.reservaDias);
  var dias = ordemDias_(prog).filter(function (d) { return prog[d].pub && prog[d].aberto && prog[d].iso >= hoje && prog[d].iso <= lim; });
  var conv = dias.length ? convLeve_() : [], confs = dias.length ? confs_() : [], resv = dias.length ? reservas_() : [];
  var noites = dias.map(function (d) {
    var p = prog[d], c = contagem_(d, cfg, conv, confs, resv);
    return {dia: d, iso: p.iso, label: p.label, atracao: p.atracao, estilo: p.estilo, show: p.show, valor: valorDe_(cfg, p), reservavel: true, lotado: c.lotado, vagas: Math.min(c.restantes, cfg.maxPessoas)};
  });
  var out = {ok: true, hoje: hoje, noites: noites, info: pubInfo_(cfg)};
  cachePut_('dados_v2', out, 25); return out;
}

function validarReserva_(p, cfg, prog) {
  var dia = Number(p.dia);
  if (!prog[dia] || !prog[dia].pub || !prog[dia].aberto) return {campo: 'geral', msg: 'Noite inválida. Escolha uma das noites da programação.'};
  var hojeV = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  if (prog[dia].iso < hojeV || prog[dia].iso > isoMais_(hojeV, cfg.reservaDias)) return {campo: 'geral', msg: 'As reservas desta noite ainda não estão abertas. Reservamos os próximos ' + cfg.reservaDias + ' dias.'};
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
  return {protocolo: prot, dia: dia, diaLabel: p.label || '', atracao: p.atracao || '', pessoas: pessoas, valor: valorDe_(cfg, p), ate: cfg.reservaAte};
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
    enfileirarWhats_('R', prot, v.dia, v.pessoas);
    cacheLimpa_();
    return {ok: true, resumo: resumoRes_(prot, v.dia, prog, v.pessoas, cfg)};
  } finally { lock.releaseLock(); }
}

function achaReservas_(nome, tel) {
  var d = digitos_(tel), nn = normNome_(nome), grupos = {}, ordem = [];
  var rows = reservas_().filter(function (r) { return r.status === 'Confirmado'; });
  rows.forEach(function (r) { if (digitos_(r.tel) === d && normNome_(r.nome) === nn && !grupos[r.prot]) { grupos[r.prot] = []; ordem.push(r.prot); } });
  rows.forEach(function (r) { if (grupos[r.prot]) grupos[r.prot].push(r); });
  return ordem.map(function (p) { return grupos[p]; });
}

function abrirReserva_(nome, tel) {
  if (!limite_('rv' + cli_(digitos_(tel)), 8, 900)) return {ok: false, code: 'limite'};
  var g = achaReservas_(nome, tel);
  if (!g.length) return {ok: false, code: 'nao_achou'};
  var cfg = cfg_(), prog = prog_();
  return {ok: true, resumos: g.map(function (rows) {
    return resumoRes_(rows[0].prot, rows[0].dia, prog, rows.map(function (r) { return {nome: r.nome, tel: r.tel}; }), cfg);
  })};
}

function cancelarReserva_(prot, nome, tel) {
  if (!limite_('rv' + cli_(digitos_(tel)), 8, 900)) return {ok: false, code: 'limite'};
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var rows = achaReservas_(nome, tel).filter(function (g) { return g[0].prot === String(prot).trim().toUpperCase(); })[0];
    if (!rows) return {ok: false, code: 'nao_achou'};
    var sh = aba_(ABA.RES), agora = new Date();
    rows.forEach(function (r) { sh.getRange(r.linha, 7).setValue('Cancelado'); sh.getRange(r.linha, 11).setValue(agora); });
    cancelarFilaWhats_('R', rows[0].prot, null);
    cacheLimpa_();
    atualizarPainelSeguro_();
    return {ok: true};
  } finally { lock.releaseLock(); }
}

function dados()                   { return api_('dados',    dados_,           arguments); }
function reservar(p)               { return api_('reservar', reservar_,        arguments); }
function abrirReserva(nome, tel)   { return api_('abrir',    abrirReserva_,    arguments); }
function cancelarReserva(prot, nome, tel){ return api_('cancelar', cancelarReserva_, arguments); }

/* Entrada para a página estática do site (GitHub Pages): mesma API do google.script.run, só as funções públicas. */
var ROTAS_ = {dados: function (a) { return dados.apply(null, a); }, reservar: function (a) { return reservar.apply(null, a); },
              abrirReserva: function (a) { return abrirReserva.apply(null, a); }, cancelarReserva: function (a) { return cancelarReserva.apply(null, a); }};
function doPost(e) {
  var out;
  try {
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}'), f = ROTAS_[b.fn];
    out = f ? f(Array.isArray(b.args) ? b.args : []) : {erro: {codigo: 'S99', titulo: 'Função inválida'}};
  } catch (err) { out = {erro: {codigo: 'S99', titulo: 'Erro não classificado', detalhe: String(err && err.message || err).slice(0, 120)}}; }
  return ContentService.createTextOutput(JSON.stringify(out === undefined ? null : out)).setMimeType(ContentService.MimeType.JSON);
}
