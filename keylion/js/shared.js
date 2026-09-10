  /* ============ shared typing engine ============ */
  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, ch=>({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[ch]));
  }
  function applyChar(text, typed, ch){
    if(typed.length >= text.length) return typed;
    typed += ch;
    while(text[typed.length] === '\n') typed += '\n';
    return typed;
  }
  function applyBackspace(typed){
    while(typed.length>0 && typed[typed.length-1]==='\n') typed = typed.slice(0,-1);
    return typed.slice(0,-1);
  }
  let audioCtx = null;
  function playErrorTick(){
    try{
      if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.value = 210;
      gain.gain.value = 0.06;
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.07);
      osc.stop(audioCtx.currentTime + 0.08);
    }catch(e){}
  }
  /* spans are built once per text and cached on the element; each call after that only
     touches the index range that actually changed instead of rebuilding the whole text \u2014
     matters for the 80-word "time" mode and code snippets, re-rendered on every keystroke */
  function renderTyped(el, text, typed, syntaxMap){
    let lo, hi;
    if(el._klText !== text){
      el.innerHTML = '';
      const frag = document.createDocumentFragment();
      const spans = new Array(text.length);
      for(let i=0;i<text.length;i++){
        const span = document.createElement('span');
        const ch = text[i];
        span.textContent = ch === '\n' ? '\u23ce\n' : ch;
        span.className = 'c';
        spans[i] = span;
        frag.appendChild(span);
      }
      el.appendChild(frag);
      el._klText = text;
      el._klSpans = spans;
      lo = 0; hi = text.length - 1; // full classification pass on a fresh text (syntax colors, initial cursor)
    } else {
      const prevTyped = el._klTyped || '';
      lo = Math.max(0, Math.min(prevTyped.length, typed.length) - 1);
      hi = Math.min(text.length - 1, Math.max(prevTyped.length, typed.length));
    }
    const spans = el._klSpans;
    for(let i=lo;i<=hi;i++){
      const span = spans[i];
      if(!span) continue;
      const ch = text[i];
      span.className = 'c';
      if(i < typed.length){
        span.classList.add(typed[i]===ch ? 'correct' : 'incorrect');
      } else if(i === typed.length){
        span.classList.add('current');
      } else if(syntaxMap && syntaxMap[i]){
        span.classList.add(syntaxMap[i]);
      }
    }
    el._klTyped = typed;
    /* keep only ~3 lines visible: slide the window down a full line at a time */
    const idx = Math.min(typed.length, text.length - 1);
    const curSpan = spans[idx];
    if(curSpan){
      const lineHeight = parseFloat(getComputedStyle(el).fontSize) * 1.55;
      const row = Math.round(curSpan.offsetTop / lineHeight);
      el.scrollTop = row * lineHeight;
    }
  }

  const SYNTAX_KEYWORDS = {
    python: ['def','return','if','elif','else','for','while','in','class','import','from','not','and','or','is','None','True','False','self','try','except','with','as','lambda','yield','pass','break','continue'],
    javascript: ['function','return','if','else','for','while','const','let','var','class','new','this','typeof','import','export','async','await','try','catch','throw','null','undefined','true','false'],
    cpp: ['int','float','double','char','void','if','else','for','while','return','class','public','private','struct','const','new','delete','include','using','namespace','bool','true','false','nullptr'],
    java: ['public','private','protected','static','void','int','double','boolean','String','class','new','if','else','for','while','return','import','try','catch','this','extends','implements','true','false','null'],
    csharp: ['public','private','protected','static','void','int','double','bool','string','class','new','if','else','for','foreach','while','return','using','try','catch','this','var','true','false','null'],
    c: ['int','float','double','char','void','if','else','for','while','return','struct','const','include','define','sizeof','typedef','break','continue','switch','case']
  };
  function tokenizeSyntax(text, lang){
    const map = new Array(text.length).fill(null);
    const kw = new Set(SYNTAX_KEYWORDS[lang] || []);
    const re = /(\/\/.*|#.*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+\.?\d*\b)|([A-Za-z_]\w*)/g;
    let m;
    while((m = re.exec(text))){
      const [full, comment, str, num, word] = m;
      let cls = null;
      if(comment) cls = 'syn-comment';
      else if(str) cls = 'syn-string';
      else if(num) cls = 'syn-number';
      else if(word && kw.has(word)) cls = 'syn-keyword';
      if(cls){
        for(let i=0;i<full.length;i++) map[m.index+i] = cls;
      }
    }
    return map;
  }

