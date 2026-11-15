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
