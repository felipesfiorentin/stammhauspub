# Publicação — Confirmação de presença (Das Stammhaus Pub)

## 1. Planilha
1. Google Drive → Novo → Google Planilhas → Arquivo → Importar → enviar `Stammhaus_Planilha_Base.xlsx` → "Substituir planilha".
2. Aba `Config`: confira `capacidade_por_noite` (74). Preencha `whatsapp_contato` e `horario` se quiser (opcionais).
3. Aba `Programacao`: confira datas e atrações.

## 2. Código
**Regra de ouro:** o script precisa ser aberto **de dentro da planilha que você vai usar** (menu Extensões → Apps Script, com essa planilha aberta). É assim que ele sabe onde gravar. Se abrir o Apps Script por outro caminho (script.google.com → Novo projeto), ele não fica ligado à planilha.
1. Com a planilha aberta: Extensões → Apps Script.
2. Configurações do projeto (engrenagem) → marque "Mostrar arquivo de manifesto appsscript.json" → em Editor, cole o conteúdo de `appsscript.json`.
3. Em `Code.gs`, cole o conteúdo de `Code.gs` (arquivo único; já inclui a busca de nomes).
4. Arquivos (+) → HTML → nome `Index` → cole `Index.html`.
5. Salvar. No painel "Arquivos" devem aparecer apenas `Code.gs` e `Index.html`.

## 3. Publicar
1. Implantar → Nova implantação → tipo "App da Web".
2. Executar como: **Eu**. Quem pode acessar: **Qualquer pessoa**.
3. Implantar → autorizar o acesso à planilha → copiar a URL terminada em `/exec`.
4. Aponte o link mirror do QR para essa URL.
5. Para atualizar o código depois: Implantar → Gerenciar implantações → editar → Nova versão (a URL não muda).

## 4. Teste antes de divulgar
1. Abra a URL no celular, em aba anônima.
2. Busque um nome da lista (com uma letra errada), confirme, depois volte e teste alterar/cancelar.
3. Apague as linhas de teste da aba `Confirmacoes`.

## 5. Equipe de gestão
Compartilhe a planilha com os e-mails da equipe como **Editor**. Painel em tempo real na aba `Painel`; check-in na porta na coluna L de `Confirmacoes`.

## 6. Se aparecer erro na página
A página mostra um **código** (ex.: `S04`) e uma referência. O mesmo erro fica registrado na aba `Erros` da planilha.
Na planilha, recarregue a página e use o menu **Stammhaus → Diagnóstico do sistema** (autorize na primeira vez). Ele lista o que está certo (✔) e o que está errado (✘).

| Código | Significado | O que fazer |
|---|---|---|
| S01 | Aba da planilha não encontrada | Confirme os nomes exatos das abas: Convidados, Confirmacoes, Programacao, Config |
| S02 | Aba Convidados vazia | Reimporte a planilha base |
| S03 | Dados fora do formato | Reimporte a planilha base; não apague colunas |
| S04 | Código incompleto (falta a função de busca) | Cole o `Code.gs` completo no arquivo `Code.gs` e faça Nova versão |
| S05 | Ambiente V8 desativado | Cole o `appsscript.json` (passo 2.2) |
| S06 | Muitos acessos ao mesmo tempo | Aguardar alguns segundos e tentar de novo |
| S07 | Limite de uso do Google | Aguardar; se persistir, avisar |
| S08 | Permissão pendente | Refazer Implantar → autorizar acesso |
| S99 | Erro não classificado | Ver a mensagem na aba `Erros` |
| C01 | Falha de comunicação com o servidor | Internet do convidado, ou implantação sem autorização/versão antiga |
| C02 | Resposta vazia | Mesmo que C01 |
| C03 | Tempo esgotado (30 s) | Tentar de novo |

**Importante:** sempre que alterar o código, faça Implantar → Gerenciar implantações → lápis (Editar) → Versão: **Nova versão** → Implantar. Sem isso, o link `/exec` continua rodando a versão antiga.

## 7. Confirmação feita por engano ou por outra pessoa
- O nome do convite é travado: ele só pode ser completado com sobrenomes, nunca trocado.
- Se alguém confirmou o convite de outra pessoa (com o próprio telefone), o convidado verdadeiro verá "já está confirmada" e pedirá ajuda pelo WhatsApp.
- Para liberar o convite: aba `Confirmacoes`, coluna **J (status)**, troque `Confirmado` por `Cancelado`. O convite fica livre para ser confirmado de novo e as vagas são devolvidas ao `Painel`.
- Na porta, confira o documento com o nome do convite (coluna C) e marque `Sim` na coluna L.

## 8. Resposta "Não poderei ir"

- Na tela do convite, a pessoa escolhe entre **"Sim, eu vou"** e **"Não poderei ir"**. Quem recusa informa só o celular; o nome vem da lista.
- Na aba `Confirmacoes` a linha fica com status `Não vai` e 0 pessoas. Não ocupa vaga e não aparece nos totais do `Painel`.
- Para mudar de ideia, a pessoa volta ao link, digita o nome e informa o mesmo celular. A linha antiga vira `Substituído` e nasce uma linha `Confirmado`.
- Opcional: na aba `Convidados`, coluna H, para mostrar "Não vai" em vez de "Pendente", troque a fórmula de H2 por:
  `=IF(COUNTIFS(Confirmacoes!$B$2:$B$2000,A2,Confirmacoes!$J$2:$J$2000,"Confirmado")>0,"Confirmado",IF(COUNTIFS(Confirmacoes!$B$2:$B$2000,A2,Confirmacoes!$J$2:$J$2000,"Não vai")>0,"Não vai","Pendente"))`
  e arraste até a última linha.
