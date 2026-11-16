const fs=require('fs');const s=fs.readFileSync('/home/claude/stammhauspub/src/Comum.src.gs','utf8');
let ok=/maxPessoas: Math\.min\(Number\(o\.max_pessoas_reserva\) \|\| 2, 2\)/.test(s);console.log((ok?'PASS':'FAIL')+' teto de 2 pessoas por reserva do público mesmo com Config maior');process.exit(ok?0:1)
