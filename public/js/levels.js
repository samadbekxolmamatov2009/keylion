  /* ============ tiers (Bronze → Master) ============
     A player's tier comes from their rating = average wpm of their last 10 tests (computed on the
     server), so one lucky run doesn't jump a tier. Each tier except Master has steps I < II < III. */
  const TIERS = [
    { id:'bronze',   min:0,   max:30,  color:'#c58a5c' },
    { id:'silver',   min:30,  max:50,  color:'#b9c3cf' },
    { id:'gold',     min:50,  max:70,  color:'#e8b647' },
    { id:'platinum', min:70,  max:90,  color:'#4fd1d9' },
    { id:'diamond',  min:90,  max:110, color:'#a78bfa' },
    { id:'master',   min:110, max:Infinity, color:'#f05252' },
  ];
  const TIER_STEPS = ['I','II','III'];

  function tierOf(wpm){
    wpm = Math.max(0, Math.round(wpm || 0));
    const tier = TIERS.find(x=> wpm >= x.min && wpm < x.max) || TIERS[0];
    const name = t('tier.' + tier.id);
    if(tier.max === Infinity){
      return { id: tier.id, color: tier.color, label: name, step: null, progress: 1, nextAt: null, nextLabel: null };
    }
    const span = (tier.max - tier.min) / 3;
    const stepIdx = Math.min(2, Math.floor((wpm - tier.min) / span));
    const stepStart = tier.min + stepIdx * span, stepEnd = stepStart + span;
    const nextAt = Math.ceil(stepEnd);
    let nextLabel;
    if(stepIdx < 2) nextLabel = name + ' ' + TIER_STEPS[stepIdx+1];
    else {
      const nt = TIERS[TIERS.indexOf(tier)+1];
      nextLabel = t('tier.' + nt.id) + (nt.max === Infinity ? '' : ' I');
    }
    return {
      id: tier.id, color: tier.color, step: TIER_STEPS[stepIdx],
      label: name + ' ' + TIER_STEPS[stepIdx],
      progress: (wpm - stepStart) / (stepEnd - stepStart), nextAt, nextLabel,
    };
  }

  /* small inline badge: <span class="tier-badge">◆ Gold II</span> */
  function tierBadgeHtml(wpm, opts){
    const tr = tierOf(wpm);
    const compact = opts && opts.compact;
    return '<span class="tier-badge tier-'+tr.id+'" style="--tc:'+tr.color+'" title="'+escapeHtml(tr.label)+' · '+Math.round(wpm||0)+' wpm">'+
      '<span class="tier-gem"></span>'+(compact ? escapeHtml(t('tier.' + tr.id)) : escapeHtml(tr.label))+'</span>';
  }
