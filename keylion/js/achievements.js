  /* ============ streak & achievements ============ */
  function localDateStr(d){
    const dt = d || new Date();
    return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
  }
  function computeStreak(prev){
    prev = prev || { current: 0, longest: 0, lastDate: null };
    const today = localDateStr();
    if(prev.lastDate === today) return prev;
    const yesterday = localDateStr(new Date(Date.now() - 86400000));
    const current = prev.lastDate === yesterday ? (prev.current||0) + 1 : 1;
    return { current, longest: Math.max(prev.longest||0, current), lastDate: today };
  }

  const ACHIEVEMENTS = [
    { id:'first_test', icon:'🎯', labelKey:'achv.firstTest.label', check:(p)=> (p.testsCount||0) >= 1 },
    { id:'tests_10', icon:'📈', labelKey:'achv.tests10.label', check:(p)=> (p.testsCount||0) >= 10 },
    { id:'tests_50', icon:'🏅', labelKey:'achv.tests50.label', check:(p)=> (p.testsCount||0) >= 50 },
    { id:'tests_100', icon:'💯', labelKey:'achv.tests100.label', check:(p)=> (p.testsCount||0) >= 100 },
    { id:'speed_50', icon:'⚡', labelKey:'achv.speed50.label', check:(p)=> (p.bestWpm||0) >= 50 },
    { id:'speed_80', icon:'🚀', labelKey:'achv.speed80.label', check:(p)=> (p.bestWpm||0) >= 80 },
    { id:'speed_100', icon:'🔥', labelKey:'achv.speed100.label', check:(p)=> (p.bestWpm||0) >= 100 },
    { id:'streak_3', icon:'🔥', labelKey:'achv.streak3.label', check:(p)=> ((p.streak&&p.streak.current)||0) >= 3 },
    { id:'streak_7', icon:'🔥', labelKey:'achv.streak7.label', check:(p)=> ((p.streak&&p.streak.current)||0) >= 7 },
    { id:'streak_30', icon:'🔥', labelKey:'achv.streak30.label', check:(p)=> ((p.streak&&p.streak.current)||0) >= 30 },
    { id:'polyglot', icon:'🌍', labelKey:'achv.polyglot.label', check:(p)=> Object.keys(p.langsUsed||{}).length >= 5 },
    { id:'coder', icon:'👨‍💻', labelKey:'achv.coder.label', check:(p)=> Object.keys(p.codeLangsUsed||{}).length >= 6 },
    { id:'accuracy_ace', icon:'🎯', labelKey:'achv.accuracyAce.label', check:(p, lastTest)=> !!lastTest && lastTest.acc >= 100 },
    { id:'racer_win', icon:'🏆', labelKey:'achv.racerWin.label', check:()=> false }, // unlocked directly from race.js, never via profile check
  ];

  /* returns achievement defs not yet in profile.achievements whose check() passes against
     the profile as it will look right after this test (see updateUserStats in firebase.js) */
  function checkNewAchievements(profile, lastTest){
    const already = profile.achievements || {};
    return ACHIEVEMENTS.filter(a=> a.id!=='racer_win' && !already[a.id] && a.check(profile, lastTest));
  }

  let achvToastQueue = [];
  let achvToastShowing = false;
  function showAchievementToast(a){
    achvToastQueue.push(a);
    if(!achvToastShowing) drainAchvToastQueue();
  }
  function drainAchvToastQueue(){
    const a = achvToastQueue.shift();
    if(!a){ achvToastShowing = false; return; }
    achvToastShowing = true;
    const el = document.createElement('div');
    el.className = 'achv-toast';
    el.innerHTML = '<span class="achv-toast-icon">'+a.icon+'</span><div><div class="achv-toast-title">'+t('achv.unlocked')+'</div><div class="achv-toast-label">'+t(a.labelKey)+'</div></div>';
    document.body.appendChild(el);
    setTimeout(()=>{
      el.classList.add('out');
      setTimeout(()=>{ el.remove(); drainAchvToastQueue(); }, 300);
    }, 3800);
  }

  function renderStreakBadge(streak){
    const el = document.getElementById('streakBadge');
    if(!el) return;
    const current = (streak && streak.current) || 0;
    if(current >= 2){
      el.textContent = '🔥 ' + current;
      el.style.display = 'inline-flex';
    } else {
      el.style.display = 'none';
    }
  }
