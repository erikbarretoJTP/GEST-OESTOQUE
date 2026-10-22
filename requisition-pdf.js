async function buildRequisitionPDF(req){
  if(!req.deliveredAt)throw Error('Registre a entrega antes de gerar o comprovante.');
  const {PDFDocument,StandardFonts,rgb}=PDFLib,doc=await PDFDocument.create();
  const font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold),ink=rgb(.08,.16,.27),muted=rgb(.35,.43,.50);
  const safe=value=>String(value??'').replace(/[\u2010-\u2015]/g,'-').replace(/[^\x20-\x7e\xa0-\xff\n]/g,' ');
  const wrap=(value,width,size=9)=>{const rows=[];for(const paragraph of safe(value).split('\n')){let line='';for(const word of paragraph.split(/\s+/)){let remaining=word;while(font.widthOfTextAtSize(remaining,size)>width){let n=1;while(n<remaining.length&&font.widthOfTextAtSize(remaining.slice(0,n+1),size)<=width)n++;if(line){rows.push(line);line='';}rows.push(remaining.slice(0,n));remaining=remaining.slice(n);}const next=line?line+' '+remaining:remaining;if(font.widthOfTextAtSize(next,size)>width){rows.push(line);line=remaining;}else line=next;}rows.push(line);}return rows;};
  let sheet,y;const text=(value,x,yy,size=9,strong=false,color=ink)=>sheet.drawText(safe(value),{x,y:yy,size,font:strong?bold:font,color});
  const newPage=()=>{sheet=doc.addPage([595.28,841.89]);y=794;text('GRUPO JTP',38,y,11,true);text('Comprovante de retirada de material',38,y-24,17,true);text(req.number||req.id,38,y-43,9,false,muted);y-=68;};
  const room=h=>{if(y-h<68)newPage();};
  const field=(label,value)=>{const rows=wrap(value,508);room(rows.length*13+19);text(label,38,y,8,true,muted);y-=14;rows.forEach(row=>{text(row,38,y);y-=13;});y-=6;};
  const date=value=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
  newPage();field('GARAGEM',typeof units!=='undefined'?(units.find(u=>u.id===req.unit)?.name||req.unit)+' - Estoque '+req.unit:req.unit);
  field('REQUISITADO POR',req.requestedBy+' - '+date(req.requestedAt));field('ENTREGUE POR',req.deliveredBy+' - '+date(req.deliveredAt));field('RETIRADO POR',req.receiver);if(req.vehicle)field('PREFIXO',req.vehicle);if(req.workOrder)field('O.S.',req.workOrder);field('FINALIDADE / DESTINO',req.purpose+(req.destination?' - '+req.destination:''));
  const header=()=>{room(30);sheet.drawRectangle({x:38,y:y-7,width:519,height:23,color:rgb(.91,.94,.97)});text('ITEM / DESCRIÇÃO',44,y,9,true);text('WMS',337,y,9,true);text('QTD / UN.',465,y,9,true);y-=28;};header();
  for(const line of req.lines){const desc=wrap(line.name,280),addresses=wrap(line.address||'Sem WMS',117),height=Math.max(desc.length+1,addresses.length)*13+15;if(y-height<70){newPage();header();}text(line.sku,44,y,9,true);desc.forEach((row,i)=>text(row,44,y-14-i*13,8));addresses.forEach((row,i)=>text(row,337,y-i*13,8));text(Number(line.qty).toLocaleString('pt-BR',{maximumFractionDigits:6})+' '+line.measure,465,y,9,true);y-=height;sheet.drawLine({start:{x:38,y:y+6},end:{x:557,y:y+6},thickness:.5,color:rgb(.84,.88,.91)});}
  y-=12;field(req.postedAt?'DOCUMENTO Praxio / DATA':'BAIXA Praxio PENDENTE',req.postedAt?req.sapDocument+' - '+req.sapDocumentDate:req.pendingReason);
  room(100);y-=36;sheet.drawLine({start:{x:38,y},end:{x:272,y},thickness:.6,color:muted});sheet.drawLine({start:{x:316,y},end:{x:557,y},thickness:.6,color:muted});text('Responsável pela entrega',38,y-15,8);text('Assinatura de quem retirou',316,y-15,8);
  const pages=doc.getPages();pages.forEach((p,i)=>{sheet=p;text('Horários de Brasília - Comprovante de entrega; baixa confirmada separadamente no Praxio.',38,36,7,false,muted);text((i+1)+' / '+pages.length,524,36,8,false,muted);});
  return doc.save();
}
async function downloadRequisitionPDF(req){if(!canSeeRequisition(req))throw Error('Sem acesso a esta requisição.');const bytes=await buildRequisitionPDF(req),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),link=document.createElement('a');link.href=url;link.download=materialReceiptFilename(req);link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}

function materialReceiptFilename(req){const clean=value=>String(value||'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').trim().replace(/[. ]+$/,'');const number=clean(req.requisitionNumber||req.number||req.id),vehicle=clean(req.vehicle)||'sem-prefixo',delivery=req.receiptSequence?' - retirada '+req.receiptSequence:' - retirada';return number+' - '+vehicle+delivery+'.pdf';}
