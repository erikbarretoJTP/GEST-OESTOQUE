/* O escopo vem do WMS completo, independentemente de saldo. */
function completeWmsInventory(unit){
 const source=window.JTP_SOURCE,stock=new Map(items.filter(i=>i.unit===unit).map(i=>[String(i.sku),i])),catalog=window.JTP_COUNT_UNITS||{},lines=new Map(),positions=[];
 for(const loc of (source?.locations||[]).filter(l=>l.unit===unit)){
  const address=String(loc.address||'').trim();if(!address)continue;
  const sku=loc.sku?String(loc.sku):null;positions.push({address,sku,name:loc.name||'',order:positions.length});
  if(!sku)continue;let line=lines.get(sku);if(!line){const ref=stock.get(sku),any=items.find(i=>String(i.sku)===sku&&i.measure),measure=ref?.measure||any?.measure||catalog[sku]||'UN';line={sku,name:ref?.name||loc.name||sku,addresses:[],group:ref?.group||loc.group||'',measure,balance:ref?.qty??0,cost:ref?.price??0,unitUnconfirmed:!ref?.measure&&!any?.measure&&!catalog[sku],noStockReference:!ref};lines.set(sku,line);}if(!line.addresses.includes(address))line.addresses.push(address);
 }
 const result=[...lines.values()];for(const line of result)line.street=officialLineStreet(line);
 if(!result.length)throw Error('Esta filial não tem itens com código no WMS.');
 for(const pos of positions){const line=lines.get(pos.sku);pos.unitUnconfirmed=!!line?.unitUnconfirmed;pos.noStockReference=!!line?.noStockReference;}result[0].wmsSnapshot=positions;return result;
}
function assignedWmsRows(inv,a,query=''){
 const snapshot=inv._wmsSnapshot;if(!snapshot?.length)return inv.lines.map((line,index)=>({line,index})).filter(x=>assignmentLines(inv,a).includes(x.line)&&`${x.line.sku} ${x.line.name} ${x.line.address}`.toLowerCase().includes(query.toLowerCase())).sort((x,y)=>compareInventoryLines(inv,x.line,y.line));
 const indexes=new Map(inv.lines.map((l,index)=>[String(l.sku),{line:l,index}])),first=new Set(),rows=[];
 for(const pos of snapshot){if(!a.streets.some(scope=>typeof wmsAddressScope==='function'?wmsAddressScope(pos.address,scope):scope===pos.address.split(/[.-]/)[0]))continue;const item=indexes.get(String(pos.sku));
  if(a.stage===2&&(!item||!assignmentLines(inv,a).includes(item.line)))continue;
  if(!`${pos.address} ${pos.sku||''} ${pos.name||''} ${item?.line.name||''}`.toLowerCase().includes(query.toLowerCase()))continue;
  const own=item&&assignmentLines(inv,a).includes(item.line),alias=!!pos.sku&&(!own||first.has(String(pos.sku)));if(own)first.add(String(pos.sku));rows.push({...item,address:pos.address,empty:!pos.sku,alias,sku:pos.sku,name:pos.name});
 }
 return rows;
}
function wmsTaskRow(inv,row,a,actor){if(!row.empty&&!row.alias&&row.line)return taskRow(inv,row.line,row.index,a,a.members.includes(actor.id),row.address);return `<tr><td><span class="allocation-code">${esc(row.address)}</span></td><td><span class="count-item-code">${esc(row.sku||'')}</span><small>${esc(row.empty?'Sem item cadastrado':row.name||row.line?.name||'')}</small></td><td><small>${row.empty?'Posição sem código na planilha WMS':row.line?'Item em mais de uma posição · quantidade total no primeiro endereço do item':'Item contado pela dupla do endereço principal'}</small></td></tr>`;}

// Aplica apenas os nomes do catálogo; preserva contagens e alocações.
const renderBeforeItemDescriptions=render;
render=function(){for(const inv of inventories)window.jtpApplyInventoryDescriptions?.(inv);return renderBeforeItemDescriptions.apply(this,arguments);};
