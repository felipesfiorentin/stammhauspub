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
function convLeve_() {
  var sh = aba_(ABA.CONV), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, 6).getValues().filter(function (r) { return r[0]; }).map(function (r) {
    return {id: String(r[0]), dia: Number(r[2]), acomp: Number(r[5]) === 1 ? 1 : 0};
  });
}

// Colunas Reservas (público): A data/hora, B protocolo, C dia, D nº da pessoa, E nome, F celular,
// G status (Confirmado/Cancelado), H celular do titular da reserva, I consentimento, J compareceu, K atualizado
/* ambiente escolhido na reserva: Reservas, coluna L. 'Térreo' (mais perto do palco) ou 'Andar superior' (mais calmo); vazio = sem preferência */
var RES_COL_ANDAR = 12, ANDAR_CAB = 'ambiente (Térreo / Andar superior)';
function andarNorm_(v) { var s = String(v == null ? '' : v).trim().toLowerCase(); return /^t/.test(s) ? 'Térreo' : /^(s|a)/.test(s) ? 'Andar superior' : ''; }
function reservas_() {
  var sh = ss_().getSheetByName(ABA.RES), n = sh ? sh.getLastRow() : 0;
  if (n < 2) return [];
  var lc = Math.min(RES_COL_ANDAR, sh.getMaxColumns());   // coluna L (ambiente) só existe depois da primeira reserva com escolha
  return sh.getRange(2, 1, n - 1, lc).getValues().map(function (r, i) {
    return {linha: i + 2, ts: r[0], prot: String(r[1]), dia: Number(r[2]), n: Number(r[3]) || 0, nome: String(r[4]),
            tel: String(r[5]), status: String(r[6]), titTel: String(r[7]), andar: andarNorm_(r[RES_COL_ANDAR - 1])};
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
