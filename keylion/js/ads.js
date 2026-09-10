  /* ============ ad slot (admin-managed, shown under the typing area) ============
     Reads a single config node the admin panel writes to: settings/ad
       { enabled: bool, imageUrl: string, linkUrl: string, text: string }
     Publicly readable (see Firebase Rules), only ADMIN_UID can write it.
     Kept deliberately small/muted and gets dimmed out while the user is
     actually typing (see updateDimming() in test.js), so it never competes
     for attention with the typing test itself. */
  function renderAd(ad){
    const slot = document.getElementById('adSlot');
    if(!slot) return;
    if(!ad || !ad.enabled || !ad.imageUrl){
      slot.style.display = 'none';
      return;
    }
    document.getElementById('adSlotImg').src = ad.imageUrl;
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
