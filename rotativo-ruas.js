// Inventário rotativo: aba "Ruas" com o histórico de cada rua do WMS (última contagem, quem contou, resultado).
// O resumo vem do banco (parte 19) só quando a aba é aberta; não entra na atualização automática.
(function(){
let on=false,unitSel='',depSel='',sortSel='old',openStreet='',data=null,loading=false,error='';
const nat=(a,b)=>String(a).localeCompare(String(b),'pt-BR',{numeric:true,sensitivity:'base'});
const streetOf=a=>String(a||'').trim().split(/[.-]/)[0];
const brDate=v=>{const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[3]+'/'+m[2]+'/'+m[1]:'—';};
const brTime=v=>v?new Date(v).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
const daysSince=d=>{if(!d)return null;const t=new Date(String(d).slice(0,10)+'T12:00:00'),n=new Date();n.setHours(12,0,0,0);return Math.max(0,Math.round((n-t)/864e5));};
const pct=r=>r.counted?(r.counted-r.divergent)/r.counted*100:null;
const blind=()=>selectedUser()?.role==='Almoxarife'&&!(window.jtpRotativoOpen&&jtpRotativoOpen(unitSel));
async function load(){if(loading)return;loading=true;error='';render();
  try{data=await JTP_RPC('jtp_rotativo_streets');}catch(e){error=/Operação inválida/i.test(e.message)?'Falta rodar a parte 19 do SQL no Supabase.':e.message;}
  finally{loading=false;render();}}
function unitsAllowed(){const u=selectedUser();return units.filter(x=>u?.role==='Admin'||u?.units?.includes(x.id));}
function streetsOf(unit){
  const map=window.jtpDepositMap?jtpDepositMap(unit):{},pos={};
  (window.JTP_SOURCE?.locations||[]).forEach(l=>{if(l.unit!==unit||!l.address)return;const s=streetOf(l.address);pos[s]=(pos[s]||0)+(l.sku?1:0);});
  const hist={};(data||[]).filter(r=>r.unit===unit).forEach(r=>{(hist[r.street]=hist[r.street]||[]).push(r);});
  const names=[...new Set([...Object.keys(pos),...Object.keys(hist)])];
  return names.map(street=>{const list=(hist[street]||[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.startedAt).localeCompare(String(a.startedAt)));
    const last=list.find(r=>r.status==='Concluído'),open=list.find(r=>r.status==='Em andamento');
    return {street,dep:map[street]||'',positions:pos[street]||0,list,last,open,days:last?daysSince(last.date):null};});
}
function panel(){
  const allowed=unitsAllowed();if(!unitSel||!allowed.some(u=>u.id===unitSel)){const g=$('unit')?.value;unitSel=allowed.some(u=>u.id===g)?g:(allowed.find(u=>u.id==='2002')||allowed[0])?.id||'';}
  if(error)return `<div class="panel rot-streets"><p class="empty">${esc(error)}</p></div>`;
  if(!data)return `<div class="panel rot-streets"><p class="empty">Carregando histórico das ruas…</p></div>`;
  let rows=streetsOf(unitSel);const deps=[...new Set(rows.map(r=>r.dep).filter(Boolean))];if(!deps.includes(depSel))depSel='';
  if(depSel)rows=rows.filter(r=>r.dep===depSel);
  rows.sort(sortSel==='street'?(a,b)=>nat(a.street,b.street):(a,b)=>(a.last?1:0)-(b.last?1:0)||(b.days??0)-(a.days??0)||nat(a.street,b.street));
  const never=rows.filter(r=>!r.last).length,counted=rows.length-never,hide=blind();
  const head=`<div class="rot-streets-bar"><label>FILIAL<select id="rs-unit">${allowed.map(u=>`<option value="${esc(u.id)}" ${u.id===unitSel?'selected':''}>${esc(u.id+' · '+u.name)}</option>`).join('')}</select></label>`+
    (deps.length?`<label>DEPÓSITO<select id="rs-dep"><option value="">Todos os depósitos</option>${deps.map(d=>`<option value="${esc(d)}" ${d===depSel?'selected':''}>${esc(d)}</option>`).join('')}</select></label>`:'')+
    `<label>ORDEM<select id="rs-sort"><option value="old" ${sortSel==='old'?'selected':''}>Há mais tempo sem contar</option><option value="street" ${sortSel==='street'?'selected':''}>Rua</option></select></label>`+
    `<span class="rs-summary"><b>${counted}</b> de ${rows.length} ruas já contadas · <b>${never}</b> nunca contadas</span><button class="secondary" id="rs-export">↓ Exportar</button></div>`;
  const line=r=>{const l=r.last,a=l?pct(l):null,st=r.open?`<span class="st-badge warn">Em andamento · ${esc(r.open.number)}</span>`:l?'':'<span class="st-badge idle">Nunca contada</span>';
    return `<tr class="rs-row ${openStreet===r.street?'open':''}" data-street="${esc(r.street)}"><td><b>Rua ${esc(r.street)}</b>${r.dep?`<small class="dep-tag">${esc(r.dep)}</small>`:''}<small>${num(r.positions)} ${r.positions===1?'item':'itens'} no WMS</small></td>`+
     `<td>${l?`<b>${brDate(l.date)}</b><small>${r.days===0?'hoje':r.days===1?'há 1 dia':'há '+r.days+' dias'} · ${esc(l.number)}</small>`:'—'}${st?'<div>'+st+'</div>':''}</td>`+
     `<td>${l?`${esc((l.counters||[]).join(' / ')||'—')}<small>Abriu: ${esc(l.startedBy||'—')} · Finalizou: ${esc(l.finishedBy||'—')}</small>`:'—'}</td>`+
     `<td>${l?`${num(l.counted)} de ${num(l.items)}<small>${num(l.divergent)} com desvio</small>`:'—'}</td>`+
     (hide?'':`<td>${l?`<b>${a===null?'—':a.toFixed(1).replace('.',',')+'%'}</b><small>Sobra ${money(Number(l.surplus))} · Falta ${money(Number(l.shortage))}</small>`:'—'}</td>`)+
     `<td>${num(r.list.filter(x=>x.status==='Concluído').length)}</td></tr>`+
     (openStreet===r.street?`<tr class="rs-history"><td colspan="${hide?5:6}">${history(r)}</td></tr>`:'');};
  return `<div class="panel table-panel rot-streets"><div class="panel-heading"><h2>Histórico por rua</h2><small>Clique na rua para ver todas as contagens</small></div>${head}`+
    table(['RUA','ÚLTIMA CONTAGEM','QUEM CONTOU','ITENS',...(hide?[]:['ACURACIDADE / RESULTADO']),'VEZES CONTADA'],rows.map(line))+`</div>`;
}
function history(r){
  if(!r.list.length)return '<p class="empty">Esta rua ainda não teve inventário rotativo.</p>';const hide=blind();
  return table(['ROTATIVO','DATA','STATUS','ABRIU','CONTOU','FINALIZOU','ITENS',...(hide?[]:['ACURACIDADE','SOBRA','FALTA'])],r.list.map(x=>{const a=pct(x);
    return `<tr><td><b>${esc(x.number)}</b></td><td>${brDate(x.date)}</td><td>${esc(x.status)}</td><td>${esc(x.startedBy||'—')}<small>${brTime(x.startedAt)}</small></td><td>${esc((x.counters||[]).join(' / ')||'—')}<small>${x.lastCountAt?'Última: '+brTime(x.lastCountAt):''}</small></td><td>${esc(x.finishedBy||'—')}<small>${x.finishedAt?brTime(x.finishedAt):''}</small></td><td>${num(x.counted)} de ${num(x.items)}<small>${num(x.divergent)} com desvio</small></td>`+
      (hide?'':`<td>${a===null?'—':a.toFixed(1).replace('.',',')+'%'}</td><td>${money(Number(x.surplus))}</td><td>${money(Number(x.shortage))}</td>`)+`</tr>`;}));
}
function exportRows(){const hide=blind(),out=[];
  streetsOf(unitSel).filter(r=>!depSel||r.dep===depSel).sort((a,b)=>nat(a.street,b.street)).forEach(r=>{
    const base={Estoque:unitSel,Rua:r.street,Deposito:r.dep,ItensWMS:r.positions};
    if(!r.list.length){out.push({...base,Rotativo:'',Data:'',Status:'Nunca contada',Abriu:'',Contou:'',Finalizou:'',FinalizadoEm:'',Itens:'',Contados:'',ComDesvio:'',...(hide?{}:{Acuracidade:'',Sobra:'',Falta:''})});return;}
    r.list.forEach(x=>{const a=pct(x);out.push({...base,Rotativo:x.number,Data:brDate(x.date),Status:x.status,Abriu:x.startedBy||'',Contou:(x.counters||[]).join(' / '),Finalizou:x.finishedBy||'',FinalizadoEm:x.finishedAt?brTime(x.finishedAt):'',Itens:x.items,Contados:x.counted,ComDesvio:x.divergent,
      ...(hide?{}:{Acuracidade:a===null?'':a.toFixed(1).replace('.',',')+'%',Sobra:Number(x.surplus).toFixed(2).replace('.',','),Falta:Number(x.shortage).toFixed(2).replace('.',',')})});});});
  exportCSV(out,'jtp-rotativo-ruas-'+unitSel+'.csv');}
const prev=render;
render=function(){
  prev.apply(this,arguments);
  try{
    if(page!==3||selectedInventory)return;
    const tabs=$('content').querySelector('.inventory-tabs');if(!tabs)return;
    const btn=document.createElement('button');btn.id='tab-streets';btn.textContent='Ruas';tabs.append(btn);
    btn.onclick=()=>{on=true;openStreet='';load();};
    tabs.querySelectorAll('button:not(#tab-streets)').forEach(b=>b.addEventListener('click',()=>{on=false;},{capture:true}));
    if(!on)return;
    tabs.querySelectorAll('button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
    const list=$('content').querySelector('.inventory-actions'),panelEl=list?.nextElementSibling?.classList.contains('table-panel')?list.nextElementSibling:null;
    if(list)list.hidden=true;
    const html=panel();if(panelEl)panelEl.outerHTML=html;else tabs.closest('.entry-toolbar,div')?.insertAdjacentHTML('afterend',html);
    const g=id=>$(id);
    if(g('rs-unit'))g('rs-unit').onchange=e=>{unitSel=e.target.value;depSel='';openStreet='';render();};
    if(g('rs-dep'))g('rs-dep').onchange=e=>{depSel=e.target.value;openStreet='';render();};
    if(g('rs-sort'))g('rs-sort').onchange=e=>{sortSel=e.target.value;render();};
    if(g('rs-export'))g('rs-export').onclick=exportRows;
    document.querySelectorAll('.rs-row').forEach(tr=>tr.onclick=()=>{openStreet=openStreet===tr.dataset.street?'':tr.dataset.street;render();});
  }catch(e){console.warn('Aba Ruas do rotativo:',e);}
};
})();
