/* =====================================================================
 * Das Stammhaus Pub — GESTÃO (painel interno). ARQUIVO ÚNICO (Code.gs).
 * Ordem: Comum (núcleo/lotação) · Código · Preparação · Acesso · Gestão · Legado.
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
var PROG_COL_TETO = 12, PROG_COL_REF = 13, PROG_COL_SIT = 14, PROG_COL_SHOW = 15, PROG_COL_VAL = 16;   // 16 = valor da entrada desta noite (R$; vazio = valor_ingresso da Config, padrão 40)
//   // 15 = horário do show (HH:MM; vazio = padrão pelo dia da semana)
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
/* valor da entrada de uma noite: o da coluna P da Programacao; vazio = valor_ingresso da Config (padrão 40) */
function valorDe_(cfg, p) { return (p && p.valorCustom !== '' && p.valorCustom != null) ? p.valorCustom : cfg.valor; }   // 0 = grátis
function tetoDe_(cfg, dia) { return (cfg.tetos && cfg.tetos[dia]) || cfg.teto; }

/* ---------- leituras usadas na contagem de lotação (sem nomes de convidados) ---------- */
function convLeve_() { return []; }   // convidados desativados (25/11): a lotação vem só das reservas; os dados antigos ficam em Reservas como legado

// Colunas Reservas (público): A data/hora, B protocolo, C dia, D nº da pessoa, E nome, F celular,
// G status (Confirmado/Cancelado), H celular do titular da reserva, I consentimento, J compareceu, K atualizado
/* ambiente escolhido na reserva: Reservas, coluna L. 'Térreo' (mais perto do palco) ou 'Andar superior' (mais calmo); vazio = sem preferência */
var RES_COL_ANDAR = 12, ANDAR_CAB = 'ambiente (Térreo / Andar superior)';
/* entrada bonificada (por pessoa; 'Sim' = sem cobrança de entrada) e origem (legado = veio da lista de convidados da inauguração) */
var RES_COL_BONUS = 13, BONUS_CAB = 'entrada bonificada (Sim / vazio)', RES_COL_ORIG = 14, ORIG_CAB = 'origem (legado: convite da inauguração)';
function resColunas_(sh) {   // garante colunas L, M e N e seus cabeçalhos na aba Reservas
  try {
    if (sh.getMaxColumns() < RES_COL_ORIG) sh.insertColumnsAfter(sh.getMaxColumns(), RES_COL_ORIG - sh.getMaxColumns());
    [[RES_COL_ANDAR, ANDAR_CAB], [RES_COL_BONUS, BONUS_CAB], [RES_COL_ORIG, ORIG_CAB]].forEach(function (c) { if (!String(sh.getRange(1, c[0]).getValue() || '')) sh.getRange(1, c[0]).setValue(c[1]); });
  } catch (e) {}
}
function bonifNorm_(v) { return /^(s|sim|x|1|true)$/i.test(String(v == null ? '' : v).trim()); }
function andarNorm_(v) { var s = String(v == null ? '' : v).trim().toLowerCase(); return /^t/.test(s) ? 'Térreo' : /^(s|a)/.test(s) ? 'Andar superior' : ''; }
function reservas_() {
  var sh = ss_().getSheetByName(ABA.RES), n = sh ? sh.getLastRow() : 0;
  if (n < 2) return [];
  var lc = Math.min(RES_COL_ORIG, sh.getMaxColumns());   // colunas L–N só existem depois da primeira reserva que as usa
  return sh.getRange(2, 1, n - 1, lc).getValues().map(function (r, i) {
    return {linha: i + 2, ts: r[0], prot: String(r[1]), dia: Number(r[2]), n: Number(r[3]) || 0, nome: String(r[4]),
            tel: String(r[5]), status: String(r[6]), titTel: String(r[7]), andar: andarNorm_(r[RES_COL_ANDAR - 1]),
            bonif: bonifNorm_(r[RES_COL_BONUS - 1]), origem: String(r[RES_COL_ORIG - 1] || '')};
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
           pendentesPessoas: 0, naoVaiConvites: 0, publico: 0, bonificadas: 0, pagantes: 0, reservas: 0, canceladasPublico: 0};
  var prots = {};
  resv.forEach(function (r) {
    if (r.dia !== dia) return;
    if (r.status === 'Confirmado') { o.publico++; prots[r.prot] = 1; if (r.bonif) o.bonificadas++; } else if (r.n === 1) o.canceladasPublico++;
  });
  o.reservas = Object.keys(prots).length;
  o.pagantes = o.publico - o.bonificadas;
  o.lista = 0;
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
  var cab = ['dia', 'atração', 'capacidade', 'teto (74+10%)', 'reservas', 'pessoas', 'entradas bonificadas', 'total comprometido', 'vagas restantes', '% do teto', 'situação'];
  var v = [cab].concat(L.map(function (c) {
    return [c.dia, c.prog && c.prog.atracao || '', c.capacidade, c.teto, c.reservas, c.publico, c.bonificadas, c.total, c.restantes, c.pct / 100, c.lotado ? 'LOTADO' : 'Disponível'];
  }));
  sh.getRange(1, 1, Math.max(v.length, 1), 13).clearContent();
  sh.getRange(1, 1, v.length, 11).setValues(v);
  sh.getRange(v.length + 2, 1).setValue('Atualizado em ' + agora + ' · regra: pessoas em reservas ≤ ' + cfg.teto + ' por noite');
  try {
    sh.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#113325').setFontColor('#EAE7DA').setWrap(true);
    sh.getRange(2, 10, Math.max(L.length, 1), 1).setNumberFormat('0.0%');
    L.forEach(function (c, i) { sh.getRange(i + 2, 11).setBackground(c.lotado ? '#E04E27' : '#BFE3C4').setFontWeight('bold'); });
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
  var ext = []; try { var mcx = sh.getMaxColumns(); if (mcx >= PROG_COL_REF) ext = sh.getRange(2, PROG_COL_REF, n - 1, Math.min(4, mcx - PROG_COL_TETO)).getValues(); } catch (e1) {}
  sh.getRange(2, 1, n - 1, 6).getValues().forEach(function (r, ix) {
    if (!r[0]) return;
    var key = Number(r[0]), v = r[1], p = null, ee = ext[ix] || ['', '', '', ''];
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
    var vn = Number(String(ee[3] == null ? '' : ee[3]).replace(',', '.')); m[key].valorCustom = isFinite(vn) && vn >= 0 && String(ee[3] == null ? '' : ee[3]).trim() !== '' ? Math.round(vn * 100) / 100 : '';
    var sit = String(ee[1] || '').trim().toUpperCase(), isoP = m[key].iso;
    m[key].aberto = sit === 'FECHADO' ? false : sit === 'ABERTO' ? true : (m[key].atracao ? true : !padraoFechado_(isoP));
    m[key].showPadrao = showPadrao_(isoP); m[key].show = m[key].showCustom || m[key].showPadrao;
  });
  return m;
}

// Colunas Confirmacoes: A data/hora, B id, C convidado(lista), D dia, E titular, F tel titular,
// G acompanhante, H tel acomp., I pessoas, J status, K consentimento, L compareceu, M atualizado
var STATUS_NAO = 'Não vai';

function confs_() { return []; }   // idem

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

/* ================= CONFIGURAÇÃO INICIAL (menu Stammhaus) ================= */

function fmtData_(d) { return Object.prototype.toString.call(d) === '[object Date]' ? Utilities.formatDate(d, TZ, 'dd/MM HH:mm') : ''; }


function garantirAba_(nome, cab) {
  var ss = ss_(), sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
  if (sh.getLastRow() === 0 && cab) { sh.getRange(1, 1, 1, cab.length).setValues([cab]); try { sh.getRange(1, 1, 1, cab.length).setFontWeight('bold'); sh.setFrozenRows(1); } catch (e) {} }
  return sh;
}

function atualizarPainelMenu() { atualizarPainelSeguro_(); try { legadoMigrarSeguro_(); } catch (e) {} }

function prepararReservas() {
  var sc = ss_().getSheetByName(ABA.CFG);
  if (!sc) throw new Error('ABA_AUSENTE: ' + ABA.CFG);
  var existentes = {}; lerConfig_().forEach(function (r) { if (r[0]) existentes[String(r[0]).trim()] = 1; });
  try {   // migração: o valor antigo (teto fixo de 2) vira 8 uma única vez; depois é livre para editar
    var vals = sc.getRange(1, 1, Math.max(sc.getLastRow(), 1), 3).getValues();
    vals.forEach(function (r, i) { if (String(r[0]).trim() === 'max_pessoas_reserva' && /teto fixo de 2/.test(String(r[2] || ''))) { sc.getRange(i + 1, 2).setValue(8); sc.getRange(i + 1, 3).setValue('Máximo de pessoas por reserva do público (editável; de 1 a 20).'); } });
  } catch (e) {}
  [['teto_por_noite', 81, 'Teto de pessoas por noite: 74 + 10%. Lista garantida + reservas do público; ao chegar nesse número a noite aparece como LOTADA.'],
   ['valor_ingresso', 40, 'R$ por pessoa (público geral), pago junto à quitação da comanda na noite.'],
   ['max_pessoas_reserva', 10, 'Máximo de pessoas por reserva do público (editável; de 1 a 20). Acima disso, o site orienta falar com a equipe pelo WhatsApp.'],
   ['confirmar_ate', '14h', 'Horário-limite do lembrete de confirmação por WhatsApp, no dia do evento: convites sem resposta até esse horário são considerados desistência (só texto da mensagem).'],
   ['reserva_antecedencia_dias', 30, 'Reservas do público abertas para os próximos N dias (a programação além disso aparece só para consulta).'],
   ['reserva_valida_ate', '20h', 'Texto exibido: a reserva vale só até esse horário.'],
   ['url_app_convidados', 'https://script.google.com/macros/s/AKfycbx3wEPWFrKRAjefiG9RLPOqeLPZHeCSnlu551adkqPNJHWbzldQOuhEFcSiqq6ylf-RDw/exec', 'Endereço (/exec) do app dos convidados; usado para montar os links de métricas na aba Acesso.'],
   ['whatsapp_ativo', 'NAO', 'SIM liga o envio do ingresso por WhatsApp (precisa das credenciais da Meta no projeto público). NAO = nada é enfileirado.'],
   ['pendente_conta_acompanhante', 'SIM', 'SIM: convidado sem resposta conta titular + acompanhante a que tem direito. NAO: conta só o titular.']
  ].forEach(function (x) {
    if (existentes[x[0]]) return;
    var l = sc.getLastRow() + 1; sc.getRange(l, 1, 1, 3).setValues([x]);
    try { sc.getRange(l, 2).setBackground('#FFFF00').setFontColor('#0000FF'); } catch (e) {}
  });
  garantirAba_(ABA.RES, ['data/hora', 'protocolo', 'dia', 'nº da pessoa', 'nome', 'celular', 'status', 'celular do titular', 'consentimento', 'compareceu', 'atualizado']);
  try { var sp = aba_(ABA.PROG); if (!String(sp.getRange(1, 6).getValue() || '')) sp.getRange(1, 6).setValue('reservas do público (SIM/NÃO)'); } catch (e) {}
  try { var sq = aba_(ABA.PROG); if (!String(sq.getRange(1, 7).getValue() || '')) sq.getRange(1, 7, 1, 5).setValues([CONTRATO_CAB]); } catch (e) {}
  garantirAba_('Usuarios', USR_CAB);
  garantirAba_('Auditoria', ['data/hora', 'quem', 'ação', 'detalhe']);
  atualizarPainelSeguro_();
  var tem = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'atualizarPainelMenu'; });
  if (!tem) ScriptApp.newTrigger('atualizarPainelMenu').timeBased().everyMinutes(5).create();
}

/* ================= ACESSO AO PAINEL: usuário + senha =================
 * Link único: <URL do web app dos convidados>?p=painel  (abre a tela de login; sem login não há nenhum dado).
 * Cadastro (aba "Usuarios"): usuario, nome, perfil (GESTAO edita · CONSULTA só vê), ativo (SIM/NÃO), senha inicial.
 * 1º acesso: entra com a senha inicial e é obrigado a criar a própria senha; a senha inicial é apagada e só o hash fica guardado.
 * Redefinir: digite uma nova senha inicial na célula — a pessoa será obrigada a trocá-la no próximo acesso.
 * Bloqueio: 5 senhas erradas seguidas bloqueiam o usuário por 15 min. Sessão: 6 h (expira sozinha), encerra no "Sair". */

var USR_CAB = ['usuario', 'nome', 'perfil (GESTAO/CONSULTA)', 'ativo (SIM/NÃO)', 'senha inicial', 'senha (hash)', 'salt', 'último acesso', 'senha trocada em'];
var SESSAO_SEG = 21600, MAX_FALHAS = 5, BLOQ_SEG = 900;

function normUsr_(s) { return String(s || '').toLowerCase().replace(/\s+/g, '').trim(); }

function hashSenha_(salt, senha) {
  var h = String(salt) + '|' + String(senha);
  for (var i = 0; i < 500; i++) {
    var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + '|' + i, Utilities.Charset.UTF_8);
    h = b.map(function (x) { return ('0' + ((x < 0 ? x + 256 : x) & 255).toString(16)).slice(-2); }).join('');
  }
  return h;
}

function achaUsuario_(usuario) {
  var u = normUsr_(usuario); if (!u) return null;
  var sh = ss_().getSheetByName('Usuarios'), n = sh ? sh.getLastRow() : 0;
  if (n < 2) return null;
  var v = sh.getRange(2, 1, n - 1, 9).getValues();
  for (var i = 0; i < v.length; i++) {
    if (normUsr_(v[i][0]) !== u) continue;
    var at = String(v[i][3]).trim().toUpperCase();
    return {linha: i + 2, usuario: u, nome: String(v[i][1] || v[i][0]).trim(), perfil: String(v[i][2]).trim().toUpperCase() === 'GESTAO' ? 'GESTAO' : 'CONSULTA',
            ativo: at === 'SIM' || at === 'S', inicial: String(v[i][4] === 0 ? '0' : (v[i][4] || '')), hash: String(v[i][5] || ''), salt: String(v[i][6] || '')};
  }
  return null;
}

function senhaConfere_(u, senha) {
  senha = String(senha == null ? '' : senha);
  if (!senha) return false;
  if (u.inicial !== '') return senha === u.inicial;              // senha inicial (ou redefinida) tem prioridade
  return !!u.hash && hashSenha_(u.salt, senha) === u.hash;
}

function entrar_(usuario, senha) {
  var c = CacheService.getScriptCache(), un = normUsr_(usuario);
  if (!limite_('lg', 120, 60)) return {ok: false, code: 'limite'};
  if (!un || un.length > 60) return {ok: false, code: 'credenciais'};
  var kf = 'lf_' + un.replace(/[^a-z0-9._@-]/g, '').slice(0, 50), falhas = Number(c.get(kf) || 0);
  if (falhas >= MAX_FALHAS) return {ok: false, code: 'bloqueado'};
  var u = achaUsuario_(un), ok = !!(u && u.ativo && senhaConfere_(u, senha));
  if (!ok) { c.put(kf, String(falhas + 1), BLOQ_SEG); return {ok: false, code: falhas + 1 >= MAX_FALHAS ? 'bloqueado' : 'credenciais'}; }
  c.remove(kf);
  var tok = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  c.put('ss_' + tok, u.usuario, SESSAO_SEG);
  try { aba_('Usuarios').getRange(u.linha, 8).setValue(new Date()); } catch (e) {}
  return {ok: true, sessao: tok, nome: u.nome, perfil: u.perfil, trocar: u.inicial !== ''};
}

/* sessão -> usuário (revalida na planilha a cada chamada: desativar ou mudar perfil vale na hora) */
function sessaoUsuario_(sessao) {
  var t = String(sessao || '').replace(/[^A-Za-z0-9]/g, '');
  if (t.length < 40) return null;
  var un = CacheService.getScriptCache().get('ss_' + t);
  if (!un) return null;
  var u = achaUsuario_(un);
  if (!u || !u.ativo) return null;
  u.trocar = u.inicial !== ''; u.sessao = t;
  return u;
}

function trocarSenha_(sessao, atual, nova) {
  var u = sessaoUsuario_(sessao); if (!u) return {ok: false, code: 'sessao'};
  if (!limite_('ts' + u.usuario, 10, 900)) return {ok: false, code: 'limite'};
  if (!senhaConfere_(u, atual)) return {ok: false, code: 'senha_atual', msg: 'A senha atual não confere.'};
  nova = String(nova == null ? '' : nova);
  if (nova.length < 8) return {ok: false, code: 'senha_fraca', msg: 'Use ao menos 8 caracteres.'};
  if (nova.length > 100) return {ok: false, code: 'senha_fraca', msg: 'Senha longa demais.'};
  if (nova === String(atual)) return {ok: false, code: 'senha_fraca', msg: 'A nova senha precisa ser diferente da atual.'};
  if (normUsr_(nova) === u.usuario) return {ok: false, code: 'senha_fraca', msg: 'A senha não pode ser igual ao usuário.'};
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var salt = Utilities.getUuid().replace(/-/g, ''), sh = aba_('Usuarios');
    sh.getRange(u.linha, 5).setValue('');
    sh.getRange(u.linha, 6, 1, 2).setValues([[hashSenha_(salt, nova), salt]]);
    sh.getRange(u.linha, 9).setValue(new Date());
    SpreadsheetApp.flush();
    aud_({nome: u.nome}, 'Trocou a própria senha', u.usuario);
  } finally { lock.releaseLock(); }
  return {ok: true};
}

function sair_(sessao) {
  var t = String(sessao || '').replace(/[^A-Za-z0-9]/g, '');
  if (t) CacheService.getScriptCache().remove('ss_' + t);
  return {ok: true};
}

function entrar(usuario, senha) { return api_('entrar', entrar_, arguments); }
function trocarSenha(sessao, atual, nova) { return api_('trocarSenha', trocarSenha_, arguments); }
function sair(sessao) { return api_('sair', sair_, arguments); }

/* ---------- PAINEL ÚNICO (métricas + gestão) ----------
 * Acesso por usuário e senha (Auth.src.gs). Perfil GESTAO edita; CONSULTA só visualiza (o servidor barra qualquer gravação).
 * Toda gravação passa por aqui, sob lock, e fica registrada na aba Auditoria (quem, quando, o quê). Mudanças que estouram o teto
 * de 81 só passam com "forcar". O parâmetro "k" das funções é o token de SESSÃO devolvido pelo login. */

function acessoGestao_(k) {
  var u = sessaoUsuario_(k);
  if (!u) return null;
  return {linha: u.linha, nome: u.nome, usuario: u.usuario, gestao: u.perfil === 'GESTAO', trocar: u.trocar};
}

function aud_(a, acao, det) {
  try { garantirAba_('Auditoria', ['data/hora', 'quem', 'ação', 'detalhe']).appendRow([new Date(), a.nome, acao, String(det).slice(0, 400)]); } catch (e) {}
}

function normG_(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }

function atividade_(resv) {
  var ev = [];
  resv.filter(function (r) { return !r.origem; }).slice(-30).forEach(function (r) { if (r.n === 1) ev.push({t: r.ts, tipo: 'Reserva', texto: r.nome + ' · reserva ' + r.prot + ' · ' + r.status + ' · noite ' + r.dia}); });
  ev.sort(function (x, y) { return (y.t instanceof Date ? y.t.getTime() : 0) - (x.t instanceof Date ? x.t.getTime() : 0); });
  return ev.slice(0, 12).map(function (e) { return {quando: fmtData_(e.t), tipo: e.tipo, texto: e.texto}; });
}

/* ===== contratação das atrações (uso interno) — Programacao, colunas G a K ===== */
var VAL_CAB = 'valor da entrada (R$; vazio = padrão 40)', TETO_CAB = 'lotação desta noite (exceção ao teto padrão)', REF_CAB = 'refeição da equipe (SIM/vazio)', SHOW_CAB = 'horário do show (HH:MM; vazio = padrão: qua/qui 20:30, sex/sáb 21:30)', SIT_CAB = 'situação (ABERTO/FECHADO; vazio = padrão: dom/seg/ter fechados)';
function progColunas_(sh) {   // garante colunas 12–14 e cabeçalhos da aba Programacao
  try { if (sh.getMaxColumns() < PROG_COL_VAL) sh.insertColumnsAfter(sh.getMaxColumns(), PROG_COL_VAL - sh.getMaxColumns());
    [[PROG_COL_TETO, TETO_CAB], [PROG_COL_REF, REF_CAB], [PROG_COL_SIT, SIT_CAB], [PROG_COL_SHOW, SHOW_CAB], [PROG_COL_VAL, VAL_CAB]].forEach(function (c) { if (!String(sh.getRange(1, c[0]).getValue() || '')) sh.getRange(1, c[0]).setValue(c[1]); }); } catch (e) {}
}
var CONTRATO_CAB = ['cachê (R$)', 'nº de integrantes', 'consumação por integrante (R$)', 'estadia (R$)', 'transporte (R$)'];
function gNum_(v) {
  if (v === '' || v === null || v === undefined) return '';
  var s = String(v).replace(/[R$\s]/g, '');
  if (/,/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  var n = Number(s);
  return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}
function contratos_(prog) {
  var sh = aba_(ABA.PROG), n = sh.getLastRow(), m = {};
  if (n < 2) return m;
  var v = sh.getRange(2, 7, n - 1, 5).getValues();
  Object.keys(prog).forEach(function (d) {
    var r = v[prog[d].linha - 2]; if (!r) return;
    m[d] = {cache: r[0], integrantes: r[1], consumacao: r[2], estadia: r[3], transporte: r[4]};
  });
  return m;
}

function estadoGestao_(a) {
  var cfg = cfg_(), prog = prog_(), resv = reservas_();
  var contr = a.gestao ? contratos_(prog) : {};   // dados de contratação: só perfil GESTAO, nunca vão para a página pública
  var noites = ordemDias_(prog).map(function (d) {
    var c = contagem_(d, cfg, [], [], resv);
    if (a.gestao) c.contrato = contr[d] || {cache: '', integrantes: '', consumacao: '', estadia: '', transporte: ''};
    if (c.contrato) c.contrato.refeicao = prog[d].refeicao; c.aberto = prog[d].aberto; c.show = prog[d].show; c.showPadrao = prog[d].showPadrao; c.showCustom = prog[d].showCustom; c.valor = valorDe_(cfg, prog[d]); c.valorCustom = prog[d].valorCustom; c.label = prog[d].label; c.iso = prog[d].iso; c.atracao = prog[d].atracao; c.estilo = prog[d].estilo; c.pub = prog[d].pub; c.receita = c.pagantes * c.valor;
    return c;
  });
  var gr = {}, ordem = [];
  resv.forEach(function (r) {
    if (r.status !== 'Confirmado') return;
    var g = gr[r.prot];
    if (!g) { g = gr[r.prot] = {prot: r.prot, dia: r.dia, titTel: r.titTel, andar: r.andar || '', origem: r.origem || '', pessoas: []}; ordem.push(r.prot); }
    g.pessoas.push({linha: r.linha, nome: r.nome, tel: r.tel, bonif: !!r.bonif});
  });
  var aud = [], sa = ss_().getSheetByName('Auditoria'), na = sa ? sa.getLastRow() : 0;
  if (na >= 2) {
    var ini = Math.max(2, na - 14);
    sa.getRange(ini, 1, na - ini + 1, 4).getValues().reverse().forEach(function (r) {
      aud.push({quando: fmtData_(r[0]), quem: String(r[1]), acao: String(r[2]), det: String(r[3])});
    });
  }
  var wh = [], cw = {}, sw = ss_().getSheetByName('Whats'), nw = sw ? sw.getLastRow() : 0;
  if (nw >= 2) {
    var vw = sw.getRange(2, 1, nw - 1, 11).getValues();
    vw.forEach(function (r) { cw[r[6]] = (cw[r[6]] || 0) + 1; });
    vw.map(function (r, i) { return {linha: i + 2, origem: String(r[1]), ref: String(r[2]), dia: Number(r[3]), nome: String(r[4]), status: String(r[6]), tent: Number(r[7]) || 0, detalhe: String(r[9])}; })
      .filter(function (x) { return x.status !== 'ENVIADO' && x.status !== 'CANCELADO'; }).slice(-30).forEach(function (x) { wh.push(x); });
  }
  return {ok: true, hoje: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), perfil: a.gestao ? 'GESTAO' : 'CONSULTA', atividade: atividade_(resv), whats: {ativo: cfg.waAtivo, contagem: cw, pendencias: wh}, quem: a.nome, geradoEm: Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm:ss'), teto: cfg.teto, capacidade: cfg.capacidade,
          valor: cfg.valor, maxPessoas: cfg.maxPessoas, confirmarAte: cfg.confirmarAte, noites: noites,
          reservas: ordem.map(function (p) { return gr[p]; }), auditoria: aud, legado: a.gestao ? gLegadoEstado_() : null};
}

function gestaoAbrir_(k) {
  if (!limite_('gt', 240, 60)) return {ok: false, code: 'limite'};
  var a = acessoGestao_(k);
  if (!a) return {ok: false, code: 'sessao'};
  if (a.trocar) return {ok: false, code: 'trocar'};
  return estadoGestao_(a);
}
function painel(k) { return api_('painel', gestaoAbrir_, arguments); }

/* executa uma alteração: valida acesso, trava, roda fn(a, ctx) e devolve o estado atualizado */
function gMut_(k, nome, fn) {
  if (!limite_('gm', 90, 60)) return {ok: false, code: 'limite'};
  var a = acessoGestao_(k);
  if (!a) return {ok: false, code: 'sessao'};
  if (a.trocar) return {ok: false, code: 'trocar'};
  if (!a.gestao) return {ok: false, code: 'sem_permissao'};
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
function gTotalNoite_(dia) { return contagem_(dia, cfg_(), [], [], reservas_()).total; }
function gLotado_(dia, add, forcar) {
  var t = gTotalNoite_(dia), teto = tetoDe_(cfg_(), dia);
  if (add > 0 && t + add > teto && !forcar) return {ok: false, code: 'lotado', total: t, teto: teto, adicional: add};
  return null;
}
/* aceita o celular digitado de qualquer jeito (47996015131, 47 99601-5131, +55 47 99601 5131) e devolve (47) 99601-5131; o que não couber no padrão volta como veio e a validação recusa */
function gTelFmt_(t) {
  var s = String(t || '').trim(), d = s.replace(/\D/g, '');
  if (d.length >= 12 && d.slice(0, 2) === '55') d = d.slice(2);
  if (d.length === 11) { var f = '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7); if (TEL_RE.test(f)) return f; }
  return s;
}
function gTelOk_(t, obrig) { t = String(t || '').trim(); return t ? TEL_RE.test(t) : !obrig; }

/* ===== reservas (único módulo de lista: os convidados da inauguração viraram legado na aba Reservas) ===== */
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
      cancelarFilaWhats_('R', String(prot), rows[0].dia);
      enfileirarWhats_('R', String(prot), dia, rows.map(function (r) { return {nome: r.nome, tel: r.tel}; }));
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
      cancelarFilaWhats_('R', String(prot), null);
      aud_(a, 'Cancelou reserva', prot + ' (' + rows.map(function (r) { return r.nome; }).join(', ') + ')');
      return {ok: true};
    });
  }, arguments);
}

/* editar pessoa: linha informada · adicionar pessoa: linha vazia + prot */
function gReservaPessoa(k, prot, linha, nome, tel, forcar) {
  return api_('gReservaPessoa', function () {
    return gMut_(k, 'rpessoa', function (a) {
      nome = limpaNome_(nome); tel = gTelFmt_(tel);
      if (!NOME_RE.test(nome) || nome.split(' ').length < 2) return {ok: false, code: 'invalido', campo: 'nome', msg: 'Informe nome e sobrenome.'};
      if (!gTelOk_(tel, false)) return {ok: false, code: 'invalido', campo: 'tel', msg: 'Celular no formato (42) 99999-9999 (ou deixe em branco).'};
      var rows = gReservaLinhas_(prot); if (!rows.length) return {ok: false, code: 'nao_encontrado'};
      var sh = aba_(ABA.RES), agora = new Date();
      var outros = rows.filter(function (r) { return String(r.linha) !== String(linha); });
      if (digitos_(tel) && outros.some(function (r) { return digitos_(r.tel) === digitos_(tel); })) return {ok: false, code: 'invalido', campo: 'tel', msg: 'Cada pessoa precisa de um celular próprio.'};
      if (linha) {
        var r0 = rows.filter(function (r) { return String(r.linha) === String(linha); })[0]; if (!r0) return {ok: false, code: 'nao_encontrado'};
        sh.getRange(r0.linha, 5, 1, 2).setValues([[nome, tel]]); sh.getRange(r0.linha, 11).setValue(agora);
        aud_(a, 'Editou pessoa da reserva', prot + ': "' + r0.nome + '" → "' + nome + '"');
      } else {
        var bl = gLotado_(rows[0].dia, 1, forcar); if (bl) return bl;
        var nl = proximaLinha_(sh); if (nl > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
        var n = Math.max.apply(null, rows.map(function (r) { return r.n; })) + 1;
        sh.getRange(nl, 1, 1, 11).setValues([[agora, String(prot), rows[0].dia, n, nome, tel, 'Confirmado', rows[0].titTel, 'Registrado pela gestão (' + a.nome + ')', '', agora]]);
        enfileirarWhats_('R', String(prot), rows[0].dia, [{nome: nome, tel: tel}]);
        aud_(a, 'Incluiu pessoa na reserva', prot + ': ' + nome + (forcar ? ' [forçado]' : ''));
      }
      return {ok: true};
    });
  }, arguments);
}

function gNomeChave_(n) { return String(n || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); }
/* adicionar várias pessoas de uma vez a uma reserva: lista [{nome, tel?}] */
function gReservaPessoas(k, prot, lista, forcar) {
  return api_('gReservaPessoas', function () {
    return gMut_(k, 'rpessoas', function (a) {
      var rows = gReservaLinhas_(prot); if (!rows.length) return {ok: false, code: 'nao_encontrado'};
      lista = (lista || []).filter(function (x) { return x && (String(x.nome || '').trim() || String(x.tel || '').trim()); });
      if (!lista.length) return {ok: false, code: 'invalido', campo: 'nome', msg: 'Informe ao menos um nome.'};
      if (lista.length > 30) return {ok: false, code: 'invalido', campo: 'nome', msg: 'No máximo 30 pessoas por vez.'};
      var usTel = {}, usNome = {}, novos = [];
      rows.forEach(function (r) { if (digitos_(r.tel)) usTel[digitos_(r.tel)] = 1; usNome[gNomeChave_(r.nome)] = 1; });
      for (var i = 0; i < lista.length; i++) {
        var nome = limpaNome_(lista[i].nome), tel = gTelFmt_(lista[i].tel), q = 'Linha ' + (i + 1) + ': ';
        if (!NOME_RE.test(nome) || nome.split(' ').length < 2) return {ok: false, code: 'invalido', campo: 'nome', msg: q + 'informe nome e sobrenome.'};
        if (!gTelOk_(tel, false)) return {ok: false, code: 'invalido', campo: 'tel', msg: q + 'celular no formato (42) 99999-9999 (ou deixe em branco).'};
        if (digitos_(tel) && usTel[digitos_(tel)]) return {ok: false, code: 'invalido', campo: 'tel', msg: q + 'cada pessoa precisa de um celular próprio.'};
        if (usNome[gNomeChave_(nome)]) return {ok: false, code: 'invalido', campo: 'nome', msg: q + 'este nome já consta na reserva.'};
        if (digitos_(tel)) usTel[digitos_(tel)] = 1; usNome[gNomeChave_(nome)] = 1;
        novos.push({nome: nome, tel: tel, bonif: lista[i].bonif === true || bonifNorm_(lista[i].bonif)});
      }
      var bl = gLotado_(rows[0].dia, novos.length, forcar); if (bl) return bl;
      var sh = aba_(ABA.RES), agora = new Date(), nl = proximaLinha_(sh), n0 = Math.max.apply(null, rows.map(function (r) { return r.n; }));
      if (nl + novos.length - 1 > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
      var out = novos.map(function (x, i) { return [agora, String(prot), rows[0].dia, n0 + i + 1, x.nome, x.tel, 'Confirmado', rows[0].titTel, 'Registrado pela gestão (' + a.nome + ')', '', agora]; });
      sh.getRange(nl, 1, novos.length, 11).setValues(out);
      if (novos.some(function (x) { return x.bonif; })) { resColunas_(sh); sh.getRange(nl, RES_COL_BONUS, novos.length, 1).setValues(novos.map(function (x) { return [x.bonif ? 'Sim' : '']; })); }
      var andar = rows[0].andar || '';
      if (andar) { if (sh.getMaxColumns() < RES_COL_ANDAR) sh.insertColumnsAfter(sh.getMaxColumns(), RES_COL_ANDAR - sh.getMaxColumns()); sh.getRange(nl, RES_COL_ANDAR, novos.length, 1).setValues(novos.map(function () { return [andar]; })); }
      enfileirarWhats_('R', String(prot), rows[0].dia, novos);
      aud_(a, 'Incluiu pessoas na reserva', prot + ': ' + novos.map(function (x) { return x.nome; }).join(', ') + (forcar ? ' [forçado]' : ''));
      return {ok: true, n: novos.length};
    });
  }, arguments);
}

/* entrada bonificada (sem cobrança de entrada), por pessoa: linhas = números de linha da aba Reservas (da própria reserva); vazio = todas as pessoas da reserva */
function gReservaBonificar(k, prot, linhas, marcar) {
  return api_('gReservaBonificar', function () {
    return gMut_(k, 'rbonif', function (a) {
      var rows = gReservaLinhas_(prot); if (!rows.length) return {ok: false, code: 'nao_encontrado'};
      var alvo = (linhas && linhas.length) ? rows.filter(function (r) { return linhas.indexOf(r.linha) >= 0; }) : rows;
      if (!alvo.length) return {ok: false, code: 'invalido', campo: 'nome', msg: 'Pessoa não encontrada nesta reserva.'};
      var sh = aba_(ABA.RES); resColunas_(sh);
      alvo.forEach(function (r) { sh.getRange(r.linha, RES_COL_BONUS).setValue(marcar ? 'Sim' : ''); sh.getRange(r.linha, 11).setValue(new Date()); });
      aud_(a, marcar ? 'Marcou entrada bonificada' : 'Removeu entrada bonificada', prot + ': ' + alvo.map(function (r) { return r.nome; }).join(', '));
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
      if (pessoas.length > 300) return {ok: false, code: 'invalido', campo: 'nome', msg: 'Máximo de 300 pessoas por reserva.'};   // equipe: sem o limite do público; só um teto de segurança
      var tels = {}, ativos = {};
      reservas_().forEach(function (r) { var dg = digitos_(r.tel); if (r.status === 'Confirmado' && dg && !/^legado/.test(r.origem || '')) ativos[dg] = r.prot; });
      for (var i = 0; i < pessoas.length; i++) {
        var n = limpaNome_(pessoas[i].nome), t = gTelFmt_(pessoas[i].tel);
        if (!NOME_RE.test(n) || n.split(' ').length < 2) return {ok: false, code: 'invalido', campo: 'nome' + i, msg: 'Pessoa ' + (i + 1) + ': informe nome e sobrenome.'};
        if (!gTelOk_(t, false)) return {ok: false, code: 'invalido', campo: 'tel' + i, msg: 'Pessoa ' + (i + 1) + ': celular no formato (42) 99999-9999 (ou deixe em branco).'};
        var d = digitos_(t);   // celular é opcional na reserva da equipe; só confere repetição quando informado
        if (d && tels[d]) return {ok: false, code: 'invalido', campo: 'tel' + i, msg: 'Cada pessoa precisa de um celular próprio.'};
        if (d && ativos[d] && !forcar) return {ok: false, code: 'tel_duplicado', msg: 'O celular da pessoa ' + (i + 1) + ' já está na reserva ' + ativos[d] + '.'};
        if (d) tels[d] = 1; pessoas[i] = {nome: n, tel: t, bonif: bonifNorm_(pessoas[i].bonif) || pessoas[i].bonif === true};
      }
      var bl = gLotado_(dia, pessoas.length, forcar); if (bl) return bl;
      var sh = aba_(ABA.RES), agora = new Date(), l0 = proximaLinha_(sh), prot = 'R' + l0, titTel = (pessoas.filter(function (x) { return x.tel; })[0] || {tel: ''}).tel;
      if (l0 + pessoas.length > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
      sh.getRange(l0, 1, pessoas.length, 11).setValues(pessoas.map(function (x, i) {
        return [agora, prot, dia, i + 1, x.nome, x.tel, 'Confirmado', titTel, 'Registrado pela gestão (' + a.nome + ')', '', agora];
      }));
      if (pessoas.some(function (x) { return x.bonif; })) { resColunas_(sh); sh.getRange(l0, RES_COL_BONUS, pessoas.length, 1).setValues(pessoas.map(function (x) { return [x.bonif ? 'Sim' : '']; })); }
      enfileirarWhats_('R', prot, dia, pessoas);
      aud_(a, 'Criou reserva', prot + ' na noite ' + dia + ': ' + pessoas.map(function (x) { return x.nome; }).join(', ') + (forcar ? ' [forçado]' : ''));
      return {ok: true, info: {protocolo: prot}};
    });
  }, arguments);
}

/* reenvia: volta para PENDENTE as linhas FALHOU/SEM_NUMERO/ENVIADO de uma pessoa (linha da aba Whats) */
function gWhatsReenviar(k, linha) {
  return api_('gWhatsReenviar', function () {
    return gMut_(k, 'wreenviar', function (a) {
      var sh = ss_().getSheetByName('Whats'), n = sh ? sh.getLastRow() : 0, l = Number(linha);
      if (!sh || l < 2 || l > n) return {ok: false, code: 'nao_encontrado'};
      var r = sh.getRange(l, 1, 1, 11).getValues()[0];
      if (!digitos_(r[5])) return {ok: false, code: 'invalido', campo: 'tel', msg: 'Esta pessoa está sem celular. Informe o número antes.'};
      sh.getRange(l, 7, 1, 5).setValues([['PENDENTE', 0, '', '', new Date()]]);
      aud_(a, 'Reenviar ingresso', r[4] + ' (' + r[2] + ')');
      return {ok: true};
    });
  }, arguments);
}


/* ===== agenda perpétua: abrir/editar um dia (qualquer data) =====
 * Cria (ou atualiza) a linha da Programacao. Reservas do público só aparecem na página pública se pub = SIM. */
function gDiaSalvar(k, iso, atracao, estilo, pub, contrato) {   // contrato.teto = lotação manual desta noite (vazio = padrão da Config)
  return api_('gDiaSalvar', function () {
    return gMut_(k, 'dia', function (a) {
      iso = String(iso || '').trim();
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
      if (!m) return {ok: false, code: 'invalido', campo: 'data', msg: 'Data inválida.'};
      var dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      if (dt.getUTCFullYear() !== +m[1] || dt.getUTCMonth() !== +m[2] - 1 || dt.getUTCDate() !== +m[3]) return {ok: false, code: 'invalido', campo: 'data', msg: 'Data inválida.'};
      atracao = String(atracao || '').replace(/\s+/g, ' ').trim().slice(0, 120); estilo = String(estilo || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      var cv = null, tt = null;
      if (contrato && contrato.teto !== undefined) {
        var ts = String(contrato.teto === null ? '' : contrato.teto).trim();
        if (ts === '') tt = '';
        else { var tn = Number(ts); if (!isFinite(tn) || tn !== Math.floor(tn) || tn < 1 || tn > 500) return {ok: false, code: 'invalido', campo: 'teto', msg: 'Lotação: informe um número inteiro entre 1 e 500, ou deixe vazio para usar o padrão.'}; tt = tn; }
      }
      if (contrato) {
        cv = [gNum_(contrato.cache), gNum_(contrato.integrantes), gNum_(contrato.consumacao), gNum_(contrato.estadia), gNum_(contrato.transporte)];
        for (var q = 0; q < 5; q++) if (cv[q] !== cv[q]) return {ok: false, code: 'invalido', campo: 'contrato', msg: 'Contratação: use apenas números (ex.: 1500 ou 1.500,00).'};
        if (cv[1] !== '' && cv[1] !== Math.floor(cv[1])) return {ok: false, code: 'invalido', campo: 'contrato', msg: 'Nº de integrantes deve ser um número inteiro.'};
      }
      var valV = null;
      if (contrato && contrato.valor !== undefined) { valV = gNum_(contrato.valor === null ? '' : contrato.valor); if (valV !== valV || valV > 1000) return {ok: false, code: 'invalido', campo: 'valor', msg: 'Valor da entrada: informe um valor entre 0 e 1.000 (0 = grátis; ex.: 40 ou 35,50), ou deixe vazio para usar o padrão.'}; }
      var refV = contrato && contrato.refeicao !== undefined ? (contrato.refeicao ? 'SIM' : '') : null, shV = contrato && contrato.show !== undefined ? String(contrato.show || '').trim() : null, sitV = contrato && contrato.aberto !== undefined ? (contrato.aberto ? 'ABERTO' : 'FECHADO') : null;
      var prog = prog_(), key = chaveDeIso_(iso, prog), sh = aba_(ABA.PROG), pubv = pub ? 'SIM' : 'NÃO', ex = prog[key];
      if (shV !== null && shV !== '' && !showNorm_(shV)) return {ok: false, code: 'invalido', campo: 'show', msg: 'Horário do show inválido. Use o formato 20:30.'};
      if (shV !== null) { shV = shV === '' || showNorm_(shV) === showPadrao_(iso) ? '' : showNorm_(shV); }
      if (refV !== null || sitV !== null || tt !== null || shV !== null || valV !== null) progColunas_(sh);
      if (cv) { try { if (!String(sh.getRange(1, 7).getValue() || '')) sh.getRange(1, 7, 1, 5).setValues([CONTRATO_CAB]); } catch (e1) {} }
      if (ex) {
        sh.getRange(ex.linha, 3, 1, 2).setValues([[atracao, estilo]]); sh.getRange(ex.linha, 6).setValue(pubv);
        if (cv) sh.getRange(ex.linha, 7, 1, 5).setValues([cv]);
        if (refV !== null) sh.getRange(ex.linha, PROG_COL_REF).setValue(refV);
        if (shV !== null) { sh.getRange(ex.linha, PROG_COL_SHOW).setNumberFormat('@').setValue(shV); if (shV !== ex.showCustom) aud_(a, 'Horário do show', iso + ': ' + (shV || 'padrão (' + (ex.showPadrao || '—') + ')')); }
        if (valV !== null) { sh.getRange(ex.linha, PROG_COL_VAL).setValue(valV); if (valV !== ex.valorCustom) aud_(a, 'Valor da entrada', iso + ': ' + (ex.valorCustom === '' ? 'padrão' : ex.valorCustom) + ' → ' + (valV === '' ? 'padrão' : valV)); }
        if (sitV !== null) { if (sitV === 'FECHADO' && ex.aberto || sitV === 'ABERTO' && !ex.aberto) aud_(a, sitV === 'FECHADO' ? 'Fechou o dia' : 'Abriu o dia', iso); sh.getRange(ex.linha, PROG_COL_SIT).setValue(sitV); }
        if (tt !== null) { var tAnt = tetoDe_(cfg_(), key); sh.getRange(ex.linha, PROG_COL_TETO).setValue(tt); aud_(a, 'Lotação da noite', iso + ': ' + tAnt + ' → ' + (tt === '' ? 'padrão' : tt)); }
        aud_(a, 'Editou programação', iso + ': "' + atracao + '" · ' + estilo + ' · reservas do público ' + pubv + (cv ? ' · contratação atualizada' : ''));
      } else {
        var nl = Math.max(sh.getLastRow(), 1) + 1;
        sh.getRange(nl, 2).setNumberFormat('@');
        sh.getRange(nl, 1, 1, 6).setValues([[key, iso, atracao, estilo, '', pubv]]);
        if (cv) sh.getRange(nl, 7, 1, 5).setValues([cv]);
        if (refV) sh.getRange(nl, PROG_COL_REF).setValue(refV);
        if (shV) sh.getRange(nl, PROG_COL_SHOW).setNumberFormat('@').setValue(shV);
        if (valV !== null && valV !== '') { sh.getRange(nl, PROG_COL_VAL).setValue(valV); aud_(a, 'Valor da entrada', iso + ': padrão → ' + valV); }
        if (sitV !== null) sh.getRange(nl, PROG_COL_SIT).setValue(sitV);
        if (tt !== null && tt !== '') { sh.getRange(nl, PROG_COL_TETO).setValue(tt); aud_(a, 'Lotação da noite', iso + ': padrão → ' + tt); }
        aud_(a, 'Abriu dia', iso + ': "' + atracao + '" · ' + estilo + ' · reservas do público ' + pubv + (cv ? ' · com contratação' : ''));
      }
      return {ok: true};
    });
  }, arguments);
}

/* PDF da lista de portaria: o HTML é montado na página (mesmos dados da tela); aqui só converte, exigindo sessão válida */
function gListaPdf(k, html, nome) {
  return api_('gListaPdf', function () {
    if (!limite_('pdf', 30, 60)) return {ok: false, code: 'limite'};
    var a = acessoGestao_(k);
    if (!a) return {ok: false, code: 'sessao'};
    if (a.trocar) return {ok: false, code: 'trocar'};
    html = String(html || '');
    if (html.length < 50 || html.length > 900000) return {ok: false, code: 'invalido', msg: 'Lista inválida.'};
    var nm = String(nome || 'lista-portaria').replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 60);
    var blob = Utilities.newBlob(html, 'text/html', nm + '.html').getAs('application/pdf');
    aud_(a, 'Exportou lista de portaria', nm);
    return {ok: true, nome: nm + '.pdf', b64: Utilities.base64Encode(blob.getBytes())};
  }, arguments);
}

/* Mover a atração (e contratação) de uma data para outra. Convidados e reservas já feitos ficam na data original (use "Mudar de dia" para movê-los). */
function gDiaMover(k, isoOrig, isoDest) {
  return api_('gDiaMover', function () {
    return gMut_(k, 'dia', function (a) {
      isoOrig = String(isoOrig || '').trim(); isoDest = String(isoDest || '').trim();
      var re = /^\d{4}-\d{2}-\d{2}$/;
      if (!re.test(isoOrig) || !re.test(isoDest)) return {ok: false, code: 'invalido', campo: 'data', msg: 'Data inválida.'};
      if (isoOrig === isoDest) return {ok: false, code: 'invalido', campo: 'data', msg: 'Escolha uma data diferente.'};
      var hoje = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
      if (isoDest < hoje) return {ok: false, code: 'invalido', campo: 'data', msg: 'A nova data não pode estar no passado.'};
      var prog = prog_(), kO = chaveDeIso_(isoOrig, prog), exO = prog[kO];
      if (!exO || exO.iso !== isoOrig) return {ok: false, code: 'invalido', campo: 'data', msg: 'Programação de origem não encontrada.'};
      var exD = null; Object.keys(prog).forEach(function (d) { if (prog[d].iso === isoDest) exD = prog[d]; });
      if (exD && exD.atracao) return {ok: false, code: 'invalido', campo: 'data', msg: 'Já existe atração em ' + exD.label + ' (' + exD.atracao + '). Edite ou limpe esse dia antes.'};
      var sh = aba_(ABA.PROG); progColunas_(sh);
      var v = sh.getRange(exO.linha, 3, 1, PROG_COL_REF - 2).getValues()[0];   // atração … refeição (cols 3–13)
      var cfg = cfg_(), c = contagem_(kO, cfg, [], [], reservas_()), linhaD;
      if (exD) linhaD = exD.linha;
      else { linhaD = Math.max(sh.getLastRow(), 1) + 1; sh.getRange(linhaD, 2).setNumberFormat('@'); sh.getRange(linhaD, 1, 1, 2).setValues([[chaveDeIso_(isoDest, prog), isoDest]]); }
      sh.getRange(linhaD, 3, 1, PROG_COL_REF - 2).setValues([v]);
      var shO = sh.getRange(exO.linha, PROG_COL_SHOW).getValue(); if (shO) sh.getRange(linhaD, PROG_COL_SHOW).setNumberFormat('@').setValue(shO); sh.getRange(exO.linha, PROG_COL_SHOW).clearContent();
      var vO = sh.getRange(exO.linha, PROG_COL_VAL).getValue(); if (vO !== '') sh.getRange(linhaD, PROG_COL_VAL).setValue(vO); sh.getRange(exO.linha, PROG_COL_VAL).clearContent();
      sh.getRange(linhaD, PROG_COL_SIT).setValue(exO.aberto === false ? 'FECHADO' : 'ABERTO');
      sh.getRange(exO.linha, 3, 1, PROG_COL_REF - 2).clearContent();
      sh.getRange(exO.linha, PROG_COL_SIT).setValue(c.total > 0 ? 'ABERTO' : '');
      aud_(a, 'Mudou a data da atração', isoOrig + ' → ' + isoDest + ': "' + String(v[0]) + '"' + (c.total > 0 ? ' (' + c.total + ' pessoa(s) continuam em ' + isoOrig + ')' : ''));
      return {ok: true};
    });
  }, arguments);
}

/* ======================= LEGADO: convidados da semana de inauguração → aba Reservas =======================
 * Desde 25/11 o pub opera só com reservas. Os dados de convites ficam na aba Reservas como LEGADO (coluna N "origem" começa com "legado"):
 *  · convite confirmado → uma linha por pessoa (titular e acompanhante), status Confirmado, protocolo = id do convite (G055…)
 *  · sem resposta ou "não vai" → uma linha (o convidado), status Cancelado
 * Não gera WhatsApp, não aparece na consulta do público e não conta para noites futuras. Idempotente: não duplica um convite já migrado.
 * Depois de conferir, "Apagar abas antigas" (painel, perfil GESTÃO) tira Convidados/Confirmacoes (antes guarda uma cópia em abas ocultas). */
var LEG_PREF = 'legado';

function legadoLer_() {
  var ss = ss_(), sc = ss.getSheetByName(ABA.CONV), sf = ss.getSheetByName(ABA.CONF), conv = [], ult = {};
  if (sc && sc.getLastRow() > 1) sc.getRange(2, 1, sc.getLastRow() - 1, Math.min(sc.getMaxColumns(), 11)).getValues().forEach(function (r) {
    if (r[0]) conv.push({id: String(r[0]).trim(), nome: String(r[1] || '').trim(), dia: Number(r[2]), estilo: String(r[3] || ''), grupo: String(r[4] || ''), acomp: Number(r[5]) === 1 ? 1 : 0, tel: String(r[9] || '').trim()});
  });
  if (sf && sf.getLastRow() > 1) sf.getRange(2, 1, sf.getLastRow() - 1, 13).getValues().forEach(function (r) {
    var id = String(r[1] || '').trim(); if (!id || String(r[9]) === 'Substituído') return;
    ult[id] = {ts: r[0], dia: Number(r[3]), titNome: String(r[4] || '').trim(), titTel: String(r[5] || '').trim(), acNome: String(r[6] || '').trim(), acTel: String(r[7] || '').trim(), status: String(r[9] || '')};
  });
  return {conv: conv, ult: ult, tem: !!(sc || sf)};
}

/* linhas de Reservas (11 colunas A–K + L andar + M bonificada + N origem) para um convite */
function legadoLinhas_(g, u) {
  var agora = new Date(), conf = u && u.status === 'Confirmado', dia = (u && u.dia) || g.dia, lote = [];
  var base = LEG_PREF + ' · convite ' + g.id + (g.grupo ? ' · ' + g.grupo : '') + (g.estilo ? ' · ' + g.estilo : '');
  var mk = function (n, nome, tel, status, titTel, obs, origem) { return [(u && u.ts) || agora, g.id, dia, n, nome, tel, status, titTel, 'Legado: convite da inauguração', '', agora, '', '', origem]; };
  if (conf) {
    var tt = u.titTel || g.tel;
    lote.push(mk(1, u.titNome || g.nome, u.titTel || g.tel, 'Confirmado', tt, '', base + ' · confirmado'));
    if (u.acNome) lote.push(mk(2, u.acNome, u.acTel || '', 'Confirmado', tt, '', base + ' · acompanhante'));
  } else lote.push(mk(1, g.nome, g.tel, 'Cancelado', g.tel, '', base + (u ? ' · não foi' : ' · sem resposta')));
  return lote;
}

function legadoResumo_() {
  var L = legadoLer_(), sh = ss_().getSheetByName(ABA.RES), ja = {}, nres = 0;
  if (sh && sh.getLastRow() > 1) {
    var mx = Math.min(sh.getMaxColumns(), RES_COL_ORIG);
    if (mx >= RES_COL_ORIG) sh.getRange(2, 1, sh.getLastRow() - 1, RES_COL_ORIG).getValues().forEach(function (r) { var o = String(r[RES_COL_ORIG - 1] || ''); if (o.indexOf(LEG_PREF) === 0) { ja[String(r[1])] = 1; nres++; } });
  }
  var pend = L.conv.filter(function (g) { return !ja[g.id]; }).length;
  return {abas: L.tem, convites: L.conv.length, migrados: L.conv.length - pend, pendentes: pend, linhas: nres};
}

function legadoMigrar_() {
  var L = legadoLer_();
  if (!L.tem) return {ok: true, convites: 0, gravados: 0, nota: 'Abas antigas não existem (já removidas).'};
  var sh = aba_(ABA.RES); resColunas_(sh);
  var feitos = {}; if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, RES_COL_ORIG).getValues().forEach(function (r) { if (String(r[RES_COL_ORIG - 1] || '').indexOf(LEG_PREF) === 0) feitos[String(r[1])] = 1; });
  var lote = [], conf = 0, canc = 0, pend = 0;
  L.conv.forEach(function (g) {
    if (feitos[g.id]) return;
    var u = L.ult[g.id]; pend++;
    legadoLinhas_(g, u).forEach(function (x) { lote.push(x); if (x[6] === 'Confirmado') conf++; else canc++; });
  });
  if (lote.length) {
    var l0 = proximaLinha_(sh); if (l0 + lote.length > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), lote.length + 20);
    sh.getRange(l0, 1, lote.length, RES_COL_ORIG).setValues(lote);
    SpreadsheetApp.flush();
    if (String(sh.getRange(l0 + lote.length - 1, 2).getValue()) !== String(lote[lote.length - 1][1])) throw new Error('ESCRITA_FALHOU: migração do legado não confirmada');
  }
  return {ok: true, convites: pend, gravados: lote.length, pessoasConfirmadas: conf, canceladas: canc};
}

/* roda sozinha uma vez (gatilho de 5 min do painel); registra o resultado na aba Auditoria */
function legadoMigrarSeguro_() {
  try {
    var pr = PropertiesService.getScriptProperties();
    if (pr.getProperty('LEGADO_MIGRADO') === 'SIM') return;
    var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return;
    try {
      var r = legadoMigrar_(), v = legadoResumo_();
      aud_({nome: 'sistema'}, 'Migrou convidados para Reservas (legado)', 'convites ' + r.convites + ' · linhas ' + r.gravados + ' · confirmadas ' + (r.pessoasConfirmadas || 0) + ' · canceladas ' + (r.canceladas || 0) + ' · pendentes após: ' + v.pendentes);
      if (v.pendentes === 0) pr.setProperty('LEGADO_MIGRADO', 'SIM');
    } finally { lock.releaseLock(); }
  } catch (e) { try { console.error('legado: ' + e.message); } catch (_) {} }
}

/* conferência: cada convite tem linhas de legado e o total de pessoas confirmadas bate com a aba Confirmacoes */
function legadoConferir_() {
  var L = legadoLer_(), v = legadoResumo_(), esperado = 0;
  L.conv.forEach(function (g) { var u = L.ult[g.id]; if (u && u.status === 'Confirmado') esperado += 1 + (u.acNome ? 1 : 0); });
  var sh = ss_().getSheetByName(ABA.RES), real = 0;
  if (sh && sh.getLastRow() > 1 && sh.getMaxColumns() >= RES_COL_ORIG) sh.getRange(2, 1, sh.getLastRow() - 1, RES_COL_ORIG).getValues().forEach(function (r) { if (String(r[RES_COL_ORIG - 1] || '').indexOf(LEG_PREF) === 0 && String(r[6]) === 'Confirmado') real++; });
  return {convites: v.convites, migrados: v.migrados, pendentes: v.pendentes, pessoasEsperadas: esperado, pessoasMigradas: real, confere: v.pendentes === 0 && esperado === real};
}

function gLegadoEstado_() { try { var v = legadoResumo_(); v.conferencia = v.abas ? legadoConferir_() : null; return v; } catch (e) { return {abas: false, erro: String(e.message).slice(0, 120)}; } }

function gLegadoMigrar(k) {
  return api_('gLegadoMigrar', function () {
    return gMut_(k, 'legado', function (a) {
      var r = legadoMigrar_(); aud_(a, 'Migrou convidados para Reservas (legado)', JSON.stringify(r)); return {ok: true};
    });
  }, arguments);
}

function gLegadoApagar(k) {
  return api_('gLegadoApagar', function () {
    return gMut_(k, 'legadoapagar', function (a) {
      var c = legadoConferir_(); if (!c.confere) return {ok: false, code: 'invalido', campo: 'geral', msg: 'A conferência não bate (esperadas ' + c.pessoasEsperadas + ' pessoas confirmadas, migradas ' + c.pessoasMigradas + '; convites pendentes ' + c.pendentes + '). Nada foi apagado.'};
      var ss = ss_(), carimbo = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), feitos = [];
      // cópia de segurança dentro da própria planilha (sem exigir novo acesso ao Drive): abas ocultas, que a equipe pode excluir depois
      [[ABA.CONV, 'Backup Convidados'], [ABA.CONF, 'Backup Confirmacoes']].forEach(function (x) {
        var s0 = ss.getSheetByName(x[0]); if (!s0) return;
        var c = s0.copyTo(ss); c.setName(x[1] + ' ' + carimbo); try { c.hideSheet(); } catch (e) {} feitos.push(c.getName());
      });
      if (feitos.length < 1) return {ok: false, code: 'invalido', campo: 'geral', msg: 'Não foi possível criar a cópia de segurança. Nada foi apagado.'};
      [ABA.CONF, ABA.CONV].forEach(function (n) { var s = ss.getSheetByName(n); if (s) ss.deleteSheet(s); });
      aud_(a, 'Apagou abas Convidados e Confirmacoes', 'cópia de segurança (abas ocultas): ' + feitos.join(', '));
      return {ok: true};
    });
  }, arguments);
}
