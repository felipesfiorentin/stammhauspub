# Das Stammhaus Pub · Confirmação de presença (Semana de Inauguração, 18–21/11/2026)

Sistema de RSVP aberto, em Google Apps Script ligado a uma Google Sheet. O QR code dos convites aponta para o link curto do tiny.cc, que aponta para a landing em GitHub Pages, que encaminha para o formulário (web app do Apps Script).

## Estrutura
| Pasta/arquivo | Conteúdo |
|---|---|
| `index.html` | Landing de redirecionamento (publicada via GitHub Pages) |
| `landing/` | Cópia da landing |
| `apps-script/` | Arquivos para colar no Apps Script: `Code.gs`, `Index.html`, `appsscript.json` (gerados) |
| `src/` | Fontes: `Busca.src.gs`, `Code.src.gs`, `Index.template.html`, imagens dos cards e `build.py` |
| `docs/publicacao.md` | Passo a passo de publicação e uso |
| `tests/` | `e2e.js`, `tz.js`, `shot_cards.py` (precisam do `convidados.json`, que não é versionado) |

## Fluxo de trabalho
1. Editar os arquivos em `src/`.
2. Rodar `python3 src/build.py` (regera `apps-script/`).
3. Colar `apps-script/Code.gs` e `apps-script/Index.html` no projeto do Apps Script.
4. Implantar → Gerenciar implantações → Editar → Nova versão → Implantar.

## Dados
A lista de convidados e a planilha ficam só no Google Drive. Não versionar (`.gitignore`).
