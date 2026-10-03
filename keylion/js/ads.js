  /* ============ ad slot (admin-managed, shown under the typing area) ============
     Reads a single config node the admin panel writes to: settings/ad
       { enabled: bool, imageUrl: string, videoUrl: string, linkUrl: string, text: string }
     Publicly readable (see Firebase Rules), only ADMIN_UID can write it.
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
  }

  function loadAd(){
    if(!fbReady || !db){
      setTimeout(loadAd, 1500);
      return;
    }
    db.ref('settings/ad').once('value').then((snap)=>{
      renderAd(snap.val());
    }).catch((err)=>{
      logDebug('reklama sozlamalarini o\u2018qishda xato: ' + err.code);
    });
  }
