  /* ============ race: shared ============ */
  const raceText = document.getElementById('raceText');
  const raceInput = document.getElementById('raceInput');
  document.getElementById('raceTypeWrap').addEventListener('click', ()=> raceInput.focus());

  const raceState = {
    started: false, finished: false,
    text: '', typed: '', startTime: null, timeLeft: 30,
    roomCode: null, isHost: false, maxPlayers: 10, syntaxMap: null, timeLimit: 60,
    resultsShown: false,
  };
  let raceTimerInterval = null, lastSync = 0;
  let roomPlayersCache = {};

  const raceOpts = { type: 'words', lang: 'python', textLang: 'en', wordLen: 25, timeLen: 30 };

  function renderRaceLenSeg(){
    const wrap = document.getElementById('raceLenSeg');
    wrap.innerHTML = '';
    const opts = raceOpts.type==='time' ? [15,30,60] : (raceOpts.type==='words' ? [10,25,50] : []);
    opts.forEach(v=>{
      const b = document.createElement('button');
      b.textContent = v;
      const active = raceOpts.type==='time' ? v===raceOpts.timeLen : v===raceOpts.wordLen;
      if(active) b.classList.add('active');
      b.addEventListener('click', ()=>{
        if(raceOpts.type==='time') raceOpts.timeLen = v; else raceOpts.wordLen = v;
        renderRaceLenSeg();
      });
      wrap.appendChild(b);
    });
    wrap.style.display = opts.length ? 'flex' : 'none';
  }
  renderRaceLenSeg();

  document.getElementById('raceTypeSeg').addEventListener('click', (e)=>{
    const b = e.target.closest('button[data-mode]');
    if(!b) return;
    raceOpts.type = b.dataset.mode;
    document.querySelectorAll('#raceTypeSeg button').forEach(x=>x.classList.toggle('active', x===b));
    document.getElementById('raceLangRow').style.display = raceOpts.type==='code' ? 'flex' : 'none';
    document.getElementById('raceTextLangRow').style.display = raceOpts.type==='code' ? 'none' : 'flex';
    renderRaceLenSeg();
  });

  document.getElementById('raceLangSeg').addEventListener('click', (e)=>{
    const b = e.target.closest('button[data-lang]');
    if(!b) return;
    raceOpts.lang = b.dataset.lang;
    document.querySelectorAll('#raceLangSeg button').forEach(x=>x.classList.toggle('active', x===b));
  });
  document.getElementById('raceTextLangSeg').addEventListener('click', (e)=>{
    const b = e.target.closest('button[data-textlang]');
    if(!b) return;
    raceOpts.textLang = b.dataset.textlang;
    document.querySelectorAll('#raceTextLangSeg button').forEach(x=>x.classList.toggle('active', x===b));
  });

  function setRaceSettingsLocked(locked){
    document.getElementById('modeBarRaceLockable') && 0; // no-op placeholder
    const bar = document.querySelector('#view-race .mode-bar');
    if(!bar) return;
    bar.style.opacity = locked ? '.5' : '1';
    bar.style.pointerEvents = locked ? 'none' : 'auto';
  }

  function buildRaceText(opts){
    if(opts.type==='code') return randomCode(opts.lang);
    if(opts.type==='time') return randomWords(120, opts.textLang);
    return randomWords(opts.wordLen, opts.textLang);
  }

  function resetRaceScreen(timeLimit){
    raceState.typed = '';
    raceState.startTime = null;
    raceState.timeLeft = timeLimit || 60;
    raceState.finished = false;
    raceState.resultsShown = false;
    document.getElementById('raceTimer').textContent = raceState.timeLeft;
    document.getElementById('raceStatus').textContent = t('race.status.ready') || 'boshlash uchun yozishni boshlang...';
    document.getElementById('raceResultsScreen').style.display = 'none';
    document.getElementById('raceScreen').style.display = 'block';
    renderTyped(raceText, raceState.text, raceState.typed, raceState.syntaxMap);
    renderRaceTracks(roomPlayersCache);
    raceInput.value = '';
    raceInput.focus();
  }

  function myDisplayPct(){
    return raceState.text.length ? Math.min(100, (raceState.typed.length/raceState.text.length)*100) : 0;
  }

  function renderRaceTracks(players){
    const container = document.getElementById('raceTracksContainer');
    if(!container) return;
    const entries = Object.entries(players || {});
    // "siz" (me) always first, then everyone else
    entries.sort((a,b)=>{
      if(a[0]===uid) return -1;
      if(b[0]===uid) return 1;
      return (a[1].name||'').localeCompare(b[1].name||'');
    });
    container.innerHTML = '';
    entries.forEach(([pUid, p])=>{
      const mine = pUid === uid;
      const pct = mine ? myDisplayPct() : Math.min(100, p.progress || 0);
      const wpm = mine ? (raceState._lastWpm||0) : (p.wpm||0);
      const div = document.createElement('div');
      div.className = 'racer';
      div.innerHTML =
        '<div class="racer-head"><span class="name">'+(mine? 'siz' : escapeHtml(p.name||"o'yinchi"))+'</span><span class="wpm">'+wpm+' wpm</span></div>'+
        '<div class="track '+(mine?'you':'opp')+'">'+
          '<div class="fill" style="width:'+pct+'%;"></div>'+
          '<div class="racer-mark" style="left:'+pct+'%;"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 3 21h18L12 2z"/></svg></div>'+
        '</div>';
      container.appendChild(div);
    });
  }

  function updateRaceYou(){
    let correct = 0;
    for(let i=0;i<raceState.typed.length;i++) if(raceState.typed[i]===raceState.text[i]) correct++;
    const elapsedMin = raceState.startTime ? (Date.now()-raceState.startTime)/60000 : 0;
    const wpm = elapsedMin>0 ? Math.round((correct/5)/elapsedMin) : 0;
    const acc = raceState.typed.length ? Math.round((correct/raceState.typed.length)*100) : 100;
    const pct = Math.min(100, (raceState.typed.length/raceState.text.length)*100);
    raceState._lastWpm = wpm;
    raceState._lastAcc = acc;
    renderRaceTracks(roomPlayersCache);
    return {wpm, pct, acc};
  }

  raceInput.addEventListener('paste', (e)=> e.preventDefault());
  raceInput.addEventListener('keydown', (e)=>{
    if(e.key==='Tab'){ e.preventDefault(); return; }
    if(e.key==='Backspace'){
      e.preventDefault();
      if(raceState.finished || !raceState.started) return;
      raceState.typed = applyBackspace(raceState.typed);
      raceInput.value = '';
      renderTyped(raceText, raceState.text, raceState.typed, raceState.syntaxMap);
      updateRaceYou();
    }
  });
  raceInput.addEventListener('input', (e)=>{
    if(raceState.finished || !raceState.started){ raceInput.value=''; return; }
    if(e.data){
      for(const ch of e.data){
        if(raceState.typed.length >= raceState.text.length) break;
        if(!raceState.startTime){
          raceState.startTime = Date.now();
          document.getElementById('raceStatus').textContent = t('race.status.inProgress');
        }
        const expected = raceState.text[raceState.typed.length];
        if(expected !== undefined && ch !== expected) playErrorTick();
        raceState.typed = applyChar(raceState.text, raceState.typed, ch);
      }
    }
    raceInput.value = '';
    renderTyped(raceText, raceState.text, raceState.typed, raceState.syntaxMap);
    const r = updateRaceYou();
    syncRoomProgress(false, r);
    if(raceState.typed.length >= raceState.text.length){
      syncRoomProgress(true, r);
      raceState.finished = true;
      maybeEndRace();
    }
  });

  function startCountdown(){
    raceTimerInterval = setInterval(()=>{
      if(raceState.resultsShown) return;
      raceState.timeLeft -= 1;
      document.getElementById('raceTimer').textContent = Math.max(raceState.timeLeft,0);
      if(raceState.timeLeft<=0){
        if(raceState.isHost) endRaceAsHost();
      }
    }, 1000);
  }

  /* only the host decides when the race truly ends (someone finished, or time ran out),
     to avoid every client racing to write conflicting results */
  function maybeEndRace(){
    if(!raceState.isHost){ return; } // non-host clients just wait for room.status to flip
    endRaceAsHost();
  }

  function endRaceAsHost(){
    if(!db || !raceState.roomCode || raceState.resultsShown) return;
    db.ref('rooms/'+raceState.roomCode).once('value').then((snap)=>{
      const room = snap.val();
      if(!room || room.status === 'finished') return;
      db.ref('rooms/'+raceState.roomCode).update({ status: 'finished', finishedAt: firebase.database.ServerValue.TIMESTAMP });
    });
  }

  function showRaceResults(players){
    if(raceState.resultsShown) return;
    raceState.resultsShown = true;
    if(raceTimerInterval){ clearInterval(raceTimerInterval); raceTimerInterval = null; }
    const entries = Object.entries(players || {});
    entries.sort((a,b)=>{
      const pa = a[1], pb = b[1];
      if(!!pa.finished !== !!pb.finished) return pa.finished ? -1 : 1;
      if(pa.finished && pb.finished) return (pa.finishedAt||0) - (pb.finishedAt||0);
      return (pb.progress||0) - (pa.progress||0);
    });
    const iWon = entries.length && entries[0][0] === uid;
    document.getElementById('raceScreen').style.display = 'none';
    document.getElementById('raceResultsScreen').style.display = 'block';
    document.getElementById('raceResultsTitle').textContent = iWon
      ? "🏆 tabriklaymiz — siz g‘alaba qozondingiz!"
      : (entries[0] ? (entries[0][1].name||"o'yinchi") + " g‘alaba qozondi" : "poyga tugadi"); // textContent, not innerHTML — safe as-is
    const list = document.getElementById('raceResultsList');
    list.innerHTML = '';
    entries.forEach(([pUid, p], i)=>{
      const mine = pUid === uid;
      const row = document.createElement('div');
      row.className = 'race-result-row' + (i===0 ? ' winner' : '');
      row.innerHTML =
        '<div class="rr-rank">'+(i+1)+'</div>'+
        '<div class="rr-name">'+(mine?'siz':escapeHtml(p.name||"o'yinchi"))+(i===0?' 🥇':'')+'</div>'+
        '<div class="rr-stats">'+Math.round(p.wpm||0)+' wpm · '+Math.round(p.progress||0)+'% '+(p.finished?'(tugatdi)':'(tugatmadi)')+'</div>';
      list.appendChild(row);
    });
    if(uid){
      const me = players[uid];
      if(me){
        const modeLabel = (raceState.roomType==='code' ? 'code · race' : raceState.roomType==='time' ? 'time · race' : 'words · race');
        const wpmRounded = Math.round(me.wpm||0), accRounded = Math.round(raceState._lastAcc||100);
        const langInfo = raceState.roomType==='code' ? { codeLang: raceState.lang } : { textLang: raceState.textLang };
        submitScore(modeLabel, wpmRounded, accRounded);
        updateUserStats(wpmRounded, accRounded, modeLabel, {}, langInfo, iWon ? 'racer_win' : null);
      }
    }
  }

  document.getElementById('btnRaceExit').addEventListener('click', ()=>{
    leaveRoom();
    document.getElementById('raceResultsScreen').style.display = 'none';
    document.getElementById('raceLobby').style.display = 'block';
  });

  document.getElementById('btnRaceReplay').addEventListener('click', ()=>{
    if(!db || !raceState.roomCode) return;
    document.getElementById('raceResultsScreen').style.display = 'none';
    document.getElementById('roomWaitingPanel').style.display = 'block';
    document.getElementById('raceLobby').style.display = 'block';
    if(raceState.isHost){
      // host resets the room back to a waiting lobby with the same code & players, ready to reconfigure
      const resetPlayers = {};
      Object.keys(roomPlayersCache).forEach(k=>{
        resetPlayers[k] = { name: roomPlayersCache[k].name, progress: 0, wpm: 0, finished: false };
      });
      db.ref('rooms/'+raceState.roomCode).update({ status: 'waiting', players: resetPlayers }).catch(()=>{});
    }
  });

  /* ---- private room (real backend) ---- */
  function generateRoomCode(){
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for(let i=0;i<5;i++) s += chars[Math.floor(Math.random()*chars.length)];
    return s;
  }

  document.getElementById('btnPrivateRoom').addEventListener('click', ()=>{
    if(!fbReady || !db || !uid){
      alert(t('dyn.race.needConnect'));
      return;
    }
    const code = generateRoomCode();
    const maxPlayers = parseInt(document.getElementById('maxPlayersSelect').value, 10) || 10;
    const text = buildRaceText(raceOpts);
    const timeLimit = raceOpts.type==='time' ? raceOpts.timeLen : 60;
    raceState.roomCode = code;
    raceState.isHost = true;
    raceState.maxPlayers = maxPlayers;
    raceState.text = text;
    raceState.timeLimit = timeLimit;
    raceState.roomType = raceOpts.type;
    raceState.lang = raceOpts.lang;
    raceState.textLang = raceOpts.textLang;
    raceState.syntaxMap = raceOpts.type==='code' ? tokenizeSyntax(text, raceOpts.lang) : null;

    logDebug('xona yaratilmoqda: ' + code);
    db.ref('rooms/'+code).set({
      hostUid: uid, text: text, lang: raceOpts.lang, textLang: raceOpts.textLang, type: raceOpts.type, timeLimit: timeLimit, maxPlayers: maxPlayers,
      status: 'waiting', createdAt: firebase.database.ServerValue.TIMESTAMP,
      players: { [uid]: { name: playerName, progress: 0, wpm: 0, finished: false } }
    }).then(()=>{
      logDebug('xona yaratildi OK: ' + code);
      const link = location.origin + location.pathname + '?room=' + code;
      document.getElementById('roomWaitingTitle').textContent = 'xona tayyor';
      document.getElementById('roomCodeDisplay').textContent = code;
      document.getElementById('roomLinkInput').value = link;
      document.getElementById('roomWaitingPanel').style.display = 'block';
      document.getElementById('roomHostControls').style.display = 'block';
      document.getElementById('roomGuestWait').style.display = 'none';
      attachRoomListener(code);
    }).catch((err)=>{
      logDebug('XATO xona yaratishda: ' + err.code + ' — ' + err.message);
      if(err.code === 'PERMISSION_DENIED'){
        alert(t('dyn.race.createFailPerm'));
      } else {
        alert(t('dyn.race.createFailGeneric') + ' (' + (err.code||err.message) + ')');
      }
    });
  });

  document.getElementById('btnCopyRoomLink').addEventListener('click', ()=>{
    const input = document.getElementById('roomLinkInput');
    input.select();
    navigator.clipboard && navigator.clipboard.writeText(input.value).then(()=>{
      const btn = document.getElementById('btnCopyRoomLink');
      const old = btn.textContent;
      btn.textContent = 'nusxalandi';
      setTimeout(()=> btn.textContent = old, 1500);
    }).catch(()=>{});
  });

  function leaveRoom(){
    if(raceState.roomCode && db){
      db.ref('rooms/'+raceState.roomCode).off();
      if(raceState.isHost){
        db.ref('rooms/'+raceState.roomCode).remove().catch(()=>{});
      } else if(uid){
        db.ref('rooms/'+raceState.roomCode+'/players/'+uid).remove().catch(()=>{});
      }
    }
    raceState.roomCode = null;
    raceState.isHost = false;
    raceState.started = false;
    roomPlayersCache = {};
    setRaceSettingsLocked(false);
    document.getElementById('roomWaitingPanel').style.display = 'none';
  }

  document.getElementById('btnCancelRoom').addEventListener('click', leaveRoom);

  document.getElementById('btnJoinByCode').addEventListener('click', ()=>{
    const input = document.getElementById('joinCodeInput');
    const err = document.getElementById('joinCodeError');
    const code = input.value.trim().toUpperCase();
    err.textContent = '';
    if(code.length !== 5){
      err.textContent = t('dyn.race.codeLength');
      return;
    }
    if(!fbReady || !db || !uid){
      err.textContent = t('dyn.race.connecting');
      return;
    }
    joinRoomFromUrl(code);
  });

  function joinRoomFromUrl(code){
    logDebug('xonaga qo‘shilishga urinilmoqda: ' + code);
    function tryJoin(){
      if(!fbReady || !db || !uid){ setTimeout(tryJoin, 300); return; }
      db.ref('rooms/'+code).once('value').then((snap)=>{
        const data = snap.val();
        const err = document.getElementById('joinCodeError');
        if(!data){
          if(err) err.textContent = t('dyn.race.roomNotFound');
          return;
        }
        const players = data.players || {};
        if(data.status && data.status !== 'waiting' && !players[uid]){
          if(err) err.textContent = t('dyn.race.alreadyStarted');
          return;
        }
        if(Object.keys(players).length >= (data.maxPlayers||10) && !players[uid]){
          if(err) err.textContent = t('dyn.race.roomFull') + " (" + (data.maxPlayers||10) + ")";
          return;
        }
        raceState.roomCode = code;
        raceState.isHost = (data.hostUid === uid);
        raceState.maxPlayers = data.maxPlayers || 10;
        raceState.text = data.text;
        raceState.timeLimit = data.timeLimit || 60;
        raceState.roomType = data.type;
        raceState.lang = data.lang;
        raceState.textLang = data.textLang;
        raceState.syntaxMap = data.type==='code' ? tokenizeSyntax(data.text, data.lang) : null;
        document.getElementById('raceLobby').style.display = 'block';
        document.getElementById('roomWaitingTitle').textContent = "xonaga qo'shildingiz";
        document.getElementById('roomCodeDisplay').textContent = code;
        document.getElementById('roomLinkInput').value = location.origin + location.pathname + '?room=' + code;
        document.getElementById('roomWaitingPanel').style.display = 'block';
        document.getElementById('roomHostControls').style.display = raceState.isHost ? 'block' : 'none';
        document.getElementById('roomGuestWait').style.display = raceState.isHost ? 'none' : 'block';
        db.ref('rooms/'+code+'/players/'+uid).set({ name: playerName, progress: 0, wpm: 0, finished: false }).then(()=>{
          logDebug('xonaga qo‘shildim OK: ' + code);
          attachRoomListener(code);
        }).catch((e2)=> logDebug('XATO players yozishda: ' + e2.code));
      }).catch((err)=>{
        logDebug('XATO xonaga ulanishda: ' + err.code + ' — ' + err.message);
        const errEl = document.getElementById('joinCodeError');
        if(errEl) errEl.textContent = err.code === 'PERMISSION_DENIED'
          ? t('dyn.race.connectFailPerm')
          : t('dyn.race.connectFail') + ' (' + (err.code||'') + ')';
      });
    }
    tryJoin();
  }

  document.getElementById('btnStartRace').addEventListener('click', ()=>{
    if(!raceState.isHost || !db || !raceState.roomCode) return;
    db.ref('rooms/'+raceState.roomCode).update({ status: 'racing', startedAt: firebase.database.ServerValue.TIMESTAMP }).catch((err)=>{
      logDebug('XATO race boshlashda: ' + err.code);
    });
  });

  function renderRoomPlayersList(players){
    const wrap = document.getElementById('roomPlayersList');
    wrap.innerHTML = '';
    Object.entries(players||{}).forEach(([pUid, p])=>{
      const chip = document.createElement('div');
      chip.className = 'room-player-chip' + (pUid===raceState.hostUid ? ' host' : '');
      const rawName = p.name||"o'yinchi";
      chip.innerHTML = '<span class="av">'+escapeHtml(rawName.slice(0,2).toUpperCase())+'</span>'+escapeHtml(rawName);
      wrap.appendChild(chip);
    });
  }

  function attachRoomListener(code){
    logDebug('xona tinglovchisi ulandi: ' + code);
    db.ref('rooms/'+code).on('value', (snap)=>{
      const room = snap.val();
      if(!room){
        logDebug('xona o‘chirildi yoki topilmadi');
        return;
      }
      raceState.hostUid = room.hostUid;
      raceState.isHost = room.hostUid === uid;
      const players = room.players || {};
      roomPlayersCache = players;
      const count = Object.keys(players).length;

      if(room.status === 'waiting'){
        setRaceSettingsLocked(!raceState.isHost);
        renderRoomPlayersList(players);
        document.getElementById('roomHostControls').style.display = raceState.isHost ? 'block' : 'none';
        document.getElementById('roomGuestWait').style.display = raceState.isHost ? 'none' : 'block';
        const startBtn = document.getElementById('btnStartRace');
        if(raceState.isHost){
          startBtn.disabled = count < 2;
          startBtn.textContent = count < 2 ? t('race.waiting.needTwo') : (t('race.waiting.startBtn') + ' (' + count + '/' + (room.maxPlayers||10) + ')');
        }
        return;
      }

      if(room.status === 'racing'){
        if(!raceState.started){
          raceState.started = true;
          raceState.roomType = room.type;
          raceState.timeLimit = room.timeLimit || 60;
          raceState.text = room.text;
          raceState.syntaxMap = room.type==='code' ? tokenizeSyntax(room.text, room.lang) : null;
          document.getElementById('roomWaitingPanel').style.display = 'none';
          document.getElementById('raceLobby').style.display = 'none';
          resetRaceScreen(raceState.timeLimit);
          startCountdown();
        } else {
          renderRaceTracks(players);
          const mine = players[uid];
          if(mine && mine.finished && !raceState.finished){ raceState.finished = true; }
        }
        // if ANY player has finished (word/code mode) the host ends the race for everyone
        const anyoneFinished = Object.values(players).some(p=>p.finished);
        if(raceState.isHost && anyoneFinished){
          endRaceAsHost();
        }
        return;
      }

      if(room.status === 'finished'){
        raceState.started = false;
        showRaceResults(players);
      }
    }, (err)=>{
      logDebug('XATO xona tinglovchisi: ' + err.code + ' — ' + err.message);
    });
  }

  function syncRoomProgress(finished, r){
    if(!db || !raceState.roomCode || !uid) return;
    const now = Date.now();
    if(!finished && now - lastSync < 150) return;
    lastSync = now;
    const payload = { progress: r.pct, wpm: r.wpm, finished: !!finished };
    if(finished) payload.finishedAt = firebase.database.ServerValue.TIMESTAMP;
    db.ref('rooms/'+raceState.roomCode+'/players/'+uid).update(payload).catch((err)=> logDebug('XATO progress sync: ' + err.code));
  }
