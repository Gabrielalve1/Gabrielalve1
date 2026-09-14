'use strict';
const F=window.Finance,KEY='meuDinheiro_v6',PREVIOUS=KEY+'_previous',$=id=>document.getElementById(id);
const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),number=n=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:1});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const monthName=m=>new Date(m+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
const pretty=d=>new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',weekday:'short'});
let today=F.dateKey(),selected=today.slice(0,7),tab='hoje',S,lastStored=null,readOnly=false,toastTimer,editingDate=null,planBills=[];
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
 $('pageTitle').textContent=isNow?'Bora fazer o dia render.':monthName(selected);
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
 signed('gross',c.gross);signed('cost',c.cost);signed('net',c.net);
 let title,text;
 if(!c.p.configured){title='Vamos dar direção ao seu mês.';text='Defina quando vai rodar e sua meta. Os ganhos que você já lançou continuam aqui.';}
 else if(c.rem===0){title='Meta do mês alcançada.';text='Você já faturou '+money(c.gross)+'. Continue acompanhando os custos para saber quanto fica com você.';}
 else if(!c.remaining.length){title=selected<today.slice(0,7)?'Seu mês ficou registrado.':'Não há mais dias na sua agenda.';text='Ficaram '+money(c.rem)+' para a meta. '+(selected<today.slice(0,7)?'Consulte os dias e use esse resultado para planejar o próximo mês.':'Ajuste os dias planejados se ainda pretende rodar.');}
 else{title='Faltam '+money(c.rem)+' para sua meta.';text='Restam '+c.remaining.length+' dias planejados, contando os que estão em andamento. Para distribuir o valor que falta: '+money(F.cash(c.rem/c.remaining.length))+' adicionais por dia.';}
 $('coachTitle').textContent=title;$('coachText').textContent=text;$('coachFoot').textContent=c.closed.length+' dias encerrados · '+c.worked.filter(x=>x.status==='open').length+' em andamento · '+c.remaining.length+' pela frente';
 $('projection').textContent=c.projection==null?'Ainda sem média':money(c.projection);
 $('projectionText').textContent=c.projection==null?'Encerre seu primeiro dia para calcular uma previsão com seus resultados.':'Faturamento estimado no mês. Média dos dias encerrados: '+money(c.avg)+' por dia. '+(c.projection>=c.p.goal?'Nesse ritmo, a meta está ao alcance.':'Nesse ritmo, faltariam '+money(c.p.goal-c.projection)+' para a meta.');
 const rows=c.days.sort((a,b)=>b.date.localeCompare(a.date));$('recent').innerHTML=rows.length?rows.slice(0,3).map(dayRow).join(''):'<div class="empty">Seu primeiro dia vai aparecer aqui.<br>Toque em “Registrar meu dia” para começar.</div>';
 renderHistory(c,rows);renderMoney(c);renderMemory();goPanelOnly();
}
function goPanelOnly(){document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!==tab);document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false');});}
function dayRow(d){const net=F.cash(d.gross-d.fuel-d.other),state={closed:'Encerrado',open:'Em andamento',rest:'Folga'}[d.status];return '<button class="dayrow" data-day="'+d.date+'"><span class="datebox">'+d.date.slice(8)+'<small>'+new Date(d.date+'T12:00').toLocaleDateString('pt-BR',{month:'short'})+'</small></span><span class="body"><strong>'+pretty(d.date)+'</strong><small>'+esc(d.note||('Ganhos '+money(d.gross)+' · custos '+money(d.fuel+d.other)))+'</small></span><span class="right"><strong class="'+(net<0?'negative':'positive')+'">'+(d.status==='rest'?'—':money(net))+'</strong><span class="badge">'+state+'</span></span></button>';}
function renderHistory(c,rows){
 const names=['D','S','T','Q','Q','S','S'];let html=names.map(n=>'<span class="weekday">'+n+'</span>').join('');
 html+='<span></span>'.repeat(new Date(selected+'-01T12:00').getDay());
 for(const date of c.dates){const d=S.days[date],status=d?.status||'',planned=c.scheduled(date),text=d?.status==='rest'?'Folga':d?money(d.gross):planned?'Planejado':'',short=d?.status==='rest'?'Folga':d?number(d.gross):planned?'•':'';html+='<button class="calday '+status+' '+(planned?'scheduled ':'')+(date===today?'today':'')+'" data-day="'+date+'" aria-label="'+pretty(date)+' '+esc(text)+'"><span>'+Number(date.slice(8))+'</span><small>'+esc(short)+'</small></button>';}
 $('calendar').innerHTML=html;const filter=$('dayFilter').value,shown=rows.filter(d=>filter==='all'||d.status===filter);$('history').innerHTML=shown.length?shown.map(dayRow).join(''):'<div class="empty">Nenhum registro neste filtro. Os dias planejados aparecem no calendário.</div>';
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
 $('breakdown').innerHTML=line('Salário recebido',c.p.salaryReceived)+line('Outras entradas',c.extra)+line('Lucro da Uber',c.net)+line('Reserva para o veículo',-c.reserve)+line('Contas fixas do mês',-c.bills)+line('Gastos avulsos',-c.personalCost)+line('Disponível após compromissos',c.available,c.available<0);
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
 const names=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];$('weekdays').innerHTML=names.map((n,i)=>'<label><input type="checkbox" value="'+i+'" '+(p.weekdays.includes(i)?'checked':'')+'><span>'+n+'</span></label>').join('');planBills=F.copy(p.bills);renderBillEditor();planPreview();}
function renderBillEditor(){$('billEditor').innerHTML=planBills.map((b,i)=>'<div class="bill-edit"><input data-bill-name="'+i+'" value="'+esc(b.name)+'" placeholder="Nome da conta" aria-label="Nome da conta '+(i+1)+'" maxlength="150" required><input data-bill-amount="'+i+'" type="number" min="0" max="100000000" step="0.01" inputmode="decimal" value="'+b.amount+'" aria-label="Valor da conta '+(i+1)+'" required><button type="button" class="iconbutton" data-remove-bill="'+i+'" aria-label="Remover conta">×</button></div>').join('');}
function collectBills(){document.querySelectorAll('[data-bill-name]').forEach(el=>planBills[el.dataset.billName].name=el.value);document.querySelectorAll('[data-bill-amount]').forEach(el=>planBills[el.dataset.billAmount].amount=F.cash(el.value));}
function planPreview(){const weekdays=[...$('weekdays').querySelectorAll('input:checked')].map(x=>Number(x.value)),start=$('planStart').value,days=F.monthDays(selected).filter(d=>d>=start&&weekdays.includes(new Date(d+'T12:00').getDay()));$('planPreview').textContent=days.length?'São '+days.length+' dias na agenda. Meta inicial: '+money(F.cash(Number($('planGoal').value)/days.length))+' por dia. As folgas e os resultados ajustam os próximos dias.':'Escolha pelo menos um dia da semana dentro do período.';}
function savePlan(e){e.preventDefault();collectBills();const weekdays=[...$('weekdays').querySelectorAll('input:checked')].map(x=>Number(x.value)),start=$('planStart').value;
 if(!weekdays.length||!start.startsWith(selected)||!F.monthDays(selected).some(d=>d>=start&&weekdays.includes(new Date(d+'T12:00').getDay())))return toast('Escolha dias válidos para sua agenda.');
 if(commit(next=>{const p=snapshot(next,selected);Object.assign(p,{goal:F.cash($('planGoal').value),start,weekdays,salary:F.cash($('planSalary').value),saveGoal:F.cash($('planSave').value),reservePct:F.cash($('planReserve').value),configured:true,bills:F.copy(planBills)});if(selected>=today.slice(0,7))next.defaults={goal:p.goal,weekdays:F.copy(p.weekdays),salary:p.salary,saveGoal:p.saveGoal,reservePct:p.reservePct,bills:p.bills.map(b=>({id:b.id,name:b.name,amount:b.amount}))};delete next.migrationNote;},'Plano salvo. Os outros meses foram preservados.'))go('hoje');
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
boot();
if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{/* Online diary remains available. */});
