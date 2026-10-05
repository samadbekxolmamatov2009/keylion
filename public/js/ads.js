  /* ============ ad slot (admin panel → Reklama) ============
     GET /api/settings/ad returns the live ad or null:
       { imageUrl (desktop banner, 8:1), mobileImageUrl (optional phone banner, 3:1), videoUrl, linkUrl, text }
     The slot sits under the typing area and the results, fades out while the player types (updateDimming in
     test.js calls setAdTyping) and pauses its video meanwhile. It only appears once the creative has loaded;
     a broken video falls back to the image, a broken image hides the slot.
     A view counts once per visitor per day per ad, after at least half of the loaded ad was on screen for a
     second; a click counts at most once per page view, and only when the ad has a link. */
  const adEls = {
    slot: document.getElementById('adSlot'),
    pic: document.getElementById('adSlotPicture'),
    mobileSrc: document.getElementById('adSlotMobileSrc'),
    img: document.getElementById('adSlotImg'),
    vid: document.getElementById('adSlotVideo'),
    body: document.getElementById('adSlotBody'),
    text: document.getElementById('adSlotText'),
  };
  const AD_REFRESH_MS = 10 * 60 * 1000;
  let adCfg = null, adSig = '', adLoadedAt = 0, adClickSent = false, adShowingVideo = false, adTyping = false;
  let adObserver = null, adViewTimer = null, adInView = false;
  const adReducedMotion = ()=> !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function hideAd(){
    adEls.slot.hidden = true;
    if(adObserver){ adObserver.disconnect(); adObserver = null; }
    clearTimeout(adViewTimer);
    adInView = false;
  }
  function resetAdMedia(){
    hideAd();
    adShowingVideo = false;
    const { vid, img, pic, mobileSrc } = adEls;
    vid.onloadeddata = vid.onerror = null;
    vid.pause(); vid.removeAttribute('src'); vid.load(); vid.hidden = true;
    img.onload = img.onerror = null;
    img.removeAttribute('src'); mobileSrc.removeAttribute('srcset'); pic.hidden = true;
    adEls.slot.classList.remove('has-mobile');
  }

  function renderAd(ad){
    const sig = ad ? JSON.stringify([ad.imageUrl, ad.mobileImageUrl, ad.videoUrl, ad.linkUrl, ad.text]) : '';
    if(sig === adSig) return;   // unchanged since the last check: don't reload the media or recount
    adSig = sig; adCfg = ad; adClickSent = false;
    resetAdMedia();
    if(!ad) return;
    const { slot } = adEls;
    if(ad.linkUrl && /^https?:\/\//i.test(ad.linkUrl)){
      slot.href = ad.linkUrl;
      slot.target = '_blank';
      slot.rel = 'noopener sponsored nofollow';
    } else {
      /* no link: an <a> without href is not a link, so nothing opens and no click is counted */
      slot.removeAttribute('href'); slot.removeAttribute('target'); slot.removeAttribute('rel');
    }
    adEls.text.textContent = ad.text || '';
    adEls.body.hidden = !ad.text;
    const useVideo = !!ad.videoUrl && !(adReducedMotion() && ad.imageUrl);
    if(useVideo) showAdVideo(ad); else showAdImage(ad);
  }

  function showAdImage(ad){
    const { img, pic, mobileSrc, slot } = adEls;
    if(!ad.imageUrl){ hideAd(); return; }
    adShowingVideo = false;
    pic.hidden = false;
    if(ad.mobileImageUrl){ mobileSrc.srcset = ad.mobileImageUrl; slot.classList.add('has-mobile'); }
    img.alt = ad.text || t('ad.label');
    img.onload = adReady;
    img.onerror = ()=>{
      /* the phone banner failed: fall back to the desktop one; anything else: no ad */
      if(mobileSrc.hasAttribute('srcset') && img.currentSrc && img.currentSrc !== new URL(ad.imageUrl, location.href).href){
        mobileSrc.removeAttribute('srcset'); slot.classList.remove('has-mobile');
        img.src = ad.imageUrl;
      } else hideAd();
    };
    img.src = ad.imageUrl;
  }

  function showAdVideo(ad){
    const { vid } = adEls;
    adShowingVideo = true;
    vid.hidden = false;
    vid.onloadeddata = ()=>{ adReady(); syncAdPlayback(); };
    vid.onerror = ()=>{
      vid.onerror = null;
      vid.pause(); vid.removeAttribute('src'); vid.load(); vid.hidden = true;
      adShowingVideo = false;
      if(ad.imageUrl) showAdImage(ad); else hideAd();
    };
    vid.src = ad.videoUrl;
    vid.load();
  }

  function adReady(){
    adEls.slot.hidden = false;
    observeAdView();
  }

  /* video plays only while the player isn't typing, and never on its own with reduced motion */
  function syncAdPlayback(){
    const { vid } = adEls;
    if(!adShowingVideo || !vid.src) return;
    if(adTyping || adReducedMotion()) vid.pause();
    else vid.play().catch(()=>{});
  }
  function setAdTyping(typing){
    const was = adTyping;
    adTyping = !!typing;
    if(adTyping) clearTimeout(adViewTimer);
    else if(was && adObserver && adInView) armAdView();   // typing stopped while the ad is on screen
    syncAdPlayback();
  }
  adEls.slot.addEventListener('mouseenter', ()=>{ if(adShowingVideo && adReducedMotion() && !adTyping) adEls.vid.play().catch(()=>{}); });
  adEls.slot.addEventListener('mouseleave', ()=>{ if(adShowingVideo && adReducedMotion()) adEls.vid.pause(); });

  /* ---- counting ---- */
  function adHash(s){ let h = 5381; for(let i=0;i<s.length;i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function adEvent(kind){
    fetch('/api/ad/event', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }) }).catch(()=>{});
  }
  function countAdView(){
    const d = new Date();
    const stamp = adHash(adSig) + ':' + d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
    let seen = null;
    try{ seen = localStorage.getItem('tz_ad_view'); }catch(e){}
    if(adObserver){ adObserver.disconnect(); adObserver = null; }
    if(seen === stamp) return;
    try{ localStorage.setItem('tz_ad_view', stamp); }catch(e){}
    adEvent('view');
  }
  /* the ad's centre is not covered by a modal (e.g. the first-visit name prompt) */
  function adOnTop(){
    const r = adEls.slot.getBoundingClientRect();
    const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
    const el = document.elementFromPoint(x, y);
    return !!el && adEls.slot.contains(el);
  }
  function armAdView(){
    clearTimeout(adViewTimer);
    adViewTimer = setTimeout(()=>{
      if(adTyping || !adInView || adEls.slot.hidden) return;
      if(adOnTop()) countAdView();
      else armAdView();   // covered right now: look again in a second
    }, 1000);
  }
  function observeAdView(){
    if(adObserver) adObserver.disconnect();
    if(!('IntersectionObserver' in window)){ countAdView(); return; }
    adObserver = new IntersectionObserver((entries)=>{
      const e = entries[entries.length - 1];
      adInView = e.isIntersecting && e.intersectionRatio >= 0.5;
      if(adInView && !adTyping) armAdView(); else clearTimeout(adViewTimer);
    }, { threshold: [0, 0.5, 1] });
    adObserver.observe(adEls.slot);
  }
  adEls.slot.addEventListener('click', ()=>{
    if(!adEls.slot.hasAttribute('href') || adClickSent) return;
    adClickSent = true;
    adEvent('click');
  });

  /* ---- loading: no login needed; re-checked every 10 minutes so admin changes reach open tabs ---- */
  function loadAd(){
    if(document.hidden) return;
    adLoadedAt = Date.now();
    fetch('/api/settings/ad').then((r)=> r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then((res)=> renderAd(res.ad || null))
      .catch((err)=> logDebug('reklama sozlamalarini o‘qishda xato: ' + err.message));
  }
  setInterval(loadAd, AD_REFRESH_MS);
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden && Date.now() - adLoadedAt > AD_REFRESH_MS) loadAd(); });
