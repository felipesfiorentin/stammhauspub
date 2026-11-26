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
