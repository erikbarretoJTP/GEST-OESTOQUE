// Data padrão do formulário = hoje (fuso local), sempre atualizada ao abrir.
(function(){var t=function(){var d=new Date(),m=String(d.getMonth()+1).padStart(2,'0'),n=String(d.getDate()).padStart(2,'0');return d.getFullYear()+'-'+m+'-'+n};document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('#new')){var i=document.querySelector('#form [name=date]');if(i)i.value=t()}},true)})();

// Administração: remove o painel "Contagens por dupla" (a lista de colaboradores continua).
(function(){
 if(typeof adminContent!=='function')return;
 var base=adminContent;
 adminContent=function(){
  var box=document.createElement('div');box.innerHTML=base();
  box.querySelectorAll(':scope > .panel').forEach(function(p){var h=p.querySelector('h2');if(h&&h.textContent.trim()==='Contagens por dupla')p.remove();});
  return box.innerHTML;
 };
 if(typeof render==='function'){var r=render;render=function(){r.apply(this,arguments);if(typeof page!=='undefined'&&page===6){var s=document.getElementById('subtitle');if(s)s.textContent='Colaboradores, perfis e filiais.';}};}
})();
