/* =====================================================================
 * Das Stammhaus Pub — Confirmação de presença dos CONVIDADOS + métricas. ARQUIVO ÚNICO (Code.gs).
 * Ordem: Comum (núcleo/lotação) · Busca · Convidados · Métricas · Preparação.
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
 * Busca tolerante de nomes (JS puro, sem dependências do Apps Script).
 * Tolera: acentos, maiúsculas, ordem trocada, sobrenome/nome do meio omitido,
 * letras trocadas/faltando/sobrando e grafias foneticamente parecidas (Fuck/Fuk, Hoffman/Hofmann).
 */
var BUSCA_CFG = {
  AUTO: 0.90,      // nota mínima para tratar como "achei você"
  GAP: 0.06,       // diferença mínima para o 2º colocado, senão vira lista de sugestões
  MIN_SUGESTAO: 0.70,
  MAX_SUGESTOES: 3
};
var BUSCA_STOP = {de:1, da:1, do:1, dos:1, das:1, e:1};

function buscaNormalizar_(s) {
  var t = String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\+1/g, ' ').replace(/[^a-z]+/g, ' ').trim();
  if (!t) return [];
  return t.split(' ').filter(function (w) { return w && !BUSCA_STOP[w]; });
}

// Chave fonética aproximada para o português do Brasil
function buscaFonetica_(w) {
  var s = w;
  s = s.replace(/ph/g, 'f').replace(/th/g, 't').replace(/ck/g, 'k')
       .replace(/w/g, 'v').replace(/y/g, 'i')
       .replace(/sch/g, 'x').replace(/ch|sh/g, 'x').replace(/x/g, 'x')
       .replace(/qu([ei])/g, 'k$1').replace(/q/g, 'k')
       .replace(/gu([ei])/g, 'g$1').replace(/g([ei])/g, 'j$1')
       .replace(/c([ei])/g, 's$1').replace(/c/g, 'k').replace(/k/g, 'k')
       .replace(/z/g, 's').replace(/h/g, '')
       .replace(/ss/g, 's').replace(/(.)\1+/g, '$1');
  return s;
}

// Distância de edição com transposição (Damerau-Levenshtein restrita)
function buscaDist_(a, b) {
  var la = a.length, lb = b.length, i, j;
  if (!la) return lb; if (!lb) return la;
  var d = [];
  for (i = 0; i <= la; i++) { d[i] = [i]; }
  for (j = 0; j <= lb; j++) { d[0][j] = j; }
  for (i = 1; i <= la; i++) {
    for (j = 1; j <= lb; j++) {
      var c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[la][lb];
}

function buscaSimTok_(q, g) {
  if (q === g) return 1;
  var fq = buscaFonetica_(q), fg = buscaFonetica_(g);
  if (fq === fg) return 0.95;
  var best = 0;
  if (q.length >= 3 && g.indexOf(q) === 0) best = 0.80 + 0.15 * (q.length / g.length); // digitação incompleta
  var s1 = 1 - buscaDist_(q, g) / Math.max(q.length, g.length);
  var s2 = (1 - buscaDist_(fq, fg) / Math.max(fq.length, fg.length)) * 0.97;
  return Math.max(best, s1, s2);
}

/** Nota 0..1 de um convidado para a consulta (tokens já normalizados). */
function buscaNota_(qt, gt, extra) {
  var all = gt.concat(extra || []);
  var pairs = [], i, j;
  for (i = 0; i < qt.length; i++) for (j = 0; j < all.length; j++) {
    pairs.push({i: i, j: j, s: buscaSimTok_(qt[i], all[j])});
  }
  pairs.sort(function (a, b) { return b.s - a.s; });
  var usedQ = {}, usedG = {}, sum = 0, matchedNome = 0, matchedQ = 0;
  pairs.forEach(function (p) {
    if (usedQ[p.i] || usedG[p.j] || p.s < 0.6) return;
    usedQ[p.i] = 1; usedG[p.j] = 1; sum += p.s; matchedQ++;
    if (p.j < gt.length) matchedNome++;
  });
  if (matchedQ < 2) return 0;                       // exige ao menos 2 palavras coincidentes (nome + sobrenome)
  // palavra digitada sem par (ex.: sobrenome a mais) pesa meio ponto: vira sugestão, nunca "achei"
  var scoreQ = sum / (matchedQ + 0.5 * (qt.length - matchedQ));
  var cov = gt.length ? matchedNome / gt.length : 0; // nome completo vence nome parcial
  return scoreQ * (0.85 + 0.15 * cov);
}

/**
 * convidados: [{id, nome, dia, busca}]. Retorna {status, candidatos[]}
 * status: 'curto' | 'achei' | 'sugestoes' | 'nenhum'
 */
function buscarNome(consulta, convidados) {
  var qt = buscaNormalizar_(consulta);
  var letras = qt.join('').length;
  if (qt.length < 2 || letras < 5 || qt.some(function (w) { return w.length < 2; })) {
    return {status: 'curto', candidatos: []};
  }
  var lista = convidados.map(function (c) {
    return {c: c, nota: buscaNota_(qt, buscaNormalizar_(c.nome), buscaNormalizar_(c.busca))};
  }).filter(function (x) { return x.nota >= BUSCA_CFG.MIN_SUGESTAO; })
    .sort(function (a, b) { return b.nota - a.nota; });
  if (!lista.length) return {status: 'nenhum', candidatos: []};
  var top = lista[0], seg = lista[1];
  if (top.nota >= BUSCA_CFG.AUTO && (!seg || top.nota - seg.nota >= BUSCA_CFG.GAP)) {
    return {status: 'achei', candidatos: [top.c], notas: [top.nota]};
  }
  var sel = lista.slice(0, BUSCA_CFG.MAX_SUGESTOES);
  return {status: 'sugestoes', candidatos: sel.map(function (x) { return x.c; }), notas: sel.map(function (x) { return x.nota; })};
}

if (typeof module !== 'undefined') { module.exports = {buscarNome: buscarNome, buscaNormalizar_: buscaNormalizar_, buscaFonetica_: buscaFonetica_}; }

/**
 * Das Stammhaus Pub — Confirmação de presença dos CONVIDADOS (semana de inauguração) + métricas.
 * Web app (Apps Script) vinculado à planilha. Arquivos: Code.gs (único) + Index.html + Metricas.html
 */
function ss_() {
  var x = SpreadsheetApp.getActiveSpreadsheet();
  if (!x) throw new Error('DADOS: planilha não vinculada ao script (crie o script por Extensões > Apps Script dentro da planilha)');
  return x;
}

/* Página dos convidados (padrão) ou métricas (?p=metricas&k=TOKEN; o token é validado no servidor). */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.p === 'metricas') {
    var t = HtmlService.createTemplateFromFile('Metricas');
    t.k = String(p.k || '').replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 80);
    return t.evaluate().setTitle('Métricas · Das Stammhaus Pub')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (p.p === 'gestao') {
    var tg = HtmlService.createTemplateFromFile('Gestao');
    tg.k = String(p.k || '').replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 80);
    return tg.evaluate().setTitle('Gestão · Das Stammhaus Pub')
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
    .addItem('Atualizar painel de lotação', 'atualizarPainelMenu')
    .addItem('Gerar tokens de acesso (métricas)', 'gerarTokens')
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


/* ================= MÉTRICAS (acesso restrito por token individual) =================
 * Link: <URL do web app dos convidados>?p=metricas&k=TOKEN
 * Quem pode abrir: só quem tem uma linha ATIVA na aba "Acesso" (nome, token, ativo). Para revogar, ponha NÃO em "ativo" ou apague a linha. */
function acessoValido_(k) {
  k = String(k || '').replace(/[^A-Za-z0-9_\-]/g, '');
  if (k.length < 24) return null;
  var sh = ss_().getSheetByName(ABA.ACESSO), n = sh ? sh.getLastRow() : 0;
  if (n < 2) return null;
  var v = sh.getRange(2, 1, n - 1, 5).getValues();
  for (var i = 0; i < v.length; i++) {
    var ativo = String(v[i][2]).trim().toUpperCase();
    if (String(v[i][1]).trim() === k && ativo !== 'NÃO' && ativo !== 'NAO') return {linha: i + 2, nome: String(v[i][0])};
  }
  return null;
}

function fmtData_(d) { return Object.prototype.toString.call(d) === '[object Date]' ? Utilities.formatDate(d, TZ, 'dd/MM HH:mm') : ''; }

function metricas_(k) {
  if (!limite_('mt', 120, 60)) return {ok: false, code: 'limite'};
  var a = acessoValido_(k);
  if (!a) { if (!limite_('mtf', 30, 600)) return {ok: false, code: 'limite'}; return {ok: false, code: 'negado'}; }
  try { aba_(ABA.ACESSO).getRange(a.linha, 5).setValue(new Date()); } catch (e) {}
  var cfg = cfg_(), L = lotacaoTodas_(), resv = reservas_(), porDia = {};
  resv.forEach(function (r) {
    if (r.status !== 'Confirmado') return;
    var d = porDia[r.dia] = porDia[r.dia] || {}, g = d[r.prot] = d[r.prot] || {prot: r.prot, tel: r.titTel, nomes: []};
    g.nomes.push(r.nome);
  });
  var noites = L.map(function (c) {
    c.label = c.prog && c.prog.label || ('Dia ' + c.dia); c.atracao = c.prog && c.prog.atracao || ''; delete c.prog;
    c.receita = c.publico * cfg.valor;
    c.reservasLista = Object.keys(porDia[c.dia] || {}).map(function (p) { return porDia[c.dia][p]; });
    return c;
  });
  var tot = {lista: 0, publico: 0, total: 0, receita: 0, restantes: 0, reservas: 0};
  noites.forEach(function (c) { tot.lista += c.lista; tot.publico += c.publico; tot.total += c.total; tot.receita += c.receita; tot.restantes += c.restantes; tot.reservas += c.reservas; });
  // atividade recente: últimas gravações de convidados e do público
  var ev = [], shC = aba_(ABA.CONF), nC = shC.getLastRow();
  if (nC >= 2) shC.getRange(Math.max(2, nC - 14), 1, nC - Math.max(2, nC - 14) + 1, 13).getValues().forEach(function (r) {
    if (r[1]) ev.push({t: r[12] || r[0], tipo: 'Convidado', texto: (r[4] || r[2]) + ' · ' + r[9] + (r[9] === 'Confirmado' ? ' (' + r[8] + ' pessoa' + (r[8] > 1 ? 's' : '') + ')' : '') + ' · noite ' + r[3]});
  });
  var visto = {};
  resv.slice(-30).forEach(function (r) {
    if (r.n === 1) ev.push({t: r.ts, tipo: 'Público', texto: r.nome + ' · reserva ' + r.prot + ' · ' + r.status + ' · noite ' + r.dia});
  });
  ev.sort(function (x, y) { return (y.t instanceof Date ? y.t.getTime() : 0) - (x.t instanceof Date ? x.t.getTime() : 0); });
  ev = ev.slice(0, 12).map(function (e) { return {quando: fmtData_(e.t), tipo: e.tipo, texto: e.texto}; });
  return {ok: true, quem: a.nome, geradoEm: Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm:ss'), teto: cfg.teto, capacidade: cfg.capacidade,
          valor: cfg.valor, pendAc: cfg.pendAc, noites: noites, totais: tot, atividade: ev};
}
function metricas(k) { return api_('metricas', metricas_, arguments); }

/* ---------- configuração inicial (menu Stammhaus > Preparar reservas e métricas) ---------- */
function garantirAba_(nome, cab) {
  var ss = ss_(), sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
  if (sh.getLastRow() === 0 && cab) { sh.getRange(1, 1, 1, cab.length).setValues([cab]); try { sh.getRange(1, 1, 1, cab.length).setFontWeight('bold'); sh.setFrozenRows(1); } catch (e) {} }
  return sh;
}

function gerarTokensCore_() {
  var sh = garantirAba_(ABA.ACESSO, ['nome', 'token', 'ativo', 'criado em', 'último acesso', 'link (cole no WhatsApp)', 'gestão (SIM/NÃO)', 'link da gestão']);
  sh.getRange(1, 7, 1, 2).setValues([['gestão (SIM/NÃO)', 'link da gestão']]);
  var n = sh.getLastRow(), base = String(cfg_().urlApp || '').trim();
  var feitos = [];
  if (n < 2) return feitos;
  var v = sh.getRange(2, 1, n - 1, 3).getValues();
  v.forEach(function (r, i) {
    if (!String(r[0]).trim()) return;
    var li = i + 2, tok = String(r[1]).trim();
    if (!tok) {
      tok = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 44);
      sh.getRange(li, 2, 1, 4).setValues([[tok, 'SIM', new Date(), '']]);
      feitos.push(String(r[0]));
    }
    sh.getRange(li, 6).setValue(base ? base + '?p=metricas&k=' + tok : 'PREENCHA url_app_convidados NA ABA Config');
    var gs = String(sh.getRange(li, 7).getValue()).trim().toUpperCase();
    sh.getRange(li, 8).setValue(gs === 'SIM' && base ? base + '?p=gestao&k=' + tok : '');
  });
  return feitos;
}
function gerarTokens() {
  var f = gerarTokensCore_();
  SpreadsheetApp.getUi().alert(f.length ? 'Tokens criados para: ' + f.join(', ') + '.\nO link de cada pessoa está na coluna F da aba Acesso.' : 'Nenhuma linha nova: preencha o nome na coluna A (sem token) e rode de novo.');
}
function atualizarPainelMenu() { atualizarPainelSeguro_(); }

function prepararReservas() {
  var sc = ss_().getSheetByName(ABA.CFG);
  if (!sc) throw new Error('ABA_AUSENTE: ' + ABA.CFG);
  var existentes = {}; lerConfig_().forEach(function (r) { if (r[0]) existentes[String(r[0]).trim()] = 1; });
  [['teto_por_noite', 81, 'Teto de pessoas por noite: 74 + 10%. Lista garantida + reservas do público; ao chegar nesse número a noite aparece como LOTADA.'],
   ['valor_ingresso', 40, 'R$ por pessoa (público geral), pago junto à quitação da comanda na noite.'],
   ['max_pessoas_reserva', 4, 'Máximo de pessoas por reserva do público.'],
   ['reserva_valida_ate', '20h', 'Texto exibido: a reserva vale só até esse horário.'],
   ['url_app_convidados', 'https://script.google.com/macros/s/AKfycbx3wEPWFrKRAjefiG9RLPOqeLPZHeCSnlu551adkqPNJHWbzldQOuhEFcSiqq6ylf-RDw/exec', 'Endereço (/exec) do app dos convidados; usado para montar os links de métricas na aba Acesso.'],
   ['pendente_conta_acompanhante', 'SIM', 'SIM: convidado sem resposta conta titular + acompanhante a que tem direito. NAO: conta só o titular.']
  ].forEach(function (x) {
    if (existentes[x[0]]) return;
    var l = sc.getLastRow() + 1; sc.getRange(l, 1, 1, 3).setValues([x]);
    try { sc.getRange(l, 2).setBackground('#FFFF00').setFontColor('#0000FF'); } catch (e) {}
  });
  garantirAba_(ABA.RES, ['data/hora', 'protocolo', 'dia', 'nº da pessoa', 'nome', 'celular', 'status', 'celular do titular', 'consentimento', 'compareceu', 'atualizado']);
  var ac = garantirAba_(ABA.ACESSO, ['nome', 'token', 'ativo', 'criado em', 'último acesso', 'link (cole no WhatsApp)']);
  if (ac.getLastRow() < 2) { ac.getRange(2, 1).setValue('Felipe'); ac.getRange(2, 7).setValue('SIM'); }
  gerarTokensCore_();
  atualizarPainelSeguro_();
  var tem = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'atualizarPainelMenu'; });
  if (!tem) ScriptApp.newTrigger('atualizarPainelMenu').timeBased().everyMinutes(5).create();
}

/* ---------- PAINEL DE GESTÃO (?p=gestao&k=TOKEN) ----------
 * Acesso: token da aba Acesso COM a coluna "gestão (SIM/NÃO)" = SIM. Toda gravação passa por aqui, sob lock,
 * e fica registrada na aba Auditoria (quem, quando, o quê). Mudanças que estouram o teto de 81 só passam com "forcar". */

function acessoGestao_(k) {
  var a = acessoValido_(k);
  if (!a) return null;
  var g = String(aba_(ABA.ACESSO).getRange(a.linha, 7).getValue()).trim().toUpperCase();
  a.gestao = (g === 'SIM');
  return a;
}

function aud_(a, acao, det) {
  try { garantirAba_('Auditoria', ['data/hora', 'quem', 'ação', 'detalhe']).appendRow([new Date(), a.nome, acao, String(det).slice(0, 400)]); } catch (e) {}
}

function normG_(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }

function convFull_() {
  var sh = aba_(ABA.CONV), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, 6).getValues().map(function (r, i) {
    return {linha: i + 2, id: String(r[0]), nome: String(r[1]).trim(), dia: Number(r[2]), estilo: String(r[3]), grupo: String(r[4]), acomp: Number(r[5]) === 1 ? 1 : 0};
  }).filter(function (c) { return c.id; });
}

function ultConf_(id, confs) {
  var u = null;
  confs.forEach(function (c) { if (c.id === id && c.status !== 'Substituído') u = c; });
  return u;
}

function estadoGestao_(a) {
  var cfg = cfg_(), prog = prog_(), conv = convFull_(), confs = confs_(), resv = reservas_();
  var leve = conv.map(function (c) { return {id: c.id, dia: c.dia, acomp: c.acomp}; });
  var noites = Object.keys(prog).map(Number).sort().map(function (d) {
    var c = contagem_(d, cfg, leve, confs, resv);
    c.label = prog[d].label; c.atracao = prog[d].atracao; c.estilo = prog[d].estilo; c.receita = c.publico * cfg.valor;
    return c;
  });
  var convidados = conv.map(function (c) {
    var u = ultConf_(c.id, confs), st = !u ? 'Pendente' : (u.status === 'Confirmado' ? 'Confirmado' : 'Não vai');
    return {id: c.id, nome: c.nome, dia: c.dia, grupo: c.grupo, acomp: c.acomp, status: st, pessoas: u && st === 'Confirmado' ? u.pessoas : 0,
            titNome: u ? u.titNome : '', titTel: u ? u.titTel : '', acNome: u ? u.acNome : '', acTel: u ? u.acTel : ''};
  });
  var gr = {}, ordem = [];
  resv.forEach(function (r) {
    if (r.status !== 'Confirmado') return;
    var g = gr[r.prot];
    if (!g) { g = gr[r.prot] = {prot: r.prot, dia: r.dia, titTel: r.titTel, pessoas: []}; ordem.push(r.prot); }
    g.pessoas.push({linha: r.linha, nome: r.nome, tel: r.tel});
  });
  var aud = [], sa = ss_().getSheetByName('Auditoria'), na = sa ? sa.getLastRow() : 0;
  if (na >= 2) {
    var ini = Math.max(2, na - 14);
    sa.getRange(ini, 1, na - ini + 1, 4).getValues().reverse().forEach(function (r) {
      aud.push({quando: fmtData_(r[0]), quem: String(r[1]), acao: String(r[2]), det: String(r[3])});
    });
  }
  return {ok: true, quem: a.nome, geradoEm: Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm:ss'), teto: cfg.teto, capacidade: cfg.capacidade,
          valor: cfg.valor, maxPessoas: cfg.maxPessoas, pendAc: cfg.pendAc, noites: noites, convidados: convidados,
          reservas: ordem.map(function (p) { return gr[p]; }), auditoria: aud};
}

function gestaoAbrir_(k) {
  if (!limite_('gt', 240, 60)) return {ok: false, code: 'limite'};
  var a = acessoGestao_(k);
  if (!a) { if (!limite_('gtf', 30, 600)) return {ok: false, code: 'limite'}; return {ok: false, code: 'negado'}; }
  if (!a.gestao) return {ok: false, code: 'sem_permissao'};
  return estadoGestao_(a);
}
function gestao(k) { return api_('gestao', gestaoAbrir_, arguments); }

/* executa uma alteração: valida acesso, trava, roda fn(a, ctx) e devolve o estado atualizado */
function gMut_(k, nome, fn) {
  if (!limite_('gm', 90, 60)) return {ok: false, code: 'limite'};
  var a = acessoGestao_(k);
  if (!a || !a.gestao) return {ok: false, code: a ? 'sem_permissao' : 'negado'};
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var r = fn(a);
    if (r && r.ok === false) return r;
    SpreadsheetApp.flush();
    atualizarPainelSeguro_();
    var e = estadoGestao_(a); if (r && r.info) e.info = r.info;
    return e;
  } finally { lock.releaseLock(); }
}

function gDiaValido_(dia) { var p = prog_(); return p[Number(dia)] ? Number(dia) : 0; }
function gTotalNoite_(dia) { return contagem_(dia, cfg_(), convLeve_(), confs_(), reservas_()).total; }
function gLotado_(dia, add, forcar) {
  var t = gTotalNoite_(dia), teto = cfg_().teto;
  if (add > 0 && t + add > teto && !forcar) return {ok: false, code: 'lotado', total: t, teto: teto, adicional: add};
  return null;
}
function gAppendConf_(sh, vals) {
  var linha = proximaLinha_(sh);
  if (linha > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
  sh.getRange(linha, 1, 1, 13).setValues([vals]);
  return linha;
}
function gTelOk_(t, obrig) { t = String(t || '').trim(); return t ? TEL_RE.test(t) : !obrig; }

/* ===== convidados da lista ===== */
function gMoverConvidado(k, id, dia, forcar) {
  return api_('gMoverConvidado', function () {
    return gMut_(k, 'mover', function (a) {
      dia = gDiaValido_(dia); if (!dia) return {ok: false, code: 'dia_invalido'};
      var g = convFull_().filter(function (c) { return c.id === String(id); })[0];
      if (!g) return {ok: false, code: 'nao_encontrado'};
      if (g.dia === dia) return {ok: false, code: 'mesmo_dia'};
      var cfg = cfg_(), confs = confs_(), contrib = contribConv_({id: g.id, acomp: g.acomp}, confs, cfg);
      var bl = gLotado_(dia, contrib, forcar); if (bl) return bl;
      aba_(ABA.CONV).getRange(g.linha, 3).setValue(dia);
      var sh = aba_(ABA.CONF);
      confs.forEach(function (c) { if (c.id === g.id) sh.getRange(c.linha, 4).setValue(dia); });
      aud_(a, 'Moveu convidado', g.nome + ' (' + g.id + '): noite ' + g.dia + ' → ' + dia + (forcar ? ' [acima do teto, forçado]' : ''));
      return {ok: true};
    });
  }, arguments);
}

function gAddConvidado(k, p, forcar) {
  return api_('gAddConvidado', function () {
    return gMut_(k, 'add', function (a) {
      var nome = limpaNome_(p && p.nome), dia = gDiaValido_(p && p.dia), acomp = Number(p && p.acomp) === 1 ? 1 : 0;
      if (!NOME_RE.test(nome) || nome.split(' ').length < 2) return {ok: false, code: 'invalido', campo: 'nome', msg: 'Informe nome e sobrenome.'};
      if (!dia) return {ok: false, code: 'dia_invalido'};
      var conv = convFull_(), nn = normG_(nome);
      if (!forcar && conv.some(function (c) { return normG_(c.nome) === nn; })) return {ok: false, code: 'duplicado'};
      var bl = gLotado_(dia, 1 + (cfg_().pendAc ? acomp : 0), forcar); if (bl) return bl;
      var max = 0; conv.forEach(function (c) { var m = /^G(\d+)$/.exec(c.id); if (m) max = Math.max(max, Number(m[1])); });
      var id = 'G' + ('000' + (max + 1)).slice(-3), sh = aba_(ABA.CONV), ult = sh.getLastRow(), nl = ult + 1, pr = prog_()[dia] || {};
      sh.getRange(nl, 1, 1, 6).setValues([[id, nome, dia, String(p.estilo || pr.estilo || ''), String(p.grupo || 'Gestão').slice(0, 40), acomp]]);
      try { var f = sh.getRange(ult, 8, 1, 2); if (ult >= 2 && f.getFormulas()[0].some(function (x) { return x; })) f.copyTo(sh.getRange(nl, 8, 1, 2)); } catch (e) {}
      aud_(a, 'Incluiu convidado', nome + ' (' + id + ') na noite ' + dia + (acomp ? ' · com acompanhante' : '') + (forcar ? ' [forçado]' : ''));
      return {ok: true};
    });
  }, arguments);
}

function gEditarConvidado(k, id, p) {
  return api_('gEditarConvidado', function () {
    return gMut_(k, 'editar', function (a) {
      var g = convFull_().filter(function (c) { return c.id === String(id); })[0];
      if (!g) return {ok: false, code: 'nao_encontrado'};
      var nome = limpaNome_(p && p.nome), acomp = Number(p && p.acomp) === 1 ? 1 : 0;
      if (!NOME_RE.test(nome) || nome.split(' ').length < 2) return {ok: false, code: 'invalido', campo: 'nome', msg: 'Informe nome e sobrenome.'};
      var u = ultConf_(g.id, confs_());
      if (!acomp && u && u.status === 'Confirmado' && u.pessoas > 1) return {ok: false, code: 'tem_acompanhante'};
      var sh = aba_(ABA.CONV);
      sh.getRange(g.linha, 2).setValue(nome); sh.getRange(g.linha, 6).setValue(acomp);
      if (p && p.grupo !== undefined) sh.getRange(g.linha, 5).setValue(String(p.grupo).slice(0, 40));
      aud_(a, 'Editou convidado', g.id + ': "' + g.nome + '" → "' + nome + '", acompanhante ' + g.acomp + ' → ' + acomp);
      return {ok: true};
    });
  }, arguments);
}

/* acao: 'pendente' (volta a sem resposta) · 'nao_vai' · 'confirmar' (p: titNome, titTel, acNome, acTel) */
function gStatusConvidado(k, id, acao, p, forcar) {
  return api_('gStatusConvidado', function () {
    return gMut_(k, 'status', function (a) {
      var g = convFull_().filter(function (c) { return c.id === String(id); })[0];
      if (!g) return {ok: false, code: 'nao_encontrado'};
      var cfg = cfg_(), confs = confs_(), shC = aba_(ABA.CONF), agora = new Date();
      var atual = contribConv_({id: g.id, acomp: g.acomp}, confs, cfg), novo, dados = null;
      if (acao === 'pendente') novo = 1 + (cfg.pendAc ? g.acomp : 0);
      else if (acao === 'nao_vai') novo = 0;
      else if (acao === 'confirmar') {
        var tn = limpaNome_(p && p.titNome) || g.nome, tt = String(p && p.titTel || '').trim(), an = limpaNome_(p && p.acNome), at = String(p && p.acTel || '').trim();
        if (!NOME_RE.test(tn)) return {ok: false, code: 'invalido', campo: 'titNome', msg: 'Nome do convidado inválido.'};
        if (!gTelOk_(tt, false)) return {ok: false, code: 'invalido', campo: 'titTel', msg: 'Celular no formato (42) 99999-9999 (ou deixe em branco).'};
        if (an) {
          if (!g.acomp) return {ok: false, code: 'invalido', campo: 'acNome', msg: 'Este convite não inclui acompanhante (edite o convidado antes).'};
          if (!NOME_RE.test(an)) return {ok: false, code: 'invalido', campo: 'acNome', msg: 'Nome do acompanhante inválido.'};
          if (!gTelOk_(at, false)) return {ok: false, code: 'invalido', campo: 'acTel', msg: 'Celular do acompanhante inválido.'};
        }
        dados = {titNome: tn, titTel: tt, acNome: an, acTel: an ? at : ''}; novo = an ? 2 : 1;
      } else return {ok: false, code: 'acao_invalida'};
      var bl = gLotado_(g.dia, novo - atual, forcar); if (bl) return bl;
      confs.forEach(function (c) {
        if (c.id === g.id && c.status !== 'Substituído') { shC.getRange(c.linha, 10).setValue('Substituído'); shC.getRange(c.linha, 13).setValue(agora); }
      });
      if (acao === 'nao_vai') gAppendConf_(shC, [agora, g.id, g.nome, g.dia, g.nome, '', '', '', 0, STATUS_NAO, 'Registrado pela gestão (' + a.nome + ')', '', agora]);
      if (acao === 'confirmar') gAppendConf_(shC, [agora, g.id, g.nome, g.dia, dados.titNome, dados.titTel, dados.acNome, dados.acTel, novo, 'Confirmado',
        'Registrado pela gestão (' + a.nome + ')', '', agora]);
      aud_(a, 'Status do convidado', g.nome + ' (' + g.id + ', noite ' + g.dia + '): ' + acao + (acao === 'confirmar' ? ' · ' + novo + ' pessoa(s)' : '') + (forcar ? ' [forçado]' : ''));
      return {ok: true};
    });
  }, arguments);
}

/* ===== reservas do público ===== */
function gReservaLinhas_(prot) {
  return reservas_().filter(function (r) { return r.prot === String(prot) && r.status === 'Confirmado'; });
}

function gReservaMover(k, prot, dia, forcar) {
  return api_('gReservaMover', function () {
    return gMut_(k, 'rmover', function (a) {
      dia = gDiaValido_(dia); if (!dia) return {ok: false, code: 'dia_invalido'};
      var rows = gReservaLinhas_(prot); if (!rows.length) return {ok: false, code: 'nao_encontrado'};
      if (rows[0].dia === dia) return {ok: false, code: 'mesmo_dia'};
      var bl = gLotado_(dia, rows.length, forcar); if (bl) return bl;
      var sh = aba_(ABA.RES), agora = new Date();
      reservas_().forEach(function (r) { if (r.prot === String(prot)) { sh.getRange(r.linha, 3).setValue(dia); sh.getRange(r.linha, 11).setValue(agora); } });
      aud_(a, 'Moveu reserva', prot + ' (' + rows.length + ' pessoa(s)): noite ' + rows[0].dia + ' → ' + dia + (forcar ? ' [forçado]' : ''));
      return {ok: true};
    });
  }, arguments);
}

function gReservaCancelar(k, prot) {
  return api_('gReservaCancelar', function () {
    return gMut_(k, 'rcancelar', function (a) {
      var rows = gReservaLinhas_(prot); if (!rows.length) return {ok: false, code: 'nao_encontrado'};
      var sh = aba_(ABA.RES), agora = new Date();
      rows.forEach(function (r) { sh.getRange(r.linha, 7).setValue('Cancelado'); sh.getRange(r.linha, 11).setValue(agora); });
      aud_(a, 'Cancelou reserva', prot + ' (' + rows.map(function (r) { return r.nome; }).join(', ') + ')');
      return {ok: true};
    });
  }, arguments);
}

/* editar pessoa: linha informada · adicionar pessoa: linha vazia + prot */
function gReservaPessoa(k, prot, linha, nome, tel, forcar) {
  return api_('gReservaPessoa', function () {
    return gMut_(k, 'rpessoa', function (a) {
      nome = limpaNome_(nome); tel = String(tel || '').trim();
      if (!NOME_RE.test(nome) || nome.split(' ').length < 2) return {ok: false, code: 'invalido', campo: 'nome', msg: 'Informe nome e sobrenome.'};
      if (!gTelOk_(tel, true)) return {ok: false, code: 'invalido', campo: 'tel', msg: 'Celular no formato (42) 99999-9999.'};
      var rows = gReservaLinhas_(prot); if (!rows.length) return {ok: false, code: 'nao_encontrado'};
      var sh = aba_(ABA.RES), agora = new Date();
      var outros = rows.filter(function (r) { return String(r.linha) !== String(linha); });
      if (outros.some(function (r) { return digitos_(r.tel) === digitos_(tel); })) return {ok: false, code: 'invalido', campo: 'tel', msg: 'Cada pessoa precisa de um celular próprio.'};
      if (linha) {
        var r0 = rows.filter(function (r) { return String(r.linha) === String(linha); })[0]; if (!r0) return {ok: false, code: 'nao_encontrado'};
        sh.getRange(r0.linha, 5, 1, 2).setValues([[nome, tel]]); sh.getRange(r0.linha, 11).setValue(agora);
        aud_(a, 'Editou pessoa da reserva', prot + ': "' + r0.nome + '" → "' + nome + '"');
      } else {
        if (rows.length >= cfg_().maxPessoas && !forcar) return {ok: false, code: 'max_pessoas', max: cfg_().maxPessoas};
        var bl = gLotado_(rows[0].dia, 1, forcar); if (bl) return bl;
        var nl = proximaLinha_(sh); if (nl > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
        var n = Math.max.apply(null, rows.map(function (r) { return r.n; })) + 1;
        sh.getRange(nl, 1, 1, 11).setValues([[agora, String(prot), rows[0].dia, n, nome, tel, 'Confirmado', rows[0].titTel, 'Registrado pela gestão (' + a.nome + ')', '', agora]]);
        aud_(a, 'Incluiu pessoa na reserva', prot + ': ' + nome + (forcar ? ' [forçado]' : ''));
      }
      return {ok: true};
    });
  }, arguments);
}

function gReservaRemoverPessoa(k, prot, linha) {
  return api_('gReservaRemoverPessoa', function () {
    return gMut_(k, 'rrem', function (a) {
      var rows = gReservaLinhas_(prot), r0 = rows.filter(function (r) { return String(r.linha) === String(linha); })[0];
      if (!r0) return {ok: false, code: 'nao_encontrado'};
      if (rows.length < 2) return {ok: false, code: 'ultima_pessoa'};
      var sh = aba_(ABA.RES); sh.getRange(r0.linha, 7).setValue('Cancelado'); sh.getRange(r0.linha, 11).setValue(new Date());
      aud_(a, 'Removeu pessoa da reserva', prot + ': ' + r0.nome);
      return {ok: true};
    });
  }, arguments);
}

/* nova reserva feita pela equipe: pessoas = [{nome, tel}] */
function gReservaNova(k, dia, pessoas, forcar) {
  return api_('gReservaNova', function () {
    return gMut_(k, 'rnova', function (a) {
      dia = gDiaValido_(dia); if (!dia) return {ok: false, code: 'dia_invalido'};
      pessoas = (pessoas || []).filter(function (x) { return x && (x.nome || x.tel); });
      var cfg = cfg_();
      if (!pessoas.length) return {ok: false, code: 'invalido', campo: 'nome', msg: 'Informe ao menos uma pessoa.'};
      if (pessoas.length > cfg.maxPessoas && !forcar) return {ok: false, code: 'max_pessoas', max: cfg.maxPessoas};
      var tels = {}, ativos = {};
      reservas_().forEach(function (r) { if (r.status === 'Confirmado') ativos[digitos_(r.tel)] = r.prot; });
      for (var i = 0; i < pessoas.length; i++) {
        var n = limpaNome_(pessoas[i].nome), t = String(pessoas[i].tel || '').trim();
        if (!NOME_RE.test(n) || n.split(' ').length < 2) return {ok: false, code: 'invalido', campo: 'nome' + i, msg: 'Pessoa ' + (i + 1) + ': informe nome e sobrenome.'};
        if (!gTelOk_(t, true)) return {ok: false, code: 'invalido', campo: 'tel' + i, msg: 'Pessoa ' + (i + 1) + ': celular no formato (42) 99999-9999.'};
        var d = digitos_(t);
        if (tels[d]) return {ok: false, code: 'invalido', campo: 'tel' + i, msg: 'Cada pessoa precisa de um celular próprio.'};
        if (ativos[d] && !forcar) return {ok: false, code: 'tel_duplicado', msg: 'O celular da pessoa ' + (i + 1) + ' já está na reserva ' + ativos[d] + '.'};
        tels[d] = 1; pessoas[i] = {nome: n, tel: t};
      }
      var bl = gLotado_(dia, pessoas.length, forcar); if (bl) return bl;
      var sh = aba_(ABA.RES), agora = new Date(), l0 = proximaLinha_(sh), prot = 'R' + l0, titTel = pessoas[0].tel;
      if (l0 + pessoas.length > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
      sh.getRange(l0, 1, pessoas.length, 11).setValues(pessoas.map(function (x, i) {
        return [agora, prot, dia, i + 1, x.nome, x.tel, 'Confirmado', titTel, 'Registrado pela gestão (' + a.nome + ')', '', agora];
      }));
      aud_(a, 'Criou reserva', prot + ' na noite ' + dia + ': ' + pessoas.map(function (x) { return x.nome; }).join(', ') + (forcar ? ' [forçado]' : ''));
      return {ok: true, info: {protocolo: prot}};
    });
  }, arguments);
}
