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
