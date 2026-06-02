/* 관주 성경전서 — 간이 국한문 앱 */
(function(){
  'use strict';

  const books = BIBLE_DATA;
  let curBookIdx = 0;
  let curChapterIdx = 0;

  // ── 요소 ──
  const screens = {
    books: document.getElementById('screen-books'),
    chapters: document.getElementById('screen-chapters'),
    reader: document.getElementById('screen-reader')
  };
  function show(name){
    Object.values(screens).forEach(s=>s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  // ── 1. 권 목록 렌더 ──
  function renderBooks(){
    const list = document.getElementById('books-list');
    let html = '';
    let lastTestament = '';
    books.forEach((b, idx)=>{
      if(b.testament !== lastTestament){
        html += `<div class="testament-header">${b.testament==='구약'?'舊約 구약':'新約 신약'}</div>`;
        html += `<div class="testament-rule"></div>`;
        lastTestament = b.testament;
      }
      const chCount = b.chapters.length;
      html += `<div class="book-row" data-book="${idx}">
        <div class="book-abbr">${b.abbr}</div>
        <div class="book-info">
          <div class="book-name">${b.name}</div>
          <div class="book-meta">${chCount}장</div>
        </div>
        <div class="book-arrow">›</div>
      </div>`;
    });
    list.innerHTML = html;
    list.querySelectorAll('.book-row').forEach(row=>{
      row.addEventListener('click', ()=>openBook(parseInt(row.dataset.book)));
    });
  }

  // ── 2. 장 목차 ──
  function openBook(idx){
    curBookIdx = idx;
    const b = books[idx];
    document.getElementById('chapters-title').textContent = b.name;
    const grid = document.getElementById('chapters-grid');
    grid.innerHTML = b.chapters.map((c,i)=>
      `<div class="chapter-cell" data-ch="${i}">${c.num}</div>`
    ).join('');
    grid.querySelectorAll('.chapter-cell').forEach(cell=>{
      cell.addEventListener('click', ()=>openChapter(parseInt(cell.dataset.ch)));
    });
    document.querySelector('#screen-chapters .list-scroll').scrollTop = 0;
    show('chapters');
  }

  // ── 3. 본문 ──
  function openChapter(chIdx){
    curChapterIdx = chIdx;
    const b = books[curBookIdx];
    const c = b.chapters[chIdx];
    document.getElementById('reader-title').textContent = `${b.name} ${c.num}장`;
    const content = document.getElementById('reader-content');
    content.innerHTML = c.html;
    applyFontSize();
    applyRuby();
    // 이전/다음 버튼
    document.getElementById('prev-chapter').disabled = (chIdx === 0);
    document.getElementById('next-chapter').disabled = (chIdx === b.chapters.length-1);
    document.getElementById('reader-scroll').scrollTop = 0;
    show('reader');
  }

  // ── 네비게이션 버튼 ──
  document.getElementById('back-to-books').addEventListener('click', ()=>show('books'));
  document.getElementById('back-to-chapters').addEventListener('click', ()=>show('chapters'));
  document.getElementById('prev-chapter').addEventListener('click', ()=>{
    if(curChapterIdx>0) openChapter(curChapterIdx-1);
  });
  document.getElementById('next-chapter').addEventListener('click', ()=>{
    if(curChapterIdx < books[curBookIdx].chapters.length-1) openChapter(curChapterIdx+1);
  });

  // ── 글자 크기 ──
  const fontBtn = document.getElementById('font-btn');
  const fontPanel = document.getElementById('font-panel');
  let curSize = localStorage.getItem('bible-fontsize') || 'medium';
  let rubyOn = localStorage.getItem('bible-ruby') !== 'off';

  fontBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    fontPanel.classList.toggle('show');
  });
  document.addEventListener('click', (e)=>{
    if(!fontPanel.contains(e.target) && e.target!==fontBtn) fontPanel.classList.remove('show');
  });
  fontPanel.querySelectorAll('button[data-size]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      curSize = btn.dataset.size;
      localStorage.setItem('bible-fontsize', curSize);
      applyFontSize();
      updateSizeButtons();
    });
  });
  function applyFontSize(){
    const content = document.getElementById('reader-content');
    content.className = 'reader-content size-'+curSize + (rubyOn?'':' hide-ruby');
  }
  function updateSizeButtons(){
    fontPanel.querySelectorAll('button[data-size]').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.size===curSize);
    });
  }

  // ── 루비(한자음) 토글 ──
  const rubyToggle = document.getElementById('ruby-toggle');
  rubyToggle.checked = rubyOn;
  rubyToggle.addEventListener('change', ()=>{
    rubyOn = rubyToggle.checked;
    localStorage.setItem('bible-ruby', rubyOn?'on':'off');
    applyRuby();
  });
  function applyRuby(){
    const content = document.getElementById('reader-content');
    content.classList.toggle('hide-ruby', !rubyOn);
  }

  // ── 검색 ──
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const searchResults = document.getElementById('search-results');
  const booksList = document.getElementById('books-list');
  let searchTimer = null;

  // 루비/태그 제거하여 순수 텍스트 추출 (검색용)
  function stripTags(html){
    // rt(한자음) 내용 제거 후, 나머지 태그 제거
    let t = html.replace(/<rt[^>]*>.*?<\/rt>/g, '');
    t = t.replace(/<[^>]+>/g, '');
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }

  searchInput.addEventListener('input', ()=>{
    const q = searchInput.value.trim();
    searchClear.classList.toggle('show', q.length>0);
    clearTimeout(searchTimer);
    if(q.length === 0){
      booksList.style.display='';
      searchResults.innerHTML='';
      return;
    }
    searchTimer = setTimeout(()=>doSearch(q), 250);
  });
  searchClear.addEventListener('click', ()=>{
    searchInput.value='';
    searchClear.classList.remove('show');
    booksList.style.display='';
    searchResults.innerHTML='';
  });

  function doSearch(q){
    booksList.style.display='none';
    // 책 이름 검색 먼저
    const nameMatches = [];
    books.forEach((b,idx)=>{
      if(b.name.includes(q) || b.abbr===q){ nameMatches.push(idx); }
    });
    // 본문 검색 (최대 200건)
    const results = [];
    const MAX = 200;
    outer:
    for(let bi=0; bi<books.length; bi++){
      const b = books[bi];
      for(let ci=0; ci<b.chapters.length; ci++){
        const plain = stripTags(b.chapters[ci].html);
        let pos = plain.indexOf(q);
        if(pos>=0){
          // 절 번호 단위로 잘라 표시
          const start = Math.max(0,pos-18);
          const end = Math.min(plain.length,pos+q.length+40);
          let snippet = plain.slice(start,end);
          snippet = snippet.replace(new RegExp(escapeReg(q),'g'), m=>`<mark>${m}</mark>`);
          results.push({bi, ci, num:b.chapters[ci].num, name:b.name, snippet:(start>0?'…':'')+snippet+(end<plain.length?'…':'')});
          if(results.length>=MAX) break outer;
        }
      }
    }
    let html='';
    if(nameMatches.length){
      html += nameMatches.map(idx=>
        `<div class="search-result-item" data-book="${idx}" data-type="book">
          <div class="sr-ref">${books[idx].name} · 책으로 이동</div>
        </div>`).join('');
    }
    if(results.length){
      html += results.map(r=>
        `<div class="search-result-item" data-book="${r.bi}" data-ch="${r.ci}" data-type="verse">
          <div class="sr-ref">${r.name} ${r.num}장</div>
          <div class="sr-text">${r.snippet}</div>
        </div>`).join('');
    }
    if(!html){
      html = `<div class="search-empty">"${escapeHtml(q)}"에 대한 결과가 없습니다.</div>`;
    }
    searchResults.innerHTML = html;
    searchResults.querySelectorAll('.search-result-item').forEach(item=>{
      item.addEventListener('click', ()=>{
        const bi = parseInt(item.dataset.book);
        if(item.dataset.type==='book'){
          openBook(bi);
        } else {
          curBookIdx = bi;
          openChapter(parseInt(item.dataset.ch));
        }
      });
    });
  }
  function escapeReg(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
  function escapeHtml(s){ return s.replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  // ── 초기화 ──
  renderBooks();
  updateSizeButtons();

  // 서비스워커
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
})();
