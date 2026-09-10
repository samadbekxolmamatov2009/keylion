  /* ============ profile pill + modal ============ */
  const nameDisplay = document.getElementById('playerNameDisplay');
  const avatarEl = document.getElementById('profileAvatar');
  const profileModal = document.getElementById('profileModal');
  const profileModalAvatar = document.getElementById('profileModalAvatar');
  const profileNameInput = document.getElementById('profileNameInput');

  /* single place that keeps every name/avatar element in the UI in sync;
     called from here and from firebase.js whenever playerName changes */
  function syncProfileUI(name){
    nameDisplay.textContent = name;
    avatarEl.textContent = name.slice(0,2).toUpperCase();
    profileModalAvatar.textContent = name.slice(0,2).toUpperCase();
    if(document.activeElement !== profileNameInput) profileNameInput.value = name;
  }
  syncProfileUI(playerName);

  function isProfileModalOpen(){
    return profileModal.style.display !== 'none';
  }
  function openProfileModal(){
    profileModal.style.display = 'flex';
    profileNameInput.value = playerName;
    renderStats();
  }
  function closeProfileModal(){
    profileModal.style.display = 'none';
  }
  document.getElementById('btnProfile').addEventListener('click', openProfileModal);
  document.getElementById('profileModalClose').addEventListener('click', closeProfileModal);
  profileModal.addEventListener('click', (e)=>{ if(e.target===profileModal) closeProfileModal(); });

  function saveProfileName(){
    const val = profileNameInput.value.replace(/\s+/g,' ').trim();
    playerName = val || playerName;
    syncProfileUI(playerName);
    if(db && uid){
      if(isGuest) db.ref('guests/'+uid+'/name').set(playerName).catch(()=>{});
      else db.ref('users/'+uid+'/name').set(playerName).catch(()=>{});
    }
  }
  document.getElementById('btnSaveProfileName').addEventListener('click', saveProfileName);
  profileNameInput.addEventListener('keydown', (e)=>{
    if(e.key==='Enter'){ e.preventDefault(); saveProfileName(); }
  });

  /* ============ nav ============ */
  const views = ['test','race','leaderboard','coach'];
  document.getElementById('mainNav').addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-view]');
    if(!btn) return;
    switchView(btn.dataset.view);
  });
  function switchView(name){
    views.forEach(v=>{
      document.getElementById('view-'+v).classList.toggle('active', v===name);
    });
    document.querySelectorAll('#mainNav button').forEach(b=>{
      b.classList.toggle('active', b.dataset.view===name);
    });
    if(name==='leaderboard') loadLeaderboard();
    if(name==='coach') renderCoach();
  }


  /* ============ init ============ */
  applyI18n();
  renderLenSeg();
  buildTest();
  initFirebase();
  loadAd();
