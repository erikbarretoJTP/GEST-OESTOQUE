// Inventário oficial: aba "Ruas" para o líder/admin acompanhar, rua por rua, o andamento da 1ª, 2ª e 3ª contagem.
(function(){
let streetFilter='all';
const natural=(a,b)=>String(a).localeCompare(String(b),'pt-BR',{numeric:true,sensitivity:'base'});
const stageName=['1ª contagem','2ª contagem','3ª contagem (divergências)'];
function streetData(inv){
 const map=new Map();
 inv.lines.forEach(line=>{const s=officialLineStreet(line);if(!map.has(s))map.set(s,[]);map.get(s).push(line);});
 return [...map.entries()].sort((a,b)=>a[0]==='__none'?1:b[0]==='__none'?-1:natural(a[0],b[0])).map(([street,lines])=>{
  const stages=[0,1,2].map(stage=>{
   let scope=lines;
   if(stage===2)scope=lines.filter(l=>l.counts[0]&&l.counts[1]&&l.counts[0].qty!==l.counts[1].qty);
   const total=scope.length,done=scope.filter(l=>l.counts[stage]).length;
   const people=[...new Set(scope.map(l=>l.counts[stage]?.by).filter(Boolean))];
   const teams=[...new Set(scope.map(l=>(l.counts[stage]?.team||'').split(' · ')[0]).filter(Boolean))];
   const last=scope.map(l=>l.counts[stage]?.at).filter(Boolean).sort().pop();
   let designated=[];try{designated=officialAssignments(inv).filter(a=>a.stage===stage&&lines.some(l=>wmsLineScope(l,a.streets)));}catch{}
   return {stage,total,done,pct:total?Math.round(done/total*100):(stage===2?null:0),people,teams,last,designated};
  });
  return {street,lines,stages,full:stages[0].pct===100&&stages[1].pct===100&&(stages[2].total===0||stages[2].pct===100)};
 });
}
function stateOf(s){if(s.total===0)return {txt:'Sem divergências',cls:'ok'};if(s.pct===100)return {txt:'Concluída',cls:'ok'};if(s.done>0)return {txt:'Em contagem',cls:'warn'};return {txt:'Não iniciada',cls:'idle'};}
function who(s){
 if(s.done>0){const names=s.people.length?s.people.join(' / '):'—',team=s.teams.length?s.teams.join(' · '):'';return `<span class="st-who"><b>${esc(team||'Contagem')}</b>${team?' · ':''}${esc(names)}</span>`;}
 if(s.designated.length)return `<span class="st-who muted">Designada: ${esc(s.designated.map(a=>a.label+' ('+a.members.map(id=>accessUsers.find(u=>u.id===id)?.name||id).join(' / ')+')').join(' · '))}</span>`;
 return '<span class="st-who muted">Sem dupla designada</span>';
}
function stageRow(s){
 const st=stateOf(s),pct=s.pct===null?0:s.pct;
 return `<div class="st-row"><div class="st-head"><b>${stageName[s.stage]}</b><span class="st-pct">${s.total===0?'—':pct+'%'}</span><span class="st-badge ${st.cls}">${st.txt}</span></div><div class="st-bar"><i style="width:${pct}%"></i></div><div class="st-foot"><small>${s.done} de ${s.total} ${s.stage===2?(s.total===1?'divergência':'divergências'):(s.total===1?'item':'itens')}</small>${who(s)}${s.last?'<small>Última: '+esc(new Date(s.last).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}))+'</small>':''}</div></div>`;
}
function panel(inv){
 const data=streetData(inv),shown=data.filter(d=>streetFilter==='all'||(streetFilter==='done'?d.full:!d.full)),doneN=data.filter(d=>d.full).length;
 return `<section class="panel table-panel street-panel"><div class="panel-heading"><div><h2>Progresso por rua</h2><p>${doneN} de ${data.length} ruas com todas as contagens concluídas</p></div><label class="street-filter">Mostrar<select id="street-filter">${[['all','Todas as ruas'],['open','Em andamento / pendentes'],['done','Concluídas']].map(([v,l])=>`<option value="${v}" ${v===streetFilter?'selected':''}>${l}</option>`).join('')}</select></label></div><div class="street-grid">${shown.map(d=>`<article class="street-card ${d.full?'full':''}"><header><h3>${d.street==='__none'?'Itens sem WMS':'Rua '+esc(d.street)}</h3><small>${d.lines.length} ${d.lines.length===1?'item':'itens'}</small></header>${d.stages.map(stageRow).join('')}</article>`).join('')||'<p class="empty">Nenhuma rua nesta visão.</p>'}</div></section>`;
}
const prior=render;
render=function(){
 prior.apply(this,arguments);
 try{
  if(page!==4)return;
  const inv=inventories.find(i=>i.id===selectedInventory),nav=$('content').querySelector('.official-management-tabs'),overview=$('content').querySelector('.assignment-overview');
  if(!inv||!nav||!overview||!canManageOfficial(inv.unit))return;
  const btn=document.createElement('button');btn.id='official-tab-streets';btn.textContent='Ruas';nav.append(btn);
  const active=officialManagementTab==='streets';
  if(active){nav.querySelectorAll('button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');overview.hidden=true;$('content').querySelector('.divergence-panel')?.remove();overview.insertAdjacentHTML('afterend',panel(inv));$('street-filter').onchange=e=>{streetFilter=e.target.value;render();};}
  btn.onclick=()=>{officialManagementTab='streets';render();};
 }catch(e){}
};
render();
})();
