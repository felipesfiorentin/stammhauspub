# Histórico de mudanças

## 2026-11-23 (3)
- Página pública de reservas mais rápida: carrega só as noites abertas de hoje até +30 dias (sem passado e sem noites distantes); resposta em cache de 25 s (limpo a cada reserva/cancelamento); `?p=programacao` com a mesma janela.
- PC (≥900 px): calendário domingo→sábado, clicável; celular: lista vertical.

## 2026-11-23 (2)
- Horário do show por noite: padrão 20:30 (qua/qui) e 21:30 (sex/sáb); ajustável no painel (Editar programação › Horário do show; vazio/igual ao padrão = padrão). Programacao, coluna O. Aparece no dia do painel e no ingresso do site; vai junto ao mudar a data. `showPadrao_`.
- Reservas do público: até 10 pessoas (`max_pessoas_reserva` padrão 10) e aviso no formulário: acima disso, falar com a equipe pelo WhatsApp (link com mensagem pronta).
- Testes: `e2e25`; `e2e2`/`e2e6`/`e2e18` ajustados para 10; legados e2e2/e2e4 rodam com `fakedate17.js`.

## 2026-11-23
- Reservas (site): corrigido página sem noites. O backend devolvia as noites, mas o ingresso só tinha arte para os dias 18–21 (`BANDAS`) e as demais saíam vazias. Noites sem arte própria agora têm ingresso de texto (atração, estilo, data, abertura 18h, vagas). Texto de abertura deixou de citar "18 a 21 de novembro"/"quatro noites". Teste `e2e24`.

## 2026-11-22
- Painel › editar programação: campo "Data da atração" (move atração e contratação para outro dia; convidados e reservas já feitos ficam no dia original; destino com atração é recusado; não aceita data passada). Novo `gDiaMover`.
- Contratação: checkbox "Refeição" (banda sem consumação que janta a comida da equipe). Programacao, coluna M.
- Calendário do painel começa no domingo.
- Dias fechados: "Situação do dia" Aberto/Fechado (Programacao, coluna N). Padrão: domingo, segunda e terça fechados; linha com atração é aberta; dia fechado pode ser reaberto como exceção. Dia fechado sai do site e recusa reservas do público.
- Site: exibe a programação aberta e aceita reservas só dos próximos 30 dias (Config `reserva_antecedencia_dias`, padrão 30); noites além disso aparecem como "Reservas a partir de dd/mm"; servidor recusa reserva fora da janela.
- Testes: `e2e23`; os testes passam a rodar com relógio fixo (`node -r ./fakedate.js`, 19/11/2026) e o mock da planilha ganhou `clearContent` e 15 colunas.

## 2026-11-19 (6)
- Painel › dia: exportação da lista de portaria (convidados + reservas do dia) em duas opções: "Exportar PDF em ordem alfabética" e "Exportar PDF por grupo de reserva" (cada convite ou reserva como bloco, com celular, ordenado pelo titular). Nomes de arquivo `lista-portaria-alfabetica-AAAA-MM-DD` e `lista-portaria-por-grupo-AAAA-MM-DD`. "Imprimir lista" segue alfabética.
- Teste `e2e22`.

## 2026-11-19 (5)
- Painel › Nova reserva (equipe): campo "Número de pessoas" que abre a lista de nome e celular na quantidade pedida; sem limite por reserva para a equipe (teto de segurança de 300; o limite de `max_pessoas_reserva` vale só para o público). Celular opcional (se informado, mantém o formato e a checagem de repetição). Incluir/editar pessoa em reserva existente também sem limite e com celular opcional.
- Teste `e2e21`.

## 2026-11-19 (4)
- Correção: a página estática de confirmação (`/convidados/`) falhava com erro S99 ao confirmar/recusar/atualizar presença, porque essas três funções não estavam na lista do `doPost`. Liberadas; teste `e2e19` agora verifica que toda função chamada pelas páginas está na lista.

## 2026-11-19 (3)
- Painel › editar dia: campo "Lotação desta noite" (exceção à regra). Vale só para a noite; vazio volta ao teto padrão da Config (`teto_por_noite`). Guardado na coluna L da aba Programacao; só perfil GESTAO altera e a mudança vai para a Auditoria.
- Lista, reservas do público, trava de "lotado", mover convidado e cartões/PDF do painel passam a usar o teto da própria noite.
- Teste `e2e20`.

## 2026-11-19 (2)
- Painel › Convites por WhatsApp: botão "Enviar lembrete" ao lado de "Enviar convite" para quem ainda não confirmou (inclui quem recebeu só o convite físico, desde que tenha telefone) e "Lembrete de horário" para quem já confirmou.
- Mensagem de lembrete de confirmação reescrita: calorosa, avisa que convites sem resposta até as 14h do dia serão considerados desistência (Config `confirmar_ate`, padrão agora 14h).
- Novo fluxo "Lembretes de horário": mesa guardada até as 20h, depois oferecida a outros clientes; envio registrado na coluna O da aba Convidados.

## 2026-11-19
- Correção da tela branca no navegador embutido do Instagram/WhatsApp: páginas de reservas (`/reservas/`) e confirmação (`/convidados/`) agora são HTML estático no GitHub Pages e falam com o Apps Script por `fetch` POST (`doPost`, lista fechada de rotas `ROTAS_`). O Apps Script continua servindo as mesmas páginas como alternativa (`google.script.run`).
- Teste `e2e19`.

## 2026-11-15
- Landing page de redirecionamento (`index.html`, GitHub Pages) para o QR code, pois o tiny.cc bloqueou o link do Apps Script.
- Cards "ingresso vintage" por noite (papel/tinta); Lonesome Capitain com foto vertical; Hardways em faixa larga; Rodrigo Seidel com "e banda".
- Opção "Não poderei ir"; correção de fuso/data (quarta, 18/11); rodapé com endereço, telefone e crédito.
- Texto da landing do formulário: "Semana de Inauguração".

## Parte 2 — reservas do público + métricas
- Novo projeto público (`apps-script/publico`): reservas de 1 a 4 pessoas (nome completo e celular de todas), R$ 40,00 pagos na comanda, válida até 20h; sem busca nem lista de convidados.
- Mesma planilha, abas novas: `Reservas`, `Lotacao` (painel), `Acesso` (tokens das métricas).
- Teto de 81 pessoas/noite: convidados da lista são garantidos; "Não vai"/cancelamentos liberam vaga; ao atingir o teto a noite fica LOTADA.
- Página de métricas no projeto dos convidados (`?p=metricas&k=TOKEN`), acesso por token individual (aba `Acesso`).
- Código dividido em `Comum` + módulos; `build.py` gera os dois projetos.

## Parte 3 — painel de gestão
- Nova página `?p=gestao&k=TOKEN` (projeto dos convidados): lotação por noite, confirmados/pendentes/não vão/público, e gestão por noite (mudar convidado ou reserva de dia, incluir convidado excepcional, editar status e nomes, criar/cancelar reserva, incluir/editar/remover pessoa).
- Acesso: token da aba `Acesso` + coluna G "gestão (SIM/NÃO)"; link em H. Toda gravação sob lock e registrada na aba `Auditoria`.
- Alterações que passam do teto de 81 exigem confirmação explícita ("Confirmar mesmo assim") e ficam marcadas como [forçado].
- Texto da home: "chopes artesanais" → "chopp de qualidade".

## Parte 4 — ingresso por WhatsApp (desligado por padrão)
- Fila `Whats` (Comum), envio no projeto público (`Whats.src.gs`): ingresso em imagem (Slides → PNG), Drive por dia, API da Meta, template com imagem.
- Ganchos em reserva, confirmação, cancelamento e gestão; cartão "Ingressos por WhatsApp" no painel de gestão (status e Reenviar).
- Roteiro de ativação em `docs/WHATSAPP.md`.

## Parte 5 — painel único com login
- Métricas e gestão numa só página: `<url dos convidados>?p=painel` (links antigos `?p=metricas|gestao` abrem a mesma página).
- Acesso por usuário e senha (aba `Usuarios`: usuario, nome, perfil GESTAO/CONSULTA, ativo SIM/NÃO, senha inicial). No primeiro acesso a pessoa define a própria senha (mín. 8; guardada só como hash com salt). Nova senha inicial na planilha = reset.
- Sessão de 6 h; 5 erros bloqueiam o usuário por 15 min; ativo=NÃO derruba a sessão na hora. CONSULTA vê tudo e não altera.
- Removidos: tokens (`Acesso`) e "Gerar tokens". `Metricas.src.gs` → `Setup.src.gs`.
- Painel: layout de computador (≥1024 px) com KPIs em 5 colunas, noites em grade (2 colunas; 4 em telas ≥1500 px), lista de pessoas ao lado de WhatsApp/movimentações/auditoria (coluna lateral fixa), cabeçalho fixo e hover; celular inalterado.

## Parte 6 — Agenda perpétua
- Painel vira calendário mensal (de hoje em diante, sem limite): cada dia mostra atração, lotação/teto, lista e público; clique abre o detalhe do dia (ingresso, KPIs, convidados, reservas, WhatsApp).
- Dias novos: "+ abrir dia" (GESTAO) grava na aba Programacao (chave AAAAMMDD; as 4 noites da inauguração mantêm a chave 18–21). Coluna F "reservas do público" (SIM/NÃO; vazio = SIM) controla se o dia aparece na página pública. Página pública lista só dias abertos e futuros.
- Exportar lista de portaria: PDF (gListaPdf, qualquer usuário logado) e "Imprimir lista"; nomes da lista + reservas, ordem alfabética, coluna OK.
- Login do painel com a logo padrão branco e dourado e "Área restrita"; /painel/ no site abre o login direto (iframe).
- Testes: e2e6.js (23 verificações).

## Parte 7 — envio manual do ingresso por WhatsApp (sem depender da Meta)
- Painel, detalhe do dia: botão "WhatsApp" por pessoa (convidados: titular e acompanhante; reservas do público: cada pessoa). Abre o WhatsApp do pub com o número e a mensagem prontos (noite, atração, protocolo; reserva traz validade e valor); a equipe só toca em enviar.
- `estadoGestao_` passa a devolver `prot` (C+linha) do convidado confirmado.
- Teste novo: `tests/e2e7.js`.

## Parte 8 — lista da equipe → banco oficial, telefones e convites por WhatsApp
- `src/Lista.src.gs`: harmonização da planilha de trabalho "Lista de convidados" com a aba Convidados (telefone em J, tipo do convite em K, envio em L). Aplica só o seguro (telefones válidos, pessoas novas com noite definida, "+1" que ganhou nome) e escreve o resto na aba `Harmonizacao`. Idempotente. Menu Stammhaus > Sincronizar lista de convidados; botão no painel.
- Painel: tela "Convites WhatsApp" (filtros, KPIs, botão por pessoa com mensagem pronta, registro de envio, desfazer). Editar convidado ganha celular.
- `gConviteMarcar`, `gSincronizarLista`; `estadoGestao_` devolve tel, tipo, env.
- Dados de pessoas (telefones) NÃO ficam no repositório: a lista é lida da planilha na hora.
- Revisão da harmonização (lista reajustada pela equipe): casamento por grafia (Maicon/Maycon, Hoffman/Hoffmann), por apelido com mesmo sobrenome e noite (Beto/Roberto Olsen) com nome da lista em busca_extra; "+1" da lista vira acompanhante = 1 no banco e a linha do acompanhante que tinha nome (e a lista não traz mais) é removida se ainda não respondeu. `sincronizarListaAgora` roda sem menu.
- Parte 9 (convites por WhatsApp pela API, projeto público): `processarConvitesWhats` (gatilho de 1 min, 15 por rodada, máx. 200/dia) envia o template de convite (Marketing, `convite_inauguracao`: nome, noite, atração, acompanhante) a quem tem celular válido (col J) e coluna L vazia; grava L (data) e M (situação: ENVIADO · wamid / ERRO n / FALHOU). Liga/desliga em Config `convites_ativo`. `instalarConvitesWhats`, `resumoConvitesWhats`, `testeConviteWhats`. Teste: tests/e2e9.js.

- Painel de gestão: celular digitado sem máscara (47996015131, +55…) é normalizado para (47) 99601-5131 antes de validar (status do convidado, edição, reservas). Teste: tests/e2e10.js.
- Painel (calendário): barra superior com pessoas listadas, convidadas (convite enviado), confirmadas e entrada estimada; removido 'dias com programação'; cada dia mostra listadas/convidadas/confirmadas.
- Reservas do público: máximo de 2 pessoas por reserva (teto fixo no código, vale mesmo se Config max_pessoas_reserva for maior).
- Site: página inicial enxuta (sem parreiral/Kaffee, Heineken resumida, sem último box); nova aba Programação lê as noites da planilha via ?p=programacao do projeto do público.

Atenção (deploy do projeto do público): apps-script/publico/Code.gs vem com o marcador __SHEET_ID__; antes de colar no editor, troque pelo ID real da planilha (build.py --sheet-id) ou o projeto perde o acesso à planilha.
- Painel > Convites WhatsApp: botão 'Exportar todos (PDF)' (convidados por noite com status, celular, pessoas, titular/acompanhante e envio). Teste: tests/e2e13.js.

## Correção: nomes parecidos e convites duplicados
- `nomesIguais_` agora é estrito (palavras iguais ou foneticamente idênticas): Helon ≠ Heron. O titular digitando o próprio nome tem precedência sobre outros convites (`regrasUnicidade_`/`pontuaTitular_`).
- Sincronização da lista (`Lista.src.gs`): mesmo celular + mesma noite + nome com grafia parecida (palavras de 6+ letras com 1 letra de diferença) = mesma pessoa; não cria convite novo e remove duplicata já existente (mantém o mais antigo, nome vai para busca_extra).
- Testes: e2e14 (lista), e2e15 (unicidade).

## Mesma pessoa em mais de uma noite
- Inclusão no painel só barra nome duplicado na MESMA noite; confirmação e sincronização da lista tratam nome+noite (e2e16).

## Contratação das atrações (interno)
- Programacao colunas G-K: cachê, nº integrantes, consumação/integrante, estadia, transporte. Só perfil GESTAO recebe (`contrato` em estadoGestao_); não é lido pelo projeto público. Modal "Editar programação" + resumo com custo total no detalhe do dia. Teste e2e17.

## Reservas até 8 pessoas (hiperparâmetro) + lembrete de confirmação
- `max_pessoas_reserva` (aba Config) agora manda: padrão 8, limite de segurança 20; migração única do valor antigo 2 -> 8 em prepararReservas. Nova chave `confirmar_ate` (12h).
- Painel > Convites WhatsApp > "Lembretes de confirmação": só convidados sem resposta, mensagem pedindo confirmação até as 12h do dia do evento, envio semi-automático por wa.me; registro na coluna N da aba Convidados (`gLembreteMarcar`). Testes e2e18.
- Deploy do projeto PÚBLICO exige trocar `__SHEET_ID__` pelo ID real.

## Seletor de quantidade pelas vagas
- Página pública mostra só as quantidades que cabem (1 até min(vagas restantes, máx. por reserva)); servidor já recusava excesso (sem_vagas). Teste em e2e2.
