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
    horario: String(o.horario || '').trim(),
    waAtivo: String(o.whatsapp_ativo || 'NAO').trim().toUpperCase() === 'SIM'
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
  sh.getRange(2, 1, n - 1, 6).getValues().forEach(function (r, ix) {
    if (!r[0]) return;
    var key = Number(r[0]), v = r[1], p = null;
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
      pub: !/^N/i.test(String(r[5] || '').trim())
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

/* ================= CONFIGURAÇÃO INICIAL (menu Stammhaus) ================= */

function fmtData_(d) { return Object.prototype.toString.call(d) === '[object Date]' ? Utilities.formatDate(d, TZ, 'dd/MM HH:mm') : ''; }


function garantirAba_(nome, cab) {
  var ss = ss_(), sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
  if (sh.getLastRow() === 0 && cab) { sh.getRange(1, 1, 1, cab.length).setValues([cab]); try { sh.getRange(1, 1, 1, cab.length).setFontWeight('bold'); sh.setFrozenRows(1); } catch (e) {} }
  return sh;
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
   ['whatsapp_ativo', 'NAO', 'SIM liga o envio do ingresso por WhatsApp (precisa das credenciais da Meta no projeto público). NAO = nada é enfileirado.'],
   ['pendente_conta_acompanhante', 'SIM', 'SIM: convidado sem resposta conta titular + acompanhante a que tem direito. NAO: conta só o titular.']
  ].forEach(function (x) {
    if (existentes[x[0]]) return;
    var l = sc.getLastRow() + 1; sc.getRange(l, 1, 1, 3).setValues([x]);
    try { sc.getRange(l, 2).setBackground('#FFFF00').setFontColor('#0000FF'); } catch (e) {}
  });
  garantirAba_(ABA.RES, ['data/hora', 'protocolo', 'dia', 'nº da pessoa', 'nome', 'celular', 'status', 'celular do titular', 'consentimento', 'compareceu', 'atualizado']);
  try { var sp = aba_(ABA.PROG); if (!String(sp.getRange(1, 6).getValue() || '')) sp.getRange(1, 6).setValue('reservas do público (SIM/NÃO)'); } catch (e) {}
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

function convFull_() {
  var sh = aba_(ABA.CONV), n = sh.getLastRow();
  if (n < 2) return [];
  var nc = Math.min(sh.getMaxColumns(), LISTA_COL.ENV);
  return sh.getRange(2, 1, n - 1, nc).getValues().map(function (r, i) {
    var env = r[LISTA_COL.ENV - 1];
    return {linha: i + 2, id: String(r[0]), nome: String(r[1]).trim(), dia: Number(r[2]), estilo: String(r[3]), grupo: String(r[4]), acomp: Number(r[5]) === 1 ? 1 : 0,
            tel: String(r[LISTA_COL.TEL - 1] || '').trim(), tipo: String(r[LISTA_COL.TIPO - 1] || ''),
            env: env instanceof Date ? Utilities.formatDate(env, TZ, 'dd/MM HH:mm') : String(env || '')};
  }).filter(function (c) { return c.id; });
}

function ultConf_(id, confs) {
  var u = null;
  confs.forEach(function (c) { if (c.id === id && c.status !== 'Substituído') u = c; });
  return u;
}

function atividade_(resv) {
  var ev = [], shC = aba_(ABA.CONF), nC = shC.getLastRow();
  if (nC >= 2) shC.getRange(Math.max(2, nC - 14), 1, nC - Math.max(2, nC - 14) + 1, 13).getValues().forEach(function (r) {
    if (r[1]) ev.push({t: r[12] || r[0], tipo: 'Convidado', texto: (r[4] || r[2]) + ' · ' + r[9] + (r[9] === 'Confirmado' ? ' (' + r[8] + ' pessoa' + (r[8] > 1 ? 's' : '') + ')' : '') + ' · noite ' + r[3]});
  });
  resv.slice(-30).forEach(function (r) { if (r.n === 1) ev.push({t: r.ts, tipo: 'Público', texto: r.nome + ' · reserva ' + r.prot + ' · ' + r.status + ' · noite ' + r.dia}); });
  ev.sort(function (x, y) { return (y.t instanceof Date ? y.t.getTime() : 0) - (x.t instanceof Date ? x.t.getTime() : 0); });
  return ev.slice(0, 12).map(function (e) { return {quando: fmtData_(e.t), tipo: e.tipo, texto: e.texto}; });
}

function estadoGestao_(a) {
  var cfg = cfg_(), prog = prog_(), conv = convFull_(), confs = confs_(), resv = reservas_();
  var leve = conv.map(function (c) { return {id: c.id, dia: c.dia, acomp: c.acomp}; });
  var noites = ordemDias_(prog).map(function (d) {
    var c = contagem_(d, cfg, leve, confs, resv);
    c.label = prog[d].label; c.iso = prog[d].iso; c.atracao = prog[d].atracao; c.estilo = prog[d].estilo; c.pub = prog[d].pub; c.receita = c.publico * cfg.valor;
    return c;
  });
  var convidados = conv.map(function (c) {
    var u = ultConf_(c.id, confs), st = !u ? 'Pendente' : (u.status === 'Confirmado' ? 'Confirmado' : 'Não vai');
    return {id: c.id, nome: c.nome, dia: c.dia, grupo: c.grupo, acomp: c.acomp, status: st, pessoas: u && st === 'Confirmado' ? u.pessoas : 0,
            titNome: u ? u.titNome : '', titTel: u ? u.titTel : '', acNome: u ? u.acNome : '', acTel: u ? u.acTel : '', prot: u && st === 'Confirmado' ? 'C' + u.linha : '', tel: c.tel, tipo: c.tipo, env: c.env};
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
  var wh = [], cw = {}, sw = ss_().getSheetByName('Whats'), nw = sw ? sw.getLastRow() : 0;
  if (nw >= 2) {
    var vw = sw.getRange(2, 1, nw - 1, 11).getValues();
    vw.forEach(function (r) { cw[r[6]] = (cw[r[6]] || 0) + 1; });
    vw.map(function (r, i) { return {linha: i + 2, origem: String(r[1]), ref: String(r[2]), dia: Number(r[3]), nome: String(r[4]), status: String(r[6]), tent: Number(r[7]) || 0, detalhe: String(r[9])}; })
      .filter(function (x) { return x.status !== 'ENVIADO' && x.status !== 'CANCELADO'; }).slice(-30).forEach(function (x) { wh.push(x); });
  }
  return {ok: true, hoje: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), perfil: a.gestao ? 'GESTAO' : 'CONSULTA', atividade: atividade_(resv), whats: {ativo: cfg.waAtivo, contagem: cw, pendencias: wh}, quem: a.nome, geradoEm: Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm:ss'), teto: cfg.teto, capacidade: cfg.capacidade,
          valor: cfg.valor, maxPessoas: cfg.maxPessoas, pendAc: cfg.pendAc, noites: noites, convidados: convidados,
          reservas: ordem.map(function (p) { return gr[p]; }), auditoria: aud};
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
function gTotalNoite_(dia) { return contagem_(dia, cfg_(), convLeve_(), confs_(), reservas_()).total; }
function gLotado_(dia, add, forcar) {
  var t = gTotalNoite_(dia), teto = cfg_().teto;
  if (add > 0 && t + add > teto && !forcar) return {ok: false, code: 'lotado', total: t, teto: teto, adicional: add};
  return null;
}
function gPessoasConf_(u) { return [{nome: u.titNome, tel: u.titTel}].concat(u.acNome ? [{nome: u.acNome, tel: u.acTel || u.titTel}] : []); }
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
      var uc = ultConf_(g.id, confs);
      if (uc && uc.status === 'Confirmado') { cancelarFilaWhats_('C', g.id, g.dia); enfileirarWhats_('C', g.id, dia, gPessoasConf_(uc)); }
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
      if (p && p.tel !== undefined) {
        var tel = String(p.tel || '').trim();
        if (!gTelOk_(tel, false)) return {ok: false, code: 'invalido', campo: 'tel', msg: 'Celular no formato (42) 99999-9999 (ou deixe em branco).'};
        lnGarantirColunas_(sh); sh.getRange(g.linha, LISTA_COL.TEL).setNumberFormat('@').setValue(tel);
      }
      aud_(a, 'Editou convidado', g.id + ': "' + g.nome + '" → "' + nome + '", acompanhante ' + g.acomp + ' → ' + acomp);
      return {ok: true};
    });
  }, arguments);
}

/* marca (ou desmarca) que o convite por WhatsApp foi enviado a este convidado */
function gConviteMarcar(k, id, enviado) {
  return api_('gConviteMarcar', function () {
    return gMut_(k, 'convite', function (a) {
      var g = convFull_().filter(function (c) { return c.id === String(id); })[0];
      if (!g) return {ok: false, code: 'nao_encontrado'};
      var sh = aba_(ABA.CONV); lnGarantirColunas_(sh);
      sh.getRange(g.linha, LISTA_COL.ENV).setValue(enviado ? new Date() : '').setNumberFormat('dd/MM HH:mm');
      aud_(a, enviado ? 'Convite WhatsApp enviado' : 'Desmarcou convite enviado', g.id + ' ' + g.nome);
      return {ok: true};
    });
  }, arguments);
}

/* lê a planilha de trabalho "Lista de convidados" e harmoniza com o banco (telefones, pessoas novas); ver Lista.src.gs */
function gSincronizarLista(k) {
  return api_('gSincronizarLista', function () {
    return gMut_(k, 'sync', function (a) {
      var o = sincronizarLista_(a.nome);
      aud_(a, 'Sincronizou lista de convidados', 'telefones ' + o.telefones + ' · incluídos ' + o.incluidos + ' · +1 ajustados ' + o.acZerados + ' · pendências ' + o.pendencias);
      return {ok: true, info: {sync: o}};
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
      if (acao === 'confirmar') enfileirarWhats_('C', g.id, g.dia, gPessoasConf_(dados));
      else cancelarFilaWhats_('C', g.id, null);
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
        enfileirarWhats_('R', String(prot), rows[0].dia, [{nome: nome, tel: tel}]);
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
function gDiaSalvar(k, iso, atracao, estilo, pub) {
  return api_('gDiaSalvar', function () {
    return gMut_(k, 'dia', function (a) {
      iso = String(iso || '').trim();
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
      if (!m) return {ok: false, code: 'invalido', campo: 'data', msg: 'Data inválida.'};
      var dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      if (dt.getUTCFullYear() !== +m[1] || dt.getUTCMonth() !== +m[2] - 1 || dt.getUTCDate() !== +m[3]) return {ok: false, code: 'invalido', campo: 'data', msg: 'Data inválida.'};
      atracao = String(atracao || '').replace(/\s+/g, ' ').trim().slice(0, 120); estilo = String(estilo || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      var prog = prog_(), key = chaveDeIso_(iso, prog), sh = aba_(ABA.PROG), pubv = pub ? 'SIM' : 'NÃO', ex = prog[key];
      if (ex) {
        sh.getRange(ex.linha, 3, 1, 2).setValues([[atracao, estilo]]); sh.getRange(ex.linha, 6).setValue(pubv);
        aud_(a, 'Editou programação', iso + ': "' + atracao + '" · ' + estilo + ' · reservas do público ' + pubv);
      } else {
        var nl = Math.max(sh.getLastRow(), 1) + 1;
        sh.getRange(nl, 2).setNumberFormat('@');
        sh.getRange(nl, 1, 1, 6).setValues([[key, iso, atracao, estilo, '', pubv]]);
        aud_(a, 'Abriu dia', iso + ': "' + atracao + '" · ' + estilo + ' · reservas do público ' + pubv);
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

/* ---------- HARMONIZAÇÃO DA LISTA DE CONVIDADOS (planilha de trabalho) COM O BANCO OFICIAL ----------
 * A planilha "Lista de convidados" (preenchida pela equipe) é lida e cruzada com a aba Convidados.
 * Regras (só o que é seguro é aplicado; o resto vai para a aba "Harmonizacao" para decisão humana):
 *  1. Telefone: entra no banco (coluna J) no formato (xx) 9xxxx-xxxx. Telefone fora do padrão NÃO entra; vai ao relatório.
 *  2. Tipo do convite (Físico/Digital) entra na coluna K.
 *  3. Pessoa que está na lista e não existe no banco, com noite definida pelo estilo, é incluída (grupo "Lista").
 *     Sem estilo definido: não é incluída; vai ao relatório.
 *  4. Quando a lista nomeia o acompanhante em linha própria (linha "-" logo após um convite Físico) e o banco o tinha como "+1",
 *     o "+1" do titular é zerado (a vaga continua contando uma vez só, agora com nome).
 *  5. Nada é apagado, renomeado ou movido de noite. Divergências de noite, de "+1" e nomes só do banco vão ao relatório.
 * Repetir a sincronização é seguro (idempotente). */

var LISTA_ID = '1Pi6Za8_D4me13YUZna6y9TrsIZA7EpM-dZry-pzODgA';
var LISTA_ABA = 'Semana de Inauguração';
var LISTA_COL = {TEL: 10, TIPO: 11, ENV: 12};          // colunas J, K, L da aba Convidados
var LISTA_ESTILOS = {'1': {dia: 18, estilo: 'Formal'}, '2': {dia: 19, estilo: 'MPB'}, '3': {dia: 20, estilo: 'Rock'}, '4': {dia: 21, estilo: 'Pop Rock'}};
var LISTA_GRUPOS = {'família': 'Família', 'projeto': 'Projeto', 'autoridades': 'Autoridades'};

function lnNorm_(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\+\s*1/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/\b(dr|dra|sr|sra)\b\.?/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function lnTokens_(s) { return lnNorm_(s).split(' ').filter(function (t) { return t; }); }

/* devolve {tel:'(47) 99999-0000'} ou {erro:'motivo', bruto:'...'} ou {} se vazio */
function lnTel_(bruto) {
  var d = String(bruto == null ? '' : bruto).replace(/\D/g, '');
  if (!d) return {};
  if (d.length >= 12 && d.slice(0, 2) === '55') d = d.slice(2);
  if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
  if (/^[1-9][1-9]9\d{8}$/.test(d)) return {tel: '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7)};
  var m = d.length === 9 ? 'faltam os 2 dígitos do DDD' : d.length === 10 ? 'só 10 dígitos (falta o 9 do celular?)' : d.length > 11 ? 'dígitos a mais (' + d.length + ')' : d.length < 9 ? 'dígitos a menos (' + d.length + ')' : 'fora do padrão (xx) 9xxxx-xxxx';
  return {erro: m, bruto: String(bruto)};
}

function lnTipo_(s) { var t = String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); return t.indexOf('fisico') === 0 ? 'Físico' : t.indexOf('digital') === 0 ? 'Digital' : ''; }

/* linhas brutas da lista (array de arrays, sem cabeçalho): [#, data, nome, grupo, estilo, convite, telefone] */
function lnParse_(linhas) {
  var out = [];
  linhas.forEach(function (r, i) {
    var nome = String(r[2] || '').replace(/\s+/g, ' ').trim();
    if (!nome) return;
    var est = LISTA_ESTILOS[String(r[4] || '').trim().charAt(0)] || null;
    if (!est) { var m = /^(\d{1,2})\/(\d{1,2})/.exec(String(r[1] || '')); if (m && Number(m[2]) === 11 && Number(m[1]) >= 18 && Number(m[1]) <= 21) est = LISTA_ESTILOS[String(Number(m[1]) - 17)]; }
    var g = LISTA_GRUPOS[String(r[3] || '').trim().toLowerCase()] || '';
    out.push({i: i, n: String(r[0] || ''), nome: nome, mais1: /\+\s*1\b/.test(nome), dia: est ? est.dia : 0, estilo: est ? est.estilo : '', grupo: g,
              convite: String(r[5] || '').trim(), tipo: lnTipo_(r[5]), tel: lnTel_(r[6]), telBruto: String(r[6] == null ? '' : r[6]).trim()});
  });
  return out;
}

/* banco: [{linha,id,nome,dia,estilo,grupo,acomp,tel,tipo}] ; lista: saída de lnParse_ ; devolve o plano de mudanças */
function lnPlano_(lista, banco) {
  var plano = {tel: [], tipo: [], novos: [], zeraAc: [], marcaAc: [], rel: []};   // rel: [categoria, nome, detalhe]
  var rel = function (c, n, d) { plano.rel.push([c, n, d || '']); };
  var titulares = lista.filter(function (l) { return !l.mais1; });
  var mais1 = {};
  lista.forEach(function (l) { if (l.mais1) mais1[lnNorm_(l.nome)] = 1; });

  var porNorm = {}; banco.forEach(function (b) { porNorm[lnNorm_(b.nome)] = b; });
  function acha(l) {
    var k = lnNorm_(l.nome); if (porNorm[k]) return {b: porNorm[k], modo: 'exato'};
    var tl = lnTokens_(l.nome), cand = banco.filter(function (b) {
      var tb = lnTokens_(b.nome), c = tl.length <= tb.length ? [tl, tb] : [tb, tl];
      return c[0].length >= 2 && c[0].every(function (t) { return c[1].indexOf(t) >= 0; }) && (!l.dia || l.dia === b.dia);
    });
    return cand.length === 1 ? {b: cand[0], modo: 'parcial'} : null;
  }
  var usados = {}, casou = [];
  titulares.forEach(function (l) { var a = acha(l); casou.push(a); if (a) usados[a.b.id] = 1; });

  titulares.forEach(function (l, ix) {
    var a = casou[ix], b = a && a.b;
    if (b) {
      if (a.modo === 'parcial') rel('Nome diferente (mesma pessoa)', l.nome, 'banco: "' + b.nome + '" · mantido o nome do banco');
      if (l.dia && l.dia !== b.dia) rel('Noite diferente', l.nome, 'lista: ' + l.dia + ' · banco: ' + b.dia + ' · nada alterado');
      if (l.tel.tel && l.tel.tel !== b.tel) plano.tel.push({linha: b.linha, id: b.id, nome: b.nome, tel: l.tel.tel});
      if (l.tipo && l.tipo !== b.tipo) plano.tipo.push({linha: b.linha, tipo: l.tipo});
      var tem = !!mais1[lnNorm_(l.nome)];
      if (tem && !b.acomp) { rel('Acompanhante (+1) só na lista', l.nome, 'lista tem "+1"; banco sem acompanhante · nada alterado'); }
    } else if (l.dia) {
      plano.novos.push({nome: l.nome, dia: l.dia, estilo: l.estilo, grupo: l.grupo || 'Lista', acomp: mais1[lnNorm_(l.nome)] ? 1 : 0, tel: l.tel.tel || '', tipo: l.tipo, ref: l.n});
    } else {
      rel('Sem noite definida (não incluída)', l.nome, 'estilo vazio na lista · defina o estilo para incluir');
    }
    if (l.tel.erro) rel('Telefone fora do padrão (não importado)', l.nome, '"' + l.tel.bruto + '" · ' + l.tel.erro);
  });

  /* regra 4: acompanhante nomeado em linha própria (logo após o titular) substitui o "+1" que o banco tinha */
  titulares.forEach(function (l, ix) {
    var a = casou[ix], b = a && a.b, prox = titulares[ix + 1];
    if (!b || !b.acomp || mais1[lnNorm_(l.nome)] || !prox || prox.mais1 || prox.dia !== b.dia) return;
    var pnovo = plano.novos.filter(function (x) { return x.ref === prox.n && x.nome === prox.nome; })[0], pb = casou[ix + 1];
    var par = /^-/.test(prox.convite) && l.tipo === 'Físico' && (pnovo || (pb && pb.b.id !== b.id));   // 2º nome do mesmo convite físico
    var novo = pnovo && !!l.tipo && l.tipo === prox.tipo;                                              // 2º nome novo, mesmo tipo de convite
    if (par || novo) { plano.zeraAc.push({linha: b.linha, id: b.id, nome: b.nome, acomp: prox.nome}); rel('Acompanhante agora tem nome', b.nome, '"+1" do banco zerado · acompanhante na lista: ' + prox.nome); }
  });

  var pend = banco.filter(function (b) { return !usados[b.id]; });
  pend.forEach(function (b) { rel('Só no banco (não está na lista)', b.nome, 'noite ' + b.dia + ' · nada alterado'); });
  /* "+1" divergente que sobrou */
  banco.forEach(function (b) {
    var l = titulares.filter(function (x, ix) { return casou[ix] && casou[ix].b.id === b.id; })[0];
    if (!l) return;
    var tem = !!mais1[lnNorm_(l.nome)];
    var zerado = plano.zeraAc.some(function (z) { return z.id === b.id; });
    if (b.acomp && !tem && !zerado) rel('Acompanhante (+1) só no banco', b.nome, 'banco: com acompanhante · lista: sem "+1" e sem nome em linha própria · nada alterado');
  });
  /* telefones repetidos entre pessoas diferentes */
  var vistos = {};
  titulares.forEach(function (l) { if (!l.tel.tel) return; (vistos[l.tel.tel] = vistos[l.tel.tel] || []).push(l.nome); });
  Object.keys(vistos).forEach(function (t) { if (vistos[t].length > 1) rel('Telefone repetido', vistos[t].join(' · '), t); });
  /* numeração repetida na lista */
  var cont = {}; lista.forEach(function (l) { if (l.n) cont[l.n] = (cont[l.n] || 0) + 1; });
  Object.keys(cont).forEach(function (n) { if (cont[n] > 1) rel('Número (#) repetido na lista', '#' + n, cont[n] + ' linhas'); });
  plano.resumo = {lista: lista.length, titulares: titulares.length, mais1: lista.length - titulares.length, noBanco: banco.length, comTel: titulares.filter(function (l) { return l.tel.tel; }).length,
                  semTel: titulares.filter(function (l) { return !l.tel.tel && !l.tel.erro; }).length, telInvalido: titulares.filter(function (l) { return l.tel.erro; }).length};
  return plano;
}

/* ---- leitura/escrita na planilha ---- */
function lnGarantirColunas_(sh) {
  var need = LISTA_COL.ENV; if (sh.getMaxColumns() < need) sh.insertColumnsAfter(sh.getMaxColumns(), need - sh.getMaxColumns());
  var h = sh.getRange(1, LISTA_COL.TEL, 1, 3), v = h.getValues()[0];
  if (!v[0]) h.getCell(1, 1).setValue('telefone');
  if (!v[1]) h.getCell(1, 2).setValue('convite (tipo)');
  if (!v[2]) h.getCell(1, 3).setValue('convite enviado em');
  sh.getRange(2, LISTA_COL.TEL, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');
}
function lnBanco_() {
  var sh = aba_(ABA.CONV); lnGarantirColunas_(sh);
  var n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, LISTA_COL.ENV).getValues().map(function (r, i) {
    return {linha: i + 2, id: String(r[0]), nome: String(r[1]).trim(), dia: Number(r[2]), estilo: String(r[3]), grupo: String(r[4]), acomp: Number(r[5]) === 1 ? 1 : 0,
            tel: String(r[LISTA_COL.TEL - 1] || ''), tipo: String(r[LISTA_COL.TIPO - 1] || ''), env: r[LISTA_COL.ENV - 1]};
  }).filter(function (c) { return c.id; });
}
function lnLerLista_() {
  var ss = SpreadsheetApp.openById(LISTA_ID), sh = ss.getSheetByName(LISTA_ABA) || ss.getSheets()[0], n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, 7).getDisplayValues();
}

/* aplica o plano na aba Convidados e escreve o relatório; devolve o resumo */
function lnAplicar_(plano, quem) {
  var sh = aba_(ABA.CONV), conv = lnBanco_(), max = 0;
  conv.forEach(function (c) { var m = /^G(\d+)$/.exec(c.id); if (m) max = Math.max(max, Number(m[1])); });
  plano.tel.forEach(function (x) { sh.getRange(x.linha, LISTA_COL.TEL).setValue(x.tel); });
  plano.tipo.forEach(function (x) { sh.getRange(x.linha, LISTA_COL.TIPO).setValue(x.tipo); });
  plano.zeraAc.forEach(function (x) { sh.getRange(x.linha, 6).setValue(0); });
  var ult = sh.getLastRow(), formulas = null;
  try { if (ult >= 2) { var f = sh.getRange(ult, 8, 1, 2).getFormulas()[0]; if (f.some(function (z) { return z; })) formulas = sh.getRange(ult, 8, 1, 2); } } catch (e) {}
  plano.novos.forEach(function (x) {
    var id = 'G' + ('000' + (++max)).slice(-3), nl = ++ult;
    if (nl > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 20);
    sh.getRange(nl, 1, 1, 6).setValues([[id, x.nome, x.dia, x.estilo, x.grupo, x.acomp]]);
    if (formulas) try { formulas.copyTo(sh.getRange(nl, 8, 1, 2)); } catch (e) {}
    if (x.tel) sh.getRange(nl, LISTA_COL.TEL).setValue(x.tel);
    if (x.tipo) sh.getRange(nl, LISTA_COL.TIPO).setValue(x.tipo);
    x.id = id;
  });
  SpreadsheetApp.flush();
  var rel = garantirAba_('Harmonizacao', ['categoria', 'nome', 'detalhe']);
  rel.clearContents(); rel.getRange(1, 1, 1, 3).setValues([['categoria', 'nome', 'detalhe']]).setFontWeight('bold');
  var linhas = plano.rel.slice();
  plano.novos.forEach(function (x) { linhas.push(['Incluído no banco', x.nome, 'noite ' + x.dia + (x.acomp ? ' · com +1' : '') + ' · ' + x.id]); });
  linhas.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
  if (linhas.length) rel.getRange(2, 1, linhas.length, 3).setValues(linhas);
  rel.getRange(linhas.length + 3, 1).setValue('Última sincronização: ' + Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm:ss') + (quem ? ' · ' + quem : ''));
  try { rel.setColumnWidths(1, 1, 280); rel.setColumnWidths(2, 1, 260); rel.setColumnWidths(3, 1, 520); } catch (e) {}
  return {telefones: plano.tel.length, tipos: plano.tipo.length, incluidos: plano.novos.length, acZerados: plano.zeraAc.length, pendencias: plano.rel.length, resumo: plano.resumo};
}

function sincronizarLista_(quem) {
  var lista = lnParse_(lnLerLista_()), plano = lnPlano_(lista, lnBanco_());
  return lnAplicar_(plano, quem);
}

/* menu da planilha: Stammhaus > Sincronizar lista de convidados */
function sincronizarListaMenu() {
  var ui = SpreadsheetApp.getUi();
  try {
    var lista = lnParse_(lnLerLista_()), plano = lnPlano_(lista, lnBanco_());
    var r = ui.alert('Sincronizar lista de convidados',
      'Telefones a gravar: ' + plano.tel.length + '\nPessoas a incluir: ' + plano.novos.length + '\nAcompanhantes (+1) a ajustar: ' + plano.zeraAc.length +
      '\nPendências para revisar (aba Harmonizacao): ' + plano.rel.length + '\n\nNada é apagado nem movido de noite. Aplicar?', ui.ButtonSet.OK_CANCEL);
    if (r !== ui.Button.OK) return;
    var o = lnAplicar_(plano, 'menu'); atualizarPainelSeguro_();
    ui.alert('Pronto', 'Telefones: ' + o.telefones + ' · incluídos: ' + o.incluidos + ' · pendências: ' + o.pendencias + '\nVeja a aba Harmonizacao.', ui.ButtonSet.OK);
  } catch (e) { ui.alert('Não foi possível sincronizar: ' + e.message); }
}
