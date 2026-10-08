  /* ============ profile view ============
     #/profile  — your own profile (+ the settings tab, #/settings)
     #/u/<id>   — any player's public profile (linked from the leaderboard, shareable)
     Replaces the old profile modal; all numbers come from GET /api/users/:id. */
  const profileState = { id: null, tab: 'overview', data: null, range: '30' };
  let profileReq = 0;

  function isOwnProfile(){ return !profileState.id || profileState.id === uid; }

  function openProfile(id, tab, fromRouter){
    profileState.id = id && id !== uid ? id : null;
    profileState.tab = (!profileState.id && tab === 'settings') ? 'settings' : 'overview';
    switchView('profile', true);
    if(!fromRouter){
      const hash = profileState.id ? '#/u/' + profileState.id : (profileState.tab === 'settings' ? '#/settings' : '#/profile');
      if(location.hash !== hash) history.pushState(null, '', hash);
    }
    window.scrollTo(0, 0);
    renderProfile();
  }

  function renderProfile(){
    const own = isOwnProfile();
    const tabs = document.getElementById('profileTabs');
    tabs.style.display = own ? 'flex' : 'none';
    tabs.querySelectorAll('button').forEach(b=> b.classList.toggle('active', b.dataset.ptab === profileState.tab));
    const ov = document.getElementById('profileOverview'), st = document.getElementById('profileSettings');
    if(own && profileState.tab === 'settings'){
      ov.style.display = 'none';
      st.style.display = 'block';
      renderSettings(st);
      return;
    }
    st.style.display = 'none';
    st.innerHTML = '';   // also stops the settings preview animation
    ov.style.display = 'block';
    if(!fbReady){
      ov.innerHTML = '<p class="empty-note">'+t('leaderboard.connecting')+'</p>';
      setTimeout(()=>{ if(currentView === 'profile') renderProfile(); }, 1200);
      return;
    }
    if(own && isGuest){ ov.innerHTML = guestProfileHtml(); return; }
    const id = profileState.id || uid;
    const req = ++profileReq;
    ov.innerHTML = '<p class="empty-note">'+t('leaderboard.loading')+'</p>';
    api('GET', '/users/' + encodeURIComponent(id)).then((res)=>{
      if(req !== profileReq) return;
      profileState.data = res.profile;
      drawProfile(ov, res.profile);
    }).catch((err)=>{
      if(req !== profileReq) return;
      const key = err.status === 404 ? 'pf.notFound' : err.status === 403 ? 'pf.private' : 'leaderboard.loadError';
      ov.innerHTML = '<div class="panel pf-empty"><p>'+escapeHtml(t(key))+'</p><button class="btn" data-act="lb">'+escapeHtml(t('pf.toLeaderboard'))+'</button></div>';
    });
  }

  function guestProfileHtml(){
    return '<div class="panel pf-head">'+
      '<div class="pf-avatar">'+escapeHtml(playerName.slice(0,2).toUpperCase())+'</div>'+
      '<div class="pf-id">'+
        '<div class="pf-name-row"><input id="profileNameInput" class="profile-name-input" maxlength="24" spellcheck="false" value="'+escapeHtml(playerName)+'">'+
        '<button class="btn" data-act="save-name">'+escapeHtml(t('profile.save'))+'</button></div>'+
        '<p class="pf-guest-note">'+escapeHtml(t('pf.guestNote'))+'</p>'+
        '<div class="pf-actions-inline"><button class="btn accent" data-act="login">'+escapeHtml(t('nav.login'))+'</button>'+
        '<button class="btn" data-act="settings">'+escapeHtml(t('pf.tab.settings'))+'</button></div>'+
      '</div></div>';
  }

  function fmtDuration(ms){
    const totalMin = Math.round((ms || 0) / 60000);
    if(!totalMin) return ms > 0 ? t('pf.durM', { m: '<1' }) : t('pf.durM', { m: 0 });
    const h = Math.floor(totalMin / 60), m = totalMin % 60;
    return h ? t('pf.durHM', { h, m }) : t('pf.durM', { m });
  }

  function drawProfile(ov, p){
    const own = !!p.isSelf;
    const tier = tierOf(p.ratingWpm);
    const initials = escapeHtml((p.name || '?').slice(0,2).toUpperCase());
    const joined = p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—';
    const nameHtml = own
      ? '<div class="pf-name-row"><input id="profileNameInput" class="profile-name-input" maxlength="24" spellcheck="false" value="'+escapeHtml(p.name)+'">'+
        '<button class="btn" data-act="save-name">'+escapeHtml(t('profile.save'))+'</button></div>'
      : '<h2 class="pf-name">'+escapeHtml(p.name)+'</h2>';
    const rankChip = p.rank
      ? '<span class="pf-chip" title="'+escapeHtml(t('pf.rankHint'))+'">🏆 #'+p.rank+' <small>/ '+p.players+'</small></span>'
      : '<span class="pf-chip pf-chip-dim">'+escapeHtml(t('pf.unranked'))+'</span>';
    const streak = p.streak && p.streak.current >= 1 ? '<span class="pf-chip" title="'+escapeHtml(t('pf.streakHint', { n: p.streak.longest || p.streak.current }))+'">🔥 '+escapeHtml(t('pf.streak', { n: p.streak.current }))+'</span>' : '';
    const nextLine = tier.nextAt ? t('pf.nextTier', { tier: tier.nextLabel, wpm: tier.nextAt }) : t('pf.maxTier');

    const head =
      '<div class="panel pf-head" style="--tc:'+tier.color+'">'+
        '<div class="pf-avatar">'+initials+'</div>'+
        '<div class="pf-id">'+ nameHtml +
          '<div class="pf-chips">'+tierBadgeHtml(p.ratingWpm)+rankChip+streak+
            '<span class="pf-chip pf-chip-dim">'+escapeHtml(t('pf.joined'))+' '+escapeHtml(joined)+'</span></div>'+
          '<div class="pf-level" title="'+escapeHtml(t('pf.ratingHint'))+'">'+
            '<div class="pf-level-bar"><div style="width:'+Math.round(tier.progress*100)+'%"></div></div>'+
            '<span>'+escapeHtml(t('pf.rating', { wpm: p.ratingWpm }))+' · '+escapeHtml(nextLine)+'</span></div>'+
        '</div>'+
        '<div class="pf-actions">'+
          '<button class="btn" data-act="copy-link">🔗 '+escapeHtml(t('pf.copyLink'))+'</button>'+
          '<button class="btn" data-act="tg">✈️ Telegram</button>'+
          '<button class="btn" data-act="card">🖼 '+escapeHtml(t('pf.card'))+'</button>'+
          (own ? '<button class="btn" data-act="logout">'+escapeHtml(t('nav.logout'))+'</button>' : '')+
        '</div>'+
      '</div>';

    const wk = p.week || {};
    let delta = '—', deltaCls = '';
    if(wk.avgWpm != null && wk.prevAvgWpm != null){
      const d = wk.avgWpm - wk.prevAvgWpm;
      delta = (d >= 0 ? '↑ +' : '↓ ') + d;
      deltaCls = d >= 0 ? ' up' : ' down';
    }
    const tot = p.totals || {};
    const cards = [
      { val: p.bestWpm, lbl: t('stats.card.best'), icon: '⚡', hero: true },
      { val: tot.avgWpm, lbl: t('stats.card.avgWpm'), icon: '📊' },
      { val: tot.tests ? tot.avgAcc + '%' : '—', lbl: t('stats.card.avgAcc'), icon: '🎯' },
      { val: tot.tests, lbl: t('stats.card.tests'), icon: '✅' },
      { val: fmtDuration(tot.typingMs), lbl: t('pf.card.time'), icon: '⏱', small: true },
      { val: delta, lbl: t('pf.card.week'), icon: '📈', cls: deltaCls },
    ];
    const cardsHtml = '<div class="stat-cards pf-cards">' + cards.map(c=>
      '<div class="stat-card'+(c.hero?' hero':'')+(c.cls||'')+'"><div class="stat-card-icon">'+c.icon+'</div>'+
      '<div class="stat-card-val'+(c.small?' small':'')+'">'+escapeHtml(String(c.val))+'</div><div class="stat-card-lbl">'+escapeHtml(c.lbl)+'</div></div>').join('') + '</div>';

    const aiHtml = own ?
      '<div class="panel ai-panel" id="aiPanel"><div class="ai-head"><h3 class="icon-ai">'+escapeHtml(t('ai.title'))+'</h3>'+
      '<button class="btn accent" id="btnAiAnalyze" data-act="ai">'+escapeHtml(t('ai.btn'))+'</button></div>'+
      '<div id="aiResult"><p class="empty-note">'+escapeHtml(t('ai.hint'))+'</p></div></div>' : '';

    const chartHtml =
      '<div class="panel"><div class="pf-panel-head"><h3 class="icon-chart">'+escapeHtml(t('stats.section.chart'))+'</h3>'+
      '<div class="seg pf-range">'+['7','30','all'].map(r=> '<button data-range="'+r+'"'+(profileState.range===r?' class="active"':'')+'>'+escapeHtml(t('pf.range.'+r))+'</button>').join('')+'</div></div>'+
      '<div class="chart-legend"><span class="lg-wpm">wpm</span><span class="lg-acc">'+escapeHtml(t('leaderboard.col.acc'))+'</span></div>'+
      '<div id="pfChart"></div></div>';

    const heatHtml = '<div class="panel"><h3 class="icon-calendar">'+escapeHtml(t('pf.activity'))+'</h3><div id="pfHeatmap"></div></div>';

    const modes = (p.bestByMode || []).slice(0, 10);
    const modesHtml = '<div class="panel"><h3 class="icon-trophy">'+escapeHtml(t('pf.bestByMode'))+'</h3>'+
      (modes.length ? '<div class="pf-modes">' + modes.map(m=>
        '<div class="pf-mode"><span>'+escapeHtml(t('lb.mode.'+m.kind))+(m.lang ? ' · '+escapeHtml(String(m.lang).toUpperCase()) : '')+'</span><b>'+m.wpm+'</b></div>').join('') + '</div>'
        : '<p class="empty-note">'+escapeHtml(t('pf.noRanked'))+'</p>') + '</div>';

    const achvHtml = '<div class="panel"><h3 class="icon-trophy">'+escapeHtml(t('stats.section.achievements'))+'</h3><div class="achv-grid">'+
      ACHIEVEMENTS.map(a=>{
        const unlocked = !!(p.achievements && p.achievements[a.id]);
        const g = unlocked ? null : achievementProgress(a.id, p);
        const pct = g ? Math.min(100, Math.round(g[0] / g[1] * 100)) : 0;
        return '<div class="achv-tile'+(unlocked?'':' locked')+'" title="'+escapeHtml(t(a.labelKey))+'">'+
          '<div class="achv-tile-icon">'+a.icon+'</div><div class="achv-tile-label">'+escapeHtml(t(a.labelKey))+'</div>'+
          (g ? '<div class="achv-prog"><div style="width:'+pct+'%"></div></div><div class="achv-prog-txt">'+Math.min(g[0], g[1])+' / '+g[1]+'</div>' : '')+
        '</div>';
      }).join('') + '</div></div>';

    const recent = (p.history || []).slice().reverse().slice(0, 15);
    const recentHtml = '<div class="panel"><h3 class="icon-history">'+escapeHtml(t('stats.section.history'))+'</h3>'+
      (recent.length ? '<table class="lb-table"><thead><tr><th>'+escapeHtml(t('stats.table.date'))+'</th><th>'+escapeHtml(t('leaderboard.col.mode'))+'</th><th>wpm</th><th>'+escapeHtml(t('leaderboard.col.acc'))+'</th></tr></thead><tbody>'+
        recent.map(h=> '<tr><td>'+escapeHtml(new Date(h.ts).toLocaleDateString())+'</td><td class="mode-cell">'+escapeHtml(h.mode||'')+'</td><td class="wpm-col">'+h.wpm+'</td><td class="acc-col">'+h.acc+'%</td></tr>').join('')+
        '</tbody></table>' : '<p class="empty-note">'+escapeHtml(t('stats.chart.empty'))+'</p>') + '</div>';

    ov.innerHTML = head + cardsHtml + aiHtml + chartHtml + heatHtml +
      '<div class="stats-grid">' + modesHtml + achvHtml + '</div>' + recentHtml;
    drawProfileChart();
    drawHeatmap(document.getElementById('pfHeatmap'), p.activity || {});
  }

  /* ---- wpm + accuracy chart (accuracy on its own 50–100% scale, dashed) ---- */
  function drawProfileChart(){
    const wrap = document.getElementById('pfChart');
    const p = profileState.data;
    if(!wrap || !p) return;
    const days = profileState.range === 'all' ? Infinity : Number(profileState.range);
    const since = days === Infinity ? 0 : Date.now() - days * 86400000;
    const hist = (p.history || []).filter(h=> h.ts >= since);
    if(hist.length < 2){ wrap.innerHTML = '<p class="empty-note">'+escapeHtml(t('stats.chart.empty'))+'</p>'; return; }
    const W = 600, H = 200, padL = 34, padR = 34, padT = 12, padB = 10;
    const plotW = W - padL - padR, plotH = H - padT - padB, n = hist.length;
    const maxWpm = Math.max.apply(null, hist.map(h=> h.wpm || 0));
    const yMax = Math.max(10, Math.ceil((maxWpm * 1.15) / 10) * 10);
    const xAt = i => padL + (i / (n - 1)) * plotW;
    const yW = v => padT + plotH - (v / yMax) * plotH;
    const yA = v => padT + plotH - (Math.max(50, v) - 50) / 50 * plotH;
    const ptsW = hist.map((h,i)=> [xAt(i), yW(h.wpm || 0)]);
    const ptsA = hist.map((h,i)=> [xAt(i), yA(h.acc || 0)]);
    const path = pts => pts.map((pt,i)=> (i ? 'L' : 'M') + pt[0].toFixed(1) + ',' + pt[1].toFixed(1)).join(' ');
    const baseY = (padT + plotH).toFixed(1);
    const areaD = path(ptsW) + ' L' + ptsW[n-1][0].toFixed(1) + ',' + baseY + ' L' + ptsW[0][0].toFixed(1) + ',' + baseY + ' Z';
    const grid = [0, .25, .5, .75, 1].map(f=>{
      const y = padT + plotH * (1 - f);
      return '<line x1="'+padL+'" y1="'+y.toFixed(1)+'" x2="'+(W-padR)+'" y2="'+y.toFixed(1)+'" class="chart-grid"/>'+
        '<text x="'+(padL-6)+'" y="'+(y+3).toFixed(1)+'" class="chart-axis-label" text-anchor="end">'+Math.round(yMax*f)+'</text>'+
        '<text x="'+(W-padR+6)+'" y="'+(y+3).toFixed(1)+'" class="chart-axis-label acc" text-anchor="start">'+Math.round(50 + 50*f)+'%</text>';
    }).join('');
    const dots = ptsW.map((pt,i)=> '<circle cx="'+pt[0].toFixed(1)+'" cy="'+pt[1].toFixed(1)+'" r="2.5" class="chart-dot" data-i="'+i+'"/>').join('');
    wrap.innerHTML =
      '<div class="chart-box"><svg viewBox="0 0 '+W+' '+H+'" class="wpm-chart" preserveAspectRatio="none">'+
        '<defs><linearGradient id="pfAreaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style="stop-color:var(--accent); stop-opacity:.32"/><stop offset="100%" style="stop-color:var(--accent); stop-opacity:0"/></linearGradient></defs>'+
        grid + '<path d="'+areaD+'" class="chart-area" style="fill:url(#pfAreaGrad)"/>'+
        '<path d="'+path(ptsA)+'" class="chart-line-acc"/>'+
        '<path d="'+path(ptsW)+'" class="chart-line"/>' + dots +
        '<line class="chart-crosshair" x1="0" y1="'+padT+'" x2="0" y2="'+(padT+plotH)+'" style="display:none;"/>'+
        '<rect x="'+padL+'" y="'+padT+'" width="'+plotW+'" height="'+plotH+'" class="chart-overlay"/>'+
      '</svg><div class="chart-tooltip" style="display:none;"></div></div>';
    const svg = wrap.querySelector('svg'), overlay = wrap.querySelector('.chart-overlay');
    const tip = wrap.querySelector('.chart-tooltip'), cross = wrap.querySelector('.chart-crosshair');
    const show = (clientX)=>{
      const rect = svg.getBoundingClientRect();
      const sx = ((clientX - rect.left) / rect.width) * W;
      const idx = Math.max(0, Math.min(n-1, Math.round(((sx - padL) / plotW) * (n-1))));
      const h = hist[idx], pt = ptsW[idx];
      wrap.querySelectorAll('.chart-dot.active').forEach(d=> d.classList.remove('active'));
      const dot = wrap.querySelector('.chart-dot[data-i="'+idx+'"]');
      if(dot) dot.classList.add('active');
      cross.setAttribute('x1', pt[0]); cross.setAttribute('x2', pt[0]); cross.style.display = 'block';
      tip.style.display = 'block';
      tip.style.left = (pt[0] / W * 100) + '%';
      tip.style.top = (pt[1] / H * 100) + '%';
      tip.innerHTML = '<b>'+h.wpm+' wpm</b> · '+h.acc+'%<br>'+escapeHtml(new Date(h.ts).toLocaleDateString())+'<br><small>'+escapeHtml(h.mode||'')+'</small>';
    };
    overlay.addEventListener('mousemove', (e)=> show(e.clientX));
    overlay.addEventListener('touchmove', (e)=>{ if(e.touches[0]) show(e.touches[0].clientX); }, { passive: true });
    overlay.addEventListener('mouseleave', ()=>{
      tip.style.display = 'none'; cross.style.display = 'none';
      wrap.querySelectorAll('.chart-dot.active').forEach(d=> d.classList.remove('active'));
    });
  }

  /* ---- GitHub-style activity map: last 53 weeks, days in Tashkent time like the server ---- */
  /* own short month names: browsers often lack Uzbek / Kazakh / Kyrgyz calendar data and print "M05" */
  const MONTHS = {
    uz: ['yan','fev','mar','apr','may','iyn','iyl','avg','sen','okt','noy','dek'],
    ru: ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'],
    en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    kk: ['қаң','ақп','нау','сәу','мам','мау','шіл','там','қыр','қаз','қар','жел'],
    ky: ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'],
  };
  function monthName(m){ return (MONTHS[currentLang] || MONTHS.en)[m]; }
  function drawHeatmap(wrap, activity){
    if(!wrap) return;
    const DAY = 86400000, TZ = 5 * 3600000, WEEKS = 53;
    const today = Date.parse(new Date(Date.now() + TZ).toISOString().slice(0,10) + 'T00:00:00Z');
    const dow = (new Date(today).getUTCDay() + 6) % 7;   // Monday = 0
    const start = today - (WEEKS - 1) * 7 * DAY - dow * DAY;
    const max = Math.max(1, ...Object.values(activity));
    let cols = '', months = '', total = 0, activeDays = 0, lastMonth = -1;
    for(let w=0; w<WEEKS; w++){
      let col = '';
      for(let d=0; d<7; d++){
        const ts = start + (w*7 + d) * DAY;
        if(ts > today){ col += '<i class="hm-cell hm-future"></i>'; continue; }
        const key = new Date(ts).toISOString().slice(0,10);
        const c = activity[key] || 0;
        total += c; if(c) activeDays++;
        const lvl = !c ? 0 : c >= max*0.75 ? 4 : c >= max*0.5 ? 3 : c >= max*0.25 ? 2 : 1;
        col += '<i class="hm-cell hm-'+lvl+'" title="'+key+' · '+c+' '+escapeHtml(t('pf.testsWord'))+'"></i>';
      }
      const m = new Date(start + w*7*DAY).getUTCMonth();
      months += '<span>'+(m !== lastMonth && w < WEEKS - 2 ? escapeHtml(monthName(m)) : '')+'</span>';
      lastMonth = m;
      cols += '<div class="hm-col">'+col+'</div>';
    }
    wrap.innerHTML =
      '<div class="hm-scroll"><div class="hm-inner"><div class="hm-months">'+months+'</div><div class="hm-grid">'+cols+'</div></div></div>'+
      '<div class="hm-foot"><span>'+escapeHtml(t('pf.activityTotal', { n: total, d: activeDays }))+'</span>'+
      '<span class="hm-legend">'+escapeHtml(t('pf.less'))+' <i class="hm-cell hm-0"></i><i class="hm-cell hm-1"></i><i class="hm-cell hm-2"></i><i class="hm-cell hm-3"></i><i class="hm-cell hm-4"></i> '+escapeHtml(t('pf.more'))+'</span></div>';
    const scroll = wrap.querySelector('.hm-scroll');
    scroll.scrollLeft = scroll.scrollWidth;   // newest weeks first on narrow screens
  }

  /* ---- sharing ---- */
  function profileUrl(p){ return location.origin + location.pathname + '#/u/' + p.id; }
  function shareText(p){ return t('pf.shareText', { name: p.name, wpm: p.bestWpm, tier: tierOf(p.ratingWpm).label }); }
  function showToast(msg){
    const el = document.createElement('div');
    el.className = 'kl-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(()=>{ el.classList.add('out'); setTimeout(()=> el.remove(), 300); }, 2200);
  }
  function copyProfileLink(){
    const p = profileState.data;
    if(!p) return;
    const url = profileUrl(p);
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
      .then(()=> showToast(t('pf.copied')))
      .catch(()=> window.prompt(t('pf.copyLink'), url));
  }
  function shareTelegram(){
    const p = profileState.data;
    if(!p) return;
    window.open('https://t.me/share/url?url=' + encodeURIComponent(profileUrl(p)) + '&text=' + encodeURIComponent(shareText(p)), '_blank', 'noopener');
  }

  /* 1200×630 result card (the size social networks use for link previews) */
  async function makeShareCard(p){
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 630;
    const x = c.getContext('2d');
    const tier = tierOf(p.ratingWpm);
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e0a940';
    try{ await document.fonts.ready; }catch(e){}
    const g = x.createLinearGradient(0, 0, 1200, 630);
    g.addColorStop(0, '#0b0b10'); g.addColorStop(1, mix(tier.color, '#0b0b10', .72));
    x.fillStyle = g; x.fillRect(0, 0, 1200, 630);
    x.globalAlpha = .12; x.fillStyle = tier.color;
    x.beginPath(); x.arc(1080, 90, 260, 0, Math.PI*2); x.fill();
    x.beginPath(); x.arc(120, 640, 200, 0, Math.PI*2); x.fill();
    x.globalAlpha = 1;
    x.fillStyle = accent;
    x.save(); x.translate(70, 50); x.scale(2.1, 2.1); x.fill(new Path2D('M12.00 0.40 13.91 3.62 17.03 1.55 17.36 5.28 21.07 4.77 19.75 8.27 23.31 9.42 20.60 12.00 23.31 14.58 19.75 15.73 21.07 19.23 17.36 18.72 17.03 22.45 13.91 20.38 12.00 23.60 10.09 20.38 6.97 22.45 6.64 18.72 2.93 19.23 4.25 15.73 0.69 14.58 3.40 12.00 0.69 9.42 4.25 8.27 2.93 4.77 6.64 5.28 6.97 1.55 10.09 3.62ZM7.20 7.50 9.48 7.50 9.48 11.34 13.44 7.50 16.32 7.50 11.76 12.06 16.80 16.50 13.68 16.50 9.48 12.78 9.48 16.50 7.20 16.50Z'), 'evenodd'); x.restore();
    x.font = '600 34px Sora, sans-serif'; x.fillText('Keylion', 132, 92);
    x.fillStyle = '#eae7e0'; x.font = '700 64px Sora, sans-serif';
    let name = p.name;
    while(x.measureText(name).width > 680 && name.length > 3) name = name.slice(0, -2);
    if(name !== p.name) name += '…';
    x.fillText(name, 70, 215);
    x.fillStyle = tier.color; x.font = '600 32px Sora, sans-serif'; x.fillText('◆ ' + tier.label, 70, 268);
    x.fillStyle = accent; x.font = '700 168px Sora, sans-serif';
    const best = String(p.bestWpm);
    x.fillText(best, 70, 470);
    const bw = x.measureText(best).width;
    x.fillStyle = '#9a9aa2'; x.font = '500 40px Inter, sans-serif'; x.fillText('wpm', 90 + bw, 470);
    const stats = [
      [String((p.totals && p.totals.avgAcc) || 0) + '%', t('stats.card.avgAcc')],
      [String((p.totals && p.totals.tests) || 0), t('stats.card.tests')],
      [p.rank ? '#' + p.rank : '—', t('pf.rankShort')],
    ];
    stats.forEach((s, i)=>{
      const sx = 780, sy = 250 + i * 110;
      x.fillStyle = '#eae7e0'; x.font = '700 52px Sora, sans-serif'; x.fillText(s[0], sx, sy);
      x.fillStyle = '#9a9aa2'; x.font = '500 22px Inter, sans-serif'; x.fillText(s[1], sx, sy + 34);
    });
    x.fillStyle = '#6a6a72'; x.font = '500 24px Inter, sans-serif'; x.fillText(location.host || 'keylion', 70, 572);
    return new Promise((resolve)=> c.toBlob(resolve, 'image/png'));
  }
  async function shareCard(){
    const p = profileState.data;
    if(!p) return;
    const blob = await makeShareCard(p);
    if(!blob) return;
    const file = new File([blob], 'keylion-' + (p.name.replace(/[^\p{L}\p{N}]+/gu, '_') || 'card') + '.png', { type: 'image/png' });
    if(navigator.canShare && navigator.canShare({ files: [file] })){
      try{ await navigator.share({ files: [file], text: shareText(p), url: profileUrl(p) }); return; }
      catch(e){ if(e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(a.href), 3000);
  }

  function saveProfileName(){
    const inp = document.getElementById('profileNameInput');
    if(!inp) return;
    const val = inp.value.replace(/\s+/g, ' ').trim();
    if(!val) return;
    playerName = val;
    syncProfileUI(playerName);
    if(fbReady && uid) api('PUT', '/me', { name: playerName }).then(()=> showToast(t('pf.saved'))).catch((err)=> logDebug('ism saqlashda xato: ' + err.message));
  }

  /* ---- AI analysis (own profile) ---- */
  function startFocusPractice(chars){
    const pool = chars.split('').filter(c=> c.trim());
    if(!pool.length) return;
    const bank = wordBanks[state.textLang] || wordBanks.en;
    const relevant = bank.filter(w=> pool.some(c=> w.includes(c)));
    const words = [];
    for(let i=0;i<12;i++) words.push((relevant.length ? relevant : bank)[Math.floor(Math.random()*(relevant.length||bank.length))]);
    for(let i=0;i<8;i++) words.push(bank[Math.floor(Math.random()*bank.length)]);
    for(let i=words.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [words[i],words[j]]=[words[j],words[i]]; }
    switchView('test');
    setTestMode('words');
    buildTest(words.join(' '));
  }

  function renderAiAnalysis(res){
    const wrap = document.getElementById('aiResult');
    const btn = document.getElementById('btnAiAnalyze');
    if(!wrap || !btn) return;
    btn.disabled = false;
    btn.textContent = t('ai.again');
    if(!res.analysis){ wrap.innerHTML = '<p class="empty-note">'+escapeHtml(t('ai.notEnough'))+'</p>'; return; }
    const a = res.analysis;
    let html = '<p class="ai-summary">'+escapeHtml(a.summary)+'</p>';
    if(a.weaknesses.length){
      html += '<div class="ai-sec-title">'+escapeHtml(t('ai.weak'))+'</div>' + a.weaknesses.map(w=>
        '<div class="ai-weak"><div><b>'+escapeHtml(w.title)+'</b><span>'+escapeHtml(w.detail)+'</span></div></div>').join('');
    }
    const missed = (res.stats && res.stats.topMissed) || [];
    if(missed.length){
      html += '<div class="ai-sec-title">'+escapeHtml(t('ai.missed'))+'</div><div class="ai-chips">' + missed.slice(0,8).map(m=>
        '<span class="ai-chip">'+escapeHtml(m.ch)+'<small>×'+m.n+'</small></span>').join('') + '</div>';
    }
    if(a.tips.length){
      html += '<div class="ai-sec-title">'+escapeHtml(t('ai.tips'))+'</div><ul class="ai-tips">' + a.tips.map(x=> '<li>'+escapeHtml(x)+'</li>').join('') + '</ul>';
    }
    if(a.focusChars){
      html += '<button class="btn accent ai-practice" data-act="practice" data-chars="'+escapeHtml(a.focusChars)+'">'+escapeHtml(t('ai.practice'))+' ('+escapeHtml(a.focusChars.split('').join(' '))+')</button>';
    }
    wrap.innerHTML = html;
  }
  function runAiAnalysis(){
    const wrap = document.getElementById('aiResult');
    const btn = document.getElementById('btnAiAnalyze');
    if(!wrap || !btn) return;
    btn.disabled = true;
    wrap.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div> <span class="empty-note">'+escapeHtml(t('ai.loading'))+'</span>';
    api('POST', '/coach/analyze', { lang: currentLang, missed: isGuest ? missedChars : undefined })
      .then(renderAiAnalysis)
      .catch((err)=>{
        btn.disabled = false;
        wrap.innerHTML = '<p class="empty-note err">'+escapeHtml(t('ai.error'))+'</p>';
        logDebug('XATO AI tahlil: ' + err.message);
      });
  }

  /* ---- one delegated handler for everything clickable in the profile view ---- */
  document.getElementById('view-profile').addEventListener('click', (e)=>{
    const tab = e.target.closest('[data-ptab]');
    if(tab){ openProfile(null, tab.dataset.ptab); return; }
    const range = e.target.closest('[data-range]');
    if(range){
      profileState.range = range.dataset.range;
      range.parentElement.querySelectorAll('button').forEach(b=> b.classList.toggle('active', b === range));
      drawProfileChart();
      return;
    }
    const act = e.target.closest('[data-act]');
    if(!act) return;
    switch(act.dataset.act){
      case 'login': openAuthModal(); break;
      case 'logout': doLogout(); break;
      case 'save-name': saveProfileName(); break;
      case 'settings': openProfile(null, 'settings'); break;
      case 'lb': switchView('leaderboard'); break;
      case 'copy-link': copyProfileLink(); break;
      case 'tg': shareTelegram(); break;
      case 'card': shareCard(); break;
      case 'ai': runAiAnalysis(); break;
      case 'practice': startFocusPractice(act.dataset.chars || ''); break;
    }
  });
  document.getElementById('view-profile').addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' && e.target.id === 'profileNameInput'){ e.preventDefault(); saveProfileName(); }
  });
