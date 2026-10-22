/* Resumo de leitura: nunca grava contagens, saldo ou alocações. */
function finalInventoryReport(inv){
 const reference=window.JTP_INVENTORY_REPORT_BALANCES?.[inv.unit+'|'+inv.date];
 const describe=sku=>window.jtpItemDescription?.(sku)||inv.lines.find(l=>String(l.sku)===sku)?.name||sku;
 const rows=inv.lines.filter(l=>!l.excludedFromCount&&!l.excluded_from_count).map(line=>{
  const sku=String(line.sku),quantity=finalQuantity(inv,line),balance=reference?(reference.items[sku]?.quantity??0):Number(line.balance),difference=quantity===null?null:Math.round((quantity-balance)*1e8)/1e8;
  return {sku,name:describe(sku),unit:reference?.items[sku]?.unit||line.measure||'—',address:(line.addresses||[]).join(' · ')||line.address||'—',balance,quantity,difference,status:quantity===null?'Pendente':difference===0?'Conforme':difference>0?'Sobra':'Falta'};
 });
 const snapshot=Array.isArray(inv._wmsSnapshot)?inv._wmsSnapshot:null;
 const mapped=new Set(snapshot?snapshot.filter(p=>p.sku).map(p=>String(p.sku)):inv.lines.filter(l=>l.addresses?.length||l.address).map(l=>String(l.sku)));
 const outside=reference&&snapshot?Object.entries(reference.items).filter(([sku,r])=>r.quantity!==0&&!mapped.has(sku)).map(([sku,r])=>({sku,name:describe(sku),balance:r.quantity,unit:r.unit||'—'})):null;
 const confirmed=rows.filter(r=>r.quantity!==null),divergent=confirmed.filter(r=>r.difference!==0),pending=rows.filter(r=>r.quantity===null);
 const people=new Map();
 const add=(id,name)=>{if(id||name)people.set(id||name,name||accessUsers.find(u=>u.id===id)?.name||id);};
 for(const a of inv.assignments||[])for(const id of a.members||[])add(id);
 for(const line of inv.lines)for(const c of line.counts||[])if(c)add(c.userId,c.by);
 const participants=[...people.values()].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 return {rows,confirmed,divergent,pending,outside,participants,matched:confirmed.length-divergent.length,reference,closure:inv.audit?.find(a=>a.action==='inventory_finished_with_pending')};
}
function showFinalInventoryReport(){
 if(page!==4||typeof canManageOfficial!=='function')return;
 const inv=inventories.find(i=>i.id===selectedInventory),detail=document.querySelector('.official-management-summary, .inventory-detail');
 if(!inv||inv.status!=='Concluído'||!canManageOfficial(inv.unit)||!detail||document.querySelector('.counting-screen'))return;
 document.getElementById('final-inventory-report')?.remove();
 const report=finalInventoryReport(inv),format=n=>Number(n).toLocaleString('pt-BR');
 const dateTime=value=>{const d=new Date(value);return value&&Number.isFinite(d.getTime())?d:null;};
 const started=dateTime(inv.startedAt),finished=dateTime(inv.finishedAt);
 const time=d=>d?d.toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';
 const date=d=>d?d.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):'—';
 const seconds=started&&finished&&finished>=started?Math.floor((finished-started)/1000):null;
 const duration=seconds===null?'—':Math.floor(seconds/3600)+'h '+String(Math.floor(seconds%3600/60)).padStart(2,'0')+'min '+String(seconds%60).padStart(2,'0')+'s';
 const metrics=[['Itens apurados',format(report.confirmed.length)],['Conformes',format(report.matched)],['Com divergência',format(report.divergent.length)],['Com saldo fora do WMS',report.outside===null?'—':format(report.outside.length)]];
 const section=document.createElement('section');section.id='final-inventory-report';section.className='panel final-inventory-report executive-inventory-report';
 section.innerHTML='<div class="executive-report-heading"><div><div class="executive-report-eyebrow">GRUPO JTP · RESUMO DO INVENTÁRIO</div><h2>'+esc(inventoryDisplayName(inv))+' <span>— '+esc(units.find(u=>u.id===inv.unit)?.name||inv.unit)+'</span></h2><p>'+esc(date(started))+' · Depósito '+esc(inv.unit)+'</p></div><span class="executive-report-status">Encerrado</span></div><div class="executive-report-timing">'+[['Início',time(started),date(started)],['Término',time(finished),date(finished)],['Duração',duration,'Tempo total do inventário']].map(([label,value,caption])=>'<div><span>'+label+'</span><strong>'+esc(value)+'</strong><small>'+esc(caption)+'</small></div>').join('')+'</div><div class="executive-report-metrics">'+metrics.map(([label,value])=>'<div><span>'+label+'</span><strong>'+value+'</strong></div>').join('')+'</div><div class="executive-report-team"><h3>Equipe participante</h3><p>'+esc(report.participants.join(' · ')||'Participantes não informados')+'</p></div><div class="executive-report-footer"><p><span>Responsável pelo encerramento</span><strong>'+esc(inv.finishedBy||'—')+'</strong></p><p class="executive-report-reference">'+esc(report.reference?'Referência: '+report.reference.file+' · Depósito '+inv.unit+'.':'Referência: saldo congelado na abertura.')+' Indicadores por código de item.</p></div>';
 detail.before(section);
}
const renderBeforeFinalReport=render;
render=function(){renderBeforeFinalReport.apply(this,arguments);showFinalInventoryReport();};
showFinalInventoryReport();
