// Telas desativadas: WMS, Inventário rotativo e Requisição de material. Saídas virão de outro app.
(function(){
const OFF=[2,3,7];
const prev=render;
render=function(){
  if(OFF.includes(page))page=0;
  prev.apply(this,arguments);
  try{
    document.querySelectorAll('#nav button').forEach(b=>{if(OFF.includes(Number(b.dataset.page)))b.style.display='none';});
    if(page!==0)return;
    const rot=document.querySelector('.rotating-accuracy-kpi');if(rot)rot.style.display='none';
    const ex=document.querySelector('.material-exit-kpi');
    if(ex&&!ex.dataset.done){ex.dataset.done='1';ex.innerHTML='<div class="card-top"><span class="label">SAÍDAS DE MATERIAL</span></div><div class="value">—</div><small>Indicador será integrado a partir de outro app da empresa.</small>';}
    document.querySelectorAll('.inventory-history-grid > .panel').forEach(p=>{const h=p.querySelector('h2');if(h&&/inventários rotativos/i.test(h.textContent)){p.style.display='none';p.parentElement.style.gridTemplateColumns='1fr';}});
    // gráfico de evolução em largura total; inventário oficial passa para a linha de baixo, ao lado de "Valor por estoque"
    const grid=document.querySelector('.stock-overview-grid'),tr=grid&&grid.querySelector('.stock-trend'),off=document.querySelector('.official-history-panel');
    if(grid&&tr){grid.parentElement.insertBefore(tr,grid);tr.style.marginBottom='1rem';
      if(off){grid.append(off);grid.style.gridTemplateColumns='1fr 1fr';}
      const hg=document.querySelector('.inventory-history-grid');if(hg&&!hg.querySelector('.official-history-panel'))hg.style.display='none';}
  }catch(e){}
};
try{render();}catch(e){}
})();
