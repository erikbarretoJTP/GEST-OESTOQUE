// Inventário rotativo: melhorias de uso (nome legível, formulário simples, resumo ao vivo,
// itens sem unidade cadastrada e aviso claro quando o modo online ainda não suporta rotativo).
(function(){
const natural=(a,b)=>String(a).localeCompare(String(b),'pt-BR',{numeric:true,sensitivity:'base'});
const fmtDate=iso=>{const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}/${m[2]}`:'';};

// 1) Nome legível: "Rotativo · Rua 03 · 22/10" em vez de INV-1792676195582.
const baseName=inventoryDisplayName;
inventoryDisplayName=function(inv){
 if(inv&&inv.type==='Rotativo'&&!inv.displayNumber&&/^INV-\d+$/.test(String(inv.id)))return `Rotativo Rua ${inv.street} - ${fmtDate(inv.date)}`;
 return baseName(inv);
};

// 2) Item sem unidade cadastrada no SAP: a unidade escolhida na contagem vira a referência (fator 1),
//    em vez de travar a finalização da rua. O item fica sinalizado como "unidade não confirmada".
const baseConvert=convertCountMeasurement;
convertCountMeasurement=function(quantity,unit,factor,baseUnit){
 if(!String(baseUnit||'').trim()&&String(unit||'').trim()){const r=baseConvert(quantity,unit,1,unit);r.unitUnconfirmed=true;return r;}
 return baseConvert(quantity,unit,factor,baseUnit);
};

// 3) Resumo ao vivo: progresso, faltas, sobras e desvio da linha atualizam assim que a contagem é salva.
function liveSummary(inv,line){
 try{
  if(!inv||inv.type!=='Rotativo')return;
  const t=totals(inv),p=$('entry-progress');
  if(p)p.textContent=t.ready+' de '+inv.lines.length+' itens contados';
  if($('entry-shortages'))$('entry-shortages').textContent=money(t.shortages);
  if($('entry-surplus'))$('entry-surplus').textContent=money(t.surplus);
  const row=$('entry-row-'+inv.lines.indexOf(line)),cell=row&&row.querySelector('.count-result');
  if(cell){const f=finalQuantity(inv,line);cell.innerHTML=f===null?'—':num(f)+'<small>'+money((f-line.balance)*line.cost)+'</small>';}
 }catch(e){}
}
const baseSave=saveInlineCount;
saveInlineCount=function(inv,line){
 const r=baseSave.apply(this,arguments);
 Promise.resolve(r).then(()=>liveSummary(inv,line),()=>{});
 return r;
};

// 4) Marca visualmente os itens sem unidade cadastrada.
function markUnits(){
 document.querySelectorAll('.count-base span').forEach(s=>{if(/n[ãa]o identificada/i.test(s.textContent)){s.classList.add('unit-missing');s.title='Unidade não cadastrada no SAP. Escolha a unidade que está contando.';}});
}

// 5) Formulário "Novo inventário rotativo".
const baseCreate=createInventory;
createInventory=function(){
 if(page===3&&window.JTP_CLOUD_READY){baseCreate.apply(this,arguments);return;}
 baseCreate.apply(this,arguments);
 if(page!==3)return;
 const d=$('dialog'),f=$('form');if(!d||!d.open||!f||!f.elements.street)return;
 d.classList.add('req-dialog','rot-dialog');
 const h=f.querySelector('h2');if(h)h.textContent='Novo inventário rotativo';
 const eb=f.querySelector('.eyebrow');if(eb)eb.textContent='ROTATIVO';
 const lead=f.querySelector('h2 + p');if(lead)lead.textContent='Escolha a rua do WMS que você vai contar. Todos os itens dessa rua entram na contagem.';
 f.elements.type.value='Rotativo';const tl=f.elements.type.closest('label');if(tl)tl.hidden=true;
 const sl=f.elements.street.closest('label');if(sl&&sl.firstChild)sl.firstChild.textContent='Rua do WMS';
 const decorate=()=>{
  const unit=f.elements.unit.value,date=f.elements.date.value,sel=f.elements.street,current=sel.value;
  const count={};
  items.filter(x=>x.unit===unit).forEach(x=>{new Set((x.addresses||[x.address]).filter(Boolean).map(a=>a.split(/[.-]/)[0])).forEach(s=>{count[s]=(count[s]||0)+1;});});
  const open=new Set(inventories.filter(i=>i.type==='Rotativo'&&i.unit===unit&&i.status==='Em andamento').map(i=>i.street));
  const done=new Set(inventories.filter(i=>i.type==='Rotativo'&&i.unit===unit&&i.status==='Concluído'&&i.date===date).map(i=>i.street));
  const streets=Object.keys(count).sort(natural);
  sel.innerHTML=streets.map(s=>`<option value="${esc(s)}">Rua ${esc(s)} · ${count[s]} ${count[s]===1?'item':'itens'}${open.has(s)?' · em andamento':done.has(s)?' · já contada hoje':''}</option>`).join('');
  if(streets.includes(current))sel.value=current;sel.disabled=false;
 };
 const u=f.elements.unit.onchange;f.elements.unit.onchange=()=>{if(u)u();decorate();};
 f.elements.date.onchange=decorate;decorate();
};

// 6) Modo online: só líder/admin abre; quem não conta (gerente, CD) apenas consulta.
window.JTP_ROT_MARK=function(){
 try{const inv=inventories.find(i=>i.id===selectedInventory);if(!inv||inv.type!=='Rotativo')return;const set=window.JTP_ROT_PENDING?.()||new Set();
  document.querySelectorAll('.inline-count').forEach(inp=>{const line=inv.lines[Number(inp.dataset.line)],p=!!line&&set.has(inv.id+'|'+line.sku),fb=inp.closest('tr')?.querySelector('.save-feedback');inp.classList.toggle('rot-pending',p);if(fb){if(p)fb.textContent='Enviando…';else if(fb.textContent==='Enviando…'||fb.textContent==='Salvo automaticamente')fb.textContent=window.JTP_CLOUD_READY?'Salvo no servidor':fb.textContent;}});}catch(e){}
};
const baseRender=render;
render=function(){
 baseRender.apply(this,arguments);
 try{
  markUnits();window.JTP_ROT_MARK();
  if(window.JTP_CLOUD_READY&&page===3){
   const u=typeof selectedUser==='function'?selectedUser():null,leader=!!u&&(u.role==='Admin'||u.role==='Líder de almoxarifado'),counter=!!u&&(leader||u.role==='Almoxarife');
   const nb=$('new');if(nb)nb.hidden=!leader;
   if(!counter)document.querySelectorAll('.inline-count').forEach(i=>{i.disabled=true;i.title='Seu perfil só consulta o rotativo.';});
   document.querySelectorAll('.inventory-detail .source-note').forEach(n=>{n.textContent='Cada contagem é salva no servidor ao sair do campo e fica visível para toda a equipe. Só líder ou admin finaliza.';});
   const fin=$('entry-finish'),can=$('entry-cancel');if(!leader){if(fin)fin.hidden=true;if(can)can.hidden=true;}
  }
 }catch(e){}
};
render();
})();
