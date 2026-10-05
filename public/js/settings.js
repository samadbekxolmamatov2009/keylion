  /* ============ personal settings: background, accent, caret, typing animations, sounds ============
     Loaded in <head> so the saved look is applied before first paint (no flash of the default theme).
     Everything that needs the DOM, t() or the backend is only called later, from the profile view.
     Storage: localStorage for instant apply on this device; for signed-in users the same object is
     synced to the server (PUT /api/me/settings) so it follows them to other devices. */
  /* one-off: move this browser's data from the old storage keys (before the rename) to the new ones */
  try{
    for(let i = localStorage.length - 1; i >= 0; i--){
      const k = localStorage.key(i), m = /^(kl_|keylion\.)(.*)$/.exec(k || '');
      if(!m) continue;
      const nk = (m[1] === 'kl_' ? 'tz_' : 'tezlash.') + m[2];
      if(localStorage.getItem(nk) === null) localStorage.setItem(nk, localStorage.getItem(k));
      localStorage.removeItem(k);
    }
  }catch(e){}

  const PREF_DEFAULTS = {
    bg: 'none', bgX: 50, bgY: 50, dim: 45, blur: 0, glass: true, accent: 'auto',
    caret: 'line', caretMotion: 'smooth', caretBlink: true,
    letterAnim: 'none', errorFx: 'red', finishFx: 'countup', sound: 'error',
  };
  const BG_PRESETS = [
    { id: 'mountains', accent: '#f2a65a' },
    { id: 'city',      accent: '#ff8ad8' },
    { id: 'registan',  accent: '#e8b647' },
    { id: 'nebula',    accent: '#b794ff' },
    { id: 'forest',    accent: '#86d9ae' },
    { id: 'aurora',    accent: '#4ff0a8' },
  ];
  const ACCENT_SWATCHES = ['#e0a940', '#f2a65a', '#f05252', '#ff8ad8', '#b794ff', '#5b9dea', '#4fd1d9', '#4ff0a8', '#86d9ae'];
  const PREFS_KEY = 'tz_prefs', LOCAL_BG_KEY = 'tz_bg_local', ACCENT_CACHE = 'tz_accent:';
  const lsGet = (k)=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } };
  const lsSet = (k, v)=>{ try{ localStorage.setItem(k, v); return true; }catch(e){ return false; } };

  let prefs = Object.assign({}, PREF_DEFAULTS, (()=>{ try{ return JSON.parse(lsGet(PREFS_KEY) || '{}'); }catch(e){ return {}; } })());
  let customBgs = [];        // [{key, url}] uploaded by the signed-in user
  let profilePublic = true;

  function bgUrl(bg){
    if(!bg || bg === 'none') return null;
    /* absolute URLs: a relative url() inside a CSS variable resolves against the stylesheet (css/), not the page */
    if(BG_PRESETS.some(p=> p.id === bg)) return new URL('bg/' + bg + '.svg', document.baseURI).href;
    if(bg.startsWith('custom:')) return new URL('/api/bg/' + encodeURIComponent(bg.slice(7)), document.baseURI).href;
    if(bg === 'local') return lsGet(LOCAL_BG_KEY);
    return null;
  }

  /* ---- colour helpers for the accent ---- */
  function hexToRgb(h){ const n = parseInt(h.slice(1), 16); return [n>>16 & 255, n>>8 & 255, n & 255]; }
  function rgbToHex(r,g,b){ return '#' + [r,g,b].map(v=> Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join(''); }
  function mix(hex, withHex, amt){ const a = hexToRgb(hex), b = hexToRgb(withHex); return rgbToHex(a[0]+(b[0]-a[0])*amt, a[1]+(b[1]-a[1])*amt, a[2]+(b[2]-a[2])*amt); }

  /* most vivid colour of an image: average of its most saturated, mid-bright pixels */
  function extractAccent(url){
    return new Promise((resolve)=>{
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = ()=>{
        try{
          const c = document.createElement('canvas'); c.width = 64; c.height = 36;
          const x = c.getContext('2d'); x.drawImage(img, 0, 0, 64, 36);
          const d = x.getImageData(0, 0, 64, 36).data, px = [];
          for(let i=0;i<d.length;i+=4){
            const r=d[i], g=d[i+1], b=d[i+2], mx=Math.max(r,g,b), mn=Math.min(r,g,b);
            const sat = mx ? (mx-mn)/mx : 0, lum = (mx+mn)/510;
            if(lum > .25 && lum < .85) px.push([sat, r, g, b]);
          }
          px.sort((a,b)=> b[0]-a[0]);
          const top = px.slice(0, Math.max(8, Math.floor(px.length*0.08)));
          if(!top.length) return resolve(null);
          let r=0,g=0,b=0; top.forEach(p=>{ r+=p[1]; g+=p[2]; b+=p[3]; });
          let hex = rgbToHex(r/top.length, g/top.length, b/top.length);
          /* keep it readable as text on a dark UI */
          const [rr,gg,bb] = hexToRgb(hex);
          if((rr*299+gg*587+bb*114)/1000 < 120) hex = mix(hex, '#ffffff', .35);
          resolve(hex);
        }catch(e){ resolve(null); }
      };
      img.onerror = ()=> resolve(null);
      img.src = url;
    });
  }

  function resolveAccent(){
    if(prefs.accent && prefs.accent !== 'auto') return prefs.accent;
    const preset = BG_PRESETS.find(p=> p.id === prefs.bg);
    if(preset) return preset.accent;
    if(prefs.bg && prefs.bg !== 'none'){
      const cached = lsGet(ACCENT_CACHE + prefs.bg);
      if(cached) return cached === '-' ? null : cached;
      const forBg = prefs.bg, url = bgUrl(forBg);
      if(url) extractAccent(url).then((hex)=>{ lsSet(ACCENT_CACHE + forBg, hex || '-'); if(prefs.bg === forBg) applyPrefs(); });
    }
    return null;
  }

  const PREF_CLASSES = ['caret-', 'cmotion-', 'letter-', 'errfx-'];
  function applyPrefs(){
    const root = document.documentElement;
    const url = bgUrl(prefs.bg);
    root.classList.toggle('has-bg', !!url);
    root.classList.toggle('glass', !!url && prefs.glass);
    root.style.setProperty('--bg-image', url ? 'url("' + url.replace(/"/g, '%22') + '")' : 'none');
    root.style.setProperty('--bg-pos', prefs.bgX + '% ' + prefs.bgY + '%');
    root.style.setProperty('--bg-dim', String(prefs.dim / 100));
    root.style.setProperty('--bg-blur', prefs.blur + 'px');
    root.className.split(/\s+/).filter(c=> PREF_CLASSES.some(p=> c.startsWith(p))).forEach(c=> root.classList.remove(c));
    root.classList.add('caret-' + prefs.caret, 'cmotion-' + prefs.caretMotion, 'letter-' + prefs.letterAnim, 'errfx-' + prefs.errorFx);
    root.classList.toggle('caret-noblink', !prefs.caretBlink);
    const accent = resolveAccent();
    if(accent){
      root.style.setProperty('--accent', accent);
      root.style.setProperty('--accent-dim', mix(accent, '#000000', .3));
      root.style.setProperty('--accent-bg', mix(accent, '#0a0a0c', .86));
    } else {
      ['--accent', '--accent-dim', '--accent-bg'].forEach(v=> root.style.removeProperty(v));
    }
  }
  applyPrefs();

  /* ---- saving: local immediately, server debounced ---- */
  let prefsSyncTimer = null;
  function savePrefs(syncServer){
    lsSet(PREFS_KEY, JSON.stringify(prefs));
    applyPrefs();
    if(syncServer === false) return;
    clearTimeout(prefsSyncTimer);
    prefsSyncTimer = setTimeout(pushPrefs, 700);
  }
  function pushPrefs(extra){
    if(typeof api !== 'function' || !fbReady || isGuest) return Promise.resolve();
    const serverPrefs = Object.assign({}, prefs);
    if(serverPrefs.bg === 'local') serverPrefs.bg = 'none';   // a guest-only local image never leaves the device
    return api('PUT', '/me/settings', Object.assign({ prefs: serverPrefs }, extra || {}))
      .then((r)=>{ if(r && typeof r.profilePublic === 'boolean') profilePublic = r.profilePublic; })
      .catch((err)=> logDebug('sozlamalarni saqlashda xato: ' + err.message));
  }
  function setPref(key, value){
    prefs[key] = value;
    savePrefs();
    if(typeof refreshSettingsUI === 'function') refreshSettingsUI();
  }
  /* called after login: the account's saved settings win over this device's */
  function adoptServerPrefs(serverPrefs){
    if(!serverPrefs) { pushPrefs(); return; }
    prefs = Object.assign({}, PREF_DEFAULTS, serverPrefs);
    savePrefs(false);
  }

  /* ---- typing feedback: sounds + error shake ---- */
  let sfxCtx = null, noiseBuf = null;
  function sfx(){
    if(!sfxCtx) sfxCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(sfxCtx.state === 'suspended') sfxCtx.resume();
    return sfxCtx;
  }
  function playKeySound(){
    if(prefs.sound !== 'mech' && prefs.sound !== 'soft') return;
    try{
      const ctx = sfx(), t0 = ctx.currentTime;
      if(prefs.sound === 'soft'){
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(520 + Math.random()*60, t0);
        g.gain.setValueAtTime(0.045, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
        o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + 0.06);
        return;
      }
      if(!noiseBuf){
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
        const ch = noiseBuf.getChannelData(0);
        for(let i=0;i<ch.length;i++) ch[i] = (Math.random()*2-1) * Math.pow(1 - i/ch.length, 3);
      }
      const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = 1800 + Math.random()*900; bp.Q.value = 1.4;
      g.gain.value = 0.32;
      src.connect(bp).connect(g).connect(ctx.destination); src.start(t0);
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(140, t0); o.frequency.exponentialRampToValueAtTime(60, t0 + 0.04);
      og.gain.setValueAtTime(0.08, t0); og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
      o.connect(og).connect(ctx.destination); o.start(t0); o.stop(t0 + 0.06);
    }catch(e){}
  }
  /* one call per typed character from the test / race inputs */
  function typingFeedback(ok, wrapEl, silent){
    if(!silent){
      if(ok) playKeySound();
      else if(prefs.sound !== 'off') playErrorTick();
    }
    if(!ok && prefs.errorFx === 'shake' && wrapEl){
      wrapEl.classList.remove('kfx-shake');
      void wrapEl.offsetWidth;   // restart the animation
      wrapEl.classList.add('kfx-shake');
    }
  }

  /* ---- end-of-test effects ---- */
  const reducedMotion = ()=> window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function countUp(el, target, suffix){
    if(!el) return;
    const start = performance.now(), dur = 700;
    const step = (now)=>{
      const k = Math.min(1, (now - start) / dur), eased = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(target * eased) + (suffix || '');
      if(k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function confettiBurst(){
    if(reducedMotion()) return;
    const c = document.createElement('canvas');
    c.className = 'confetti-canvas';
    c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio;
    document.body.appendChild(c);
    const x = c.getContext('2d'), s = devicePixelRatio;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e0a940';
    const colors = [accent, '#ffffff', '#7fc95c', '#5b9dea', '#f05252', '#b794ff'];
    const parts = Array.from({ length: 140 }, ()=>({
      x: innerWidth/2 + (Math.random()-.5)*160, y: innerHeight*0.42,
      vx: (Math.random()-.5)*14, vy: -Math.random()*14 - 4, r: Math.random()*Math.PI,
      vr: (Math.random()-.5)*.3, w: 6 + Math.random()*6, h: 3 + Math.random()*4, c: colors[Math.floor(Math.random()*colors.length)],
    }));
    const t0 = performance.now();
    (function frame(now){
      const life = (now - t0) / 1800;
      x.clearRect(0, 0, c.width, c.height);
      parts.forEach(p=>{
        p.vy += 0.38; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        x.save(); x.globalAlpha = Math.max(0, 1 - life); x.translate(p.x*s, p.y*s); x.rotate(p.r);
        x.fillStyle = p.c; x.fillRect(-p.w*s/2, -p.h*s/2, p.w*s, p.h*s); x.restore();
      });
      if(life < 1) requestAnimationFrame(frame); else c.remove();
    })(t0);
  }
  function finishEffects(wpm, acc, wpmEl, accEl){
    if(prefs.finishFx === 'countup' || prefs.finishFx === 'confetti'){
      countUp(wpmEl, wpm); countUp(accEl, acc, '%');
    }
    if(prefs.finishFx === 'confetti') confettiBurst();
  }

  /* ============ settings UI (rendered into the profile view's "settings" tab) ============ */
  let settingsRoot = null, demoTimer = null;

  function segHtml(key, options){
    return '<div class="seg set-seg" data-pref="'+key+'">' + options.map(v=>
      '<button type="button" data-val="'+v+'"'+(String(prefs[key])===String(v)?' class="active"':'')+'>'+escapeHtml(t('set.'+key+'.'+v))+'</button>').join('') + '</div>';
  }
  function rowHtml(label, control, hint){
    return '<div class="set-row"><div class="set-label">'+escapeHtml(label)+(hint?'<small>'+escapeHtml(hint)+'</small>':'')+'</div><div class="set-ctl">'+control+'</div></div>';
  }

  function bgTilesHtml(){
    const tile = (id, url, label, extra)=>
      '<button type="button" class="bg-tile'+(prefs.bg===id?' active':'')+'" data-bg="'+escapeHtml(id)+'" title="'+escapeHtml(label)+'">'+
        (url ? '<span class="bg-tile-img" style="background-image:url(&quot;'+escapeHtml(url)+'&quot;)"></span>' : '<span class="bg-tile-none">∅</span>')+
        '<span class="bg-tile-label">'+escapeHtml(label)+'</span>'+(extra||'')+'</button>';
    let html = tile('none', null, t('set.bg.none'));
    BG_PRESETS.forEach(p=> html += tile(p.id, bgUrl(p.id), t('set.bg.' + p.id)));
    customBgs.forEach((c, i)=> html += tile('custom:' + c.key, c.url, t('set.bg.mine') + ' ' + (i+1), '<span class="bg-tile-del" data-del="'+escapeHtml(c.key)+'" title="'+escapeHtml(t('set.bg.delete'))+'">×</span>'));
    if(lsGet(LOCAL_BG_KEY) && (isGuest || prefs.bg === 'local')) html += tile('local', lsGet(LOCAL_BG_KEY), t('set.bg.mine'));
    const canAdd = isGuest || customBgs.length < 3;
    if(canAdd) html += '<button type="button" class="bg-tile bg-tile-add" id="bgUploadBtn"><span class="bg-tile-none">+</span><span class="bg-tile-label">'+escapeHtml(t('set.bg.upload'))+'</span></button>';
    return html;
  }

  function renderSettings(root){
    settingsRoot = root;
    const accentCtl = '<div class="accent-row"><button type="button" class="accent-sw accent-auto'+(prefs.accent==='auto'?' active':'')+'" data-accent="auto">'+escapeHtml(t('set.accent.auto'))+'</button>' +
      ACCENT_SWATCHES.map(c=> '<button type="button" class="accent-sw'+(prefs.accent===c?' active':'')+'" data-accent="'+c+'" style="background:'+c+'"></button>').join('') +
      '<label class="accent-sw accent-custom" title="'+escapeHtml(t('set.accent.custom'))+'"><input type="color" id="accentPicker" value="'+(prefs.accent!=='auto'?prefs.accent:'#e0a940')+'"></label></div>';
    root.innerHTML =
      '<div class="panel set-panel">'+
        '<h3 class="icon-image">'+escapeHtml(t('set.section.bg'))+'</h3>'+
        '<div class="bg-grid" id="bgGrid">'+bgTilesHtml()+'</div>'+
        '<input type="file" id="bgFileInput" accept="image/jpeg,image/png,image/webp" style="display:none">'+
        '<div class="set-note" id="bgUploadNote">'+escapeHtml(isGuest ? t('set.bg.guestNote') : t('set.bg.uploadNote'))+'</div>'+
        '<div class="bg-tune" id="bgTune">'+
          '<div class="bg-focus" id="bgFocus" title="'+escapeHtml(t('set.bg.focusHint'))+'"><span class="bg-focus-dot" id="bgFocusDot"></span></div>'+
          '<div class="bg-sliders">'+
            rowHtml(t('set.dim'), '<input type="range" min="0" max="85" data-range="dim" value="'+prefs.dim+'"><span class="range-val" data-val-of="dim">'+prefs.dim+'%</span>')+
            rowHtml(t('set.blur'), '<input type="range" min="0" max="20" data-range="blur" value="'+prefs.blur+'"><span class="range-val" data-val-of="blur">'+prefs.blur+'px</span>')+
            rowHtml(t('set.glass'), '<label class="switch"><input type="checkbox" id="glassToggle"'+(prefs.glass?' checked':'')+'><span></span></label>', t('set.glassHint'))+
            '<div class="set-note">'+escapeHtml(t('set.bg.focusHint'))+'</div>'+
          '</div>'+
        '</div>'+
        rowHtml(t('set.accent'), accentCtl)+
      '</div>'+

      '<div class="panel set-panel">'+
        '<h3 class="icon-keyboard">'+escapeHtml(t('set.section.typing'))+'</h3>'+
        '<div class="type-wrap demo-wrap" id="demoWrap"><div class="type-text demo-text" id="demoText"></div></div>'+
        rowHtml(t('set.caret'), segHtml('caret', ['line','block','underline','off']))+
        rowHtml(t('set.caretMotion'), segHtml('caretMotion', ['smooth','fast','instant']))+
        rowHtml(t('set.caretBlink'), segHtml('caretBlink', [true,false]))+
        rowHtml(t('set.letterAnim'), segHtml('letterAnim', ['none','fade','glow','rise']))+
        rowHtml(t('set.errorFx'), segHtml('errorFx', ['red','shake','underline']))+
        rowHtml(t('set.finishFx'), segHtml('finishFx', ['none','countup','confetti']))+
        rowHtml(t('set.sound'), segHtml('sound', ['error','off','mech','soft']))+
      '</div>'+

      (isGuest ? '' :
      '<div class="panel set-panel">'+
        '<h3 class="icon-user">'+escapeHtml(t('set.section.privacy'))+'</h3>'+
        rowHtml(t('set.public'), '<label class="switch"><input type="checkbox" id="publicToggle"'+(profilePublic?' checked':'')+'><span></span></label>', t('set.publicHint'))+
      '</div>')+
      '<div class="set-footer"><button type="button" class="btn" id="btnResetPrefs">'+escapeHtml(t('set.reset'))+'</button></div>';

    wireSettings(root);
    refreshSettingsUI();
    startDemo();
    if(!isGuest && fbReady){
      api('GET', '/me/settings').then((r)=>{
        customBgs = r.uploads || [];
        profilePublic = r.profilePublic !== false;
        const pt = document.getElementById('publicToggle');
        if(pt) pt.checked = profilePublic;
        const grid = document.getElementById('bgGrid');
        if(grid && settingsRoot === root){ grid.innerHTML = bgTilesHtml(); }
      }).catch(()=>{});
    }
  }

  function refreshSettingsUI(){
    const root = settingsRoot;
    if(!root || !root.isConnected) return;
    root.querySelectorAll('.set-seg').forEach(seg=>{
      const key = seg.dataset.pref;
      seg.querySelectorAll('button').forEach(b=> b.classList.toggle('active', String(prefs[key]) === b.dataset.val));
    });
    root.querySelectorAll('.bg-tile[data-bg]').forEach(b=> b.classList.toggle('active', b.dataset.bg === prefs.bg));
    root.querySelectorAll('.accent-sw[data-accent]').forEach(b=> b.classList.toggle('active', b.dataset.accent === prefs.accent));
    const url = bgUrl(prefs.bg);
    const tune = root.querySelector('#bgTune');
    if(tune) tune.classList.toggle('disabled', !url);
    const focus = root.querySelector('#bgFocus');
    if(focus){
      focus.style.backgroundImage = url ? 'url("' + url.replace(/"/g, '%22') + '")' : 'none';
      focus.style.backgroundPosition = prefs.bgX + '% ' + prefs.bgY + '%';
      const dot = root.querySelector('#bgFocusDot');
      dot.style.left = prefs.bgX + '%'; dot.style.top = prefs.bgY + '%';
    }
  }

  function wireSettings(root){
    root.addEventListener('click', (e)=>{
      const del = e.target.closest('[data-del]');
      if(del){ e.stopPropagation(); deleteCustomBg(del.dataset.del); return; }
      const segBtn = e.target.closest('.set-seg button');
      if(segBtn){
        const key = segBtn.parentElement.dataset.pref;
        let v = segBtn.dataset.val;
        if(v === 'true') v = true; else if(v === 'false') v = false;
        setPref(key, v);
        if(key === 'sound' && (v === 'mech' || v === 'soft')) playKeySound();
        if(key === 'finishFx' && v === 'confetti') confettiBurst();
        restartDemo();
        return;
      }
      const tileBtn = e.target.closest('.bg-tile[data-bg]');
      if(tileBtn){ setPref('bg', tileBtn.dataset.bg); return; }
      if(e.target.closest('#bgUploadBtn')){ root.querySelector('#bgFileInput').click(); return; }
      const sw = e.target.closest('.accent-sw[data-accent]');
      if(sw){ setPref('accent', sw.dataset.accent); return; }
      if(e.target.closest('#btnResetPrefs')){
        prefs = Object.assign({}, PREF_DEFAULTS);
        savePrefs();
        renderSettings(root);
      }
    });
    root.querySelector('#bgFileInput').addEventListener('change', (e)=>{
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if(f) handleBgFile(f);
    });
    root.querySelectorAll('input[data-range]').forEach(inp=>{
      inp.addEventListener('input', ()=>{
        const key = inp.dataset.range;
        prefs[key] = Number(inp.value);
        root.querySelector('[data-val-of="'+key+'"]').textContent = inp.value + (key === 'blur' ? 'px' : '%');
        savePrefs();
      });
    });
    root.querySelector('#glassToggle').addEventListener('change', (e)=> setPref('glass', e.target.checked));
    root.querySelector('#accentPicker').addEventListener('input', (e)=> setPref('accent', e.target.value.toLowerCase()));
    const focus = root.querySelector('#bgFocus');
    const setFocus = (ev)=>{
      const r = focus.getBoundingClientRect();
      prefs.bgX = Math.round(Math.max(0, Math.min(100, (ev.clientX - r.left) / r.width * 100)));
      prefs.bgY = Math.round(Math.max(0, Math.min(100, (ev.clientY - r.top) / r.height * 100)));
      savePrefs(); refreshSettingsUI();
    };
    let dragging = false;
    focus.addEventListener('pointerdown', (ev)=>{ if(!bgUrl(prefs.bg)) return; dragging = true; focus.setPointerCapture(ev.pointerId); setFocus(ev); });
    focus.addEventListener('pointermove', (ev)=>{ if(dragging) setFocus(ev); });
    focus.addEventListener('pointerup', ()=>{ dragging = false; });
    const pt = root.querySelector('#publicToggle');
    if(pt) pt.addEventListener('change', ()=>{ profilePublic = pt.checked; pushPrefs({ profilePublic: pt.checked }); });
  }

  /* ---- custom background upload: resized + re-encoded in the browser, then stored on the server ---- */
  function setBgNote(msg, isErr){
    const n = document.getElementById('bgUploadNote');
    if(n){ n.textContent = msg; n.classList.toggle('err', !!isErr); }
  }
  function loadImageFile(file){
    return new Promise((resolve, reject)=>{
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = ()=>{ URL.revokeObjectURL(url); resolve(img); };
      img.onerror = ()=>{ URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }
  function canvasToBlob(canvas, type, quality){
    return new Promise((resolve)=> canvas.toBlob(resolve, type, quality));
  }
  async function encodeBg(img, maxSide, maxBytes){
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, c.width, c.height);
    for(const q of [0.92, 0.85, 0.78, 0.7]){
      let blob = await canvasToBlob(c, 'image/webp', q);
      if(!blob || blob.type !== 'image/webp') blob = await canvasToBlob(c, 'image/jpeg', q);   // old Safari can't encode WebP
      if(blob && blob.size <= maxBytes) return blob;
    }
    throw new Error('too large');
  }
  async function handleBgFile(file){
    if(!/^image\/(jpeg|png|webp)$/.test(file.type)) return setBgNote(t('set.bg.badType'), true);
    if(file.size > 10 * 1024 * 1024) return setBgNote(t('set.bg.tooBig'), true);
    setBgNote(t('set.bg.processing'));
    try{
      const img = await loadImageFile(file);
      const lowRes = Math.max(img.naturalWidth, img.naturalHeight) < 1280;
      if(isGuest){
        /* guests have no server storage: keep a smaller copy in this browser only */
        const blob = await encodeBg(img, 1920, 2.2 * 1024 * 1024);
        const dataUrl = await new Promise((res)=>{ const r = new FileReader(); r.onload = ()=> res(r.result); r.readAsDataURL(blob); });
        if(!lsSet(LOCAL_BG_KEY, dataUrl)) return setBgNote(t('set.bg.storageFull'), true);
        try{ localStorage.removeItem(ACCENT_CACHE + 'local'); }catch(e){}   // new image: re-pick its accent colour
        setPref('bg', 'local');
        document.getElementById('bgGrid').innerHTML = bgTilesHtml();
        refreshSettingsUI();
      } else {
        const blob = await encodeBg(img, 2560, 4.3 * 1024 * 1024);
        const res = await fetch('/api/me/background', { method: 'POST', headers: { 'Content-Type': blob.type, Authorization: 'Bearer ' + authToken }, body: blob });
        const data = await res.json().catch(()=> ({}));
        if(!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
        customBgs.push({ key: data.key, url: data.url });
        document.getElementById('bgGrid').innerHTML = bgTilesHtml();
        setPref('bg', 'custom:' + data.key);
      }
      setBgNote(lowRes ? t('set.bg.lowRes') : t('set.bg.done'), lowRes);
    }catch(err){
      logDebug('fon yuklashda xato: ' + err.message);
      setBgNote(err.message === 'upload limit' ? t('set.bg.limit') : err.message === 'too large' ? t('set.bg.tooBig') : t('set.bg.failed'), true);
    }
  }
  function deleteCustomBg(key){
    if(!confirm(t('set.bg.confirmDelete'))) return;
    api('DELETE', '/me/background/' + encodeURIComponent(key)).then(()=>{
      customBgs = customBgs.filter(c=> c.key !== key);
      if(prefs.bg === 'custom:' + key) setPref('bg', 'none');
      document.getElementById('bgGrid').innerHTML = bgTilesHtml();
      refreshSettingsUI();
    }).catch((err)=> setBgNote(t('set.bg.failed') + ' (' + err.message + ')', true));
  }

  /* ---- live preview: a tiny self-typing demo that shows the chosen caret / animations ---- */
  const DEMO_TEXT = 'the quick brown fox jumps over the lazy dog';
  function startDemo(){
    clearInterval(demoTimer);
    const el = document.getElementById('demoText'), wrap = document.getElementById('demoWrap');
    if(!el) return;
    el._klText = null;
    let typed = '';
    renderTyped(el, DEMO_TEXT, typed, null);
    demoTimer = setInterval(()=>{
      if(!el.isConnected){ clearInterval(demoTimer); return; }
      if(!el.offsetParent) return;   // tab hidden
      if(typed.length >= DEMO_TEXT.length){ typed = ''; el._klText = null; renderTyped(el, DEMO_TEXT, typed, null); return; }
      const expected = DEMO_TEXT[typed.length];
      const ok = Math.random() > 0.08;
      typed += ok ? expected : 'x';
      typingFeedback(ok, wrap, true);
      renderTyped(el, DEMO_TEXT, typed, null);
    }, 150);
  }
  function restartDemo(){
    const el = document.getElementById('demoText');
    if(el) startDemo();
  }
