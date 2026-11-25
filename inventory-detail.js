// Inventários antigos vêm do banco só como resumo ("_summary": linhas, auditoria e WMS vazios) para o banco não
// montar tudo a cada atualização (SQL 17). Este arquivo busca o inventário completo (operação jtp_inventory_detail):
// primeiro o que estiver aberto e depois, um de cada vez e com folga, os demais (para a lista mostrar valores e
// acuracidade certos). Inventário antigo não muda, então cada um é buscado só uma vez por abertura da página;
// o setState mantém o completo enquanto a revisão não mudar.
(function(){
let busy=false,timer=null;const failed=new Set();
const summaries=()=>typeof inventories==='undefined'?[]:inventories.filter(i=>i&&i._summary&&!failed.has(i.id));
function next(){
  const list=summaries();if(!list.length)return null;
  const open=typeof selectedInventory!=='undefined'&&selectedInventory?list.find(i=>i.id===selectedInventory):null;
  return open||list[0];
}
function pump(delay){
  if(busy||timer||typeof window.JTP_RPC!=='function')return;
  const inv=next();if(!inv)return;
  const open=typeof selectedInventory!=='undefined'&&selectedInventory===inv.id;
  timer=setTimeout(()=>{timer=null;busy=true;
    window.JTP_RPC('jtp_inventory_detail',{p_inventory:inv.id}).then(full=>{
      if(!full||!Array.isArray(full.lines)||full._summary){failed.add(inv.id);return;}
      window.jtpApplyInventoryDescriptions?.(full);
      const i=inventories.findIndex(x=>x.id===full.id);if(i>=0)inventories[i]=full;
      const typing=document.activeElement?.matches?.('input,select,textarea')||document.getElementById('dialog')?.open;
      if(!typing)render();
    }).catch(e=>{if(/Operação inválida/i.test(e?.message||''))summaries().forEach(x=>failed.add(x.id));else failed.add(inv.id);})
    .finally(()=>{busy=false;pump(1500);});
  },open?0:delay);
}
const prev=render;
render=function(){const out=prev.apply(this,arguments);try{pump(2000);}catch{}return out;};
})();
