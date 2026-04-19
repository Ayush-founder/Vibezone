/* ══════════════════════════════════════════
   VibeZone — app.js
   • No password required to add music
   • Full song customization (cover, name, artist)
   • All data saved to localStorage (profile + songs metadata + liked)
══════════════════════════════════════════ */

/* ══ PALETTE ══ */
const PALS=[['#12050d','#e91e8c'],['#050c15','#1565c0'],['#0f0505','#c62828'],['#060f05','#2e7d32'],['#09051a','#7b1fa2'],['#0f0a04','#e65100'],['#041009','#00695c'],['#0c0606','#8b2500'],['#080812','#5e35b1'],['#110514','#ad1457']];
function pal(i){return PALS[i%PALS.length];}
function fmt(s){if(!s||isNaN(s)||!isFinite(s))return'0:00';const m=Math.floor(s/60),sec=Math.floor(s%60);return`${m}:${String(sec).padStart(2,'0')}`;}
function toName(f){return f.replace(/\.[^.]+$/,'').replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}
function ini(s){return(s.name||'').slice(0,2).toUpperCase();}

/* ══ STATE ══ */
let userProfile = { name:'', avatarUrl:'' };
let songs=[], currentIdx=-1, isPlaying=false, isShuffle=false, isRepeat=false;
let ctxTarget=-1, searchQ='', activeChip='all';
let pendingFiles=[], pendingFileIdx=0;
let currentSongImgUrl='';
let editSongImgUrl=''; // for song edit modal
let editSongIdx=-1;
let audioEl=new Audio(); audioEl.crossOrigin='anonymous';
let actx=null,srcNode=null,gainNode=null,bassNode=null,lofiFilter=null,convolverNode=null,dryGain=null,wetGain=null,pannerNode=null;
let activeFx={slowed:false,reverb:false,bassboost:false,nightcore:false,lofi:false,'8d':false,vinyl:false};
let fxVals={spd:1.0,bass:0,rvb:0,vol:0.8};
let panInterval=null;

/* ══ LOCALSTORAGE HELPERS ══ */
const LS_PROFILE = 'vz_profile';
const LS_SONGS   = 'vz_songs_meta';

function saveProfile(){
  try{ localStorage.setItem(LS_PROFILE, JSON.stringify(userProfile)); } catch(e){}
}
function loadProfile(){
  try{
    const d = localStorage.getItem(LS_PROFILE);
    if(d) userProfile = JSON.parse(d);
  } catch(e){}
}
// Save only song metadata (not blob URLs — those are session only)
function saveSongsMeta(){
  try{
    const meta = songs.map(s=>({ name:s.name, artist:s.artist, liked:s.liked, dur:s.dur }));
    localStorage.setItem(LS_SONGS, JSON.stringify(meta));
  } catch(e){}
}

/* ══ TOAST ══ */
let toastTimer=null;
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),2200);
}

/* ══ LOADING ══ */
(function(){
  const bar=document.getElementById('loadBar'),txt=document.getElementById('loadTxt');
  const msgs=['Loading...','Setting up audio...','Preparing FX studio...','Almost ready...'];
  let p=0,mi=0;
  const iv=setInterval(()=>{
    p+=Math.random()*18+7; if(p>100)p=100;
    bar.style.width=p+'%';
    if(mi<msgs.length-1&&p>(mi+1)*25){mi++;txt.textContent=msgs[mi];}
    if(p>=100){
      clearInterval(iv);
      setTimeout(()=>{
        const ls=document.getElementById('loadScreen');
        ls.style.transition='opacity .4s'; ls.style.opacity='0';
        setTimeout(()=>{ ls.style.display='none'; initApp(); },400);
      },300);
    }
  },80);
})();

/* ══ INIT APP ══ */
function initApp(){
  loadProfile();
  if(userProfile.name){
    document.getElementById('app').classList.add('ready');
    updateNavAvatar();
    renderAll();
  } else {
    document.getElementById('profileSetup').classList.add('open');
    document.getElementById('psName').focus();
  }
}

/* ══ PROFILE SETUP ══ */
let psAvatarUrl = '';

function pickAvatar(inp){
  if(!inp.files[0]) return;
  psAvatarUrl = URL.createObjectURL(inp.files[0]);
  const img=document.getElementById('psAvatarImg');
  img.src=psAvatarUrl; img.style.display='block';
  document.getElementById('psAvatarIni').style.display='none';
}

function updateAvatarIni(){
  const n=document.getElementById('psName').value.trim();
  document.getElementById('psAvatarIni').textContent = n ? n[0].toUpperCase() : '?';
}

function psStep1Done(){
  const name = document.getElementById('psName').value.trim();
  if(!name){ document.getElementById('psNameErr').textContent='Please enter your name'; return; }
  document.getElementById('psNameErr').textContent='';
  userProfile={ name, avatarUrl:psAvatarUrl };
  saveProfile();
  document.getElementById('profileSetup').classList.remove('open');
  document.getElementById('app').classList.add('ready');
  updateNavAvatar();
  renderAll();
}

function updateNavAvatar(){
  const n=userProfile.name||'';
  document.getElementById('navAvatarIni').textContent=n[0]||'?';
  const [bg,fg]=PALS[0];
  const nav=document.getElementById('navAvatar');
  nav.style.background=`linear-gradient(135deg,${bg},${fg})`;
  nav.style.color=fg;
  if(userProfile.avatarUrl){
    const img=document.getElementById('navAvatarImg');
    img.src=userProfile.avatarUrl; img.style.display='block';
    document.getElementById('navAvatarIni').style.display='none';
  }
  // profile screen
  document.getElementById('profileNameBig').textContent=n;
  document.getElementById('profileAvatarBig').style.background=`linear-gradient(135deg,${bg},${fg})`;
  document.getElementById('profileAvatarBig').style.color=fg;
  document.getElementById('profileAvatarBigIni').textContent=n[0]||'?';
  if(userProfile.avatarUrl){
    const img=document.getElementById('profileAvatarBigImg');
    img.src=userProfile.avatarUrl; img.style.display='block';
    document.getElementById('profileAvatarBigIni').style.display='none';
  }
  const ls=songs.length, liked=songs.filter(s=>s.liked).length;
  document.getElementById('profileStats').textContent=`${ls} song${ls!==1?'s':''}`;
  document.getElementById('profileTotalSongs').textContent=`${ls} songs added`;
  document.getElementById('profileLikedSongs').textContent=`${liked} songs liked`;
}

/* ══ FILE UPLOAD (no password) ══ */
function openFilePicker(){ document.getElementById('fileInput').click(); }

function handleFiles(files){
  pendingFiles=Array.from(files);
  pendingFileIdx=0;
  document.getElementById('fileInput').value='';
  showNextMeta();
}

document.body.addEventListener('dragover',e=>e.preventDefault());
document.body.addEventListener('drop',e=>{e.preventDefault();if(e.dataTransfer.files.length)handleFiles(e.dataTransfer.files);});

function showNextMeta(){
  if(pendingFileIdx>=pendingFiles.length) return;
  const f=pendingFiles[pendingFileIdx];
  currentSongImgUrl='';
  document.getElementById('metaName').value=toName(f.name);
  document.getElementById('metaArtist').value='';
  document.getElementById('metaNameErr').textContent='';
  document.getElementById('metaName').classList.remove('err');
  const preview=document.getElementById('metaImgPreview');
  preview.innerHTML=`<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="var(--red)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><img id="metaImgEl" src="" style="display:none;position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`;
  document.getElementById('metaSubTxt').textContent=`Song ${pendingFileIdx+1} of ${pendingFiles.length}`;
  document.getElementById('songMetaOverlay').classList.add('open');
  setTimeout(()=>document.getElementById('metaName').focus(),200);
}

function pickSongImg(inp){
  if(!inp.files[0]) return;
  currentSongImgUrl=URL.createObjectURL(inp.files[0]);
  const img=document.getElementById('metaImgEl');
  img.src=currentSongImgUrl; img.style.display='block';
}

function saveMeta(){
  const name=document.getElementById('metaName').value.trim();
  if(!name){ document.getElementById('metaName').classList.add('err'); document.getElementById('metaNameErr').textContent='Song name required'; return; }
  const artist=document.getElementById('metaArtist').value.trim()||'Unknown Artist';
  addSongToLib(pendingFiles[pendingFileIdx], name, artist, currentSongImgUrl);
  document.getElementById('songMetaOverlay').classList.remove('open');
  pendingFileIdx++;
  if(pendingFileIdx<pendingFiles.length) setTimeout(showNextMeta,300);
}

function skipMeta(){
  const f=pendingFiles[pendingFileIdx];
  addSongToLib(f, toName(f.name), 'Unknown Artist', '');
  document.getElementById('songMetaOverlay').classList.remove('open');
  pendingFileIdx++;
  if(pendingFileIdx<pendingFiles.length) setTimeout(showNextMeta,300);
}

function addSongToLib(file, name, artist, imgUrl){
  const url=URL.createObjectURL(file);
  const s={url,name,artist,imgUrl,dur:0,liked:false};
  songs.push(s);
  const i=songs.length-1;
  const tmp=new Audio(url);
  tmp.addEventListener('loadedmetadata',()=>{ songs[i].dur=tmp.duration; renderAll(); updateNavAvatar(); saveSongsMeta(); });
  renderAll(); updateNavAvatar(); saveSongsMeta();
  showToast('Song added! 🎵');
}

/* ══ SONG EDIT MODAL ══ */
function openEditSong(i){
  editSongIdx=i;
  editSongImgUrl=songs[i].imgUrl||'';
  document.getElementById('editSongName').value=songs[i].name;
  document.getElementById('editSongArtist').value=songs[i].artist;
  document.getElementById('editSongNameErr').textContent='';

  // Art preview
  const artEl=document.getElementById('editSongArtPreview');
  const[bg,fg]=pal(i);
  artEl.style.background=`linear-gradient(135deg,${bg},${fg})`;
  artEl.innerHTML='';
  if(editSongImgUrl){
    artEl.innerHTML=`<img src="${editSongImgUrl}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">`;
  } else {
    artEl.innerHTML=`<span style="font-size:18px;font-weight:900;color:${fg};position:relative;z-index:1">${ini(songs[i])}</span>`;
  }
  artEl.innerHTML+=`<div class="song-edit-art-overlay"><svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div>`;
  document.getElementById('editSongOverlay').classList.add('open');
  setTimeout(()=>document.getElementById('editSongName').focus(),200);
}

function pickEditSongImg(inp){
  if(!inp.files[0]) return;
  editSongImgUrl=URL.createObjectURL(inp.files[0]);
  const artEl=document.getElementById('editSongArtPreview');
  artEl.innerHTML=`<img src="${editSongImgUrl}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0"><div class="song-edit-art-overlay"><svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div>`;
}

function saveEditSong(){
  const name=document.getElementById('editSongName').value.trim();
  if(!name){ document.getElementById('editSongName').classList.add('err'); document.getElementById('editSongNameErr').textContent='Name required'; return; }
  const artist=document.getElementById('editSongArtist').value.trim()||'Unknown Artist';
  songs[editSongIdx].name=name;
  songs[editSongIdx].artist=artist;
  songs[editSongIdx].imgUrl=editSongImgUrl;
  saveSongsMeta();
  document.getElementById('editSongOverlay').classList.remove('open');
  renderAll(); updateNavAvatar();
  if(editSongIdx===currentIdx) updNP();
  showToast('Song updated ✓');
}

function closeEditSong(){ document.getElementById('editSongOverlay').classList.remove('open'); }

/* ══ EDIT NAME ══ */
function openEditName(){
  document.getElementById('editNameOverlay').classList.add('open');
  document.getElementById('editNameInput').value=userProfile.name;
  document.getElementById('editNameErr').textContent='';
  setTimeout(()=>document.getElementById('editNameInput').focus(),200);
}

function doEditName(){
  const n=document.getElementById('editNameInput').value.trim();
  if(!n){document.getElementById('editNameErr').textContent='Please enter a name';return;}
  userProfile.name=n;
  saveProfile();
  document.getElementById('editNameOverlay').classList.remove('open');
  updateNavAvatar();
  showToast('Name updated ✓');
}

/* ══ EDIT AVATAR (profile) ══ */
function openProfileAvatarPick(){ document.getElementById('profileAvatarInput').click(); }
function pickProfileAvatar(inp){
  if(!inp.files[0]) return;
  userProfile.avatarUrl=URL.createObjectURL(inp.files[0]);
  saveProfile();
  updateNavAvatar();
  showToast('Avatar updated ✓');
}

/* ══ CTX MENU ══ */
function showCtx(i,e){
  ctxTarget=i;
  const m=document.getElementById('ctxMenu'),o=document.getElementById('ctxOverlay');
  m.style.display='block'; o.classList.add('open');
  m.style.left=Math.min(e.clientX,window.innerWidth-200)+'px';
  m.style.top=Math.min(e.clientY,window.innerHeight-200)+'px';
}
function closeCtx(){
  document.getElementById('ctxMenu').style.display='none';
  document.getElementById('ctxOverlay').classList.remove('open');
}
function ctxLike(){
  if(ctxTarget>=0){songs[ctxTarget].liked=!songs[ctxTarget].liked;if(ctxTarget===currentIdx)updNPLike();renderAll();updateNavAvatar();saveSongsMeta();}
  closeCtx();
}
function ctxEdit(){
  const i=ctxTarget; closeCtx();
  if(i>=0) openEditSong(i);
}
function ctxPlayNext(){
  if(ctxTarget>=0){
    const s=songs.splice(ctxTarget,1)[0];
    const ins=Math.max(currentIdx+1,0);
    songs.splice(ins,0,s);
    if(ctxTarget<currentIdx)currentIdx++;
    renderAll();
  }
  closeCtx();
}
function ctxRemove(){
  if(ctxTarget<0){closeCtx();return;}
  URL.revokeObjectURL(songs[ctxTarget].url);
  if(songs[ctxTarget].imgUrl&&songs[ctxTarget].imgUrl.startsWith('blob:'))URL.revokeObjectURL(songs[ctxTarget].imgUrl);
  if(ctxTarget===currentIdx){audioEl.pause();audioEl.src='';currentIdx=-1;isPlaying=false;updPlayBtns();document.getElementById('mini').classList.remove('on');}
  else if(ctxTarget<currentIdx)currentIdx--;
  songs.splice(ctxTarget,1);
  renderAll(); updateNavAvatar(); saveSongsMeta(); closeCtx();
  showToast('Song removed');
}

/* ══ TABS ══ */
function switchTab(t){
  ['home','np','lib','profile'].forEach(x=>{
    const scr=x==='np'?'npScreen':x+'Screen';
    document.getElementById(scr).classList.toggle('active',x===t);
    document.getElementById('tab-'+x).classList.toggle('active',x===t);
  });
  document.getElementById('topnav').style.display=t==='np'?'none':'flex';
  document.getElementById('mini').style.display=(t==='np'||currentIdx<0)?'none':'flex';
  if(t==='np'&&currentIdx>=0) updNP();
  if(t==='profile') updateNavAvatar();
}
function goHome(){switchTab('home');}
function openNP(){switchTab('np');}
function selChip(el,type){activeChip=type;renderHome();}
function doSearch(v){searchQ=v.toLowerCase();renderHome();}
function dzDrop(e){e.preventDefault();if(e.dataTransfer?.files?.length)handleFiles(e.dataTransfer.files);}

/* ══ RENDER ══ */
function renderAll(){ renderHome(); renderLib(); renderUpNext(); }

function renderHome(){
  const el=document.getElementById('homeBody');
  let q=songs.filter(s=>!searchQ||s.name.toLowerCase().includes(searchQ)||s.artist.toLowerCase().includes(searchQ));
  if(activeChip==='liked') q=q.filter(s=>s.liked);
  if(activeChip==='recent') q=[...q].reverse();

  if(!songs.length){
    el.innerHTML=`<div class="drop-zone" ondragover="event.preventDefault();this.classList.add('drag-on')" ondragleave="this.classList.remove('drag-on')" ondrop="dzDrop(event)" onclick="openFilePicker()">
      <div class="dz-icon"><svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
      <h3>Add Your First Song</h3><p>Click here or drag &amp; drop audio files<br>MP3 · WAV · FLAC · OGG · M4A</p></div>`;
    return;
  }

  const hi=currentIdx>=0?currentIdx:0;
  const h=songs[hi];
  const[hb,hf]=pal(hi);
  let html=`
  <div class="hero" onclick="playSong(${hi})">
    <div class="hero-art" style="background:linear-gradient(135deg,${hb},${hf});color:${hf}">
      ${h.imgUrl?`<img src="${h.imgUrl}">`:`<span style="position:relative;z-index:1">${ini(h)}</span>`}
    </div>
    <div class="hero-info">
      <div class="hero-tag">${currentIdx>=0?'Now Playing':'Start Here'}</div>
      <div class="hero-title">${h.name}</div>
      <div class="hero-sub">${h.artist} &bull; ${h.dur?fmt(h.dur):'--:--'}</div>
      <button class="hero-btn" onclick="event.stopPropagation();playSong(${hi})">
        <svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24" style="margin-left:1px"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        ${currentIdx===hi&&isPlaying?'Playing':'Play'}
      </button>
    </div>
  </div>
  <div class="chips">
    <button class="chip${activeChip==='all'?' active':''}" onclick="selChip(this,'all')">All</button>
    <button class="chip${activeChip==='liked'?' active':''}" onclick="selChip(this,'liked')">❤️ Liked</button>
    <button class="chip${activeChip==='recent'?' active':''}" onclick="selChip(this,'recent')">Recent</button>
  </div>`;

  if(activeChip==='liked'&&!q.length){
    html+=`<div class="empty-liked"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg><p>No liked songs yet.<br>Like a song to see it here.</p></div>`;
  } else {
    html+=`<div class="sec-lbl">${activeChip==='liked'?'Liked Songs':activeChip==='recent'?'Recently Added':'All Songs'}</div><div class="slist">`;
    html+=q.map(s=>{
      const ri=songs.indexOf(s);
      const[bg,fg]=pal(ri);
      const act=ri===currentIdx;
      return`<div class="srow${act?' playing':''}" onclick="playSong(${ri})">
        <div class="sart" style="background:linear-gradient(135deg,${bg},${fg});color:${fg}">
          ${s.imgUrl?`<img src="${s.imgUrl}">`:`<span style="position:relative;z-index:1">${ini(s)}</span>`}
        </div>
        <div class="sinfo"><div class="sname">${s.name}</div><div class="sartist">${s.artist}</div></div>
        <div class="eq"><div class="eqb"></div><div class="eqb"></div><div class="eqb"></div><div class="eqb"></div></div>
        <div class="sdur">${s.dur?fmt(s.dur):'--'}</div>
        <button class="smore" onclick="event.stopPropagation();showCtx(${ri},event)"><svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="19" r="1.3" fill="currentColor"/></svg></button>
      </div>`;
    }).join('');
    html+=`</div>`;
  }
  el.innerHTML=html;
}

function renderLib(){
  const g=document.getElementById('libGrid'),e=document.getElementById('libEmpty');
  if(!songs.length){g.innerHTML='';e.style.display='block';return;}
  e.style.display='none';
  g.innerHTML=songs.map((s,i)=>{
    const[bg,fg]=pal(i);
    return`<div class="lcard">
      <div class="lcard-art" style="background:linear-gradient(135deg,${bg},${fg});color:${fg}" onclick="playSong(${i})">
        ${s.imgUrl?`<img src="${s.imgUrl}">`:`<span style="position:relative;z-index:1">${ini(s)}</span>`}
        <div class="lcard-play"><svg width="12" height="12" fill="white" viewBox="0 0 24 24" style="margin-left:1px"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
      </div>
      <div class="lcard-info">
        <div class="lcard-name" onclick="playSong(${i})">${s.name}</div>
        <div class="lcard-meta">${s.artist} &bull; ${s.dur?fmt(s.dur):'--:--'}</div>
      </div>
    </div>`;
  }).join('');
}

function renderUpNext(){
  const el=document.getElementById('upNext');
  if(currentIdx<0||!songs.length){el.innerHTML='';return;}
  const next=songs.slice(currentIdx+1,currentIdx+4);
  if(!next.length){el.innerHTML='';return;}
  el.innerHTML=`<div class="un-lbl">Up Next</div>`+next.map((s,i)=>{
    const ri=currentIdx+1+i;
    const[bg,fg]=pal(ri);
    return`<div class="srow" onclick="nextSongDirect(${ri})" style="padding:7px 0">
      <div class="sart" style="background:linear-gradient(135deg,${bg},${fg});color:${fg};width:38px;height:38px;font-size:10px">
        ${s.imgUrl?`<img src="${s.imgUrl}">`:`<span style="position:relative;z-index:1">${ini(s)}</span>`}
      </div>
      <div class="sinfo"><div class="sname" style="font-size:12px">${s.name}</div><div class="sartist">${s.artist}</div></div>
      <div class="sdur">${s.dur?fmt(s.dur):'--'}</div>
    </div>`;
  }).join('');
}

/* ══ AUDIO ENGINE ══ */
function initAudio(){
  if(actx) return;
  actx=new(window.AudioContext||window.webkitAudioContext)();
  srcNode=actx.createMediaElementSource(audioEl);
  bassNode=actx.createBiquadFilter(); bassNode.type='lowshelf'; bassNode.frequency.value=200; bassNode.gain.value=0;
  lofiFilter=actx.createBiquadFilter(); lofiFilter.type='highshelf'; lofiFilter.frequency.value=3000; lofiFilter.gain.value=0;
  convolverNode=actx.createConvolver(); genImpulse(0.5);
  dryGain=actx.createGain(); dryGain.gain.value=1;
  wetGain=actx.createGain(); wetGain.gain.value=0;
  gainNode=actx.createGain(); gainNode.gain.value=fxVals.vol;
  pannerNode=actx.createStereoPanner?actx.createStereoPanner():null;
  srcNode.connect(bassNode); bassNode.connect(lofiFilter);
  lofiFilter.connect(dryGain); lofiFilter.connect(convolverNode); convolverNode.connect(wetGain);
  dryGain.connect(gainNode); wetGain.connect(gainNode);
  if(pannerNode){gainNode.connect(pannerNode);pannerNode.connect(actx.destination);}
  else gainNode.connect(actx.destination);
}
function genImpulse(decay){
  if(!actx)return;
  const sr=actx.sampleRate,len=sr*Math.max(.1,decay),buf=actx.createBuffer(2,len,sr);
  for(let ch=0;ch<2;ch++){const d=buf.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay*2);}
  convolverNode.buffer=buf;
}
function start8D(){ stop8D(); let a=0; panInterval=setInterval(()=>{a+=.04;if(pannerNode)pannerNode.pan.value=Math.sin(a);},50); }
function stop8D(){ clearInterval(panInterval); if(pannerNode)pannerNode.pan.value=0; }

function playSong(i){
  if(i<0||i>=songs.length)return;
  currentIdx=i;
  audioEl.src=songs[i].url;
  audioEl.playbackRate=getSpd();
  audioEl.play().then(()=>{
    isPlaying=true; initAudio(); applyAllFx();
    updNP(); updMini();
    document.getElementById('mini').classList.add('on');
    updPlayBtns(); renderAll();
  }).catch(e=>console.warn(e));
}
function nextSongDirect(i){
  if(i<0||i>=songs.length)return;
  currentIdx=i; audioEl.src=songs[i].url; audioEl.playbackRate=getSpd();
  audioEl.play().then(()=>{ isPlaying=true; initAudio(); applyAllFx(); updNP(); updMini(); document.getElementById('mini').classList.add('on'); updPlayBtns(); renderAll(); }).catch(e=>console.warn(e));
}
function getSpd(){ if(activeFx.slowed)return .75; if(activeFx.nightcore)return 1.3; return fxVals.spd; }

audioEl.addEventListener('timeupdate',()=>{
  const d=audioEl.duration||1,p=(audioEl.currentTime/d)*100;
  document.getElementById('progFill').style.width=p+'%';
  document.getElementById('progInput').value=p*10;
  document.getElementById('npCur').textContent=fmt(audioEl.currentTime);
  document.getElementById('miniFill').style.width=p+'%';
});
audioEl.addEventListener('loadedmetadata',()=>{
  document.getElementById('npDur').textContent=fmt(audioEl.duration);
  if(currentIdx>=0)songs[currentIdx].dur=audioEl.duration;
  renderAll();
});
audioEl.addEventListener('ended',()=>{ if(isRepeat){audioEl.currentTime=0;audioEl.play();}else nextSong(); });

function togglePlay(){if(currentIdx<0&&songs.length){playSong(0);return;}if(currentIdx<0)return;if(audioEl.paused){audioEl.play();isPlaying=true;}else{audioEl.pause();isPlaying=false;}updPlayBtns();}
function nextSong(){
  if(!songs.length)return;
  const ni=isShuffle?Math.floor(Math.random()*songs.length):(currentIdx+1)%songs.length;
  currentIdx=ni; audioEl.src=songs[ni].url; audioEl.playbackRate=getSpd();
  audioEl.play().then(()=>{ isPlaying=true; initAudio(); applyAllFx(); updNP(); updMini(); document.getElementById('mini').classList.add('on'); updPlayBtns(); renderAll(); }).catch(e=>console.warn(e));
}
function prevSong(){
  if(!songs.length)return;
  if(audioEl.currentTime>3){audioEl.currentTime=0;return;}
  const ni=(currentIdx-1+songs.length)%songs.length;
  currentIdx=ni; audioEl.src=songs[ni].url; audioEl.playbackRate=getSpd();
  audioEl.play().then(()=>{ isPlaying=true; initAudio(); applyAllFx(); updNP(); updMini(); document.getElementById('mini').classList.add('on'); updPlayBtns(); renderAll(); }).catch(e=>console.warn(e));
}
function seekPct(p){audioEl.currentTime=(p/100)*(audioEl.duration||0);}
function toggleShuffle(){isShuffle=!isShuffle;document.getElementById('shuffleBtn').classList.toggle('on',isShuffle);}
function toggleRepeat(){isRepeat=!isRepeat;document.getElementById('repeatBtn').classList.toggle('on',isRepeat);}
function toggleLike(){if(currentIdx<0)return;songs[currentIdx].liked=!songs[currentIdx].liked;updNPLike();renderAll();updateNavAvatar();saveSongsMeta();}

function updNP(){
  if(currentIdx<0)return;
  const s=songs[currentIdx];
  const[bg,fg]=pal(currentIdx);
  document.getElementById('npTitle').textContent=s.name;
  document.getElementById('npArtist').textContent=s.artist;
  const art=document.getElementById('npArt');
  art.style.background=`linear-gradient(135deg,${bg},${fg})`;
  art.style.color=fg;
  art.innerHTML=s.imgUrl?`<img src="${s.imgUrl}">`:`<span style="font-size:22px;font-weight:900;position:relative;z-index:1">${ini(s)}</span>`;
  art.classList.add('active');
  document.getElementById('npBg').style.background=`linear-gradient(160deg,${bg} 0%,#0d0d0d 55%)`;
  document.getElementById('npDur').textContent=s.dur?fmt(s.dur):'--:--';
  updNPLike();
}
function updNPLike(){
  if(currentIdx<0)return;
  const liked=songs[currentIdx].liked;
  const btn=document.getElementById('npLikeBtn');
  btn.classList.toggle('liked',liked);
  btn.querySelector('svg').setAttribute('fill',liked?'var(--red)':'none');
}
function updMini(){
  if(currentIdx<0)return;
  const s=songs[currentIdx];
  const[bg,fg]=pal(currentIdx);
  document.getElementById('miniName').textContent=s.name;
  document.getElementById('miniArtist').textContent=s.artist;
  const a=document.getElementById('miniArt');
  a.style.background=`linear-gradient(135deg,${bg},${fg})`;
  a.style.color=fg; a.style.fontSize='11px'; a.style.fontWeight='900';
  if(s.imgUrl){a.innerHTML=`<img src="${s.imgUrl}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">`;}
  else{a.innerHTML='';a.textContent=ini(s);}
}
function updPlayBtns(){
  document.getElementById('npPI').style.display=isPlaying?'none':'block';
  document.getElementById('npPA').style.display=isPlaying?'block':'none';
  document.getElementById('mPI').style.display=isPlaying?'none':'block';
  document.getElementById('mPA').style.display=isPlaying?'block':'none';
}

/* ══ FX ══ */
function toggleFxBody(){document.getElementById('fxBody').classList.toggle('open');document.getElementById('fxChev').classList.toggle('open');}
function toggleFx(name,btn){
  activeFx[name]=!activeFx[name]; btn.classList.toggle('on',activeFx[name]);
  if(name==='slowed'&&activeFx.slowed){activeFx.nightcore=false;document.getElementById('fxc-nightcore').classList.remove('on');}
  if(name==='nightcore'&&activeFx.nightcore){activeFx.slowed=false;document.getElementById('fxc-slowed').classList.remove('on');}
  applyAllFx();
  const count=Object.values(activeFx).filter(Boolean).length;
  const countEl=document.getElementById('fxActiveCount');
  if(countEl) countEl.textContent=count>0?`(${count} on)`:'';
  const dot=document.querySelector('.fx-dot');
  if(dot) dot.classList.toggle('active',count>0);
}
function applyAllFx(){applySpeed();applyBass();applyReverb();applyLofi();apply8D();}
function applySpeed(){let s=fxVals.spd;if(activeFx.slowed)s=.75;else if(activeFx.nightcore)s=1.3;audioEl.playbackRate=s;}
function applyBass(){if(!bassNode)return;bassNode.gain.value=activeFx.bassboost?Math.max(fxVals.bass,9):fxVals.bass;}
function applyReverb(){if(!wetGain||!dryGain)return;let d=fxVals.rvb/100;if(activeFx.reverb)d=Math.max(d,.55);wetGain.gain.value=d;dryGain.gain.value=1-d*.3;if(d>0)genImpulse(1+d*3);}
function applyLofi(){if(!lofiFilter)return;if(activeFx.lofi){lofiFilter.gain.value=-14;lofiFilter.frequency.value=2200;}else lofiFilter.gain.value=0;}
function apply8D(){if(activeFx['8d'])start8D();else stop8D();}
function onSpd(el){fxVals.spd=el.value/100;if(!activeFx.slowed&&!activeFx.nightcore)audioEl.playbackRate=fxVals.spd;document.getElementById('spdLbl').textContent=fxVals.spd.toFixed(2)+'x';sRng(el,40,150);}
function onBass(el){fxVals.bass=+el.value;if(bassNode)bassNode.gain.value=activeFx.bassboost?Math.max(fxVals.bass,9):fxVals.bass;document.getElementById('bassLbl').textContent=(fxVals.bass>=0?'+':'')+fxVals.bass+' dB';sRng(el,-6,14);}
function onRvb(el){fxVals.rvb=+el.value;applyReverb();document.getElementById('rvbLbl').textContent=fxVals.rvb+'%';sRng(el,0,100);}
function onVol(el){fxVals.vol=el.value/100;if(gainNode)gainNode.gain.value=fxVals.vol;else audioEl.volume=fxVals.vol;document.getElementById('volLbl').textContent=el.value+'%';sRng(el,0,100);}
function sRng(el,min,max){const p=((el.value-min)/(max-min))*100;el.style.background=`linear-gradient(to right,var(--red) ${p}%,rgba(255,255,255,.1) ${p}%)`;}

/* ══ INIT RANGES ══ */
window.addEventListener('load',()=>{
  sRng(document.getElementById('spdRange'),40,150);
  sRng(document.getElementById('bassRange'),-6,14);
  sRng(document.getElementById('rvbRange'),0,100);
  document.getElementById('volRange').style.background='linear-gradient(to right,var(--red) 80%,rgba(255,255,255,.1) 80%)';
});

