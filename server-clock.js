// Relógio monotônico ancorado no horário do banco, independente do relógio do aparelho.
window.JTP_SERVER_CLOCK=(()=>{let epoch=null,tick=0;return {
 get ready(){return epoch!==null;},
 sync(value,roundTripMs=0){const parsed=Date.parse(value);if(!Number.isFinite(parsed))return;epoch=parsed+Math.min(2000,Math.max(0,roundTripMs))/2;tick=performance.now();},
 now(){return epoch===null?null:epoch+Math.max(0,performance.now()-tick);},
 reset(){epoch=null;tick=0;}
};})();
