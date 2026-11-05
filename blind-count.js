// Contagem às cegas: quem só conta não vê saldo SAP, custo nem desvio.
// Veem: Admin, Líder de almoxarifado e Gerente. No rotativo do CD (2002) o Almoxarife e o perfil CD também veem e finalizam (partes 20 e 21 do SQL).
(function(){
const SEE=['Admin','Líder de almoxarifado','Gerente'];
window.jtpRotativoOpen=unit=>{try{const u=selectedUser();return unit==='2002'&&!!u&&(u.role==='Almoxarife'||u.role==='CD')&&(u.units||[]).includes('2002');}catch{return false;}};
function cdRotativo(){if(page!==3)return false;const inv=inventories.find(i=>i.id===selectedInventory);if(inv)return inv.type==='Rotativo'&&jtpRotativoOpen(inv.unit);
  const u=selectedUser(),f=$('unit')?.value;return jtpRotativoOpen('2002')&&(f==='2002'||(u.units||[]).every(x=>x==='2002'));}
const blind=()=>{try{const u=selectedUser();return !!u&&!SEE.includes(u.role)&&!cdRotativo();}catch{return false;}};
const prev=render;
render=function(){
  prev.apply(this,arguments);
  try{
    const on=blind()&&(page===3||page===4);
    document.body.classList.toggle('blind-count',on);
    if(!on)return;
    document.querySelectorAll('#content table').forEach(t=>{
      const ths=[...t.querySelectorAll('thead th')];
      const idx=ths.map((h,i)=>/SALDO|FINAL \/ DESVIO|CUSTO/i.test(h.textContent)?i:-1).filter(i=>i>=0);
      if(!idx.length)return;
      t.querySelectorAll('tr').forEach(tr=>{[...tr.children].forEach((c,i)=>{if(idx.includes(i))c.style.display='none';});tr.classList.remove('deviation','short','surplus','diverged');});
    });
    document.querySelectorAll('.inventory-totals,#entry-export-sap,#entry-counts').forEach(e=>{e.style.display='none';});
  }catch(e){}
};
})();
