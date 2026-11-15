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
