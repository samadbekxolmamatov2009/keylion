  /* ============ coach ============ */
  /* aggregate mistakes from the last 5 saved tests (persistent, cross-session);
     guests have no persistent history, so fall back to this session's mistakes only */
  /* ---- AI Coach: the Claude call happens on the server (/api/coach), the API key never reaches the browser ---- */
  async function fetchAICoachMessage(promptText){
    const res = await api('POST', '/coach', { prompt: promptText });
    return res.text || null;
  }

  function getRecentMissedTally(callback){
    if(!isGuest && fbReady && uid){
      api('GET', '/history?limit=5').then((res)=>{
        const tally = {};
        let sawAny = false;
        (res.history || []).forEach((entry)=>{
          if(entry && entry.missed){
            Object.entries(entry.missed).forEach(([ch,count])=>{
              tally[ch] = (tally[ch]||0) + count;
              sawAny = true;
            });
          }
        });
        callback(tally, sawAny);
      }).catch(()=> callback(missedChars, Object.keys(missedChars).length>0));
    } else {
      callback(missedChars, Object.keys(missedChars).length>0);
    }
  }

  function renderCoach(){
    const wrap = document.getElementById('missedChartWrap');
    wrap.innerHTML = '<p class="empty-note">yuklanmoqda...</p>';
    getRecentMissedTally((tally)=>{
      const entries = Object.entries(tally).sort((a,b)=>b[1]-a[1]).slice(0,8);
      if(entries.length===0){
        wrap.innerHTML = '<p class="empty-note">Hali yetarli ma\'lumot yo\'q. Bir nechta test yeching, so\'ngra bu yerda oxirgi 5 testingiz bo\'yicha qaysi belgilarda ko\'proq xato qilayotganingiz ko\'rinadi.</p>';
        return;
      }
      const max = entries[0][1];
      wrap.innerHTML = '';
      entries.forEach(([ch,count])=>{
        const row = document.createElement('div');
        row.className = 'bar-row';
        const label = ch==='\n' ? '\u23ce' : ch===' ' ? '\u2423' : ch;
        row.innerHTML = '<div class="ch">'+label+'</div><div class="bar-bg"><div class="bar-fg" style="width:'+(count/max*100).toFixed(0)+'%"></div></div><div class="cnt">'+count+'</div>';
        wrap.appendChild(row);
      });
    });
  }

  document.getElementById('btnAskCoach').addEventListener('click', ()=>{
    const resultWrap = document.getElementById('coachResult');
    resultWrap.innerHTML = '<div class="chat-bubble"><div class="who">ai coach</div><div class="typing-dots"><span></span><span></span><span></span></div></div>';
    getRecentMissedTally((tally)=>{
      const entries = Object.entries(tally).sort((a,b)=>b[1]-a[1]);
      const totalMistakes = entries.reduce((sum,e)=> sum + e[1], 0);
      const distinctChars = entries.filter(e=> e[0] !== '\n').length;
      const isMinor = entries.length>0 && distinctChars <= 2 && totalMistakes <= 8;

      function localFallbackMsg(){
        if(entries.length===0){
          return t('dyn.coach.noData');
        } else if(isMinor){
          const top = entries.slice(0,2).map(e=> (e[0]==='\n'?'yangi qator':e[0]===' '?'probel':'"'+e[0]+'"')).join(', ');
          return t('dyn.coach.minor', { name: playerName, top: top, count: totalMistakes });
        } else {
          const top = entries.slice(0,3).map(e=> (e[0]==='\n'?'yangi qator':e[0]===' '?'probel':'"'+e[0]+'"')).join(', ');
          return t('dyn.coach.normal', { name: playerName, top: top });
        }
      }

      function renderResult(msg){
        resultWrap.innerHTML = '<div class="chat-bubble"><div class="who">ai coach</div>'+msg+'</div>'+
          (entries.length ? '<div style="margin-top:12px;"><button class="btn accent" id="btnCustomTest" style="width:100%; justify-content:center;">'+
          '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><line x1="7" y1="14" x2="17" y2="14"/></svg>'+
          'Start custom AI test</button></div>' : '');
        const btn = document.getElementById('btnCustomTest');
        if(btn) btn.addEventListener('click', ()=>{
          const topChars = entries.slice(0,5).map(e=>e[0]).filter(c=>c!=='\n');
          const pool = topChars.length ? topChars : ['e','a','t'];
          const bank = wordBanks[state.textLang] || wordBanks.en;
          const words = [];
          if(isMinor){
            /* light touch: mostly normal vocabulary, just a handful of words that contain the tricky letter(s) */
            const relevant = bank.filter(w => pool.some(c => w.includes(c)));
            for(let i=0;i<6;i++) words.push(relevant.length ? relevant[Math.floor(Math.random()*relevant.length)] : bank[Math.floor(Math.random()*bank.length)]);
            for(let i=0;i<14;i++) words.push(bank[Math.floor(Math.random()*bank.length)]);
            for(let i=words.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [words[i],words[j]]=[words[j],words[i]]; }
          } else {
            for(let i=0;i<20;i++){
              let w = '';
              const len = 3 + Math.floor(Math.random()*4);
              for(let j=0;j<len;j++) w += pool[Math.floor(Math.random()*pool.length)];
              words.push(w);
            }
          }
          switchView('test');
          state.mode = 'words';
          document.querySelectorAll('#typeSeg button').forEach(x=>x.classList.toggle('active', x.dataset.mode==='words'));
          document.getElementById('langRow').style.display='none';
          document.getElementById('textLangRow').style.display='flex';
          document.getElementById('timeLeftWrap').style.display='none';
          renderLenSeg();
          buildTest(words.join(' '));
        });
      }

      if(entries.length===0){
        setTimeout(()=> renderResult(localFallbackMsg()), 700);
        return;
      }

      const charSummary = JSON.stringify(Object.fromEntries(entries.slice(0,8).map(([ch,c])=>[ch==='\n'?'(yangi qator)':ch===' '?'(probel)':ch, c])));
      const prompt = "Sen tez yozish (typing) bo'yicha shaxsiy AI murabbiysan. Foydalanuvchi ismi: " + playerName + ". Uning oxirgi 5 ta testida eng ko'p xato qilgan belgilari, chastotasi bilan: " + charSummary + ". Jami xatolar soni: " + totalMistakes + ". " +
        (isMinor
          ? "Bu juda kam xato \u2014 shu sabab ortiqcha tashvishlanmaslik va o'sha 1-2 harfni bir necha o'nlab marta takrorlatishni tavsiya QILMASLIK kerak, bu foydasiz charchoq keltiradi."
          : "Bu yetarlicha ko'p xato \u2014 aynan shu belgilarga mo'ljallangan qisqa mashq tavsiya qil.") +
        " Javobni ushbu til kodida yoz: " + currentLang + " (uz=o'zbek, ru=rus, en=ingliz, kk=qozoq, ky=qirg'iz). 2-3 gapdan iborat, samimiy va motivatsion ohangda, texnik jargonsiz javob ber. Faqat javob matnining o'zini yoz, sarlavha yoki formatlashsiz.";

      fetchAICoachMessage(prompt).then((aiMsg)=>{
        renderResult(aiMsg || localFallbackMsg());
      }).catch((err)=>{
        logDebug('AI coach API xatosi, mahalliy tahlilga o\u2018tildi: ' + err.message);
        renderResult(localFallbackMsg());
      });
    });
  });

