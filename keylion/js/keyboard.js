  /* ============ on-screen keyboard ============ */
  const KEYBOARD_ROWS = [
    ['1','2','3','4','5','6','7','8','9','0','-','='],
    ['q','w','e','r','t','y','u','i','o','p','[',']'],
    ['a','s','d','f','g','h','j','k','l',';',"'"],
    ['z','x','c','v','b','n','m',',','.','/'],
    [' '],
  ];

  function keyboardEnabled(){
    return localStorage.getItem('kl_keyboard') !== 'off';
  }
  function setKeyboardEnabled(on){
    localStorage.setItem('kl_keyboard', on ? 'on' : 'off');
    document.querySelectorAll('.kb-wrap').forEach(el=> el.style.display = on ? '' : 'none');
  }

  function buildKeyboard(container){
    if(!container || container.dataset.built) return;
    container.dataset.built = '1';
    container.innerHTML = '';
    KEYBOARD_ROWS.forEach(row=>{
      const rowEl = document.createElement('div');
      rowEl.className = 'kb-row';
      row.forEach(key=>{
        const keyEl = document.createElement('div');
        keyEl.className = 'kb-key' + (key===' ' ? ' kb-space' : '');
        keyEl.textContent = key===' ' ? '' : key;
        keyEl.dataset.key = key;
        rowEl.appendChild(keyEl);
      });
      container.appendChild(rowEl);
    });
  }

  /* only lights up keys that exist in the Latin QWERTY map above — Cyrillic content (ru/kk/ky)
     simply never matches, since a QWERTY graphic would misrepresent that physical keyboard layout */
  function highlightKey(container, expectedChar){
    if(!container) return;
    const prev = container.querySelector('.kb-key.active');
    if(prev) prev.classList.remove('active');
    if(!expectedChar || expectedChar === '\n') return;
    const norm = expectedChar.toLowerCase();
    const selector = norm === ' ' ? '.kb-key.kb-space' : '.kb-key[data-key="'+CSS.escape(norm)+'"]';
    const target = container.querySelector(selector);
    if(target) target.classList.add('active');
  }

  function updateKeyboardNote(noteEl, textLang, mode){
    if(!noteEl) return;
    const isCyrillic = mode!=='code' && ['ru','kk','ky'].includes(textLang);
    noteEl.style.display = isCyrillic ? 'block' : 'none';
    if(isCyrillic) noteEl.textContent = t('keyboard.cyrillicNote');
  }

  setKeyboardEnabled(keyboardEnabled());
  const btnToggleKeyboard = document.getElementById('btnToggleKeyboard');
  if(btnToggleKeyboard){
    btnToggleKeyboard.classList.toggle('active', keyboardEnabled());
    btnToggleKeyboard.addEventListener('click', ()=>{
      const next = !keyboardEnabled();
      setKeyboardEnabled(next);
      btnToggleKeyboard.classList.toggle('active', next);
    });
  }
