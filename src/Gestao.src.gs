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
  var nc = Math.min(sh.getMaxColumns(), LISTA_COL.LEM);
  return sh.getRange(2, 1, n - 1, nc).getValues().map(function (r, i) {
    var env = r[LISTA_COL.ENV - 1], lem = r[LISTA_COL.LEM - 1];
    return {linha: i + 2, id: String(r[0]), nome: String(r[1]).trim(), dia: Number(r[2]), estilo: String(r[3]), grupo: String(r[4]), acomp: Number(r[5]) === 1 ? 1 : 0,
            tel: String(r[LISTA_COL.TEL - 1] || '').trim(), tipo: String(r[LISTA_COL.TIPO - 1] || ''),
            env: env instanceof Date ? Utilities.formatDate(env, TZ, 'dd/MM HH:mm') : String(env || ''),
            lem: lem instanceof Date ? Utilities.formatDate(lem, TZ, 'dd/MM HH:mm') : String(lem || '')};
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

/* ===== contratação das atrações (uso interno) — Programacao, colunas G a K ===== */
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
  var cfg = cfg_(), prog = prog_(), conv = convFull_(), confs = confs_(), resv = reservas_();
  var leve = conv.map(function (c) { return {id: c.id, dia: c.dia, acomp: c.acomp}; });
  var contr = a.gestao ? contratos_(prog) : {};   // dados de contratação: só perfil GESTAO, nunca vão para a página pública
  var noites = ordemDias_(prog).map(function (d) {
    var c = contagem_(d, cfg, leve, confs, resv);
    if (a.gestao) c.contrato = contr[d] || {cache: '', integrantes: '', consumacao: '', estadia: '', transporte: ''};
    c.label = prog[d].label; c.iso = prog[d].iso; c.atracao = prog[d].atracao; c.estilo = prog[d].estilo; c.pub = prog[d].pub; c.receita = c.publico * cfg.valor;
    return c;
  });
  var convidados = conv.map(function (c) {
    var u = ultConf_(c.id, confs), st = !u ? 'Pendente' : (u.status === 'Confirmado' ? 'Confirmado' : 'Não vai');
    return {id: c.id, nome: c.nome, dia: c.dia, grupo: c.grupo, acomp: c.acomp, status: st, pessoas: u && st === 'Confirmado' ? u.pessoas : 0,
            titNome: u ? u.titNome : '', titTel: u ? u.titTel : '', acNome: u ? u.acNome : '', acTel: u ? u.acTel : '', prot: u && st === 'Confirmado' ? 'C' + u.linha : '', tel: c.tel, tipo: c.tipo, lem: c.lem, env: c.env};
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
          valor: cfg.valor, maxPessoas: cfg.maxPessoas, confirmarAte: cfg.confirmarAte, pendAc: cfg.pendAc, noites: noites, convidados: convidados,
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
/* aceita o celular digitado de qualquer jeito (47996015131, 47 99601-5131, +55 47 99601 5131) e devolve (47) 99601-5131; o que não couber no padrão volta como veio e a validação recusa */
function gTelFmt_(t) {
  var s = String(t || '').trim(), d = s.replace(/\D/g, '');
  if (d.length >= 12 && d.slice(0, 2) === '55') d = d.slice(2);
  if (d.length === 11) { var f = '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7); if (TEL_RE.test(f)) return f; }
  return s;
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
      if (!forcar && conv.some(function (c) { return normG_(c.nome) === nn && c.dia === dia; })) return {ok: false, code: 'duplicado'};
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
        var tel = gTelFmt_(p.tel);
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

/* marca (ou desmarca) que o lembrete de confirmação por WhatsApp foi enviado a este convidado */
function gLembreteMarcar(k, id, enviado) {
  return api_('gLembreteMarcar', function () {
    return gMut_(k, 'lembrete', function (a) {
      var g = convFull_().filter(function (c) { return c.id === String(id); })[0];
      if (!g) return {ok: false, code: 'nao_encontrado'};
      var sh = aba_(ABA.CONV); lnGarantirColunas_(sh);
      sh.getRange(g.linha, LISTA_COL.LEM).setValue(enviado ? new Date() : '').setNumberFormat('dd/MM HH:mm');
      aud_(a, enviado ? 'Lembrete de confirmação enviado' : 'Desmarcou lembrete enviado', g.id + ' ' + g.nome);
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
        var tn = limpaNome_(p && p.titNome) || g.nome, tt = gTelFmt_(p && p.titTel), an = limpaNome_(p && p.acNome), at = gTelFmt_(p && p.acTel);
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
      nome = limpaNome_(nome); tel = gTelFmt_(tel);
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
        var n = limpaNome_(pessoas[i].nome), t = gTelFmt_(pessoas[i].tel);
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
function gDiaSalvar(k, iso, atracao, estilo, pub, contrato) {
  return api_('gDiaSalvar', function () {
    return gMut_(k, 'dia', function (a) {
      iso = String(iso || '').trim();
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
      if (!m) return {ok: false, code: 'invalido', campo: 'data', msg: 'Data inválida.'};
      var dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      if (dt.getUTCFullYear() !== +m[1] || dt.getUTCMonth() !== +m[2] - 1 || dt.getUTCDate() !== +m[3]) return {ok: false, code: 'invalido', campo: 'data', msg: 'Data inválida.'};
      atracao = String(atracao || '').replace(/\s+/g, ' ').trim().slice(0, 120); estilo = String(estilo || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      var cv = null;
      if (contrato) {
        cv = [gNum_(contrato.cache), gNum_(contrato.integrantes), gNum_(contrato.consumacao), gNum_(contrato.estadia), gNum_(contrato.transporte)];
        for (var q = 0; q < 5; q++) if (cv[q] !== cv[q]) return {ok: false, code: 'invalido', campo: 'contrato', msg: 'Contratação: use apenas números (ex.: 1500 ou 1.500,00).'};
        if (cv[1] !== '' && cv[1] !== Math.floor(cv[1])) return {ok: false, code: 'invalido', campo: 'contrato', msg: 'Nº de integrantes deve ser um número inteiro.'};
      }
      var prog = prog_(), key = chaveDeIso_(iso, prog), sh = aba_(ABA.PROG), pubv = pub ? 'SIM' : 'NÃO', ex = prog[key];
      if (cv) { try { if (!String(sh.getRange(1, 7).getValue() || '')) sh.getRange(1, 7, 1, 5).setValues([CONTRATO_CAB]); } catch (e1) {} }
      if (ex) {
        sh.getRange(ex.linha, 3, 1, 2).setValues([[atracao, estilo]]); sh.getRange(ex.linha, 6).setValue(pubv);
        if (cv) sh.getRange(ex.linha, 7, 1, 5).setValues([cv]);
        aud_(a, 'Editou programação', iso + ': "' + atracao + '" · ' + estilo + ' · reservas do público ' + pubv + (cv ? ' · contratação atualizada' : ''));
      } else {
        var nl = Math.max(sh.getLastRow(), 1) + 1;
        sh.getRange(nl, 2).setNumberFormat('@');
        sh.getRange(nl, 1, 1, 6).setValues([[key, iso, atracao, estilo, '', pubv]]);
        if (cv) sh.getRange(nl, 7, 1, 5).setValues([cv]);
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
