// Inventário por depósito (coluna "Estoque" do WMS, hoje só no CD: LEVES, PESADOS, PISO SUP. BORRACHARIA, ESTOQUE 2).
// Cada rua pertence a um depósito. Agrupa as ruas por depósito na designação das duplas e na abertura do rotativo,
// mostra o depósito ao lado do endereço na contagem e acrescenta a coluna "Deposito" nas exportações.
// Garagem sem a coluna no WMS fica como sempre foi.
(function(){
const streetOf=a=>String(a||'').trim().split(/[.-]/)[0];
const byStreet=(a,b)=>String(a).localeCompare(String(b),'pt-BR',{numeric:true});
// rua -> depósito, pelo WMS em uso (depósito mais frequente da rua)
function depositMap(unit){const count={},map={};
  (window.JTP_SOURCE?.locations||[]).forEach(l=>{if(l.unit!==unit||!l.area)return;const st=streetOf(l.address);(count[st]=count[st]||{})[l.area]=(count[st][l.area]||0)+1;});
  Object.keys(count).forEach(st=>{map[st]=Object.entries(count[st]).sort((a,b)=>b[1]-a[1])[0][0];});return map;}
window.jtpDepositMap=depositMap;
const firstAddress=txt=>String(txt||'').split(' · ').map(s=>s.trim()).filter(Boolean).sort(byStreet)[0]||'';
// grupos de ruas por depósito, na ordem da menor rua de cada um
function groupsOf(streets,map){const g={};streets.forEach(s=>{const d=map[s]||'Sem depósito';(g[d]=g[d]||[]).push(s);});
  return Object.entries(g).sort((a,b)=>byStreet(a[1].slice().sort(byStreet)[0],b[1].slice().sort(byStreet)[0]));}

// 1) designação das duplas (inventário oficial)
if(typeof openAssignment==='function'){const original=openAssignment;openAssignment=function(inv){original.apply(this,arguments);try{groupAssignment(inv);}catch(e){}};}
function groupAssignment(inv){
  const map=depositMap(inv.unit),box=document.querySelector('.assignment-streets');if(!box||!Object.keys(map).length)return;
  const labels=[...box.querySelectorAll(':scope > label')],byValue=new Map(labels.map(l=>[l.querySelector('input')?.value,l]));
  box.innerHTML='';box.classList.add('dep-grouped');
  groupsOf([...byValue.keys()].filter(Boolean),map).forEach(([dep,streets])=>{
    const group=document.createElement('div');group.className='dep-group';
    const head=document.createElement('label');head.className='dep-head';head.innerHTML=`<input type="checkbox"> <b>${esc(dep)}</b> <small>${streets.length} ${streets.length===1?'rua':'ruas'} · depósito inteiro</small>`;
    const items=streets.map(s=>byValue.get(s));group.append(head,...items);box.append(group);
    const all=head.querySelector('input'),boxes=items.map(l=>l.querySelector('input'));
    const sync=()=>{all.checked=boxes.every(i=>i.checked);all.indeterminate=!all.checked&&boxes.some(i=>i.checked);};
    boxes.forEach(i=>i.addEventListener('change',sync));all.onchange=()=>{boxes.forEach(i=>{i.checked=all.checked;});};sync();});
}

// 2) abertura do rotativo: ruas do select agrupadas por depósito
function groupRotativoSelect(){
  const form=$('form'),sel=form?.querySelector('select[name="street"]'),unit=form?.querySelector('select[name="unit"]')?.value;if(!sel||!unit)return;
  const sig=unit+'|'+[...sel.options].map(o=>o.value).join(',');if(sel.dataset.depSig===sig)return;
  const map=depositMap(unit);sel.dataset.depSig=sig;if(!Object.keys(map).length)return;
  const chosen=sel.value,opts=[...sel.options];sel.innerHTML='';
  groupsOf(opts.map(o=>streetOf(o.value)),map).forEach(([dep,streets])=>{const og=document.createElement('optgroup');og.label=dep;
    streets.forEach(s=>{const o=opts.find(x=>streetOf(x.value)===s);if(o)og.append(o);});sel.append(og);});
  sel.value=chosen;sel.dataset.depSig=unit+'|'+[...sel.options].map(o=>o.value).join(',');
}
new MutationObserver(()=>{try{groupRotativoSelect();}catch(e){}}).observe(document.body,{childList:true,subtree:true});

// 3) contagem: depósito ao lado do endereço (a lista é paginada e as linhas salvam pelo índice, por isso não filtra)
function tagCounting(){
  if(page!==3&&page!==4)return;const inv=inventories.find(i=>i.id===selectedInventory)||inventories.find(i=>i.id===officialReview?.invId||(officialTaskId&&officialTaskId.startsWith(i.id+'-A-')));if(!inv)return;
  const codes=[...document.querySelectorAll('#content .allocation-code')].filter(c=>c.dataset.dep===undefined);if(!codes.length)return;
  const maps={};codes.forEach(c=>{const u=inv.unit,m=maps[u]=maps[u]||depositMap(u),dep=m[streetOf(firstAddress(c.textContent))]||'';c.dataset.dep=dep;
    if(dep){const t=document.createElement('small');t.className='dep-tag';t.textContent=dep;c.after(t);}});
}
const prev=render;
render=function(){prev.apply(this,arguments);try{tagCounting();}catch(e){}};

// 4) exportações: coluna "Deposito" logo depois do endereço
if(typeof exportCSV==='function'){const original=exportCSV;exportCSV=function(rows,name){try{rows=withDeposit(rows);}catch(e){}return original.call(this,rows,name);};}
function withDeposit(rows){
  if(!rows?.length)return rows;const keys=Object.keys(rows[0]),ak=keys.find(k=>/^(Endere[cç]o|EnderecoWMS|Endere[cç]os|Alocacao|Alocacoes)$/i.test(k));if(!ak||keys.includes('Deposito'))return rows;
  const uk=keys.find(k=>/^(Estoque|Unidade|Garagem|Filial)$/i.test(k)),invUnit=inventories.find(i=>i.id===selectedInventory)?.unit,maps={};
  let any=false;const out=rows.map(r=>{const u=uk&&/^\d+$/.test(String(r[uk]))?String(r[uk]):invUnit;if(!u)return r;const m=maps[u]=maps[u]||depositMap(u);
    const dep=m[streetOf(firstAddress(r[ak]))]||'';if(dep)any=true;const o={};Object.keys(r).forEach(k=>{o[k]=r[k];if(k===ak)o.Deposito=dep;});return o;});
  return any?out:rows;
}
})();
