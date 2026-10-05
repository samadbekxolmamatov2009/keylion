  /* ============ ad slot (admin-managed, shown under the typing area) ============
     Reads a single config node the admin panel writes to: settings/ad
       { enabled: bool, imageUrl: string, videoUrl: string, linkUrl: string, text: string }
     Publicly readable; only the admin panel (/api/admin/ad) can write it.
     Kept muted (opacity/border, not size) and gets dimmed out while the user is
     actually typing (see updateDimming() in test.js), so it never competes
     for attention with the typing test itself. If both videoUrl and imageUrl are
     set, the video takes priority. */
  function renderAd(ad){
    const slot = document.getElementById('adSlot');
    if(!slot) return;
    const hasMedia = ad && ad.enabled && (ad.videoUrl || ad.imageUrl);
    if(!hasMedia){
      slot.style.display = 'none';
      return;
    }
    const imgEl = document.getElementById('adSlotImg');
    const vidEl = document.getElementById('adSlotVideo');
    if(ad.videoUrl){
      vidEl.src = ad.videoUrl;
      vidEl.style.display = 'block';
      imgEl.style.display = 'none';
      imgEl.removeAttribute('src');
    } else {
      imgEl.src = ad.imageUrl;
      imgEl.style.display = 'block';
      vidEl.pause();
      vidEl.removeAttribute('src');
      vidEl.style.display = 'none';
    }
    document.getElementById('adSlotText').textContent = ad.text || '';
    slot.href = ad.linkUrl || '#';
    slot.style.display = 'flex';
    adEvent('view');
  }

  /* impressions / clicks for the admin panel's ad stats (one view per page load) */
  let adViewSent = false;
  function adEvent(kind){
    if(kind === 'view'){ if(adViewSent) return; adViewSent = true; }
    fetch('/api/ad/event', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }) }).catch(()=>{});
  }
  document.getElementById('adSlot').addEventListener('click', ()=> adEvent('click'));

  function loadAd(){
    if(!fbReady){
      setTimeout(loadAd, 1500);
      return;
    }
    api('GET', '/settings/ad').then((res)=>{
      renderAd(res.ad);
    }).catch((err)=>{
      logDebug('reklama sozlamalarini o\u2018qishda xato: ' + err.message);
    });
  }
