// Indicador de entradas: notas emitidas para a garagem (relatório DF-e importado) x notas com entrada no SAP.
// Cancelada não conta; "Documento Encontrado na Sefaz" e "Operação não Realizada" ficam como pendentes. Mês pela data de criação.
(function(){
const OK='Manifesto Vinculado (Confirmação da Operação)',CANCEL='Cancelado (Sefaz)';
const unitName=u=>units.find(x=>x.id===u)?.name||u;
const brDay=s=>{const m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[3]+'/'+m[2]+'/'+m[1]:'';};
function metrics(docs){const valid=docs.filter(d=>d.situation!==CANCEL),done=valid.filter(d=>d.situation===OK);
  return{total:valid.length,done:done.length,cancelled:docs.length-valid.length,pending:valid.filter(d=>d.situation!==OK),percent:valid.length?done.length/valid.length*100:null};}
window.jtpEntryMetrics=metrics;
function pendingDialog(list,month){
  const rows=list.slice().sort((a,b)=>String(a.created).localeCompare(String(b.created)));
  openDialog(`<div class="eyebrow">ENTRADAS · ${esc(month)}</div><h2>Notas sem entrada</h2><p>${rows.length} ${rows.length===1?'nota emitida ainda sem':'notas emitidas ainda sem'} confirmação de recebimento no SAP. Mais antigas primeiro.</p>
    <div class="table-wrap" style="max-height:55vh;overflow:auto"><table><thead><tr><th>CRIAÇÃO</th><th>GARAGEM</th><th>Nº</th><th>PARCEIRO</th><th>VALOR</th><th>SITUAÇÃO</th></tr></thead><tbody>${rows.map(d=>`<tr><td>${esc(brDay(d.created))}</td><td>${esc(d.unit)} · ${esc(unitName(d.unit))}</td><td>${esc(d.number||'')}<small>${esc(d.model||'')}</small></td><td>${esc(d.partner||'')}</td><td>${d.total==null?'—':money(Number(d.total))}</td><td>${esc(d.situation)}</td></tr>`).join('')}</tbody></table></div>
    <div class="actions"><button type="button" class="secondary" id="dfe-export">↓ Exportar CSV</button><button type="button" class="primary" data-cancel>Fechar</button></div>`);
  $('dfe-export').onclick=()=>exportCSV(rows.map(d=>({Garagem:d.unit,Criacao:brDay(d.created),Numero:d.number||'',Modelo:d.model||'',Parceiro:d.partner||'',Valor:d.total==null?'':Number(d.total),Situacao:d.situation,Chave:d.key})),'jtp-entradas-pendentes');
}
function card(el){
  el.classList.remove('entry-kpi-on');
  if(!Array.isArray(window.JTP_DFE)||!window.JTP_DFE.length){el.innerHTML='<div class="card-top"><span class="label">ENTRADAS DE NOTAS</span></div><div class="value">—</div><small>Importe o relatório DF-e em Importação de dados.</small>';return;}
  const u=$('unit')?.value||'all',all=window.JTP_DFE.filter(d=>u==='all'||d.unit===u);
  const month=all.reduce((m,d)=>{const k=String(d.created).slice(0,7);return k>m?k:m;},'');
  if(!month){el.innerHTML='<div class="card-top"><span class="label">ENTRADAS DE NOTAS</span></div><div class="value">—</div><small>Sem notas importadas para este estoque.</small>';return;}
  const label=month.slice(5,7)+'/'+month.slice(0,4),m=metrics(all.filter(d=>String(d.created).startsWith(month)));
  el.classList.add('entry-kpi-on');
  el.title='Notas com entrada (confirmação da operação) ÷ notas emitidas no mês, sem as canceladas. Mês pela data de criação no DF-e.';
  el.innerHTML=`<div class="card-top"><span class="label">ENTRADAS DE NOTAS · ${esc(label)}</span></div><div class="value">${m.percent===null?'—':Math.round(m.percent)+'%'}</div><div class="material-exit-counts"><b>${m.total}</b> ${m.total===1?'emitida':'emitidas'} / <b>${m.done}</b> com entrada</div>${m.pending.length?`<button type="button" class="secondary dashboard-card-link" id="dfe-pending">Ver ${m.pending.length} ${m.pending.length===1?'pendente':'pendentes'} →</button>`:'<small>Nenhuma pendente</small>'}`;
  if($('dfe-pending'))$('dfe-pending').onclick=()=>pendingDialog(m.pending,label);
}
const prev=render;
render=function(){prev.apply(this,arguments);if(page!==0)return;try{const el=document.querySelector('.pending-entry-kpi');if(el)card(el);}catch(e){}};
})();
