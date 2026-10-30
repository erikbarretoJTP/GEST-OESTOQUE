// Aba "Importação de dados" (somente Admin): saldo SAP, WMS e lista de itens, direto pelo site.
(function(){
const PAGE=8,UNITS=['300','200','400','123','2002'];
const NAMES={'300':'Bragança Paulista','200':'Porto Velho','400':'Embu Guaçu','123':'Rio Branco','2002':'Centro de Distribuição'};
const WMS_CFG={'300':{sheet:'Localização',start:6,addr:'G',sku:'H'},'2002':{sheet:'WMS CD',start:3,addr:'G',sku:'I'},'200':{sheet:'Localização',start:2,addr:'G',sku:'H'},'123':{sheet:'Localização',start:6,addr:'G',sku:'H'},'400':{sheet:'Localização',start:6,addr:'G',sku:'I'}};
const ADDR=/^[^\r\n]+\.[A-Za-zÀ-ÿ0-9_-]+\.[A-Za-zÀ-ÿ0-9_-]+\.[A-Za-zÀ-ÿ0-9_-]+$/;
const colIdx=l=>String(l||'').toUpperCase().split('').reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
const brMoney=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const brDT=iso=>{try{return new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});}catch{return '';}};
const st={mail:null,saldo:null,wms:null,cat:null,wmsUnit:'300',adj:null,adjUnit:'300',dfe:null,dfeUnit:'300',busy:false,msg:{}};
const code=v=>{if(typeof v==='number'&&Number.isFinite(v))return Number.isInteger(v)?String(v):String(v);const s=String(v??'').trim();return !s||s==='0'||s==='-'||s.startsWith('#')?null:s;};
const skuOf=v=>typeof v==='number'?String(Math.trunc(v)):String(v??'').trim();
function sheetRows(ws){const r=XLSX.utils.decode_range(ws['!ref']||'A1');r.s.r=0;r.s.c=0;ws['!ref']=XLSX.utils.encode_range(r);return XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null,blankrows:true});}
async function readBook(file){if(typeof XLSX==='undefined'){let code='?';try{const r=await fetch('xlsx-lib.js',{method:'HEAD',cache:'no-store'});code=r.status;}catch{}
    throw Error(code===404?'O arquivo xlsx-lib.js NÃO está no site (erro 404). Envie esse arquivo para o GitHub e espere o deploy.':'Leitor de Excel não carregou (código '+code+'). Atualize a página com Ctrl+Shift+R; se continuar, confira o arquivo xlsx-lib.js no GitHub.');}const buf=await file.arrayBuffer();
  try{return XLSX.read(buf,{type:'array',cellDates:true});}catch(e){if(!/\.xls$/i.test(file.name))throw e;await fullXlsx();return XLSX.read(buf,{type:'array',cellDates:true});}}
// .xls antigo (ex.: relatório DF-e) precisa da versão completa do leitor; só carrega quando aparece um
let fullXlsxP=null;
function fullXlsx(){return fullXlsxP=fullXlsxP||new Promise((ok,fail)=>{const s=document.createElement('script');s.src='vendor/xlsx.full.min.js';s.onload=ok;s.onerror=()=>{fullXlsxP=null;fail(Error('Não consegui carregar o leitor de .xls (vendor/xlsx.full.min.js). Atualize com Ctrl+Shift+R ou salve o arquivo como .xlsx.'));};document.head.appendChild(s);});}
function toISO(v){if(v instanceof Date&&!isNaN(v)){const d=new Date(v.getTime()+12*3600e3);return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');}
  if(typeof v==='number'){const d=new Date(Math.round((v-25569)*86400e3)+12*3600e3);return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');}
  const m=String(v||'').match(/(\d{2})\/(\d{2})\/(\d{4})/);return m?m[3]+'-'+m[2]+'-'+m[1]:'';}
const br=iso=>{const m=iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?m[3]+'/'+m[2]+'/'+m[1]:iso;};
const cur=()=>window.JTP_DATA?.status?.sets||[];
const currentCount=(kind,u)=>{const s=cur().find(x=>x.kind===kind&&x.branch===u);if(s)return kind==='stock'?s.meta?.records:s.meta?.rows;return kind==='stock'?items.filter(i=>i.unit===u).length:window.JTP_SOURCE.locations.filter(l=>l.unit===u).length;};

// ---------- leitura: saldo ----------
const SALDO_COLS={sku:'Código do item',unit:'Código do depósito',qty:'Saldo em estoque',name:'Descrição do item',group:'Nome do grupo',measure:'Unidade',price:'Preço médio',total:'Valor em estoque',date:'Data'};
function dayFromName(n){const m=String(n).match(/(\d{2})[._-](\d{2})(?:[._-](\d{2,4}))?/);if(!m)return '';let y=m[3]?Number(m[3]):new Date().getFullYear();if(y<100)y+=2000;return y+'-'+m[2]+'-'+m[1];}
async function parseSaldoFile(file){
  const wb=await readBook(file),rows=sheetRows(wb.Sheets[wb.SheetNames[0]]);
  const h=(rows[0]||[]).map(x=>String(x??'').trim());let col,format;
  if(h.includes('Código do depósito')){col={};for(const k of Object.keys(SALDO_COLS))col[k]=h.indexOf(SALDO_COLS[k]);for(const k of ['sku','unit','qty','price','total'])if(col[k]<0)throw Error(file.name+': falta a coluna "'+SALDO_COLS[k]+'".');format='Relatório de estoque';}
  else if(h[1]==='Código do item'&&h[4]==='Saldo em estoque'){col={sku:1,group:2,unit:3,qty:4,measure:5,price:6,total:7,date:8,name:-1};format='Saldo JTP';}
  else throw Error(file.name+': cabeçalho não reconhecido. Use o relatório de estoque do SAP (com "Código do item", "Código do depósito" e "Saldo em estoque") ou o "Saldo JTP".');
  const byUnit={},excluded={},keys=new Set(),dates=new Set(),errors=[],names={};
  const fallback=dayFromName(file.name);
  rows.slice(1).forEach((r,i)=>{
    const rn=i+2;if(!r||r.every(v=>v==null||v===''))return;
    const sku=skuOf(r[col.sku]),unit=skuOf(r[col.unit]),iso=(col.date>=0?toISO(r[col.date]):'')||fallback;
    if(!sku||!unit||!iso){errors.push(file.name+' linha '+rn+': código, depósito ou data ausente');return;}
    for(const c of [col.qty,col.price,col.total])if(typeof r[c]!=='number'||!Number.isFinite(r[c])){errors.push(file.name+' linha '+rn+': número inválido');return;}
    dates.add(iso);const key=unit+'|'+sku;if(keys.has(key)){errors.push(file.name+' linha '+rn+': código duplicado '+sku+' no depósito '+unit);return;}keys.add(key);
    if(!UNITS.includes(unit)){const e=excluded[unit]=excluded[unit]||{n:0,v:0};e.n++;e.v+=r[col.total];return;}
    (byUnit[unit]=byUnit[unit]||[]).push([sku,String(col.group>=0?r[col.group]??'':''),r[col.qty],String(col.measure>=0?r[col.measure]??'':''),r[col.price],r[col.total]]);
    if(col.name>=0&&r[col.name])names[sku]=String(r[col.name]).trim();
  });
  if(dates.size!==1)errors.push(file.name+': tem '+dates.size+' datas diferentes; deve ter uma só.');
  if(errors.length>12)errors.splice(12,errors.length,'… e mais erros');
  const day=[...dates][0]||fallback||'';
  const units=UNITS.filter(u=>byUnit[u]).map(u=>{const rr=byUnit[u],value=rr.reduce((s,r)=>s+r[5],0);const groups={};rr.forEach(r=>{groups[r[1]]=(groups[r[1]]||0)+r[5];});return{unit:u,rows:rr,records:rr.length,value,history:Object.keys(groups).sort().map(g=>({group:g,value:groups[g]}))};});
  if(!units.length)errors.push(file.name+': nenhuma linha das garagens do site (300, 200, 400, 123, 2002).');
  return{file:file.name,format,day,units,excluded,errors,names};
}
async function parseSaldos(fileList){
  const files=[];for(const f of fileList)files.push(await parseSaldoFile(f));
  files.sort((a,b)=>a.day<b.day?-1:a.day>b.day?1:0);
  const errors=files.flatMap(f=>f.errors);
  const seen={};files.forEach(f=>{if(seen[f.day])errors.push('Dois arquivos com a mesma data ('+br(f.day)+'): '+seen[f.day]+' e '+f.file);seen[f.day]=f.file;});
  const latest=files[files.length-1];
  // saldo atual de cada garagem = arquivo com a data mais recente; arquivo mais antigo que o atual vai só para o histórico
  if(latest){latest.units.forEach(u=>{const m=String(sourceMeta.units[u.unit]?.stockDate||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/),curIso=m?m[3]+'-'+m[2]+'-'+m[1]:'';u.curBr=m?m[0]:'';u.older=!!curIso&&latest.day<curIso;u.sameDay=!!curIso&&latest.day===curIso;const now=currentCount('stock',u.unit);u.now=now;u.drop=!u.older&&now>0&&u.records<now*.75;});latest.sameDay=latest.units.some(u=>u.sameDay);latest.older=latest.units.length>0&&latest.units.every(u=>u.older);}
  return{files,latest,errors};
}
// ---------- leitura: WMS ----------
async function parseWms(file,unit,opt){
  const wb=await readBook(file),cfg=Object.assign({},WMS_CFG[unit]||{sheet:'Localização',start:2,addr:'G',sku:'H'},opt||{});
  const name=wb.SheetNames.find(n=>n===cfg.sheet)||wb.SheetNames.find(n=>n.trim().toLowerCase()===String(cfg.sheet).toLowerCase())||(wb.SheetNames.length===1?wb.SheetNames[0]:null);
  if(!name)throw Error('Aba "'+cfg.sheet+'" não encontrada. Abas do arquivo: '+wb.SheetNames.join(', ')+'. Ajuste o nome da aba em "Ajustes".');
  const ws=wb.Sheets[name],rows=sheetRows(ws),ac=colIdx(cfg.addr),sc=colIdx(cfg.sku),out=[],errors=[];let date='';const seen={},mapping={};
  // Célula com erro do Excel (#REF!, #N/D...) vem vazia do SheetJS; acusa em vez de descartar a linha.
  const cellError=(i,c)=>{const x=ws[XLSX.utils.encode_cell({r:i,c})];return x&&x.t==='e'?(x.w||'#ERRO'):'';};
  rows.forEach((r,i)=>{const rn=i+1;
    if(rn<cfg.start){(r||[]).forEach(v=>{if(typeof v==='string'){const m=v.match(/(\d{2}\/\d{2}\/\d{4})\s*(?:[-–]\s*)?(\d{2}:\d{2})?/);if(m)date=m[1]+(m[2]?' '+m[2]:'');}});return;}
    const addrErr=cellError(i,ac),skuErr=cellError(i,sc);
    if(addrErr&&r&&code(r[sc])){errors.push('Linha '+rn+': endereço com erro '+addrErr+' na coluna '+cfg.addr+' · código '+code(r[sc]));return;}
    if(skuErr&&r&&ADDR.test(String(r[ac]??'').trim())){errors.push('Linha '+rn+': código com erro '+skuErr+' na coluna '+cfg.sku+' · endereço '+String(r[ac]).trim());return;}
    if(!r)return;const address=String(r[ac]??'').trim(),sku=code(r[sc]);if(!address)return;
    if(!ADDR.test(address)){if(sku||/\d.*\./.test(address))errors.push('Linha '+rn+': endereço inválido "'+address+'"');return;}
    out.push([address,sku]);seen[address]=(seen[address]||0)+1;if(sku)(mapping[sku]=mapping[sku]||new Set()).add(address);
  });
  if(errors.length>12)errors.splice(12,errors.length,'… e mais erros');
  if(!out.length)errors.push('Nenhum endereço válido encontrado. Confira a aba, a linha inicial e a coluna do endereço.');
  const positions=Object.keys(seen),occupied=new Set(out.filter(r=>r[1]).map(r=>r[0]));
  const codes=Object.keys(mapping),now=currentCount('wms',unit),oldCodes=new Set(window.JTP_SOURCE.locations.filter(l=>l.unit===unit&&l.sku).map(l=>l.sku));
  if(oldCodes.size&&codes.length<oldCodes.size*.75)errors.push('Os códigos caíram de '+oldCodes.size+' para '+codes.length+'. Confira se é o arquivo certo.');
  return{file:file.name,unit,sheet:name,date,rows:out,positions:positions.length,occupied:occupied.size,vacant:positions.length-occupied.size,codes:codes.length,multi:codes.filter(c=>mapping[c].size>1).length,repeated:positions.filter(a=>seen[a]>1).length,now,errors};
}
// ---------- leitura: DF-e (notas emitidas para a garagem) ----------
const DFE_UNIT=[[/BRAGAN/,'300'],[/PORTO VELHO/,'200'],[/EMBU/,'400'],[/RIO BRANCO/,'123']];
const DFE_OK='Manifesto Vinculado (Confirmação da Operação)',DFE_CANCEL='Cancelado (Sefaz)';
const pad2=n=>String(n).padStart(2,'0');
function toDT(v){if(v instanceof Date&&!isNaN(v)){const d=new Date(Math.round(v.getTime()/1000)*1000);return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())+'T'+pad2(d.getHours())+':'+pad2(d.getMinutes())+':'+pad2(d.getSeconds());}
  if(typeof v==='number'){const d=new Date(Math.round((v-25569)*86400)*1000);return d.toISOString().slice(0,19);}
  const m=String(v||'').match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);return m?m[3]+'-'+m[2]+'-'+m[1]+'T'+(m[4]||'00')+':'+(m[5]||'00')+':'+(m[6]||'00'):'';}
async function parseDfe(file,unit){
  const wb=await readBook(file),rows=sheetRows(wb.Sheets[wb.SheetNames[0]]),h=(rows[0]||[]).map(x=>String(x??'').trim()),ix=n=>h.indexOf(n);
  const c={key:ix('Chave do Documento'),emp:ix('Empresa'),model:ix('Modelo'),created:ix('Data de Criação'),sit:ix('Situação do Documento'),number:ix('Nº da Nota (Serial)'),partner:ix('Nome do Parceiro'),total:ix('Total do Documento')};
  const errors=[],docs=[],emps={},seen=new Set();
  ['key','created','sit'].forEach(k=>{if(c[k]<0)errors.push('Coluna não encontrada: '+{key:'Chave do Documento',created:'Data de Criação',sit:'Situação do Documento'}[k]);});
  if(!errors.length)rows.slice(1).forEach((r,i)=>{if(!r)return;const key=String(r[c.key]??'').trim();if(!key||seen.has(key))return;seen.add(key);
    const created=toDT(r[c.created]);if(!created){errors.push('Linha '+(i+2)+': data de criação inválida');return;}
    const e=c.emp>=0?String(r[c.emp]??'').trim():'';if(e)emps[e]=(emps[e]||0)+1;
    const t=r[c.total],total=typeof t==='number'?t:(String(t??'').trim()?Number(String(t).replace(/,/g,'')):null);
    docs.push({key,created,situation:String(r[c.sit]??'').trim(),model:c.model>=0?String(r[c.model]??'').trim():'',number:c.number>=0?String(r[c.number]??'').trim():'',partner:c.partner>=0?String(r[c.partner]??'').trim():'',total:Number.isFinite(total)?total:null});});
  // garagem pela coluna "Empresa"; arquivo com mais de uma empresa é recusado
  const found=[...new Set(Object.keys(emps).map(e=>(DFE_UNIT.find(([re])=>re.test(e.toUpperCase()))||[])[1]||'?'))];
  if(found.length>1)errors.push('O arquivo tem notas de mais de uma empresa: '+Object.keys(emps).join(' · ')+'. Exporte uma garagem por vez.');
  const detected=found.length===1&&found[0]!=='?'?found[0]:'';if(detected)unit=detected;
  if(!errors.length&&!docs.length)errors.push('Nenhuma nota encontrada no arquivo.');
  const months={};docs.forEach(d=>{const k=d.created.slice(0,7),m=months[k]=months[k]||{total:0,done:0,cancelled:0};if(d.situation===DFE_CANCEL)m.cancelled++;else{m.total++;if(d.situation===DFE_OK)m.done++;}});
  const sits={};docs.forEach(d=>{sits[d.situation]=(sits[d.situation]||0)+1;});
  const days=docs.map(d=>d.created.slice(0,10)).sort();
  return{file:file.name,unit,detected,company:Object.keys(emps)[0]||'',docs,months,sits,from:days[0]||'',to:days.at(-1)||'',errors:errors.slice(0,12)};
}
// ---------- leitura: lista de itens ----------
async function parseCat(file){
  const wb=await readBook(file),rows=sheetRows(wb.Sheets[wb.SheetNames[0]]),h=rows[0]||[];
  if(String(h[1]||'').trim()!=='Nº do item'||String(h[2]||'').trim()!=='Descrição do item')throw Error('Cabeçalho não reconhecido. A coluna B deve ser "Nº do item" e a C "Descrição do item".');
  const all={},errors=[];let blank=0;
  rows.slice(1).forEach((r,i)=>{if(!r||r[1]==null)return;const sku=skuOf(r[1]),name=String(r[2]??'').trim();if(!name){blank++;return;}if(all[sku]&&all[sku]!==name)errors.push('Descrições conflitantes para '+sku);all[sku]=name;});
  if(!Object.keys(all).length)errors.push('Lista vazia.');
  const stat=window.JTP_STATIC_DESC||{},diff={};let changed=0,added=0;
  Object.keys(all).forEach(k=>{if(!(k in stat)){diff[k]=all[k];added++;}else if(stat[k]!==all[k]){diff[k]=all[k];changed++;}});
  return{file:file.name,total:Object.keys(all).length,added,changed,blank,diff,errors:errors.slice(0,12)};
}
// ---------- publicar ----------
async function put(kind,branch,payload,meta){return JTP_RPC('jtp_data_put',{p_kind:kind,p_branch:branch,p_payload:payload,p_meta:meta});}
async function publishSaldo(){
  const r=st.saldo;if(!r||r.errors.length)return;
  const by=selectedUser()?.name||'',L=r.latest;
  // dias anteriores: só histórico de valor
  for(const f of r.files){if(f===L)continue;for(const u of f.units)await JTP_RPC('jtp_stock_history_put',{p_branch:u.unit,p_day:f.day,p_source:f.file,p_vals:u.history});}
  // descrições novas que vierem no arquivo entram na lista de itens (nunca sobrescrevem as existentes)
  const stat=window.JTP_STATIC_DESC||{},curD=window.JTP_ITEM_DESCRIPTIONS||{},diff={};
  Object.keys(curD).forEach(k=>{if(stat[k]!==curD[k])diff[k]=curD[k];});
  let added=0;Object.keys(L.names||{}).forEach(k=>{if(!(k in curD)){diff[k]=L.names[k];added++;}});
  if(added)await put('catalog','*',diff,{file:L.file,added,by,total:Object.keys(diff).length});
  for(const u of L.units.filter(u=>u.older))await JTP_RPC('jtp_stock_history_put',{p_branch:u.unit,p_day:L.day,p_source:L.file,p_vals:u.history});
  for(const u of L.units.filter(u=>!u.older))await put('stock',u.unit,{date:br(L.day),rows:u.rows},{file:L.file,day:L.day,date:br(L.day),records:u.records,value:u.value,by,history:u.history});
}
async function publishDfe(){const r=st.dfe;if(!r||r.errors.length)return;
  for(let i=0;i<r.docs.length;i+=1000)await JTP_RPC('jtp_dfe_put',{p:{branch:r.unit,source:r.file,docs:r.docs.slice(i,i+1000)}});}
async function publishWms(){const r=st.wms;if(!r||r.errors.length)return;await put('wms',r.unit,{date:r.date,sheet:r.sheet,rows:r.rows},{file:r.file,date:r.date,rows:r.rows.length,positions:r.positions,codes:r.codes,by:selectedUser()?.name||''});}
async function publishCat(){const r=st.cat;if(!r||r.errors.length)return;await put('catalog','*',r.diff,{file:r.file,total:r.total,added:r.added,changed:r.changed,by:selectedUser()?.name||''});}


// ---------- ajuste de inventário (SAP) -> acuracidade ----------
async function parseAdj(file,unit,opt){
  const wb=await readBook(file),rows=sheetRows(wb.Sheets[wb.SheetNames[0]]),h=(rows[0]||[]).map(x=>String(x||'').trim().toLowerCase()),errors=[];
  const ix=(...ns)=>{for(const n of ns){const i=h.findIndex(x=>x.startsWith(n));if(i>=0)return i;}return -1;};
  const c={sku:ix('nº do item','n° do item','no do item','código'),desc:ix('descrição'),stock:ix('quantidade em estoque'),dev:ix('desvio'),price:ix('preço'),tot:ix('total'),dep:ix('depósito'),cnt:ix('quantidade contada')};
  ['sku','stock','dev','price','tot'].forEach(k=>{if(c[k]<0)errors.push('Coluna não encontrada: '+{sku:'Nº do item',stock:'Quantidade em estoque na data da contagem',dev:'Desvio',price:'Preço',tot:'Total'}[k]);});
  let items=0,div=0,neg=0,pos=0,stock=0;const deps={},top=[],seen=new Set();
  if(!errors.length)for(const r of rows.slice(1)){const sku=skuOf(r[c.sku]);if(!sku)continue;
    if(seen.has(sku)){errors.push('Item repetido no arquivo: '+sku);if(errors.length>12)break;continue;}seen.add(sku);
    const q=Number(r[c.stock])||0,p=Number(r[c.price])||0,dv=Number(r[c.dev])||0,t=Number(r[c.tot])||dv*p;
    items++;stock+=q*p;if(c.dep>=0){const k=String(r[c.dep]);deps[k]=(deps[k]||0)+1;}
    if(Math.abs(dv)>1e-9){div++;if(t<0)neg+=t;else pos+=t;top.push([sku,String(r[c.desc]||'').slice(0,60),Math.round(dv*1e4)/1e4,Math.round(t*100)/100]);}}
  top.sort((a,b)=>Math.abs(b[3])-Math.abs(a[3]));
  const r2=n=>Math.round(n*100)/100;
  return{file:file.name,unit,items,div,neg:r2(neg),pos:r2(pos),stock:r2(stock),deps,top:top.slice(0,30),errors:errors.slice(0,12)};
}
async function publishAdj(){const r=st.adj;if(!r||r.errors.length)return;const g=id=>$(id)?.value||'';
  await JTP_RPC('jtp_adjust_put',{p:{branch:r.unit,day:g('imp-adj-day'),event:g('imp-adj-event'),negative:r.neg,positive:r.pos,without_wms:g('imp-adj-nowms')===''?null:Number(g('imp-adj-nowms').replace(',','.')),stock_value:r.stock,items:r.items,divergent:r.div,source:r.file,top:r.top}});}
function adjPreview(){const r=st.adj;if(!r)return '';const net=r.neg+r.pos,acc=r.stock?100-Math.abs(net)/r.stock*100:null,gross=r.stock?100-(Math.abs(r.neg)+r.pos)/r.stock*100:null,p=v=>v==null?'—':v.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
  return `<div class="imp-sum"><b>${esc(r.file)}</b> · ${num(r.items)} itens · ${num(r.div)} com desvio${Object.keys(r.deps).length?' · depósitos '+esc(Object.keys(r.deps).join(', ')):''}</div>`
   +table(['AJUSTE NEGATIVO','AJUSTE POSITIVO','DESVIO LÍQUIDO','ESTOQUE NA DATA','ACURACIDADE'],[`<tr><td>${brMoney(r.neg)}</td><td>${brMoney(r.pos)}</td><td>${brMoney(net)}</td><td>${brMoney(r.stock)}</td><td><b>${p(acc)}</b></td></tr>`])
   +`<p class="source-note">Acuracidade = 100% − |desvio líquido| ÷ estoque na data.</p>`
   +errs(r.errors)+`<div class="actions"><button class="primary" id="imp-adj-go" ${r.errors.length?'disabled':''}>Publicar acuracidade de ${esc(NAMES[r.unit])}</button></div>`;}
function adjList(){const l=(window.JTP_ADJ||[]).filter(a=>a.id);if(!l.length)return '<p class="source-note">Nenhum ajuste publicado ainda.</p>';
  return table(['GARAGEM','DATA','EVENTO','NEGATIVO','POSITIVO','ESTOQUE','',''],l.slice().reverse().map(a=>`<tr><td>${esc(a.unit)} · ${esc(NAMES[a.unit]||'')}</td><td>${esc(br(String(a.date).slice(0,10)))}</td><td>${esc(a.event)}<small>${esc(a.source||'')}</small></td><td>${brMoney(a.negative)}</td><td>${brMoney(a.positive)}</td><td>${brMoney(a.stockValue)}</td><td></td><td><button class="secondary" data-adj-del="${a.id}">Excluir</button></td></tr>`));}

// ---------- e-mail dos itens sem WMS ----------
function noWmsReport(u){
  const ii=items.filter(i=>i.unit===u),no=ii.filter(i=>!(i.addresses&&i.addresses.length)).sort((a,b)=>Number(b.totalValue)-Number(a.totalValue));
  const m=(sourceMeta.units[u]||{}),d=String(m.stockDate||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const day=d?d[3]+'-'+d[2]+'-'+d[1]:new Date().toISOString().slice(0,10);
  const value=no.reduce((s,i)=>s+Number(i.totalValue||0),0);
  return{day,rows:no.map(i=>[i.sku,i.name,i.group,i.measure,i.qty,i.price,i.totalValue]),summary:{count:no.length,value,total:ii.length,pct:ii.length?no.length/ii.length*100:0}};
}
async function sendNoWms(units){
  const out=[];
  for(const u of units){const r=noWmsReport(u);await JTP_RPC('jtp_nowms_save',{p_branch:u,p_day:r.day,p_rows:r.rows,p_summary:r.summary});}
  const cfg=window.JTP_SUPABASE||{};
  const res=await fetch(cfg.url+'/functions/v1/nowms-mail',{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.publishableKey||''},body:JSON.stringify({token:window.JTP_TOKEN?.()||'',branches:units,siteUrl:location.origin})});
  let data={};try{data=await res.json();}catch{}
  if(!res.ok)throw Error(data.error||('Função de e-mail indisponível ('+res.status+'). Confira se ela foi publicada no Supabase.'));
  for(const r of data.results||[])out.push(NAMES[r.branch]+': '+(r.error?'falhou ('+r.error+')':r.skipped?r.skipped:'enviado a '+(r.to||[]).length+' e-mail(s), '+r.items+' itens'));
  return out;
}
async function loadMail(){try{st.mail=await JTP_RPC('jtp_mail_config_get');}catch(e){st.mail=[];st.mailErr=e.message;}paint();}
function mailPanel(){
  if(!st.mail)return panel('E-mail dos itens sem WMS','Enviado automaticamente depois de cada importação de saldo','<p class="source-note">Carregando…</p>');
  const rows=st.mail.map(c=>`<tr><td>${esc(c.branch)} · ${esc(c.name)}</td><td><input class="mail-emails" data-b="${esc(c.branch)}" placeholder="email1@jtp.com.br, email2@jtp.com.br" value="${esc((c.emails||[]).join(', '))}"></td><td><label class="imp-check"><input type="checkbox" class="mail-on" data-b="${esc(c.branch)}" ${c.enabled?'checked':''}> Ativo</label></td><td>${c.lastMail&&c.lastMail.at?esc(brDT(c.lastMail.at))+'<small>'+esc(c.lastMail.result||'')+'</small>':'<small>Nunca enviado</small>'}</td><td><button class="secondary mail-save" data-b="${esc(c.branch)}">Salvar</button> <button class="secondary mail-now" data-b="${esc(c.branch)}">Enviar agora</button></td></tr>`);
  return panel('E-mail dos itens sem WMS','Enviado automaticamente depois de cada importação de saldo · resumo no e-mail e planilha Excel anexa',
    `<p class="source-note">Cadastre os e-mails de cada garagem (líder e quem mais precisar), separados por vírgula. Sem e-mail cadastrado, nada é enviado.</p>${table(['GARAGEM','E-MAILS','ENVIO','ÚLTIMO ENVIO',''],rows)}${msg('mail')}`);
}

// ---------- tela ----------
const panel=(title,sub,body)=>`<div class="panel imp-panel"><div class="panel-heading"><h2>${title}</h2><small>${sub||''}</small></div><div class="imp-body">${body}</div></div>`;
const errs=l=>l&&l.length?`<div class="imp-errors" role="alert"><b>Corrija antes de publicar:</b><ul>${l.map(e=>'<li>'+esc(e)+'</li>').join('')}</ul></div>`:'';
function statusTable(){
  const sets=cur();
  const rows=UNITS.map(u=>{const s=sets.find(x=>x.kind==='stock'&&x.branch===u),w=sets.find(x=>x.kind==='wms'&&x.branch===u),m=sourceMeta.units[u]||{};
    const stock=`${esc(m.stockDate||'—')}<small>${esc(m.stockFile||'')} · ${num(items.filter(i=>i.unit===u).length)} itens${s?' · '+esc(brDT(s.at))+' · '+esc(s.by||''):' · base embutida'}</small>`;
    const wms=m.wmsLoaded?`${esc(m.wmsDate||'—')}<small>${esc(m.wmsFile||'')} · ${num(m.positions||0)} posições${w?' · '+esc(brDT(w.at))+' · '+esc(w.by||''):' · base embutida'}</small>`:'<small>Sem mapa WMS</small>';
    return `<tr><td>${esc(u)} · ${esc(NAMES[u])}</td><td>${stock}</td><td>${wms}</td></tr>`;});
  return table(['GARAGEM','SALDO SAP','MAPA WMS'],rows);
}
function saldoPreview(){const r=st.saldo;if(!r)return '';
  const L=r.latest,ex=Object.keys(L?.excluded||{});
  const head=['DATA','ARQUIVO',...UNITS.map(u=>u),'USO'];
  const rows=r.files.map(f=>`<tr><td><b>${esc(br(f.day))}</b></td><td>${esc(f.file)}<small>${esc(f.format)}</small></td>${UNITS.map(u=>{const x=f.units.find(y=>y.unit===u);return x?`<td>${num(x.records)}<small>${brMoney(x.value)}${x.drop?' · <span class="imp-warn">queda &gt;25%</span>':''}</small></td>`:'<td>—</td>';}).join('')}<td>${f===L&&!L.older?'<b>Saldo atual</b>':'Histórico'}</td></tr>`);
  return table(head,rows)
   +(ex.length?`<p class="source-note">Depósitos fora do site (ignorados): ${ex.map(k=>esc(k)+' ('+L.excluded[k].n+' itens)').join(', ')}.</p>`:'')
   +(L&&L.sameDay?`<p class="source-note">Já existe saldo de ${esc(br(L.day))}: este arquivo vai <b>substituir</b> o saldo desse dia.</p>`:'')
   +(L&&L.units.some(u=>u.older)?`<p class="source-note">Mais antigo que o saldo atual, entra só no histórico: ${L.units.filter(u=>u.older).map(u=>esc(u.unit)+' (atual '+esc(u.curBr)+')').join(', ')}.</p>`:'')
   +(L&&Object.keys(L.names||{}).length?`<p class="source-note">O arquivo traz descrições: itens novos entram na lista de itens automaticamente.</p>`:'')
   +errs(r.errors)
   +(L&&L.units.some(u=>u.drop)?'<label class="imp-check"><input type="checkbox" id="imp-force"> Confirmo que a queda de itens é esperada</label>':'')
   +`<div class="actions"><button class="primary" id="imp-saldo-go" ${r.errors.length?'disabled':''}>${L.older?'Publicar no histórico':r.files.length>1?'Publicar: '+esc(br(L.day))+' como saldo atual + '+(r.files.length-1)+' dia(s) no histórico':'Publicar saldo'}</button></div>`;}
function dfePreview(){const r=st.dfe;if(!r)return '';const p=v=>v==null?'—':v.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
  const months=Object.keys(r.months).sort().map(k=>{const m=r.months[k];return `<tr><td><b>${esc(k.slice(5,7)+'/'+k.slice(0,4))}</b></td><td>${num(m.total)}</td><td>${num(m.done)}</td><td>${num(m.total-m.done)}</td><td>${num(m.cancelled)}</td><td><b>${p(m.total?m.done/m.total*100:null)}</b></td></tr>`;});
  return `<div class="imp-sum"><b>${esc(r.file)}</b> · ${esc(r.unit)} · ${esc(NAMES[r.unit]||'')}${r.company?' · '+esc(r.company):''} · criação de ${esc(br(r.from))} a ${esc(br(r.to))}</div>`
   +table(['MÊS','EMITIDAS','COM ENTRADA','PENDENTES','CANCELADAS','INDICADOR'],months)
   +`<p class="source-note">${Object.keys(r.sits).map(k=>esc(k)+': '+num(r.sits[k])).join(' · ')}</p>`
   +(r.detected?'':`<p class="source-note">Garagem não reconhecida pela coluna "Empresa": confira a garagem escolhida acima.</p>`)
   +`<p class="source-note">Notas já importadas antes são atualizadas pela chave (ex.: pendente que recebeu entrada).</p>`
   +errs(r.errors)+`<div class="actions"><button class="primary" id="imp-dfe-go" ${r.errors.length?'disabled':''}>Publicar ${num(r.docs.length)} notas de ${esc(NAMES[r.unit]||r.unit)}</button></div>`;}
function wmsPreview(){const r=st.wms;if(!r)return '';
  return `<div class="imp-sum"><b>${esc(r.file)}</b> · aba ${esc(r.sheet)}${r.date?' · data '+esc(r.date):''}</div>`+table(['POSIÇÕES','OCUPADAS','VAGAS','CÓDIGOS','COM MAIS DE 1 ENDEREÇO','LINHAS ATUAIS'],[`<tr><td>${num(r.positions)}</td><td>${num(r.occupied)}</td><td>${num(r.vacant)}</td><td>${num(r.codes)}</td><td>${num(r.multi)}</td><td>${num(r.now||0)}</td></tr>`])+errs(r.errors)+`<div class="actions"><button class="primary" id="imp-wms-go" ${r.errors.length?'disabled':''}>Publicar WMS de ${esc(NAMES[r.unit])}</button></div>`;}
function catPreview(){const r=st.cat;if(!r)return '';
  return `<div class="imp-sum"><b>${esc(r.file)}</b> · ${num(r.total)} itens</div>`+table(['NOVOS','DESCRIÇÃO ALTERADA','SEM DESCRIÇÃO (IGNORADOS)'],[`<tr><td>${num(r.added)}</td><td>${num(r.changed)}</td><td>${num(r.blank)}</td></tr>`])+errs(r.errors)+`<div class="actions"><button class="primary" id="imp-cat-go" ${r.errors.length?'disabled':''}>Publicar lista de itens</button></div>`;}
const msg=k=>st.msg[k]?`<p class="imp-msg ${st.msg[k].err?'err':'ok'}" role="status">${esc(st.msg[k].t)}</p>`:'';
function logTable(){const l=window.JTP_DATA?.status?.log||[];if(!l.length)return '<p class="source-note">Nenhuma importação feita pelo site ainda.</p>';
  const lab={stock:'Saldo SAP',wms:'WMS',catalog:'Lista de itens',dfe:'Entradas (DF-e)',moves:'Movimento do dia'};
  return table(['QUANDO','TIPO','GARAGEM','ARQUIVO','QUEM'],l.map(x=>`<tr><td>${esc(brDT(x.at))}</td><td>${lab[x.kind]||esc(x.kind)}</td><td>${x.branch==='*'?'Todas':esc(x.branch+' · '+(NAMES[x.branch]||''))}</td><td>${esc(x.meta?.file||'')}</td><td>${esc(x.by||'')}</td></tr>`));}
function html(){
  const w=WMS_CFG[st.wmsUnit]||{};
  return panel('Dados em uso','O que o site está usando agora, por garagem',statusTable())
  +panel('1 · Saldo em estoque (SAP)','Relatório "Saldo JTP" em Excel · atualiza todas as garagens do arquivo',
    `<input type="file" id="imp-saldo-file" accept=".xlsx,.xlsm" multiple><p class="source-note">Pode escolher vários dias de uma vez: o mais recente vira o saldo atual e os outros entram no histórico de valor.</p>${msg('saldo')}<div id="imp-saldo-prev">${saldoPreview()}</div>`)
  +panel('2 · Mapa WMS','Uma garagem por vez · planilha oficial do WMS',
    `<div class="imp-row"><label>GARAGEM<select id="imp-wms-unit">${UNITS.map(u=>`<option value="${u}" ${u===st.wmsUnit?'selected':''}>${u} · ${esc(NAMES[u])}</option>`).join('')}</select></label><label>ARQUIVO<input type="file" id="imp-wms-file" accept=".xlsx,.xlsm"></label></div>
     <details class="imp-adv"><summary>Ajustes do layout (só se a planilha mudou)</summary><div class="imp-row"><label>ABA<input id="imp-sheet" value="${esc(w.sheet||'')}"></label><label>LINHA INICIAL<input id="imp-start" type="number" min="1" value="${w.start||2}"></label><label>COLUNA DO ENDEREÇO<input id="imp-addr" maxlength="2" value="${esc(w.addr||'G')}"></label><label>COLUNA DO CÓDIGO<input id="imp-sku" maxlength="2" value="${esc(w.sku||'H')}"></label></div></details>
     ${msg('wms')}<div id="imp-wms-prev">${wmsPreview()}</div>`)
  +panel('3 · Lista de itens (descrições)','Relatório com "Nº do item" e "Descrição do item" · só entram itens novos ou alterados',
    `<input type="file" id="imp-cat-file" accept=".xlsx,.xlsm">${msg('cat')}<div id="imp-cat-prev">${catPreview()}</div>`)
  +panel('4 · Ajuste do inventário (SAP)','Planilha de lançamento do ajuste · calcula a acuracidade do inventário oficial',
    `<div class="imp-row"><label>GARAGEM<select id="imp-adj-unit">${UNITS.map(u=>`<option value="${u}" ${u===st.adjUnit?'selected':''}>${u} · ${esc(NAMES[u])}</option>`).join('')}</select></label><label>DATA DO INVENTÁRIO<input type="date" id="imp-adj-day"></label><label>NOME DO EVENTO<input id="imp-adj-event" value="Inventário oficial"></label><label>ITENS SEM WMS (R$, opcional)<input id="imp-adj-nowms" inputmode="decimal" placeholder="só informativo"></label></div>
     <input type="file" id="imp-adj-file" accept=".xlsx,.xlsm">${msg('adj')}<div id="imp-adj-prev">${adjPreview()}</div><h3 class="imp-h3">Ajustes publicados</h3>${adjList()}`)
  +panel('5 · Entradas (DF-e)','Relatório DF-e de uma garagem · notas emitidas x notas com entrada (indicador do dashboard)',
    `<div class="imp-row"><label>GARAGEM<select id="imp-dfe-unit">${UNITS.map(u=>`<option value="${u}" ${u===st.dfeUnit?'selected':''}>${u} · ${esc(NAMES[u])}</option>`).join('')}</select></label><label>ARQUIVO<input type="file" id="imp-dfe-file" accept=".xls,.xlsx"></label></div>
     <p class="source-note">A garagem é reconhecida pela coluna "Empresa". Canceladas não contam; "Documento Encontrado na Sefaz" e "Operação não Realizada" ficam como pendentes. Mês pela data de criação.</p>${msg('dfe')}<div id="imp-dfe-prev">${dfePreview()}</div>`)
  +panel('Histórico de importações','Últimas 25',logTable());
}
function wmsOpts(){const g=id=>$(id)?.value;return{sheet:g('imp-sheet'),start:Number(g('imp-start'))||1,addr:g('imp-addr'),sku:g('imp-sku')};}
function bind(){
  const run=async(key,fn,okText)=>{if(st.busy)return;st.busy=true;st.msg[key]={t:'Processando…',err:false};paint();try{await fn();if(!st.msg[key]||st.msg[key].t==='Processando…')st.msg[key]={t:okText||'Pronto.',err:false};}catch(e){st.msg[key]={t:e.message||'Falha.',err:true};}finally{st.busy=false;paint();}};
  $('imp-saldo-file').onchange=e=>{const fl=[...e.target.files];if(!fl.length)return;st.saldo=null;run('saldo',async()=>{st.saldo=await parseSaldos(fl);},'Arquivo(s) lido(s). Confira o resumo e publique.');};
  $('imp-wms-unit').onchange=e=>{st.wmsUnit=e.target.value;st.wms=null;st.wmsFile=null;st.skipRestore=true;paint();st.skipRestore=false;};
  $('imp-wms-file').onchange=e=>{const f=e.target.files[0];if(!f)return;st.wms=null;st.wmsFile=f;run('wms',async()=>{st.wms=await parseWms(f,st.wmsUnit,wmsOpts());},'Arquivo lido. Confira o resumo e publique.');};
  ['imp-sheet','imp-start','imp-addr','imp-sku'].forEach(id=>{$(id).onchange=()=>{if(st.wmsFile)run('wms',async()=>{st.wms=await parseWms(st.wmsFile,st.wmsUnit,wmsOpts());},'Arquivo lido de novo com os ajustes.');};});
  $('imp-cat-file').onchange=e=>{const f=e.target.files[0];if(!f)return;st.cat=null;run('cat',async()=>{st.cat=await parseCat(f);},'Arquivo lido. Confira o resumo e publique.');};
  $('imp-adj-unit').onchange=e=>{st.adjUnit=e.target.value;if(st.adjFile)run('adj',async()=>{st.adj=await parseAdj(st.adjFile,st.adjUnit);});};
  $('imp-adj-file').onchange=e=>{const f=e.target.files[0];if(!f)return;st.adj=null;st.adjFile=f;run('adj',async()=>{st.adj=await parseAdj(f,st.adjUnit);},'Arquivo lido. Informe a data e publique.');};
  if($('imp-adj-go'))$('imp-adj-go').onclick=()=>{if(!$('imp-adj-day').value){st.msg.adj={t:'Informe a data do inventário.',err:true};paint();return;}run('adj',async()=>{await publishAdj();st.adj=null;st.adjFile=null;await done();},'Acuracidade publicada. Já aparece no dashboard.');};
  document.querySelectorAll('[data-adj-del]').forEach(b=>b.onclick=()=>{if(confirm('Excluir este ajuste?'))run('adj',async()=>{await JTP_RPC('jtp_adjust_delete',{p_id:Number(b.dataset.adjDel)});await done();},'Ajuste excluído.');});
  $('imp-dfe-unit').onchange=e=>{st.dfeUnit=e.target.value;if(st.dfeFile)run('dfe',async()=>{st.dfe=await parseDfe(st.dfeFile,st.dfeUnit);st.dfeUnit=st.dfe.unit;});};
  $('imp-dfe-file').onchange=e=>{const f=e.target.files[0];if(!f)return;st.dfe=null;st.dfeFile=f;run('dfe',async()=>{st.dfe=await parseDfe(f,st.dfeUnit);st.dfeUnit=st.dfe.unit;},'Arquivo lido. Confira o resumo e publique.');};
  if($('imp-dfe-go'))$('imp-dfe-go').onclick=()=>run('dfe',async()=>{await publishDfe();st.dfe=null;st.dfeFile=null;await done();},'Notas publicadas. O indicador de entradas já aparece no dashboard.');
  const done=async()=>{await window.JTP_DATA.reload();};
  if($('imp-saldo-go'))$('imp-saldo-go').onclick=()=>{if(st.saldo.latest.units.some(u=>u.drop)&&!$('imp-force')?.checked){st.msg.saldo={t:'Marque a confirmação acima para continuar.',err:true};paint();return;}run('saldo',async()=>{const units=st.saldo.latest.units.map(u=>u.unit);await publishSaldo();st.saldo=null;await done();});};
  if($('imp-wms-go'))$('imp-wms-go').onclick=()=>run('wms',async()=>{await publishWms();st.wms=null;st.wmsFile=null;await done();},'WMS publicado. Todos os aparelhos recebem em até 1 minuto.');
  if($('imp-cat-go'))$('imp-cat-go').onclick=()=>run('cat',async()=>{await publishCat();st.cat=null;await done();},'Lista de itens publicada.');
}
function paint(){if(page!==PAGE)return;const keep={};['imp-saldo-file','imp-wms-file','imp-cat-file','imp-adj-file','imp-dfe-file'].forEach(id=>{keep[id]=$(id)?.files;});
  const y=window.scrollY,keyOf=e=>e.id||(e.className?e.className.split(' ')[0]+'|'+(e.dataset.b||''):''),snap={};
  document.querySelectorAll('#content input:not([type=file]),#content select').forEach(e=>{const k=keyOf(e);if(k)snap[k]=e.type==='checkbox'?e.checked:e.value;});
  $('content').innerHTML=html();
  document.querySelectorAll('#content input:not([type=file]),#content select').forEach(e=>{const k=keyOf(e);if(!k||!(k in snap))return;if(st.skipRestore&&/^imp-(sheet|start|addr|sku)$/.test(k))return;if(k==='imp-dfe-unit')return;if(e.type==='checkbox')e.checked=snap[k];else e.value=snap[k];});
  bind();window.scrollTo(0,y);}
function ensureNav(){const nav=$('nav');if(!nav)return;let b=nav.querySelector('[data-page="8"]');if(!b){b=document.createElement('button');b.dataset.page='8';b.innerHTML='<span class="nav-icon">⇪</span>Importação de dados';nav.appendChild(b);}
  let admin=false;try{admin=isAdmin();}catch{}b.hidden=!admin;b.classList.toggle('active',page===PAGE);}
const prev=render;
render=function(){
  if(page!==PAGE){prev.apply(this,arguments);ensureNav();return;}
  let admin=false;try{admin=isAdmin();}catch{}
  if(!admin){page=0;prev.apply(this,arguments);ensureNav();return;}
  page=6;prev.apply(this,arguments);page=PAGE;
  $('title').textContent='Importação de dados';const sub=$('subtitle');if(sub)sub.textContent='Saldo SAP, mapa WMS, lista de itens e entradas (DF-e). Valem para todos os aparelhos.';
  const f=document.querySelector('.filters');if(f)f.hidden=true;if($('new'))$('new').hidden=true;
  document.body.classList.remove('only-official');
  paint();ensureNav();document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',Number(b.dataset.page)===PAGE));
  if(window.JTP_DATA&&!window.JTP_DATA.status)window.JTP_DATA.reload&&window.JTP_DATA.reload();
};
try{render();}catch(e){}
})();
