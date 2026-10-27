// Rotativo: resumo de desvios contra o saldo SAP, com motivo obrigatório por desvio.
(function(){
const EPS=1e-6;
function dev(inv){
 const rows=[];
 for(const l of inv.lines){const c=l.counts&&l.counts[0];if(!c)continue;const q=Number(c.qty),d=q-Number(l.balance);if(Math.abs(d)>EPS)rows.push({l,q,d,v:d*Number(l.cost||0)});}
 return rows.sort((a,b)=>Math.abs(b.v)-Math.abs(a.v));
}
function sums(inv,rows){const total=inv.lines.length,counted=inv.lines.filter(l=>l.counts&&l.counts[0]).length;let s=0,f=0;rows.forEach(r=>{if(r.v>0)s+=r.v;else f+=-r.v;});return{total,counted,dev:rows.length,ok:counted-rows.length,acc:counted?(counted-rows.length)/counted*100:0,surplus:s,shortage:f,net:s-f};}
const fm=v=>money(v),sign=v=>(v>0?'+':'')+num(v);
function html(inv,o={}){
 const rows=dev(inv),s=sums(inv,rows),edit=!!o.edit;
 const card=(t,v,c)=>`<div class="street-card ${c||''}"><small>${t}</small><h3>${v}</h3></div>`;
 return `<datalist id="dev-reasons"><option value="Item estava em outro endereço"><option value="Saída/requisição não baixada no SAP"><option value="Entrada (NF) não lançada no SAP"><option value="Avaria ou descarte sem baixa"><option value="Erro de lançamento no SAP"><option value="Contagem anterior incorreta"></datalist><div class="rot-sum"><div class="street-grid" style="grid-template-columns:repeat(3,1fr);padding:.6rem 0">${card('Itens contados',s.counted+' de '+s.total)}${card('Itens com desvio',s.dev,s.dev?'':'full')}${card('Acuracidade',s.acc.toFixed(1).replace('.',',')+'%',s.dev?'':'full')}${card('Sobras (SAP → contado)',fm(s.surplus))}${card('Faltas (SAP → contado)',fm(s.shortage))}${card('Resultado líquido',fm(s.net))}</div>`+
 (rows.length?`<h3 style="margin:.8rem 0 .4rem">Desvios contra o saldo SAP</h3><div class="rot-sum-table">${table(['ENDEREÇO','CÓDIGO / DESCRIÇÃO','SAP','CONTADO','DESVIO','MOTIVO'],rows.map(r=>`<tr><td>${esc(r.l.address||'—')}</td><td>${esc(r.l.sku)}<small>${esc(r.l.name)}</small></td><td>${num(r.l.balance)}<small>${esc(r.l.measure||'')}</small></td><td>${num(r.q)}</td><td><b>${sign(r.d)}</b><small>${fm(r.v)}</small></td><td>${edit?`<input class="dev-reason" data-sku="${esc(r.l.sku)}" value="${esc(r.l.reason||'')}" placeholder="Digite o motivo do desvio" list="dev-reasons" maxlength="200" required minlength="3">`:esc(r.l.reason||'—')}</td></tr>`))}</div>`:'<p class="source-note">Nenhum desvio: todas as contagens batem com o saldo SAP.</p>')+'</div>';
}
function reasons(){const o={};document.querySelectorAll('.dev-reason').forEach(i=>{o[i.dataset.sku]=i.value.trim();});return o;}
function csv(inv){return dev(inv).map(r=>({Endereço:r.l.address||'',Código:r.l.sku,Descrição:r.l.name,Unidade:r.l.measure||'',Saldo_SAP:r.l.balance,Contado:r.q,Desvio:r.d,Custo_unit:r.l.cost,Desvio_R$:r.v.toFixed(2),Motivo:r.l.reason||''}));}
function open(inv){
 openDialog('<div class="eyebrow">ROTATIVO</div><h2>Resumo de desvios</h2><p>'+esc(inventoryDisplayName(inv))+' · Rua '+esc(inv.street)+'</p>'+html(inv)+'<div class="actions"><button type="button" class="secondary" data-cancel>Fechar</button><button type="button" class="primary" id="rot-sum-csv">↓ Exportar desvios</button></div>');
 $('dialog').classList.add('req-dialog','rot-dialog','rot-summary-dialog');
 $('rot-sum-csv').onclick=()=>exportCSV(csv(inv),'desvios-'+inventoryDisplayName(inv));
}
window.JTP_ROT_SUMMARY={html,reasons,dev,sums,csv,open};
const base=render;
render=function(){
 base.apply(this,arguments);
 try{
  if(page!==3)return;
  const inv=inventories.find(i=>i.id===selectedInventory);
  if(!inv||inv.type!=='Rotativo'||inv.status!=='Concluído'||$('rot-sum-btn'))return;
  const b=document.createElement('div');b.className='actions';b.style.cssText='display:flex;justify-content:flex-end;margin-bottom:.6rem';b.innerHTML='<button class="primary" id="rot-sum-btn">Resumo de desvios</button>';
  $('content').prepend(b);$('rot-sum-btn').onclick=()=>open(inv);
 }catch(e){}
};
})();
