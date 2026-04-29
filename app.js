let match=null,snapshots=[],pendingPointWinner=null,lastPointType=null;
const STORAGE_KEY="tennisMatchV3";
const pointMap=["0","15","30","40"];
const typeLabels={ace:"Ace",service_winner:"Service Winner",winner:"Winner",forced_error:"Erro forçado",unforced_error:"Erro não forçado",double_fault:"Dupla falta",unclassified:"Sem classificar"};
const typeCausedBy={ace:"winner",service_winner:"winner",winner:"winner",forced_error:"loser",unforced_error:"loser",double_fault:"loser",unclassified:"unknown"};

window.addEventListener("load",()=>{
  registerServiceWorker();
  const saved=localStorage.getItem(STORAGE_KEY);
  if(saved){match=JSON.parse(saved);showMatchScreen();updateUI();}
});

function registerServiceWorker(){if("serviceWorker" in navigator){navigator.serviceWorker.register("service-worker.js").catch(()=>{});}}
function showMatchScreen(){setupScreen.classList.add("hidden");matchScreen.classList.remove("hidden");}

function startMatch(){
  const player0=p1.value.trim()||"Jogador 1", player1=p2.value.trim()||"Jogador 2";
  const first=Number(firstServer.value);
  match={
    players:[player0,player1],
    config:{advantage:advantage.value==="true",gamesPerSet:Number(gamesPerSet.value),setsToWin:Number(setsToWin.value),firstServer:first,setEndRule:setEndRule.value,finalSetMode:finalSetMode.value},
    meta:{startedAt:new Date().toISOString(),finishedAt:null},
    score:{points:[0,0],games:[0,0],sets:[0,0],currentServer:first,nextGameServer:first,matchOver:false,currentSetNumber:1,currentGameNumberInSet:1,inTiebreak:false,isSuperTiebreak:false,tiebreakPoints:[0,0],tiebreakTarget:7,tiebreakStartServer:first},
    currentGame:{pointSequence:[],classifiedPoints:[],hadDeuce:false,currentPointServeFaults:0},
    stats:{pointsWon:[0,0],gamesWon:[0,0],breaks:[0,0],deuces:0,noAdGames:0,aces:[0,0],serviceWinners:[0,0],winners:[0,0],forcedErrors:[0,0],unforcedErrors:[0,0],doubleFaults:[0,0],servicePointsPlayed:[0,0],firstServeFaults:[0,0],firstServePointsWon:[0,0],secondServePointsWon:[0,0],receivePointsWon:[0,0]},
    setsHistory:[],gamesHistory:[]
  };
  snapshots=[];
  maybeStartFinalSetSuperTiebreak();
  save();showMatchScreen();updateUI();
}

function isFinalSet(){return match.score.sets[0]===match.config.setsToWin-1 && match.score.sets[1]===match.config.setsToWin-1;}
function maybeStartFinalSetSuperTiebreak(){if(match.config.finalSetMode==="super_tiebreak"&&isFinalSet()&&!match.score.inTiebreak){startTiebreak(true);}}
function startTiebreak(isSuper){
  match.score.inTiebreak=true;match.score.isSuperTiebreak=isSuper;match.score.tiebreakPoints=[0,0];match.score.tiebreakTarget=isSuper?10:7;
  match.score.tiebreakStartServer=match.score.nextGameServer;match.score.currentServer=match.score.tiebreakStartServer;
  match.currentGame={pointSequence:[],classifiedPoints:[],hadDeuce:false,currentPointServeFaults:0};
}
function getServeNumber(){return match.currentGame.currentPointServeFaults===0?1:2;}

function openPointOverlay(winner){
  if(!match||match.score.matchOver)return;
  pendingPointWinner=winner;
  const loser=winner===0?1:0, server=match.score.currentServer;
  overlayTitle.innerText=`Ponto para ${match.players[winner]}`;
  overlayContext.innerText=`Sacador: ${match.players[server]} · ${getServeNumber()}º saque`;
  classificationButtons.innerHTML="";
  validPointTypes(winner,loser,server).forEach(item=>{
    const btn=document.createElement("button");
    btn.innerText=item.label;btn.className=item.className;btn.onclick=()=>classifyPoint(item.type);
    classificationButtons.appendChild(btn);
  });
  repeatLastBtn.disabled=!lastPointType;
  pointOverlay.classList.remove("hidden");
}
function closePointOverlay(){pendingPointWinner=null;pointOverlay.classList.add("hidden");}
function validPointTypes(winner,loser,server){
  const arr=[];
  if(winner===server){arr.push({type:"ace",label:"Ace",className:"serve"},{type:"service_winner",label:"Service Winner",className:"serve"});}
  arr.push({type:"winner",label:"Winner",className:"offense"});
  arr.push({type:"forced_error",label:`Erro forçado de ${match.players[loser]}`,className:"error"});
  arr.push({type:"unforced_error",label:`Erro não forçado de ${match.players[loser]}`,className:"error"});
  return arr;
}
function classifyPoint(type){
  if(pendingPointWinner===null)return;
  if(type==="__repeat__"){if(!lastPointType)return;type=lastPointType;}
  const winner=pendingPointWinner;closePointOverlay();awardPoint(winner,type);
}

function serveFault(){
  if(!match||match.score.matchOver)return;
  snapshot();
  const server=match.score.currentServer, receiver=server===0?1:0;
  if(match.currentGame.currentPointServeFaults===0){
    match.currentGame.currentPointServeFaults=1;
    match.stats.firstServeFaults[server]++;
    save();updateUI();return;
  }
  match.stats.doubleFaults[server]++;
  awardPoint(receiver,"double_fault",{snapshotAlreadyTaken:true});
}

function awardPoint(winner,type,options={}){
  if(!options.snapshotAlreadyTaken)snapshot();
  const loser=winner===0?1:0, server=match.score.currentServer, serveNumber=getServeNumber();
  const firstServeFault=match.currentGame.currentPointServeFaults>0, secondServeFault=type==="double_fault";
  const causedBy=inferCausedBy(type,winner,loser);
  const ev={winner,loser,server,type,causedBy,serveNumber,firstServeFault,secondServeFault,timestamp:new Date().toISOString()};

  match.stats.servicePointsPlayed[server]++;
  match.stats.pointsWon[winner]++;
  if(winner!==server)match.stats.receivePointsWon[winner]++;
  if(winner===server&&serveNumber===1)match.stats.firstServePointsWon[server]++;
  if(winner===server&&serveNumber===2)match.stats.secondServePointsWon[server]++;
  applyPointTypeStats(type,winner,loser,causedBy);

  if(match.score.inTiebreak){awardTiebreakPoint(winner,ev);return;}
  awardGamePoint(winner,ev,type);
}

function awardGamePoint(winner,ev,type){
  const loser=winner===0?1:0;
  match.score.points[winner]++;
  match.currentGame.pointSequence.push(winner);
  match.currentGame.classifiedPoints.push(ev);
  if(match.score.points[0]>=3&&match.score.points[1]>=3)match.currentGame.hadDeuce=true;
  if(type!=="unclassified"&&type!=="double_fault")lastPointType=type;

  const p=match.score.points[winner], o=match.score.points[loser];
  if(p>=3&&o>=3&&!match.config.advantage){match.stats.noAdGames++;winGame(winner,true);return;}
  if(p>=4&&p-o>=2){winGame(winner,false);return;}
  if(p>=4&&o<3){winGame(winner,false);return;}

  match.currentGame.currentPointServeFaults=0;
  save();updateUI();
}

function awardTiebreakPoint(winner,ev){
  if(ev.type!=="unclassified"&&ev.type!=="double_fault")lastPointType=ev.type;
  match.score.tiebreakPoints[winner]++;
  match.currentGame.pointSequence.push(winner);
  match.currentGame.classifiedPoints.push(ev);
  match.currentGame.currentPointServeFaults=0;
  updateTiebreakServer();
  const loser=winner===0?1:0, p=match.score.tiebreakPoints[winner], o=match.score.tiebreakPoints[loser];
  if(p>=match.score.tiebreakTarget&&p-o>=2){finishTiebreak(winner);return;}
  save();updateUI();
}

function updateTiebreakServer(){
  const total=match.score.tiebreakPoints[0]+match.score.tiebreakPoints[1];
  const starter=match.score.tiebreakStartServer;
  if(total===0){match.score.currentServer=starter;return;}
  const block=Math.floor((total-1)/2);
  match.score.currentServer=block%2===0?1-starter:starter;
}

function winGame(winner,endedByNoAd){
  const loser=winner===0?1:0, wasBreak=match.score.currentServer!==winner;
  if(match.currentGame.hadDeuce)match.stats.deuces++;
  if(wasBreak)match.stats.breaks[winner]++;
  const game={type:"game",setNumber:match.score.currentSetNumber,gameNumber:match.score.currentGameNumberInSet,globalNumber:match.gamesHistory.length+1,server:match.score.currentServer,winner,pointsWon:[...match.score.points],displayScore:buildGameScoreText(match.score.points,endedByNoAd),hadDeuce:match.currentGame.hadDeuce,endedByNoAd,wasBreak,pointSequence:[...match.currentGame.pointSequence],classifiedPoints:[...match.currentGame.classifiedPoints]};
  match.gamesHistory.push(game);
  match.score.games[winner]++;match.stats.gamesWon[winner]++;
  match.score.points=[0,0];match.currentGame={pointSequence:[],classifiedPoints:[],hadDeuce:false,currentPointServeFaults:0};
  match.score.nextGameServer=match.score.nextGameServer===0?1:0;
  match.score.currentServer=match.score.nextGameServer;

  if(shouldStartNormalTiebreak()){startTiebreak(false);}
  else if(shouldWinSetByGames(winner,loser)){winSet(winner,{kind:"games"});}
  else match.score.currentGameNumberInSet++;
  save();updateUI();
}

function shouldWinSetByGames(winner,loser){return match.score.games[winner]>=match.config.gamesPerSet && match.score.games[winner]-match.score.games[loser]>=2;}
function shouldStartNormalTiebreak(){return match.config.setEndRule==="tiebreak"&&!match.score.inTiebreak&&match.score.games[0]===match.config.gamesPerSet&&match.score.games[1]===match.config.gamesPerSet;}

function finishTiebreak(winner){
  const isSuper=match.score.isSuperTiebreak;
  const record={type:isSuper?"super_tiebreak":"tiebreak",setNumber:match.score.currentSetNumber,gameNumber:isSuper?null:match.score.currentGameNumberInSet,globalNumber:match.gamesHistory.length+1,server:match.score.tiebreakStartServer,winner,pointsWon:[...match.score.tiebreakPoints],displayScore:`${match.score.tiebreakPoints[0]}-${match.score.tiebreakPoints[1]}`,pointSequence:[...match.currentGame.pointSequence],classifiedPoints:[...match.currentGame.classifiedPoints],isSuperTiebreak:isSuper};
  match.gamesHistory.push(record);
  if(!isSuper){match.score.games[winner]++;match.stats.gamesWon[winner]++;}
  winSet(winner,{kind:isSuper?"super_tiebreak":"tiebreak",tiebreak:record});
  save();updateUI();
}

function winSet(winner,detail){
  const setRecord={number:match.score.currentSetNumber,winner,games:[...match.score.games],kind:detail.kind,tiebreak:detail.tiebreak||null,gamesHistory:match.gamesHistory.filter(g=>g.setNumber===match.score.currentSetNumber)};
  match.setsHistory.push(setRecord);
  match.score.sets[winner]++;
  match.score.inTiebreak=false;match.score.isSuperTiebreak=false;match.score.tiebreakPoints=[0,0];match.score.points=[0,0];
  match.currentGame={pointSequence:[],classifiedPoints:[],hadDeuce:false,currentPointServeFaults:0};

  if(match.score.sets[winner]>=match.config.setsToWin){match.score.matchOver=true;match.meta.finishedAt=new Date().toISOString();return;}
  match.score.games=[0,0];match.score.currentSetNumber++;match.score.currentGameNumberInSet=1;
  match.score.nextGameServer=match.score.nextGameServer===0?1:0;
  match.score.currentServer=match.score.nextGameServer;
  maybeStartFinalSetSuperTiebreak();
}

function buildGameScoreText(points,endedByNoAd){return endedByNoAd?"40-40, ponto decisivo No-Ad":`${displayPoint(points[0])}-${displayPoint(points[1])}`;}
function displayPoint(v){return v<=3?pointMap[v]:"40";}
function readablePointDisplay(){
  if(match.score.inTiebreak)return[String(match.score.tiebreakPoints[0]),String(match.score.tiebreakPoints[1])];
  const a=match.score.points[0],b=match.score.points[1];
  if(a>=3&&b>=3){if(a===b)return["40","40"];if(match.config.advantage)return a>b?["AD","40"]:["40","AD"];}
  return[displayPoint(a),displayPoint(b)];
}
function inferCausedBy(type,winner,loser){const r=typeCausedBy[type]||"unknown";if(r==="winner")return winner;if(r==="loser")return loser;return null;}
function applyPointTypeStats(type,winner,loser,causedBy){
  if(type==="ace")match.stats.aces[winner]++;
  if(type==="service_winner")match.stats.serviceWinners[winner]++;
  if(type==="winner")match.stats.winners[winner]++;
  if(type==="forced_error"&&causedBy!==null)match.stats.forcedErrors[causedBy]++;
  if(type==="unforced_error"&&causedBy!==null)match.stats.unforcedErrors[causedBy]++;
}

function updateUI(){
  if(!match)return;
  name0.innerText=match.players[0];name1.innerText=match.players[1];
  const pts=readablePointDisplay();
  [0,1].forEach(i=>{
    document.getElementById(`centralPoint${i}`).innerText=pts[i];
    document.getElementById(`games${i}`).innerText=match.score.games[i];
    document.getElementById(`sets${i}`).innerText=match.score.sets[i];
    const serving=match.score.currentServer===i&&!match.score.matchOver;
    document.getElementById(`playerCard${i}`).classList.toggle("serving",serving);
    document.getElementById(`serverBadge${i}`).innerText=serving?`${getServeNumber()}º Saque`:"";
    document.getElementById(`serveFaultBtn${i}`).classList.toggle("hidden",!serving);
  });
  serverInfo.innerText=match.score.matchOver?"Partida encerrada":`Sacando: ${match.players[match.score.currentServer]} · ${getServeNumber()}º saque`;
  setInfo.innerText=match.score.isSuperTiebreak?`Set ${match.score.currentSetNumber} · Tie-breakão decisivo`:match.score.inTiebreak?`Set ${match.score.currentSetNumber} · Tie-break`:`Set ${match.score.currentSetNumber} · Game ${match.score.currentGameNumberInSet}`;
  const rule=match.config.advantage?"Com vantagem":"Sem vantagem / No-Ad", endRule=match.config.setEndRule==="tiebreak"?"tie-break no limite":"diferença de 2", finalMode=match.config.finalSetMode==="super_tiebreak"?"decisivo: tie-breakão":"decisivo: set normal";
  ruleInfo.innerText=`${rule} · ${match.config.gamesPerSet} games · ${endRule} · ${finalMode}`;
  matchStatus.innerText=match.score.matchOver?`Partida encerrada · Vencedor: ${winnerName()}`:"Partida em andamento";
  renderGamesHistory();
}

function renderGamesHistory(){
  gamesHistory.innerHTML="";
  if(match.gamesHistory.length===0){gamesHistory.innerHTML='<div class="game-row">Nenhum game finalizado.</div>';return;}
  match.gamesHistory.slice(-8).reverse().forEach(item=>{
    const div=document.createElement("div");div.className="game-row";
    div.innerText=item.type==="game"?`S${item.setNumber} G${item.gameNumber}: ${match.players[item.winner]} ${item.displayScore} · Sacador: ${match.players[item.server]}${item.wasBreak?" · Quebra":""}`:`S${item.setNumber} ${item.isSuperTiebreak?"TB10":"TB"}: ${match.players[item.winner]} ${item.displayScore}`;
    gamesHistory.appendChild(div);
  });
}

function snapshot(){snapshots.push(JSON.stringify(match));if(snapshots.length>400)snapshots.shift();}
function undo(){if(snapshots.length===0)return;match=JSON.parse(snapshots.pop());save();updateUI();}
function newMatch(){if(!confirm("Apagar a partida atual e iniciar outra?"))return;localStorage.removeItem(STORAGE_KEY);match=null;snapshots=[];pendingPointWinner=null;pointOverlay.classList.add("hidden");matchScreen.classList.add("hidden");setupScreen.classList.remove("hidden");}
function winnerName(){if(match.score.sets[0]>match.score.sets[1])return match.players[0];if(match.score.sets[1]>match.score.sets[0])return match.players[1];return"-";}
function percent(n,d){return d?`${Math.round((n/d)*100)}%`:"0%";}
function firstServeIn(i){return match.stats.servicePointsPlayed[i]-match.stats.firstServeFaults[i];}


function formatDateTime(value){
  if(!value)return "partida em andamento";
  return new Date(value).toLocaleString("pt-BR");
}

function pct(n,d){
  if(!d)return "0%";
  return `${Math.round((n/d)*100)}%`;
}

function playerLine(values){
  return `${match.players[0]} ${values[0]} | ${match.players[1]} ${values[1]}`;
}

function setScoreLine(){
  if(match.setsHistory.length===0){
    return "Set em andamento";
  }

  return match.setsHistory.map(set=>{
    if(set.kind==="super_tiebreak"){
      return `TB10 ${set.tiebreak.displayScore}`;
    }
    if(set.kind==="tiebreak"){
      return `${set.games[0]}-${set.games[1]} (${set.tiebreak.displayScore})`;
    }
    return `${set.games[0]}-${set.games[1]}`;
  }).join(" | ");
}

function buildHeaderBlock(){
  let t="🎾 PARTIDA DE TÊNIS\n\n";
  t+=`${match.players[0]} x ${match.players[1]}\n`;
  t+=`Início: ${formatDateTime(match.meta.startedAt)}\n`;
  t+=`Fim: ${formatDateTime(match.meta.finishedAt)}\n\n`;
  return t;
}

function buildResultBlock(){
  let t="🏆 RESULTADO\n";

  if(match.score.matchOver){
    t+=`${winnerName()} venceu por ${Math.max(match.score.sets[0],match.score.sets[1])} sets a ${Math.min(match.score.sets[0],match.score.sets[1])}\n`;
  }else{
    t+="Partida em andamento\n";
  }

  t+=`Sets: ${setScoreLine()}\n`;
  if(!match.score.matchOver){
    if(match.score.inTiebreak){
      t+=`Tie-break atual: ${match.score.tiebreakPoints[0]}-${match.score.tiebreakPoints[1]}\n`;
    }else{
      t+=`Games do set atual: ${match.score.games[0]}-${match.score.games[1]}\n`;
    }
  }
  t+="\n";
  return t;
}

function buildConfigBlock(){
  let t="⚙️ CONFIGURAÇÃO\n";
  t+=`Vantagem: ${match.config.advantage?"Com vantagem":"Sem vantagem / No-Ad"}\n`;
  t+=`Set: ${match.config.setEndRule==="tiebreak"?"Tie-break no empate limite":"Sempre diferença de 2 games"}\n`;
  t+=`Decisivo: ${match.config.finalSetMode==="super_tiebreak"?"Tie-breakão até 10":"Set normal"}\n`;
  t+=`Games por set: ${match.config.gamesPerSet}\n`;
  t+=`Sets para vencer: ${match.config.setsToWin}\n`;
  t+=`Sacador inicial: ${match.players[match.config.firstServer]}\n\n`;
  return t;
}

function buildGeneralStatsBlock(){
  let t="📊 RESUMO GERAL\n";
  t+="Pontos:\n";
  t+=`${playerLine(match.stats.pointsWon)}\n\n`;
  t+="Games:\n";
  t+=`${playerLine(match.stats.gamesWon)}\n\n`;
  t+="Quebras:\n";
  t+=`${playerLine(match.stats.breaks)}\n\n`;
  t+=`Deuces: ${match.stats.deuces}\n`;
  t+=`Games No-Ad: ${match.stats.noAdGames}\n\n`;
  return t;
}

function buildShotStatsBlock(){
  let t="🎯 GOLPES\n";

  t+="Aces:\n";
  t+=`${playerLine(match.stats.aces)}\n\n`;

  t+="Service winners:\n";
  t+=`${playerLine(match.stats.serviceWinners)}\n\n`;

  t+="Winners:\n";
  t+=`${playerLine(match.stats.winners)}\n\n`;

  t+="Erros forçados:\n";
  t+=`${playerLine(match.stats.forcedErrors)}\n\n`;

  t+="Erros não forçados:\n";
  t+=`${playerLine(match.stats.unforcedErrors)}\n\n`;

  t+="Duplas faltas:\n";
  t+=`${playerLine(match.stats.doubleFaults)}\n\n`;

  return t;
}

function buildServeStatsBlock(){
  let t="🎾 SAQUE\n\n";

  [0,1].forEach(i=>{
    const sp=match.stats.servicePointsPlayed[i];
    const fsFaults=match.stats.firstServeFaults[i];
    const fsIn=firstServeIn(i);
    const secondPlayed=fsFaults;

    t+=`${match.players[i]}\n`;
    t+=`Pontos sacados: ${sp}\n`;
    t+=`1º saque em quadra: ${fsIn}/${sp} (${pct(fsIn,sp)})\n`;
    t+=`Erros de 1º saque: ${fsFaults}\n`;
    t+=`Duplas faltas: ${match.stats.doubleFaults[i]}\n`;
    t+=`Pontos vencidos com 1º saque: ${match.stats.firstServePointsWon[i]}/${fsIn} (${pct(match.stats.firstServePointsWon[i],fsIn)})\n`;
    t+=`Pontos vencidos com 2º saque: ${match.stats.secondServePointsWon[i]}/${secondPlayed} (${pct(match.stats.secondServePointsWon[i],secondPlayed)})\n\n`;
  });

  return t;
}

function buildSetsBlock(){
  let t="📌 SETS\n";

  if(match.setsHistory.length===0){
    t+="Nenhum set finalizado.\n\n";
    return t;
  }

  match.setsHistory.forEach(set=>{
    if(set.kind==="super_tiebreak"){
      t+=`Set ${set.number}: ${match.players[set.winner]} venceu no tie-breakão ${set.tiebreak.displayScore}\n`;
    }else if(set.kind==="tiebreak"){
      t+=`Set ${set.number}: ${match.players[set.winner]} venceu ${set.games[0]}-${set.games[1]} (${set.tiebreak.displayScore})\n`;
    }else{
      t+=`Set ${set.number}: ${match.players[set.winner]} venceu ${set.games[0]}-${set.games[1]}\n`;
    }
  });

  t+="\n";
  return t;
}

function buildGamesBlock(includePoints){
  let t="📋 GAMES\n";

  if(match.gamesHistory.length===0){
    t+="Nenhum game finalizado.\n";
    return t;
  }

  let currentSet=null;

  match.gamesHistory.forEach(item=>{
    if(currentSet!==item.setNumber){
      currentSet=item.setNumber;
      t+=`\nSET ${currentSet}\n`;
    }

    if(item.type==="game"){
      t+=`${item.gameNumber}. ${match.players[item.winner]} venceu ${item.displayScore}`;
      t+=` | Sacador: ${match.players[item.server]}`;
      if(item.wasBreak)t+=" | Quebra";
      if(item.hadDeuce)t+=" | Deuce";
      if(item.endedByNoAd)t+=" | No-Ad";
      t+="\n";
    }else{
      t+=`${item.isSuperTiebreak?"Tie-breakão":"Tie-break"}: ${match.players[item.winner]} venceu ${item.displayScore}\n`;
    }

    if(includePoints){
      const pts=item.classifiedPoints.map((p,idx)=>{
        const serveInfo=`${p.serveNumber}º saque`;
        const faultInfo=p.firstServeFault?" após erro no 1º saque":"";
        return `${idx+1}) ${match.players[p.winner]} - ${typeLabels[p.type]||p.type} (${serveInfo}${faultInfo})`;
      }).join("; ");

      if(pts)t+=`   Pontos: ${pts}\n`;
    }
  });

  return t;
}

function generateSummaryReport(){
  if(!match)return "Nenhuma partida registrada.";

  let t="";
  t+=buildHeaderBlock();
  t+=buildResultBlock();
  t+=buildConfigBlock();
  t+=buildGeneralStatsBlock();
  t+=buildShotStatsBlock();
  t+=buildServeStatsBlock();
  t+=buildSetsBlock();

  return t.trim();
}

function generateFullReport(){
  if(!match)return "Nenhuma partida registrada.";

  let t=generateSummaryReport();
  t+="\n\n";
  t+=buildGamesBlock(true);

  return t.trim();
}

async function copyTextToClipboard(text,successMessage){
  try{
    await navigator.clipboard.writeText(text);
    alert(successMessage);
  }catch(e){
    fallbackCopy(text,successMessage);
  }
}

function copySummary(){
  copyTextToClipboard(generateSummaryReport(),"Resumo copiado.");
}

function copyFull(){
  copyTextToClipboard(generateFullReport(),"Relatório completo copiado.");
}

function copyStats(){
  copyFull();
}

function fallbackCopy(text,successMessage="Texto copiado."){
  const area=document.createElement("textarea");
  area.value=text;
  area.style.position="fixed";
  area.style.opacity="0";
  document.body.appendChild(area);
  area.focus();
  area.select();
  document.execCommand("copy");
  document.body.removeChild(area);
  alert(successMessage);
}

function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(match));}
