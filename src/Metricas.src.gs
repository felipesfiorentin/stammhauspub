
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
  var sh = garantirAba_(ABA.ACESSO, ['nome', 'token', 'ativo', 'criado em', 'último acesso', 'link (cole no WhatsApp)']);
  var n = sh.getLastRow(), base = ''; try { base = ScriptApp.getService().getUrl(); } catch (e) {}
  var feitos = [];
  if (n < 2) return feitos;
  var v = sh.getRange(2, 1, n - 1, 3).getValues();
  v.forEach(function (r, i) {
    if (!String(r[0]).trim() || String(r[1]).trim()) return;
    var tok = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 44), li = i + 2;
    sh.getRange(li, 2, 1, 4).setValues([[tok, 'SIM', new Date(), '']]);
    sh.getRange(li, 6).setValue((base || 'URL_DO_APP_DOS_CONVIDADOS') + '?p=metricas&k=' + tok);
    feitos.push(String(r[0]));
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
   ['pendente_conta_acompanhante', 'SIM', 'SIM: convidado sem resposta conta titular + acompanhante a que tem direito. NAO: conta só o titular.']
  ].forEach(function (x) {
    if (existentes[x[0]]) return;
    var l = sc.getLastRow() + 1; sc.getRange(l, 1, 1, 3).setValues([x]);
    try { sc.getRange(l, 2).setBackground('#FFFF00').setFontColor('#0000FF'); } catch (e) {}
  });
  garantirAba_(ABA.RES, ['data/hora', 'protocolo', 'dia', 'nº da pessoa', 'nome', 'celular', 'status', 'celular do titular', 'consentimento', 'compareceu', 'atualizado']);
  var ac = garantirAba_(ABA.ACESSO, ['nome', 'token', 'ativo', 'criado em', 'último acesso', 'link (cole no WhatsApp)']);
  if (ac.getLastRow() < 2) ac.getRange(2, 1).setValue('Felipe');
  gerarTokensCore_();
  atualizarPainelSeguro_();
  var tem = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'atualizarPainelMenu'; });
  if (!tem) ScriptApp.newTrigger('atualizarPainelMenu').timeBased().everyMinutes(5).create();
}
