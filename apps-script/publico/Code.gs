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
    maxPessoas: Math.max(1, Math.min(Math.floor(Number(o.max_pessoas_reserva)) || 10, 20)),   // hiperparâmetro (aba Config): pessoas por reserva do público; padrão 10, limite de segurança 20
    reservaAte: String(o.reserva_valida_ate || '20h').trim(),
    confirmarAte: String(o.confirmar_ate || '14h').trim(),   // prazo pedido no lembrete de confirmação (meio-dia do dia do evento)
    urlApp: String(o.url_app_convidados || '').trim(),
    pendAc: String(o.pendente_conta_acompanhante || 'SIM').trim().toUpperCase() !== 'NAO',
    whatsapp: String(o.whatsapp_contato || '').trim(),
    horario: String(o.horario || '').trim(),
    waAtivo: String(o.whatsapp_ativo || 'NAO').trim().toUpperCase() === 'SIM',
    reservaDias: Math.max(1, Math.min(Math.floor(Number(o.reserva_antecedencia_dias)) || 30, 365)),   // janela de reservas do público: hoje + N dias (padrão 30)
    tetos: tetosExcecao_()                                // exceções por noite (Programacao, coluna L): sobrepõem o teto padrão
  };
}

/* Lotação manual por noite: Programacao, coluna L ("lotação desta noite"). Vazio = usa teto_por_noite da Config. */
var PROG_COL_TETO = 12, PROG_COL_REF = 13, PROG_COL_SIT = 14, PROG_COL_SHOW = 15;   // 15 = horário do show (HH:MM; vazio = padrão pelo dia da semana)
/* padrão do show: quarta e quinta 20:30; sexta e sábado 21:30 (outros dias: sem padrão) */
function showPadrao_(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); if (!m) return ''; var w = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay(); return (w === 3 || w === 4) ? '20:30' : (w === 5 || w === 6) ? '21:30' : ''; }
function showNorm_(v) { var m = /^\s*(\d{1,2})\s*[:hH]\s*(\d{2})?\s*$/.exec(String(v == null ? '' : v)); if (!m) return ''; var h = +m[1], mi = m[2] ? +m[2] : 0; return h > 23 || mi > 59 ? '' : ('0' + h).slice(-2) + ':' + ('0' + mi).slice(-2); }   // 13 = refeição (SIM/vazio), 14 = situação (ABERTO/FECHADO/vazio = padrão pelo dia da semana)
/* padrão da casa: domingo, segunda e terça fechados; uma linha com atração ou com situação ABERTO é exceção */
function padraoFechado_(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); if (!m) return false; var w = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay(); return w === 0 || w === 1 || w === 2; }
function isoMais_(iso, n) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n)); return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }
function tetosExcecao_() {
  var m = {};
  try {
    var sh = aba_(ABA.PROG), n = sh.getLastRow();
    if (n < 2 || sh.getMaxColumns() < PROG_COL_TETO) return m;
    sh.getRange(2, 1, n - 1, PROG_COL_TETO).getValues().forEach(function (r) {
      var t = Math.floor(Number(r[PROG_COL_TETO - 1]));
      if (r[0] && t > 0) m[Number(r[0])] = t;
    });
  } catch (e) {}
  return m;
}
function tetoDe_(cfg, dia) { return (cfg.tetos && cfg.tetos[dia]) || cfg.teto; }

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
  var teto = tetoDe_(cfg, dia), o = {dia: dia, teto: teto, padrao: cfg.teto, excecao: teto !== cfg.teto, capacidade: cfg.capacidade, convites: 0, confirmadosPessoas: 0, pendentesConvites: 0,
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
  o.restantes = Math.max(0, teto - o.total);
  o.lotado = o.total >= teto;
  o.pct = teto ? Math.round(1000 * o.total / teto) / 10 : 0;
  return o;
}

function lotacaoTodas_() {
  var cfg = cfg_(), prog = prog_(), conv = convLeve_(), confs = confs_(), resv = reservas_();
  return ordemDias_(prog).map(function (d) { var c = contagem_(d, cfg, conv, confs, resv); c.prog = prog[d]; return c; });
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

/* Programacao: A dia (chave) · B data · C atração · D estilo · E instagram · F reservas do público (SIM/NÃO; vazio = SIM).
 * Chave "dia": nas 4 noites da inauguração é o dia do mês (18 a 21); para qualquer outra data é AAAAMMDD (ex.: 20261205). */
function ordemDias_(prog) {
  return Object.keys(prog).map(Number).sort(function (a, b) { var x = prog[a].iso || '', y = prog[b].iso || ''; return x < y ? -1 : x > y ? 1 : a - b; });
}
function chaveDeIso_(iso, prog) {
  var p = prog || prog_();
  for (var d in p) { if (p[d].iso === iso) return Number(d); }
  return Number(String(iso).replace(/-/g, ''));
}
function prog_() {
  var sh = aba_(ABA.PROG), n = sh.getLastRow(), m = {};
  if (n < 2) return m;
  var tz = TZ; try { tz = ss_().getSpreadsheetTimeZone() || TZ; } catch (e0) {}
  var ext = []; try { var mcx = sh.getMaxColumns(); if (mcx >= PROG_COL_REF) ext = sh.getRange(2, PROG_COL_REF, n - 1, Math.min(3, mcx - PROG_COL_TETO)).getValues(); } catch (e1) {}
  sh.getRange(2, 1, n - 1, 6).getValues().forEach(function (r, ix) {
    if (!r[0]) return;
    var key = Number(r[0]), v = r[1], p = null, ee = ext[ix] || ['', '', ''];
    if (Object.prototype.toString.call(v) === '[object Date]') {
      /* a data da célula é um instante à meia-noite no fuso DA PLANILHA; formatar em outro fuso desloca o dia.
         autocorrição: a chave (dia do mês ou AAAAMMDD) é a verdade; se o fuso deslocou o dia, testa ±12h */
      var cand = [0, 12, -12];
      for (var k = 0; k < cand.length && !p; k++) {
        var q = Utilities.formatDate(new Date(v.getTime() + cand[k] * 3600000), tz, 'yyyy-MM-dd').split('-');
        if (key >= 10000000 ? Number(q.join('')) === key : Number(q[2]) === key) p = q;
      }
      if (!p) p = Utilities.formatDate(v, tz, 'yyyy-MM-dd').split('-');
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(String(v).trim())) p = String(v).trim().split('-');
    else if (key >= 10000000) { var ks = String(key); p = [ks.slice(0, 4), ks.slice(4, 6), ks.slice(6, 8)]; }
    var sem = '', dm = '';
    if (p) { sem = DIAS_SEMANA[new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay() || 7]; dm = p[2] + '/' + p[1]; }
    m[key] = {
      dia: key, linha: ix + 2,
      label: p ? sem.charAt(0).toUpperCase() + sem.slice(1) + ', ' + dm : 'Dia ' + r[0],
      iso: p ? p[0] + '-' + p[1] + '-' + p[2] : '',
      atracao: String(r[2] || ''), estilo: String(r[3] || ''), instagram: String(r[4] || ''),
      pub: !/^N/i.test(String(r[5] || '').trim()),
      refeicao: /^S/i.test(String(ee[0] || '').trim())
    };
    m[key].showCustom = showNorm_(ee[2]);
    var sit = String(ee[1] || '').trim().toUpperCase(), isoP = m[key].iso;
    m[key].aberto = sit === 'FECHADO' ? false : sit === 'ABERTO' ? true : (m[key].atracao ? true : !padraoFechado_(isoP));
    m[key].showPadrao = showPadrao_(isoP); m[key].show = m[key].showCustom || m[key].showPadrao;
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


/* ---------- FILA DO WHATSAPP (aba "Whats") ----------
 * Quem grava uma confirmação/reserva só ENFILEIRA (status PENDENTE); o envio é feito pelo projeto público
 * (processarFilaWhats, gatilho de 1 min). Só enfileira se Config whatsapp_ativo = SIM. Nunca derruba a gravação. */
var WA_CAB = ['data/hora', 'origem', 'ref', 'dia', 'nome', 'celular', 'status', 'tentativas', 'wamid', 'detalhe', 'atualizado'];
function abaWa_() {
  var ss = ss_(), sh = ss.getSheetByName('Whats') || ss.insertSheet('Whats');
  if (sh.getLastRow() === 0) { sh.getRange(1, 1, 1, WA_CAB.length).setValues([WA_CAB]); try { sh.getRange(1, 1, 1, WA_CAB.length).setFontWeight('bold'); sh.setFrozenRows(1); } catch (e) {} }
  return sh;
}
function waChave_(o, ref, dia, nome, tel) { return [o, ref, dia, String(nome).toLowerCase().replace(/\s+/g, ' ').trim(), digitos_(tel)].join('|'); }
/* origem: 'R' (reserva do público, ref = protocolo) ou 'C' (convidado, ref = id); pessoas: [{nome, tel}] */
function enfileirarWhats_(origem, ref, dia, pessoas) {
  try {
    if (!cfg_().waAtivo) return 0;
    var sh = abaWa_(), n = sh.getLastRow(), tem = {}, agora = new Date();
    if (n >= 2) sh.getRange(2, 1, n - 1, 7).getValues().forEach(function (r) {
      if (r[6] !== 'FALHOU' && r[6] !== 'CANCELADO') tem[waChave_(r[1], r[2], r[3], r[4], r[5])] = 1;
    });
    var novos = [];
    pessoas.forEach(function (p) {
      if (!p || !p.nome) return;
      var k = waChave_(origem, ref, dia, p.nome, p.tel);
      if (tem[k]) return; tem[k] = 1;
      novos.push([agora, origem, String(ref), Number(dia), String(p.nome), String(p.tel || ''), digitos_(p.tel) ? 'PENDENTE' : 'SEM_NUMERO', 0, '', '', agora]);
    });
    if (novos.length) sh.getRange(sh.getLastRow() + 1, 1, novos.length, WA_CAB.length).setValues(novos);
    return novos.length;
  } catch (e) { try { console.error('whats fila: ' + e.message); } catch (_) {} return 0; }
}
/* cancelamento/mudança de dia: o que ainda não foi enviado deixa de valer */
function cancelarFilaWhats_(origem, ref, dia) {
  try {
    var sh = ss_().getSheetByName('Whats'), n = sh ? sh.getLastRow() : 0;
    if (n < 2) return;
    sh.getRange(2, 1, n - 1, 7).getValues().forEach(function (r, i) {
      if (r[1] === origem && String(r[2]) === String(ref) && (dia == null || Number(r[3]) === Number(dia)) && r[6] === 'PENDENTE') sh.getRange(i + 2, 7).setValue('CANCELADO');
    });
  } catch (e) {}
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

/* programação pública (lida pelo site institucional): só dados já públicos, vindos da aba Programacao gerida pela equipe */
function programacaoPublica_() {
  var prog = prog_(), hoje = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  return {ok: true, noites: ordemDias_(prog).filter(function (d) { return prog[d].iso && prog[d].iso >= hoje && prog[d].aberto; }).map(function (d) {
    var p = prog[d]; return {iso: p.iso, label: p.label, atracao: p.atracao, estilo: p.estilo};
  })};
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
  return {valor: cfg.valor, ate: cfg.reservaAte, max: cfg.maxPessoas, whatsapp: cfg.whatsapp};
}

/* Noites, com situação (Disponível/Lotado). Não expõe contagens: só "vagas" até o máximo por reserva. */
function dados_() {
  var cfg = cfg_(), prog = prog_(), conv = convLeve_(), confs = confs_(), resv = reservas_();
  var hoje = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), lim = isoMais_(hoje, cfg.reservaDias);
  /* programação aberta e futura é exibida; só as noites dentro da janela (hoje + reserva_antecedencia_dias) aceitam reserva */
  var noites = ordemDias_(prog).filter(function (d) { return prog[d].pub && prog[d].aberto && prog[d].iso >= hoje; }).map(function (d) {
    var p = prog[d], res = p.iso <= lim;
    if (!res) { var ab = isoMais_(p.iso, -cfg.reservaDias).split('-'); return {dia: d, label: p.label, atracao: p.atracao, estilo: p.estilo, show: p.show, reservavel: false, abreEm: ab[2] + '/' + ab[1], lotado: false, vagas: 0}; }
    var c = contagem_(d, cfg, conv, confs, resv);
    return {dia: d, label: p.label, atracao: p.atracao, estilo: p.estilo, show: p.show, reservavel: true, lotado: c.lotado, vagas: Math.min(c.restantes, cfg.maxPessoas)};
  });
  return {ok: true, noites: noites, info: pubInfo_(cfg)};
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
    enfileirarWhats_('R', prot, v.dia, v.pessoas);
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

/* ---------- ENVIO DO INGRESSO POR WHATSAPP (API oficial da Meta) ----------
 * Projeto PÚBLICO. Lê a fila (aba "Whats"), gera a imagem do ingresso de cada pessoa a partir de um modelo no Google Slides,
 * salva no Drive (pasta 09-Agendamentos/AAAA-MM-DD), envia a mídia à Meta e dispara o template com a imagem no cabeçalho.
 * Configuração em Propriedades do Script (nunca no código): WA_TOKEN, WA_PHONE_ID, WA_TEMPLATE (padrão ingresso_confirmacao),
 * WA_IDIOMA (padrão pt_BR), WA_PASTA_RAIZ (id da pasta 09-Agendamentos). Liga/desliga: Config whatsapp_ativo = SIM/NAO. */

var WA_API = 'https://graph.facebook.com/v23.0/';
var WA_PASTA_PADRAO = '1V6KCyRei2MhHY-suw1e6kSMnpJpYZ0m7';   // 09-Agendamentos
var WA_MAX_TENT = 3;

function waProp_(k, padrao) { return PropertiesService.getScriptProperties().getProperty(k) || padrao || ''; }
function waPronto_() { return !!(waProp_('WA_TOKEN') && waProp_('WA_PHONE_ID')); }
function waNum_(tel) { var d = digitos_(tel); return d.length <= 11 ? '55' + d : d; }

/* ===== imagem do ingresso ===== */
var ING = {W: 1000, H: 520};   // pontos do slide (proporção ~1,92:1)

/* cria (uma vez) o modelo de ingresso de cada noite no Slides e guarda o id nas propriedades. Rodar manualmente. */
function criarModelosIngresso() {
  var prog = prog_(), cfg = cfg_(), props = PropertiesService.getScriptProperties();
  Object.keys(prog).map(Number).sort().forEach(function (d) {
    if (props.getProperty('WA_MODELO_' + d)) return;
    var r = UrlFetchApp.fetch('https://slides.googleapis.com/v1/presentations', {
      method: 'post', contentType: 'application/json', headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
      payload: JSON.stringify({title: 'Modelo ingresso · noite ' + d, pageSize: {width: {magnitude: ING.W, unit: 'PT'}, height: {magnitude: ING.H, unit: 'PT'}}})
    });
    var id = JSON.parse(r.getContentText()).presentationId, pres = SlidesApp.openById(id), s = pres.getSlides()[0];
    s.getPageElements().forEach(function (e) { try { e.remove(); } catch (_) {} });
    desenharModelo_(s, prog[d], cfg);
    pres.saveAndClose();
    props.setProperty('WA_MODELO_' + d, id);
  });
}

function caixa_(s, tipo, x, y, w, h, cor, texto, tam, fonte, negrito, alinha) {
  var sh = s.insertShape(tipo, x, y, w, h);
  sh.getFill().setSolidFill(cor || '#113325'); sh.getBorder().setTransparent();
  if (texto !== undefined) {
    sh.getFill().setTransparent();
    var t = sh.getText(); t.setText(texto);
    t.getTextStyle().setFontFamily(fonte || 'Inter').setFontSize(tam || 18).setBold(!!negrito).setForegroundColor(cor || '#EAE7DA');
    t.getParagraphStyle().setParagraphAlignment(alinha || SlidesApp.ParagraphAlignment.START);
  }
  return sh;
}

function desenharModelo_(s, p, cfg) {
  var R = SlidesApp.ShapeType.RECTANGLE, A = SlidesApp.ParagraphAlignment;
  s.getBackground().setSolidFill('#113325');
  var borda = s.insertShape(R, 18, 18, ING.W - 36, ING.H - 36); borda.getFill().setTransparent();
  borda.getBorder().getLineFill().setSolidFill('#B47E00'); borda.getBorder().setWeight(3);
  caixa_(s, R, 60, 46, ING.W - 120, 40, '#B47E00', 'DAS STAMMHAUS PUB · SEMANA DE INAUGURAÇÃO', 20, 'Playfair Display', true, A.CENTER);
  caixa_(s, R, 60, 110, ING.W - 120, 70, '#EAE7DA', 'INGRESSO', 54, 'Playfair Display', true, A.CENTER);
  caixa_(s, R, 60, 200, ING.W - 120, 60, '#EAE7DA', '{{NOME}}', 40, 'Playfair Display', true, A.CENTER);
  caixa_(s, R, 60, 275, ING.W - 120, 36, '#B47E00', '{{DIA}}', 26, 'Inter', true, A.CENTER);
  caixa_(s, R, 60, 315, ING.W - 120, 34, '#EAE7DA', '{{ATRACAO}}', 22, 'Inter', false, A.CENTER);
  caixa_(s, R, 60, 380, ING.W - 120, 30, '#EAE7DA', 'Protocolo {{PROT}} · válido até ' + (cfg.reservaAte || '20h') + ' · R$ ' + cfg.valor.toFixed(2).replace('.', ',') + ' na comanda', 18, 'Inter', false, A.CENTER);
  caixa_(s, R, 60, 440, ING.W - 120, 30, '#B47E00', 'O QUE É BOM RESISTE AO TEMPO.', 18, 'Playfair Display', true, A.CENTER);
}

function waSlug_(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'pessoa'; }

/* gera o PNG do ingresso: copia o modelo da noite, troca os marcadores, exporta a miniatura */
function ingressoImagem_(dia, nome, prot, prog) {
  var modelo = waProp_('WA_MODELO_' + dia);
  if (!modelo) throw new Error('WA_SEM_MODELO: rode criarModelosIngresso');
  var cop = DriveApp.getFileById(modelo).makeCopy('tmp ingresso ' + prot + ' ' + waSlug_(nome)), id = cop.getId();
  try {
    var pres = SlidesApp.openById(id), s = pres.getSlides()[0], p = prog[dia] || {};
    s.replaceAllText('{{NOME}}', nome); s.replaceAllText('{{DIA}}', p.label || ('Noite ' + dia)); s.replaceAllText('{{ATRACAO}}', p.atracao || ''); s.replaceAllText('{{PROT}}', prot);
    pres.saveAndClose(); Utilities.sleep(1500);
    var th = UrlFetchApp.fetch('https://slides.googleapis.com/v1/presentations/' + id + '/pages/' + pres.getSlides()[0].getObjectId() + '/thumbnail?thumbnailProperties.thumbnailSize=LARGE&thumbnailProperties.mimeType=PNG',
      {headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}});
    return UrlFetchApp.fetch(JSON.parse(th.getContentText()).contentUrl).getBlob().setName('ingresso_' + prot + '_' + waSlug_(nome) + '.png');
  } finally { try { cop.setTrashed(true); } catch (_) {} }
}

function pastaDia_(iso) {
  var raiz = DriveApp.getFolderById(waProp_('WA_PASTA_RAIZ', WA_PASTA_PADRAO)), it = raiz.getFoldersByName(iso || 'sem-data');
  return it.hasNext() ? it.next() : raiz.createFolder(iso || 'sem-data');
}

/* ===== API da Meta ===== */
function waUpload_(blob) {
  var r = UrlFetchApp.fetch(WA_API + waProp_('WA_PHONE_ID') + '/media', {method: 'post', muteHttpExceptions: true,
    headers: {Authorization: 'Bearer ' + waProp_('WA_TOKEN')}, payload: {messaging_product: 'whatsapp', type: blob.getContentType(), file: blob}});
  var j = JSON.parse(r.getContentText() || '{}');
  if (r.getResponseCode() >= 300 || !j.id) throw new Error('WA_UPLOAD ' + r.getResponseCode() + ': ' + (j.error && j.error.message || r.getContentText()).slice(0, 150));
  return j.id;
}

function waEnviar_(tel, mediaId, nome, dia, prot, prog) {
  var p = prog[dia] || {};
  var body = {messaging_product: 'whatsapp', recipient_type: 'individual', to: waNum_(tel), type: 'template', template: {
    name: waProp_('WA_TEMPLATE', 'ingresso_confirmacao'), language: {code: waProp_('WA_IDIOMA', 'pt_BR')},
    components: [
      {type: 'header', parameters: [{type: 'image', image: {id: mediaId}}]},
      {type: 'body', parameters: [{type: 'text', text: String(nome).split(' ')[0]}, {type: 'text', text: p.label || ('Noite ' + dia)}, {type: 'text', text: p.atracao || '-'}, {type: 'text', text: prot}]}
    ]}};
  var r = UrlFetchApp.fetch(WA_API + waProp_('WA_PHONE_ID') + '/messages', {method: 'post', muteHttpExceptions: true, contentType: 'application/json',
    headers: {Authorization: 'Bearer ' + waProp_('WA_TOKEN')}, payload: JSON.stringify(body)});
  var j = JSON.parse(r.getContentText() || '{}');
  if (r.getResponseCode() >= 300 || !j.messages) throw new Error('WA_ENVIO ' + r.getResponseCode() + ': ' + (j.error && j.error.message || r.getContentText()).slice(0, 150));
  return j.messages[0].id;
}

/* ===== processamento da fila (gatilho de 1 min) ===== */
function processarFilaWhats() {
  if (!cfg_().waAtivo || !waPronto_()) return {ok: false, motivo: 'desligado ou sem credenciais'};
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return {ok: false, motivo: 'ocupado'};
  var ini = Date.now(), feitos = 0;
  try {
    var sh = abaWa_(), n = sh.getLastRow(), prog = prog_();
    if (n < 2) return {ok: true, feitos: 0};
    var v = sh.getRange(2, 1, n - 1, WA_CAB.length).getValues();
    for (var i = 0; i < v.length && feitos < 8 && Date.now() - ini < 240000; i++) {
      var r = v[i], li = i + 2;
      if (r[6] !== 'PENDENTE') continue;
      var tent = Number(r[7]) || 0, dia = Number(r[3]), nome = String(r[4]), prot = String(r[2]);
      try {
        var blob = ingressoImagem_(dia, nome, prot, prog);
        try { pastaDia_(prog[dia] && prog[dia].iso).createFile(blob); } catch (e1) { /* guardar no Drive não pode impedir o envio */ }
        var wamid = waEnviar_(r[5], waUpload_(blob), nome, dia, prot, prog);
        sh.getRange(li, 7, 1, 5).setValues([['ENVIADO', tent + 1, wamid, '', new Date()]]);
      } catch (e) {
        sh.getRange(li, 7, 1, 5).setValues([[tent + 1 >= WA_MAX_TENT ? 'FALHOU' : 'PENDENTE', tent + 1, '', String(e.message).slice(0, 200), new Date()]]);
        registrarErro_('WA', 'processarFilaWhats', 'S99', e);
      }
      feitos++;
    }
    return {ok: true, feitos: feitos};
  } finally { lock.releaseLock(); }
}

/* instala o gatilho de 1 minuto (rodar uma vez, depois de configurar as credenciais) */
function instalarFilaWhats() {
  var tem = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'processarFilaWhats'; });
  if (!tem) ScriptApp.newTrigger('processarFilaWhats').timeBased().everyMinutes(1).create();
}

/* teste: envia um ingresso de exemplo para um celular (rodar no editor, passando o número) */
function testeWhats() {
  var tel = waProp_('WA_TESTE_TEL'); if (!tel) throw new Error('Defina a propriedade WA_TESTE_TEL (ex.: 47999999999)');
  var prog = prog_(), dia = Number(Object.keys(prog).sort()[0]), blob = ingressoImagem_(dia, 'Teste Stammhaus', 'TESTE', prog);
  return waEnviar_(tel, waUpload_(blob), 'Teste Stammhaus', dia, 'TESTE', prog);
}


/* ======================= CONVITES POR WHATSAPP (envio automático, em lote) =======================
 * Projeto PÚBLICO. Lê a aba Convidados (J telefone, L "convite enviado em", M situação do envio pela API) e dispara o template de
 * convite (categoria Marketing, aprovado na Meta) a quem tem celular válido e ainda não recebeu. Gatilho de 1 min, 15 por rodada.
 * Liga/desliga: Config convites_ativo = SIM/NAO. Propriedades: WA_TEMPLATE_CONVITE (padrão convite_inauguracao), WA_IDIOMA, WA_TOKEN, WA_PHONE_ID.
 * Quem já recebeu (pelo painel ou pela API) tem a coluna L preenchida e nunca é reenviado. Falha: 3 tentativas e fica "FALHOU" (reenvio manual). */
var CV_COL = {TEL: 10, ENV: 12, SIT: 13};
var CV_LOTE = 15, CV_MAX_DIA = 200;   // 200/dia: abaixo do limite de 250 destinatários por 24 h do número novo

function cvAtivo_() { var o = {}; lerConfig_().forEach(function (r) { if (r[0]) o[String(r[0]).trim()] = r[1]; }); return String(o.convites_ativo || 'NAO').trim().toUpperCase() === 'SIM'; }
function cvTelOk_(t) { return /^\([1-9]\d\) 9\d{4}-\d{4}$/.test(String(t || '').trim()); }
function cvAcomp_(ac) { return Number(ac) === 1 ? 'Seu convite inclui um acompanhante.' : 'Convite individual.'; }

function cvEnviar_(tel, nome, dia, ac, prog) {
  var p = prog[dia] || {};
  var body = {messaging_product: 'whatsapp', recipient_type: 'individual', to: waNum_(tel), type: 'template', template: {
    name: waProp_('WA_TEMPLATE_CONVITE', 'convite_inauguracao'), language: {code: waProp_('WA_IDIOMA', 'pt_BR')},
    components: [{type: 'body', parameters: [{type: 'text', text: String(nome).trim().split(/\s+/)[0]}, {type: 'text', text: p.label || ('Noite ' + dia)},
      {type: 'text', text: p.atracao || '-'}, {type: 'text', text: cvAcomp_(ac)}]}]}};
  var r = UrlFetchApp.fetch(WA_API + waProp_('WA_PHONE_ID') + '/messages', {method: 'post', muteHttpExceptions: true, contentType: 'application/json',
    headers: {Authorization: 'Bearer ' + waProp_('WA_TOKEN')}, payload: JSON.stringify(body)});
  var j = JSON.parse(r.getContentText() || '{}');
  if (r.getResponseCode() >= 300 || !j.messages) throw new Error('WA_CONVITE ' + r.getResponseCode() + ': ' + (j.error && j.error.message || r.getContentText()).slice(0, 150));
  return j.messages[0].id;
}

function cvGarantirColunas_(sh) { try { if (sh.getMaxColumns() < CV_COL.SIT) sh.insertColumnsAfter(sh.getMaxColumns(), CV_COL.SIT - sh.getMaxColumns()); } catch (e) {} }

/* situação: '' (não tentado) | 'ENVIADO · wamid' | 'ERRO n · mensagem' | 'FALHOU · mensagem' */
function processarConvitesWhats() {
  if (!cvAtivo_() || !waPronto_()) return {ok: false, motivo: 'desligado ou sem credenciais'};
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return {ok: false, motivo: 'ocupado'};
  var ini = Date.now(), feitos = 0, erros = 0;
  try {
    var sh = aba_(ABA.CONV), n = sh.getLastRow(), prog = prog_();
    if (n < 2) return {ok: true, feitos: 0};
    cvGarantirColunas_(sh);
    var v = sh.getRange(2, 1, n - 1, CV_COL.SIT).getValues(), hoje = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), enviadosHoje = 0;
    v.forEach(function (r) { var e = r[CV_COL.ENV - 1]; if (e instanceof Date && Utilities.formatDate(e, TZ, 'yyyy-MM-dd') === hoje && /^ENVIADO/.test(String(r[CV_COL.SIT - 1]))) enviadosHoje++; });
    for (var i = 0; i < v.length && feitos < CV_LOTE && enviadosHoje + feitos < CV_MAX_DIA && Date.now() - ini < 240000; i++) {
      var r = v[i], li = i + 2, tel = String(r[CV_COL.TEL - 1] || '').trim(), sit = String(r[CV_COL.SIT - 1] || '');
      if (!r[1] || !cvTelOk_(tel) || r[CV_COL.ENV - 1] || /^(ENVIADO|FALHOU)/.test(sit)) continue;
      if (sh.getRange(li, CV_COL.ENV).getValue()) continue;   // alguém marcou enviado pelo painel enquanto rodava
      var tent = (/^ERRO (\d)/.exec(sit) || [0, 0])[1] * 1;
      try {
        var wamid = cvEnviar_(tel, String(r[1]), Number(r[2]), r[5], prog);
        sh.getRange(li, CV_COL.ENV).setValue(new Date()); sh.getRange(li, CV_COL.SIT).setValue('ENVIADO · ' + wamid);
      } catch (e) {
        var msg = String(e.message).slice(0, 160);
        sh.getRange(li, CV_COL.SIT).setValue((tent + 1 >= WA_MAX_TENT ? 'FALHOU · ' : 'ERRO ' + (tent + 1) + ' · ') + msg);
        registrarErro_('WA', 'processarConvitesWhats', 'S99', e); erros++;
        if (erros >= 5) break;   // algo sistêmico (token, template não aprovado): para e não queima as tentativas de todos
      }
      feitos++;
      Utilities.sleep(250);
    }
    return {ok: true, feitos: feitos, erros: erros};
  } finally { lock.releaseLock(); }
}

/* contagens para conferir antes de ligar (rodar no editor) */
function resumoConvitesWhats() {
  var sh = aba_(ABA.CONV), n = sh.getLastRow(); if (n < 2) return {};
  cvGarantirColunas_(sh);
  var v = sh.getRange(2, 1, n - 1, CV_COL.SIT).getValues(), o = {convidados: 0, comTelefone: 0, jaEnviados: 0, aEnviar: 0, falhou: 0};
  v.forEach(function (r) {
    if (!r[1]) return; o.convidados++;
    var ok = cvTelOk_(r[CV_COL.TEL - 1]); if (ok) o.comTelefone++;
    if (r[CV_COL.ENV - 1]) o.jaEnviados++; else if (/^FALHOU/.test(String(r[CV_COL.SIT - 1]))) o.falhou++; else if (ok) o.aEnviar++;
  });
  console.log(JSON.stringify(o)); return o;
}

/* cria a linha de controle na aba Config (desligada) e instala o gatilho de 1 minuto. Rodar uma vez, depois de aprovar o template. */
function instalarConvitesWhats() {
  var sh = aba_(ABA.CFG), v = lerConfig_(), tem = v.some(function (r) { return String(r[0]).trim() === 'convites_ativo'; });
  if (!tem) sh.getRange(sh.getLastRow() + 1, 1, 1, 2).setValues([['convites_ativo', 'NAO']]);
  if (!ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'processarConvitesWhats'; })) ScriptApp.newTrigger('processarConvitesWhats').timeBased().everyMinutes(1).create();
  return 'ok: ligue com Config convites_ativo = SIM';
}

/* teste: envia o convite a UM celular (propriedade WA_TESTE_TEL) sem mexer na planilha */
function testeConviteWhats() {
  var tel = waProp_('WA_TESTE_TEL'); if (!tel) throw new Error('Defina a propriedade WA_TESTE_TEL (ex.: 47999999999)');
  var prog = prog_(), dia = Number(Object.keys(prog).sort()[0]);
  return cvEnviar_(tel, 'Teste Stammhaus', dia, 1, prog);
}
