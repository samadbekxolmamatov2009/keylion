  /* ============ shared typing engine ============ */
  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, ch=>({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[ch]));
  }
  /* keyboard-friendly stand-ins: a typed character in the list counts as the expected one, so texts can
     keep their real spelling while people type them on an ordinary keyboard —
     Uzbek oʻ / gʻ / tutuq belgisi with any apostrophe key, Russian ё with е, and the Kazakh / Kyrgyz
     letters that a Russian layout lacks with their base letter */
  const CHAR_ALIASES = (()=>{
    const map = {};
    const group = (chars)=>{ for(const c of chars) map[c] = chars; };
    group("'\u2018\u2019\u02BB\u02BC`\u00B4\u2032");          // ' ‘ ’ ʻ ʼ ` ´ ′
    group('"\u201C\u201D\u00AB\u00BB\u201E');                  // " “ ” « » „
    group('-\u2013\u2014\u2212');                               // - – — −
    const base = { 'ё':'е', 'ә':'а', 'ғ':'г', 'қ':'к', 'ң':'н', 'ө':'о', 'ұ':'у', 'ү':'у', 'һ':'х', 'і':'иi' };
    for(const [letter, plain] of Object.entries(base)){
      map[letter] = (map[letter] || letter) + plain;
      map[letter.toUpperCase()] = letter.toUpperCase() + plain.toUpperCase();
    }
    map['\u00A0'] = ' \u00A0';
    return map;
  })();
  /* the character to record for key `ch` when `expected` is next in the text */
  function typedAs(expected, ch){
    if(expected === undefined || ch === expected) return ch;
    const ok = CHAR_ALIASES[expected];
    return ok && ok.includes(ch) ? expected : ch;
  }
  function applyChar(text, typed, ch){
    if(typed.length >= text.length) return typed;
    typed += typedAs(text[typed.length], ch);
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
    let lo, hi, freshText = false;
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
      const caret = document.createElement('div');
      caret.className = 'type-caret';
      caret.style.transition = 'none'; // jump to the starting spot instantly, don't slide in from (0,0)
      el.appendChild(caret);
      el._klCaret = caret;
      el._klText = text;
      el._klSpans = spans;
      el._klLineHeight = null; // font-size is cached below; invalidate for the new element/text
      el._klRow = -1;
      freshText = true;
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
    /* keep only ~3 lines visible: slide the window down a full line at a time.
       getComputedStyle + offsetTop force a synchronous layout, and writing scrollTop while
       CSS has `scroll-behavior: smooth` kicks off an animated scroll \u2014 doing both on every
       single keystroke (even when the visible row hasn't changed) is what caused the stutter.
       So: cache the line-height per element/text, and only touch scrollTop when the row
       actually changes. */
    const idx = Math.min(typed.length, text.length - 1);
    const curSpan = spans[idx];
    if(curSpan){
      if(el._klLineHeight == null){
        el._klLineHeight = parseFloat(getComputedStyle(el).fontSize) * 1.55;
      }
      const lineHeight = el._klLineHeight;
      const row = Math.round(curSpan.offsetTop / lineHeight);
      if(row !== el._klRow){
        el._klRow = row;
        el.scrollTop = row * lineHeight; // instant (scroll-behavior is auto), keeps caret in sync
      }
      /* caret is its own element so it can slide smoothly (CSS transition on left/top)
         between characters, instead of popping discretely from span to span like the old
         per-character ::before did */
      const caret = el._klCaret;
      if(caret){
        caret.style.height = Math.max(lineHeight - 6, 10) + 'px';
        /* caret lives inside the scrolling text box (position:relative), so it uses content
           coordinates and scrolls together with the text - no scrollTop math, no drift */
        caret.style.top = (curSpan.offsetTop + 3) + 'px';
        caret.style.left = (curSpan.offsetLeft - 1) + 'px';
        /* keep the caret solid while typing (like monkeytype); resume blinking when idle */
        caret.classList.add('typing');
        clearTimeout(el._klIdle);
        el._klIdle = setTimeout(()=> caret.classList.remove('typing'), 500);
        if(freshText){
          // let it render once at the instant position, then re-enable the sliding transition
          requestAnimationFrame(()=>{ caret.style.transition = ''; });
        }
      }
    }
  }
  /* font-size (and thus line-height) can change on resize (mobile breakpoint) \u2014
     invalidate the cached metrics so the next render recomputes them instead of scrolling wrong */
  window.addEventListener('resize', ()=>{
    document.querySelectorAll('.type-text').forEach(el=>{
      el._klLineHeight = null;
      el._klRow = -1;
    });
  });

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

