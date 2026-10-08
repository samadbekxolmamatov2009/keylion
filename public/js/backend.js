  /* ============ backend client (Turso via /api, replaces the old Firebase client) ============
     Kept the legacy file name and globals (uid, isGuest, fbReady, playerName, logDebug, ...)
     so the rest of the app did not need restructuring. */
  let uid = null, fbReady = false, isGuest = true;
  let authToken = null;
  let profileBestWpm = 0;
  let playerName = "o'yinchi" + Math.floor(100 + Math.random()*900);
  let cachedProfile = null;
  let googleClientId = null;
  const TOKEN_KEY = 'tezlash.token';

  /* ---- on-screen debug log (tap the status dot to open) ---- */
  const debugLines = [];
  function logDebug(msg){
    const ts = new Date().toLocaleTimeString();
    debugLines.push('['+ts+'] ' + msg);
    if(debugLines.length > 40) debugLines.shift();
    const panel = document.getElementById('debugPanel');
    if(panel.style.display !== 'none'){
      panel.innerHTML = debugLines.map(l=>'<div>'+escapeHtml(l)+'</div>').join('');
      panel.scrollTop = panel.scrollHeight;
    }
    console.log('[tezlash]', msg);
  }
  document.getElementById('fbStatus').addEventListener('click', ()=>{
    const panel = document.getElementById('debugPanel');
    const showing = panel.style.display !== 'none';
    panel.style.display = showing ? 'none' : 'block';
    if(!showing){
      panel.innerHTML = debugLines.length ? debugLines.map(l=>'<div>'+escapeHtml(l)+'</div>').join('') : '<div>hali jurnal yo‘q</div>';
      panel.scrollTop = panel.scrollHeight;
    }
  });

  function setFbStatus(state, label){
    const dot = document.getElementById('fbStatusDot');
    const text = document.getElementById('fbStatusText');
    const colors = { connecting: 'var(--text-dim)', ok: 'var(--success)', error: 'var(--error)' };
    dot.style.background = colors[state] || colors.connecting;
    text.textContent = label;
    text.style.color = state==='error' ? 'var(--error)' : 'var(--text-dim)';
  }

  /* ---- tiny fetch wrapper: JSON in/out, Bearer token, throws Error with .status ---- */
  async function api(method, path, body){
    const res = await fetch('/api' + path, {
      method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, authToken ? { Authorization: 'Bearer ' + authToken } : {}),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(()=> ({}));
    if(!res.ok){
      const err = new Error(data.error || ('HTTP ' + res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function saveToken(tok){
    authToken = tok;
    try{ tok ? localStorage.setItem(TOKEN_KEY, tok) : localStorage.removeItem(TOKEN_KEY); }catch(e){}
  }

  /* applies a /auth/* or /me response to the UI */
  function applySession(data){
    if(data.token) saveToken(data.token);
    const p = data.profile;
    cachedProfile = p;
    uid = p.id;
    isGuest = p.isGuest;
    fbReady = true;
    playerName = p.name;
    syncProfileUI(playerName);
    profileBestWpm = p.bestWpm || 0;
    syncPillTier(isGuest ? null : p.ratingWpm);
    renderStreakBadge(isGuest ? null : p.streak);
    if(!isGuest) adoptServerPrefs(p.settings);
    if(currentView === 'profile') renderProfile();
    setFbStatus('ok', 'ulandi');
    logDebug('auth OK, uid=' + uid.slice(0,8) + ', guest=' + isGuest);
  }

  async function initFirebase(){
    try{
      api('GET', '/config').then(c=>{ googleClientId = c.googleClientId; setupGoogleButton(); }).catch(()=>{});
      let stored = null;
      try{ stored = localStorage.getItem(TOKEN_KEY); }catch(e){}
      let data = null;
      if(stored){
        authToken = stored;
        try{ data = await api('GET', '/me').then(r=> ({ profile: r.profile })); }
        catch(err){ if(err.status !== 401) throw err; saveToken(null); }
      }
      if(!data){
        logDebug('mehmon sessiyasi yaratilmoqda...');
        data = await api('POST', '/auth/guest', {});
      }
      applySession(data);
      if(isGuest && data.profile.name.startsWith("o'yinchi")){
        /* fresh guest still has the random placeholder name: ask for a real one */
        document.getElementById('welcomeModal').style.display = 'flex';
        document.getElementById('welcomeNameInput').focus();
      }
      onAuthReady();
    }catch(err){
      console.error('backend init error', err);
      setFbStatus('error', 'ulanish xatosi');
      logDebug('XATO backend init: ' + err.message);
    }
  }

  function onAuthReady(){
    const params = new URLSearchParams(location.search);
    const roomParam = params.get('room');
    if(roomParam){
      switchView('race');
      joinRoomFromUrl(roomParam.toUpperCase());
    } else {
      routeFromHash();
    }
  }

  /* ---- stats: server stores totals; achievements/streak are evaluated here (see achievements.js).
     `extra` carries the raw counts the server re-checks: kind, textLang, durationMs, correct, typed,
     testToken (or raceCode), intervals. Returns the request promise (resolves to the server reply or null). */
  function updateUserStats(wpm, acc, modeLabel, missedSnapshot, langInfo, directUnlockId, extra){
    if(!fbReady || !uid || isGuest) return null;
    const p = cachedProfile || {};
    const testsCount = (p.testsCount||0) + 1;
    const bestWpm = Math.max(p.bestWpm||0, wpm);
    const streak = computeStreak(p.streak && p.streak.lastDate ? p.streak : null);
    const nextProfile = Object.assign({}, p, { testsCount, bestWpm, streak });
    if(langInfo && langInfo.textLang) nextProfile.langsUsed = Object.assign({}, p.langsUsed, {[langInfo.textLang]: true});
    if(langInfo && langInfo.codeLang) nextProfile.codeLangsUsed = Object.assign({}, p.codeLangsUsed, {[langInfo.codeLang]: true});
    const newly = checkNewAchievements(nextProfile, { wpm, acc });
    if(directUnlockId && !(p.achievements && p.achievements[directUnlockId])){
      const direct = ACHIEVEMENTS.find(a=> a.id===directUnlockId);
      if(direct) newly.push(direct);
    }
    return api('POST', '/results', Object.assign({
      wpm, acc, mode: modeLabel, missed: missedSnapshot || {}, langInfo: langInfo || {}, streak,
      achievements: newly.map(a=> a.id),
    }, extra || {})).then((res)=>{
      cachedProfile = res.profile;
      profileBestWpm = res.profile.bestWpm;
      syncPillTier(res.profile.ratingWpm);
      renderStreakBadge(res.profile.streak);
      /* achievements only count when the server accepted the result into the player's stats */
      newly.filter(a=> res.profile.achievements && res.profile.achievements[a.id]).forEach(a=> showAchievementToast(a));
      return res;
    }).catch((err)=>{ logDebug('XATO natijani saqlashda: ' + err.message); return null; });
  }

  /* ---- welcome / first-time name modal ---- */
  document.getElementById('btnWelcomeContinue').addEventListener('click', ()=>{
    const val = document.getElementById('welcomeNameInput').value.replace(/\s+/g,' ').trim();
    if(!val) return;
    playerName = val;
    syncProfileUI(playerName);
    document.getElementById('welcomeModal').style.display = 'none';
    if(fbReady) api('PUT', '/me', { name: playerName }).catch((err)=> logDebug('ism saqlashda xato: ' + err.message));
  });
  document.getElementById('welcomeNameInput').addEventListener('keydown', (e)=>{
    if(e.key==='Enter'){ e.preventDefault(); document.getElementById('btnWelcomeContinue').click(); }
  });
  document.getElementById('btnWelcomeLogin').addEventListener('click', ()=>{
    document.getElementById('welcomeModal').style.display = 'none';
    document.getElementById('authError').textContent = '';
    document.getElementById('authName').value = playerName;
    authModal.style.display = 'flex';
  });

  /* ---- auth modal ---- */
  const authModal = document.getElementById('authModal');
  function openAuthModal(){
    document.getElementById('authError').textContent = '';
    document.getElementById('authName').value = playerName;
    authModal.style.display = 'flex';
  }
  document.getElementById('authClose').addEventListener('click', ()=> authModal.style.display='none');
  authModal.addEventListener('click', (e)=>{ if(e.target===authModal) authModal.style.display='none'; });

  function authFail(err){
    logDebug('XATO auth: ' + err.message);
    const known = { 'email in use': 'dyn.auth.emailInUse', 'name required': 'dyn.auth.nameRequired' };
    document.getElementById('authError').textContent = known[err.message] ? t(known[err.message]) : err.message;
  }
  function authDone(data){
    applySession(data);
    authModal.style.display = 'none';
  }

  /* Google Identity Services renders its own button; we exchange the ID token for our session */
  function setupGoogleButton(){
    const wrap = document.getElementById('googleBtnWrap');
    if(!wrap) return;
    if(!googleClientId){ wrap.style.display = 'none'; return; }
    const go = ()=>{
      if(!window.google || !google.accounts){ setTimeout(go, 300); return; }
      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (resp)=>{
          api('POST', '/auth/google', { idToken: resp.credential, name: playerName }).then(authDone).catch(authFail);
        },
      });
      google.accounts.id.renderButton(wrap, { theme: 'filled_black', size: 'large', width: 272, text: 'continue_with' });
    };
    go();
  }

  document.getElementById('btnEmailLogin').addEventListener('click', ()=>{
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    api('POST', '/auth/login', { email, password }).then(authDone).catch(authFail);
  });
  document.getElementById('btnEmailSignup').addEventListener('click', ()=>{
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const name = document.getElementById('authName').value.replace(/\s+/g,' ').trim();
    if(!name){
      document.getElementById('authError').textContent = t('dyn.auth.nameRequired');
      return;
    }
    api('POST', '/auth/signup', { email, password, name }).then(authDone).catch(authFail);
  });
  function doLogout(){
    saveToken(null);
    uid = null; fbReady = false; cachedProfile = null;
    switchView('test');
    initFirebase();
  }
