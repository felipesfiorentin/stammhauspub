/**
 * Das Stammhaus Pub — Confirmação de presença (semana de inauguração)
 * Web app (Apps Script) vinculado à planilha. Arquivos: Code.gs, Busca.gs, Index.html
 */
var TZ = 'America/Sao_Paulo';
var TEL_RE = /^\([1-9]\d\) 9\d{4}-\d{4}$/;
var NOME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'.\- ]{3,78}$/;
var ABA = {CONV: 'Convidados', CONF: 'Confirmacoes', PROG: 'Programacao', CFG: 'Config'};
var DIAS_SEMANA = ['', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];

/* ---------- TIPOLOGIA DE ERROS ----------
 * S01 ABA_AUSENTE       aba da planilha não encontrada (nomes exatos: Convidados, Confirmacoes, Programacao, Config)
 * S02 LISTA_VAZIA       aba Convidados sem linhas
 * S03 DADOS_INVALIDOS   planilha fora do formato esperado (colunas/linhas)
 * S04 CODIGO_INCOMPLETO falta a função de busca (cole o Code.gs completo)
 * S05 RUNTIME_ANTIGO    runtime V8 não ativado (appsscript.json)
 * S06 SISTEMA_OCUPADO   muitos acessos simultâneos (lock)
 * S07 COTA_GOOGLE       limite de uso do Google atingido
 * S08 PERMISSAO         autorização do Google pendente
 * S09 ESCRITA_FALHOU    a gravação na planilha não foi confirmada
 * S99 DESCONHECIDO      qualquer outro erro (veja a aba Erros)
 * (C01-C03 são gerados na página: falha de comunicação, resposta vazia, tempo esgotado)
 */
var ERROS_TIPOS = {
  S01: 'Aba da planilha não encontrada',
  S02: 'Lista de convidados vazia',
  S03: 'Dados da planilha fora do formato esperado',
  S04: 'Código incompleto (falta a função de busca)',
  S05: 'Ambiente do script desatualizado (V8)',
  S06: 'Muitos acessos ao mesmo tempo',
  S07: 'Limite de uso do Google atingido',
  S08: 'Permissão do Google pendente',
  S09: 'Não foi possível gravar na planilha',
  S99: 'Erro não classificado'
};

function classificar_(msg) {
  var m = String(msg || '');
  if (/^ABA_AUSENTE/.test(m)) return 'S01';
  if (/^LISTA_VAZIA/.test(m)) return 'S02';
  if (/^DADOS/.test(m)) return 'S03';
  if (/^ESCRITA/.test(m)) return 'S09';
  if (/is not defined/i.test(m)) return 'S04';
  if (/normalize/i.test(m)) return 'S05';
  if (/lock/i.test(m)) return 'S06';
  if (/too many times|quota|Service invoked|limit exceeded/i.test(m)) return 'S07';
  if (/authoriz|permission|permiss|access denied/i.test(m)) return 'S08';
  if (/coordinates or dimensions|range|Cannot read propert|undefined/i.test(m)) return 'S03';
  return 'S99';
}

function registrarErro_(ref, fn, cod, e) {
  try {
    var ss = ss_(), sh = ss.getSheetByName('Erros') || ss.insertSheet('Erros');
    if (sh.getLastRow() === 0) sh.appendRow(['data/hora', 'ref', 'função', 'código', 'mensagem', 'detalhe técnico']);
    sh.appendRow([new Date(), ref, fn, cod, String(e && e.message || e).slice(0, 300), String(e && e.stack || '').slice(0, 600)]);
  } catch (_) {}
}

function erro_(fn, e) {
  var msg = String(e && e.message || e), cod = classificar_(msg);
  var ref = Utilities.getUuid().replace(/-/g, '').slice(0, 6).toUpperCase();
  try { console.error('[' + cod + '] ' + fn + ' · ' + msg); } catch (_) {}
  registrarErro_(ref, fn, cod, e);
  return {codigo: cod, titulo: ERROS_TIPOS[cod], ref: ref, funcao: fn, detalhe: msg.slice(0, 200)};
}

function api_(nome, fn, args) {
  try { return fn.apply(null, args); }
  catch (e) { return {ok: false, status: 'erro', erro: erro_(nome, e)}; }
}

function aba_(nome) {
  var sh = ss_().getSheetByName(nome);
  if (!sh) throw new Error('ABA_AUSENTE: ' + nome);
  return sh;
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Das Stammhaus Pub · Confirmação de presença')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---------- leitura da planilha ---------- */
function ss_() {
  var x = SpreadsheetApp.getActiveSpreadsheet();
  if (!x) throw new Error('DADOS: planilha não vinculada ao script (crie o script por Extensões > Apps Script dentro da planilha)');
  return x;
}

function lerConfig_() {
  var sh = aba_(ABA.CFG), n = Math.min(Math.max(sh.getLastRow(), 1), 30);
  return sh.getRange(1, 1, n, 2).getValues();
}

function cfg_() {
  var v = lerConfig_(), o = {};
  v.forEach(function (r) { if (r[0]) o[String(r[0]).trim()] = r[1]; });
  return {
    capacidade: Number(o.capacidade_por_noite) || 74,
    whatsapp: String(o.whatsapp_contato || '').trim(),
    horario: String(o.horario || '').trim()
  };
}

function prog_() {
  var sh = aba_(ABA.PROG), n = sh.getLastRow(), m = {};
  if (n < 2) return m;
  sh.getRange(2, 1, n - 1, 5).getValues().forEach(function (r) {
    if (!r[0]) return;
    var d = Object.prototype.toString.call(r[1]) === '[object Date]' ? r[1] : null;
    var sem = '', dm = '';
    if (d) {
      /* a data da célula é um instante à meia-noite no fuso DA PLANILHA; formatar em outro fuso desloca o dia */
      var tz = TZ; try { tz = ss_().getSpreadsheetTimeZone() || TZ; } catch (e0) {}
      /* autocorreção: a coluna "dia" (ex.: 18) é a verdade; se o fuso deslocou o dia, testa ±12h */
      var p = null, cand = [0, 12, -12];
      for (var k = 0; k < cand.length && !p; k++) {
        var q = Utilities.formatDate(new Date(d.getTime() + cand[k] * 3600000), tz, 'yyyy-MM-dd').split('-');
        if (Number(q[2]) === Number(r[0])) p = q;
      }
      if (!p) p = Utilities.formatDate(d, tz, 'yyyy-MM-dd').split('-');
      sem = DIAS_SEMANA[new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay() || 7];
      dm = p[2] + '/' + p[1];
    }
    m[Number(r[0])] = {
      dia: Number(r[0]),
      label: d ? sem.charAt(0).toUpperCase() + sem.slice(1) + ', ' + dm : 'Dia ' + r[0],
      atracao: String(r[2] || ''), estilo: String(r[3] || ''), instagram: String(r[4] || '')
    };
  });
  return m;
}

function convidados_() {
  var sh = aba_(ABA.CONV), n = sh.getLastRow();
  if (n < 2) throw new Error('LISTA_VAZIA: a aba Convidados não tem linhas');
  return sh.getRange(2, 1, n - 1, 7).getValues().filter(function (r) { return r[0]; }).map(function (r) {
    return {id: String(r[0]), nome: String(r[1]).trim(), dia: Number(r[2]), estilo: String(r[3]), grupo: String(r[4]),
            acomp: Number(r[5]) === 1 ? 1 : 0, busca: String(r[6] || '')};
  });
}

// Colunas Confirmacoes: A data/hora, B id, C convidado(lista), D dia, E titular, F tel titular,
// G acompanhante, H tel acomp., I pessoas, J status, K consentimento, L compareceu, M atualizado
var STATUS_NAO = 'Não vai';

function confs_() {
  var sh = aba_(ABA.CONF), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, 13).getValues().map(function (r, i) {
    return {linha: i + 2, id: String(r[1]), dia: Number(r[3]), titNome: String(r[4]), titTel: String(r[5]),
            acNome: String(r[6]), acTel: String(r[7]), pessoas: Number(r[8]) || 0, status: String(r[9])};
  }).filter(function (c) { return c.id; });
}

function pub_(c, prog) {
  var p = prog[c.dia] || {};
  return {id: c.id, nome: c.nome, dia: c.dia, diaLabel: p.label || '', atracao: p.atracao || '', acomp: c.acomp};
}

/* ---------- proteção contra abuso ---------- */
function limite_(chave, max, seg) {
  var c = CacheService.getScriptCache(), k = 'rl_' + chave + '_' + Math.floor(Date.now() / (seg * 1000));
  var n = Number(c.get(k) || 0);
  if (n >= max) return false;
  c.put(k, String(n + 1), seg + 10);
  return true;
}
function cli_(s) { return String(s || 'x').replace(/[^A-Za-z0-9]/g, '').slice(0, 40) || 'x'; }

/* ---------- validação ---------- */
function digitos_(s) { return String(s || '').replace(/\D/g, ''); }
function limpaNome_(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

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

function ocupacao_(dia, confs, ignorarLinha) {
  return confs.filter(function (c) { return c.status === 'Confirmado' && c.dia === dia && c.linha !== ignorarLinha; })
    .reduce(function (s, c) { return s + c.pessoas; }, 0);
}

function proximaLinha_(sh) {
  var max = Math.max(sh.getMaxRows(), 2);
  var v = sh.getRange(2, 2, max - 1, 1).getValues();
  for (var i = v.length - 1; i >= 0; i--) { if (String(v[i][0]).trim() !== '') return i + 3; }
  return 2;
}

/* ---------- identidade de nomes (mesma pessoa?) ---------- */
function simId_(x, y) {
  if (x === y) return 1;
  // só a vogal final muda (Juliano/Juliana, Luciano/Luciana): são pessoas diferentes
  if (x.length >= 4 && x.length === y.length && x.slice(0, -1) === y.slice(0, -1) && /[aoe]$/.test(x) && /[aoe]$/.test(y)) return 0.5;
  if (buscaFonetica_(x) === buscaFonetica_(y)) return 0.95;
  return 1 - buscaDist_(x, y) / Math.max(x.length, y.length);
}
// Mesma quantidade de palavras e cada palavra equivalente (tolera acento, ordem, 1 letra trocada, grafia parecida)
function nomesIguais_(a, b) {
  var ta = buscaNormalizar_(a), tb = buscaNormalizar_(b);
  if (ta.length < 2 || ta.length !== tb.length) return false;
  var usados = {}, soma = 0, i, j;
  for (i = 0; i < ta.length; i++) {
    var melhor = 0, k = -1;
    for (j = 0; j < tb.length; j++) {
      if (usados[j]) continue;
      var s = simId_(ta[i], tb[j]);
      if (s > melhor) { melhor = s; k = j; }
    }
    if (k < 0 || melhor < 0.80) return false;
    usados[k] = 1; soma += melhor;
  }
  return soma / ta.length >= 0.90;
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
function nomeTitularValido_(digitado, nomeLista) {
  var tl = tokensConvite_(nomeLista), td = tokensConvite_(digitado);
  if (!tl.length || td.length < tl.length || td.length > tl.length + 2) return false;
  var usados = {}, soma = 0, i, j;
  for (i = 0; i < tl.length; i++) {
    var melhor = 0, k = -1;
    for (j = 0; j < td.length; j++) {
      if (usados[j]) continue;
      var sc = simId_(tl[i], td[j]);
      if (sc > melhor) { melhor = sc; k = j; }
    }
    if (k < 0 || melhor < 0.80) return false;
    usados[k] = 1; soma += melhor;
  }
  return soma / tl.length >= 0.90;
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
  var nTok = tokensConvite_(g.nome).length;
  for (i = 0; i < todos.length; i++) {
    var o = todos[i];
    if (o.id === g.id) continue;
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
    if (ocupacao_(g.dia, confs, 0) + pessoas > cfg_().capacidade) return {ok: false, code: 'lotado'};
    var agora = new Date(), sh = aba_(ABA.CONF), linha = proximaLinha_(sh);
    if (linha > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
    sh.getRange(linha, 1, 1, 13).setValues([[agora, g.id, g.nome, g.dia, d.titNome, d.titTel, d.acNome, d.acTel,
      pessoas, 'Confirmado', 'Sim (aceite ao confirmar)', '', agora]]);
    SpreadsheetApp.flush();
    if (String(sh.getRange(linha, 2).getValue()) !== g.id) throw new Error('ESCRITA_FALHOU: linha ' + linha + ' não confirmada');
    if (antes) sh.getRange(antes.linha, 10).setValue('Substituído');
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
    if (ocupacao_(g.dia, confs, c.linha) + pessoas > cfg_().capacidade) return {ok: false, code: 'lotado'};
    aba_(ABA.CONF).getRange(c.linha, 5, 1, 5).setValues([[d.titNome, d.titTel, d.acNome, d.acTel, pessoas]]);
    aba_(ABA.CONF).getRange(c.linha, 13).setValue(new Date());
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
  SpreadsheetApp.getUi().createMenu('Stammhaus').addItem('Diagnóstico do sistema', 'diagnostico').addToUi();
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
