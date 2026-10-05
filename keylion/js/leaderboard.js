  /* ============ leaderboard ============
     One row per player (their best result in the chosen period/mode/language), ranked on the server.
     Top 3 get a podium, everyone links to their public profile, and your own rank is pinned below. */
  const lbState = { period: 'all', mode: 'all', lang: 'all' };
  let lbReq = 0;

  function syncLbSegs(){
    [['lbPeriodSeg', 'period'], ['lbModeSeg', 'mode'], ['lbLangSeg', 'lang']].forEach(([id, key])=>{
      document.querySelectorAll('#' + id + ' button').forEach(b=> b.classList.toggle('active', b.dataset.v === lbState[key]));
    });
    document.getElementById('lbPeriodSeg').classList.toggle('locked', lbState.mode === 'daily');
    document.getElementById('lbLangSeg').classList.toggle('locked', lbState.mode === 'code');
  }
  [['lbPeriodSeg', 'period'], ['lbModeSeg', 'mode'], ['lbLangSeg', 'lang']].forEach(([id, key])=>{
    document.getElementById(id).addEventListener('click', (e)=>{
      const b = e.target.closest('button[data-v]');
      if(!b) return;
      lbState[key] = b.dataset.v;
      if(key === 'mode' && b.dataset.v === 'daily') lbState.period = 'day';
      syncLbSegs();
      loadLeaderboard();
    });
  });
  syncLbSegs();
  document.getElementById('view-leaderboard').addEventListener('click', (e)=>{
    if(e.target.closest('[data-act="login"]')) openAuthModal();
  });

  const lbMsgRow = (msg, cls)=> '<tr><td colspan="6" class="lb-msg ' + (cls || '') + '">' + escapeHtml(msg) + '</td></tr>';
  const lbProfileHref = (id)=> '#/u/' + encodeURIComponent(id);
  function lbAvatar(name, rating){
    return '<span class="lb-av" style="--tc:' + tierOf(rating).color + '">' + escapeHtml((name || '?').slice(0, 2).toUpperCase()) + '</span>';
  }

  function loadLeaderboard(){
    const body = document.getElementById('lbBody');
    document.getElementById('lbTableWrap').style.display = '';
    if(!fbReady){
      body.innerHTML = lbMsgRow(t('leaderboard.connecting'));
      setTimeout(()=>{ if(currentView === 'leaderboard') loadLeaderboard(); }, 1200);
      return;
    }
    body.innerHTML = lbMsgRow(t('leaderboard.loading'));
    const req = ++lbReq;
    const qs = new URLSearchParams({ period: lbState.period, mode: lbState.mode, lang: lbState.mode === 'code' ? 'all' : lbState.lang });
    api('GET', '/leaderboard?' + qs).then((res)=>{
      if(req === lbReq) renderLeaderboard(res);
    }).catch((err)=>{
      if(req !== lbReq) return;
      console.error(err);
      document.getElementById('lbPodium').innerHTML = '';
      document.getElementById('lbMe').style.display = 'none';
      body.innerHTML = lbMsgRow(t('leaderboard.loadError'), 'err');
    });
  }

  function lbRowHtml(r){
    return '<tr class="' + (r.id === uid ? 'me' : '') + '">' +
      '<td class="rank">' + r.rank + '</td>' +
      '<td><a class="u" href="' + lbProfileHref(r.id) + '">' + lbAvatar(r.name, r.rating) +
        '<span class="lb-name">' + escapeHtml(r.name) + '</span>' + tierBadgeHtml(r.rating, { compact: true }) + '</a></td>' +
      '<td class="wpm-col">' + r.wpm + '</td>' +
      '<td class="acc-col">' + r.acc + '%</td>' +
      '<td class="mode-col">' + escapeHtml(r.mode || '') + '</td>' +
      '<td class="date-col">' + escapeHtml(new Date(r.ts).toLocaleDateString()) + '</td></tr>';
  }

  function renderLeaderboard(res){
    const champ = document.getElementById('lbChampion');
    if(res.champion){
      champ.innerHTML = '<span class="lb-champ-icon">🏆</span><span>' + escapeHtml(t('lb.champion')) + '</span>' +
        '<a href="' + lbProfileHref(res.champion.id) + '">' + escapeHtml(res.champion.name) + '</a><b>' + res.champion.wpm + ' wpm</b>';
      champ.style.display = 'flex';
    } else {
      champ.style.display = 'none';
    }

    const rows = res.scores || [];
    const top = rows.slice(0, 3);
    document.getElementById('lbPodium').innerHTML = top.length < 1 ? '' : [1, 0, 2].filter(i=> top[i]).map(i=>{
      const r = top[i];
      return '<a class="podium-col p' + (i + 1) + (r.id === uid ? ' me' : '') + '" href="' + lbProfileHref(r.id) + '">' +
        '<span class="podium-medal">' + ['🥇', '🥈', '🥉'][i] + '</span>' + lbAvatar(r.name, r.rating) +
        '<span class="podium-name">' + escapeHtml(r.name) + '</span>' + tierBadgeHtml(r.rating, { compact: true }) +
        '<span class="podium-wpm">' + r.wpm + '<small> wpm</small></span><span class="podium-acc">' + r.acc + '%</span>' +
        '<div class="podium-block">' + (i + 1) + '</div></a>';
    }).join('');

    const rest = rows.slice(3);
    const body = document.getElementById('lbBody');
    if(!rows.length) body.innerHTML = lbMsgRow(t('leaderboard.empty'));
    else body.innerHTML = rest.map(lbRowHtml).join('');
    document.getElementById('lbTableWrap').style.display = (rest.length || !rows.length) ? '' : 'none';
    renderLbMe(res, rows);
  }

  function renderLbMe(res, rows){
    const el = document.getElementById('lbMe');
    el.style.display = 'flex';
    if(isGuest){
      el.innerHTML = '<span class="lb-me-goal">' + escapeHtml(t('lb.meGuest')) + '</span><button class="btn accent" data-act="login">' + escapeHtml(t('nav.login')) + '</button>';
      return;
    }
    const me = res.me;
    if(!me){
      el.innerHTML = '<span class="lb-me-goal">' + escapeHtml(t('lb.meNone')) + '</span>';
      return;
    }
    let goal;
    if(me.rank === 1) goal = t('lb.meFirst');
    else {
      const above = rows.find(r=> r.rank === me.rank - 1) || rows[rows.length - 1];
      goal = t('lb.meGoal', { rank: above.rank, n: Math.max(1, above.wpm - me.wpm + 1) });
    }
    el.innerHTML = '<span class="lb-me-rank">#' + me.rank + ' <small>/ ' + res.total + '</small></span>' + lbAvatar(me.name, me.rating) +
      '<span class="lb-me-name">' + escapeHtml(t('lb.you')) + ' · <b>' + me.wpm + ' wpm</b> · ' + me.acc + '%</span>' +
      '<span class="lb-me-goal">' + escapeHtml(goal) + '</span>';
  }
