'use strict';
const F=window.Finance,KEY='meuDinheiro_v6',PREVIOUS=KEY+'_previous',$=id=>document.getElementById(id);
const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),number=n=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:1});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const monthName=m=>new Date(m+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
const pretty=d=>new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',weekday:'short'});
let today=F.dateKey(),selected=today.slice(0,7),tab='hoje',metricPeriod='month',S,lastStored=null,readOnly=false,toastTimer,editingDate=null,planBills=[];
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
function warning(text){$('critical').textContent=text;$('critical').hidden=false;}
function boot(){
 try{
  lastStored=localStorage.getItem(KEY);
  if(lastStored){try{S=F.validate(JSON.parse(lastStored));}catch(e){const previous=localStorage.getItem(PREVIOUS);if(!previous)throw e;S=F.validate(JSON.parse(previous));warning('Recuperamos a cópia local anterior. Baixe uma memória completa antes de continuar.');}}
  else{let raw=localStorage.getItem('meuDinheiro_v4'),v=4;if(!raw){raw=localStorage.getItem('meuDinheiro_v3');v=3;}S=raw?F.migrate(JSON.parse(raw),today,v):F.empty();F.validate(S);localStorage.setItem(KEY,JSON.stringify(S));lastStored=localStorage.getItem(KEY);}
 }catch(e){S=F.empty();readOnly=true;warning('Não foi possível abrir ou salvar sua memória. Seus dados existentes não foram apagados. Use um navegador com armazenamento permitido ou restaure uma cópia válida em Plano & memória.');}
 $('month').value=selected;render();
}
function snapshot(state,m){state.months[m]??=F.plan(state,m,today);return state.months[m];}
function commit(change,message='Salvo neste aparelho.',recover=false){
 if(readOnly&&!recover){toast('A memória está indisponível. Nenhum dado foi salvo.');return false;}
 try{
  if(!recover&&localStorage.getItem(KEY)!==lastStored){warning('O diário mudou em outra aba. Recarregue a página antes de salvar para não substituir informações mais novas.');return false;}
  const next=F.copy(S);change(next);F.validate(next);next.revision=(Number(S.revision)||0)+1;next.updatedAt=new Date().toISOString();const text=JSON.stringify(next);
  if(lastStored){try{localStorage.setItem(PREVIOUS,lastStored);}catch(e){/* Main write below determines success. */}}
  localStorage.setItem(KEY,text);S=next;lastStored=text;readOnly=false;render();toast(message);return true;
 }catch(e){warning('Não foi possível salvar: '+e.message+'. Mantenha esta página aberta e baixe uma cópia dos seus registros.');return false;}
}
function go(next){tab=next;document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!==tab);document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false');});if(tab==='plano')fillPlan();window.scrollTo({top:0,behavior:'auto'});}
function signed(id,v){$(id).textContent=money(v);$(id).classList.toggle('negative',v<0);}
function render(){
 const c=F.calculate(S,selected,today),isNow=selected===today.slice(0,7),d=S.days[today];
 $('pageTitle').textContent=isNow?'Seu Uber, organizado.':monthName(selected);
 $('saveStatus').textContent=readOnly?'Memória indisponível':S.updatedAt?'● Salvo neste aparelho':'● Memória neste aparelho';
 $('migration').hidden=!S.migrationNote;$('migration').textContent=S.migrationNote||'';
 $('onboarding').hidden=c.p.configured;
 const closed=d?.status==='closed',rest=d?.status==='rest',hasSlot=c.remaining.includes(today);
 $('heroLabel').textContent=!isNow?'ACOMPANHAMENTO DO MÊS':closed?'DIA ENCERRADO':rest?'HOJE É SUA FOLGA':!hasSlot?'HOJE NÃO ESTÁ NA AGENDA':'META DE HOJE';
 $('todayGoal').textContent=!isNow?money(c.gross):closed?money(d.gross-d.fuel-d.other):c.goalToday!=null?money(c.goalToday):'No seu ritmo';
 $('todayText').textContent=!isNow?'Total registrado neste mês. Seu histórico continua guardado.':closed?'Esse foi o lucro de hoje, após os custos informados.':rest?'A meta restante foi distribuída pelos próximos dias planejados.':!hasSlot?'Vai rodar mesmo assim? Registre o dia; ele também conta para sua meta.':'Atualize o total durante o dia e encerre quando terminar de rodar.';
 const ratio=isNow?(c.goalToday?Math.min(100,c.todayGross/c.goalToday*100):0):Math.min(100,c.gross/Math.max(1,c.p.goal)*100);
 $('todayProgress').style.width=Math.max(0,ratio)+'%';$('todayMade').textContent=isNow?'Feito: '+money(c.todayGross):'Meta: '+money(c.p.goal);
 $('todayMissing').textContent=isNow&&c.goalToday!=null?(c.todayGross>=c.goalToday?'Meta do dia alcançada ✓':'Faltam '+money(c.goalToday-c.todayGross)):'Faltam '+money(c.rem);
 $('todayButton').textContent=!isNow?'Abrir calendário deste mês →':d?'Revisar meu dia →':'+ Registrar meu dia';
 $('todayDate').textContent=pretty(today);$('monthPercent').textContent=Math.round(c.gross/Math.max(1,c.p.goal)*100)+'% de '+money(c.p.goal);
 renderPerformance(c);
 renderCheck(c,isNow);
 let title,text;
 if(!c.p.configured){title='Vamos dar direção ao seu mês.';text='Defina quando vai rodar e sua meta. Os ganhos que você já lançou continuam aqui.';}
 else if(c.rem===0){title='Meta do mês alcançada.';text='Você já faturou '+money(c.gross)+'. Continue acompanhando os custos para saber quanto fica com você.';}
 else if(!c.remaining.length){title=selected<today.slice(0,7)?'Seu mês ficou registrado.':c.p.flexible?'Você escolhe quando rodar.':'Não há mais dias na sua agenda.';text='Faltam '+money(c.rem)+' para a meta. '+(selected<today.slice(0,7)?'Seu histórico continua aqui.':c.p.flexible?'Para calcular uma meta diária, informe no Plano quantos dias ainda pretende rodar.':'Ajuste os dias planejados se ainda pretende rodar.');}
 else{title='Faltam '+money(c.rem)+' para sua meta.';text='Restam '+c.remaining.length+' dias planejados, contando os que estão em andamento. Para distribuir o valor que falta: '+money(F.cash(c.rem/c.remaining.length))+' adicionais por dia.';}
 $('coachTitle').textContent=title;$('coachText').textContent=text;$('coachFoot').textContent=c.closed.length+' dias encerrados · '+c.worked.filter(x=>x.status==='open').length+' em andamento · '+c.remaining.length+' pela frente';
 $('projection').textContent=c.projection==null?'Ainda sem média':money(c.projection);
 $('projectionText').textContent=c.projection==null?'Encerre seu primeiro dia para calcular uma previsão com seus resultados.':'Faturamento estimado no mês. Média dos dias encerrados: '+money(c.avg)+' por dia. '+(c.projection>=c.p.goal?'Nesse ritmo, a meta está ao alcance.':'Nesse ritmo, faltariam '+money(c.p.goal-c.projection)+' para a meta.');
 const rows=c.days.sort((a,b)=>b.date.localeCompare(a.date)),recent=rows.filter(d=>d.date<=today);$('recent').innerHTML=recent.length?recent.slice(0,3).map(dayRow).join(''):'<div class="empty">Responda se fez Uber hoje. Seu dia fica salvo aqui.</div>';
 renderHistory(c,rows);renderMoney(c);renderMemory();goPanelOnly();
}
function goPanelOnly(){document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!==tab);document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false');});}
function renderPerformance(month){
 const selectedDate=selected===today.slice(0,7)?today:F.monthDays(selected).at(-1),end=new Date(selectedDate+'T12:00:00');let start=new Date(end),label='Faturamento do mês';
 if(metricPeriod==='day'){label=selected===today.slice(0,7)?'Faturamento de hoje':'Faturamento do último dia';}
 if(metricPeriod==='week'){start.setDate(end.getDate()-6);label='Faturamento em 7 dias';}
 if(metricPeriod==='month'){start=new Date(selected+'-01T12:00:00');}
 if(metricPeriod==='year'){start=new Date(selected.slice(0,4)+'-01-01T12:00:00');label='Faturamento do ano';}
 const from=F.dateKey(start),to=F.dateKey(end),days=Object.values(S.days).filter(d=>d.status!=='rest'&&d.date>=from&&d.date<=to),sum=k=>F.cash(days.reduce((a,d)=>a+Number(d[k]||0),0));let gross=sum('gross'),cost=F.cash(sum('fuel')+sum('other'));
 let openings=[],unknown=false;if(metricPeriod==='month')openings=[month.p.opening].filter(Boolean);if(metricPeriod==='year')openings=Object.entries(S.months).filter(([m])=>m.startsWith(selected.slice(0,4))).map(([,p])=>p.opening).filter(Boolean);
 for(const opening of openings){const detailed=days.filter(d=>d.date<=opening.through),dg=F.cash(detailed.reduce((a,d)=>a+d.gross,0));gross=F.cash(gross+Math.max(0,opening.total-dg));if(opening.costsKnown){const dc=F.cash(detailed.reduce((a,d)=>a+d.fuel+d.other,0));cost=F.cash(cost+Math.max(0,opening.cost-dc));}else if(opening.total>dg)unknown=true;}
 const net=F.cash(gross-cost),trips=sum('trips'),hours=sum('hours'),km=sum('km'),ratio=(value,den)=>den?money(value/den):'—';
 $('periodLabel').textContent=label;$('gross').textContent=money(gross);$('cost').textContent=unknown?money(cost)+'*':money(cost);$('net').textContent=unknown?'A calcular':money(net);
 $('metricTrips').textContent=trips?number(trips):'—';$('metricHours').textContent=hours?number(hours):'—';$('metricKm').textContent=km?number(km):'—';
 for(const [prefix,value] of [['gross',sum('gross')],['cost',F.cash(sum('fuel')+sum('other'))],['net',F.cash(sum('gross')-sum('fuel')-sum('other'))]]){$(prefix+'Trip').textContent=ratio(value,trips);$(prefix+'Hour').textContent=ratio(value,hours);$(prefix+'Km').textContent=ratio(value,km);}
 $('netHint').textContent=unknown?'* Faltam os custos do acumulado anterior. As médias usam apenas dias detalhados.':'As médias usam somente os dias em que você informou corridas, horas ou km.';
 document.querySelectorAll('[data-period]').forEach(b=>b.classList.toggle('active',b.dataset.period===metricPeriod));
}
function dayRow(d){const net=F.cash(d.gross-d.fuel-d.other),state={closed:'Encerrado',open:'Em andamento',rest:'Folga'}[d.status];return '<button class="dayrow" data-day="'+d.date+'"><span class="datebox">'+d.date.slice(8)+'<small>'+new Date(d.date+'T12:00').toLocaleDateString('pt-BR',{month:'short'})+'</small></span><span class="body"><strong>'+pretty(d.date)+'</strong><small>'+esc(d.note||('Ganhos '+money(d.gross)+' · custos '+money(d.fuel+d.other)))+'</small></span><span class="right"><strong class="'+(net<0?'negative':'positive')+'">'+(d.status==='rest'?'—':money(net))+'</strong><span class="badge">'+state+'</span></span></button>';}
function renderHistory(c,rows){
 const names=['D','S','T','Q','Q','S','S'];let html=names.map(n=>'<span class="weekday">'+n+'</span>').join('');
 html+='<span></span>'.repeat(new Date(selected+'-01T12:00').getDay());
 for(const date of c.dates){const d=S.days[date],status=d?.status||'',planned=c.scheduled(date),text=d?.status==='rest'?'Folga':d?money(d.gross):planned?'Planejado':'',short=d?.status==='rest'?'Folga':d?number(d.gross):planned?'•':'';html+='<button class="calday '+status+' '+(planned?'scheduled ':'')+(date===today?'today':'')+'" data-day="'+date+'" aria-label="'+pretty(date)+' '+esc(text)+'"><span>'+Number(date.slice(8))+'</span><small>'+esc(short)+'</small></button>';}
 $('calendar').innerHTML=html;const filter=$('dayFilter').value,shown=rows.filter(d=>filter==='all'||d.status===filter);$('history').innerHTML=shown.length?shown.map(dayRow).join(''):'<div class="empty">Nenhum registro neste filtro. Os dias planejados aparecem no calendário.</div>';
 if(c.p.opening&&filter==='all')$('history').insertAdjacentHTML('afterbegin','<div class="dayrow"><span class="body"><strong>Acumulado anterior</strong><small>Total informado: '+money(c.p.opening.total)+'. Sem divisão por dia. '+(c.openingAmount<c.p.opening.total?'Parte já detalhada nos registros; contada uma única vez.':'')+'</small></span><span class="right"><strong>'+money(c.openingAmount)+'</strong><small>ainda sem detalhamento</small></span></div>');
 const metrics=[['Média por dia encerrado',c.avg==null?'—':money(c.avg),'faturamento'],['Lucro por hora',c.hours?money(c.net/c.hours):'—','horas informadas'],['Lucro por km',c.km?money(c.net/c.km):'—','quilômetros informados'],['Corridas',number(c.trips),'total registrado']];
 // Efficiency uses only entries with the corresponding denominator recorded.
 for(const [index,key] of [[1,'hours'],[2,'km']]){const subset=c.worked.filter(d=>d[key]>0),den=subset.reduce((a,d)=>a+d[key],0),net=subset.reduce((a,d)=>a+d.gross-d.fuel-d.other,0);metrics[index][1]=den?money(net/den):'—';metrics[index][2]='só dias com '+(key==='hours'?'horas':'km')+' informados';}
 $('efficiency').innerHTML=metrics.map(x=>'<article class="stat"><span>'+x[0]+'</span><strong>'+x[1]+'</strong><small>'+x[2]+'</small></article>').join('');
 const openOld=c.days.filter(d=>d.status==='open'&&d.date<today);$('missingDays').hidden=!c.missed.length&&!openOld.length;$('missingDays').textContent=(openOld.length?openOld.length+' dia(s) antigo(s) ainda em andamento. Revise e encerre para entrar na média. ':'')+(c.missed.length?c.missed.length+' dia(s) planejado(s) passaram sem registro. Se rodou, registre; se descansou, marque folga.':'');
}
function line(name,value,negative=false){return '<div class="ledger"><span>'+name+'</span><b class="'+(negative?'negative':'')+'">'+money(value)+'</b></div>';}
function renderMoney(c){
 signed('available',c.available);signed('savings',c.canSave);signed('free',c.free);$('freeLabel').textContent=c.free<0?'Falta para cobrir tudo':'Livre para usar';$('freeHint').textContent=c.free<0?'gastos e compromissos maiores que entradas':'depois das reservas e contas';
 $('salaryHint').textContent='Salário previsto: '+money(c.p.salary)+'. Já recebido: '+money(c.p.salaryReceived)+'.';
 if(document.activeElement!==$('salaryReceived'))$('salaryReceived').value=c.p.salaryReceived;
 $('breakdown').innerHTML=line('Salário recebido',c.p.salaryReceived)+line('Outras entradas',c.extra)+line(c.unknownCosts?'Lucro Uber com custos informados':'Lucro da Uber',c.usableNet)+line('Reserva para o veículo',-c.reserve)+line('Contas fixas do mês',-c.bills)+line('Gastos avulsos',-c.personalCost)+line('Disponível após compromissos',c.available,c.available<0)+(c.unknownCosts?'<small>O acumulado anterior não entra no dinheiro livre até você informar os custos dele.</small>':'');
 $('personalProjection').textContent=c.projectedAvailable==null?'Aguardando seu primeiro dia':money(c.projectedAvailable);$('personalProjection').classList.toggle('negative',c.projectedAvailable<0);
 $('personalProjectionText').textContent='Previsão após os custos e compromissos cadastrados, antes da meta de guardar '+money(c.p.saveGoal)+'. Contas ainda não pagas: '+money(c.bills-c.paid)+'.';
 $('billList').innerHTML=c.p.bills.length?c.p.bills.map(b=>'<div class="ledger"><label><input type="checkbox" data-bill="'+esc(b.id)+'" '+(b.paid?'checked':'')+'><span>'+esc(b.name)+'<small>'+(b.paid?'Pago':'A pagar · valor já separado')+'</small></span></label><b>'+money(b.amount)+'</b></div>').join(''):'<div class="empty">Cadastre suas contas no plano do mês.</div>';
 const rows=S.personal.filter(t=>t.date.startsWith(selected)).sort((a,b)=>b.date.localeCompare(a.date));$('personalList').innerHTML=rows.length?rows.map(t=>'<div class="ledger"><span>'+esc(t.name)+'<small>'+pretty(t.date)+' · '+(t.kind==='income'?'Entrada':'Gasto')+'</small></span><div><b class="'+(t.kind==='income'?'positive':'negative')+'">'+(t.kind==='income'?'+':'−')+money(t.amount)+'</b><button class="delete" data-delete-personal="'+esc(t.id)+'" aria-label="Excluir '+esc(t.name)+'">×</button></div></div>').join(''):'<div class="empty">Seus gastos avulsos e outras entradas ficam aqui.</div>';
}
function renderMemory(){const count=Object.keys(S.days).length,months=new Set([...Object.keys(S.months),...Object.keys(S.days).map(d=>d.slice(0,7))]);$('memoryCount').textContent=count+' dias e '+months.size+' meses na sua memória.';try{$('backupInfo').textContent=localStorage.getItem(KEY+'_backupAt')?'Última cópia baixada: '+new Date(localStorage.getItem(KEY+'_backupAt')).toLocaleString('pt-BR'):'Você ainda não baixou uma cópia desta memória.';}catch(e){}$('footerStatus').textContent='Memória local · versão 6'+(S.updatedAt?' · último salvamento '+new Date(S.updatedAt).toLocaleString('pt-BR'):'');}
function openDay(date){
 editingDate=date;$('dayDate').value=date;loadDayForm(date);$('dayDialog').showModal();
}
function loadDayForm(date){
 editingDate=date;const d=S.days[date],future=date>today;
 $('dayStatus').value=d?.status||(date<today?'closed':'open');$('dayDate').value=date;
 ['Gross','Fuel','Other','Hours','Km','Trips'].forEach(k=>$('day'+k).value=d?.[k.toLowerCase()]??0);$('dayNote').value=d?.note||'';
 const c=F.calculate(S,date.slice(0,7),today);let target=d?.target;
 if(target==null){if(date===today)target=c.goalToday;else if(date>today)target=c.remaining.length?F.cash(c.rem/c.remaining.length):null;}
 $('dayTarget').value=target??'';$('deleteDay').hidden=!d;$('dayDetails').open=!!(d?.hours||d?.km||d?.trips);
 if(future&&!d){$('dayStatus').value='rest';toast('Data futura: marque uma folga ou ajuste a agenda no plano.');}
 $('dayStatus').querySelector('[value="open"]').disabled=future;$('dayStatus').querySelector('[value="closed"]').disabled=future;
 dayPreview();
}
function dayPreview(){const rest=$('dayStatus').value==='rest';$('dayNumbers').hidden=rest;for(const el of $('dayNumbers').querySelectorAll('input'))el.disabled=rest;const n=Number($('dayGross').value)-Number($('dayFuel').value)-Number($('dayOther').value);$('dayNetPreview').textContent=money(n);$('dayNetPreview').classList.toggle('negative',n<0);}
function saveDay(e){
 e.preventDefault();const date=$('dayDate').value,status=$('dayStatus').value;if(!F.validDate(date)||date>today&&status!=='rest')return toast('Ganhos só podem ser registrados até hoje.');
 const old=S.days[date];if(status==='rest'&&old&&(old.gross||old.fuel||old.other)&&!confirm('Marcar folga vai zerar os ganhos e custos deste dia. Continuar?'))return;
 const record={date,status,note:$('dayNote').value.trim(),target:status==='rest'||$('dayTarget').value===''?null:F.cash($('dayTarget').value)};
 for(const k of ['Gross','Fuel','Other','Hours','Km','Trips'])record[k.toLowerCase()]=status==='rest'?0:F.cash($('day'+k).value);
 if(record.hours>24||record.km>3000||!Number.isInteger(record.trips))return toast('Confira horas, quilômetros e número de corridas.');
 if(commit(next=>{snapshot(next,date.slice(0,7));next.days[date]=record;},'Dia salvo. Você pode revisar quando quiser.')){$('dayDialog').close();selected=date.slice(0,7);$('month').value=selected;render();}
}
function fillPlan(){const p=F.plan(S,selected,today);$('planMonth').textContent=monthName(selected);$('planGoal').value=p.goal;$('planStart').value=p.start;$('planStart').min=selected+'-01';$('planStart').max=F.monthDays(selected).at(-1);$('planSalary').value=p.salary;$('planSave').value=p.saveGoal;$('planReserve').value=p.reservePct;
 $('planFlexible').checked=p.flexible===true;$('planFlexDays').value=p.flexDays||0;
 const names=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];$('weekdays').innerHTML=names.map((n,i)=>'<label><input type="checkbox" value="'+i+'" '+(p.weekdays.includes(i)?'checked':'')+'><span>'+n+'</span></label>').join('');planBills=F.copy(p.bills);renderBillEditor();planPreview();}
function renderBillEditor(){$('billEditor').innerHTML=planBills.map((b,i)=>'<div class="bill-edit"><input data-bill-name="'+i+'" value="'+esc(b.name)+'" placeholder="Nome da conta" aria-label="Nome da conta '+(i+1)+'" maxlength="150" required><input data-bill-amount="'+i+'" type="number" min="0" max="100000000" step="0.01" inputmode="decimal" value="'+b.amount+'" aria-label="Valor da conta '+(i+1)+'" required><button type="button" class="iconbutton" data-remove-bill="'+i+'" aria-label="Remover conta">×</button></div>').join('');}
function collectBills(){document.querySelectorAll('[data-bill-name]').forEach(el=>planBills[el.dataset.billName].name=el.value);document.querySelectorAll('[data-bill-amount]').forEach(el=>planBills[el.dataset.billAmount].amount=F.cash(el.value));}
function planPreview(){const flexible=$('planFlexible').checked;$('fixedWeekdays').hidden=flexible;$('flexDaysLabel').hidden=!flexible;if(flexible){const n=Number($('planFlexDays').value),c=F.calculate(S,selected,today),remaining=Math.max(0,Number($('planGoal').value)-c.gross);$('planPreview').textContent=n?'Faltam '+money(remaining)+'. Dividindo por '+n+' dias: '+money(F.cash(remaining/n))+' por dia. Você escolhe as datas.':'Tudo bem não saber os dias ainda. Acompanhe seu total e responda quando rodar.';return;}const weekdays=[...$('weekdays').querySelectorAll('input:checked')].map(x=>Number(x.value)),start=$('planStart').value,days=F.monthDays(selected).filter(d=>d>=start&&weekdays.includes(new Date(d+'T12:00').getDay()));$('planPreview').textContent=days.length?'São '+days.length+' dias na agenda. Meta inicial: '+money(F.cash(Number($('planGoal').value)/days.length))+' por dia. As folgas e os resultados ajustam os próximos dias.':'Escolha pelo menos um dia da semana dentro do período.';}
function savePlan(e){e.preventDefault();collectBills();const weekdays=[...$('weekdays').querySelectorAll('input:checked')].map(x=>Number(x.value)),start=$('planStart').value;
 const flexible=$('planFlexible').checked;
 if(!start.startsWith(selected)||!flexible&&(!weekdays.length||!F.monthDays(selected).some(d=>d>=start&&weekdays.includes(new Date(d+'T12:00').getDay()))))return toast('Escolha dias válidos para sua agenda.');
 if(commit(next=>{const p=snapshot(next,selected);Object.assign(p,{goal:F.cash($('planGoal').value),start,weekdays,flexible,flexDays:Number($('planFlexDays').value)||0,flexClosed:F.calculate(next,selected,today).closed.length,salary:F.cash($('planSalary').value),saveGoal:F.cash($('planSave').value),reservePct:F.cash($('planReserve').value),configured:true,bills:F.copy(planBills)});if(selected>=today.slice(0,7))next.defaults={goal:p.goal,weekdays:F.copy(p.weekdays),flexible:p.flexible,flexDays:0,flexClosed:0,salary:p.salary,saveGoal:p.saveGoal,reservePct:p.reservePct,bills:p.bills.map(b=>({id:b.id,name:b.name,amount:b.amount}))};delete next.migrationNote;},'Plano salvo. Os outros meses foram preservados.'))go('hoje');
}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function backup(){download('meu-dinheiro-memoria-'+today+'.json',JSON.stringify(S,null,2),'application/json');try{localStorage.setItem(KEY+'_backupAt',new Date().toISOString());}catch(e){}renderMemory();toast('Cópia gerada. Guarde o arquivo em um lugar seguro.');}
function exportCSV(){const c=F.calculate(S,selected,today),rows=[['Data','Situação','Ganhos Uber','Combustível','Outros custos','Lucro Uber','Meta dia','Horas','Km','Corridas','Anotações']];c.days.sort((a,b)=>a.date.localeCompare(b.date)).forEach(d=>rows.push([d.date,d.status,d.gross,d.fuel,d.other,F.cash(d.gross-d.fuel-d.other),d.target??'',d.hours,d.km,d.trips,d.note]));rows.push([],['RESUMO DO MÊS'],['Meta Uber',c.p.goal],['Ganhos Uber',c.gross],['Custos Uber',c.cost],['Lucro Uber',c.net],['Salário recebido',c.p.salaryReceived],['Outras entradas',c.extra],['Gastos pessoais avulsos',c.personalCost],['Contas fixas',c.bills],['Reserva veículo',c.reserve],['Para guardar',c.canSave],['Livre após compromissos',c.free],[],['Data','Tipo pessoal','Descrição','Valor']);S.personal.filter(t=>t.date.startsWith(selected)).forEach(t=>rows.push([t.date,t.kind,t.name,t.amount]));const field=x=>{let v=typeof x==='number'?String(x).replace('.',','):String(x);if(typeof x!=='number'&&/^[=+\-@\t\r]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';};download('meu-dinheiro-'+selected+'.csv','\ufeff'+rows.map(r=>r.map(field).join(';')).join('\r\n'),'text/csv;charset=utf-8');}
async function restore(file){
 if(!file)return;if(file.size>5e6)return toast('Arquivo muito grande. Use uma cópia JSON de até 5 MB.');
 try{let candidate=JSON.parse(await file.text());if(candidate.version!==6&&Array.isArray(candidate.tx)){candidate=F.migrate(candidate,today,4);}F.validate(candidate);
 if(!confirm('Restaurar '+Object.keys(candidate.days).length+' dias? A memória atual será substituída. Uma cópia dela será baixada antes.'))return;
 backup();if(commit(next=>{Object.keys(next).forEach(k=>delete next[k]);Object.assign(next,candidate);},'Memória restaurada neste aparelho.',true)){$('critical').hidden=true;fillPlan();}
 }catch(e){toast('Não foi possível restaurar: '+e.message);}finally{$('restoreFile').value='';}
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.period){metricPeriod=b.dataset.period;renderPerformance(F.calculate(S,selected,today));return;}
 if(b.dataset.tab)return go(b.dataset.tab);
 if(b.dataset.close)return $(b.dataset.close).close();
 if(b.dataset.day)return openDay(b.dataset.day);
 if(b.dataset.removeBill!=null){collectBills();planBills.splice(Number(b.dataset.removeBill),1);return renderBillEditor();}
 if(b.dataset.deletePersonal){if(confirm('Excluir este lançamento pessoal?'))commit(n=>n.personal=n.personal.filter(t=>t.id!==b.dataset.deletePersonal),'Lançamento excluído.');return;}
 switch(b.dataset.action){case'plan':go('plano');break;case'history':go('diario');break;case'today':if(selected!==today.slice(0,7))go('diario');else openDay(today);break;case'new-day':openDay(selected===today.slice(0,7)?today:selected+'-01');break;case'backup':backup();break;case'csv':exportCSV();break;case'personal':$('personalForm').reset();$('personalDate').value=selected===today.slice(0,7)?today:selected+'-01';$('personalDate').max=today;$('personalDialog').showModal();break;}
});
$('month').addEventListener('change',()=>{if(!/^\d{4}-(0[1-9]|1[0-2])$/.test($('month').value))return;selected=$('month').value;render();if(tab==='plano')fillPlan();});
$('dayFilter').addEventListener('change',render);$('dayDate').addEventListener('change',()=>{if(F.validDate($('dayDate').value))loadDayForm($('dayDate').value);});$('dayStatus').addEventListener('change',dayPreview);$('dayForm').addEventListener('input',dayPreview);$('dayForm').addEventListener('submit',saveDay);
$('deleteDay').onclick=()=>{if(confirm('Excluir o registro de '+pretty(editingDate)+'?')){if(commit(n=>{delete n.days[editingDate];},'Dia excluído.'))$('dayDialog').close();}};
$('planForm').addEventListener('submit',savePlan);$('planForm').addEventListener('input',planPreview);$('addBill').onclick=()=>{collectBills();planBills.push({id:crypto.randomUUID(),name:'',amount:0,paid:false});renderBillEditor();};
$('salaryForm').onsubmit=e=>{e.preventDefault();commit(n=>{snapshot(n,selected).salaryReceived=F.cash($('salaryReceived').value);},'Total recebido atualizado.');};
$('billList').onchange=e=>{if(e.target.dataset.bill){const id=e.target.dataset.bill,paid=e.target.checked;if(!commit(n=>{const p=snapshot(n,selected);p.bills.find(b=>b.id===id).paid=paid;},paid?'Conta marcada como paga.':'Conta marcada como pendente.'))render();}};
$('personalForm').onsubmit=e=>{e.preventDefault();const date=$('personalDate').value;if(!F.validDate(date)||date>today)return toast('Use uma data até hoje.');const row={id:crypto.randomUUID(),date,name:$('personalName').value.trim(),amount:F.cash($('personalAmount').value),kind:$('personalKind').value};if(!row.name)return toast('Escreva uma descrição.');if(commit(n=>{snapshot(n,date.slice(0,7));n.personal.push(row);},'Lançamento pessoal salvo.')){$('personalDialog').close();selected=date.slice(0,7);$('month').value=selected;render();}};
$('restoreButton').onclick=()=>$('restoreFile').click();$('restoreFile').onchange=e=>restore(e.target.files[0]);
window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue!==lastStored)warning('Há alterações feitas em outra aba. Recarregue esta página para abrir a memória mais recente antes de editar.');});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&F.dateKey()!==today){today=F.dateKey();selected=today.slice(0,7);$('month').value=selected;render();if(tab==='plano')fillPlan();}});
let checkContextDate=today,checkState=null;
function renderCheck(c,isNow){
 const date=checkContextDate,d=S.days[date];$('checkDate').textContent=pretty(date);$('checkTitle').textContent=d?(d.status==='rest'?'Hoje ficou como folga.':'Seu dia já está salvo.'):(date===today?'Fez Uber hoje?':'Fez Uber em '+new Date(date+'T12:00').toLocaleDateString('pt-BR')+'?');
 if(d&&date!==today)$('checkTitle').textContent=d.status==='rest'?'Folga registrada.':'Dia registrado.';
 $('checkText').textContent=d?(d.status==='rest'?'Pronto. Não precisa preencher mais nada.':'Você ganhou '+money(d.gross)+' e gastou '+money(d.fuel+d.other)+'. Sobrou '+money(d.gross-d.fuel-d.other)+'.'):'Você responde. Eu organizo os valores e salvo no calendário.';
 $('checkChoices').hidden=!!d;$('checkReview').hidden=!d;
 $('openingNotice').hidden=!c.p.opening;
 if(c.p.opening)$('openingNotice').innerHTML='<strong>Acumulado anterior: '+money(c.p.opening.total)+'</strong><br>Já conta no total do mês. Não foi atribuído a um dia de corrida.'+(c.unknownCosts?'<br>Para calcular o lucro, faltam os custos desse período.':'')+'<button class="textbutton" data-action="opening">'+(c.p.opening.costsKnown?'Revisar custos anteriores':'Informar custos anteriores')+' →</button>';
}
function saveRest(date){
 const old=S.days[date];if(old&&(old.gross||old.fuel||old.other)&&!confirm('Esse dia já tem ganhos. Marcar folga vai zerar os valores dele. Continuar?'))return;
 if(commit(n=>{snapshot(n,date.slice(0,7));n.days[date]={date,status:'rest',gross:0,fuel:0,other:0,hours:0,km:0,trips:0,target:null,note:'Não fez Uber.'};},'Folga salva. Por hoje é só.')){checkContextDate=date;selected=date.slice(0,7);$('month').value=selected;render();}
}
function startCheck(date){
 if(!F.validDate(date)||date>today)return toast('Escolha hoje ou uma data anterior.');
 const old=S.days[date];checkState={date,step:1,gross:old?.gross||0,fuel:old?.fuel||0,other:old?.other||0};showStep();$('checkDialog').showModal();
}
function showStep(){
 const q=checkState,choices=q.step===3;
 $('stepLabel').textContent=pretty(q.date)+' · '+Math.min(q.step,3)+' DE 3';
 $('stepTitle').textContent=({1:'Quanto você ganhou?',2:'Quanto gastou de gasolina?',3:'Teve outro gasto com Uber?',4:'Quanto foi esse outro gasto?'})[q.step];
 $('stepText').textContent=q.step===1?'Coloque o total da Uber nesse dia.':q.step===2?'Se não gastou, coloque 0.':q.step===3?'Por exemplo: estacionamento, pedágio ou manutenção.':'Informe o total dos outros gastos do dia.';
 $('stepInputLabel').hidden=choices;$('stepValue').disabled=choices;$('otherChoices').hidden=!choices;$('stepNext').hidden=choices;$('stepBack').hidden=q.step===1;
 if(!choices)$('stepValue').value=q[({1:'gross',2:'fuel',4:'other'})[q.step]]||'';
 $('stepNext').textContent=q.step===4?'Salvar meu dia ✓':'Continuar →';
}
function finishCheck(){
 const q=checkState,old=S.days[q.date];
 const record={date:q.date,status:'closed',gross:q.gross,fuel:q.fuel,other:q.other,hours:old?.hours||0,km:old?.km||0,trips:old?.trips||0,target:old?.target??null,note:old?.status==='rest'?'':old?.note||''};
 if(commit(n=>{snapshot(n,q.date.slice(0,7));n.days[q.date]=record;},'Pronto! Dia salvo no calendário.')){checkContextDate=q.date;selected=q.date.slice(0,7);$('month').value=selected;$('checkDialog').close();render();}
}
$('checkForm').onsubmit=e=>{e.preventDefault();const v=Number($('stepValue').value);if(!Number.isFinite(v)||v<0||v>1e7)return toast('Confira o valor informado.');const q=checkState,key=({1:'gross',2:'fuel',4:'other'})[q.step];q[key]=F.cash(v);if(q.step===4)return finishCheck();q.step++;showStep();};
$('noOther').onclick=()=>{checkState.other=0;finishCheck();};$('yesOther').onclick=()=>{checkState.step=4;showStep();};$('stepBack').onclick=()=>{checkState.step=checkState.step===4?3:Math.max(1,checkState.step-1);showStep();};
document.addEventListener('click',e=>{const action=e.target.closest('button')?.dataset.action;if(action==='check-yes')startCheck(checkContextDate);if(action==='check-no')saveRest(checkContextDate);if(action==='check-review'){if(S.days[checkContextDate]?.status==='rest'){$('checkChoices').hidden=false;$('checkReview').hidden=true;$('checkTitle').textContent='Quer corrigir esse dia?';}else openDay(checkContextDate);}if(action==='opening'){const p=F.plan(S,selected,today);$('openingCost').value=p.opening?.costsKnown?p.opening.cost:'';$('openingDialog').showModal();}});
$('openingForm').onsubmit=e=>{e.preventDefault();if(commit(n=>{const p=snapshot(n,selected);p.opening.cost=F.cash($('openingCost').value);p.opening.costsKnown=true;},'Custos do acumulado salvos.'))$('openingDialog').close();};
function consumeLink(){
 today=F.dateKey();
 const hash=location.hash;if(!hash)return;
 try{
  if(hash.startsWith('#checkin')){const date=hash.includes('=')?decodeURIComponent(hash.split('=')[1]):today;if(!F.validDate(date)||date>today)throw Error('Data inválida no lembrete.');checkContextDate=date;selected=date.slice(0,7);$('month').value=selected;go('hoje');render();history.replaceState(null,'',location.pathname+location.search);return;}
  if(!hash.startsWith('#preparar=')&&!hash.startsWith('#resposta='))return;
  const kind=hash.startsWith('#preparar=')?'setup':'response',parts=decodeURIComponent(hash.slice(hash.indexOf('=')+1)).split(','),date=parts[0];
  if(!F.validDate(date)||date>today)throw Error('Data inválida no link.');
  const receipt=kind+':'+parts.join(',');if((S.appliedLinks||[]).includes(receipt)){history.replaceState(null,'',location.pathname+location.search);return;}
  if(kind==='setup'){
   const total=Number(parts[1]);if(parts.length!==3||!Number.isFinite(total)||total<0||total>1e7||!['sim','nao'].includes(parts[2]))throw Error('Acumulado inválido.');
   if(S.months[date.slice(0,7)]?.opening)throw Error('Já existe um acumulado anterior neste mês. Revise antes de substituir.');
   if(commit(n=>{const p=snapshot(n,date.slice(0,7));p.opening={through:date,total,cost:0,costsKnown:false};p.flexible=true;p.flexDays=0;p.flexClosed=0;p.configured=true;n.defaults.flexible=true;n.defaults.flexDays=0;n.defaults.flexClosed=0;if(parts[2]==='nao'&&!n.days[date])n.days[date]={date,status:'rest',gross:0,fuel:0,other:0,hours:0,km:0,trips:0,target:null,note:'Não fez Uber.'};n.appliedLinks=[...(n.appliedLinks||[]),receipt].slice(-100);},'Acumulado preparado e histórico preservado.')){checkContextDate=date;selected=date.slice(0,7);$('month').value=selected;history.replaceState(null,'',location.pathname+location.search);render();}
  }else{
   const status=parts[1],nums=parts.slice(2).map(Number);if(parts.length!==5||!['sim','nao'].includes(status)||nums.some(x=>!Number.isFinite(x)||x<0||x>1e7))throw Error('Resposta inválida.');
   const old=S.days[date];if(old&&!confirm('Já existe um registro em '+pretty(date)+'. Substituir pela resposta enviada?'))return;
   if(commit(n=>{snapshot(n,date.slice(0,7));n.days[date]={date,status:status==='sim'?'closed':'rest',gross:status==='sim'?F.cash(nums[0]):0,fuel:status==='sim'?F.cash(nums[1]):0,other:status==='sim'?F.cash(nums[2]):0,hours:old?.hours||0,km:old?.km||0,trips:old?.trips||0,target:old?.target??null,note:'Resposta do acompanhamento diário.'};n.appliedLinks=[...(n.appliedLinks||[]),receipt].slice(-100);},'Sua resposta foi salva no calendário.')){checkContextDate=date;selected=date.slice(0,7);$('month').value=selected;history.replaceState(null,'',location.pathname+location.search);render();}
  }
 }catch(e){warning(e.message+' Seus registros anteriores foram mantidos.');}
}
boot();consumeLink();window.addEventListener('hashchange',consumeLink);
if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{/* Online diary remains available. */});
