// Aplica por cima da base embutida os dados importados pelo admin (saldo SAP, WMS e lista de itens)
// guardados no Supabase. Todos os aparelhos recebem a atualização sozinhos (verifica a cada 45 s).
(function(){
const UNITS=['300','200','400','123','2002'];
const STATIC_DESC=Object.assign({},window.JTP_ITEM_DESCRIPTIONS||{});
const STATIC_HISTORY=JSON.parse(JSON.stringify(window.JTP_SOURCE?.stockHistory||[]));
window.JTP_STATIC_DESC=STATIC_DESC;
const D=window.JTP_DATA={status:null,key:'',busy:false};
const brDate=iso=>{const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[3]+'/'+m[2]+'/'+m[1]:String(iso||'');};
const isoDate=br=>{const m=String(br||'').match(/^(\d{2})\/(\d{2})\/(\d{4})/);return m?m[3]+'-'+m[2]+'-'+m[1]:'';};
const descOf=sku=>(window.JTP_ITEM_DESCRIPTIONS||{})[sku]||'Descrição não encontrada na lista de itens';
function applyCatalog(sets){
  const cat=sets.find(s=>s.kind==='catalog');
  const d=window.JTP_ITEM_DESCRIPTIONS;if(!d)return;
  for(const k of Object.keys(d))if(!(k in STATIC_DESC))delete d[k];
  Object.assign(d,STATIC_DESC);
  if(cat&&cat.payload&&typeof cat.payload==='object')Object.assign(d,cat.payload);
}
function recompute(unit){
  const m=(sourceMeta.units[unit]=sourceMeta.units[unit]||{});
  const ii=items.filter(i=>i.unit===unit);
  const locs=window.JTP_SOURCE.locations.filter(l=>l.unit===unit);
  const codes=new Set(locs.filter(l=>l.sku).map(l=>l.sku)),stock=new Set(ii.map(i=>i.sku));
  const byAddr={};locs.forEach(l=>{byAddr[l.address]=(byAddr[l.address]||0)+1;});
  const perSku={};locs.forEach(l=>{if(l.sku)(perSku[l.sku]=perSku[l.sku]||new Set()).add(l.address);});
  const positions=new Set(locs.map(l=>l.address)),occupied=new Set(locs.filter(l=>l.sku).map(l=>l.address));
  const without=ii.filter(i=>!(i.addresses&&i.addresses.length));
  Object.assign(m,{stockRecords:ii.length,stockValue:ii.reduce((s,i)=>s+Number(i.totalValue||0),0),withoutWMS:without.length,withoutWMSValue:without.reduce((s,i)=>s+Number(i.totalValue||0),0),locationOnlySKUs:[...codes].filter(c=>!stock.has(c)).length});
  if(locs.length)Object.assign(m,{positions:positions.size,occupiedPositions:occupied.size,vacantPositions:positions.size-occupied.size,locationRecords:locs.length,repeatedAddresses:Object.values(byAddr).filter(n=>n>1).length,multiAddressSKUs:Object.values(perSku).filter(s=>s.size>1).length,wmsLoaded:true});
}
function apply(data){
  const sets=data.sets||[];
  applyCatalog(sets);
  const touched=new Set();let latest='';
  // 1) saldo
  for(const s of sets.filter(x=>x.kind==='stock')){
    const u=s.branch,p=s.payload||{},date=p.date||'',rows=p.rows||[];
    if(!UNITS.includes(u))continue;
    const fresh=rows.map((r,i)=>({sku:String(r[0]),name:descOf(String(r[0])),unit:u,qty:Number(r[2]),price:Number(r[4]),totalValue:Number(r[5]),address:'',addresses:[],group:String(r[1]||''),measure:String(r[3]||''),stockDate:date,sourceRow:i+2,real:true}));
    for(let i=items.length-1;i>=0;i--)if(items[i].unit===u)items.splice(i,1);
    items.push(...fresh);
    Object.assign(sourceMeta.units[u]=sourceMeta.units[u]||{},{stockDate:date,stockTime:null,stockFile:s.meta?.file||'',stockLoaded:true,stockImportedAt:s.at,stockImportedBy:s.meta?.by||''});
    touched.add(u);if(isoDate(date)>latest)latest=isoDate(date);
    // saldos por data para o relatório final do inventário
    const day=isoDate(date);if(day){window.JTP_INVENTORY_REPORT_BALANCES=window.JTP_INVENTORY_REPORT_BALANCES||{};const o={};fresh.forEach(i=>{o[i.sku]={quantity:i.qty,unit:i.measure};});window.JTP_INVENTORY_REPORT_BALANCES[u+'|'+day]={date:day,file:s.meta?.file||'',items:o};}
  }
  // 2) WMS
  for(const s of sets.filter(x=>x.kind==='wms')){
    const u=s.branch,p=s.payload||{},rows=p.rows||[];
    if(!UNITS.includes(u))continue;
    const group={};items.filter(i=>i.unit===u).forEach(i=>{group[i.sku]=i.group;});
    const fresh=rows.map((r,i)=>{const sku=r[1]?String(r[1]):null;return{unit:u,address:String(r[0]),street:String(r[0]).split('.')[0],sku,name:sku?descOf(sku):'',sourceRow:i+1,sourceSheet:p.sheet||'',group:sku?(group[sku]||''):''};});
    const loc=window.JTP_SOURCE.locations;
    for(let i=loc.length-1;i>=0;i--)if(loc[i].unit===u)loc.splice(i,1);
    loc.push(...fresh);
    Object.assign(sourceMeta.units[u]=sourceMeta.units[u]||{},{wmsFile:s.meta?.file||'',wmsSheet:p.sheet||'',wmsDate:p.date||'Importado em '+new Date(s.at).toLocaleString('pt-BR'),wmsImportedAt:s.at,wmsImportedBy:s.meta?.by||''});
    touched.add(u);
  }
  // nomes das localizações dos demais itens acompanham a lista de itens
  for(const l of window.JTP_SOURCE.locations)if(l.sku&&UNITS.includes(l.unit)&&touched.has(l.unit))l.name=descOf(l.sku);
  // 3) índices e endereços
  stockIndex.clear();items.forEach(i=>stockIndex.set(i.unit+'|'+i.sku,i));
  try{refreshAllocations();}catch(e){}
  touched.forEach(recompute);
  if(latest){sourceMeta.stockDate=brDate(latest);sourceMeta.sapBalanceDate=brDate(latest);}
  // 4) histórico de valor (dashboard)
  const hist=(data.history||[]);
  if(hist.length){
    const days={};
    STATIC_HISTORY.forEach(h=>{days[h.date]={date:h.date,importedAt:h.importedAt,source:h.source,values:h.values.slice()};});
    const have={};hist.forEach(h=>{(have[h.day]=have[h.day]||new Set()).add(h.branch);});
    Object.keys(have).forEach(day=>{const d=days[day]=days[day]||{date:day,importedAt:'',source:'',values:[]};d.values=d.values.filter(v=>!have[day].has(v.unit));});
    hist.forEach(h=>{const d=days[h.day];d.importedAt=h.at;d.source=h.source||d.source;(h.values||[]).forEach(v=>d.values.push({unit:h.branch,group:v.group,value:Number(v.value)}));});
    window.JTP_SOURCE.stockHistory=Object.keys(days).sort().map(k=>days[k]);
  }
}
async function loadAdj(){try{const l=await JTP_RPC('jtp_adjust_list');window.JTP_ADJ=l;
  for(let i=reportedAccuracy.length-1;i>=0;i--)if(reportedAccuracy[i].imported)reportedAccuracy.splice(i,1);
  l.forEach(a=>reportedAccuracy.push({unit:a.unit,event:a.event,date:String(a.date).slice(0,10),negative:Number(a.negative),positive:Number(a.positive),withoutWMS:a.withoutWMS==null?undefined:Number(a.withoutWMS),stockValue:Number(a.stockValue),imported:true}));
  reportedAccuracy.sort((x,y)=>String(y.date).localeCompare(String(x.date)));}catch(e){}}
async function status(){return JTP_RPC('jtp_data_status');}
const keyOf=st=>(st.sets||[]).map(s=>s.kind+'|'+s.branch+'|'+s.at).sort().join(';');
async function load(force){
  if(D.busy)return;D.busy=true;
  try{
    const st=await status();D.status=st;const k=keyOf(st);
    if(force||k!==D.key){const data=await JTP_RPC('jtp_data_get');apply(data);D.key=k;await loadAdj();try{render();}catch(e){}}
  }catch(e){D.error=e.message;}finally{D.busy=false;}
}
D.reload=()=>load(true);D.status_=status;
let started=false;
const timer=setInterval(()=>{if(window.JTP_CLOUD_READY&&window.JTP_RPC&&typeof JTP_RPC==='function'){try{if(!(typeof selectedUser==='function'&&selectedUser()))return;}catch{return;}if(!started){started=true;load(false);setInterval(()=>{if(!document.hidden)load(false);},45000);}}},1000);
})();
