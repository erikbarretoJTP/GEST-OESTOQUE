// Gráfico de evolução: ao passar o mouse num ponto mostra entradas (recebimento) e saídas por origem (SO, AS, EM) do período.
// Cada ponto soma o movimento desde o saldo anterior até o saldo do ponto. Respeita os filtros de estoque e grupo.
(function(){
const ORIG={SO:'SO · saída',AS:'AS · ajuste',EM:'EM · entrada manual'};
const brDay=d=>d.split('-').reverse().join('/');
const signed=v=>(v>0?'+':v<0?'−':'')+money(Math.abs(v));
function movesFor(from,to){
  const u=$('unit')?.value||'all',t={REC:0,SO:0,AS:0,EM:0},n={REC:0,SO:0,AS:0,EM:0};
  for(const m of window.JTP_MOVES||[]){if(m.day>to||(from&&m.day<=from))continue;if(u!=='all'&&m.unit!==u)continue;if(typeof matchesGroup==='function'&&!matchesGroup(m.group))continue;t[m.kind]+=m.value;n[m.kind]+=m.lines;}
  return{t,n};
}
function tipHtml(p,prev,from){
  const {t,n}=movesFor(from,p.date),out=t.SO+t.AS+t.EM,has=n.REC+n.SO+n.AS+n.EM>0;
  return `<b>${esc(brDay(p.date))}</b><span class="mv-stock">Estoque ${esc(money(p.value))}${prev?` <i>${esc(signed(p.value-prev.value))}</i>`:''}</span>`
   +(has?`<div class="mv-sec">Entradas</div><div class="mv-row"><span>Recebimento</span><b class="in">${esc(signed(t.REC))}</b></div>`
   +`<div class="mv-sec">Saídas</div>${Object.keys(ORIG).map(k=>`<div class="mv-row"><span>${ORIG[k]}</span><b class="${k==='AS'?'adj':t[k]<0?'out':'in'}">${esc(signed(t[k]))}</b></div>`).join('')}`
   +`<div class="mv-row mv-total"><span>Total saídas</span><b class="${out<0?'out':'in'}">${esc(signed(out))}</b></div>`
   +(from?`<small>Movimento de ${esc(brDay(from))} (exclusive) a ${esc(brDay(p.date))}</small>`:'')
   :'<small>Sem movimento importado para este período.</small>');
}
function attach(){
  const host=$('stock-trend-chart'),svg=host?.querySelector('svg');if(!svg||svg.dataset.mv)return;svg.dataset.mv='1';
  const points=stockTrendPoints(window.JTP_SOURCE.stockHistory||[],stockTrendPeriod,$('unit').value,selectedGroups),dots=[...svg.querySelectorAll('circle')];
  if(dots.length!==points.length)return;
  dots.forEach(c=>c.querySelector('title')?.remove());
  const box=host.querySelector('.trend-reference');box.style.position='relative';
  const tip=document.createElement('div');tip.className='mv-tip';tip.hidden=true;box.append(tip);
  const xs=dots.map(c=>Number(c.getAttribute('cx'))),vb=svg.viewBox.baseVal,NS='http://www.w3.org/2000/svg';
  points.forEach((p,i)=>{
    const left=i?(xs[i-1]+xs[i])/2:vb.x,right=i<xs.length-1?(xs[i]+xs[i+1])/2:vb.x+vb.width;
    const r=document.createElementNS(NS,'rect');r.setAttribute('x',left);r.setAttribute('y',vb.y);r.setAttribute('width',Math.max(1,right-left));r.setAttribute('height',vb.height);r.setAttribute('fill','transparent');r.style.cursor='pointer';
    const show=e=>{tip.innerHTML=tipHtml(p,points[i-1],i?points[i-1].date:'');tip.hidden=false;dots.forEach((d,j)=>d.setAttribute('r',j===i?'5':'3.4'));
      const b=box.getBoundingClientRect(),x=(e.clientX??(b.left+xs[i]/vb.width*b.width))-b.left,w=tip.offsetWidth;tip.style.left=Math.min(Math.max(4,x+14>b.width-w-4?x-w-14:x+14),b.width-w-4)+'px';tip.style.top='8px';};
    r.addEventListener('mouseenter',show);r.addEventListener('mousemove',show);r.addEventListener('click',show);
    r.addEventListener('mouseleave',()=>{tip.hidden=true;dots[i].setAttribute('r','3.4');});
    svg.append(r);});
}
const prev=render;
render=function(){prev.apply(this,arguments);if(page!==0)return;try{attach();}catch(e){}};
})();
