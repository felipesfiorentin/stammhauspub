# Histórico de mudanças

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

