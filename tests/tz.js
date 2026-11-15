const fs=require('fs'),vm=require('vm');
function run(sheetTz,iso){
 const fmt=(d,tz,f)=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).reduce((a,x)=>(a[x.type]=x.value,a),{});
  return f==='yyyy-MM-dd'?`${p.year}-${p.month}-${p.day}`:f==='dd/MM'?`${p.day}/${p.month}`:f==='u'?String(new Date(Date.UTC(+p.year,+p.month-1,+p.day)).getUTCDay()||7):'?'};
 const rows=[[18,new Date(iso),'Lonesome Capitain · Country & Folk','Formal','@x']];
 const sh={getLastRow:()=>2,getRange:()=>({getValues:()=>rows})};
 const ctx={Utilities:{formatDate:fmt},SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:()=>sh,getSpreadsheetTimeZone:()=>sheetTz})},console};
 vm.createContext(ctx);
 const src=fs.readFileSync('/home/claude/stammhaus/Code.gs','utf8');
 vm.runInContext(src+';this.r=prog_();',ctx);
 return ctx.r[18].label;
}
console.log('planilha GMT, 00:00 GMT      ->',run('GMT','2026-11-18T00:00:00Z'));
console.log('planilha SP,  00:00 SP       ->',run('America/Sao_Paulo','2026-11-18T03:00:00Z'));
console.log('planilha NY,  00:00 NY       ->',run('America/New_York','2026-11-18T05:00:00Z'));
console.log('planilha SP mas data gravada 00:00 GMT ->',run('America/Sao_Paulo','2026-11-18T00:00:00Z'));
console.log('planilha GMT mas data gravada 00:00 SP ->',run('GMT','2026-11-18T03:00:00Z'));
