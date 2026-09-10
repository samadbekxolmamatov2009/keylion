  let lbRowsCache = [];
  let lbFilter = 'all';
  let lbSort = { key: 'wpm', dir: -1 };

  document.getElementById('lbFilterSeg').addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-filter]');
    if(!btn) return;
    document.querySelectorAll('#lbFilterSeg button').forEach(b=> b.classList.toggle('active', b===btn));
    lbFilter = btn.dataset.filter;
    renderLeaderboardRows();
  });
  document.querySelectorAll('.lb-table th.lb-sort').forEach(th=>{
    th.addEventListener('click', ()=>{
      const key = th.dataset.sort;
      if(lbSort.key === key){ lbSort.dir *= -1; } else { lbSort = { key, dir: -1 }; }
      document.querySelectorAll('.lb-table th.lb-sort').forEach(t=>{
        t.classList.toggle('active', t===th);
        t.querySelector('.sort-arrow').textContent = t===th ? (lbSort.dir===-1 ? '▼' : '▲') : '';
      });
      renderLeaderboardRows();
    });
  });

  function renderLeaderboardRows(){
    const body = document.getElementById('lbBody');
    let rows = lbRowsCache.slice();
    if(lbFilter !== 'all'){
      rows = rows.filter(r => (r.mode||'').startsWith(lbFilter));
    }
    rows.sort((a,b)=> ((a[lbSort.key]||0) - (b[lbSort.key]||0)) * lbSort.dir);
    if(rows.length===0){
      body.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-faint); padding:26px;">' + t('leaderboard.empty') + '</td></tr>';
      return;
    }
    body.innerHTML = '';
    rows.forEach((row, i)=>{
      const rawName = row.name || 'anon';
      const name = escapeHtml(rawName);
      const initials = escapeHtml(rawName.slice(0,2).toUpperCase());
      const tr = document.createElement('tr');
      tr.innerHTML = '<td class="rank '+(i<3?'top':'')+'">'+(i+1)+'</td>'+
        '<td><div class="u"><div class="av">'+initials+'</div>'+name+'</div></td>'+
        '<td style="color:var(--text-faint); font-family:var(--font-mono); font-size:12px;">'+escapeHtml(row.mode||'')+'</td>'+
        '<td class="wpm-col">'+(row.wpm||0)+'</td>'+
        '<td style="color:var(--text-faint);">'+(row.acc||0)+'%</td>';
      body.appendChild(tr);
    });
  }

  function loadLeaderboard(){
    const body = document.getElementById('lbBody');
    body.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-faint); padding:26px; font-family:var(--font-mono); font-size:12px;">' + t('leaderboard.loading') + '</td></tr>';
    if(!fbReady || !db){
      body.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-faint); padding:26px; font-family:var(--font-mono); font-size:12px;">' + t('leaderboard.connecting') + '</td></tr>';
      setTimeout(()=>{ if(document.getElementById('view-leaderboard').classList.contains('active')) loadLeaderboard(); }, 1200);
      return;
    }
    db.ref('scores').orderByChild('wpm').limitToLast(100).once('value').then((snap)=>{
      const rows = [];
      snap.forEach((child)=>{ rows.push(child.val()); });
      lbRowsCache = rows;
      renderLeaderboardRows();
    }).catch((err)=>{
      console.error(err);
      body.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--error); padding:26px;">' + t('leaderboard.loadError') + '</td></tr>';
    });
  }

