const fs=require('fs');const s=fs.readFileSync('/home/claude/stammhauspub/src/Comum.src.gs','utf8');
let ok=/Math\.floor\(Number\(o\.max_pessoas_reserva\)\) \|\| 8, 20\)/.test(s)&&/confirmarAte/.test(s);console.log((ok?'PASS':'FAIL')+' teto de pessoas por reserva vem da Config (padrão 8, limite 20) e prazo de confirmação 12h');process.exit(ok?0:1)
