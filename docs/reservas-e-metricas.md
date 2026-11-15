# Reservas do público e métricas

**Links**
- Convidados: `https://stammhauspub.github.io/` (QR dos convites, via tiny.cc)
- Público: `https://stammhauspub.github.io/reservas/`
- Métricas: aba `Acesso` da planilha, coluna F (um link por pessoa)

**Regras (aba Config)**: `teto_por_noite`=81, `valor_ingresso`=40, `max_pessoas_reserva`=4, `reserva_valida_ate`=20h,
`pendente_conta_acompanhante`=SIM (convidado sem resposta conta titular + acompanhante), `url_app_convidados` (base dos links de métricas).

**Dar acesso às métricas**: escreva o nome na coluna A da aba `Acesso` → menu Stammhaus → "Gerar tokens de acesso (métricas)" → copie o link da coluna F.
**Revogar**: coluna C = `NÃO` (ou apague a linha).

**Atualizar o código**: editar em `src/`, rodar `python3 src/build.py` (gera `apps-script/`). Projeto público: o `SHEET_ID` fica como `__SHEET_ID__` no repositório e é preenchido só no Apps Script.
Cada mudança exige Implantar → Gerenciar implantações → Editar → Nova versão (mantém a mesma URL).
