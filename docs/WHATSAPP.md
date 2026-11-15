# Ingresso por WhatsApp — roteiro de ativação

Estado: código pronto e **desligado** (Config `whatsapp_ativo = NAO`). Nada é enviado até concluir os passos abaixo.

## Como funciona
1. Reserva do público / confirmação de convidado → linhas `PENDENTE` na aba `Whats` (uma por pessoa; convidado e acompanhante têm cada um o seu; sem celular do acompanhante usa o do titular).
2. O projeto **público** roda `processarFilaWhats` a cada 1 min: gera o PNG do ingresso (modelo no Google Slides), salva em `09-Agendamentos/AAAA-MM-DD`, envia a mídia à Meta e dispara o template com a imagem no cabeçalho.
3. Resultado na aba `Whats` (ENVIADO + wamid, ou erro; 3 tentativas, depois FALHOU) e no painel de gestão (botão Reenviar).
4. Falha do WhatsApp nunca desfaz reserva/confirmação. Cancelar/mover de noite cancela o pendente e reenfileira.

## Passos (nesta ordem)
1. Meta: negócio verificado + WhatsApp Business Platform; conectar o número 47 99250-5290 por **coexistência** (app Business versão 2.24.17+).
2. Meta: criar o template `ingresso_confirmacao` (pt_BR, categoria Utility), cabeçalho **imagem**, corpo com 4 variáveis: {{1}} primeiro nome, {{2}} noite, {{3}} atração, {{4}} protocolo.
3. Projeto público → Configurações → Propriedades do script: `WA_TOKEN` (token permanente de usuário do sistema), `WA_PHONE_ID`. Opcionais: `WA_TEMPLATE`, `WA_IDIOMA`, `WA_PASTA_RAIZ`, `WA_TESTE_TEL`.
4. Implantar o código (novos escopos: Drive, Slides, chamadas externas) e **autorizar** rodando `criarModelosIngresso` no editor (cria os 4 modelos de ingresso no Slides).
5. Rodar `testeWhats` (envia a um número de teste). Conferir a imagem e o texto.
6. Rodar `instalarFilaWhats` (gatilho de 1 min).
7. Config da planilha: `whatsapp_ativo = SIM`.
