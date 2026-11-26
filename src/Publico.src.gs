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

function validarReserva_(p, cfg, prog, off) {
  off = off || 0;
  var dia = Number(p.dia);
  if (!prog[dia] || !prog[dia].pub || !prog[dia].aberto) return {campo: 'geral', msg: 'Noite inválida. Escolha uma das noites da programação.'};
  var hojeV = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  if (prog[dia].iso < hojeV || prog[dia].iso > isoMais_(hojeV, cfg.reservaDias)) return {campo: 'geral', msg: 'As reservas desta noite ainda não estão abertas. Reservamos os próximos ' + cfg.reservaDias + ' dias.'};
  var ps = Array.isArray(p.pessoas) ? p.pessoas : [];
  if (ps.length < 1 || ps.length > cfg.maxPessoas) return {campo: 'qtd', msg: 'Cada reserva é de 1 a ' + cfg.maxPessoas + ' pessoas.'};
  var out = [], tels = {}, nomes = {};
  for (var i = 0; i < ps.length; i++) {
    var n = limpaNome_(ps[i] && ps[i].nome), t = i + off === 0 ? String(ps[i] && ps[i].tel || '').trim() : '', q = i + off === 0 ? 'Você' : 'Pessoa ' + (i + off + 1);
    if (!NOME_RE.test(n) || n.split(' ').length < 2) return {campo: 'nome' + i, msg: (i + off === 0 ? 'Informe o seu nome completo (nome e sobrenome).' : 'Informe o nome completo da pessoa ' + (i + off + 1) + ' (nome e sobrenome).')};
    if (i + off === 0 && !TEL_RE.test(t)) return {campo: 'tel' + i, msg: (i + off === 0 ? 'Informe o seu celular' : 'Informe o celular da pessoa ' + (i + off + 1)) + ' no formato (42) 99999-9999.'};
    var d = digitos_(t), nn = normNome_(n);
    if (nomes[nn]) return {campo: 'nome' + i, msg: 'Este nome aparece duas vezes na reserva.'};
    nomes[nn] = 1; out.push({nome: n, tel: t});
  }
  var andar = String(p.andar == null ? '' : p.andar).trim() === '' ? '' : andarNorm_(p.andar);
  if (String(p.andar == null ? '' : p.andar).trim() !== '' && !andar) return {campo: 'andar', msg: 'Escolha o ambiente: Térreo ou Andar superior.'};
  return {dia: dia, pessoas: out, andar: andar};
}

function resumoRes_(prot, dia, prog, pessoas, cfg, andar) {
  var p = prog[dia] || {};
  return {protocolo: prot, dia: dia, diaLabel: p.label || '', atracao: p.atracao || '', pessoas: pessoas, valor: valorDe_(cfg, p), ate: cfg.reservaAte, andar: andar || ''};
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
    resv.forEach(function (r) { if (r.dia === v.dia && r.status === 'Confirmado') { if (digitos_(r.tel)) usadosTel[digitos_(r.tel)] = 1; usadosNome[normNome_(r.nome)] = 1; } });
    confs.forEach(function (c) {
      if (c.dia !== v.dia || c.status !== 'Confirmado') return;
      usadosTel[digitos_(c.titTel)] = 1; if (c.acTel) usadosTel[digitos_(c.acTel)] = 1;
      usadosNome[normNome_(c.titNome)] = 1; if (c.acNome) usadosNome[normNome_(c.acNome)] = 1;
    });
    for (var i = 0; i < n; i++) {
      if (digitos_(v.pessoas[i].tel) && usadosTel[digitos_(v.pessoas[i].tel)]) return {ok: false, code: 'ja_consta', campo: 'tel' + i, msg: 'Este celular já consta em uma reserva ou confirmação para esta noite. Se for seu, fale com a nossa equipe.'};
      if (usadosNome[normNome_(v.pessoas[i].nome)]) return {ok: false, code: 'ja_consta', campo: 'nome' + i, msg: 'Este nome já consta em uma reserva ou confirmação para esta noite. Se for você, fale com a nossa equipe.'};
    }
    var sh = aba_(ABA.RES), linha = proximaLinha_(sh), prot = 'R' + linha, agora = new Date();
    if (linha + n - 1 > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
    var rows = v.pessoas.map(function (x, i) { return [agora, prot, v.dia, i + 1, x.nome, x.tel, 'Confirmado', v.pessoas[0].tel, 'Sim (aceite ao reservar)', '', agora]; });
    sh.getRange(linha, 1, n, 11).setValues(rows);
    if (v.andar) { if (sh.getMaxColumns() < RES_COL_ANDAR) sh.insertColumnsAfter(sh.getMaxColumns(), RES_COL_ANDAR - sh.getMaxColumns()); if (!String(sh.getRange(1, RES_COL_ANDAR).getValue() || '')) sh.getRange(1, RES_COL_ANDAR).setValue(ANDAR_CAB); sh.getRange(linha, RES_COL_ANDAR, n, 1).setValues(rows.map(function () { return [v.andar]; })); }
    SpreadsheetApp.flush();
    if (String(sh.getRange(linha, 2).getValue()) !== prot || String(sh.getRange(linha + n - 1, 5).getValue()) !== v.pessoas[n - 1].nome) throw new Error('ESCRITA_FALHOU: linha ' + linha + ' não confirmada');
    atualizarPainelSeguro_();
    enfileirarWhats_('R', prot, v.dia, v.pessoas.filter(function (x) { return digitos_(x.tel); }));
    cacheLimpa_();
    return {ok: true, resumo: resumoRes_(prot, v.dia, prog, v.pessoas, cfg, v.andar)};
  } finally { lock.releaseLock(); }
}

function achaReservas_(nome, tel) {
  var d = digitos_(tel), nn = normNome_(nome), grupos = {}, ordem = [];
  var rows = reservas_().filter(function (r) { return r.status === 'Confirmado' && !/^legado/.test(r.origem || ''); });
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
    return resumoRes_(rows[0].prot, rows[0].dia, prog, rows.map(function (r) { return {nome: r.nome, tel: r.tel}; }), cfg, rows[0].andar);
  })};
}

function adicionarPessoas_(prot, nome, tel, pessoas, cliId) {
  if (!limite_('rg', 400, 60) || !limite_('ra' + cli_(digitos_(tel)), 8, 900)) return {ok: false, code: 'limite'};
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var grupo = achaReservas_(nome, tel).filter(function (g) { return g[0].prot === String(prot).trim().toUpperCase(); })[0];
    if (!grupo) return {ok: false, code: 'nao_achou'};
    var cfg = cfg_(), prog = prog_(), dia = grupo[0].dia, ja = grupo.length, andar = grupo[0].andar || '';
    var pa = {dia: dia, pessoas: pessoas, andar: andar};
    if (ja >= cfg.maxPessoas) return {ok: false, code: 'invalido', campo: 'geral', msg: 'Esta reserva já está com o máximo de ' + cfg.maxPessoas + ' pessoas. Para mais, fale com a nossa equipe.'};
    var cfg2 = {}; for (var k in cfg) cfg2[k] = cfg[k]; cfg2.maxPessoas = cfg.maxPessoas - ja;
    var v = validarReserva_(pa, cfg2, prog, ja);
    if (!v.pessoas) return {ok: false, code: 'invalido', campo: v.campo, msg: v.msg};
    var conv = convLeve_(), confs = confs_(), resv = reservas_(), cnt = contagem_(dia, cfg, conv, confs, resv), n = v.pessoas.length;
    if (cnt.restantes <= 0) return {ok: false, code: 'lotado'};
    if (n > cnt.restantes) return {ok: false, code: 'sem_vagas', restantes: cnt.restantes};
    var usadosTel = {}, usadosNome = {};
    resv.forEach(function (r) { if (r.dia === dia && r.status === 'Confirmado') { if (digitos_(r.tel)) usadosTel[digitos_(r.tel)] = 1; usadosNome[normNome_(r.nome)] = 1; } });
    confs.forEach(function (c) {
      if (c.dia !== dia || c.status !== 'Confirmado') return;
      usadosTel[digitos_(c.titTel)] = 1; if (c.acTel) usadosTel[digitos_(c.acTel)] = 1;
      usadosNome[normNome_(c.titNome)] = 1; if (c.acNome) usadosNome[normNome_(c.acNome)] = 1;
    });
    for (var i = 0; i < n; i++) {
      if (digitos_(v.pessoas[i].tel) && usadosTel[digitos_(v.pessoas[i].tel)]) return {ok: false, code: 'ja_consta', campo: 'tel' + i, msg: 'Este celular já consta em uma reserva ou confirmação para esta noite.'};
      if (usadosNome[normNome_(v.pessoas[i].nome)]) return {ok: false, code: 'ja_consta', campo: 'nome' + i, msg: 'Este nome já consta em uma reserva ou confirmação para esta noite.'};
    }
    var sh = aba_(ABA.RES), linha = proximaLinha_(sh), agora = new Date();
    if (linha + n - 1 > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
    var rows = v.pessoas.map(function (x, i) { return [agora, grupo[0].prot, dia, ja + i + 1, x.nome, x.tel, 'Confirmado', grupo[0].tel, 'Sim (aceite ao reservar)', '', agora]; });
    sh.getRange(linha, 1, n, 11).setValues(rows);
    if (andar) { if (sh.getMaxColumns() < RES_COL_ANDAR) sh.insertColumnsAfter(sh.getMaxColumns(), RES_COL_ANDAR - sh.getMaxColumns()); sh.getRange(linha, RES_COL_ANDAR, n, 1).setValues(rows.map(function () { return [andar]; })); }
    SpreadsheetApp.flush();
    if (String(sh.getRange(linha, 2).getValue()) !== grupo[0].prot || String(sh.getRange(linha + n - 1, 5).getValue()) !== v.pessoas[n - 1].nome) throw new Error('ESCRITA_FALHOU: linha ' + linha + ' não confirmada');
    atualizarPainelSeguro_();
    cacheLimpa_();
    var todas = grupo.map(function (r) { return {nome: r.nome, tel: r.tel}; }).concat(v.pessoas);
    return {ok: true, resumo: resumoRes_(grupo[0].prot, dia, prog, todas, cfg, andar)};
  } finally { lock.releaseLock(); }
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


/* ---------- artes dos artistas: busca pelo nome na pasta do Drive ----------
 * Pasta "Artistas": uma subpasta por artista/banda (nome da subpasta = nome do artista), com fotos e logos (até 3 níveis de subpastas).
 * O ticket usa: logo (arquivo cujo nome tem "logo", de preferência o preto/colorido — o branco some no ticket claro) e até 2 fotos.
 * Sem imagem de foto/logo na subpasta (só PDF/vídeo, por exemplo) ou sem subpasta com o nome: ticket só de texto. */
var ARTES_PASTA = '1gTowXWgSFVKnaoGYktAMfN3hrwUYLB7R';
function artesPasta_() { try { return PropertiesService.getScriptProperties().getProperty('ARTES_PASTA') || ARTES_PASTA; } catch (e) { return ARTES_PASTA; } }
function foldNome_(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function nomeArtista_(s) { return foldNome_(String(s || '').split(/·| - /)[0]).replace(/^(os|as|o|a|the|banda|trio|dupla) /, ''); }
function driveLista_(pasta) {
  var r = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent("'" + pasta + "' in parents and trashed=false") + '&fields=' + encodeURIComponent('files(id,name,mimeType,size)') + '&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true',
    {headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}, muteHttpExceptions: true});
  if (r.getResponseCode() !== 200) throw new Error('DRIVE_' + r.getResponseCode());
  return JSON.parse(r.getContentText()).files || [];
}
function coletaImgs_(pasta, arr, nivel) {
  driveLista_(pasta).forEach(function (f) {
    if (f.mimeType === 'application/vnd.google-apps.folder') { if (nivel < 2) coletaImgs_(f.id, arr, nivel + 1); }
    else if (/^image\//.test(f.mimeType)) arr.push({id: f.id, n: f.name, s: Number(f.size) || 0});
  });
}
function artesIndice_() {   // {nome-normalizado-da-subpasta: [{id,n,s}]}; cache 30 min (só guarda se a leitura deu certo)
  var ch = cacheGet_('artes_idx_v1'); if (ch) return ch;
  var idx = {};
  driveLista_(artesPasta_()).forEach(function (f) {
    if (f.mimeType !== 'application/vnd.google-apps.folder') return;
    var arr = []; coletaImgs_(f.id, arr, 0); idx[nomeArtista_(f.name) || foldNome_(f.name)] = arr;
  });
  cachePut_('artes_idx_v1', idx, 1800); return idx;
}
function achaArtista_(atracao, idx) {
  var nome = nomeArtista_(atracao); if (nome.length < 3) return null;
  var melhor = null, nm = ' ' + nome + ' ';
  Object.keys(idx).forEach(function (k) { if (k.length < 3) return; var kk = ' ' + k + ' '; if ((nm.indexOf(kk) >= 0 || kk.indexOf(nm) >= 0) && (!melhor || k.length > melhor.length)) melhor = k; });
  return melhor;
}
function escolheArtes_(imgs) {
  var logos = imgs.filter(function (i) { return /logo/i.test(i.n); }), brancos = /branc|white/i;
  var logo = logos.filter(function (i) { return !brancos.test(i.n); }).sort(function (a, b) { return /pret|black|color/i.test(b.n) - /pret|black|color/i.test(a.n); })[0] || null;
  var fotos = imgs.filter(function (i) { return !/logo/i.test(i.n) && i.s > 15000; }).sort(function (a, b) { return a.n < b.n ? -1 : 1; }).slice(0, 2);
  return {logo: logo, fotos: fotos};
}
function cachePutBig_(k, txt, seg) { try { var c = CacheService.getScriptCache(), n = Math.ceil(txt.length / 90000), o = {}; for (var i = 0; i < n; i++) o[k + '_' + i] = txt.substr(i * 90000, 90000); o[k + '_n'] = String(n); c.putAll(o, seg); } catch (e) {} }
function cacheGetBig_(k) { try { var c = CacheService.getScriptCache(), n = Number(c.get(k + '_n') || 0); if (!n) return null; var ks = []; for (var i = 0; i < n; i++) ks.push(k + '_' + i); var o = c.getAll(ks), t = ''; for (var j = 0; j < n; j++) { if (o[k + '_' + j] == null) return null; t += o[k + '_' + j]; } return t; } catch (e) { return null; } }
function dataUri_(blob) { return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()); }
function imagemDrive_(id, larg, tam) {   // logo: arquivo original (mantém a transparência); foto: miniatura reduzida do Drive
  if (tam && tam <= 1500000 && larg <= 0) return dataUri_(DriveApp.getFileById(id).getBlob());
  var h = {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()};
  var m = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + id + '?fields=thumbnailLink&supportsAllDrives=true', {headers: h, muteHttpExceptions: true});
  var tl = m.getResponseCode() === 200 ? JSON.parse(m.getContentText()).thumbnailLink : '';
  if (tl) { var r = UrlFetchApp.fetch(tl.replace(/=s\d+$/, '=s' + (larg > 0 ? larg : 600)), {headers: h, muteHttpExceptions: true}); if (r.getResponseCode() === 200) return dataUri_(r.getBlob()); }
  if (tam && tam <= 1000000) return dataUri_(DriveApp.getFileById(id).getBlob());
  return '';
}
function arte_(atracao) {
  if (!limite_('ar', 150, 60)) return {ok: false, code: 'limite'};
  var nome = nomeArtista_(atracao); if (nome.length < 3) return {ok: false};
  var ck = 'arte_v1_' + nome.replace(/ /g, '_').slice(0, 60), ch = cacheGetBig_(ck);
  if (ch) return JSON.parse(ch);
  var idx = artesIndice_(), k = achaArtista_(atracao, idx), out = {ok: false};
  if (k) {
    var e = escolheArtes_(idx[k]), fotos = [], logo = '';
    try { if (e.logo) logo = imagemDrive_(e.logo.id, 0, e.logo.s); } catch (e1) {}
    e.fotos.forEach(function (f) { try { var u = imagemDrive_(f.id, 600, f.s); if (u) fotos.push(u); } catch (e2) {} });
    if (logo || fotos.length) out = {ok: true, logo: logo, fotos: fotos};
  }
  cachePutBig_(ck, JSON.stringify(out), 1800); return out;
}

/* Executar UMA vez no editor: pede a autorização do Drive/Internet usada pela busca de artes. */
function autorizarArtes() {
  var r = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files?pageSize=1&q=' + encodeURIComponent("'" + ARTES_PASTA + "' in parents"), {headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}, muteHttpExceptions: true});
  DriveApp.getFolderById(ARTES_PASTA).getName();
  return r.getResponseCode();
}

function arte(nome)                { return api_('arte',     arte_,            arguments); }
function dados()                   { return api_('dados',    dados_,           arguments); }
function reservar(p)               { return api_('reservar', reservar_,        arguments); }
function abrirReserva(nome, tel)   { return api_('abrir',    abrirReserva_,    arguments); }
function cancelarReserva(prot, nome, tel){ return api_('cancelar', cancelarReserva_, arguments); }
function adicionarPessoas(prot, nome, tel, pessoas){ return api_('adicionar', adicionarPessoas_, arguments); }

/* Entrada para a página estática do site (GitHub Pages): mesma API do google.script.run, só as funções públicas. */
var ROTAS_ = {dados: function (a) { return dados.apply(null, a); }, arte: function (a) { return arte.apply(null, a); }, reservar: function (a) { return reservar.apply(null, a); },
              abrirReserva: function (a) { return abrirReserva.apply(null, a); }, cancelarReserva: function (a) { return cancelarReserva.apply(null, a); },
              adicionarPessoas: function (a) { return adicionarPessoas.apply(null, a); }};
function doPost(e) {
  var out;
  try {
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}'), f = ROTAS_[b.fn];
    out = f ? f(Array.isArray(b.args) ? b.args : []) : {erro: {codigo: 'S99', titulo: 'Função inválida'}};
  } catch (err) { out = {erro: {codigo: 'S99', titulo: 'Erro não classificado', detalhe: String(err && err.message || err).slice(0, 120)}}; }
  return ContentService.createTextOutput(JSON.stringify(out === undefined ? null : out)).setMimeType(ContentService.MimeType.JSON);
}
