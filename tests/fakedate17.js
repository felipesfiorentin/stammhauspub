const R=Date,F=new R('2026-11-17T15:00:00-03:00').getTime(),off=F-R.now();
class D extends R{constructor(...a){if(a.length===0)super(R.now()+off);else super(...a)}static now(){return R.now()+off}}
global.Date=D;
