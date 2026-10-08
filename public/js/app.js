  /* ============ profile pill (header) ============ */
  const nameDisplay = document.getElementById('playerNameDisplay');
  const avatarEl = document.getElementById('profileAvatar');

  /* single place that keeps every name/avatar element in the UI in sync;
     called from here, profile.js and backend.js whenever playerName changes */
  function syncProfileUI(name){
    nameDisplay.textContent = name;
    avatarEl.textContent = name.slice(0,2).toUpperCase();
    const inp = document.getElementById('profileNameInput');
    if(inp && document.activeElement !== inp) inp.value = name;
    const pfAvatar = document.querySelector('#view-profile .pf-avatar');
    if(pfAvatar && isOwnProfile()) pfAvatar.textContent = name.slice(0,2).toUpperCase();
  }
  /* the avatar ring takes the player's tier colour */
  function syncPillTier(rating){
    const tiered = rating !== null && rating !== undefined;
    avatarEl.classList.toggle('tiered', tiered);
    if(tiered){
      const tr = tierOf(rating);
      avatarEl.style.setProperty('--tc', tr.color);
      avatarEl.title = tr.label;
    } else {
      avatarEl.style.removeProperty('--tc');
      avatarEl.title = '';
    }
  }
  syncProfileUI(playerName);
  document.getElementById('btnProfile').addEventListener('click', ()=> openProfile(null, 'overview'));

  /* ============ nav + routing ============
     #/lessons, #/race, #/leaderboard, #/coach, #/profile, #/settings, #/u/<id>; no hash = the typing test */
  const views = ['test','lessons','race','leaderboard','coach','profile'];
  let currentView = 'test';
  document.getElementById('mainNav').addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-view]');
    if(!btn) return;
    switchView(btn.dataset.view);
  });
  function switchView(name, fromRouter){
    if(currentView === 'lessons' && name !== 'lessons') leaveLessons();
    currentView = name;
    views.forEach(v=>{
      document.getElementById('view-'+v).classList.toggle('active', v===name);
    });
    document.querySelectorAll('#mainNav button').forEach(b=>{
      b.classList.toggle('active', b.dataset.view===name);
    });
    document.getElementById('btnProfile').classList.toggle('active', name==='profile');
    if(name !== 'profile'){
      const ps = document.getElementById('profileSettings');
      if(ps) ps.innerHTML = '';   // stops the settings preview animation
    }
    if(!fromRouter && name !== 'profile'){
      const hash = name === 'test' ? '' : '#/' + name;
      if(location.hash !== hash) history.pushState(null, '', hash || (location.pathname + location.search));
    }
    if(name==='leaderboard') loadLeaderboard();
    if(name==='coach') renderCoach();
    if(name==='lessons') renderLessons();
    if(name==='test') setTimeout(()=> typeInput.focus(), 0);
  }
  function routeFromHash(){
    const h = location.hash;
    const m = /^#\/u\/([A-Za-z0-9_-]{1,64})$/.exec(h);
    if(m) openProfile(m[1], 'overview', true);
    else if(h === '#/profile') openProfile(null, 'overview', true);
    else if(h === '#/settings') openProfile(null, 'settings', true);
    else if(['#/lessons', '#/race', '#/leaderboard', '#/coach'].includes(h)) switchView(h.slice(2), true);
    else if(!h && currentView !== 'test') switchView('test', true);
  }
  window.addEventListener('hashchange', routeFromHash);


  /* ============ init ============ */
  applyI18n();
  renderLenSeg();
  buildTest();
  initFirebase();
  loadAd();
