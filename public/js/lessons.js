  /* ============ lessons: learn touch typing step by step ============
     A zigzag map of lessons (each step unlocks the next one) and a guided drill screen with a
     finger-coloured keyboard. Progress is kept per account on the server (/api/lessons) and cached
     in localStorage, so a dropped request never loses a passed step. Lesson texts are Uzbek, typed on
     an ordinary QWERTY (Latin) keyboard. */
  (function(){
    /* every step has a stable id: progress is stored as '<lesson id>:<step id>', so steps can be
       added or reordered later without mixing up anyone's stars */
    const LESSONS = [
      { id: 'home', title: "Asosiy qator", sub: 'F J · D K · S L · A ;', steps: [
        { id: 'intro', type: 'intro', title: "Barmoqlarni joylashtiring", keys: ['a','s','d','f','j','k','l',';'],
          text: "Chap qo'l barmoqlari A S D F, o'ng qo'l barmoqlari J K L ; tugmalari ustida tursin. F va J tugmalaridagi kichik bo'rtiqlarni ko'rsatkich barmoqlaringiz bilan toping — klaviaturaga qaramang, his qiling. Bosh barmoqlar probel ustida." },
        { id: 'fj', title: 'F va J', keys: ['f','j'], text: 'fff jjj fff jjj fj fj jf jf ffj jjf fjf jfj' },
        { id: 'dk', title: 'D va K', keys: ['d','k'], text: 'ddd kkk dk kd fdf jkj dkd kdk fdk jkd' },
        { id: 'sl', title: 'S va L', keys: ['s','l'], text: 'sss lll sl ls sds lkl fds jkl sdf lkj' },
        { id: 'a', title: 'A va ;', keys: ['a',';'], text: 'aaa ;;; a; ;a asdf jkl; asdf jkl; fdsa ;lkj' },
        { id: 'mix', title: 'Hammasi birga', keys: [], text: 'asdf jkl; sad lad ask all fall dad flask jaks' },
      ]},
      { id: 'gh', title: "G, H va birinchi so'zlar", sub: "G H · bo'g'inlar · so'zlar", steps: [
        { id: 'intro', type: 'intro', title: "Ko'rsatkich barmoqlar yonga", keys: ['g','h'],
          text: "G tugmasini chap ko'rsatkich barmoq F dan bir qadam o'ngga cho'zilib bosadi, H ni esa o'ng ko'rsatkich barmoq J dan chapga. Bosgandan so'ng barmoq yana F / J ga qaytadi." },
        { id: 'gh', title: 'G va H', keys: ['g','h'], text: 'fgf jhj ggg hhh gh hg fgh jhg ghg hgh' },
        { id: 'syl', title: "Bo'g'inlar", keys: [], text: 'ha la sa da ka ja ga has lag dag hak' },
        { id: 'words', title: "O'zbekcha so'zlar", keys: [], text: 'dala hal sada lak jala shah salla dala' },
        { id: 'final', title: 'Yakuniy mashq', keys: [], text: 'dala sada hal salla jala lak shah dala hal sada' },
      ]},
      { id: 'top', title: "Yuqori qator", sub: 'E I · R U · T Y · W O · Q P', steps: [
        { id: 'intro', type: 'intro', title: "Yuqoriga cho'zilish", keys: ['q','w','e','r','t','y','u','i','o','p'],
          text: "Yuqori qatordagi har bir tugmani uning ostidagi asosiy qator barmog'i bosadi: E ni D barmog'i, I ni K barmog'i va hokazo. Barmoq tepaga cho'ziladi, bosadi va darhol asosiy qatorga qaytadi — qo'l joyidan siljimaydi." },
        { id: 'ei', title: 'E va I', keys: ['e','i'], text: 'ded kik eee iii ek ik eski kel keldi ikki ishla kesdi' },
        { id: 'ru', title: 'R va U', keys: ['r','u'], text: 'frf juj rrr uuu dars gul ruh uka ular erkak gullar darslar' },
        { id: 'ty', title: 'T va Y', keys: ['t','y'], text: 'ftf jyj ttt yyy til yil uy ayt yurt katta yetti tish' },
        { id: 'wo', title: 'W va O', keys: ['w','o'], text: 'sws lol www ooo ota osh oila olti joy tosh yosh sotdi sohil' },
        { id: 'qp', title: 'Q va P', keys: ['q','p'], text: 'aqa ;p; qqq ppp qor qish qora pul opa qishloq piyola kapalak' },
        { id: 'words', title: "So'zlar", keys: [], text: 'oila yurt daryo quyosh issiq sport qishloq piyola tuproq yashil' },
      ]},
      { id: 'bottom', title: "Pastki qator", sub: 'N M · V B · C X · Z , .', steps: [
        { id: 'intro', type: 'intro', title: "Pastga tushish", keys: ['z','x','c','v','b','n','m',',','.'],
          text: "Pastki qatorga barmoqlar ozgina pastga va ichkariga bukiladi. N va M ni o'ng ko'rsatkich barmoq, V va B ni chap ko'rsatkich barmoq bosadi. Vergul — o'ng o'rta, nuqta — o'ng nomsiz barmoq." },
        { id: 'nm', title: 'N va M', keys: ['n','m'], text: 'jnj jmj nnn mmm ona non men olma nima kun tun inson' },
        { id: 'vb', title: 'V va B', keys: ['v','b'], text: 'fvf fbf vvv bbb suv bola bir havo kitob vatan bobo olov' },
        { id: 'cx', title: 'C va X', keys: ['c','x'], text: 'dcd sxs ccc xxx xat xona yaxshi baxt choy kuch ichdi qancha' },
        { id: 'z', title: 'Z, vergul va nuqta', keys: ['z',',','.'], text: 'aza k,k l.l zzz biz siz qiz, tez, uzum. bozor. yoz, kuz.' },
        { id: 'sent', title: 'Birinchi gaplar', keys: [], text: 'biz bugun bozorga bordik. men non va olma oldim.' },
      ]},
      { id: 'uz', title: "O'zbek harflari", sub: "O' G' · SH CH · NG", steps: [
        { id: 'intro', type: 'intro', title: "Tutuq belgisi va qo'sh harflar", keys: ["'", 'o', 'g'],
          text: "O' va G' — harfdan keyin tutuq belgisi (') bosiladi. U ; tugmasining o'ng tomonida, uni o'ng jimjiloq barmoq bosadi. SH, CH va NG esa ikki harf ketma-ket yoziladi. Istalgan tutuq belgisi (' ` ʻ ’) qabul qilinadi." },
        { id: 'og', title: "O' va G'", keys: ["'"], text: "o' o' g' g' o'g'il to'g'ri bog' tog' so'z yo'l do'st o'qish" },
        { id: 'shch', title: 'SH va CH', keys: [], text: 'shahar choy qush ish chiroq kuch uchun bosh qushcha' },
        { id: 'ng', title: 'NG', keys: [], text: "ming keng yangi tong rang o'ng singil dengiz" },
        { id: 'sent', title: 'Gaplar', keys: [], text: "o'g'lim maktabga bordi. choy ichdik. yangi yo'l keng." },
      ]},
      { id: 'caps', title: "Bosh harflar va belgilar", sub: 'Shift · ? !', steps: [
        { id: 'intro', type: 'intro', title: "Shift bilan katta harf", keys: ['shiftL', 'shiftR'],
          text: "Katta harf uchun Shift ni harfning qarama-qarshi qo'li jimjiloq barmog'i bilan bosib turing: J, K, L kabi o'ng qo'l harflari uchun chap Shift, A, S, D kabi chap qo'l harflari uchun o'ng Shift. So'roq (?) va undov (!) belgilari ham Shift bilan yoziladi." },
        { id: 'lshift', title: "Chap Shift", keys: ['shiftL'], text: 'Jasur Karim Lola Hamid Umid Iroda Olim Nodira Malika' },
        { id: 'rshift', title: "O'ng Shift", keys: ['shiftR'], text: 'Asal Sardor Dilnoza Farhod Gulnora Elyor Rustam Toshkent Zarina' },
        { id: 'punct', title: "So'roq va undov", keys: ['/', '1'], text: 'Ismingiz nima? Mening ismim Ali. Tanishganimdan xursandman!' },
        { id: 'sent', title: 'Gaplar', keys: [], text: "Toshkent O'zbekistonning poytaxti. Samarqand va Buxoro qadimiy shaharlar." },
      ]},
      { id: 'num', title: "Raqamlar", sub: '1 2 3 4 5 · 6 7 8 9 0', steps: [
        { id: 'intro', type: 'intro', title: "Raqamlar qatori", keys: ['1','2','3','4','5','6','7','8','9','0'],
          text: "Raqamlar eng yuqori qatorda. Har bir raqamni o'sha ustundagi barmoq bosadi: 1 — chap jimjiloq, 4 va 5 — chap ko'rsatkich, 6 va 7 — o'ng ko'rsatkich, 0 — o'ng jimjiloq. Bu qatorga barmoq uzoq cho'ziladi, shuning uchun shoshilmang." },
        { id: 'n15', title: '1 dan 5 gacha', keys: ['1','2','3','4','5'], text: 'a1a s2s d3d f4f f5f 12 34 45 123 2345 51 15' },
        { id: 'n60', title: '6 dan 0 gacha', keys: ['6','7','8','9','0'], text: 'j6j j7j k8k l9l ;0; 67 89 90 678 6790 70 96' },
        { id: 'sent', title: 'Raqamli gaplar', keys: [], text: "O'zbekiston 1991 yilda mustaqil bo'ldi. Bir yilda 12 oy va 365 kun bor." },
      ]},
    ];

    /* which finger presses which key (QWERTY) */
    const FINGERS = ['lp','lr','lm','li','ri','rm','rr','rp','th'];
    const KEY_FINGER = { shiftL: 'lp', shiftR: 'rp' };
    [['lp', "`1qaz"], ['lr', '2wsx'], ['lm', '3edc'], ['li', '45rtfgvb'], ['ri', '67yuhjnm'],
     ['rm', '8ik,'], ['rr', '9ol.'], ['rp', "0-=p[];'/\\"], ['th', ' ']].forEach(([f, ks])=>{ for(const k of ks) KEY_FINGER[k] = f; });
    const KB_ROWS = [
      ['`','1','2','3','4','5','6','7','8','9','0','-','='],
      ['q','w','e','r','t','y','u','i','o','p','[',']'],
      ['a','s','d','f','g','h','j','k','l',';',"'"],
      ['shiftL','z','x','c','v','b','n','m',',','.','/','shiftR'],
      [' '],
    ];
    const SHIFTED = { '?': '/', '!': '1', ':': ';', '"': "'", '(': '9', ')': '0' };
    const NS = 'tz_lessons';

    const flat = [];   // every step in order: unlocking walks this list
    LESSONS.forEach((L, li)=> L.steps.forEach((s, si)=> flat.push({ li, si, key: L.id + ':' + s.id })));
    const stepKey = (li, si)=> LESSONS[li].id + ':' + LESSONS[li].steps[si].id;
    const idxOf = (li, si)=> flat.findIndex(f=> f.li === li && f.si === si);

    let progress = {}, progressUid = null, loading = null;
    let cur = null, drill = null, resultOpen = false, justUnlocked = null;
    const view = document.getElementById('view-lessons');
    const $ = (id)=> document.getElementById(id);

    /* ---------- the physical key (and Shift) behind a character ---------- */
    function keyInfo(ch){
      let base = ch, shifted = false;
      if(SHIFTED[ch]){ base = SHIFTED[ch]; shifted = true; }
      else if(ch !== ch.toLowerCase()){ base = ch.toLowerCase(); shifted = true; }
      const finger = KEY_FINGER[base];
      const shift = shifted && finger ? (finger[0] === 'l' ? 'shiftR' : 'shiftL') : null;
      return { base, finger, shift };
    }
    const fingerName = (f)=> t('ls.f.' + f);
    const keyLabel = (k)=> k === ' ' ? t('ls.space') : k === 'shiftL' || k === 'shiftR' ? 'Shift' : k.toUpperCase();

    /* ---------- progress: server first, localStorage as a cache / offline fallback ---------- */
    function readCache(){
      try{ const c = JSON.parse(localStorage.getItem(NS) || 'null'); return c && c.uid === uid ? (c.progress || {}) : {}; }catch(e){ return {}; }
    }
    function writeCache(){ try{ localStorage.setItem(NS, JSON.stringify({ uid, progress })); }catch(e){} }
    const better = (a, b)=> !b || (a.stars || 0) > (b.stars || 0) || ((a.stars || 0) === (b.stars || 0) && (a.wpm || 0) > (b.wpm || 0));
    function pushStep(key, r){
      if(!fbReady || !uid) return;
      api('PUT', '/lessons', { step: key, stars: r.stars || 0, wpm: r.wpm || 0, acc: r.acc || 0 })
        .catch(err=> logDebug('lessons save: ' + err.message));
    }
    /* fetched every time the view opens, so steps passed on another computer show up */
    function loadProgress(){
      if(loading) return loading;
      const forUid = uid;
      if(progressUid !== uid) progress = readCache();
      loading = (fbReady && uid ? api('GET', '/lessons') : Promise.reject(new Error('offline')))
        .then(res=>{
          if(uid !== forUid) return;
          const server = res.progress || {}, local = Object.assign(readCache(), progress);
          progress = Object.assign({}, server);
          /* anything only this browser knows about (a save that never arrived) goes up again */
          for(const [k, r] of Object.entries(local)){
            if(better(r, server[k])){ progress[k] = r; pushStep(k, r); }
          }
          writeCache();
        })
        .catch(err=> logDebug('lessons load: ' + err.message))
        .finally(()=>{ progressUid = forUid; loading = null; });
      return loading;
    }
    const firstOpen = ()=> flat.findIndex(f=> !progress[f.key]);   // -1 once everything is passed
    const isLocked = (li, si)=>{ const fo = firstOpen(); return fo !== -1 && idxOf(li, si) > fo; };

    /* ---------- screens ---------- */
    function show(which){
      if(document.activeElement && document.activeElement.blur && view.contains(document.activeElement)) document.activeElement.blur();
      $('lsMap').style.display = which === 'map' ? '' : 'none';
      $('lsLesson').style.display = which === 'lesson' ? '' : 'none';
    }
    function stopDrill(){ if(drill){ drill.stop(); drill = null; } }

    /* ---------- map ---------- */
    const ICONS = {
      lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
      intro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></svg>',
    };
    const starsHtml = (n)=> [1,2,3].map(i=> `<span class="${i <= n ? '' : 'off'}">★</span>`).join('');

    function renderMap(){
      const fo = firstOpen();
      let html = '', total = 0, doneCount = 0;
      LESSONS.forEach((L, li)=>{
        let ustars = 0, udone = 0;
        const nodes = L.steps.map((s, si)=>{
          const p = progress[stepKey(li, si)];
          if(p){ doneCount++; udone++; ustars += p.stars || 0; }
          const i = idxOf(li, si);
          const state = p ? 'done' : i === fo ? 'current' : 'locked';
          const offset = Math.round(Math.sin(si * Math.PI / 4) * 125);   // a snake: centre, right, far right, right, centre, left...
          const icon = state === 'locked' ? ICONS.lock : s.type === 'intro' ? ICONS.intro : state === 'done' ? '✓' : '★';
          return `<div class="ls-node-wrap${state === 'locked' ? ' is-locked' : ''}" style="--o:${offset}px">` +
            (state === 'current' ? `<div class="ls-tag">${escapeHtml(t(i === 0 ? 'ls.tag.start' : 'ls.tag.here'))}</div>` : '') +
            `<button class="ls-node ${state}" data-l="${li}" data-s="${si}"${state === 'locked' ? ' disabled' : ''} aria-label="${escapeHtml(s.title)}">${icon}</button>` +
            `<div class="ls-node-label">${escapeHtml(s.title)}</div><div class="ls-node-stars">${p && p.stars ? starsHtml(p.stars) : ''}</div></div>`;
        }).join('');
        total += ustars;
        const drills = L.steps.filter(s=> s.type !== 'intro').length;
        html += `<div class="ls-unit${udone === L.steps.length ? ' complete' : ''}"><div class="ls-unit-num">${udone === L.steps.length ? '✓' : li + 1}</div>` +
          `<div class="ls-unit-text"><h3>${escapeHtml(L.title)}</h3><p>${escapeHtml(L.sub)}</p></div><div class="ls-unit-stars">★ ${ustars} / ${drills * 3}</div></div>` +
          `<div class="ls-path"><svg class="ls-trail" aria-hidden="true"></svg>${nodes}</div>`;
      });
      $('lsPaths').innerHTML = html;
      const maxStars = flat.filter(f=> LESSONS[f.li].steps[f.si].type !== 'intro').length * 3;
      const pct = Math.round(doneCount / flat.length * 100);
      $('lsOvText').textContent = t('ls.progress', { done: doneCount, total: flat.length, stars: total, max: maxStars });
      $('lsRingFg').style.strokeDashoffset = String(157 - 157 * pct / 100);
      $('lsRingTxt').textContent = pct + '%';
      const nextStep = fo === -1 ? null : LESSONS[flat[fo].li].steps[flat[fo].si];
      $('lsContinue').textContent = fo === -1 ? t('ls.again') : doneCount === 0 ? t('ls.begin') : t('ls.continue');
      $('lsNextName').textContent = nextStep ? t('ls.nextIs', { name: nextStep.title }) : t('ls.allDone');
      $('lsFinish').classList.toggle('won', fo === -1);
      $('lsFinishText').textContent = fo === -1 ? t('ls.trophyWon') : t('ls.trophy');
      drawTrails();
      if(justUnlocked){
        const b = $('lsPaths').querySelector(`.ls-node[data-l="${justUnlocked.li}"][data-s="${justUnlocked.si}"]`);
        justUnlocked = null;
        if(b) setTimeout(()=>{ b.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(()=> sparksAt(b), 350); }, 120);
      }
    }

    /* dotted trail through the node centres; the stretch already walked is drawn in the accent colour */
    function drawTrails(){
      view.querySelectorAll('.ls-path').forEach(path=>{
        const svg = path.querySelector('.ls-trail'), box = path.getBoundingClientRect();
        const nodes = [...path.querySelectorAll('.ls-node')];
        const pts = nodes.map(n=>{ const r = n.getBoundingClientRect(); return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top]; });
        let bg = '', fg = '';
        for(let i = 0; i < pts.length - 1; i++){
          const a = pts[i], b = pts[i + 1], my = (a[1] + b[1]) / 2;
          const d = `M${a[0]} ${a[1]} C${a[0]} ${my} ${b[0]} ${my} ${b[0]} ${b[1]}`;
          if(nodes[i].classList.contains('done') && !nodes[i + 1].classList.contains('locked')) fg += d; else bg += d;
        }
        svg.innerHTML = `<path class="bg" d="${bg}"/><path class="fg" d="${fg}"/>`;
      });
    }
    function applyScale(){ view.style.setProperty('--ls-k', String(Math.min(1, Math.max(.35, (window.innerWidth - 80) / 640)))); }
    window.addEventListener('resize', ()=>{ applyScale(); if(view.classList.contains('active') && $('lsMap').style.display !== 'none') drawTrails(); });

    function sparksAt(el){
      const r = el.getBoundingClientRect(), box = $('lsSparks');
      box.innerHTML = Array.from({ length: 18 }, (_, i)=>{
        const a = i / 18 * Math.PI * 2, d = 50 + Math.random() * 40;
        return `<i style="left:${r.left + r.width / 2}px; top:${r.top + r.height / 2}px; --dx:${Math.cos(a) * d}px; --dy:${Math.sin(a) * d}px"></i>`;
      }).join('');
      setTimeout(()=>{ box.innerHTML = ''; }, 1000);
    }

    /* ---------- lesson screen ---------- */
    function renderKeyboard(){
      $('lsKb').innerHTML = KB_ROWS.map(row=> '<div class="ls-kb-row">' + row.map(k=>{
        const cls = k === ' ' ? ' space' : k.startsWith('shift') ? ' shift' : '';
        return `<div class="ls-key${cls}${k === 'f' || k === 'j' ? ' home' : ''}" data-k="${k === ' ' ? 'space' : escapeHtml(k)}" style="background:var(--ls-${KEY_FINGER[k]})">${k === ' ' ? '' : escapeHtml(keyLabel(k))}</div>`;
      }).join('') + '</div>').join('');
      $('lsLegend').innerHTML = FINGERS.map(f=> `<span style="--c:var(--ls-${f})">${escapeHtml(fingerName(f))}</span>`).join('');
    }
    function keyEl(k){ return $('lsKb').querySelector(`[data-k="${k === ' ' ? 'space' : CSS.escape(k)}"]`); }

    /* two hands drawn as tapered fingers with nails and knuckle creases over a soft palm; the right
       hand is the left one mirrored. Each finger is a shape that lights up in its key colour. */
    function handSvg(left){
      const ids = left ? ['lp','lr','lm','li'] : ['rp','rr','rm','ri'];   // drawn pinky → index (left hand's view)
      const cxs = [27, 63, 99, 135], tops = [78, 44, 28, 50];
      const gid = 'lsSkin' + (left ? 'L' : 'R');
      const finger = (id, cx, top, base, wb, wt)=>{
        const r = wt / 2, len = base - top;
        return `<path class="ls-finger" data-f="${id}" fill="url(#${gid})" d="M${cx - wb/2} ${base} L${cx - wt/2} ${top + r} Q${cx - wt/2} ${top} ${cx} ${top} Q${cx + wt/2} ${top} ${cx + wt/2} ${top + r} L${cx + wb/2} ${base}Z"/>` +
          `<rect class="ls-nail" x="${cx - wt*0.3}" y="${top + 6}" width="${wt*0.6}" height="${wt*0.5}" rx="${wt*0.22}"/>` +
          `<path class="ls-crease" d="M${cx - wt*0.3} ${top + len*0.42}H${cx + wt*0.3}M${cx - wt*0.3} ${top + len*0.7}H${cx + wt*0.3}"/>`;
      };
      let f = '';
      ids.forEach((id, i)=>{ f += finger(id, cxs[i], tops[i], 150, 31, 27); });
      const thumb = `<g transform="translate(-24 6) rotate(34 166 200)"><path class="ls-finger" data-f="th" fill="url(#${gid})" d="M150 200 L152 132 Q152 112 168 112 Q184 112 184 132 L186 200Z"/>` +
        '<rect class="ls-nail" x="158" y="119" width="20" height="17" rx="7"/><path class="ls-crease" d="M157 160H179"/></g>';
      const palmFill = '<path class="ls-palm-fill" fill="url(#' + gid + ')" d="M10 140 Q10 120 30 120 L144 120 Q156 120 156 140 L150 192 Q146 240 116 240 L50 240 Q20 240 16 192Z"/>';
      const palmLine = '<path class="ls-palm-line" d="M10 128 L10 140 L16 192 Q20 240 50 240 L116 240 Q146 240 150 192 L156 140 L156 128"/>';
      const defs = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b3b45"/><stop offset="1" stop-color="#25252c"/></linearGradient></defs>`;
      const body = thumb + f + palmFill + palmLine;
      return `<svg viewBox="-50 10 270 240" aria-hidden="true">${defs}${left ? body : `<g transform="translate(166 0) scale(-1 1)">${body}</g>`}</svg>`;
    }

    function highlight(keys, nextCh){
      view.querySelectorAll('.ls-key').forEach(el=> el.classList.remove('lit', 'next'));
      keys.forEach(k=>{ const el = keyEl(k); if(el) el.classList.add('lit'); });
      view.querySelectorAll('.ls-finger').forEach(el=>{ el.style.fill = ''; });
      if(nextCh === undefined) return;
      const info = keyInfo(nextCh);
      [info.base, info.shift].forEach(k=>{
        if(!k) return;
        const el = keyEl(k); if(el) el.classList.add('next');
        const fe = view.querySelector(`.ls-finger[data-f="${KEY_FINGER[k]}"]`); if(fe) fe.style.fill = `var(--ls-${KEY_FINGER[k]})`;
      });
    }
    function hintHtml(ch){
      const info = keyInfo(ch);
      if(!info.finger) return '';
      const chip = (f, label)=> `<i style="background:var(--ls-${f})">${escapeHtml(label || fingerName(f))}</i>`;
      const shown = ch === ' ' ? t('ls.space') : ch;
      return `${escapeHtml(t('ls.next'))} <b>${escapeHtml(shown)}</b> — ` +
        (info.shift ? chip(KEY_FINGER[info.shift], t(info.shift === 'shiftL' ? 'ls.shiftL' : 'ls.shiftR')) + ' + ' : '') + chip(info.finger);
    }

    /* one drill: the right key has to be pressed to move on; wrong presses are counted (like typing.com) */
    function createDrill(text, hooks){
      const st = { pos: 0, errors: 0, wrongAt: new Set(), start: 0, done: false };
      function onKey(e){
        if(st.done || resultOpen || !view.classList.contains('active') || e.ctrlKey || e.metaKey || e.altKey) return;
        const tag = document.activeElement && document.activeElement.tagName;
        if(tag === 'INPUT' || tag === 'TEXTAREA') return;
        if(e.key.length !== 1) return;
        e.preventDefault();
        if(!st.start) st.start = performance.now();
        const expected = text[st.pos];
        const ok = typedAs(expected, e.key, false) === expected;
        if(typeof typingFeedback === 'function') typingFeedback(ok, null);
        if(ok){
          st.pos++;
          hooks.update(st, true);
          if(st.pos >= text.length){
            st.done = true;
            const minutes = Math.max((performance.now() - st.start) / 60000, 1 / 600);
            const acc = Math.round(text.length / (text.length + st.errors) * 100);
            const wpm = Math.min(300, Math.round((text.length / 5) / minutes));
            hooks.finish({ acc, wpm, errors: st.errors, stars: acc >= 95 ? 3 : acc >= 85 ? 2 : 1 });
          }
        } else {
          st.errors++;
          st.wrongAt.add(st.pos);
          hooks.update(st, false, e.key.toLowerCase());
        }
      }
      document.addEventListener('keydown', onKey);
      hooks.update(st, true);
      return { stop(){ document.removeEventListener('keydown', onKey); } };
    }

    function openStep(li, si){
      if(isLocked(li, si)) return;
      stopDrill();
      closeResult();
      cur = { li, si };
      const L = LESSONS[li], step = L.steps[si];
      show('lesson');
      window.scrollTo(0, 0);
      $('lsStepTitle').textContent = step.title;
      $('lsStepOf').textContent = `${L.title} · ${si + 1} / ${L.steps.length}`;
      $('lsBar').style.width = '0%';
      const isIntro = step.type === 'intro';
      $('lsIntro').style.display = isIntro ? '' : 'none';
      $('lsIntroBtns').style.display = isIntro ? '' : 'none';
      $('lsDrill').style.display = isIntro ? 'none' : '';
      if(isIntro){
        $('lsIntroText').textContent = step.text;
        highlight(step.keys);
        view.querySelectorAll('.ls-finger').forEach(el=>{
          if(step.keys.some(k=> KEY_FINGER[k] === el.dataset.f)) el.style.fill = `var(--ls-${el.dataset.f})`;
        });
        return;
      }
      const line = $('lsLine');
      line.innerHTML = [...step.text].map(c=> `<span class="${c === ' ' ? 'space' : ''}">${c === ' ' ? '&nbsp;' : escapeHtml(c)}</span>`).join('');
      const spans = line.children;
      drill = createDrill(step.text, {
        update(st, ok, wrongKey){
          for(let i = 0; i < spans.length; i++){
            spans[i].className = (step.text[i] === ' ' ? 'space ' : '') + (i < st.pos ? (st.wrongAt.has(i) ? 'fixed' : 'ok') : i === st.pos ? 'cur' + (ok ? '' : ' bad') : '');
          }
          const next = step.text[st.pos];
          highlight(step.keys, next);
          if(!ok && wrongKey){
            const el = keyEl(SHIFTED[wrongKey] || wrongKey);
            if(el){ el.classList.remove('miss'); void el.offsetWidth; el.classList.add('miss'); }
          }
          $('lsHint').innerHTML = next === undefined ? '' : hintHtml(next);
          $('lsErr').textContent = st.errors;
          $('lsAcc').textContent = (st.pos ? Math.round(st.pos / (st.pos + st.errors) * 100) : 100) + '%';
          $('lsBar').style.width = (st.pos / step.text.length * 100) + '%';
        },
        finish(r){
          const unlocked = completeStep(r);
          setTimeout(()=> showResult(r, unlocked), 150);
        },
      });
    }

    /* records a passed step (an intro passes on "start"); returns the step it unlocked, if any */
    function completeStep(r){
      const key = stepKey(cur.li, cur.si);
      const wasOpen = firstOpen();
      if(better(r, progress[key])){
        progress[key] = { stars: r.stars || 0, wpm: r.wpm || 0, acc: r.acc || 0 };
        writeCache();
        pushStep(key, progress[key]);
      }
      const nowOpen = firstOpen(), n = flat[nowOpen];
      justUnlocked = nowOpen !== wasOpen && n ? { li: n.li, si: n.si } : null;
      return justUnlocked;
    }

    function showResult(r, unlocked){
      resultOpen = true;
      $('lsResTitle').textContent = t(r.stars === 3 ? 'ls.res3' : r.stars === 2 ? 'ls.res2' : 'ls.res1');
      $('lsResStars').innerHTML = [1,2,3].map(i=> `<span class="${i <= r.stars ? 'on' : ''}">★</span>`).join('');
      $('lsResWpm').textContent = r.wpm;
      $('lsResAcc').textContent = r.acc + '%';
      $('lsResErr').textContent = r.errors;
      $('lsResUnlock').textContent = unlocked ? '🔓 ' + t('ls.unlocked', { name: LESSONS[unlocked.li].steps[unlocked.si].title })
        : firstOpen() === -1 ? '🏆 ' + t('ls.allDone') : r.stars < 2 ? t('ls.tryTip') : '';
      $('lsResult').classList.add('show');
      $('lsBtnNext').focus({ preventScroll: true });
      if(r.stars === 3) setTimeout(()=> sparksAt($('lsResStars')), 300);
    }
    function closeResult(){ resultOpen = false; $('lsResult').classList.remove('show'); }

    function goMap(){
      stopDrill(); closeResult(); show('map'); renderMap();
      if(!justUnlocked) scrollToCurrent();
    }
    function scrollToCurrent(){
      const b = $('lsPaths').querySelector('.ls-node.current');
      if(b && b.getBoundingClientRect().top > window.innerHeight - 120) b.scrollIntoView({ block: 'center' });
    }
    function nextStep(){
      const n = flat[idxOf(cur.li, cur.si) + 1];
      if(n && !isLocked(n.li, n.si)) openStep(n.li, n.si); else goMap();
    }
    function openCurrent(){
      const fo = firstOpen(), f = flat[fo === -1 ? 0 : fo];
      openStep(f.li, f.si);
    }

    /* ---------- wiring ---------- */
    view.innerHTML = `
      <div id="lsMap" class="ls-map">
        <h2 class="view-title" data-i18n="ls.title"></h2>
        <p class="view-sub" data-i18n="ls.subtitle"></p>
        <div class="ls-overview">
          <svg class="ls-ring" width="62" height="62" viewBox="0 0 62 62" aria-hidden="true"><circle cx="31" cy="31" r="25" fill="none" stroke="var(--border)" stroke-width="6"/><circle id="lsRingFg" cx="31" cy="31" r="25" fill="none" stroke="var(--accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray="157" stroke-dashoffset="157" transform="rotate(-90 31 31)"/><text id="lsRingTxt" x="31" y="36" text-anchor="middle">0%</text></svg>
          <div class="ls-ov-text"><b id="lsNextName"></b><span id="lsOvText"></span></div>
          <button class="btn accent" id="lsContinue"></button>
        </div>
        <div id="lsPaths"></div>
        <div class="ls-finish" id="lsFinish"><div class="ls-trophy">🏆</div><span id="lsFinishText"></span></div>
        <p class="ls-note" data-i18n="ls.note"></p>
      </div>
      <div id="lsLesson" class="ls-lesson" style="display:none">
        <div class="panel ls-panel">
          <div class="ls-top"><button class="ls-back" id="lsBack" type="button">← <span data-i18n="ls.map"></span> <kbd>Esc</kbd></button><h3 id="lsStepTitle"></h3><span class="ls-of" id="lsStepOf"></span></div>
          <div class="ls-bar"><div id="lsBar"></div></div>
          <p class="ls-intro" id="lsIntro"><span id="lsIntroText"></span></p>
          <div id="lsDrill">
            <div class="ls-line" id="lsLine"></div>
            <div class="ls-hint-row"><div class="ls-hint" id="lsHint"></div>
              <div class="ls-stats"><span><span data-i18n="ls.acc"></span> <b id="lsAcc">100%</b></span><span><span data-i18n="ls.errors"></span> <b id="lsErr">0</b></span></div></div>
          </div>
          <div class="ls-kb" id="lsKb"></div>
          <div class="ls-hands">${handSvg(true)}${handSvg(false)}</div>
          <div class="ls-legend" id="lsLegend"></div>
          <div class="ls-intro-btns" id="lsIntroBtns"><button class="btn accent" id="lsStart" type="button"><span data-i18n="ls.startBtn"></span> <kbd>Enter</kbd></button></div>
          <div class="ls-result" id="lsResult">
            <div class="ls-result-card">
              <h3 id="lsResTitle"></h3>
              <div class="ls-result-stars" id="lsResStars"></div>
              <div class="ls-result-nums"><div><b id="lsResWpm">0</b><span data-i18n="ls.wpm"></span></div><div><b id="lsResAcc">0%</b><span data-i18n="ls.acc"></span></div><div><b id="lsResErr">0</b><span data-i18n="ls.errors"></span></div></div>
              <div class="ls-unlock" id="lsResUnlock"></div>
              <div class="ls-result-btns"><button class="btn" id="lsBtnRetry" type="button" data-i18n="ls.retry"></button><button class="btn" id="lsBtnMap" type="button" data-i18n="ls.map"></button><button class="btn accent" id="lsBtnNext" type="button"><span data-i18n="ls.nextBtn"></span> <kbd>Enter</kbd></button></div>
            </div>
          </div>
        </div>
      </div>
      <div class="ls-sparks" id="lsSparks"></div>`;

    $('lsPaths').addEventListener('click', (e)=>{ const b = e.target.closest('.ls-node:not(.locked)'); if(b) openStep(+b.dataset.l, +b.dataset.s); });
    $('lsContinue').addEventListener('click', openCurrent);
    $('lsStart').addEventListener('click', ()=>{ completeStep({ stars: 0, wpm: 0, acc: 0, errors: 0 }); nextStep(); });
    $('lsBtnNext').addEventListener('click', nextStep);
    $('lsBtnRetry').addEventListener('click', ()=> openStep(cur.li, cur.si));
    $('lsBtnMap').addEventListener('click', goMap);
    $('lsBack').addEventListener('click', goMap);
    document.addEventListener('keydown', (e)=>{
      if(!view.classList.contains('active') || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = document.activeElement && document.activeElement.tagName;
      if(tag === 'INPUT' || tag === 'TEXTAREA') return;
      const onMap = $('lsMap').style.display !== 'none';
      if(e.key === 'Escape' && !onMap){ e.preventDefault(); goMap(); return; }
      if(e.key !== 'Enter' || tag === 'BUTTON') return;   // a focused button handles its own Enter
      if(onMap){ e.preventDefault(); openCurrent(); return; }
      if(resultOpen){ e.preventDefault(); nextStep(); }
      else if(LESSONS[cur.li].steps[cur.si].type === 'intro'){ e.preventDefault(); $('lsStart').click(); }
    });

    /* called by switchView('lessons'); always lands on the map */
    window.renderLessons = function(){
      /* a clicked nav button keeps focus and would take the Enter that starts the next step */
      const fe = document.activeElement;
      if(fe && fe.closest && fe.closest('#mainNav')) fe.blur();
      applyScale();
      stopDrill(); closeResult(); show('map');
      renderKeyboard();
      renderMap();
      loadProgress().then(()=>{ if(view.classList.contains('active') && $('lsMap').style.display !== 'none'){ renderMap(); scrollToCurrent(); } });
    };
    /* language switch: refresh the texts built in JS without leaving a running drill */
    window.lessonsLangChanged = function(){
      renderKeyboard();
      if($('lsMap').style.display !== 'none') renderMap();
      else if(drill){ const el = $('lsLine').querySelector('.cur'); const idx = el ? [...$('lsLine').children].indexOf(el) : -1; if(idx >= 0) $('lsHint').innerHTML = hintHtml(LESSONS[cur.li].steps[cur.si].text[idx]); }
    };
    /* leaving the view stops the drill so its key handler can't swallow keys elsewhere */
    window.leaveLessons = function(){ stopDrill(); closeResult(); };
  })();
