// Inventário rotativo: aba "WMS divergente". Quem conta registra endereço com outro item, endereço vazio ou item sem endereço no WMS.
// Código encontrado que não está na rua entra na contagem (servidor usa o saldo SAP atual da garagem). A lista serve para corrigir a planilha do WMS.
(function(){
const KINDS={diferente:'Outro item no endereço',vazio:'Endereço vazio',sem_endereco:'Item sem endereço no WMS'};
let draft={kind:'diferente',address:'',found:'',note:''},open=true,busy=false;
const fmtAt=s=>{const d=new Date(s);return isNaN(d)?'':d.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});};
const descOf=(inv,sku)=>inv.lines.find(l=>String(l.sku)===sku)?.name||(window.JTP_ITEM_DESCRIPTIONS||{})[sku]||stockIndex.get(inv.unit+'|'+sku)?.name||'';
function wmsAt(inv,address){return inv.lines.filter(l=>(l.addresses?.length?l.addresses:String(l.address||'').split(' · ')).includes(address));}
function streetAddresses(inv){const s=new Set();inv.lines.forEach(l=>(l.addresses?.length?l.addresses:String(l.address||'').split(' · ')).filter(Boolean).forEach(a=>s.add(a)));return [...s].sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true}));}
function exportList(inv){const list=inv.wmsDivergences||[];if(!list.length){toast('Nenhuma divergência registrada.');return;}
  exportCSV(list.map(w=>({Rotativo:inventoryDisplayName(inv),Garagem:inv.unit,Rua:inv.street,Endereco:w.address,Tipo:KINDS[w.kind]||w.kind,CodigoNoWMS:w.wmsSku||'',DescricaoNoWMS:w.wmsSku?descOf(inv,w.wmsSku):'',CodigoEncontrado:w.foundSku||'',DescricaoEncontrada:w.foundName||'',Observacao:w.note||'',IncluidoNaContagem:w.addedLine?'Sim':'Não',Por:w.by||'',Em:fmtAt(w.at)})),'jtp-'+inventoryDisplayName(inv).replace(/\s/g,'-')+'-wms-divergente');}
function panelHtml(inv){
  const list=inv.wmsDivergences||[],editable=inv.status==='Em andamento',addrs=streetAddresses(inv),atAddr=draft.address?wmsAt(inv,draft.address):[];
  const foundName=draft.found?descOf(inv,draft.found.trim()):'',outside=draft.found&&!inv.lines.some(l=>String(l.sku)===draft.found.trim());
  const form=editable?`<div class="rot-wms-form">
    <label>TIPO<select id="rw-kind">${Object.entries(KINDS).map(([k,v])=>`<option value="${k}" ${draft.kind===k?'selected':''}>${v}</option>`).join('')}</select></label>
    <label>ENDEREÇO<input id="rw-address" list="rw-addresses" maxlength="40" placeholder="01.02.03.04" value="${esc(draft.address)}"><datalist id="rw-addresses">${addrs.map(a=>`<option value="${esc(a)}">`).join('')}</datalist></label>
    <div class="rw-wms"><span>NO WMS</span><b>${draft.kind==='sem_endereco'?'—':atAddr.length?atAddr.map(l=>esc(l.sku)+' · '+esc(l.name)).join('<br>'):draft.address?'Endereço sem item na rua':'—'}</b></div>
    ${draft.kind==='vazio'?'':`<label>CÓDIGO ENCONTRADO<input id="rw-found" inputmode="numeric" maxlength="60" value="${esc(draft.found)}"><small>${foundName?esc(foundName):draft.found?'Código não encontrado na lista de itens':''}${outside?' · <b>entra na contagem</b>':''}</small></label>`}
    <label class="rw-note">OBSERVAÇÃO<input id="rw-note" maxlength="300" placeholder="opcional" value="${esc(draft.note)}"></label>
    <button type="button" class="primary" id="rw-save" ${busy?'disabled':''}>Salvar</button></div><p class="form-error" id="rw-error" role="alert"></p>`:'';
  const rows=list.map(w=>`<tr><td><b>${esc(w.address)}</b></td><td>${esc(KINDS[w.kind]||w.kind)}${w.addedLine?'<small>incluído na contagem</small>':''}</td><td>${w.wmsSku?esc(w.wmsSku)+'<small>'+esc(descOf(inv,w.wmsSku))+'</small>':'—'}</td><td>${w.foundSku?esc(w.foundSku)+'<small>'+esc(w.foundName||'')+'</small>':'—'}</td><td>${esc(w.note||'')}</td><td>${esc(w.by||'')}<small>${esc(fmtAt(w.at))}</small></td><td>${editable?`<button type="button" class="secondary rw-del" data-id="${w.id}">Excluir</button>`:''}</td></tr>`).join('');
  return `<details class="panel rot-wms" ${open?'open':''}><summary><span>WMS divergente <em>${list.length}</em></span><small>Endereços do WMS diferentes do que foi encontrado na rua · corrigir a planilha do WMS depois da contagem</small></summary>
    ${form}${list.length?`<div class="table-wrap"><table><thead><tr><th>ENDEREÇO</th><th>TIPO</th><th>NO WMS</th><th>ENCONTRADO</th><th>OBSERVAÇÃO</th><th>REGISTRO</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`:'<p class="source-note">Nenhuma divergência registrada neste rotativo.</p>'}
    <div class="actions"><button type="button" class="secondary" id="rw-export" ${list.length?'':'disabled'}>↓ Exportar divergências</button></div></details>`;
}
function bind(inv){
  const host=document.querySelector('.rot-wms');if(!host)return;
  host.addEventListener('toggle',()=>{open=host.open;});
  const sync=()=>{draft={kind:$('rw-kind')?.value||draft.kind,address:$('rw-address')?.value??draft.address,found:$('rw-found')?.value??draft.found,note:$('rw-note')?.value??draft.note};};
  const repaint=()=>{const y=window.scrollY,el=document.activeElement?.id;host.outerHTML=panelHtml(inv);bind(inv);if(el&&$(el)){$(el).focus();const v=$(el).value;if($(el).setSelectionRange&&typeof v==='string')try{$(el).setSelectionRange(v.length,v.length);}catch{}}window.scrollTo(0,y);};
  if($('rw-kind'))$('rw-kind').onchange=()=>{sync();repaint();};
  ['rw-address','rw-found'].forEach(id=>{if($(id))$(id).onchange=()=>{sync();repaint();};});
  if($('rw-note'))$('rw-note').oninput=sync;
  ['rw-address','rw-found'].forEach(id=>{if($(id))$(id).oninput=sync;});
  if($('rw-export'))$('rw-export').onclick=()=>exportList(inv);
  if($('rw-save'))$('rw-save').onclick=async()=>{sync();const err=$('rw-error');err.textContent='';
    const address=draft.address.trim(),found=draft.kind==='vazio'?'':draft.found.trim();
    if(!address){err.textContent='Informe o endereço.';return;}if(draft.kind!=='vazio'&&!found){err.textContent='Informe o código encontrado.';return;}
    const wms=draft.kind==='sem_endereco'?null:(wmsAt(inv,address)[0]?.sku||null);
    busy=true;repaint();
    try{const r=await JTP_RPC('jtp_rotativo_wms_save',{p_rotativo:inv.id,p:{address,kind:draft.kind,wms_sku:wms,found_sku:found,found_name:found?descOf(inv,found):'',note:draft.note.trim()}});
      draft={kind:draft.kind,address:'',found:'',note:''};toast(r?.addedLine?'Divergência salva. O item entrou na contagem.':'Divergência salva.');busy=false;await window.JTP_RELOAD?.();refresh();}
    catch(e){busy=false;repaint();$('rw-error').textContent=e.message||'Falha ao salvar.';}finally{busy=false;}};
  host.querySelectorAll('.rw-del').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir esta divergência?'))return;try{const r=await JTP_RPC('jtp_rotativo_wms_delete',{p_rotativo:inv.id,p_id:Number(b.dataset.id)});toast(r?.removedLine?'Excluída. O item incluído saiu da contagem.':'Divergência excluída.');await window.JTP_RELOAD?.();refresh();}catch(e){toast(e.message||'Falha ao excluir.');}});
}
// redesenha a aba com o estado mais novo (depois de salvar/excluir, mesmo que a tela não tenha sido refeita)
function refresh(){const h=document.querySelector('.rot-wms'),inv=inventories.find(i=>i.id===selectedInventory);if(h&&inv){h.outerHTML=panelHtml(inv);bind(inv);}}
function attach(){
  if(page!==3||!selectedInventory)return;const inv=inventories.find(i=>i.id===selectedInventory);if(!inv||inv.type!=='Rotativo'||!inv._remote)return;
  if(document.querySelector('.rot-wms'))return;
  const anchor=document.querySelector('#content [id^="entry-row-"]')?.closest('.panel,.table-panel,section,.table-wrap');if(!anchor)return;
  anchor.insertAdjacentHTML('beforebegin',panelHtml(inv));bind(inv);
}
const prev=render;
render=function(){prev.apply(this,arguments);try{attach();}catch(e){}};
})();
