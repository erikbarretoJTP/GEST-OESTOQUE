// Cronômetro + horário de início/término no rotativo (igual ao oficial) e filtros por tela:
// "Estoque" (garagem) sempre visível; "Grupo de itens" só no Dashboard.
(function(){
const fmt=iso=>{const d=new Date(iso);if(isNaN(d))return '—';return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});};
function times(inv){const closed=inv.status==='Concluído'||inv.status==='Cancelado',end=inv.status==='Cancelado'?inv.cancelledAt:inv.finishedAt;return 'Início '+fmt(inv.startedAt)+' · '+(closed?(inv.status==='Cancelado'?'Cancelado ':'Término ')+fmt(end):'Término em andamento');}
const prev=render;
render=function(){
  prev.apply(this,arguments);
  try{
    // filtros
    const gp=document.querySelector('.group-picker');if(gp)gp.hidden=page!==0&&page!==1&&page!==5;
    const ul=$('unit')?.closest('label');if(ul&&page!==7)ul.hidden=false;
    if(page!==3&&page!==4)return;
    const inv=inventories.find(i=>i.id===selectedInventory);
    if(page===3&&inv&&inv.type==='Rotativo'){
      const detail=$('content').querySelector('.inventory-detail');
      if(detail&&!detail.querySelector('.inventory-clock')){const h=detail.querySelector('.panel-heading')||detail.firstElementChild;if(h)h.insertAdjacentHTML('afterend',inventoryClockMarkup(inv));}
    }
    // horário de início/término junto de cada cronômetro (rotativo e oficial)
    document.querySelectorAll('.inventory-clock:not(.compact)').forEach(c=>{
      const i=inventories.find(x=>x.id===c.dataset.clockInventory);if(!i)return;
      let t=c.querySelector('.clock-times');if(!t){t=document.createElement('small');t.className='clock-times';c.append(t);}
      t.textContent=times(i);
    });
    if(page===3)document.querySelectorAll('.entry-open').forEach(button=>{const rowInv=inventories.find(i=>i.id===button.dataset.id),row=button.closest('tr');if(rowInv&&row&&!row.querySelector('.inventory-clock'))row.cells[0].insertAdjacentHTML('beforeend',inventoryClockMarkup(rowInv,true));});
  }catch(e){}
};
})();
