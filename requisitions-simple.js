// Requisição de material - versão simples.
// Fluxo: PCM pede -> almoxarife entrega -> baixa o PDF para quem retira assinar.
// Reaproveita as regras e o armazenamento existentes; só muda o que aparece na tela.
(function(){
let tab='requested',limit=40;
const DEFAULT_REASON='BAIXA SERÁ FEITA DEPOIS';
if(!materialPendingReasons.includes(DEFAULT_REASON))materialPendingReasons.unshift(DEFAULT_REASON);
// Etapas: Aguardando retirada -> Baixa pendente (entregue, falta baixar no Praxio) -> Concluído (entregue e baixado).
const pendingCount=r=>materialDeliveries(r).filter(d=>!d.postedAt).length;
const isPending=r=>pendingCount(r)>0;
const isDone=r=>materialPosted(r);
const statusOf=r=>{const ds=materialDeliveries(r);if(!ds.length)return{t:'Aguardando retirada',c:'warn'};if(!materialComplete(r))return{t:isPending(r)?'Entrega parcial · baixa pendente':'Entrega parcial',c:'warn'};if(isPending(r))return{t:'Baixa pendente',c:'warn'};return{t:'Concluído',c:'ok'};};
const pendingReasons=r=>[...new Set(materialDeliveries(r).filter(d=>!d.postedAt).map(d=>d.pendingReason).filter(Boolean))].join(' · ');
const unitName=id=>esc(units.find(u=>u.id===id)?.name||id);

function emptyText(){
 if(tab==='requested')return canRequestMaterial()?'Nenhum pedido aguardando. Toque em “Nova requisição” para pedir material.':'Nenhum pedido aguardando retirada.';
 if(tab==='pending')return 'Nenhuma baixa pendente. Tudo o que foi entregue já foi baixado.';
 if(tab==='done')return 'Nenhuma requisição concluída ainda.';
 return 'Nenhuma requisição encontrada.';
}

renderMaterialRequests=function(){
 const all=requestRows().sort((a,b)=>b.requestedAt.localeCompare(a.requestedAt));
 $('title').textContent='Requisição de material';
 $('subtitle').textContent='Pedido do PCM → entrega pelo almoxarifado → PDF para assinatura.';
 $('new').hidden=!canRequestMaterial();$('new').textContent='＋ Nova requisição';$('new').onclick=openMaterialRequest;
 groupPicker.hidden=true;document.querySelector('main > .filters').hidden=true;
 const req=all.find(r=>r.id===selectedRequisition);if(req){renderDetail(req);return;}
 const match={requested:r=>!materialComplete(r),pending:isPending,done:isDone,all:()=>true};
 const counts={requested:all.filter(match.requested).length,pending:all.filter(match.pending).length,done:all.filter(match.done).length,all:all.length};
 const query=(window.__rsQuery||'').toLowerCase();
 const list=all.filter(match[tab]||match.all)
  .filter(r=>`${materialRequestNumber(r)} ${r.requestedBy} ${r.vehicle||''} ${r.workOrder||''} ${r.lines.map(l=>l.sku+' '+l.name).join(' ')}`.toLowerCase().includes(query));
 const tabs=[['requested','Aguardando retirada'],['pending','Baixa pendente'],['done','Concluídas'],['all','Todas']];
 $('content').innerHTML=`<section class="panel rs-panel"><div class="rs-toolbar"><div class="rs-tabs" role="tablist">${tabs.map(([v,l])=>`<button class="rs-tab ${v===tab?'selected':''}" role="tab" aria-selected="${v===tab}" data-rs-tab="${v}">${l}<b>${counts[v]}</b></button>`).join('')}</div><input id="rs-search" type="search" aria-label="Buscar requisição" placeholder="Buscar por prefixo, O.S. ou item" value="${esc(window.__rsQuery||'')}"></div>${list.length?`<div class="rs-list">${list.slice(0,limit).map(r=>{const st=statusOf(r),canOp=canDeliverMaterial(r.unit),deliver=canOp&&!materialComplete(r),baixar=canOp&&isPending(r)&&!deliver,act=deliver||baixar,label=deliver?'Entregar':baixar?'Dar baixa':'Abrir',why=isPending(r)&&pendingReasons(r);return `<article class="rs-card"><div class="rs-main"><b>${esc(materialRequestNumber(r))}</b><span>Prefixo ${esc(r.vehicle||'—')} · O.S. ${esc(r.workOrder||'—')}</span><small>${esc(r.requestedBy)} · ${esc(reqDate(r.requestedAt))} · ${unitName(r.unit)}</small>${isPending(r)?`<small class="rs-why">${pendingCount(r)} entrega(s) sem baixa${why?' · '+esc(why):''}</small>`:''}</div><span class="badge ${st.c==='warn'?'warn':''}">${st.t}</span><button class="${act?'primary':'secondary'} rs-open" data-id="${esc(r.id)}">${label}</button></article>`;}).join('')}</div>${list.length>limit?'<div class="rs-more"><button class="secondary" id="rs-more">Mostrar mais</button></div>':''}`:`<p class="rs-empty">${emptyText()}</p>`}</section>`;
 document.querySelectorAll('[data-rs-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.rsTab;limit=40;render();});
 document.querySelectorAll('.rs-open').forEach(b=>b.onclick=()=>{selectedRequisition=b.dataset.id;materialDetailTab='items';render();});
 if($('rs-more'))$('rs-more').onclick=()=>{limit+=40;render();};
 $('rs-search').oninput=e=>{window.__rsQuery=e.target.value;limit=40;const pos=e.target.selectionStart;render();$('rs-search').focus();$('rs-search').setSelectionRange(pos,pos);};
};

function renderDetail(req){
 const ds=materialDeliveries(req),operate=canDeliverMaterial(req.unit),st=statusOf(req),complete=materialComplete(req);
 $('new').hidden=true;document.querySelector('main > .filters').hidden=true;
 const audit=table(['DATA / HORA','USUÁRIO','AÇÃO'],(req.audit||[]).map(a=>`<tr><td>${esc(reqDate(a.at))}</td><td>${esc(a.userName)}</td><td>${esc({material_requested:'Requisição criada',material_delivered:'Entrega registrada',sap_posting_confirmed:'Baixa Praxio informada',pending_reason_updated:'Motivo alterado'}[a.action]||a.action)}</td></tr>`));
 const deliveries=ds.slice().reverse().map((d,i)=>`<article class="rs-delivery"><div class="rs-delivery-head"><b>Entrega ${ds.length-i} · ${esc(reqDate(d.deliveredAt))}</b></div><p>Retirado por <b>${esc(d.receiver)}</b> · Entregue por ${esc(d.deliveredBy)}</p>${table(['ITEM','QUANTIDADE'],d.lines.map(q=>`<tr><td>${esc(q.sku)}<small>${esc(req.lines.find(l=>l.sku===q.sku)?.name||'')}</small></td><td>${num(q.qty)}</td></tr>`))}<div class="rs-cta"><button class="primary" data-delivery-pdf="${esc(d.id)}">↓ Baixar PDF para assinatura</button></div><details class="rs-praxio ${d.postedAt?'':'rs-praxio-pending'}" ${d.postedAt?'':'open'}><summary>Baixa no Praxio ${d.postedAt?'· feita':'· PENDENTE'}</summary><div>${d.postedAt?`<p>Nº da baixa: <b>${esc(d.sapDocument)}</b> · ${esc(d.sapDocumentDate)}</p>`:`<p>${esc(d.pendingReason||'')}</p>${operate?`<div class="request-actions"><button class="primary" data-delivery-post="${esc(d.id)}">Informar baixa no Praxio</button><button class="secondary" data-delivery-reason="${esc(d.id)}">Alterar motivo</button></div>`:''}`}</div></details></article>`).join('');
 $('content').innerHTML=`<div class="rs-back"><button class="secondary" id="req-back">← Voltar para a lista</button></div><section class="panel rs-detail"><div class="rs-head"><div><div class="eyebrow">${unitName(req.unit)}</div><h2>${esc(materialRequestNumber(req))}</h2><p>${esc(req.purpose)}</p></div><span class="badge ${st.c==='warn'?'warn':''}">${st.t}</span></div><div class="request-summary"><span>Prefixo<b>${esc(req.vehicle||'—')}</b></span><span>O.S.<b>${esc(req.workOrder||'Não se aplica')}</b></span><span>Pedido por<b>${esc(req.requestedBy)}</b><small>${esc(reqDate(req.requestedAt))}</small></span></div><h3 class="rs-h3">Itens pedidos</h3>${table(['ITEM','LOCAL (WMS)','PEDIDO','JÁ ENTREGUE'],req.lines.map(l=>{const t=materialLineTotals(req,l);return `<tr><td><b>${esc(l.sku)}</b><small>${esc(l.name)}</small></td><td>${esc(l.address||'Sem WMS')}</td><td>${num(l.qty)} ${esc(l.measure)}</td><td>${num(t.delivered)}</td></tr>`;}))}${operate&&!complete?'<div class="rs-cta"><button class="primary rs-big" id="req-deliver">Entregar e gerar PDF</button><small>O PDF é para quem está retirando assinar.</small></div>':''}${!operate&&!complete?'<p class="request-help">Aguardando o almoxarifado separar e entregar o material.</p>':''}${ds.length?`<h3 class="rs-h3">Entregas</h3>${deliveries}`:''}<details class="rs-history"><summary>Histórico</summary>${audit}</details></section>`;
 $('req-back').onclick=()=>{selectedRequisition=null;render();};
 if($('req-deliver'))$('req-deliver').onclick=()=>openMaterialDelivery(req);
 document.querySelectorAll('[data-delivery-pdf]').forEach(b=>b.onclick=()=>downloadRequisitionPDF(req,b.dataset.deliveryPdf).catch(e=>toast(e.message)));
 document.querySelectorAll('[data-delivery-post]').forEach(b=>b.onclick=()=>openMaterialPosting(req,b.dataset.deliveryPost));
 document.querySelectorAll('[data-delivery-reason]').forEach(b=>b.onclick=()=>openMaterialReason(req,b.dataset.deliveryReason));
}

// Formulário de entrega: quantidades já preenchidas e a baixa no Praxio fica opcional.
const baseDelivery=openMaterialDelivery;
openMaterialDelivery=function(req){
 baseDelivery(req);const f=$('form');if(!f||!f.elements.postingMode)return;
 f.querySelectorAll('.delivery-qty').forEach(i=>{i.value=i.max;});
 const h=f.querySelector('h2');if(h)h.textContent='Entregar material';
 const p=f.querySelector('h2 + p');if(p)p.textContent='Confira as quantidades e informe quem está retirando. Ao confirmar, o PDF para assinatura é gerado.';
 const who=f.elements.receiver;if(who)who.placeholder='Nome de quem está retirando';
 const mode=f.elements.postingMode.closest('label'),det=document.createElement('details');det.className='rs-praxio';det.innerHTML='<summary>Baixa no Praxio (pode ser feita depois)</summary>';
 mode.before(det);det.append(mode,$('delivery-pending'),$('delivery-posted'));
 if(f.elements.reason){f.elements.reason.innerHTML=materialReasonOptions(DEFAULT_REASON);f.elements.reason.required=false;}
};

// Formulário de pedido: dados do pedido + lista de itens, com prévia do item digitado.
openMaterialRequest=function(){
 if(!canRequestMaterial()){toast('Selecione um usuário PCM ou admin.');return;}
 const available=units.filter(u=>canRequisitionUnit(u.id)),draft=[];
 openDialog(`<div class="eyebrow">NOVA REQUISIÇÃO</div><h2>O que você precisa?</h2><p class="rq-lead">Preencha os dados do pedido e adicione os itens. O almoxarifado recebe na hora.</p>
 <fieldset class="rq-box"><legend><span>1</span> Dados do pedido</legend>
  <label>Garagem<select name="warehouse">${available.map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></label>
  <label>Finalidade<input name="purpose" required maxlength="200" placeholder="Ex.: manutenção preventiva"></label>
  <div class="form-row"><label>Prefixo do veículo<input name="vehicle" maxlength="80" required placeholder="Ex.: 030111" autocomplete="off"></label><label>Número da O.S.<input name="workOrder" maxlength="80" required placeholder="Ex.: 12345" autocomplete="off"></label></div>
 </fieldset>
 <fieldset class="rq-box"><legend><span>2</span> Itens</legend>
  <div class="rq-add"><label class="rq-code">Código do item<input name="sku" list="req-catalog" autocomplete="off" placeholder="Digite o código ou parte do nome"><datalist id="req-catalog"></datalist></label><label class="rq-qty">Quantidade<input name="qty" type="number" step="any" min="0" inputmode="decimal" placeholder="0"></label><button type="button" class="secondary rq-addbtn" id="req-add-item">＋ Adicionar</button></div>
  <p class="rq-hint" id="rq-hint" aria-live="polite">Escolha o item na lista que aparece ao digitar.</p>
  <div id="req-draft" class="rq-draft"></div>
 </fieldset>
 <p id="req-error" role="alert"></p><div class="actions"><button type="button" class="secondary" data-cancel>Voltar</button><button class="primary" id="rq-send">Enviar ao almoxarifado</button></div>`);
 $('dialog').classList.add('req-dialog');const form=$('form');
 const unit=()=>form.elements.warehouse.value,lookup=sku=>stockIndex.get(unit()+'|'+String(sku||'').trim());
 function hint(){const i=lookup(form.elements.sku.value),raw=form.elements.sku.value.trim();const h=$('rq-hint');if(!raw){h.className='rq-hint';h.textContent='Escolha o item na lista que aparece ao digitar.';return;}if(!i){h.className='rq-hint bad';h.textContent='Código não encontrado nesta garagem.';return;}h.className='rq-hint ok';h.innerHTML=`<b>${esc(i.name)}</b><span>Saldo ${num(i.qty)} ${esc(i.measure)} · Local ${esc(i.address||'sem WMS')}</span>`;}
 function drawDraft(){$('req-catalog').innerHTML=items.filter(i=>i.unit===unit()).map(i=>`<option value="${esc(i.sku)}">${esc(i.name)}</option>`).join('');
  $('req-draft').innerHTML=draft.length?draft.map((line,index)=>{const i=stockIndex.get(unit()+'|'+line.sku);return `<div class="rq-line"><div><b>${esc(i.name)}</b><small>${esc(line.sku)}</small></div><span class="rq-qtyv">${num(line.qty)} ${esc(i.measure)}</span><button type="button" class="secondary req-remove" data-index="${index}" aria-label="Remover ${esc(line.sku)}">Remover</button></div>`;}).join(''):'<p class="rq-empty">Nenhum item adicionado ainda.</p>';
  $('rq-send').textContent=draft.length?`Enviar ao almoxarifado (${draft.length} ${draft.length===1?'item':'itens'})`:'Enviar ao almoxarifado';
  document.querySelectorAll('.req-remove').forEach(b=>b.onclick=()=>{draft.splice(Number(b.dataset.index),1);drawDraft();});}
 function addItem(){const sku=form.elements.sku.value.trim(),qty=Number(form.elements.qty.value);const err=$('req-error');
  if(!lookup(sku)){err.textContent='Código não encontrado na garagem. Escolha o item na lista.';form.elements.sku.focus();return;}
  if(!Number.isFinite(qty)||qty<=0||qty>100000000){err.textContent='Informe uma quantidade maior que zero.';form.elements.qty.focus();return;}
  if(draft.some(l=>l.sku===sku)){err.textContent='Esse item já está na lista. Remova-o para mudar a quantidade.';return;}
  draft.push({sku,qty});form.elements.sku.value='';form.elements.qty.value='';err.textContent='';hint();drawDraft();form.elements.sku.focus();}
 form.elements.warehouse.onchange=()=>{draft.splice(0);form.elements.sku.value='';hint();drawDraft();};
 form.elements.sku.oninput=hint;$('req-add-item').onclick=addItem;
 form.elements.qty.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addItem();}};form.elements.sku.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();form.elements.qty.focus();}};
 drawDraft();
 form.onsubmit=e=>{e.preventDefault();try{if(!draft.length)throw Error('Adicione pelo menos um item à lista.');const req=createMaterialRequisition({unit:unit(),purpose:form.elements.purpose.value,vehicle:form.elements.vehicle.value,workOrder:form.elements.workOrder.value,lines:draft});selectedRequisition=req.id;$('dialog').close();render();toast('Requisição enviada ao almoxarifado.');}catch(error){$('req-error').textContent=error.message;}};
};
})();
