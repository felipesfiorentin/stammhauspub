/* ---------- ENVIO DO INGRESSO POR WHATSAPP (API oficial da Meta) ----------
 * Projeto PÚBLICO. Lê a fila (aba "Whats"), gera a imagem do ingresso de cada pessoa a partir de um modelo no Google Slides,
 * salva no Drive (pasta 09-Agendamentos/AAAA-MM-DD), envia a mídia à Meta e dispara o template com a imagem no cabeçalho.
 * Configuração em Propriedades do Script (nunca no código): WA_TOKEN, WA_PHONE_ID, WA_TEMPLATE (padrão ingresso_confirmacao),
 * WA_IDIOMA (padrão pt_BR), WA_PASTA_RAIZ (id da pasta 09-Agendamentos). Liga/desliga: Config whatsapp_ativo = SIM/NAO. */

var WA_API = 'https://graph.facebook.com/v23.0/';
var WA_PASTA_PADRAO = '1V6KCyRei2MhHY-suw1e6kSMnpJpYZ0m7';   // 09-Agendamentos
var WA_MAX_TENT = 3;

function waProp_(k, padrao) { return PropertiesService.getScriptProperties().getProperty(k) || padrao || ''; }
function waPronto_() { return !!(waProp_('WA_TOKEN') && waProp_('WA_PHONE_ID')); }
function waNum_(tel) { var d = digitos_(tel); return d.length <= 11 ? '55' + d : d; }

/* ===== imagem do ingresso ===== */
var ING = {W: 1000, H: 520};   // pontos do slide (proporção ~1,92:1)

/* cria (uma vez) o modelo de ingresso de cada noite no Slides e guarda o id nas propriedades. Rodar manualmente. */
function criarModelosIngresso() {
  var prog = prog_(), cfg = cfg_(), props = PropertiesService.getScriptProperties();
  Object.keys(prog).map(Number).sort().forEach(function (d) {
    if (props.getProperty('WA_MODELO_' + d)) return;
    var r = UrlFetchApp.fetch('https://slides.googleapis.com/v1/presentations', {
      method: 'post', contentType: 'application/json', headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
      payload: JSON.stringify({title: 'Modelo ingresso · noite ' + d, pageSize: {width: {magnitude: ING.W, unit: 'PT'}, height: {magnitude: ING.H, unit: 'PT'}}})
    });
    var id = JSON.parse(r.getContentText()).presentationId, pres = SlidesApp.openById(id), s = pres.getSlides()[0];
    s.getPageElements().forEach(function (e) { try { e.remove(); } catch (_) {} });
    desenharModelo_(s, prog[d], cfg);
    pres.saveAndClose();
    props.setProperty('WA_MODELO_' + d, id);
  });
}

function caixa_(s, tipo, x, y, w, h, cor, texto, tam, fonte, negrito, alinha) {
  var sh = s.insertShape(tipo, x, y, w, h);
  sh.getFill().setSolidFill(cor || '#113325'); sh.getBorder().setTransparent();
  if (texto !== undefined) {
    sh.getFill().setTransparent();
    var t = sh.getText(); t.setText(texto);
    t.getTextStyle().setFontFamily(fonte || 'Inter').setFontSize(tam || 18).setBold(!!negrito).setForegroundColor(cor || '#EAE7DA');
    t.getParagraphStyle().setParagraphAlignment(alinha || SlidesApp.ParagraphAlignment.START);
  }
  return sh;
}

function desenharModelo_(s, p, cfg) {
  var R = SlidesApp.ShapeType.RECTANGLE, A = SlidesApp.ParagraphAlignment;
  s.getBackground().setSolidFill('#113325');
  var borda = s.insertShape(R, 18, 18, ING.W - 36, ING.H - 36); borda.getFill().setTransparent();
  borda.getBorder().getLineFill().setSolidFill('#B47E00'); borda.getBorder().setWeight(3);
  caixa_(s, R, 60, 46, ING.W - 120, 40, '#B47E00', 'DAS STAMMHAUS PUB · SEMANA DE INAUGURAÇÃO', 20, 'Playfair Display', true, A.CENTER);
  caixa_(s, R, 60, 110, ING.W - 120, 70, '#EAE7DA', 'INGRESSO', 54, 'Playfair Display', true, A.CENTER);
  caixa_(s, R, 60, 200, ING.W - 120, 60, '#EAE7DA', '{{NOME}}', 40, 'Playfair Display', true, A.CENTER);
  caixa_(s, R, 60, 275, ING.W - 120, 36, '#B47E00', '{{DIA}}', 26, 'Inter', true, A.CENTER);
  caixa_(s, R, 60, 315, ING.W - 120, 34, '#EAE7DA', '{{ATRACAO}}', 22, 'Inter', false, A.CENTER);
  caixa_(s, R, 60, 380, ING.W - 120, 30, '#EAE7DA', 'Protocolo {{PROT}} · válido até ' + (cfg.reservaAte || '20h') + ' · R$ ' + cfg.valor.toFixed(2).replace('.', ',') + ' na comanda', 18, 'Inter', false, A.CENTER);
  caixa_(s, R, 60, 440, ING.W - 120, 30, '#B47E00', 'O QUE É BOM RESISTE AO TEMPO.', 18, 'Playfair Display', true, A.CENTER);
}

function waSlug_(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'pessoa'; }

/* gera o PNG do ingresso: copia o modelo da noite, troca os marcadores, exporta a miniatura */
function ingressoImagem_(dia, nome, prot, prog) {
  var modelo = waProp_('WA_MODELO_' + dia);
  if (!modelo) throw new Error('WA_SEM_MODELO: rode criarModelosIngresso');
  var cop = DriveApp.getFileById(modelo).makeCopy('tmp ingresso ' + prot + ' ' + waSlug_(nome)), id = cop.getId();
  try {
    var pres = SlidesApp.openById(id), s = pres.getSlides()[0], p = prog[dia] || {};
    s.replaceAllText('{{NOME}}', nome); s.replaceAllText('{{DIA}}', p.label || ('Noite ' + dia)); s.replaceAllText('{{ATRACAO}}', p.atracao || ''); s.replaceAllText('{{PROT}}', prot);
    pres.saveAndClose(); Utilities.sleep(1500);
    var th = UrlFetchApp.fetch('https://slides.googleapis.com/v1/presentations/' + id + '/pages/' + pres.getSlides()[0].getObjectId() + '/thumbnail?thumbnailProperties.thumbnailSize=LARGE&thumbnailProperties.mimeType=PNG',
      {headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}});
    return UrlFetchApp.fetch(JSON.parse(th.getContentText()).contentUrl).getBlob().setName('ingresso_' + prot + '_' + waSlug_(nome) + '.png');
  } finally { try { cop.setTrashed(true); } catch (_) {} }
}

function pastaDia_(iso) {
  var raiz = DriveApp.getFolderById(waProp_('WA_PASTA_RAIZ', WA_PASTA_PADRAO)), it = raiz.getFoldersByName(iso || 'sem-data');
  return it.hasNext() ? it.next() : raiz.createFolder(iso || 'sem-data');
}

/* ===== API da Meta ===== */
function waUpload_(blob) {
  var r = UrlFetchApp.fetch(WA_API + waProp_('WA_PHONE_ID') + '/media', {method: 'post', muteHttpExceptions: true,
    headers: {Authorization: 'Bearer ' + waProp_('WA_TOKEN')}, payload: {messaging_product: 'whatsapp', type: blob.getContentType(), file: blob}});
  var j = JSON.parse(r.getContentText() || '{}');
  if (r.getResponseCode() >= 300 || !j.id) throw new Error('WA_UPLOAD ' + r.getResponseCode() + ': ' + (j.error && j.error.message || r.getContentText()).slice(0, 150));
  return j.id;
}

function waEnviar_(tel, mediaId, nome, dia, prot, prog) {
  var p = prog[dia] || {};
  var body = {messaging_product: 'whatsapp', recipient_type: 'individual', to: waNum_(tel), type: 'template', template: {
    name: waProp_('WA_TEMPLATE', 'ingresso_confirmacao'), language: {code: waProp_('WA_IDIOMA', 'pt_BR')},
    components: [
      {type: 'header', parameters: [{type: 'image', image: {id: mediaId}}]},
      {type: 'body', parameters: [{type: 'text', text: String(nome).split(' ')[0]}, {type: 'text', text: p.label || ('Noite ' + dia)}, {type: 'text', text: p.atracao || '-'}, {type: 'text', text: prot}]}
    ]}};
  var r = UrlFetchApp.fetch(WA_API + waProp_('WA_PHONE_ID') + '/messages', {method: 'post', muteHttpExceptions: true, contentType: 'application/json',
    headers: {Authorization: 'Bearer ' + waProp_('WA_TOKEN')}, payload: JSON.stringify(body)});
  var j = JSON.parse(r.getContentText() || '{}');
  if (r.getResponseCode() >= 300 || !j.messages) throw new Error('WA_ENVIO ' + r.getResponseCode() + ': ' + (j.error && j.error.message || r.getContentText()).slice(0, 150));
  return j.messages[0].id;
}

/* ===== processamento da fila (gatilho de 1 min) ===== */
function processarFilaWhats() {
  if (!cfg_().waAtivo || !waPronto_()) return {ok: false, motivo: 'desligado ou sem credenciais'};
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return {ok: false, motivo: 'ocupado'};
  var ini = Date.now(), feitos = 0;
  try {
    var sh = abaWa_(), n = sh.getLastRow(), prog = prog_();
    if (n < 2) return {ok: true, feitos: 0};
    var v = sh.getRange(2, 1, n - 1, WA_CAB.length).getValues();
    for (var i = 0; i < v.length && feitos < 8 && Date.now() - ini < 240000; i++) {
      var r = v[i], li = i + 2;
      if (r[6] !== 'PENDENTE') continue;
      var tent = Number(r[7]) || 0, dia = Number(r[3]), nome = String(r[4]), prot = String(r[2]);
      try {
        var blob = ingressoImagem_(dia, nome, prot, prog);
        try { pastaDia_(prog[dia] && prog[dia].iso).createFile(blob); } catch (e1) { /* guardar no Drive não pode impedir o envio */ }
        var wamid = waEnviar_(r[5], waUpload_(blob), nome, dia, prot, prog);
        sh.getRange(li, 7, 1, 5).setValues([['ENVIADO', tent + 1, wamid, '', new Date()]]);
      } catch (e) {
        sh.getRange(li, 7, 1, 5).setValues([[tent + 1 >= WA_MAX_TENT ? 'FALHOU' : 'PENDENTE', tent + 1, '', String(e.message).slice(0, 200), new Date()]]);
        registrarErro_('WA', 'processarFilaWhats', 'S99', e);
      }
      feitos++;
    }
    return {ok: true, feitos: feitos};
  } finally { lock.releaseLock(); }
}

/* instala o gatilho de 1 minuto (rodar uma vez, depois de configurar as credenciais) */
function instalarFilaWhats() {
  var tem = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'processarFilaWhats'; });
  if (!tem) ScriptApp.newTrigger('processarFilaWhats').timeBased().everyMinutes(1).create();
}

/* teste: envia um ingresso de exemplo para um celular (rodar no editor, passando o número) */
function testeWhats() {
  var tel = waProp_('WA_TESTE_TEL'); if (!tel) throw new Error('Defina a propriedade WA_TESTE_TEL (ex.: 47999999999)');
  var prog = prog_(), dia = Number(Object.keys(prog).sort()[0]), blob = ingressoImagem_(dia, 'Teste Stammhaus', 'TESTE', prog);
  return waEnviar_(tel, waUpload_(blob), 'Teste Stammhaus', dia, 'TESTE', prog);
}
