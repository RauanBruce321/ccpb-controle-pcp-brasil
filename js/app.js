'use strict';

const VERSION='4.1';
const DB_NAME='CCPB_V4_DB';
const STORE='app';
const KEY='state';
const FIREBASE_DATABASE_URL='https://ccpb-controle-pcp-brasil-default-rtdb.firebaseio.com';
const ARCHIVE_RETENTION_DAYS=30;
const PERMISSIONS=[
  'view.tower','tower.import','tower.list','tower.filters','tower.download','tower.charts','tower.tv','tower.positions',
  'view.receiving','receiving.scan','receiving.list','receiving.filters','receiving.closeShift','receiving.download','receiving.tv',
  'view.triage','triage.scan','triage.assignPosition','triage.confirmPosition','triage.multipleNotesPosition','triage.requestRemoval','triage.scanRelease','triage.closeShift','triage.tv',
  'view.assistant','assistant.list','assistant.filters','assistant.details','assistant.generateRelease','assistant.closeShift','assistant.tv',
  'view.leadership','leadership.kpis','leadership.charts','leadership.notes','leadership.positions','leadership.history','leadership.download','leadership.archiveShift','leadership.tv',
  'view.admin','admin.users','admin.permissions','admin.sectors','admin.positions','admin.history','admin.firebase','admin.clear','admin.identity',
  'view.history','history.filters','history.download','global.search','operator.required','mode.tv'
];
const ROLE_PRESETS={
  admin:PERMISSIONS,
  tower:['view.tower','tower.import','tower.list','tower.filters','tower.download','tower.charts','tower.tv','tower.positions','view.history','global.search','operator.required','mode.tv'],
  leader:['view.leadership','leadership.kpis','leadership.charts','leadership.notes','leadership.positions','leadership.history','leadership.download','leadership.archiveShift','leadership.tv','view.history','history.filters','history.download','global.search','operator.required','mode.tv'],
  supervisor:['view.leadership','leadership.kpis','leadership.charts','leadership.notes','leadership.positions','leadership.history','leadership.download','leadership.tv','view.history','history.filters','history.download','global.search','operator.required','mode.tv'],
  assistant:['view.assistant','assistant.list','assistant.filters','assistant.details','assistant.generateRelease','assistant.closeShift','assistant.tv','global.search','operator.required','mode.tv'],
  triage:['view.triage','triage.scan','triage.assignPosition','triage.confirmPosition','triage.multipleNotesPosition','triage.requestRemoval','triage.scanRelease','triage.closeShift','triage.tv','operator.required','mode.tv'],
  receiving:['view.receiving','receiving.scan','receiving.list','receiving.filters','receiving.closeShift','receiving.download','receiving.tv','operator.required','mode.tv']
};
const DEFAULT_USERS=[
  ['admin','admin','Administrador','admin'],['torre','torre123','Torre de Controle','tower'],['lider','lider123','Líder Operacional','leader'],['supervisor','super123','Supervisor Operacional','supervisor'],['assistente','assist123','Assistente Operacional','assistant'],['triagem','triagem123','Triagem Operacional','triage'],['recebimento','receb123','Recebimento Operacional','receiving']
].map(([username,password,name,role])=>({username,password,name,role,active:true,permissions:[...ROLE_PRESETS[role]],requireOperator:role!=='admin'}));

let state=null,session=null,currentPage='',charts={},autosaveTimer=null;
const cache={records:[],byAwb:new Map(),byMaster:new Map(),byNote:new Map()};
const ROLE_LABELS={admin:'Administrador',tower:'Torre de Controle',leader:'Líder Operacional',supervisor:'Supervisor Operacional',assistant:'Assistente Operacional',triage:'Triagem Operacional',receiving:'Recebimento Operacional'};
const PERMISSION_LABELS={
'view.tower':'Visualizar Torre de Controle','tower.import':'Importar arquivo da Torre','tower.list':'Visualizar lista de lançamentos','tower.filters':'Usar filtros da Torre','tower.download':'Baixar relação da Torre','tower.charts':'Visualizar gráficos da Torre','tower.tv':'Usar modo TV na Torre','tower.positions':'Visualizar posições e complementos',
'view.receiving':'Visualizar Recebimento Operacional','receiving.scan':'Bipar Master no Recebimento','receiving.list':'Visualizar lista de Masters recebidas','receiving.filters':'Usar filtros do Recebimento','receiving.closeShift':'Encerrar turno do Recebimento','receiving.download':'Baixar relação do Recebimento','receiving.tv':'Usar modo TV no Recebimento',
'view.triage':'Visualizar Triagem Operacional','triage.scan':'Bipar AWB na Triagem','triage.assignPosition':'Cadastrar posição para Nota','triage.confirmPosition':'Confirmar posição da AWB','triage.multipleNotesPosition':'Permitir várias Notas na mesma posição','triage.requestRemoval':'Solicitar retirada da Nota','triage.scanRelease':'Bipar código de liberação','triage.closeShift':'Encerrar turno da Triagem','triage.tv':'Usar modo TV na Triagem',
'view.assistant':'Visualizar Assistente Operacional','assistant.list':'Visualizar lista de Notas','assistant.filters':'Usar filtros do Assistente','assistant.details':'Visualizar detalhes da Nota','assistant.generateRelease':'Gerar código de liberação','assistant.closeShift':'Encerrar turno do Assistente','assistant.tv':'Usar modo TV no Assistente',
'view.leadership':'Visualizar Painel da Liderança','leadership.kpis':'Visualizar indicadores da Liderança','leadership.charts':'Visualizar gráficos da Liderança','leadership.notes':'Visualizar relação geral de Notas','leadership.positions':'Visualizar posições e complementos','leadership.history':'Visualizar histórico detalhado','leadership.download':'Baixar relações da Liderança','leadership.archiveShift':'Arquivar turno concluído','leadership.tv':'Usar modo TV na Liderança',
'view.admin':'Visualizar Administração','admin.users':'Administrar usuários','admin.permissions':'Visualizar catálogo de permissões','admin.sectors':'Configurar telas e setores','admin.positions':'Administrar posições','admin.history':'Visualizar histórico geral','admin.firebase':'Configurar Firebase','admin.clear':'Limpar sistema','admin.identity':'Editar identidade do sistema',
'view.history':'Visualizar Histórico','history.filters':'Usar filtros do Histórico','history.download':'Baixar Histórico','global.search':'Usar busca universal','operator.required':'Exigir nome do operador','mode.tv':'Permitir modo TV'
};
const MODULE_LABELS={auth:'Acesso ao Sistema',navigation:'Navegação',tower:'Torre de Controle',receiving:'Recebimento Operacional',triage:'Triagem Operacional',assistant:'Assistente Operacional',leadership:'Liderança',admin:'Administração',history:'Histórico',system:'Sistema'};
const ACTION_LABELS={LOGIN:'Entrada no sistema',LOGOUT:'Saída do sistema',ABRIU_TELA:'Abertura de tela',BIPOU_AWB:'Bipagem de AWB',CADASTROU_POSICAO:'Cadastro de posição',RETIROU_NOTA:'Retirada de Nota',GEROU_CODIGO_LIBERACAO:'Geração de código de liberação',ENCERROU_TURNO:'Encerramento de turno',SALVOU_USUARIO:'Cadastro ou edição de usuário',SALVOU_POSICAO:'Cadastro ou edição de posição',EXCLUIU_POSICAO:'Exclusão de posição',ALTEROU_CONFIGURACAO_SETOR:'Alteração de configuração',LIMPEZA_TOTAL:'Limpeza total do sistema',ARQUIVOU_TURNO:'Arquivamento do turno',INICIOU_TURNO:'Início do turno',DOWNLOAD_LISTA:'Download de relação'};
function permissionLabel(code){return PERMISSION_LABELS[code]||code}
function roleLabel(code){return ROLE_LABELS[code]||code}
function moduleLabel(code){return MODULE_LABELS[code]||code}
function actionLabel(code){return ACTION_LABELS[code]||String(code||'').replaceAll('_',' ').toLowerCase().replace(/^./,c=>c.toUpperCase())}
function deviceLabel(){const ua=navigator.userAgent.toLowerCase();if(/zebra|tc2|tc5|mc3|android.*mobile/.test(ua))return 'Coletor Zebra ou celular';if(/ipad|tablet|android(?!.*mobile)/.test(ua))return 'Tablet';if(/windows|macintosh|linux/.test(ua))return 'Notebook ou computador';return 'Dispositivo móvel'}
function detailText(logItem){const d=logItem?.detail||{};const parts=[];if(d.page)parts.push(`Tela: ${PAGES[d.page]?.title||moduleLabel(d.page)}`);if(d.awb)parts.push(`AWB: ${d.awb}`);if(d.note)parts.push(`Nota: ${d.note}`);if(d.master)parts.push(`Master: ${d.master}`);if(d.position)parts.push(`Posição: ${d.position}`);if(d.sector)parts.push(`Setor: ${moduleLabel(d.sector)}`);if(d.shiftKey)parts.push(`Turno: ${d.shiftKey}`);if(d.username)parts.push(`Usuário: ${d.username}`);if(d.code)parts.push(`Código: ${d.code}`);return parts.join(' - ')||'Movimentação registrada'}


function emptyState(){return{
  version:VERSION,updatedAt:Date.now(),users:DEFAULT_USERS,records:[],positions:[],logs:[],closures:[],shiftRestarts:[],releases:[],archives:[],
  config:{identity:{name:'CCPB - Controle de PCP Brasil',subtitle:'Fluxo operacional integrado das Bases a TZX'},firebase:{enabled:true,databaseURL:FIREBASE_DATABASE_URL,authToken:''},sector:{},requireOperatorDefault:true}
};}
function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function loadLocalState(){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const r=tx.objectStore(STORE).get(KEY);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)})}
async function saveLocalState(){const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(state,KEY);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
function ensureStateShape(target){const base=emptyState();const value=target&&typeof target==='object'?target:base;for(const key of ['users','records','positions','logs','closures','shiftRestarts','releases','archives'])if(!Array.isArray(value[key]))value[key]=base[key];value.config=value.config||base.config;value.config.identity=value.config.identity||base.config.identity;value.config.firebase=value.config.firebase||base.config.firebase;if(!value.config.firebase.databaseURL)value.config.firebase.databaseURL=FIREBASE_DATABASE_URL;if(value.config.firebase.enabled===undefined)value.config.firebase.enabled=true;return value}
function cleanupExpiredArchives(){if(!Array.isArray(state?.archives))return false;const limit=Date.now()-ARCHIVE_RETENTION_DAYS*24*60*60*1000;const before=state.archives.length;state.archives=state.archives.filter(a=>{const time=Date.parse(a?.at||a?.archivedAt||'');return !Number.isFinite(time)||time>=limit});return state.archives.length!==before}
async function fetchRemoteState(config){if(!navigator.onLine)return null;const f=config?.firebase||config;if(!f?.enabled||!f.databaseURL)return null;const url=`${String(f.databaseURL).replace(/\/$/,'')}/ccpb/state.json${f.authToken?`?auth=${encodeURIComponent(f.authToken)}`:''}`;const resp=await fetch(url,{cache:'no-store'});if(!resp.ok)throw new Error(`Firebase GET ${resp.status}`);return await resp.json()}
async function loadState(){

    let local = null;

    try{
        local = await loadLocalState();
    }catch(e){
        console.error('Falha ao carregar backup local:',e);
    }

    local = ensureStateShape(local || emptyState());

    state = local;

    try{
    await firebasePull();
}catch(e){
    console.error('Firebase indisponível. Usando backup local:',e);
}

cleanupExpiredArchives();

return state;
}

async function saveState(immediate=false){

    state.updatedAt = Date.now();

    cleanupExpiredArchives();

    if(!immediate){

        clearTimeout(autosaveTimer);

        autosaveTimer = setTimeout(
            ()=>saveState(true),
            350
        );

        return;

    }

    try{

        await saveLocalState();

    }catch(e){

        console.error(
            'Erro ao salvar backup local:',
            e
        );

    }

    try{

        await firebasePush();

    }catch(e){

        console.error(
            'Erro ao sincronizar Firebase:',
            e
        );

    }

}
function rebuildCache(){cache.records=state.records;cache.byAwb=new Map();cache.byMaster=new Map();cache.byNote=new Map();for(const r of state.records){cache.byAwb.set(norm(r.awb),r);const m=norm(r.master),n=norm(r.note);if(!cache.byMaster.has(m))cache.byMaster.set(m,[]);cache.byMaster.get(m).push(r);if(!cache.byNote.has(n))cache.byNote.set(n,[]);cache.byNote.get(n).push(r)}}
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const norm=v=>String(v??'').trim().toUpperCase();
const uniq=a=>[...new Set(a.filter(Boolean))];
const now=()=>new Date();
const dateBR=v=>{if(!v)return'';if(typeof v==='number'){const d=new Date(Math.round((v-25569)*86400*1000));return d.toLocaleDateString('pt-BR')}const s=String(v).trim();if(/^\d+(\.\d+)?$/.test(s)){const n=Number(s);if(n>30000&&n<70000)return dateBR(n)}const d=new Date(s);return isNaN(d)?s:d.toLocaleDateString('pt-BR')};
const isoDate=v=>{if(!v)return'';if(typeof v==='number'){const d=new Date(Math.round((v-25569)*86400*1000));return d.toISOString().slice(0,10)}const s=String(v).trim();if(/^\d+(\.\d+)?$/.test(s))return isoDate(Number(s));const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(m)return`${m[3]}-${m[2]}-${m[1]}`;const d=new Date(s);return isNaN(d)?'':d.toISOString().slice(0,10)};
function shiftOf(d=new Date()){const h=d.getHours();return h>=6&&h<18?'Turno 1':'Turno 2'}
function shiftKey(d=new Date()){const day=new Date(d);if(d.getHours()<6)day.setDate(day.getDate()-1);return`${day.toISOString().slice(0,10)}|${shiftOf(d)}`}
function toast(msg,type='info'){const el=document.createElement('div');el.className=`toast ${type==='ok'?'ok':type==='error'?'error':''}`;el.textContent=msg;$('#toastRoot').appendChild(el);setTimeout(()=>el.remove(),3500)}
function has(p){return session?.user?.permissions?.includes(p)||session?.user?.role==='admin'}
function log(action,detail={},module=currentPage||'system'){state.logs.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),date:new Date().toLocaleDateString('pt-BR'),time:new Date().toLocaleTimeString('pt-BR'),username:session?.user?.username||'sistema',operator:session?.operator||session?.user?.name||'Sistema',role:roleLabel(session?.user?.role)||'Sistema',module,moduleName:moduleLabel(module),action,actionName:actionLabel(action),detail,detailText:'',device:deviceLabel()});state.logs[0].detailText=detailText(state.logs[0]);if(state.logs.length>30000)state.logs.length=30000;saveState()}
function statusOfNote(rows){const total=rows.length,received=rows.filter(r=>r.receivedAt).length,triaged=rows.filter(r=>r.triagedAt).length,released=rows.filter(r=>r.releasedAt).length;if(released===total&&total)return'Retirada';if(triaged===total&&total)return'Aguardando Assistente';if(triaged)return received<total?'Aguardando complemento':'Em triagem';if(received===total&&total)return'Aguardando triagem';if(received)return'Parcialmente recebida';return'A caminho'}
function noteSummary(note,rows=cache.byNote.get(norm(note))||[]){const masters=uniq(rows.map(r=>r.master)),bases=uniq(rows.map(r=>r.base)),fcs=uniq(rows.map(r=>r.fc));const total=rows.length,received=rows.filter(r=>r.receivedAt).length,triaged=rows.filter(r=>r.triagedAt).length,released=rows.filter(r=>r.releasedAt).length;const promises=rows.map(r=>r.promiseDate).filter(Boolean).sort();return{note:rows[0]?.note||note,masters,bases,fcs,total,received,triaged,released,missingReceipt:total-received,missingTriage:total-triaged,position:rows.find(r=>r.position)?.position||'',promiseDate:promises[0]||'',status:statusOfNote(rows),pct:total?Math.round(triaged/total*100):0}}
function allNotes(){return[...cache.byNote.entries()].map(([n,rows])=>noteSummary(n,rows))}
function masterSummary(master,rows=cache.byMaster.get(norm(master))||[]){return{master:rows[0]?.master||master,bases:uniq(rows.map(r=>r.base)),notes:uniq(rows.map(r=>r.note)),total:rows.length,received:rows.filter(r=>r.receivedAt).length,promiseDate:rows.map(r=>r.promiseDate).filter(Boolean).sort()[0]||''}}
function onlineUpdate(){const online=navigator.onLine;$('#onlineBadge').innerHTML=`<i style="background:${online?'#22c55e':'#ef4444'}"></i>${online?'Online':'Offline'}`;$('#sideOnlineText').textContent=online?'Online':'Offline';$('#sideOnlineDot').style.background=online?'#22c55e':'#ef4444'}
function excelDownload(filename,rows){if(!rows.length){toast('Nenhum dado para baixar.','error');return}const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Dados');XLSX.writeFile(wb,filename);log('DOWNLOAD_LISTA',{filename,count:rows.length})}
function downloadTowerModel(){const rows=[{'Master':'MTR000001','Nota':'NOTA000001','AWB':'AWB000001','FC':'GRU8','Data Promessa':new Date().toLocaleDateString('pt-BR'),'Base de Origem':'JUD'}];excelDownload('MODELO_CCPB_TORRE.xlsx',rows)}

const PAGES={
 tower:{title:'Torre de Controle',subtitle:'Lançamentos e análise do fluxo das Bases a TZX',perm:'view.tower',single:true,render:renderTower},
 receiving:{title:'Recebimento Operacional',subtitle:'Recebimento das Masters em TZX',perm:'view.receiving',single:true,render:renderReceiving},
 triage:{title:'Triagem Operacional',subtitle:'Bipagem de AWBs e confirmação das posições',perm:'view.triage',single:true,render:renderTriage},
 assistant:{title:'Assistente Operacional',subtitle:'Conferência e liberação das Notas completas',perm:'view.assistant',single:true,render:renderAssistant},
 leadership:{title:'Painel Operacional',subtitle:'Visão completa do cenário e dos turnos',perm:'view.leadership',single:false,render:renderLeadership},
 positions:{title:'Posições e Complementos',subtitle:'Notas triadas que aguardam complementos',perm:'leadership.positions',single:false,render:renderPositions},
 history:{title:'Histórico de Movimentações',subtitle:'Auditoria de todas as ações do sistema',perm:'view.history',single:false,render:renderHistory},
 admin:{title:'Administração do Sistema',subtitle:'Usuários, permissões e configurações',perm:'view.admin',single:false,render:renderAdmin}
};
function pageAllowed(id,p){if(session?.user?.role==='admin')return id==='admin';if(id==='positions')return has('leadership.positions')||has('tower.positions');return has(p.perm)}
function allowedPages(){return Object.entries(PAGES).filter(([id,p])=>pageAllowed(id,p))}
function renderNav(){const nav=$('#nav');nav.innerHTML=allowedPages().map(([id,p])=>`<button class="nav-btn ${id===currentPage?'active':''}" data-page="${id}">${p.title}</button>`).join('');nav.onclick=e=>{const b=e.target.closest('[data-page]');if(b)openPage(b.dataset.page)}}
function openPage(id){const p=PAGES[id];if(!p||!pageAllowed(id,p)){toast('Acesso não autorizado.','error');return}currentPage=id;document.body.classList.toggle('single-screen',p.single&&session.user.role!=='admin');$('#pageTitle').textContent=p.title;$('#pageSubtitle').textContent=p.subtitle;renderNav();p.render();log('ABRIU_TELA',{page:id},'navigation');if(innerWidth<760)$('#sidebar').classList.remove('open')}
function loginFlows(){const labels=['Torre de Controle','Recebimento','Triagem','Assistente','Liderança','Administração'];$('#loginFlows').innerHTML=labels.map(x=>`<div class="flow-chip">${x}</div>`).join('')}
async function login(e){e.preventDefault();try{await firebasePull()}catch(err){console.error('Erro ao atualizar usuários do Firebase:',err)}const u=norm($('#loginUser').value),pass=$('#loginPass').value;const user=state.users.find(x=>norm(x.username)===u&&x.password===pass&&x.active);if(!user){toast('Usuário ou senha inválidos.','error');return}const required=user.requireOperator??user.permissions.includes('operator.required');if(required&&!$('#operatorName').value.trim()){$('#operatorNameWrap').classList.remove('hidden');$('#operatorName').focus();toast('Informe o nome do operador.','error');return}session={user,operator:$('#operatorName').value.trim()||user.name,loginAt:new Date().toISOString()};sessionStorage.setItem('ccpb_session',JSON.stringify({username:user.username,operator:session.operator}));enterApp();log('LOGIN',{username:user.username,operator:session.operator},'auth')}
function enterApp(){resetInactivity();$('#loginView').classList.add('hidden');$('#appView').classList.remove('hidden');$('#operatorLabel').textContent=session.operator;$('#roleLabel').textContent=session.user.name;$('#avatar').textContent=session.operator.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();$('#shiftBadge').textContent=shiftOf();renderNav();const first=allowedPages()[0]?.[0]||'admin';openPage(first)}
function logout(){clearTimeout(inactivityTimer);log('LOGOUT',{},'auth');sessionStorage.removeItem('ccpb_session');session=null;$('#appView').classList.add('hidden');$('#loginView').classList.remove('hidden');$('#loginPass').value='';$('#operatorName').value='';$('#operatorNameWrap').classList.add('hidden')}

function kpi(label,value){return`<div class="kpi"><strong>${Number(value||0).toLocaleString('pt-BR')}</strong><span>${label}</span></div>`}
function head(title,desc,actions=''){return`<div class="section-head"><div><h2>${title}</h2><p>${desc}</p></div><div class="toolbar">${actions}</div></div>`}
function filterTable(rows,filters,cols){return rows.filter(r=>filters.every((v,i)=>!v||String(r[cols[i].key]??'').toLowerCase().includes(v.toLowerCase())))}
function table(cols,rows,id='table'){return`<div class="table-wrap"><table class="data-table" id="${id}"><thead><tr>${cols.map(c=>`<th>${c.label}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${c.render?c.render(r):r[c.key]??''}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${cols.length}">Nenhum registro.</td></tr>`}</tbody></table></div>`}
function filterBar(cols,prefix){return`<div class="filter-row">${cols.slice(0,4).map((c,i)=>`<input data-filter="${i}" placeholder="Filtrar ${c.label}" id="${prefix}f${i}">`).join('')}</div>`}

function renderTower(){const recs=cache.records,notes=allNotes(),masters=[...cache.byMaster.values()].map(x=>masterSummary(x[0].master,x));const pending=recs.filter(r=>!r.receivedAt);const bases={};recs.forEach(r=>bases[r.base]=(bases[r.base]||0)+1);const overdue=notes.filter(n=>n.promiseDate&&n.promiseDate<new Date().toISOString().slice(0,10)&&n.status!=='Retirada').length;$('#content').innerHTML=head('Torre de Controle','Importação acumulativa e análise de tudo que está seguindo para TZX',`${has('tower.import')?'<button class="btn primary" id="importBtn">Importar Excel</button>':''}<button class="btn subtle" id="modelBtn">Baixar modelo</button>${has('tower.download')?'<button class="btn subtle" id="towerDownload">Baixar relação</button>':''}`)+`<div class="kpi-grid">${kpi('AWBs lançadas',recs.length)}${kpi('Masters',masters.length)}${kpi('Notas',notes.length)}${kpi('AWBs pendentes de TZX',pending.length)}${kpi('Bases de origem',Object.keys(bases).length)}${kpi('AWBs recebidas',recs.filter(r=>r.receivedAt).length)}${kpi('Notas vencidas',overdue)}${kpi('Notas em posições',notes.filter(n=>n.position).length)}</div><div id="importPanel" class="panel hidden"><div class="panel-head"><h3>Processamento do arquivo</h3><span id="importText">Aguardando...</span></div><div class="panel-body"><div class="import-progress"><i id="importBar"></i></div><div id="importValidation" style="margin-top:12px;font-size:11px"></div></div></div>${has('tower.charts')?`<div class="grid-2"><div class="panel"><div class="panel-head"><h3>AWBs por base</h3></div><div class="panel-body chart-wrap"><canvas id="towerBaseChart"></canvas></div></div><div class="panel"><div class="panel-head"><h3>Recebido x pendente</h3></div><div class="panel-body chart-wrap"><canvas id="towerStatusChart"></canvas></div></div></div>`:''}<div class="panel"><div class="panel-head"><h3>Relação geral de lançamentos</h3><span>${recs.length.toLocaleString('pt-BR')} linhas</span></div>${filterBar(TOWER_COLS,'tower')}${table(TOWER_COLS,recs.slice(0,3000),'towerTable')}</div>`;
 if($('#importBtn'))$('#importBtn').onclick=()=>$('#towerFile').click();if($('#modelBtn'))$('#modelBtn').onclick=downloadTowerModel;if($('#towerDownload'))$('#towerDownload').onclick=()=>excelDownload('CCPB_Torre.xlsx',recs.map(exportRecord));bindColumnFilters('tower',TOWER_COLS,recs,3000);if(has('tower.charts'))drawTowerCharts(bases,recs)}
const TOWER_COLS=[{label:'Master',key:'master'},{label:'Nota',key:'note'},{label:'AWB',key:'awb'},{label:'FC',key:'fc'},{label:'Data Promessa',key:'promiseDate',render:r=>dateBR(r.promiseDate)},{label:'Base',key:'base'},{label:'Status',key:'status',render:r=>`<span class="status ${r.releasedAt?'released':r.triagedAt?'triaged':r.receivedAt?'received':'pending'}">${r.releasedAt?'Retirada':r.triagedAt?'Triada':r.receivedAt?'Recebida em TZX':'A caminho'}</span>`},{label:'Registrado por',key:'createdBy'},{label:'Data/Hora',key:'createdAt',render:r=>r.createdAt?new Date(r.createdAt).toLocaleString('pt-BR'):''}];
function exportRecord(r){return{Master:r.master,Nota:r.note,AWB:r.awb,FC:r.fc,'Data Promessa':dateBR(r.promiseDate),'Base de Origem':r.base,Status:r.releasedAt?'Retirada':r.triagedAt?'Triada':r.receivedAt?'Recebida em TZX':'A caminho','Registrado por':r.createdBy,'Data/Hora':r.createdAt?new Date(r.createdAt).toLocaleString('pt-BR'):''}}
function bindColumnFilters(prefix,cols,rows,limit){const inputs=$$(`[id^="${prefix}f"]`);inputs.forEach(i=>i.oninput=()=>{const vals=inputs.map(x=>x.value);const filtered=filterTable(rows,vals,cols).slice(0,limit);$(`#${prefix}Table`).outerHTML=table(cols,filtered,`${prefix}Table`)})}
function drawTowerCharts(bases,recs){destroyChart('towerBase');charts.towerBase=new Chart($('#towerBaseChart'),{type:'bar',data:{labels:Object.keys(bases).slice(0,20),datasets:[{data:Object.values(bases).slice(0,20),backgroundColor:'#2f5bc4'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}});destroyChart('towerStatus');charts.towerStatus=new Chart($('#towerStatusChart'),{type:'doughnut',data:{labels:['Pendente','Recebida','Triada','Retirada'],datasets:[{data:[recs.filter(r=>!r.receivedAt).length,recs.filter(r=>r.receivedAt&&!r.triagedAt).length,recs.filter(r=>r.triagedAt&&!r.releasedAt).length,recs.filter(r=>r.releasedAt).length],backgroundColor:['#ca8a04','#2f5bc4','#7c3aed','#16a34a']}]},options:{responsive:true,maintainAspectRatio:false}})}
function destroyChart(k){try{charts[k]?.destroy()}catch{}delete charts[k]}

async function importTower(file){if(!file)return;$('#importPanel')?.classList.remove('hidden');setImportProgress(2,'Lendo arquivo...');try{const data=await file.arrayBuffer();const wb=XLSX.read(data,{type:'array',cellDates:false});const ws=wb.Sheets[wb.SheetNames[0]];const raw=XLSX.utils.sheet_to_json(ws,{defval:'',raw:true});if(!raw.length)throw new Error('Arquivo sem linhas.');const mapped=[];let invalid=0;const existing=new Set(cache.records.map(r=>norm(r.awb)));const seen=new Set();for(let i=0;i<raw.length;i++){const x=normalizeRow(raw[i]);if(!x.master||!x.note||!x.awb||!x.fc||!x.base){invalid++;continue}if(existing.has(norm(x.awb))||seen.has(norm(x.awb)))continue;seen.add(norm(x.awb));mapped.push({...x,id:crypto.randomUUID(),status:'PENDING_RECEIPT',createdAt:new Date().toISOString(),createdBy:session.operator,createdUser:session.user.username,shift:shiftKey()});if(i%3000===0){setImportProgress(Math.min(35,5+i/raw.length*30),`Validando ${i.toLocaleString('pt-BR')} de ${raw.length.toLocaleString('pt-BR')}...`);await idle()}}
 const duplicates=raw.length-invalid-mapped.length;$('#importValidation').innerHTML=`Linhas encontradas: <b>${raw.length.toLocaleString('pt-BR')}</b> &nbsp; Válidas novas: <b>${mapped.length.toLocaleString('pt-BR')}</b> &nbsp; Duplicadas: <b>${duplicates.toLocaleString('pt-BR')}</b> &nbsp; Inválidas: <b>${invalid.toLocaleString('pt-BR')}</b>`;if(!mapped.length){setImportProgress(100,'Nenhuma linha nova para inserir.');toast('Nenhuma AWB nova foi encontrada.','error');return}for(let i=0;i<mapped.length;i+=1500){state.records.push(...mapped.slice(i,i+1500));setImportProgress(35+Math.round((i+1500)/mapped.length*60),`Gravando ${Math.min(i+1500,mapped.length).toLocaleString('pt-BR')} de ${mapped.length.toLocaleString('pt-BR')}...`);await idle()}rebuildCache();await saveState(true);setImportProgress(100,`${mapped.length.toLocaleString('pt-BR')} AWBs acrescentadas com sucesso.`);log('IMPORTOU_ARQUIVO',{file:file.name,found:raw.length,inserted:mapped.length,duplicates,invalid},'tower');toast(`${mapped.length.toLocaleString('pt-BR')} AWBs importadas.`,'ok');setTimeout(renderTower,700)}catch(err){console.error(err);setImportProgress(100,`Falha: ${err.message}`);toast(`Falha ao importar: ${err.message}`,'error')}}
function normalizeRow(row){const obj={};for(const[k,v]of Object.entries(row)){const nk=String(k).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');obj[nk]=v}return{master:String(obj.master||'').trim(),note:String(obj.nota||obj.note||'').trim(),awb:String(obj.awb||'').trim(),fc:String(obj.fc||'').trim(),promiseDate:isoDate(obj.datapromessa||obj.promessa||obj.vencimento),base:String(obj.basedeorigem||obj.baseorigem||obj.base||'').trim()}}
function setImportProgress(p,t){if($('#importBar'))$('#importBar').style.width=`${Math.min(100,p)}%`;if($('#importText'))$('#importText').textContent=t}
const idle=()=>new Promise(r=>setTimeout(r,0));

function setorLabel(sector){return{receiving:'Recebimento',triage:'Triagem',assistant:'Assistente'}[sector]||moduleLabel(sector)}
function turnoPrecisaIniciar(sector){const key=shiftKey();return state.shiftRestarts?.some(x=>x.shiftKey===key&&x.sector===sector)}
function turnoEncerrado(sector){const key=shiftKey();return state.closures.some(x=>x.shiftKey===key&&x.sector===sector)}
function botaoTurnoHtml(sector,id){if(turnoPrecisaIniciar(sector))return`<button class="btn success" id="${id}">Iniciar turno</button>`;if(turnoEncerrado(sector))return`<button class="btn subtle" id="${id}" disabled>Turno encerrado</button>`;return`<button class="btn subtle" id="${id}">Encerrar turno</button>`}
async function acaoBotaoTurno(sector){const key=shiftKey();if(turnoPrecisaIniciar(sector)){state.shiftRestarts=state.shiftRestarts.filter(x=>!(x.shiftKey===key&&x.sector===sector));log('INICIOU_TURNO',{sector,shiftKey:key},sector);await saveState(true);toast(`${setorLabel(sector)} iniciou o turno.`,'ok');PAGES[currentPage]?.render();return}await closeShift(sector)}
function renderReceiving(){const masters=[...cache.byMaster.entries()].map(([m,rows])=>masterSummary(m,rows));const pending=masters.filter(m=>m.received<m.total),received=masters.filter(m=>m.received===m.total);$('#content').innerHTML=head('Recebimento Operacional','Bipe a Master para confirmar a chegada em TZX',has('receiving.closeShift')?botaoTurnoHtml('receiving','closeReceiving'):'')+`<div class="kpi-grid">${kpi('Masters previstas',masters.length)}${kpi('Masters pendentes',pending.length)}${kpi('Masters recebidas',received.length)}${kpi('AWBs previstas',cache.records.length)}${kpi('AWBs recebidas',cache.records.filter(r=>r.receivedAt).length)}${kpi('Vencendo hoje',allNotes().filter(n=>n.promiseDate===new Date().toISOString().slice(0,10)).length)}${kpi('Recebidas no turno',cache.records.filter(r=>r.receivedShift===shiftKey()).length)}${kpi('Bases com pendência',uniq(cache.records.filter(r=>!r.receivedAt).map(r=>r.base)).length)}</div><div class="scan-box"><div class="scan-card"><input id="masterScan" class="scan-input" placeholder="BIPE OU DIGITE A MASTER" autofocus><div id="receivingResult" class="scan-result">Aguardando leitura da Master.</div></div></div><div class="panel"><div class="panel-head"><h3>Últimas Masters recebidas</h3>${has('receiving.download')?'<button class="btn subtle" id="receivingDownload">Baixar</button>':''}</div>${table([{label:'Master',key:'master'},{label:'Base',key:'base'},{label:'Notas',key:'notes'},{label:'AWBs',key:'total'},{label:'Recebida em',key:'at'},{label:'Operador',key:'operator'}],recentMasters())}</div>`;$('#masterScan').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();receiveMaster(e.target.value)}};if($('#closeReceiving')&&!$('#closeReceiving').disabled)$('#closeReceiving').onclick=()=>acaoBotaoTurno('receiving');if($('#receivingDownload'))$('#receivingDownload').onclick=()=>excelDownload('CCPB_Recebimento.xlsx',recentMasters())}
function recentMasters(){const map=new Map();state.records.filter(r=>r.receivedAt).sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt)).forEach(r=>{if(!map.has(r.master))map.set(r.master,{master:r.master,base:r.base,notes:uniq((cache.byMaster.get(norm(r.master))||[]).map(x=>x.note)).length,total:(cache.byMaster.get(norm(r.master))||[]).length,at:new Date(r.receivedAt).toLocaleString('pt-BR'),operator:r.receivedBy})});return[...map.values()].slice(0,100)}
async function receiveMaster(value){const master=norm(value),rows=cache.byMaster.get(master);if(!rows){toast('Master não localizada nos lançamentos da Torre.','error');$('#receivingResult').innerHTML='<b>MASTER NÃO LOCALIZADA</b>';return}const pending=rows.filter(r=>!r.receivedAt);if(!pending.length){toast('Master já recebida.','error');return}const ts=new Date().toISOString();pending.forEach(r=>{r.receivedAt=ts;r.receivedBy=session.operator;r.receivedUser=session.user.username;r.receivedShift=shiftKey();r.status='RECEIVED'});await saveState(true);const ms=masterSummary(master,rows),today=new Date().toISOString().slice(0,10),urgent=uniq(rows.filter(r=>r.promiseDate===today).map(r=>r.note));$('#receivingResult').innerHTML=`<h3>${ms.master}</h3><p>Base: <b>${ms.bases.join(', ')}</b> | Notas: <b>${ms.notes.length}</b> | AWBs recebidas: <b>${pending.length}</b></p>${urgent.length?`<p class="status danger">Atenção: ${urgent.length} Nota(s) vencem hoje.</p>`:''}`;log('RECEBEU_MASTER',{master:ms.master,awbs:pending.length,notes:ms.notes.length,bases:ms.bases},'receiving');toast(`${pending.length} AWBs recebidas em TZX.`,'ok');$('#masterScan').value='';setTimeout(renderReceiving,900)}

let triagePending=null;
function renderTriage(){const notes=allNotes();$('#content').innerHTML=head('Triagem Operacional','Bipe a AWB e confirme a posição correta',has('triage.closeShift')?botaoTurnoHtml('triage','closeTriage'):'')+`<div class="kpi-grid">${kpi('AWBs recebidas',cache.records.filter(r=>r.receivedAt).length)}${kpi('AWBs triadas',cache.records.filter(r=>r.triagedAt).length)}${kpi('Pendentes de triagem',cache.records.filter(r=>r.receivedAt&&!r.triagedAt).length)}${kpi('Notas completas',notes.filter(n=>n.status==='Aguardando Assistente').length)}</div><div class="scan-box"><div class="scan-card"><input id="awbScan" class="scan-input" placeholder="BIPE A AWB" autofocus><div id="triageResult" class="scan-result">Aguardando leitura da AWB.</div><button id="removeBtn" class="btn success hidden" style="margin-top:12px">Retirar Nota com código do Assistente</button></div></div><div id="completeAlerts" class="panel"><div class="panel-head"><h3>Notas completas aguardando Assistente</h3></div><div class="panel-body note-cards">${notes.filter(n=>n.status==='Aguardando Assistente').map(noteCard).join('')||'Nenhuma Nota completa.'}</div></div>`;$('#awbScan').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();startTriage(e.target.value)}};if($('#closeTriage')&&!$('#closeTriage').disabled)$('#closeTriage').onclick=()=>acaoBotaoTurno('triage');$('#removeBtn').onclick=()=>promptReleaseCode();$$('.note-card').forEach(x=>x.onclick=()=>openNoteModal(x.dataset.note,false,true))}
function startTriage(value){const awb=norm(value),r=cache.byAwb.get(awb);if(!r){toast('AWB não localizada.','error');return}if(!r.receivedAt){toast('AWB ainda não foi recebida em TZX.','error');return}if(r.releasedAt){toast('AWB já retirada.','error');return}const awbField=$('#awbScan');if(awbField){awbField.value=r.awb;awbField.readOnly=true;awbField.classList.add('locked-scan')}const rows=cache.byNote.get(norm(r.note)),ns=noteSummary(r.note,rows);triagePending={record:r,note:ns};if(!ns.position){openPositionAssign(r)}else{askPositionConfirm(r,ns.position)}}
function openPositionAssign(r){openModal('Cadastrar posição',`<p>A Nota <b>${r.note}</b> ainda não possui posição.</p><div class="form-grid"><label>Nota<input value="${r.note}" disabled></label><label>Posição<input id="newPosition" autofocus></label></div><div style="margin-top:14px;display:flex;gap:8px"><button class="btn primary" id="assignPosBtn">Cadastrar posição</button><button class="btn subtle" id="cancelAssignPos">Cancelar</button></div>`);$('#assignPosBtn').onclick=()=>assignPosition(r,$('#newPosition').value);$('#cancelAssignPos').onclick=()=>{closeModal();resetTriageScan()};$('#modalClose').onclick=()=>{closeModal();resetTriageScan()}}
async function assignPosition(r,code){code=norm(code);if(!code){toast('Informe a posição.','error');return}let p=state.positions.find(x=>norm(x.code)===code);if(!p){p={code,active:true,createdAt:new Date().toISOString(),createdBy:session.operator};state.positions.push(p)}const occupied=allNotes().find(n=>norm(n.position)===code&&n.note!==r.note&&n.status!=='Retirada');if(occupied&&!has('triage.multipleNotesPosition')){toast(`Posição ocupada pela Nota ${occupied.note}.`,'error');return}(cache.byNote.get(norm(r.note))||[]).forEach(x=>x.position=code);log('CADASTROU_POSICAO',{note:r.note,position:code},'triage');await saveState(true);closeModal();askPositionConfirm(r,code)}
function askPositionConfirm(r,position){$('#triageResult').innerHTML=`<h3>Nota ${r.note}</h3><p>Posição correta: <b>${position}</b></p><p>${noteSummary(r.note).triaged} de ${noteSummary(r.note).total} AWBs triadas.</p><input id="positionConfirm" class="scan-input" placeholder="BIPE A POSIÇÃO ${position}" autofocus><button id="cancelTriageStep" class="btn subtle" style="margin-top:10px">Cancelar leitura</button>`;$('#positionConfirm').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();confirmTriage(r,e.target.value,position)}};$('#cancelTriageStep').onclick=resetTriageScan}
async function confirmTriage(r,code,expected){if(norm(code)!==norm(expected)){toast(`Posição incorreta. Esperada: ${expected}`,'error');$('#positionConfirm').select();return}if(!r.triagedAt){r.triagedAt=new Date().toISOString();r.triagedBy=session.operator;r.triagedUser=session.user.username;r.triagedShift=shiftKey();r.status='TRIAGED';log('BIPOU_AWB',{awb:r.awb,note:r.note,master:r.master,position:expected},'triage');await saveState(true)}const ns=noteSummary(r.note);$('#triageResult').innerHTML=`<h3>AWB armazenada com sucesso</h3><p>Nota: <b>${r.note}</b> | Posição: <b>${expected}</b> | Progresso: <b>${ns.triaged}/${ns.total}</b></p>`;if(ns.triaged===ns.total){toast('Nota completa. Solicite a liberação ao Assistente.','ok');$('#removeBtn').classList.remove('hidden');$('#removeBtn').dataset.note=r.note}resetTriageScan();setTimeout(()=>$('#awbScan')?.focus(),250)}
function resetTriageScan(){const f=$('#awbScan');if(f){f.readOnly=false;f.classList.remove('locked-scan');f.value=''}triagePending=null}
function promptReleaseCode(){const note=$('#removeBtn').dataset.note;if(!note)return;openModal('Retirar Nota',`<p>Informe ou bipa o código gerado pelo Assistente para a Nota <b>${note}</b>.</p><input id="releaseInput" class="scan-input" autofocus><button id="releaseConfirm" class="btn success" style="margin-top:12px">Confirmar retirada</button>`);$('#releaseConfirm').onclick=()=>releaseNote(note,$('#releaseInput').value)}
async function releaseNote(note,code){const rel=state.releases.find(x=>x.note===note&&x.code===norm(code)&&!x.usedAt&&new Date(x.expiresAt)>new Date());if(!rel){toast('Código inválido ou expirado.','error');return}const rows=cache.byNote.get(norm(note))||[];if(rows.some(r=>!r.triagedAt)){toast('A Nota ainda possui AWBs pendentes.','error');return}const ts=new Date().toISOString();rows.forEach(r=>{r.releasedAt=ts;r.releasedBy=session.operator;r.releasedUser=session.user.username;r.status='RELEASED'});rel.usedAt=ts;rel.usedBy=session.operator;log('RETIROU_NOTA',{note,position:rows[0]?.position,code},'triage');await saveState(true);closeModal();toast('Nota retirada e posição liberada.','ok');renderTriage()}

function noteCard(n){return`<div class="note-card" data-note="${n.note}"><strong>${n.note}</strong><p>${n.triaged}/${n.total} triadas • ${n.missingReceipt} faltando receber</p><span class="status ${n.status==='Retirada'?'released':n.status==='Aguardando Assistente'?'complete':'pending'}">${n.status}</span></div>`}
function renderAssistant(){const notes=allNotes().filter(n=>n.received||n.triaged);$('#content').innerHTML=head('Assistente Operacional','Conferência das Notas e geração do código de liberação',has('assistant.closeShift')?botaoTurnoHtml('assistant','closeAssistant'):'')+`<div class="kpi-grid">${kpi('Notas em acompanhamento',notes.length)}${kpi('Notas completas',notes.filter(n=>n.triaged===n.total&&n.total).length)}${kpi('Aguardando complementos',notes.filter(n=>n.missingReceipt>0).length)}${kpi('AWBs pendentes',notes.reduce((s,n)=>s+n.missingTriage,0))}</div><div class="panel"><div class="filter-row"><input id="assistantSearch" placeholder="Pesquisar Nota, Master, Base ou FC"><select id="assistantStatus"><option value="">Todos os status</option>${uniq(notes.map(n=>n.status)).map(s=>`<option>${s}</option>`).join('')}</select></div><div id="assistantCards" class="panel-body note-cards">${notes.map(noteCard).join('')}</div></div>`;const refresh=()=>{const q=$('#assistantSearch').value.toLowerCase(),st=$('#assistantStatus').value;$('#assistantCards').innerHTML=notes.filter(n=>(!q||JSON.stringify(n).toLowerCase().includes(q))&&(!st||n.status===st)).map(noteCard).join('');$$('.note-card').forEach(x=>x.onclick=()=>openNoteModal(x.dataset.note,true))};$('#assistantSearch').oninput=refresh;$('#assistantStatus').onchange=refresh;refresh();if($('#closeAssistant')&&!$('#closeAssistant').disabled)$('#closeAssistant').onclick=()=>acaoBotaoTurno('assistant')}
function openNoteModal(note,assistantMode=false,triageMode=false){const n=noteSummary(note),rows=cache.byNote.get(norm(note))||[];const complete=n.triaged===n.total&&n.total>0&&n.missingReceipt===0;const alreadyReleased=rows.every(r=>r.releasedAt);const canRelease=assistantMode&&has('assistant.generateRelease')&&complete&&!alreadyReleased;const canWithdraw=triageMode&&has('triage.scanRelease')&&complete&&!alreadyReleased;const historyRows=state.logs.filter(l=>JSON.stringify(l.detail).includes(n.note)).slice(0,200).map(l=>({...l,moduleName:l.moduleName||moduleLabel(l.module),actionName:l.actionName||actionLabel(l.action),device:l.device||'Dispositivo não identificado',detailText:l.detailText||detailText(l)}));openModal(`Nota ${n.note}`,`<div class="kpi-grid">${kpi('Previstas',n.total)}${kpi('Recebidas',n.received)}${kpi('Triadas',n.triaged)}${kpi('Faltando receber',n.missingReceipt)}</div><div class="grid-2"><div class="panel-body"><p><b>Masters:</b> ${n.masters.join(' - ')}</p><p><b>Base:</b> ${n.bases.join(' - ')}</p><p><b>FC:</b> ${n.fcs.join(' - ')}</p><p><b>Data promessa:</b> ${dateBR(n.promiseDate)}</p><p><b>Posição:</b> ${n.position||'Não cadastrada'}</p><p><b>Status:</b> ${n.status}</p></div><div id="qrArea" class="panel-body" style="text-align:center"></div></div>${canRelease?'<button id="generateRelease" class="btn success">Gerar QR Code de liberação</button>':''}${canWithdraw?'<button id="withdrawFromCard" class="btn success" style="margin-top:10px">Retirar Nota com código do Assistente</button>':''}${assistantMode||triageMode?'':`<div class="panel"><div class="panel-head"><h3>Histórico da Nota</h3></div>${table([{label:'Data',key:'date'},{label:'Hora',key:'time'},{label:'Operador',key:'operator'},{label:'Módulo',key:'moduleName'},{label:'Movimentação',key:'actionName'},{label:'Dispositivo',key:'device'},{label:'Detalhes',key:'detailText'}],historyRows)}</div>`}`);if($('#generateRelease'))$('#generateRelease').onclick=()=>generateRelease(n.note);if($('#withdrawFromCard'))$('#withdrawFromCard').onclick=()=>{closeModal();$('#removeBtn').dataset.note=n.note;promptReleaseCode()}}
async function generateRelease(note){const code=Math.random().toString(36).slice(2,10).toUpperCase();const rel={id:crypto.randomUUID(),note,code,createdAt:new Date().toISOString(),createdBy:session.operator,expiresAt:new Date(Date.now()+20*60*1000).toISOString()};state.releases.push(rel);log('GEROU_CODIGO_LIBERACAO',{note,code,expiresAt:rel.expiresAt},'assistant');await saveState(true);$('#qrArea').innerHTML=`<div id="qr"></div><h2>${code}</h2><small>Válido por 20 minutos</small>`;if(window.QRCode)new QRCode($('#qr'),{text:code,width:180,height:180});toast('Código de liberação gerado.','ok')}

function renderLeadership(){const notes=allNotes(),masters=[...cache.byMaster.entries()].map(([m,r])=>masterSummary(m,r));$('#content').innerHTML=head('Painel Operacional','Recebimento, triagem, complementos, posições e fechamento dos turnos',has('leadership.archiveShift')?'<button class="btn danger" id="archiveBtn">Arquivar turno concluído</button>':'')+`<div class="kpi-grid">${kpi('AWBs a caminho',cache.records.filter(r=>!r.receivedAt).length)}${kpi('AWBs recebidas',cache.records.filter(r=>r.receivedAt).length)}${kpi('AWBs triadas',cache.records.filter(r=>r.triagedAt).length)}${kpi('Masters pendentes',masters.filter(m=>m.received<m.total).length)}${kpi('Notas totais',notes.length)}${kpi('Notas completas',notes.filter(n=>n.triaged===n.total&&n.total).length)}${kpi('Aguardando complementos',notes.filter(n=>n.missingReceipt>0&&n.position).length)}${kpi('Notas retiradas',notes.filter(n=>n.status==='Retirada').length)}${kpi('Posições ocupadas',notes.filter(n=>n.position&&n.status!=='Retirada').length)}${kpi('Posições livres',Math.max(0,state.positions.filter(p=>p.active).length-notes.filter(n=>n.position&&n.status!=='Retirada').length))}${kpi('Vencendo hoje',notes.filter(n=>n.promiseDate===new Date().toISOString().slice(0,10)&&n.status!=='Retirada').length)}${kpi('Notas vencidas',notes.filter(n=>n.promiseDate&&n.promiseDate<new Date().toISOString().slice(0,10)&&n.status!=='Retirada').length)}</div>${has('leadership.charts')?`<div class="grid-3"><div class="panel"><div class="panel-head"><h3>Fluxo de AWBs</h3></div><div class="panel-body chart-wrap"><canvas id="leadFlow"></canvas></div></div><div class="panel"><div class="panel-head"><h3>Notas por situação</h3></div><div class="panel-body chart-wrap"><canvas id="leadNotes"></canvas></div></div><div class="panel"><div class="panel-head"><h3>AWBs por base</h3></div><div class="panel-body chart-wrap"><canvas id="leadBases"></canvas></div></div></div>`:''}<div class="panel"><div class="panel-head"><h3>Relação geral por Nota</h3>${has('leadership.download')?'<button class="btn subtle" id="leadDownload">Baixar</button>':''}</div>${filterBar(LEAD_COLS,'lead')}${table(LEAD_COLS,notes,'leadTable')}</div><div class="panel"><div class="panel-head"><h3>Fechamento dos setores no turno atual</h3></div><div class="panel-body">${closureStatusHtml()}</div></div>`;bindColumnFilters('lead',LEAD_COLS,notes,5000);$$('#leadTable tbody tr').forEach((tr,i)=>tr.onclick=()=>openNoteModal(notes[i]?.note,false));if($('#leadDownload'))$('#leadDownload').onclick=()=>excelDownload('CCPB_Relacao_Notas.xlsx',notes.map(exportNote));if($('#archiveBtn'))$('#archiveBtn').onclick=archiveShift;if(has('leadership.charts'))drawLeadership(notes)}
const
LEAD_COLS=[{label:'Nota',key:'note'},{label:'Master(s)',key:'masters',render:n=>n.masters.join(', ')},{label:'Base',key:'bases',render:n=>n.bases.join(', ')},{label:'FC',key:'fcs',render:n=>n.fcs.join(', ')},{label:'Previstas',key:'total'},{label:'Recebidas',key:'received'},{label:'Triadas',key:'triaged'},{label:'Faltando receber',key:'missingReceipt'},{label:'Pendentes triagem',key:'missingTriage'},{label:'%',key:'pct',render:n=>`${n.pct}%`},{label:'Posição',key:'position'},{label:'Data promessa',key:'promiseDate',render:n=>dateBR(n.promiseDate)},{label:'Status',key:'status',render:n=>`<span class="status ${n.status==='Retirada'?'released':n.status==='Aguardando Assistente'?'complete':'pending'}">${n.status}</span>`}];
function exportNote(n){return{Nota:n.note,Masters:n.masters.join(', '),Base:n.bases.join(', '),FC:n.fcs.join(', '),Previstas:n.total,Recebidas:n.received,Triadas:n.triaged,'Faltando receber':n.missingReceipt,'Pendentes triagem':n.missingTriage,Percentual:`${n.pct}%`,Posição:n.position,'Data Promessa':dateBR(n.promiseDate),Status:n.status}}
function drawLeadership(notes){destroyChart('leadFlow');charts.leadFlow=new Chart($('#leadFlow'),{type:'bar',data:{labels:['Lançadas','Recebidas','Triadas','Retiradas'],datasets:[{data:[cache.records.length,cache.records.filter(r=>r.receivedAt).length,cache.records.filter(r=>r.triagedAt).length,cache.records.filter(r=>r.releasedAt).length],backgroundColor:['#6b7280','#2f5bc4','#7c3aed','#16a34a']}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}});const st={};notes.forEach(n=>st[n.status]=(st[n.status]||0)+1);destroyChart('leadNotes');charts.leadNotes=new Chart($('#leadNotes'),{type:'doughnut',data:{labels:Object.keys(st),datasets:[{data:Object.values(st)}]},options:{responsive:true,maintainAspectRatio:false}});const b={};cache.records.forEach(r=>b[r.base]=(b[r.base]||0)+1);destroyChart('leadBases');charts.leadBases=new Chart($('#leadBases'),{type:'bar',data:{labels:Object.keys(b).slice(0,20),datasets:[{data:Object.values(b).slice(0,20),backgroundColor:'#d71920'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}})}
function closureStatusHtml(){const key=shiftKey(),sectors=['receiving','triage','assistant'];return sectors.map(s=>{const c=state.closures.find(x=>x.shiftKey===key&&x.sector===s);const reinicio=turnoPrecisaIniciar(s);return`<span class="status ${c?'complete':'pending'}" style="margin-right:8px">${setorLabel(s)}: ${c?'encerrado por '+c.operator:reinicio?'aguardando início':'aberto'}</span>`}).join('')}
async function closeShift(sector){const key=shiftKey();if(state.closures.some(x=>x.shiftKey===key&&x.sector===sector)){toast('Este setor já encerrou o turno.','error');return}openModal('Confirmar encerramento do turno',`<p>Digite sua senha para encerrar o <b>${key}</b>.</p><input id="shiftPassword" type="password" class="scan-input" placeholder="Senha do usuário" autofocus><button id="confirmShiftClose" class="btn danger" style="margin-top:12px">Confirmar encerramento</button>`);$('#confirmShiftClose').onclick=async()=>{if($('#shiftPassword').value!==session.user.password){toast('Senha incorreta.','error');$('#shiftPassword').select();return}state.closures.push({id:crypto.randomUUID(),shiftKey:key,sector,at:new Date().toISOString(),operator:session.operator,user:session.user.username});log('ENCERROU_TURNO',{sector,shiftKey:key},sector);await saveState(true);closeModal();toast('Turno encerrado e liderança notificada.','ok')}}
async function archiveShift(){const key=shiftKey(),needed=['receiving','triage','assistant'];const missing=needed.filter(s=>!state.closures.some(x=>x.shiftKey===key&&x.sector===s));if(missing.length){toast(`Aguardando encerramento: ${missing.map(setorLabel).join(', ')}`,'error');return}const releasable=state.records.filter(r=>r.releasedAt&&r.receivedAt&&r.triagedAt);if(!releasable.length){toast('Não há registros totalmente concluídos para arquivar.','error');return}if(!confirm(`Arquivar ${releasable.length} AWBs concluídas do ${shiftOf()}?`))return;state.archives.push({id:crypto.randomUUID(),shiftKey:key,at:new Date().toISOString(),expiresAt:new Date(Date.now()+ARCHIVE_RETENTION_DAYS*24*60*60*1000).toISOString(),operator:session.operator,user:session.user.username,records:releasable});const ids=new Set(releasable.map(r=>r.id));state.records=state.records.filter(r=>!ids.has(r.id));state.closures=state.closures.filter(c=>c.shiftKey!==key);state.shiftRestarts=state.shiftRestarts||[];needed.forEach(sector=>{if(!state.shiftRestarts.some(x=>x.shiftKey===key&&x.sector===sector))state.shiftRestarts.push({shiftKey:key,sector,createdAt:new Date().toISOString()})});rebuildCache();log('ARQUIVOU_TURNO',{shiftKey:key,records:releasable.length},'leadership');await saveState(true);toast('Registros concluídos arquivados por 30 dias. Os setores devem iniciar o novo ciclo do turno.','ok');renderLeadership()}

function renderPositions(){const rows=allNotes().filter(n=>n.position&&n.status!=='Retirada');$('#content').innerHTML=head('Posições e Complementos','Visão atual das Notas armazenadas e dos complementos ainda pendentes',has('leadership.download')?'<button class="btn subtle" id="posDownload">Baixar relação</button>':'')+`<div class="kpi-grid">${kpi('Posições ocupadas',rows.length)}${kpi('AWBs nas posições',rows.reduce((s,n)=>s+n.triaged,0))}${kpi('Faltando receber',rows.reduce((s,n)=>s+n.missingReceipt,0))}${kpi('Pendentes de triagem',rows.reduce((s,n)=>s+n.missingTriage,0))}</div><div class="panel">${filterBar(POS_COLS,'pos')}${table(POS_COLS,rows,'posTable')}</div>`;bindColumnFilters('pos',POS_COLS,rows,5000);if($('#posDownload'))$('#posDownload').onclick=()=>excelDownload('CCPB_Posicoes_Complementos.xlsx',rows.map(exportNote))}
const POS_COLS=[{label:'Posição',key:'position'},{label:'Nota',key:'note'},{label:'Master(s)',key:'masters',render:n=>n.masters.join(', ')},{label:'Base',key:'bases',render:n=>n.bases.join(', ')},{label:'FC',key:'fcs',render:n=>n.fcs.join(', ')},{label:'Previstas',key:'total'},{label:'Recebidas',key:'received'},{label:'Triadas',key:'triaged'},{label:'Faltando receber',key:'missingReceipt'},{label:'Pendentes triagem',key:'missingTriage'},{label:'Data promessa',key:'promiseDate',render:n=>dateBR(n.promiseDate)},{label:'Status',key:'status'}];

function renderHistory(){const rows=state.logs.slice(0,5000).map(l=>({...l,moduleName:l.moduleName||moduleLabel(l.module),actionName:l.actionName||actionLabel(l.action),device:l.device||'Dispositivo não identificado',detailText:l.detailText||detailText(l)}));const cols=[{label:'Data',key:'date'},{label:'Hora',key:'time'},{label:'Operador',key:'operator'},{label:'Login',key:'username'},{label:'Classificação',key:'role'},{label:'Módulo',key:'moduleName'},{label:'Movimentação',key:'actionName'},{label:'Dispositivo',key:'device'},{label:'Detalhes',key:'detailText'}];$('#content').innerHTML=head('Histórico de Movimentações','Registro de login, importações, recebimentos, bipagens, posições, liberações e turnos',has('history.download')?'<button class="btn subtle" id="historyDownload">Baixar histórico</button>':'')+`<div class="panel">${filterBar(cols,'hist')}${table(cols,rows,'histTable')}</div>`;bindColumnFilters('hist',cols,rows,5000);if($('#historyDownload'))$('#historyDownload').onclick=()=>excelDownload('CCPB_Historico.xlsx',rows.map(r=>({Data:r.date,Hora:r.time,Operador:r.operator,Login:r.username,Classificação:r.role,Módulo:r.moduleName,Movimentação:r.actionName,Dispositivo:r.device,Detalhes:r.detailText})))}

const escapeHtml=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function renderAdmin(){
  if(session.user.role!=='admin'&&!has('view.admin'))return;
  $('#content').innerHTML=head('Administração do Sistema','Somente configurações, usuários, permissões e auditoria')+`<div class="admin-tabs"><button data-tab="users" class="active">Usuários</button><button data-tab="permissions">Catálogo de permissões</button><button data-tab="sectors">Configuração dos setores</button><button data-tab="positions">Posições</button><button data-tab="history">Histórico geral</button><button data-tab="firebase">Firebase / Pages</button><button data-tab="clear">Limpeza total</button></div><div id="adminBody"></div>`;
  $$('.admin-tabs button').forEach(b=>b.onclick=()=>{$$('.admin-tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderAdminTab(b.dataset.tab)});
  renderAdminTab('users');
}

function renderAdminTab(tab){if(tab==='users')adminUsers();if(tab==='permissions')adminPermissions();if(tab==='sectors')adminSectors();if(tab==='positions')adminPositions();if(tab==='history')adminHistory();if(tab==='firebase')adminFirebase();if(tab==='clear')adminClear()}
function adminUsers(){const rows=state.users.map(u=>({...u,roleName:roleLabel(u.role)}));$('#adminBody').innerHTML=`<div class="panel"><div class="panel-head"><h3>Cadastro de usuários</h3><button class="btn primary" id="newUser">Novo usuário</button></div>${table([{label:'Usuário',key:'username'},{label:'Classificação',key:'name'},{label:'Perfil',key:'roleName'},{label:'Ativo',key:'active',render:u=>u.active?'Sim':'Não'},{label:'Exige nome',key:'requireOperator',render:u=>u.requireOperator?'Sim':'Não'},{label:'Permissões',key:'permissions',render:u=>u.permissions.length},{label:'Ações',key:'actions',render:u=>`<button class="btn subtle user-edit" data-user="${u.username}">Editar</button>`}],rows)}</div>`;$('#newUser').onclick=()=>userModal();$$('.user-edit').forEach(b=>b.onclick=()=>userModal(state.users.find(u=>u.username===b.dataset.user)))}
function userModal(user=null){const u=user||{username:'',password:'',name:'',role:'tower',active:true,permissions:[],requireOperator:true};openModal(user?'Editar usuário':'Novo usuário',`<div class="form-grid"><label>Usuário<input id="uUser" value="${u.username}"></label><label>Senha<input id="uPass" value="${u.password}"></label><label>Nome da classificação<input id="uName" value="${u.name}"></label><label>Perfil sugerido<select id="uRole">${Object.keys(ROLE_PRESETS).map(r=>`<option value="${r}" ${u.role===r?'selected':''}>${roleLabel(r)}</option>`).join('')}</select></label><label><input id="uActive" type="checkbox" ${u.active?'checked':''}> Usuário ativo</label><label><input id="uOperator" type="checkbox" ${u.requireOperator?'checked':''}> Exigir nome do operador</label></div><h3>Permissões individuais</h3><div class="permission-grid">${PERMISSIONS.map(p=>`<label class="check-card"><input type="checkbox" data-perm="${p}" ${u.permissions.includes(p)?'checked':''}> ${permissionLabel(p)}</label>`).join('')}</div><button id="saveUser" class="btn primary" style="margin-top:15px">Salvar usuário</button>`);$('#uRole').onchange=()=>{$$('[data-perm]').forEach(x=>x.checked=ROLE_PRESETS[$('#uRole').value].includes(x.dataset.perm))};$('#saveUser').onclick=async()=>{const username=$('#uUser').value.trim();if(!username||!$('#uPass').value){toast('Informe usuário e senha.','error');return}const obj={username,password:$('#uPass').value,name:$('#uName').value.trim()||username,role:$('#uRole').value,active:$('#uActive').checked,requireOperator:$('#uOperator').checked,permissions:$$('[data-perm]').filter(x=>x.checked).map(x=>x.dataset.perm)};const i=state.users.findIndex(x=>x.username===u.username);if(i>=0)state.users[i]=obj;else if(state.users.some(x=>x.username===username)){toast('Usuário já existe.','error');return}else state.users.push(obj);log('SALVOU_USUARIO',{username,permissions:obj.permissions.length},'admin');await saveState(true);closeModal();adminUsers();toast('Usuário salvo.','ok')}}
function adminPermissions(){$('#adminBody').innerHTML=`<div class="panel"><div class="panel-head"><h3>Catálogo geral de permissões</h3><span>${PERMISSIONS.length} opções disponíveis para qualquer usuário</span></div><div class="panel-body permission-grid">${PERMISSIONS.map(p=>`<div class="check-card"><b>${permissionLabel(p)}</b></div>`).join('')}</div></div>`}
function adminSectors(){const sectors=['tower','receiving','triage','assistant','leadership','history'];$('#adminBody').innerHTML=`<div class="panel"><div class="panel-head"><h3>Configuração das telas e funcionalidades</h3></div><div class="panel-body"><div class="form-grid">${sectors.map(s=>`<button class="btn subtle sector-config" data-sector="${s}">${PAGES[s]?.title||s}</button>`).join('')}</div></div></div>`;$$('.sector-config').forEach(b=>b.onclick=()=>sectorModal(b.dataset.sector))}
function sectorModal(sector){const cfg=state.config.sector[sector]||{};const related=PERMISSIONS.filter(p=>p.startsWith(sector+'.')||p===`view.${sector}`||(sector==='leadership'&&p.startsWith('leadership.')));openModal(`Configurar ${PAGES[sector]?.title||sector}`,`<div class="form-grid"><label>Título<input id="secTitle" value="${cfg.title||PAGES[sector]?.title||sector}"></label><label>Subtítulo<input id="secSubtitle" value="${cfg.subtitle||PAGES[sector]?.subtitle||''}"></label></div><h3>Funcionalidades disponíveis para liberação</h3><div class="permission-grid">${related.map(p=>`<label class="check-card"><input type="checkbox" data-secperm="${p}" ${cfg.available?.includes(p)||cfg.available===undefined?'checked':''}> ${permissionLabel(p)}</label>`).join('')}</div><button id="saveSector" class="btn primary" style="margin-top:15px">Salvar configuração</button>`);$('#saveSector').onclick=async()=>{state.config.sector[sector]={title:$('#secTitle').value,subtitle:$('#secSubtitle').value,available:$$('[data-secperm]').filter(x=>x.checked).map(x=>x.dataset.secperm)};log('ALTEROU_CONFIGURACAO_SETOR',{sector},'admin');await saveState(true);closeModal();toast('Configuração salva.','ok')}}
function adminPositions(){$('#adminBody').innerHTML=`<div class="panel"><div class="panel-head"><h3>Posições cadastradas</h3><button class="btn primary" id="addPosition">Adicionar posição</button></div>${table([{label:'Código',key:'code'},{label:'Ativa',key:'active',render:p=>p.active?'Sim':'Não'},{label:'Nota atual',key:'note',render:p=>allNotes().find(n=>n.position===p.code&&n.status!=='Retirada')?.note||'Livre'},{label:'Ações',key:'actions',render:p=>`<button class="btn subtle pos-edit" data-code="${p.code}">Editar</button> <button class="btn danger pos-delete" data-code="${p.code}">Excluir</button>`}],state.positions)}</div>`;$('#addPosition').onclick=()=>positionModal();$$('.pos-edit').forEach(b=>b.onclick=()=>positionModal(state.positions.find(p=>p.code===b.dataset.code)));$$('.pos-delete').forEach(b=>b.onclick=()=>deletePosition(b.dataset.code))}
function positionModal(p=null){openModal(p?'Editar posição':'Nova posição',`<div class="form-grid"><label>Código<input id="pCode" value="${p?.code||''}"></label><label><input id="pActive" type="checkbox" ${p?.active!==false?'checked':''}> Posição ativa</label></div><button id="savePos" class="btn primary">Salvar</button>`);$('#savePos').onclick=async()=>{const code=norm($('#pCode').value);if(!code){toast('Informe o código.','error');return}if(p)p.code=code,p.active=$('#pActive').checked;else if(state.positions.some(x=>x.code===code)){toast('Posição já existe.','error');return}else state.positions.push({code,active:$('#pActive').checked,createdAt:new Date().toISOString(),createdBy:session.operator});log('SALVOU_POSICAO',{code},'admin');await saveState(true);closeModal();adminPositions()}}
async function deletePosition(code){const occupied=allNotes().find(n=>n.position===code&&n.status!=='Retirada');if(occupied){toast(`Posição ocupada pela Nota ${occupied.note}.`,'error');return}if(!confirm(`Excluir posição ${code}?`))return;state.positions=state.positions.filter(p=>p.code!==code);log('EXCLUIU_POSICAO',{code},'admin');await saveState(true);adminPositions()}
function adminHistory(){const rows=state.logs.slice(0,5000).map(l=>({...l,moduleName:l.moduleName||moduleLabel(l.module),actionName:l.actionName||actionLabel(l.action),device:l.device||'Dispositivo não identificado',detailText:l.detailText||detailText(l)}));$('#adminBody').innerHTML=`<div class="panel"><div class="panel-head"><h3>Histórico geral</h3></div>${table([{label:'Data',key:'date'},{label:'Hora',key:'time'},{label:'Operador',key:'operator'},{label:'Login',key:'username'},{label:'Classificação',key:'role'},{label:'Módulo',key:'moduleName'},{label:'Movimentação',key:'actionName'},{label:'Dispositivo',key:'device'},{label:'Detalhes',key:'detailText'}],rows)}</div>`}
function adminFirebase(){const f=state.config.firebase;$('#adminBody').innerHTML=`<div class="panel"><div class="panel-head"><h3>Firebase Realtime Database / publicação no Pages</h3></div><div class="panel-body"><p>Informe a URL do Realtime Database. As regras do projeto devem permitir o acesso autorizado pelo token configurado.</p><div class="form-grid"><label>Database URL<input id="fbUrl" value="${f.databaseURL||''}" placeholder="https://seu-projeto-default-rtdb.firebaseio.com"></label><label>Token opcional<input id="fbToken" value="${f.authToken||''}"></label><label><input id="fbEnabled" type="checkbox" ${f.enabled?'checked':''}> Ativar sincronização</label></div><button id="saveFirebase" class="btn primary">Salvar e testar</button></div></div>`;$('#saveFirebase').onclick=async()=>{state.config.firebase={enabled:$('#fbEnabled').checked,databaseURL:$('#fbUrl').value.trim().replace(/\/$/,''),authToken:$('#fbToken').value.trim()};await saveState(true);const ok=await firebaseTest();toast(ok?'Firebase conectado.':'Não foi possível conectar ao Firebase.',ok?'ok':'error')}}
function adminClear(){$('#adminBody').innerHTML=`<div class="panel"><div class="panel-head"><h3>Limpeza completa do sistema</h3></div><div class="panel-body"><p>Apaga dados operacionais, histórico, posições, liberações e fechamentos. Os usuários e configurações podem ser mantidos.</p><label><input id="keepUsers" type="checkbox" checked> Manter usuários e configurações</label><br><button id="clearAll" class="btn danger" style="margin-top:15px">Limpar 100% do sistema</button></div></div>`;$('#clearAll').onclick=async()=>{if(!confirm('Tem certeza? Esta ação não pode ser desfeita.'))return;const users=$('#keepUsers').checked?state.users:DEFAULT_USERS,config=$('#keepUsers').checked?state.config:emptyState().config;state=emptyState();state.users=users;state.config=config;rebuildCache();await saveState(true);log('LIMPEZA_TOTAL',{},'admin');toast('Sistema limpo.','ok');adminClear()}}

function openModal(title,body){$('#modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h3>${title}</h3><button id="modalClose" class="icon-btn">×</button></div><div class="modal-body">${body}</div></div></div>`;$('#modalClose').onclick=closeModal}
function closeModal(){$('#modalRoot').innerHTML=''}
function setTVMode(active){document.body.classList.toggle('tv-mode',active);if(!active){document.body.classList.toggle('single-screen',Boolean(PAGES[currentPage]?.single&&session?.user?.role!=='admin'));if($('#sidebar'))$('#sidebar').classList.remove('open')}}function toggleTV(){const active=!document.body.classList.contains('tv-mode');setTVMode(active);if(active)document.documentElement.requestFullscreen?.().catch(()=>{});else if(document.fullscreenElement)document.exitFullscreen?.()}document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)setTVMode(false)})
function globalSearch(){openModal('Busca universal',`<input id="globalSearch" class="scan-input" placeholder="Master, Nota ou AWB" autofocus><div id="globalResults" style="margin-top:15px"></div>`);$('#globalSearch').oninput=e=>{const q=norm(e.target.value);if(!q){$('#globalResults').innerHTML='';return}const r=cache.records.filter(x=>norm(x.awb).includes(q)||norm(x.note).includes(q)||norm(x.master).includes(q)).slice(0,200);$('#globalResults').innerHTML=table(TOWER_COLS,r)}}

async function firebasePush(){

    const f = state?.config?.firebase;

    if(!f?.enabled) return false;
    if(!f.databaseURL) return false;
    if(!navigator.onLine) return false;

    const base = String(f.databaseURL).replace(/\/$/,'');
    const auth = f.authToken ? `?auth=${encodeURIComponent(f.authToken)}` : '';

    async function salvar(path,data){

        const resp = await fetch(
            `${base}/ccpb/${path}.json${auth}`,
            {
                method:'PUT',
                headers:{
                    'Content-Type':'application/json'
                },
                body:JSON.stringify(data)
            }
        );

        if(!resp.ok){
            throw new Error(`Firebase ${path}: ${resp.status}`);
        }

    }

    await salvar('version',state.version);
    await salvar('updatedAt',state.updatedAt);
    await salvar('config',state.config);
    await salvar('users',state.users);
    await salvar('positions',state.positions);
    await salvar('closures',state.closures);
    await salvar('shiftRestarts',state.shiftRestarts);
    await salvar('releases',state.releases);
    await salvar('archives',state.archives);

    // LOGS LIMITADOS
    await salvar('logs',state.logs.slice(0,1000));

    // REGISTROS
    await salvar('records',state.records);

    return true;
}

async function firebasePull(){

    if(!state) return false;

    const f = state?.config?.firebase;

    if(!f?.enabled) return false;
    if(!f.databaseURL) return false;
    if(!navigator.onLine) return false;

    const base = String(f.databaseURL).replace(/\/$/,'');
    const auth = f.authToken ? `?auth=${encodeURIComponent(f.authToken)}` : '';

    async function ler(path){

        const resp = await fetch(`${base}/ccpb/${path}.json${auth}`);

        if(!resp.ok){
            return null;
        }

        return await resp.json();

    }

    const remote = {
        version: await ler('version'),
        updatedAt: await ler('updatedAt'),
        config: await ler('config'),
        users: await ler('users'),
        records: await ler('records'),
        positions: await ler('positions'),
        closures: await ler('closures'),
        shiftRestarts: await ler('shiftRestarts'),
        releases: await ler('releases'),
        archives: await ler('archives'),
        logs: await ler('logs')
    };

    if(!remote.updatedAt){
        return false;
    }

    if(Number(remote.updatedAt) <= Number(state.updatedAt)){
        return false;
    }

    state = ensureStateShape(remote);

    cleanupExpiredArchives();

    rebuildCache();

    await saveLocalState();

    if(session){

        const freshUser = state.users.find(
            u => u.username === session.user.username && u.active
        );

        if(freshUser){
            session.user = freshUser;
        }

    }

    if(currentPage){
        PAGES[currentPage]?.render();
    }

    return true;

}
async function firebaseTest(){try{const ok=await firebasePush();if(ok)console.log('CCPB sincronizado com Firebase.');return ok}catch(e){console.error(e);return false}}

let inactivityTimer=null;const INACTIVITY_MS=10*60*1000;function resetInactivity(){if(!session)return;clearTimeout(inactivityTimer);inactivityTimer=setTimeout(()=>{if(session){log('LOGOUT',{motivo:'Inatividade de 10 minutos'},'auth');toast('Sessão encerrada por inatividade.','error');logout()}},INACTIVITY_MS)}function startInactivityWatch(){['click','keydown','touchstart','pointerdown','scroll'].forEach(ev=>document.addEventListener(ev,resetInactivity,{passive:true}));resetInactivity()}
async function init(){loginFlows();state=await loadState();if(!state.users?.length)state.users=DEFAULT_USERS;state.users.forEach(u=>{u.permissions=Array.isArray(u.permissions)?u.permissions:[];if(u.role==='admin')u.permissions=[...PERMISSIONS];if(u.role==='triage'&&!u.permissions.includes('triage.multipleNotesPosition'))u.permissions.push('triage.multipleNotesPosition')});if(!state.records)state.records=[];if(!state.positions)state.positions=[];if(!state.logs)state.logs=[];if(!state.shiftRestarts)state.shiftRestarts=[];if(!state.config)state.config=emptyState().config;rebuildCache();$('#loginForm').onsubmit=login;$('#logoutBtn').onclick=logout;$('#menuBtn').onclick=()=>$('#sidebar').classList.toggle('open');$('#tvBtn').onclick=toggleTV;$('#globalSearchBtn').onclick=globalSearch;startInactivityWatch();$('#towerFile').onchange=e=>{const f=e.target.files[0];e.target.value='';importTower(f)};addEventListener('online',onlineUpdate);addEventListener('offline',onlineUpdate);onlineUpdate();setInterval(()=>{$('#shiftBadge').textContent=shiftOf();firebasePull().catch(e=>console.error('Falha ao atualizar Firebase:',e))},3000);if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    fetch('./service-worker.js', { method: 'HEAD' })
        .then(r => {
            if (r.ok) {
                return navigator.serviceWorker.register('./service-worker.js');
            }
        })
        .catch(() => {});
const saved=JSON.parse(sessionStorage.getItem('ccpb_session')||'null');if(saved){const user=state.users.find(u=>u.username===saved.username&&u.active);if(user){session={user,operator:saved.operator||user.name};enterApp()}}setTimeout(()=>{$('#splash').classList.add('hidden');if(!session)$('#loginView').classList.remove('hidden')},700)}
init().catch(e=>{console.error(e);alert('Falha ao iniciar o CCPB: '+e.message)});