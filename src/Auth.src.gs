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
