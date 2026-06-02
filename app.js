/* 관주 성경전서 — 간이 국한문 앱 */
(function(){
  'use strict';

  const books = BIBLE_DATA;
  let curBookIdx = 0;
  let curChapterIdx = 0;

  // ── 요소 ──
  const screens = {
    cover: document.getElementById('screen-cover'),
    books: document.getElementById('screen-books'),
    chapters: document.getElementById('screen-chapters'),
    reader: document.getElementById('screen-reader')
  };
  function show(name){
    Object.values(screens).forEach(s=>s.classList.remove('active'));
    screens[name].classList.add('active');
    // 본문 화면에서만 글자크기 버튼 표시
    document.body.classList.toggle('reading', name==='reader');
  }

  // 표지 탭 → 권 목록
  // 표지 탭 → 마지막 읽은 지점이 있으면 그곳, 없으면 권 목록
  document.getElementById('cover-tap').addEventListener('click', ()=>{
    let lp = null;
    try { lp = JSON.parse(localStorage.getItem('bible-last')||'null'); } catch(e){}
    if(lp && books[lp.book] && books[lp.book].chapters[lp.ch]){
      curBookIdx = lp.book;
      openChapter(lp.ch);
    } else {
      show('books');
    }
  });
  document.getElementById('back-to-cover').addEventListener('click', ()=>show('cover'));

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
    applyTheme();
    // 본문 열 때 검색 결과 비우고 본문 보이게
    const rsr = document.getElementById('reader-search-results');
    if(rsr) rsr.innerHTML='';
    content.style.display='';
    document.getElementById('reader-nav-buttons').style.display='';
    const rsi = document.getElementById('reader-search-input');
    if(rsi){ rsi.value=''; }
    document.getElementById('reader-search-clear').classList.remove('show');
    // 주석 연결: 이 장의 주석 데이터
    const bookAnno = MANNA_DATA[String(b.booknum)] || {};
    const chAnno = bookAnno[String(c.num)] || {};
    // has-anno 절 번호에 탭 이벤트
    content.querySelectorAll('.verse-num.has-anno').forEach(span=>{
      span.addEventListener('click', ()=>toggleAnno(span, chAnno));
    });
    // 이전/다음 버튼
    document.getElementById('prev-chapter').disabled = (chIdx === 0);
    document.getElementById('next-chapter').disabled = (chIdx === b.chapters.length-1);
    document.getElementById('reader-scroll').scrollTop = 0;
    show('reader');
    // 마지막 읽은 지점 저장
    try { localStorage.setItem('bible-last', JSON.stringify({book:curBookIdx, ch:chIdx})); } catch(e){}
    updateBookmarkBtn();
  }

  // 주석 펼치기/접기
  function toggleAnno(span, chAnno){
    const v = span.dataset.v;
    // 이미 펼쳐진 주석이 바로 다음에 있으면 접기
    const next = span.nextElementSibling;
    if(span.classList.contains('anno-open')){
      span.classList.remove('anno-open');
      // 이 절에 속한 주석 박스 제거
      removeAnnoAfter(span);
      return;
    }
    const text = chAnno[v];
    if(!text) return;
    span.classList.add('anno-open');
    const box = document.createElement('span');
    box.className = 'anno-box';
    box.dataset.forV = v;
    box.innerHTML = `<span class="anno-label">주석 ${v}절</span>${text}`;
    // 절 텍스트가 이어지는 흐름 안에서, 이 절의 끝(다음 verse-num 직전)에 삽입
    insertAnnoBox(span, box);
  }
  function insertAnnoBox(span, box){
    // span 다음에 오는 노드들 중, 다음 verse-num을 만나기 전까지가 이 절의 본문.
    // 그 다음 verse-num 직전(또는 컨테이너 끝)에 box를 넣는다.
    let node = span.nextSibling;
    let lastNode = span;
    while(node){
      if(node.nodeType===1 && node.classList && node.classList.contains('verse-num')){
        break;
      }
      lastNode = node;
      node = node.nextSibling;
    }
    if(node){
      node.parentNode.insertBefore(box, node);
    } else {
      lastNode.parentNode.appendChild(box);
    }
  }
  function removeAnnoAfter(span){
    const v = span.dataset.v;
    const content = document.getElementById('reader-content');
    const box = content.querySelector(`.anno-box[data-for-v="${v}"]`);
    if(box) box.remove();
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

  // ── 설정 패널 (글자 크기 / 배경색 / 한자음) ──
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  let curSize = localStorage.getItem('bible-fontsize') || 'medium';
  let rubyOn = localStorage.getItem('bible-ruby') !== 'off';
  let curTheme = localStorage.getItem('bible-theme') || 'dark';

  settingsBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    settingsPanel.classList.toggle('show');
  });
  document.addEventListener('click', (e)=>{
    if(!settingsPanel.contains(e.target) && e.target!==settingsBtn) settingsPanel.classList.remove('show');
  });

  // 글자 크기
  settingsPanel.querySelectorAll('button[data-size]').forEach(btn=>{
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
    settingsPanel.querySelectorAll('button[data-size]').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.size===curSize);
    });
  }

  // 배경 테마
  settingsPanel.querySelectorAll('button[data-theme]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      curTheme = btn.dataset.theme;
      localStorage.setItem('bible-theme', curTheme);
      applyTheme();
      updateThemeButtons();
    });
  });
  function applyTheme(){
    const scroll = document.getElementById('reader-scroll');
    scroll.classList.remove('theme-dark','theme-beige','theme-sky','theme-gray');
    scroll.classList.add('theme-'+curTheme);
  }
  function updateThemeButtons(){
    settingsPanel.querySelectorAll('button[data-theme]').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.theme===curTheme);
    });
  }

  // 한자음(루비) 토글
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

  // 맨 위로 버튼
  document.getElementById('top-btn').addEventListener('click', ()=>{
    document.getElementById('reader-scroll').scrollTop = 0;
  });

  // ── 본문 화면 검색 ──
  const rSearchInput = document.getElementById('reader-search-input');
  const rSearchClear = document.getElementById('reader-search-clear');
  const rSearchResults = document.getElementById('reader-search-results');
  const readerContent = document.getElementById('reader-content');
  const readerNavBtns = document.getElementById('reader-nav-buttons');
  let rSearchTimer = null;

  rSearchInput.addEventListener('input', ()=>{
    const q = rSearchInput.value.trim();
    rSearchClear.classList.toggle('show', q.length>0);
    clearTimeout(rSearchTimer);
    if(q.length===0){
      rSearchResults.innerHTML='';
      readerContent.style.display='';
      readerNavBtns.style.display='';
      return;
    }
    rSearchTimer = setTimeout(()=>doReaderSearch(q), 250);
  });
  rSearchClear.addEventListener('click', ()=>{
    rSearchInput.value='';
    rSearchClear.classList.remove('show');
    rSearchResults.innerHTML='';
    readerContent.style.display='';
    readerNavBtns.style.display='';
  });
  function doReaderSearch(q){
    readerContent.style.display='none';
    readerNavBtns.style.display='none';
    rSearchResults.innerHTML = buildSearchHtml(q);
    bindSearchItems(rSearchResults, ()=>{
      // 검색 결과 클릭 시 검색 상태 초기화
      rSearchInput.value=''; rSearchClear.classList.remove('show');
      rSearchResults.innerHTML='';
      readerContent.style.display=''; readerNavBtns.style.display='';
    });
  }

  // ── 글자 크기 ──
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
    searchResults.innerHTML = buildSearchHtml(q);
    bindSearchItems(searchResults, null);
  }

  // 공용: 검색 결과 HTML 생성
  function buildSearchHtml(q){
    const nameMatches = [];
    books.forEach((b,idx)=>{
      if(b.name.includes(q) || b.abbr===q){ nameMatches.push(idx); }
    });
    const results = [];
    const MAX = 200;
    outer:
    for(let bi=0; bi<books.length; bi++){
      const b = books[bi];
      for(let ci=0; ci<b.chapters.length; ci++){
        const plain = stripTags(b.chapters[ci].html);
        let pos = plain.indexOf(q);
        if(pos>=0){
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
    return html;
  }

  // 공용: 검색 결과 항목에 클릭 이벤트 연결
  function bindSearchItems(container, afterClick){
    container.querySelectorAll('.search-result-item').forEach(item=>{
      item.addEventListener('click', ()=>{
        const bi = parseInt(item.dataset.book);
        if(afterClick) afterClick();
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

  // ── 책갈피 ──
  function getBookmarks(){
    try { return JSON.parse(localStorage.getItem('bible-bookmarks')||'[]'); } catch(e){ return []; }
  }
  function saveBookmarks(arr){
    try { localStorage.setItem('bible-bookmarks', JSON.stringify(arr)); } catch(e){}
  }
  function isBookmarked(book, ch){
    return getBookmarks().some(m=>m.book===book && m.ch===ch);
  }
  function updateBookmarkBtn(){
    const btn = document.getElementById('bookmark-btn');
    if(!btn) return;
    const marked = isBookmarked(curBookIdx, curChapterIdx);
    btn.textContent = marked ? '★' : '☆';
    btn.classList.toggle('marked', marked);
  }
  // 책갈피 추가/제거 토글
  document.getElementById('bookmark-btn').addEventListener('click', ()=>{
    let arr = getBookmarks();
    if(isBookmarked(curBookIdx, curChapterIdx)){
      arr = arr.filter(m=>!(m.book===curBookIdx && m.ch===curChapterIdx));
    } else {
      arr.unshift({book:curBookIdx, ch:curChapterIdx});
    }
    saveBookmarks(arr);
    updateBookmarkBtn();
  });

  // 책갈피 목록 열기/닫기
  const bmOverlay = document.getElementById('bookmark-overlay');
  document.getElementById('bookmark-list-btn').addEventListener('click', openBookmarkList);
  document.getElementById('bookmark-close').addEventListener('click', ()=>bmOverlay.classList.remove('show'));
  bmOverlay.addEventListener('click', (e)=>{ if(e.target===bmOverlay) bmOverlay.classList.remove('show'); });

  function openBookmarkList(){
    const arr = getBookmarks();
    const list = document.getElementById('bookmark-list');
    if(arr.length===0){
      list.innerHTML = '<div class="bookmark-empty">저장된 책갈피가 없습니다.<br>본문 화면 오른쪽 위 ☆ 를 눌러 추가하세요.</div>';
    } else {
      list.innerHTML = arr.map((m,i)=>{
        const b = books[m.book];
        if(!b) return '';
        const c = b.chapters[m.ch];
        const snippet = stripTags(c.html).slice(0,30);
        return `<div class="bookmark-item" data-i="${i}">
          <div class="bookmark-item-info">
            <div class="bookmark-item-ref">${b.name} ${c.num}장</div>
            <div class="bookmark-item-snippet">${snippet}…</div>
          </div>
          <button class="bookmark-del" data-del="${i}" aria-label="삭제">🗑</button>
        </div>`;
      }).join('');
      // 이동
      list.querySelectorAll('.bookmark-item').forEach(item=>{
        item.addEventListener('click', (e)=>{
          if(e.target.classList.contains('bookmark-del')) return;
          const m = arr[parseInt(item.dataset.i)];
          curBookIdx = m.book;
          bmOverlay.classList.remove('show');
          openChapter(m.ch);
        });
      });
      // 삭제
      list.querySelectorAll('.bookmark-del').forEach(btn=>{
        btn.addEventListener('click', (e)=>{
          e.stopPropagation();
          let a = getBookmarks();
          a.splice(parseInt(btn.dataset.del),1);
          saveBookmarks(a);
          openBookmarkList(); // 다시 그리기
          updateBookmarkBtn();
        });
      });
    }
    bmOverlay.classList.add('show');
  }

  // ── 초기화 ──
  renderBooks();
  updateSizeButtons();
  updateThemeButtons();

  // 서비스워커
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
})();
