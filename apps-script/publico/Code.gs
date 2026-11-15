/* =====================================================================
 * Das Stammhaus Pub — RESERVAS DO PÚBLICO. ARQUIVO ÚNICO (Code.gs). Projeto separado do dos convidados.
 * ===================================================================== */
var TZ = 'America/Sao_Paulo';
var TEL_RE = /^\([1-9]\d\) 9\d{4}-\d{4}$/;
var NOME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'.\- ]{3,78}$/;
var ABA = {CONV: 'Convidados', CONF: 'Confirmacoes', PROG: 'Programacao', CFG: 'Config', RES: 'Reservas', PAINEL: 'Lotacao', ACESSO: 'Acesso'};
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


/* ---------- config ---------- */
function lerConfig_() {
  var sh = aba_(ABA.CFG), n = Math.min(Math.max(sh.getLastRow(), 1), 40);
  return sh.getRange(1, 1, n, 2).getValues();
}

function cfg_() {
  var v = lerConfig_(), o = {};
  v.forEach(function (r) { if (r[0]) o[String(r[0]).trim()] = r[1]; });
  return {
    capacidade: Number(o.capacidade_por_noite) || 74,
    teto: Number(o.teto_por_noite) || 81,               // 74 + 10% de overbooking
    valor: Number(o.valor_ingresso) || 40,               // R$ por pessoa (público geral), pago na quitação da comanda
    maxPessoas: Number(o.max_pessoas_reserva) || 4,
    reservaAte: String(o.reserva_valida_ate || '20h').trim(),
    urlApp: String(o.url_app_convidados || '').trim(),
    pendAc: String(o.pendente_conta_acompanhante || 'SIM').trim().toUpperCase() !== 'NAO',
    whatsapp: String(o.whatsapp_contato || '').trim(),
    horario: String(o.horario || '').trim()
  };
}

/* ---------- leituras usadas na contagem de lotação (sem nomes de convidados) ---------- */
function convLeve_() {
  var sh = aba_(ABA.CONV), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, 6).getValues().filter(function (r) { return r[0]; }).map(function (r) {
    return {id: String(r[0]), dia: Number(r[2]), acomp: Number(r[5]) === 1 ? 1 : 0};
  });
}

// Colunas Reservas (público): A data/hora, B protocolo, C dia, D nº da pessoa, E nome, F celular,
// G status (Confirmado/Cancelado), H celular do titular da reserva, I consentimento, J compareceu, K atualizado
function reservas_() {
  var sh = ss_().getSheetByName(ABA.RES), n = sh ? sh.getLastRow() : 0;
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, 11).getValues().map(function (r, i) {
    return {linha: i + 2, ts: r[0], prot: String(r[1]), dia: Number(r[2]), n: Number(r[3]) || 0, nome: String(r[4]),
            tel: String(r[5]), status: String(r[6]), titTel: String(r[7])};
  }).filter(function (r) { return r.prot; });
}

/* ---------- LOTAÇÃO ----------
 * Pessoas comprometidas na noite = lista garantida + reservas do público.
 * Lista garantida, por convidado: confirmado = pessoas confirmadas (titular e acompanhante contam cada um);
 * "não vai"/cancelado = 0 (libera vaga); sem resposta = titular + acompanhante a que o convite dá direito
 * (config pendente_conta_acompanhante = SIM) ou só o titular (NAO).
 * Lotado quando o total chega ao teto (config teto_por_noite = 81). */
function contribConv_(g, confs, cfg) {
  var ult = null;
  confs.forEach(function (c) { if (c.id === g.id && c.status !== 'Substituído') ult = c; });   // última linha vale
  if (!ult) return 1 + (cfg.pendAc ? g.acomp : 0);
  return ult.status === 'Confirmado' ? ult.pessoas : 0;
}

function contagem_(dia, cfg, conv, confs, resv) {
  var o = {dia: dia, teto: cfg.teto, capacidade: cfg.capacidade, convites: 0, confirmadosPessoas: 0, pendentesConvites: 0,
           pendentesPessoas: 0, naoVaiConvites: 0, publico: 0, reservas: 0, canceladasPublico: 0};
  var prots = {};
  conv.forEach(function (g) {
    if (g.dia !== dia) return;
    o.convites++;
    var ult = null; confs.forEach(function (c) { if (c.id === g.id && c.status !== 'Substituído') ult = c; });
    if (!ult) { o.pendentesConvites++; o.pendentesPessoas += 1 + (cfg.pendAc ? g.acomp : 0); }
    else if (ult.status === 'Confirmado') o.confirmadosPessoas += ult.pessoas;
    else o.naoVaiConvites++;
  });
  resv.forEach(function (r) {
    if (r.dia !== dia) return;
    if (r.status === 'Confirmado') { o.publico++; prots[r.prot] = 1; } else if (r.n === 1) o.canceladasPublico++;
  });
  o.reservas = Object.keys(prots).length;
  o.lista = o.confirmadosPessoas + o.pendentesPessoas;
  o.total = o.lista + o.publico;
  o.restantes = Math.max(0, cfg.teto - o.total);
  o.lotado = o.total >= cfg.teto;
  o.pct = cfg.teto ? Math.round(1000 * o.total / cfg.teto) / 10 : 0;
  return o;
}

function lotacaoTodas_() {
  var cfg = cfg_(), prog = prog_(), conv = convLeve_(), confs = confs_(), resv = reservas_();
  return Object.keys(prog).map(Number).sort().map(function (d) { var c = contagem_(d, cfg, conv, confs, resv); c.prog = prog[d]; return c; });
}

/* ---------- aba "Lotacao": monitoramento na planilha (atualizada a cada gravação e por gatilho) ---------- */
function atualizarPainel_() {
  var ss = ss_(), sh = ss.getSheetByName(ABA.PAINEL) || ss.insertSheet(ABA.PAINEL);
  var L = lotacaoTodas_(), cfg = cfg_(), agora = Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm:ss');
  var cab = ['dia', 'atração', 'capacidade', 'teto (74+10%)', 'convidados confirmados (pessoas)', 'convidados sem resposta (pessoas contadas)',
             'convidados que não vão (convites)', 'lista garantida (pessoas)', 'reservas do público (pessoas)', 'total comprometido',
             'vagas restantes', '% do teto', 'situação'];
  var v = [cab].concat(L.map(function (c) {
    return [c.dia, c.prog && c.prog.atracao || '', c.capacidade, c.teto, c.confirmadosPessoas, c.pendentesPessoas, c.naoVaiConvites,
            c.lista, c.publico, c.total, c.restantes, c.pct / 100, c.lotado ? 'LOTADO' : 'Disponível'];
  }));
  sh.getRange(1, 1, v.length, 13).setValues(v);
  sh.getRange(v.length + 2, 1).setValue('Atualizado em ' + agora + ' · regra: lista garantida + público ≤ ' + cfg.teto + ' pessoas por noite');
  try {
    sh.getRange(1, 1, 1, 13).setFontWeight('bold').setBackground('#113325').setFontColor('#EAE7DA').setWrap(true);
    sh.getRange(2, 12, Math.max(L.length, 1), 1).setNumberFormat('0.0%');
    L.forEach(function (c, i) { sh.getRange(i + 2, 13).setBackground(c.lotado ? '#E04E27' : '#BFE3C4').setFontWeight('bold'); });
    sh.setFrozenRows(1);
  } catch (e) {}
}
function atualizarPainelSeguro_() { try { atualizarPainel_(); } catch (e) { try { console.error('painel: ' + e.message); } catch (_) {} } }

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

/* ---------- proteção contra abuso ---------- */
function limite_(chave, max, seg) {
  var c = CacheService.getScriptCache(), k = 'rl_' + chave + '_' + Math.floor(Date.now() / (seg * 1000));
  var n = Number(c.get(k) || 0);
  if (n >= max) return false;
  c.put(k, String(n + 1), seg + 10);
  return true;
}
function cli_(s) { return String(s || 'x').replace(/[^A-Za-z0-9]/g, '').slice(0, 40) || 'x'; }

function digitos_(s) { return String(s || '').replace(/\D/g, ''); }
function limpaNome_(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

function proximaLinha_(sh) {
  var max = Math.max(sh.getMaxRows(), 2);
  var v = sh.getRange(2, 2, max - 1, 1).getValues();
  for (var i = v.length - 1; i >= 0; i--) { if (String(v[i][0]).trim() !== '') return i + 3; }
  return 2;
}


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
    atualizarPainelSeguro_();
    return {ok: true};
  } finally { lock.releaseLock(); }
}

function dados()                   { return api_('dados',    dados_,           arguments); }
function reservar(p)               { return api_('reservar', reservar_,        arguments); }
function abrirReserva(nome, tel)   { return api_('abrir',    abrirReserva_,    arguments); }
function cancelarReserva(prot, nome, tel){ return api_('cancelar', cancelarReserva_, arguments); }
