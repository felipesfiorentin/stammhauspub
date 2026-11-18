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
  try {   // migração: o valor antigo (teto fixo de 2) vira 8 uma única vez; depois é livre para editar
    var vals = sc.getRange(1, 1, Math.max(sc.getLastRow(), 1), 3).getValues();
    vals.forEach(function (r, i) { if (String(r[0]).trim() === 'max_pessoas_reserva' && /teto fixo de 2/.test(String(r[2] || ''))) { sc.getRange(i + 1, 2).setValue(8); sc.getRange(i + 1, 3).setValue('Máximo de pessoas por reserva do público (editável; de 1 a 20).'); } });
  } catch (e) {}
  [['teto_por_noite', 81, 'Teto de pessoas por noite: 74 + 10%. Lista garantida + reservas do público; ao chegar nesse número a noite aparece como LOTADA.'],
   ['valor_ingresso', 40, 'R$ por pessoa (público geral), pago junto à quitação da comanda na noite.'],
   ['max_pessoas_reserva', 8, 'Máximo de pessoas por reserva do público (editável; de 1 a 20).'],
   ['confirmar_ate', '12h', 'Horário-limite pedido no lembrete de confirmação por WhatsApp, no dia do evento (só texto da mensagem).'],
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
