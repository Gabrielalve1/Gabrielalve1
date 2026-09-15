(function(root){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
const cash=x=>Math.round(Number(x||0)*100)/100;
const dateKey=(d=new Date())=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&dateKey(new Date(s+'T12:00:00'))===s;
const monthDays=m=>Array.from({length:new Date(Number(m.slice(0,4)),Number(m.slice(5)),0).getDate()},(_,i)=>m+'-'+String(i+1).padStart(2,'0'));
const defaults={goal:4000,salary:0,saveGoal:0,reservePct:0,weekdays:[1,2,3,4,5],flexible:true,flexDays:0,flexClosed:0,bills:[]};
function empty(){return{version:6,revision:0,updatedAt:null,defaults:copy(defaults),months:{},days:{},personal:[],legacy:null};}
function plan(s,m,today=dateKey()){
 if(s.months[m])return s.months[m];
 return{...copy(s.defaults),configured:false,start:m===today.slice(0,7)?today:m+'-01',salaryReceived:0,bills:s.defaults.bills.map(b=>({...b,paid:false}))};
}
function migrate(old,today=dateKey(),version=4){
 const s=empty();s.legacy=copy(old);
 s.defaults={...copy(defaults),salary:Number(old.salary)||0,goal:version===4?(Number(old.goal)||4000):4000,bills:(old.bills||[]).map((b,i)=>({id:'old-bill-'+i,name:String(b.name||'Conta'),amount:cash(b.amount)}))};
 for(const t of old.tx||[]){
  if(!validDate(t.date))continue;
  if(t.type==='uber'||t.type==='uber_cost'){
   const d=s.days[t.date]||(s.days[t.date]={date:t.date,gross:0,fuel:0,other:0,hours:0,km:0,trips:0,note:'Importado da versão anterior. Confira os custos deste dia.',status:'closed',target:null});
   d[t.type==='uber'?'gross':'other']=cash(d[t.type==='uber'?'gross':'other']+Number(t.amount||0));
  }else s.personal.push({id:'legacy-'+s.personal.length,date:t.date,amount:cash(t.amount),kind:['salary','income'].includes(t.type)?'income':'expense',name:String(t.desc||'Lançamento anterior')});
 }
 const months=new Set([today.slice(0,7),...(old.tx||[]).filter(t=>validDate(t.date)).map(t=>t.date.slice(0,7))]);
 for(const m of months){s.months[m]=plan(s,m,today);s.months[m].start=m+'-01';}
 s.migrationNote='Seus registros anteriores foram preservados. Confira sua agenda e meta; o salário cadastrado era uma previsão. Informe o valor recebido em Meu dinheiro.';
 return s;
}
function calculate(s,m,today=dateKey()){
 const p=plan(s,m,today),dates=monthDays(m),days=Object.values(s.days).filter(d=>d.date.startsWith(m));
 const worked=days.filter(d=>d.status!=='rest'),closed=worked.filter(d=>d.status==='closed');
 const sum=(a,k)=>cash(a.reduce((v,d)=>v+Number(d[k]||0),0));
 const scheduled=date=>!p.flexible&&date>=p.start&&p.weekdays.includes(new Date(date+'T12:00:00').getDay());
 let remaining=dates.filter(date=>date>=today&&(p.flexible||scheduled(date)||s.days[date]?.status==='open')&& !['closed','rest'].includes(s.days[date]?.status));
 if(p.flexible){const used=Math.max(0,closed.length-(p.flexClosed||0));remaining=remaining.slice(0,Math.max(0,(p.flexDays||0)-used));}
 const opening=p.opening,oldRows=opening?worked.filter(d=>d.date<=opening.through):[];
 const openingAmount=opening?cash(Math.max(0,opening.total-sum(oldRows,'gross'))):0;
 const openingCost=opening?.costsKnown?cash(Math.max(0,opening.cost-sum(oldRows,'fuel')-sum(oldRows,'other'))):0;
 const unknownCosts=openingAmount>0&&!opening?.costsKnown;
 const gross=cash(sum(worked,'gross')+openingAmount),cost=cash(sum(worked,'fuel')+sum(worked,'other')+openingCost),net=cash(gross-cost),usableNet=cash(net-(unknownCosts?openingAmount:0)),reserve=cash(Math.max(0,usableNet)*p.reservePct/100);
 const rem=cash(Math.max(0,p.goal-gross));
 const d=s.days[today],todayGross=m===today.slice(0,7)?Number(d?.gross||0):0;
 const goalToday=d?.target!=null?d.target:remaining.includes(today)?cash(Math.max(0,p.goal-(gross-todayGross))/remaining.length):null;
 const closedGross=sum(closed,'gross'),closedCost=cash(sum(closed,'fuel')+sum(closed,'other'));
 const avg=closed.length?cash(closedGross/closed.length):null,avgNet=closed.length?cash((closedGross-closedCost)/closed.length):null;
 const canProject=closed.length&&(!p.flexible||remaining.length||m<today.slice(0,7));
 const projection=canProject?cash(gross+remaining.reduce((a,date)=>a+Math.max(0,avg-(s.days[date]?.gross||0)),0)):null;
 const projectedNet=canProject&&!unknownCosts?cash(net+remaining.reduce((a,date)=>{const r=s.days[date];return a+(r?Math.max(0,avgNet-(r.gross-r.fuel-r.other)):avgNet)},0)):null;
 const rows=s.personal.filter(t=>t.date.startsWith(m)),extra=sum(rows.filter(t=>t.kind==='income'),'amount'),personalCost=sum(rows.filter(t=>t.kind==='expense'),'amount');
 const bills=sum(p.bills,'amount'),paid=sum(p.bills.filter(b=>b.paid),'amount');
 const available=cash(p.salaryReceived+extra+usableNet-reserve-personalCost-bills),canSave=cash(Math.min(p.saveGoal,Math.max(0,available))),free=cash(available-canSave);
 const projectedAvailable=projectedNet==null?null:cash(Math.max(p.salary,p.salaryReceived)+extra+projectedNet-Math.max(0,projectedNet)*p.reservePct/100-personalCost-bills);
 const missed=dates.filter(date=>date<today&&scheduled(date)&&!s.days[date]);
 const hours=sum(worked,'hours'),km=sum(worked,'km');
 return{p,dates,days,worked,closed,remaining,gross,cost,net,usableNet,openingAmount,openingCost,unknownCosts,reserve,rem,todayGross,goalToday,avg,avgNet,projection,projectedNet,extra,personalCost,bills,paid,available,canSave,free,projectedAvailable,missed,hours,km,trips:sum(worked,'trips'),scheduled};
}
function validate(s){
 const amount=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1e9;
 if(!s||s.version!==6||!s.months||!s.days||!Array.isArray(s.personal))throw Error('Arquivo de memória incompatível.');
 if(s.appliedLinks!=null&&(!Array.isArray(s.appliedLinks)||s.appliedLinks.some(x=>typeof x!=='string'||x.length>300)))throw Error('Histórico de importações inválido.');
 const checkPlan=(p,monthly=false)=>{
  if(!p||!['goal','salary','saveGoal','reservePct'].every(k=>amount(p[k]))||p.reservePct>100||!Array.isArray(p.weekdays)||p.weekdays.some(x=>!Number.isInteger(x)||x<0||x>6)||!Array.isArray(p.bills)||p.bills.length>300)throw Error('Planejamento inválido.');
  if(p.bills.some(b=>typeof b.id!=='string'||typeof b.name!=='string'||!amount(b.amount)))throw Error('Conta inválida.');
  if(monthly&&(!validDate(p.start)||!amount(p.salaryReceived)))throw Error('Mês inválido.');
  if(p.flexible!=null&&typeof p.flexible!=='boolean')throw Error('Agenda inválida.');
  if(p.flexDays!=null&&(!Number.isInteger(p.flexDays)||p.flexDays<0||p.flexDays>31))throw Error('Dias inválidos.');
  if(p.flexClosed!=null&&(!Number.isInteger(p.flexClosed)||p.flexClosed<0||p.flexClosed>31))throw Error('Contagem inválida.');
  if(p.opening&&(!validDate(p.opening.through)||!amount(p.opening.total)||!amount(p.opening.cost)||typeof p.opening.costsKnown!=='boolean'))throw Error('Acumulado anterior inválido.');
 };
 checkPlan(s.defaults);
 for(const [m,p] of Object.entries(s.months)){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(m))throw Error('Mês inválido.');checkPlan(p,true);if(!p.start.startsWith(m))throw Error('Início fora do mês.');}
 for(const [date,d] of Object.entries(s.days)){if(!validDate(date)||d.date!==date||!['open','closed','rest'].includes(d.status)||!['gross','fuel','other','hours','km','trips'].every(k=>amount(d[k]))||typeof d.note!=='string'||(d.target!=null&&!amount(d.target)))throw Error('Registro diário inválido.');}
 for(const t of s.personal){if(typeof t.id!=='string'||!validDate(t.date)||!amount(t.amount)||!['income','expense'].includes(t.kind)||typeof t.name!=='string')throw Error('Registro pessoal inválido.');}
 return s;
}
const api={copy,cash,dateKey,validDate,monthDays,empty,plan,migrate,calculate,validate};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Finance=api;
})(typeof window!=='undefined'?window:globalThis);
