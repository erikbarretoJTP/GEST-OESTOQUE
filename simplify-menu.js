// Telas desativadas: WMS e Requisição de material. Saídas virão de outro app.
(function(){
const OFF=[2,7];
const prev=render;
render=function(){
  if(OFF.includes(page))page=0;
  prev.apply(this,arguments);
  try{
    document.querySelectorAll('#nav button').forEach(b=>{if(OFF.includes(Number(b.dataset.page)))b.style.display='none';});
    if(page!==0)return;
    const ex=document.querySelector('.material-exit-kpi');
    if(ex&&!ex.dataset.done){ex.dataset.done='1';ex.innerHTML='<div class="card-top"><span class="label">SAÍDAS DE MATERIAL</span></div><div class="value">—</div><small>Indicador será entregue a partir do app do Modelo Operacional.</small>';}
    // gráfico de evolução em largura total; inventário oficial passa para a linha de baixo, ao lado de "Valor por estoque"
    const grid=document.querySelector('.stock-overview-grid'),tr=grid&&grid.querySelector('.stock-trend'),off=document.querySelector('.official-history-panel');
    if(grid&&tr){grid.parentElement.insertBefore(tr,grid);tr.style.marginBottom='1rem';
      if(off){grid.append(off);grid.style.gridTemplateColumns='1fr 1fr';}
      // sobra o histórico dos rotativos: ocupa a linha inteira
      const hg=document.querySelector('.inventory-history-grid');if(hg){if(hg.querySelector('.panel'))hg.style.gridTemplateColumns='1fr';else hg.style.display='none';}}
  }catch(e){}
};
try{render();}catch(e){}
})();
