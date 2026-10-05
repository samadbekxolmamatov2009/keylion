  const state = {
    mode: 'words', lang: 'python', textLang: 'en', wordLen: 25, timeLen: 30,
    text: '', typed: '', startTime: null, timerId: null, timeLeft: 30, finished: false, syntaxMap: null,
    testSeq: 0, tokenPromise: null, keyTimes: [],
  };
  const DAILY_WORDS = 30;
  const missedChars = {};
  let currentTestMissed = {};

  function renderLenSeg(){
    const wrap = document.getElementById('lenSeg');
    wrap.innerHTML = '';
    const opts = state.mode==='time' ? [15,30,60] : (state.mode==='words' ? [10,25,50] : []);
    opts.forEach(v=>{
      const b = document.createElement('button');
      b.textContent = v;
      const active = state.mode==='time' ? v===state.timeLen : v===state.wordLen;
      if(active) b.classList.add('active');
      b.addEventListener('click', ()=>{
        if(state.mode==='time') state.timeLen = v; else state.wordLen = v;
        renderLenSeg();
        buildTest();
      });
      wrap.appendChild(b);
    });
    wrap.style.display = opts.length ? 'flex' : 'none';
  }

  /* switches the mode bar + visible controls; callers decide when to build the next text */
  function setTestMode(mode){
    state.mode = mode;
    document.querySelectorAll('#typeSeg button').forEach(x=>x.classList.toggle('active', x.dataset.mode===mode));
    document.getElementById('langRow').style.display = mode==='code' ? 'flex' : 'none';
    document.getElementById('textLangRow').style.display = mode==='code' ? 'none' : 'flex';
    document.getElementById('timeLeftWrap').style.display = mode==='time' ? 'block' : 'none';
    document.getElementById('dailyNote').style.display = mode==='daily' ? 'block' : 'none';
    renderLenSeg();
  }
  document.getElementById('typeSeg').addEventListener('click', (e)=>{
    const b = e.target.closest('button[data-mode]');
    if(!b) return;
    setTestMode(b.dataset.mode);
    buildTest();
  });

  /* daily challenge: everyone gets the same words for a given (Tashkent) date and language */
  function dailyText(lang){
    const key = new Date(Date.now() + 5*3600000).toISOString().slice(0,10) + ':' + lang;
    let seed = 2166136261;
    for(const ch of key){ seed ^= ch.charCodeAt(0); seed = Math.imul(seed, 16777619); }
    seed >>>= 0;
    const rnd = ()=>{
      seed = (seed + 0x6D2B79F5) >>> 0;
      let x = seed;
      x = Math.imul(x ^ x >>> 15, x | 1);
      x ^= x + Math.imul(x ^ x >>> 7, x | 61);
      return ((x ^ x >>> 14) >>> 0) / 4294967296;
    };
    const bank = wordBanks[lang] || wordBanks.en;
    return Array.from({ length: DAILY_WORDS }, ()=> bank[Math.floor(rnd() * bank.length)]).join(' ');
  }
  document.getElementById('langRow').addEventListener('click', (e)=>{
    const b = e.target.closest('button[data-lang]');
    if(!b) return;
    state.lang = b.dataset.lang;
    document.querySelectorAll('#langRow button').forEach(x=>x.classList.toggle('active', x===b));
    buildTest();
  });
  document.getElementById('textLangRow').addEventListener('click', (e)=>{
    const b = e.target.closest('button[data-textlang]');
    if(!b) return;
    state.textLang = b.dataset.textlang;
    document.querySelectorAll('#textLangRow button').forEach(x=>x.classList.toggle('active', x===b));
    buildTest();
  });

  const typeText = document.getElementById('typeText');
  const typeInput = document.getElementById('typeInput');
  document.getElementById('typeWrap').addEventListener('click', ()=> typeInput.focus());

  function buildTest(customText){
    if(state.timerId){ clearInterval(state.timerId); state.timerId = null; }
    state.finished = false;
    state.testSeq++;
    state.tokenPromise = null;
    state.keyTimes = [];
    currentTestMissed = {};
    document.getElementById('resRankNote').textContent = '';
    document.getElementById('resultsScreen').style.display = 'none';
    document.getElementById('typingScreen').style.display = 'block';

    if(customText) state.text = customText;
    else if(state.mode==='code') state.text = randomCode(state.lang);
    else if(state.mode==='daily') state.text = dailyText(state.textLang);
    else if(state.mode==='time') state.text = randomWords(80, state.textLang);
    else state.text = randomWords(state.wordLen, state.textLang);
    state.syntaxMap = state.mode==='code' ? tokenizeSyntax(state.text, state.lang) : null;

    state.typed = '';
    state.startTime = null;
    state.timeLeft = state.timeLen;
    document.getElementById('liveTime').textContent = state.timeLeft;
    updateDimming(); // must run AFTER state.typed is reset to '', or a restart mid-test (Tab/Restart/Next)
                      // reads the previous test's typed length and leaves the header stuck dimmed
    renderTyped(typeText, state.text, state.typed, state.syntaxMap);
    document.getElementById('liveWpm').textContent = '0';
    document.getElementById('liveAcc').textContent = '100%';
    typeInput.value = '';
    typeInput.focus();
  }

  function updateDimming(){
    const started = state.typed.length>0 && !state.finished;
    document.getElementById('modeBar').classList.toggle('dim', started);
    document.getElementById('siteHeader').classList.toggle('dim', started);
    const adSlot = document.getElementById('adSlot');
    if(adSlot) adSlot.classList.toggle('dim', started);
  }

  function computeStats(endTime){
    let correct = 0;
    for(let i=0;i<state.typed.length;i++) if(state.typed[i]===state.text[i]) correct++;
    const durationMs = state.startTime ? (endTime || Date.now()) - state.startTime : 0;
    const elapsedMin = durationMs/60000;
    const wpm = elapsedMin>0 ? Math.round((correct/5)/elapsedMin) : 0;
    const acc = state.typed.length>0 ? Math.round((correct/state.typed.length)*100) : 100;
    return {wpm, acc, correct, typed: state.typed.length, durationMs};
  }

  /* rhythm summary of the gaps between key presses (pauses over 2 s ignored): sent with the result
     so the server can spot scripted input, which types with near-identical gaps */
  function keyRhythm(times){
    const gaps = [];
    for(let i=1;i<times.length;i++){ const g = times[i]-times[i-1]; if(g > 0 && g < 2000) gaps.push(g); }
    if(gaps.length < 2) return { n: gaps.length, median: 0, cv: 0 };
    const sorted = gaps.slice().sort((a,b)=> a-b);
    const mean = gaps.reduce((a,b)=> a+b, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((a,g)=> a + (g-mean)*(g-mean), 0) / gaps.length);
    return { n: gaps.length, median: sorted[Math.floor(sorted.length/2)], cv: mean ? +(sd/mean).toFixed(3) : 0 };
  }

  function startTimerIfNeeded(){
    if(state.startTime) return;
    state.startTime = Date.now();
    /* server-signed start stamp: proves to the server that at least this much real time passed */
    if(fbReady && !isGuest){
      state.tokenPromise = api('POST', '/tests/start').then((r)=> r.token).catch(()=> null);
    }
    if(state.mode==='time'){
      state.timerId = setInterval(()=>{
        state.timeLeft -= 1;
        document.getElementById('liveTime').textContent = Math.max(state.timeLeft,0);
        if(state.timeLeft<=0) finishTest();
      }, 1000);
    }
  }

  function refreshTestUI(){
    renderTyped(typeText, state.text, state.typed, state.syntaxMap);
    const s = computeStats();
    document.getElementById('liveWpm').textContent = s.durationMs < 1000 ? 0 : s.wpm;   // the first keystrokes give absurd numbers
    document.getElementById('liveAcc').textContent = s.acc + '%';
    updateDimming();
  }
  typeInput.addEventListener('keydown', (e)=>{
    if(e.key==='Tab'){ e.preventDefault(); buildTest(); return; }
    if(e.key==='Backspace'){
      e.preventDefault();
      if(state.finished) return;
      state.typed = applyBackspace(state.typed);
      typeInput.value = '';
      refreshTestUI();
    }
  });
  typeInput.addEventListener('paste', (e)=> e.preventDefault());
  typeInput.addEventListener('input', (e)=>{
    if(state.finished){ typeInput.value=''; return; }
    if(e.data){
      for(const ch of e.data){
        if(state.typed.length >= state.text.length) break;
        startTimerIfNeeded();
        state.keyTimes.push(Date.now());
        const expected = state.text[state.typed.length];
        const ok = expected === undefined || ch === expected;
        if(!ok){
          missedChars[expected] = (missedChars[expected]||0) + 1;
          currentTestMissed[expected] = (currentTestMissed[expected]||0) + 1;
        }
        typingFeedback(ok, document.getElementById('typeWrap'));
        state.typed = applyChar(state.text, state.typed, ch);
      }
    }
    typeInput.value = '';
    refreshTestUI();
    if(state.mode!=='time' && state.typed.length >= state.text.length) finishTest();
  });

  /* on the results screen the hidden input can't hold focus, so Enter / Tab restart from here
     (otherwise Tab would walk the focus into the nav and the next space would "click" it) */
  document.addEventListener('keydown', (e)=>{
    if(!state.finished || currentView !== 'test' || document.activeElement === typeInput) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if(tag === 'INPUT' || tag === 'TEXTAREA') return;
    if(e.key==='Enter' && tag === 'BUTTON') return;   // Enter on a focused result button presses that button
    if(e.key==='Enter' || e.key==='Tab'){ e.preventDefault(); buildTest(); }
  });

  /* monkeytype-style: any ordinary key press anywhere on the test view refocuses the hidden
     input, so a test starts the instant the user starts typing \u2014 no need to click into the
     typing box first. Only single printable characters and Backspace trigger it, so we never
     hijack Tab/Enter/arrow keys/shortcuts, and we back off while another input (profile name,
     join-room code, etc.) or a modal is focused. */
  document.addEventListener('keydown', (e)=>{
    if(document.activeElement === typeInput) return;
    if(e.ctrlKey || e.metaKey || e.altKey) return;
    if(e.key.length !== 1 && e.key !== 'Backspace') return;
    const activeTag = document.activeElement && document.activeElement.tagName;
    if(activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
    const testView = document.getElementById('view-test');
    if(!testView || !testView.classList.contains('active')) return;
    typeInput.focus();
  });

  function finishTest(){
    if(state.finished) return;
    state.finished = true;
    if(state.timerId){ clearInterval(state.timerId); state.timerId = null; }
    const s = computeStats(state.mode==='time' && state.startTime ? state.startTime + state.timeLen*1000 : Date.now());
    document.getElementById('typingScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'block';
    const resWpm = document.getElementById('resWpm'), resAcc = document.getElementById('resAcc');
    resWpm.textContent = s.wpm;
    resAcc.textContent = s.acc + '%';
    finishEffects(s.wpm, s.acc, resWpm, resAcc);
    const isNewBest = !isGuest && s.wpm > profileBestWpm && s.wpm > 0;
    document.getElementById('resNewBest').style.display = isNewBest ? 'block' : 'none';
    updateDimming();
    let modeLabel, langInfo;
    if(state.mode==='daily'){
      modeLabel = 'daily · ' + state.textLang;
      langInfo = { textLang: state.textLang };
    } else if(state.mode==='code'){
      modeLabel = 'code · ' + (state.lang==='python'?'py':state.lang==='javascript'?'js':state.lang);
      langInfo = { codeLang: state.lang };
    } else if(state.mode==='time'){
      modeLabel = 'time · ' + state.timeLen + 's · ' + state.textLang;
      langInfo = { textLang: state.textLang };
    } else {
      modeLabel = 'words · ' + state.wordLen + ' · ' + state.textLang;
      langInfo = { textLang: state.textLang };
    }
    const note = document.getElementById('resRankNote');
    if(isGuest){ note.textContent = s.wpm > 0 ? t('test.note.guest') : ''; return; }
    if(s.wpm <= 0) return;
    const seq = state.testSeq, rhythm = keyRhythm(state.keyTimes);
    Promise.resolve(state.tokenPromise).then((testToken)=>{
      const sent = updateUserStats(s.wpm, s.acc, modeLabel, currentTestMissed, langInfo, null, {
        kind: state.mode, textLang: state.mode==='code' ? null : state.textLang,
        durationMs: s.durationMs, correct: s.correct, typed: s.typed, testToken, intervals: rhythm,
      });
      if(sent) sent.then((res)=>{
        if(!res || seq !== state.testSeq) return;
        note.textContent = res.flagged ? t('test.note.flagged') : res.ranked ? t('test.note.ranked') : (res.acc < 90 ? t('test.note.lowAcc') : '');
        note.className = 'res-note' + (res.flagged ? ' warn' : res.ranked ? ' ok' : '');
      });
    });
  }

  document.getElementById('btnRestart').addEventListener('click', ()=> buildTest());
  document.getElementById('btnNext').addEventListener('click', ()=> buildTest());
  document.getElementById('btnAnalyze').addEventListener('click', ()=>{
    switchView('coach');
    setTimeout(()=>{ document.getElementById('btnAskCoach').click(); }, 250);
  });

