// Quem não é Admin enxerga somente "Inventário oficial" e "Inventário rotativo".
(function(){
const ALLOWED=[4,3],HOME=4;
const restricted=()=>{try{return !!currentOperator()&&!isAdmin();}catch{return false;}};
const prev=render;
render=function(){
  const r=restricted();
  if(r&&!ALLOWED.includes(page))page=HOME;
  prev.apply(this,arguments);
  document.querySelectorAll('nav button').forEach(b=>{b.hidden=r&&!ALLOWED.includes(Number(b.dataset.page));});
  document.body.classList.toggle('only-official',r);
};
document.addEventListener('click',e=>{const b=e.target.closest('nav button');if(b&&restricted()&&!ALLOWED.includes(Number(b.dataset.page))){e.stopImmediatePropagation();e.preventDefault();page=HOME;render();}},true);
try{render();}catch{}
})();
