  /* ============ personal stats view ============ */
  function renderStats(){
    const cardsWrap = document.getElementById('statsCardsWrap');
    const chartWrap = document.getElementById('statsWpmChartWrap');
    const tableWrap = document.getElementById('statsTableWrap');
    const achvWrap = document.getElementById('statsAchvWrap');
    if(!cardsWrap) return;

    if(isGuest){
      cardsWrap.innerHTML = '<p class="empty-note">'+t('stats.guestNote')+'</p>';
      chartWrap.innerHTML = '';
      tableWrap.innerHTML = '';
      achvWrap.innerHTML = '';
      return;
    }
    if(!fbReady || !db || !uid){
      cardsWrap.innerHTML = '<p class="empty-note">'+t('leaderboard.connecting')+'</p>';
      setTimeout(()=>{ if(isProfileModalOpen()) renderStats(); }, 1200);
      return;
    }

    cardsWrap.innerHTML = '<p class="empty-note">'+t('leaderboard.loading')+'</p>';
    Promise.all([
      db.ref('users/'+uid).once('value'),
      db.ref('users/'+uid+'/history').orderByChild('ts').limitToLast(50).once('value'),
    ]).then(([profSnap, histSnap])=>{
      const profile = profSnap.val() || {};
      const history = [];
      histSnap.forEach(child=> history.push(child.val()));
      renderStatCards(cardsWrap, profile, history);
      renderWpmChart(chartWrap, history);
      renderRecentTestsTable(tableWrap, history);
      renderAchievementsGrid(achvWrap, profile.achievements||{});
    }).catch(()=>{
      cardsWrap.innerHTML = '<p class="empty-note" style="color:var(--error);">'+t('leaderboard.loadError')+'</p>';
    });
  }

  function renderStatCards(wrap, profile, history){
    const testsCount = profile.testsCount || 0;
    const bestWpm = profile.bestWpm || 0;
    const avgWpm = history.length ? Math.round(history.reduce((s,h)=> s+(h.wpm||0), 0) / history.length) : 0;
    const avgAcc = history.length ? Math.round(history.reduce((s,h)=> s+(h.acc||0), 0) / history.length) : 0;
    const cards = [
      [bestWpm, t('stats.card.best')],
      [avgWpm, t('stats.card.avgWpm')],
      [testsCount, t('stats.card.tests')],
      [avgAcc + '%', t('stats.card.avgAcc')],
    ];
    wrap.innerHTML = cards.map(([val,lbl])=>
      '<div class="stat-card"><div class="stat-card-val">'+val+'</div><div class="stat-card-lbl">'+lbl+'</div></div>'
    ).join('');
  }

  function renderWpmChart(wrap, history){
    if(!wrap) return;
    if(history.length < 2){
      wrap.innerHTML = '<p class="empty-note">'+t('stats.chart.empty')+'</p>';
      return;
    }
    const W = 600, H = 200, padL = 34, padR = 10, padT = 12, padB = 10;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = history.length;
    const maxWpm = Math.max.apply(null, history.map(h=> h.wpm||0));
    const yMax = Math.max(10, Math.ceil((maxWpm*1.15)/10)*10);
    const xAt = i => padL + (n===1 ? 0 : (i/(n-1))*plotW);
    const yAt = v => padT + plotH - (v/yMax)*plotH;
    const points = history.map((h,i)=> [xAt(i), yAt(h.wpm||0)]);
    const pathD = points.map((p,i)=> (i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
    const gridLines = [0,0.25,0.5,0.75,1].map(f=>{
      const y = padT + plotH*(1-f);
      const val = Math.round(yMax*f);
      return '<line x1="'+padL+'" y1="'+y.toFixed(1)+'" x2="'+(W-padR)+'" y2="'+y.toFixed(1)+'" class="chart-grid"/>'+
        '<text x="'+(padL-6)+'" y="'+(y+3).toFixed(1)+'" class="chart-axis-label" text-anchor="end">'+val+'</text>';
    }).join('');
    const dots = points.map((p,i)=> '<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="2.5" class="chart-dot" data-i="'+i+'"/>').join('');

    wrap.innerHTML =
      '<div class="chart-box">'+
        '<svg viewBox="0 0 '+W+' '+H+'" class="wpm-chart" preserveAspectRatio="none">'+
          gridLines +
          '<path d="'+pathD+'" class="chart-line"/>' +
          dots +
          '<line class="chart-crosshair" id="statsCrosshair" x1="0" y1="'+padT+'" x2="0" y2="'+(padT+plotH)+'" style="display:none;"/>' +
          '<rect x="'+padL+'" y="'+padT+'" width="'+plotW+'" height="'+plotH+'" class="chart-overlay"/>' +
        '</svg>'+
        '<div class="chart-tooltip" id="statsChartTooltip" style="display:none;"></div>'+
      '</div>';

    const svg = wrap.querySelector('.wpm-chart');
    const overlay = wrap.querySelector('.chart-overlay');
    const tooltip = wrap.querySelector('#statsChartTooltip');
    const crosshair = wrap.querySelector('#statsCrosshair');

    overlay.addEventListener('mousemove', (e)=>{
      const rect = svg.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * W;
      let idx = n===1 ? 0 : Math.round(((svgX - padL) / plotW) * (n-1));
      idx = Math.max(0, Math.min(n-1, idx));
      const h = history[idx];
      const p = points[idx];
      wrap.querySelectorAll('.chart-dot.active').forEach(d=> d.classList.remove('active'));
      const dot = wrap.querySelector('.chart-dot[data-i="'+idx+'"]');
      if(dot) dot.classList.add('active');
      crosshair.setAttribute('x1', p[0]); crosshair.setAttribute('x2', p[0]);
      crosshair.style.display = 'block';
      tooltip.style.display = 'block';
      tooltip.style.left = ((p[0]/W)*100) + '%';
      tooltip.style.top = ((p[1]/H)*100) + '%';
      const d = h.ts ? new Date(h.ts) : null;
      tooltip.innerHTML = '<b>'+Math.round(h.wpm||0)+' wpm</b>' + (d ? '<br>'+d.toLocaleDateString() : '');
    });
    overlay.addEventListener('mouseleave', ()=>{
      tooltip.style.display = 'none';
      crosshair.style.display = 'none';
      wrap.querySelectorAll('.chart-dot.active').forEach(d=> d.classList.remove('active'));
    });
  }

  function renderRecentTestsTable(wrap, history){
    if(!wrap) return;
    const recent = history.slice().reverse().slice(0, 15);
    if(recent.length===0){
      wrap.innerHTML = '<p class="empty-note">'+t('stats.chart.empty')+'</p>';
      return;
    }
    const rows = recent.map(h=>{
      const d = h.ts ? new Date(h.ts) : null;
      return '<tr><td>'+(d ? d.toLocaleDateString() : '—')+'</td>'+
        '<td style="color:var(--text-faint); font-family:var(--font-mono); font-size:12px;">'+escapeHtml(h.mode||'')+'</td>'+
        '<td class="wpm-col">'+Math.round(h.wpm||0)+'</td>'+
        '<td style="color:var(--text-faint);">'+Math.round(h.acc||0)+'%</td></tr>';
    }).join('');
    wrap.innerHTML = '<table class="lb-table"><thead><tr>'+
      '<th>'+t('stats.table.date')+'</th><th>'+t('leaderboard.col.mode')+'</th><th>'+t('leaderboard.col.wpm')+'</th><th>'+t('leaderboard.col.acc')+'</th>'+
      '</tr></thead><tbody>'+rows+'</tbody></table>';
  }

  function renderAchievementsGrid(wrap, earned){
    if(!wrap) return;
    wrap.innerHTML = ACHIEVEMENTS.map(a=>{
      const unlocked = !!earned[a.id];
      return '<div class="achv-tile'+(unlocked?'':' locked')+'">'+
        '<div class="achv-tile-icon">'+a.icon+'</div>'+
        '<div class="achv-tile-label">'+t(a.labelKey)+'</div>'+
        '</div>';
    }).join('');
  }
