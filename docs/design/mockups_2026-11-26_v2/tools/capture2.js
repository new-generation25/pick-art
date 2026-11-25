// node capture2.js <html 절대경로> <captures 폴더> <화면키,화면키> <결과이름>
const puppeteer = require('F:/projects/html-to-video/node_modules/puppeteer-core');
const path = require('path'), fs = require('fs'), os = require('os');
const [,, htmlPath, outDir, keyList, resName] = process.argv;
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'pica-edge-'));
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir: prof,
    args: ['--allow-file-access-from-files', '--no-first-run', '--no-default-browser-check'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  const results = {};
  for (const key of keyList.split(',').filter(Boolean)) {
    await page.goto('file:///' + htmlPath.replace(/\\/g, '/') + '?only=' + key, { waitUntil: 'load' });
    await page.evaluate(async () => { await document.fonts.ready; });
    await new Promise(r => setTimeout(r, 250));
    const r = await page.evaluate((key) => {
      const ph = document.querySelector(`[data-screen="${key}"]`);
      if (!ph) return { key, error: 'data-screen 없음' };
      const H = 812, out = { key };
      const pr = ph.getBoundingClientRect();
      out.size = [Math.round(pr.width), Math.round(pr.height)];
      out.docOverflowX = document.documentElement.scrollWidth - window.innerWidth;
      out.phOverflowX = ph.scrollWidth - ph.clientWidth;
      const wide = [];
      ph.querySelectorAll('*').forEach(el => {
        const b = el.getBoundingClientRect();
        if (!b.width || b.right <= 375.5) return;
        let p = el.parentElement, inScroller = false;
        while (p && p !== ph) { const ox = getComputedStyle(p).overflowX; if (ox !== 'visible') { inScroller = true; break; } p = p.parentElement; }
        if (!inScroller) wide.push((typeof el.className === 'string' ? el.className : el.tagName) + ':' + Math.round(b.right));
      });
      out.wide = wide.slice(0, 5);
      const bar = ph.querySelector('.bar');
      const barTop = bar ? bar.getBoundingClientRect().top : H;
      const cards = [...ph.querySelectorAll('[data-card]')];
      out.cardsFull = cards.filter(c => { const b = c.getBoundingClientRect(); return b.top >= -0.5 && b.bottom <= Math.min(H, barTop) + 0.5 && b.left >= -0.5 && b.right <= 375.5; }).length;
      out.cardsTotal = cards.length;
      out.keys = {};
      ph.querySelectorAll('[data-k]').forEach(el => { const b = el.getBoundingClientRect(); out.keys[el.dataset.k] = { top: Math.round(b.top), bottom: Math.round(b.bottom), inFirst: b.top >= 0 && b.bottom <= barTop + 0.5 }; });
      if (bar) { ph.scrollTop = Math.round((ph.scrollHeight - ph.clientHeight) / 2); const m = bar.getBoundingClientRect(); out.barMid = { top: Math.round(m.top), bottom: Math.round(m.bottom) }; ph.scrollTop = 0; }
      const fb = ph.querySelector('.fb');
      if (fb) { const t0 = fb.getBoundingClientRect().top; ph.scrollTop = 600; out.fbStuck = Math.round(fb.getBoundingClientRect().top); out.fbTop0 = Math.round(t0); ph.scrollTop = 0; }
      out.scrollH = ph.scrollHeight;
      return out;
    }, key);
    await page.screenshot({ path: path.join(outDir, key + '.png') });
    await page.evaluate((key) => { const ph = document.querySelector(`[data-screen="${key}"]`); if (ph) ph.scrollTop = 700; }, key);
    await page.screenshot({ path: path.join(outDir, key + '_scrolled.png') });
    const parts = [];
    if (r.error) parts.push('오류: ' + r.error);
    else {
      if (r.size[0] !== 375 || r.size[1] !== 812) parts.push(`틀 크기 ${r.size.join('×')}(375×812 아님)`);
      if (r.cardsTotal) parts.push(`첫 화면에 카드 ${r.cardsFull}장이 온전히 보임`);
      if (Object.keys(r.keys).length) {
        const ok = ['title', 'period', 'venue'].every(k => r.keys[k] && r.keys[k].inFirst);
        parts.push(ok ? '제목·기간·장소가 첫 화면 안' : '제목·기간·장소 일부가 첫 화면 밖 ' + JSON.stringify(r.keys));
      }
      if (r.barMid) parts.push(r.barMid.bottom >= 800 && r.barMid.bottom <= 812.5 ? '넘겨도 «원본 안내 페이지 열기» 막대가 아래에 남음' : '고정 막대 위치 이상 ' + JSON.stringify(r.barMid));
      if (r.fbStuck !== undefined) parts.push(r.fbStuck >= 0 && r.fbStuck <= 140 ? '넘겨도 필터 막대가 위에 붙음' : `필터 막대가 붙지 않음(${r.fbStuck})`);
      parts.push(r.docOverflowX <= 0 && r.phOverflowX <= 0 && r.wide.length === 0 ? '가로 넘침 없음' : `가로 넘침 있음(${r.phOverflowX}px ${r.wide.join(',')})`);
    }
    r.summary = parts.join(' · ');
    results[key] = r;
    console.log(key, '|', r.summary);
  }
  fs.writeFileSync(path.join(outDir, (resName || 'results') + '.json'), JSON.stringify(results, null, 1), 'utf-8');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
