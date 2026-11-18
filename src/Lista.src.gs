/* ---------- HARMONIZAÇÃO DA LISTA DE CONVIDADOS (planilha de trabalho) COM O BANCO OFICIAL ----------
 * A planilha "Lista de convidados" (preenchida pela equipe) é lida e cruzada com a aba Convidados.
 * Regras (só o que é seguro é aplicado; o resto vai para a aba "Harmonizacao" para decisão humana):
 *  1. Telefone: entra no banco (coluna J) no formato (xx) 9xxxx-xxxx. Telefone fora do padrão NÃO entra; vai ao relatório.
 *  2. Tipo do convite (Físico/Digital) entra na coluna K.
 *  3. Pessoa que está na lista e não existe no banco, com noite definida pelo estilo, é incluída (grupo "Lista").
 *     Sem estilo definido: não é incluída; vai ao relatório.
 *  4. Quando a lista nomeia o acompanhante em linha própria (linha "-" logo após um convite Físico) e o banco o tinha como "+1",
 *     o "+1" do titular é zerado (a vaga continua contando uma vez só, agora com nome).
 *  5. Quando a lista tem "+1" para o titular, o banco passa a ter acompanhante = 1 e a linha do acompanhante que antes tinha nome
 *     (logo abaixo do titular no banco, que a lista não traz mais) é removida, se ainda não respondeu. A vaga continua contando uma vez só.
 *  6. Nome escrito de outra forma na lista (grafia, sobrenome a mais, apelido com mesmo sobrenome na mesma noite) casa com a mesma pessoa;
 *     o nome do banco é mantido e o nome da lista entra na busca_extra, para o convidado se achar pelos dois.
 *  7. Nada é movido de noite nem renomeado. Divergências de noite e nomes só do banco vão ao relatório.
 * Repetir a sincronização é seguro (idempotente). */

var LISTA_ID = '1Pi6Za8_D4me13YUZna6y9TrsIZA7EpM-dZry-pzODgA';
var LISTA_ABA = 'Semana de Inauguração';
var LISTA_COL = {TEL: 10, TIPO: 11, ENV: 12, LEM: 14};          // colunas J, K, L da aba Convidados
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

function lnDist_(a, b) {
  var m = a.length, n = b.length, d = [], i, j;
  for (i = 0; i <= m; i++) { d[i] = [i]; }
  for (j = 1; j <= n; j++) d[0][j] = j;
  for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
  return d[m][n];
}
function lnGrafia_(ta, tb) {   // mesmos tokens, cada um igual ou com 1 letra de diferença (mín. 5 letras)
  if (ta.length !== tb.length || ta.length < 2) return false;
  var difs = 0;
  for (var i = 0; i < ta.length; i++) { if (ta[i] === tb[i]) continue; if (ta[i].length >= 5 && tb[i].length >= 5 && lnDist_(ta[i], tb[i]) <= 1) difs++; else return false; }
  return difs <= 1;
}

/* mesma pessoa com grafia diferente: mesma quantidade de palavras; cada palavra igual ou, se tiver 6+ letras, com 1 letra de diferença (Carolina/Caroline, Henckels/Henkels).
   Nomes curtos (Helon/Heron, Maria/Marta) nunca casam por aproximação: são pessoas diferentes. Só é usado junto com telefone igual. */
function lnMesmaPessoa_(ta, tb) {
  if (ta.length !== tb.length || ta.length < 2) return false;
  var iguais = 0;
  for (var i = 0; i < ta.length; i++) {
    if (ta[i] === tb[i]) { iguais++; continue; }
    if (!(ta[i].length >= 6 && tb[i].length >= 6 && lnDist_(ta[i], tb[i]) <= 1)) return false;
  }
  return iguais >= 1;
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
  var plano = {tel: [], tipo: [], novos: [], zeraAc: [], marcaAc: [], busca: [], remover: [], rel: []};   // rel: [categoria, nome, detalhe]
  var rel = function (c, n, d) { plano.rel.push([c, n, d || '']); };
  var titulares = lista.filter(function (l) { return !l.mais1; });
  var mais1 = {};
  lista.forEach(function (l) { if (l.mais1) mais1[lnNorm_(l.nome)] = 1; });

  var porNorm = {}; banco.forEach(function (b) { porNorm[lnNorm_(b.nome) + '|' + b.dia] = b; });
  function acha(l, livres) {
    var k = lnNorm_(l.nome); if (l.dia && porNorm[k + '|' + l.dia]) return {b: porNorm[k + '|' + l.dia], modo: 'exato'};
    if (!l.dia) { var ex = banco.filter(function (b) { return lnNorm_(b.nome) === k; }); if (ex.length === 1) return {b: ex[0], modo: 'exato'}; }
    var tl = lnTokens_(l.nome), cand = banco.filter(function (b) {
      var tb = lnTokens_(b.nome), c = tl.length <= tb.length ? [tl, tb] : [tb, tl];
      return c[0].length >= 2 && c[0].every(function (t) { return c[1].indexOf(t) >= 0; }) && (!l.dia || l.dia === b.dia);
    });
    if (cand.length === 1) return {b: cand[0], modo: 'parcial'};
    if (l.tel && l.tel.tel) {   // mesmo celular + nome com grafia parecida (Carolina/Caroline) = mesma pessoa, não cria convite novo
      cand = banco.filter(function (b) { return b.tel === l.tel.tel && (!l.dia || l.dia === b.dia) && lnMesmaPessoa_(tl, lnTokens_(b.nome)); });
      if (cand.length === 1) return {b: cand[0], modo: 'grafia'};
    }
    cand = banco.filter(function (b) { return (!l.dia || l.dia === b.dia) && lnGrafia_(tl, lnTokens_(b.nome)); });
    return cand.length === 1 ? {b: cand[0], modo: 'grafia'} : null;
  }
  var usados = {}, casou = [];
  titulares.forEach(function (l) { var a = acha(l); casou.push(a); if (a) usados[a.b.id] = 1; });
  /* 2ª passada: mesmo sobrenome e mesma noite, entre quem sobrou dos dois lados (apelido, ex.: Beto/Roberto) */
  titulares.forEach(function (l, ix) {
    if (casou[ix] || !l.dia) return;
    var tl = lnTokens_(l.nome), ult = tl[tl.length - 1];
    var cand = banco.filter(function (b) { var tb = lnTokens_(b.nome); return !usados[b.id] && b.dia === l.dia && tl.length >= 2 && tb.length >= 2 && tb[tb.length - 1] === ult && ult.length >= 4; });
    var concorre = titulares.filter(function (x, j) { var tx = lnTokens_(x.nome); return !casou[j] && j !== ix && x.dia === l.dia && tx[tx.length - 1] === ult; }).length;
    if (cand.length === 1 && !concorre) { casou[ix] = {b: cand[0], modo: 'apelido'}; usados[cand[0].id] = 1; }
  });

  titulares.forEach(function (l, ix) {
    var a = casou[ix], b = a && a.b;
    if (b) {
      if (a.modo !== 'exato') {
        rel(a.modo === 'apelido' ? 'Nome diferente (conferir se é a mesma pessoa)' : 'Nome diferente (mesma pessoa)', l.nome, 'banco: "' + b.nome + '" · mantido o nome do banco; o nome da lista entra na busca');
        plano.busca.push({linha: b.linha, id: b.id, texto: l.nome.replace(/\+\s*1/g, '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim(), atual: b.busca || ''});
      }
      if (l.dia && l.dia !== b.dia) rel('Noite diferente', l.nome, 'lista: ' + l.dia + ' · banco: ' + b.dia + ' · nada alterado');
      if (l.tel.tel && l.tel.tel !== b.tel) plano.tel.push({linha: b.linha, id: b.id, nome: b.nome, tel: l.tel.tel});
      if (l.tipo && l.tipo !== b.tipo) plano.tipo.push({linha: b.linha, tipo: l.tipo});
      var tem = !!mais1[lnNorm_(l.nome)];
      if (tem && !b.acomp) { plano.marcaAc.push({linha: b.linha, id: b.id, nome: b.nome}); rel('Acompanhante (+1) incluído no banco', b.nome, 'a lista tem "+1"; banco passa a ter direito a acompanhante'); }
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

  /* regra 5: linha de acompanhante que a lista não traz mais, logo abaixo do titular que agora tem "+1" */
  var ordem = banco.slice().sort(function (x, y) { return x.linha - y.linha; }), removidos = {};
  ordem.forEach(function (o, ix) {
    if (usados[o.id] || !ix) return;
    var ant = ordem[ix - 1], li = titulares.filter(function (x, j) { return casou[j] && casou[j].b.id === ant.id; })[0];
    if (li && mais1[lnNorm_(li.nome)] && ant.dia === o.dia) { plano.remover.push({linha: o.linha, id: o.id, nome: o.nome, titular: ant.nome}); removidos[o.id] = 1; rel('Acompanhante com nome removido do banco', o.nome, 'a lista agora traz só "+1" para ' + ant.nome + ' · vaga continua contando uma vez só'); }
  });
  /* convites duplicados já existentes no banco: mesma noite, mesmo celular, nome com grafia parecida -> fica o mais antigo */
  var jaVistos = [];
  ordem.forEach(function (o) {
    if (removidos[o.id] || !o.tel) return;
    var orig = jaVistos.filter(function (x) { return x.tel === o.tel && x.dia === o.dia && lnMesmaPessoa_(lnTokens_(x.nome), lnTokens_(o.nome)); })[0];
    if (orig && (usados[o.id] || usados[orig.id])) rel('Possível convite duplicado (conferir)', o.nome, 'mesmo celular e nome parecido com "' + orig.nome + '" (noite ' + o.dia + ') · nada alterado');
    else if (orig) {
      plano.remover.push({linha: o.linha, id: o.id, nome: o.nome, titular: orig.nome}); removidos[o.id] = 1; usados[o.id] = 1;
      if (lnNorm_(orig.busca).indexOf(lnNorm_(o.nome)) < 0) plano.busca.push({linha: orig.linha, id: orig.id, texto: o.nome, atual: orig.busca || ''});
      rel('Convite duplicado removido', o.nome, 'mesmo celular e nome parecido com "' + orig.nome + '" (noite ' + o.dia + ') · mantido o convite mais antigo');
    } else jaVistos.push(o);
  });
  var pend = banco.filter(function (b) { return !usados[b.id] && !removidos[b.id]; });
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
  var need = LISTA_COL.LEM; if (sh.getMaxColumns() < need) sh.insertColumnsAfter(sh.getMaxColumns(), need - sh.getMaxColumns());
  var h = sh.getRange(1, LISTA_COL.TEL, 1, 3), v = h.getValues()[0];
  if (!v[0]) h.getCell(1, 1).setValue('telefone');
  if (!v[1]) h.getCell(1, 2).setValue('convite (tipo)');
  if (!v[2]) h.getCell(1, 3).setValue('convite enviado em');
  try { if (!String(sh.getRange(1, LISTA_COL.LEM).getValue() || '')) sh.getRange(1, LISTA_COL.LEM).setValue('lembrete de confirmação enviado em'); } catch (e) {}
  sh.getRange(2, LISTA_COL.TEL, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');
}
function lnBanco_() {
  var sh = aba_(ABA.CONV); lnGarantirColunas_(sh);
  var n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, LISTA_COL.ENV).getValues().map(function (r, i) {
    return {linha: i + 2, id: String(r[0]), nome: String(r[1]).trim(), dia: Number(r[2]), estilo: String(r[3]), grupo: String(r[4]), acomp: Number(r[5]) === 1 ? 1 : 0, busca: String(r[6] || ''),
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
  plano.marcaAc.forEach(function (x) { sh.getRange(x.linha, 6).setValue(1); });
  plano.busca.forEach(function (x) {
    var tem = lnNorm_(x.atual); if (lnNorm_(x.texto) && (' ' + tem + ' ').indexOf(' ' + lnNorm_(x.texto) + ' ') < 0) sh.getRange(x.linha, 7).setValue(x.atual ? x.atual + ' ' + x.texto : x.texto);
  });
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
  /* remoções por último (as linhas abaixo sobem); só quem ainda não respondeu */
  var confs = confs_(), removidos = [];
  plano.remover.slice().sort(function (x, y) { return y.linha - x.linha; }).forEach(function (x) {
    if (ultConf_(x.id, confs)) { plano.rel.push(['Não removido (já respondeu)', x.nome, 'linha mantida; resolva no painel']); return; }
    sh.deleteRow(x.linha); removidos.push(x);
  });
  plano.removidosOk = removidos;
  SpreadsheetApp.flush();
  var rel = garantirAba_('Harmonizacao', ['categoria', 'nome', 'detalhe']);
  rel.clearContents(); rel.getRange(1, 1, 1, 3).setValues([['categoria', 'nome', 'detalhe']]).setFontWeight('bold');
  var linhas = plano.rel.slice();
  plano.marcaAc.forEach(function (x) { linhas.push(['"+1" aplicado ao banco', x.nome, 'acompanhante = 1']); });
  plano.novos.forEach(function (x) { linhas.push(['Incluído no banco', x.nome, 'noite ' + x.dia + (x.acomp ? ' · com +1' : '') + ' · ' + x.id]); });
  linhas.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
  if (linhas.length) rel.getRange(2, 1, linhas.length, 3).setValues(linhas);
  rel.getRange(linhas.length + 3, 1).setValue('Última sincronização: ' + Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm:ss') + (quem ? ' · ' + quem : ''));
  try { rel.setColumnWidths(1, 1, 280); rel.setColumnWidths(2, 1, 260); rel.setColumnWidths(3, 1, 520); } catch (e) {}
  return {telefones: plano.tel.length, tipos: plano.tipo.length, incluidos: plano.novos.length, acZerados: plano.zeraAc.length, acIncluidos: plano.marcaAc.length, removidos: removidos.length, pendencias: plano.rel.length, resumo: plano.resumo};
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

/* sem menu: para rodar direto do editor do Apps Script (Executar) */
function sincronizarListaAgora() {
  var o = sincronizarLista_('editor'); atualizarPainelSeguro_();
  console.log(JSON.stringify(o)); return o;
}
