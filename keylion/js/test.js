  const state = {
    mode: 'words', lang: 'python', textLang: 'en', wordLen: 25, timeLen: 30,
    text: '', typed: '', startTime: null, timerId: null, timeLeft: 30, finished: false, syntaxMap: null,
  };
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

  document.getElementById('typeSeg').addEventListener('click', (e)=>{
    const b = e.target.closest('button[data-mode]');
    if(!b) return;
    state.mode = b.dataset.mode;
    document.querySelectorAll('#typeSeg button').forEach(x=>x.classList.toggle('active', x===b));
    document.getElementById('langRow').style.display = state.mode==='code' ? 'flex' : 'none';
    document.getElementById('textLangRow').style.display = state.mode==='code' ? 'none' : 'flex';
    document.getElementById('timeLeftWrap').style.display = state.mode==='time' ? 'block' : 'none';
    renderLenSeg();
    buildTest();
  });
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
    currentTestMissed = {};
    document.getElementById('resultsScreen').style.display = 'none';
    document.getElementById('typingScreen').style.display = 'block';
    updateDimming();

    if(customText) state.text = customText;
    else if(state.mode==='code') state.text = randomCode(state.lang);
    else if(state.mode==='time') state.text = randomWords(80, state.textLang);
    else state.text = randomWords(state.wordLen, state.textLang);
    state.syntaxMap = state.mode==='code' ? tokenizeSyntax(state.text, state.lang) : null;

    state.typed = '';
    state.startTime = null;
    state.timeLeft = state.timeLen;
    document.getElementById('liveTime').textContent = state.timeLeft;
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

  function computeStats(){
    let correct = 0;
    for(let i=0;i<state.typed.length;i++) if(state.typed[i]===state.text[i]) correct++;
    const elapsedMin = state.startTime ? (Date.now()-state.startTime)/60000 : 0;
    const wpm = elapsedMin>0 ? Math.round((correct/5)/elapsedMin) : 0;
    const acc = state.typed.length>0 ? Math.round((correct/state.typed.length)*100) : 100;
    return {wpm, acc, correct};
  }

  function startTimerIfNeeded(){
    if(state.startTime) return;
    state.startTime = Date.now();
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
    document.getElementById('liveWpm').textContent = s.wpm;
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
        const expected = state.text[state.typed.length];
        if(expected !== undefined && ch !== expected){
          missedChars[expected] = (missedChars[expected]||0) + 1;
          currentTestMissed[expected] = (currentTestMissed[expected]||0) + 1;
          playErrorTick();
        }
        state.typed = applyChar(state.text, state.typed, ch);
      }
    }
    typeInput.value = '';
    refreshTestUI();
    if(state.mode!=='time' && state.typed.length >= state.text.length) finishTest();
  });

  document.addEventListener('keydown', (e)=>{
    if(state.finished && e.key==='Enter'){ buildTest(); }
  });

  function finishTest(){
    if(state.finished) return;
    state.finished = true;
    if(state.timerId){ clearInterval(state.timerId); state.timerId = null; }
    const s = computeStats();
    document.getElementById('typingScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'block';
    document.getElementById('resWpm').textContent = s.wpm;
    document.getElementById('resAcc').textContent = s.acc + '%';
    const isNewBest = !isGuest && s.wpm > profileBestWpm && s.wpm > 0;
    document.getElementById('resNewBest').style.display = isNewBest ? 'inline' : 'none';
    updateDimming();
    let modeLabel, langInfo;
    if(state.mode==='code'){
      modeLabel = 'code · ' + (state.lang==='python'?'py':state.lang==='javascript'?'js':state.lang);
      langInfo = { codeLang: state.lang };
    } else if(state.mode==='time'){
      modeLabel = 'time · ' + state.timeLen + 's · ' + state.textLang;
      langInfo = { textLang: state.textLang };
    } else {
      modeLabel = 'words · ' + state.wordLen + ' · ' + state.textLang;
      langInfo = { textLang: state.textLang };
    }
    submitScore(modeLabel, s.wpm, s.acc);
    updateUserStats(s.wpm, s.acc, modeLabel, currentTestMissed, langInfo);
  }

  document.getElementById('btnRestart').addEventListener('click', ()=> buildTest());
  document.getElementById('btnNext').addEventListener('click', ()=> buildTest());
  document.getElementById('btnAnalyze').addEventListener('click', ()=>{
    switchView('coach');
    setTimeout(()=>{ document.getElementById('btnAskCoach').click(); }, 250);
  });

