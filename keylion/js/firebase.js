  /* ============ firebase ============ */
  const firebaseConfig = {
    apiKey: "AIzaSyBLCoeH_wuUKat2GXwLS2C-9S47Tf1Ikc4",
    authDomain: "englishlearning-bb966.firebaseapp.com",
    databaseURL: "https://englishlearning-bb966-default-rtdb.firebaseio.com",
    projectId: "englishlearning-bb966",
    storageBucket: "englishlearning-bb966.firebasestorage.app",
    messagingSenderId: "782738149172",
    appId: "1:782738149172:web:3fa9f70c1c5529ece29f61",
  };
  let db = null, auth = null, uid = null, fbReady = false, isGuest = true;
  let profileBestWpm = 0;
  let playerName = "o'yinchi" + Math.floor(100 + Math.random()*900);

  /* ---- on-screen debug log (tap the status dot to open) ---- */
  const debugLines = [];
  function logDebug(msg){
    const ts = new Date().toLocaleTimeString();
    debugLines.push('['+ts+'] ' + msg);
    if(debugLines.length > 40) debugLines.shift();
    const panel = document.getElementById('debugPanel');
    if(panel.style.display !== 'none'){
      panel.innerHTML = debugLines.map(l=>'<div>'+l+'</div>').join('');
      panel.scrollTop = panel.scrollHeight;
    }
    console.log('[lionprint]', msg);
  }
  document.getElementById('fbStatus').addEventListener('click', ()=>{
    const panel = document.getElementById('debugPanel');
    const showing = panel.style.display !== 'none';
    panel.style.display = showing ? 'none' : 'block';
    if(!showing){
      panel.innerHTML = debugLines.length ? debugLines.map(l=>'<div>'+l+'</div>').join('') : '<div>hali jurnal yo‘q</div>';
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

  function initFirebase(){
    try{
      firebase.initializeApp(firebaseConfig);
      auth = firebase.auth();
      db = firebase.database();
      logDebug('firebase initializeApp OK, kutilmoqda...');

      auth.onAuthStateChanged((user)=>{
        if(!user){
          logDebug('foydalanuvchi yo‘q, anonim login urinilmoqda...');
          auth.signInAnonymously().catch((err)=>{
            logDebug('XATO signInAnonymously: ' + err.code + ' — ' + err.message);
            const banner = document.getElementById('criticalBanner');
            if(err.code === 'auth/admin-restricted-operation' || err.code === 'auth/operation-not-allowed'){
              setFbStatus('error', 'auth: anonim login o‘chiq');
              banner.textContent = "⚠️ Mehmon (guest) rejimi ishlamayapti: Firebase Console → Authentication → Sign-in method → Anonymous ni yoqing va Publish qiling. Aks holda ro'yxatdan o'tmagan foydalanuvchilar saytdan foydalana olmaydi.";
              banner.style.display = 'block';
            } else if(err.code === 'auth/network-request-failed'){
              setFbStatus('error', 'auth: tarmoq xatosi');
              banner.textContent = "⚠️ Backendga ulanib bo'lmadi (tarmoq xatosi). Internetni tekshiring va sahifani qayta yuklang.";
              banner.style.display = 'block';
            } else {
              setFbStatus('error', 'auth xato: ' + err.code);
            }
          });
          return;
        }
        uid = user.uid;
        isGuest = user.isAnonymous;
        fbReady = true;
        setFbStatus('ok', 'ulandi');
        logDebug('auth OK, uid=' + uid.slice(0,8) + ', guest=' + isGuest);
        document.getElementById('btnOpenAuth').style.display = isGuest ? 'flex' : 'none';
        document.getElementById('btnLogout').style.display = isGuest ? 'none' : 'flex';
        loadOrCreateProfile(user);
        recordPrivateLogin(user);
        onAuthReady();
      });

      setTimeout(()=>{
        if(!fbReady){
          setFbStatus('error', 'javob yo‘q — statusni bosing');
          logDebug('8 soniyada auth javob bermadi. Tekshiring: Authentication > Sign-in method > Anonymous yoqilganmi, va Realtime Database yaratilganmi.');
        }
      }, 8000);
    }catch(err){
      console.error('firebase init error', err);
      setFbStatus('error', 'init xato');
      logDebug('XATO firebase init: ' + err.message);
    }
  }

  function onAuthReady(){
    const params = new URLSearchParams(location.search);
    const roomParam = params.get('room');
    if(roomParam){
      switchView('race');
      joinRoomFromUrl(roomParam.toUpperCase());
    }
  }

  /* ---- private profile: email, phone, registered-at, last-login-at ----
     NEVER includes passwords — Firebase Auth stores those hashed and never exposes them
     to app code, which is exactly how it should be. Only the account owner and the admin
     account (see ADMIN_UID in admin.html and in Firebase Rules) can read this node. */
  function recordPrivateLogin(user){
    if(!db || !user || user.isAnonymous) return;
    const ref = db.ref('private/'+user.uid);
    ref.update({
      email: user.email || '',
      phone: user.phoneNumber || '',
      lastLoginAt: firebase.database.ServerValue.TIMESTAMP
    }).catch((err)=> logDebug('private profil yozishda xato: ' + err.code));
    ref.child('createdAt').once('value').then((snap)=>{
      if(!snap.val()) ref.child('createdAt').set(firebase.database.ServerValue.TIMESTAMP);
    }).catch(()=>{});
  }

  /* ---- profile (persistent for real accounts, transient for guests) ---- */
  let pendingSignupName = null; // set right before signup/link so the new profile uses the name the user typed

  function loadOrCreateProfile(user){
    if(user.isAnonymous){
      db.ref('guests/'+user.uid).once('value').then((snap)=>{
        const data = snap.val();
        if(data && data.name){
          playerName = data.name;
          syncProfileUI(playerName);
          document.getElementById('profileModalLevel').textContent = '';
        } else {
          document.getElementById('welcomeModal').style.display = 'flex';
          document.getElementById('welcomeNameInput').focus();
        }
      }).catch((err)=>{
        logDebug('guest profil yuklashda xato: ' + err.message);
        document.getElementById('welcomeModal').style.display = 'flex';
      });
      return;
    }
    const ref = db.ref('users/'+user.uid);
    ref.once('value').then((snap)=>{
      let profile = snap.val();
      if(!profile){
        /* account was just created or linked from a guest — same uid is reused when linking,
           so check if this uid had a guest name saved and carry it over instead of losing it */
        db.ref('guests/'+user.uid).once('value').then((gsnap)=>{
          const guestData = gsnap.val();
          profile = {
            name: pendingSignupName || (guestData && guestData.name) || user.displayName || (user.email ? user.email.split('@')[0] : playerName),
            bestWpm: 0, testsCount: 0,
            createdAt: firebase.database.ServerValue.TIMESTAMP
          };
          ref.set(profile);
          if(guestData) db.ref('guests/'+user.uid).remove().catch(()=>{});
          pendingSignupName = null;
          logDebug('yangi profil yaratildi: ' + profile.name);
          playerName = profile.name;
          syncProfileUI(playerName);
          document.getElementById('profileModalLevel').textContent = 'lvl 1';
          profileBestWpm = 0;
        });
        return;
      }
      playerName = profile.name;
      syncProfileUI(playerName);
      document.getElementById('profileModalLevel').textContent = 'lvl ' + (1 + Math.floor((profile.bestWpm||0)/10));
      renderStreakBadge(profile.streak);
      profileBestWpm = profile.bestWpm || 0;
    }).catch((err)=> logDebug('profil yuklashda xato: ' + err.message));
  }

  function updateUserStats(wpm, acc, modeLabel, missedSnapshot, langInfo, directUnlockId){
    if(!db || !uid || isGuest) return;
    const ref = db.ref('users/'+uid);
    ref.once('value').then((snap)=>{
      const p = snap.val() || {testsCount:0, bestWpm:0};
      const testsCount = (p.testsCount||0) + 1;
      const bestWpm = Math.max(p.bestWpm||0, wpm);
      const streak = computeStreak(p.streak);
      const nextProfile = Object.assign({}, p, { testsCount, bestWpm, streak });
      const updates = { testsCount, bestWpm, streak };
      if(langInfo && langInfo.textLang){
        nextProfile.langsUsed = Object.assign({}, p.langsUsed, {[langInfo.textLang]: true});
        updates['langsUsed/'+langInfo.textLang] = true;
      }
      if(langInfo && langInfo.codeLang){
        nextProfile.codeLangsUsed = Object.assign({}, p.codeLangsUsed, {[langInfo.codeLang]: true});
        updates['codeLangsUsed/'+langInfo.codeLang] = true;
      }
      const newly = checkNewAchievements(nextProfile, { wpm, acc });
      if(directUnlockId && !(p.achievements && p.achievements[directUnlockId])){
        const direct = ACHIEVEMENTS.find(a=> a.id===directUnlockId);
        if(direct) newly.push(direct);
      }
      newly.forEach(a=> updates['achievements/'+a.id] = firebase.database.ServerValue.TIMESTAMP);
      ref.update(updates).then(()=>{
        document.getElementById('profileModalLevel').textContent = 'lvl ' + (1 + Math.floor(bestWpm/10));
        renderStreakBadge(streak);
        profileBestWpm = bestWpm;
        newly.forEach(a=> showAchievementToast(a));
      });
    });
    db.ref('users/'+uid+'/history').push({ wpm, acc, mode: modeLabel, missed: missedSnapshot||{}, ts: firebase.database.ServerValue.TIMESTAMP });
  }

  /* ---- auth modal ---- */
  /* ---- welcome / first-time name modal ---- */
  document.getElementById('btnWelcomeContinue').addEventListener('click', ()=>{
    const val = document.getElementById('welcomeNameInput').value.replace(/\s+/g,' ').trim();
    if(!val) return;
    playerName = val;
    syncProfileUI(playerName);
    document.getElementById('welcomeModal').style.display = 'none';
    if(db && uid){
      db.ref('guests/'+uid).set({ name: playerName, createdAt: firebase.database.ServerValue.TIMESTAMP }).catch((err)=> logDebug('guest ism saqlashda xato: ' + err.code));
    }
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

  const authModal = document.getElementById('authModal');
  document.getElementById('btnOpenAuth').addEventListener('click', ()=>{
    document.getElementById('profileModal').style.display = 'none';
    document.getElementById('authError').textContent = '';
    document.getElementById('authName').value = playerName;
    authModal.style.display = 'flex';
  });
  document.getElementById('authClose').addEventListener('click', ()=> authModal.style.display='none');
  authModal.addEventListener('click', (e)=>{ if(e.target===authModal) authModal.style.display='none'; });

  document.getElementById('btnGoogleLogin').addEventListener('click', ()=>{
    if(!auth) return;
    const provider = new firebase.auth.GoogleAuthProvider();
    const canLink = auth.currentUser && auth.currentUser.isAnonymous;
    pendingSignupName = playerName; // carry current (guest) name over if this becomes a fresh profile
    const authPromise = canLink ? auth.currentUser.linkWithPopup(provider) : auth.signInWithPopup(provider);
    authPromise.then(()=>{
      authModal.style.display = 'none';
    }).catch((err)=>{
      logDebug('XATO Google login: ' + err.code + ' — ' + err.message);
      if(err.code === 'auth/credential-already-in-use' && err.credential){
        /* this Google account already has a real profile elsewhere — sign into that one instead */
        pendingSignupName = null;
        auth.signInWithCredential(err.credential).then(()=>{
          authModal.style.display = 'none';
        }).catch((e2)=> logDebug('XATO credential signin: ' + e2.code));
        return;
      }
      document.getElementById('authError').textContent = err.code === 'auth/unauthorized-domain'
        ? t('dyn.auth.domainNotAuthorized')
        : err.code === 'auth/operation-not-allowed'
        ? t('dyn.auth.googleDisabled')
        : err.message;
    });
  });
  document.getElementById('btnEmailLogin').addEventListener('click', ()=>{
    if(!auth) return;
    const email = document.getElementById('authEmail').value.trim();
    const pass = document.getElementById('authPassword').value;
    auth.signInWithEmailAndPassword(email, pass).then(()=>{
      authModal.style.display = 'none';
    }).catch((err)=>{
      logDebug('XATO email login: ' + err.code);
      document.getElementById('authError').textContent = err.message;
    });
  });
  document.getElementById('btnEmailSignup').addEventListener('click', ()=>{
    if(!auth) return;
    const email = document.getElementById('authEmail').value.trim();
    const pass = document.getElementById('authPassword').value;
    const nameVal = document.getElementById('authName').value.replace(/\s+/g,' ').trim();
    if(!nameVal){
      document.getElementById('authError').textContent = t('dyn.auth.nameRequired');
      return;
    }
    pendingSignupName = nameVal;
    const cred = firebase.auth.EmailAuthProvider.credential(email, pass);
    const canLink = auth.currentUser && auth.currentUser.isAnonymous;
    const authPromise = canLink ? auth.currentUser.linkWithCredential(cred) : auth.createUserWithEmailAndPassword(email, pass);
    authPromise.then(()=>{
      authModal.style.display = 'none';
    }).catch((err)=>{
      logDebug('XATO email signup: ' + err.code);
      if(err.code === 'auth/credential-already-in-use' || err.code === 'auth/email-already-in-use'){
        pendingSignupName = null;
        document.getElementById('authError').textContent = t('dyn.auth.emailInUse');
        return;
      }
      document.getElementById('authError').textContent = err.message;
    });
  });
  document.getElementById('btnLogout').addEventListener('click', ()=>{
    if(auth) auth.signOut();
    document.getElementById('profileModal').style.display = 'none';
  });

  /* ---- phone auth ---- */
  let recaptchaVerifier = null, phoneConfirmResult = null;
  function ensureRecaptcha(){
    if(!recaptchaVerifier){
      recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { size: 'invisible' }, auth);
    }
    return recaptchaVerifier;
  }
  function resetPhoneStep(){
    document.getElementById('phoneAuthStep1').style.display = 'block';
    document.getElementById('phoneAuthStep2').style.display = 'none';
    document.getElementById('authPhone').value = '';
    document.getElementById('authPhoneCode').value = '';
    phoneConfirmResult = null;
  }
  document.getElementById('btnSendCode').addEventListener('click', ()=>{
    if(!auth) return;
    const phone = document.getElementById('authPhone').value.trim();
    document.getElementById('authError').textContent = '';
    if(!/^\+\d{9,15}$/.test(phone)){
      document.getElementById('authError').textContent = t('dyn.auth.phoneFormatHint');
      return;
    }
    const verifier = ensureRecaptcha();
    const canLink = auth.currentUser && auth.currentUser.isAnonymous;
    pendingSignupName = playerName;
    const promise = canLink
      ? auth.currentUser.linkWithPhoneNumber(phone, verifier)
      : auth.signInWithPhoneNumber(phone, verifier);
    promise.then((result)=>{
      phoneConfirmResult = result;
      document.getElementById('phoneAuthStep1').style.display = 'none';
      document.getElementById('phoneAuthStep2').style.display = 'block';
    }).catch((err)=>{
      logDebug('XATO SMS yuborishda: ' + err.code + ' — ' + err.message);
      pendingSignupName = null;
      document.getElementById('authError').textContent = err.code === 'auth/operation-not-allowed'
        ? t('dyn.auth.phoneDisabled')
        : err.code === 'auth/invalid-phone-number'
        ? t('dyn.auth.invalidPhone')
        : err.message;
      if(recaptchaVerifier){ recaptchaVerifier.clear(); recaptchaVerifier = null; }
    });
  });
  document.getElementById('btnVerifyCode').addEventListener('click', ()=>{
    if(!phoneConfirmResult) return;
    const code = document.getElementById('authPhoneCode').value.trim();
    document.getElementById('authError').textContent = '';
    phoneConfirmResult.confirm(code).then(()=>{
      authModal.style.display = 'none';
      resetPhoneStep();
    }).catch((err)=>{
      logDebug('XATO kod tasdiqlashda: ' + err.code);
      if(err.code === 'auth/credential-already-in-use' && err.credential){
        pendingSignupName = null;
        auth.signInWithCredential(err.credential).then(()=>{
          authModal.style.display = 'none';
          resetPhoneStep();
        }).catch(()=>{});
        return;
      }
      document.getElementById('authError').textContent = t('dyn.auth.codeWrong');
    });
  });
  authModal.addEventListener('click', (e)=>{ if(e.target===authModal) resetPhoneStep(); });
  document.getElementById('authClose').addEventListener('click', resetPhoneStep);

  function submitScore(modeLabel, wpm, acc){
    if(!fbReady || !db) return;
    db.ref('scores').push({
      name: playerName,
      mode: modeLabel,
      wpm: wpm,
      acc: acc,
      ts: firebase.database.ServerValue.TIMESTAMP
    }).catch(err=> logDebug('XATO score submit: ' + err.code));
  }
