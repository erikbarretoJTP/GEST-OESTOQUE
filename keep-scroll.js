// Mantém a posição da tela quando ela é redesenhada (atualização automática ou depois de salvar uma contagem).
// Antes, ao redesenhar, a lista era trocada inteira e a tela "subia". Agora a linha que estava no topo da tela
// volta para o mesmo lugar (ou, se ela não existir mais, a mesma altura de rolagem).
(function(){
const prev=render;
const rowKey=el=>el.getAttribute('aria-label')||'';
render=function(){
  const y=window.scrollY;let key='',off=0;
  try{for(const el of document.querySelectorAll('input.assigned-count')){const b=el.getBoundingClientRect();if(b.bottom>0&&b.height){key=rowKey(el);off=b.top;break;}}}catch{}
  const inner=[...document.querySelectorAll('.table-scroll')].map(e=>e.scrollTop);
  const out=prev.apply(this,arguments);
  try{
    document.querySelectorAll('.table-scroll').forEach((e,i)=>{if(inner[i])e.scrollTop=inner[i];});
    const el=key&&[...document.querySelectorAll('input.assigned-count')].find(x=>rowKey(x)===key);
    if(el)window.scrollBy(0,el.getBoundingClientRect().top-off);else if(Math.abs(window.scrollY-y)>2)window.scrollTo(0,y);
  }catch{}
  return out;
};
})();
