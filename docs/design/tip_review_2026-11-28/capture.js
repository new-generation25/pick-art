// node capture.js : picka.news 공개 화면을 375px 전체 길이로 찍고, «제보·포인트·쿠폰·카카오톡으로» 말이 나오는 자리를 센다 (검토용)
const puppeteer = require('F:/projects/html-to-video/node_modules/puppeteer-core');
const path = require('path'), fs = require('fs'), os = require('os');
const OUT = __dirname;
const PAGES = [['home', 'https://picka.news/'], ['tip', 'https://picka.news/tip'], ['partners', 'https://picka.news/partners'], ['about', 'https://picka.news/about']];
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'tip-')), args: ['--no-first-run'] });
  const p = await b.newPage();
  await p.setViewport({ width: 375, height: 812, deviceScaleFactor: 1 });
  // 상세: 홈 첫 행사 링크
  await p.goto(PAGES[0][1], { waitUntil: 'networkidle2', timeout: 60000 });
  const first = await p.evaluate(() => { const a = document.querySelector('a[href^="/events/"]'); return a ? a.href : null; });
  if (first) PAGES.push(['detail', first]);
  const report = {};
  for (const [key, url] of PAGES) {
    await p.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 800));
    const r = await p.evaluate(() => {
      const H = document.documentElement.scrollHeight;
      const hits = [];
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const re = /제보|포인트|쿠폰|카카오톡으로|숨은 행사|정보가 틀렸|오류 신고|리플렛/;
      let n;
      while ((n = walk.nextNode())) {
        const t = n.textContent.trim();
        if (!t || !re.test(t)) continue;
        const el = n.parentElement; const box = el.getBoundingClientRect();
        if (!box.width) continue;
        hits.push({ y: Math.round(box.top + window.scrollY), text: t.slice(0, 80) });
      }
      return { H, hits };
    });
    await p.screenshot({ path: path.join(OUT, key + '_full.png'), fullPage: true });
    report[key] = { url, ...r };
    console.log(key, url, 'height', r.H, 'hits', r.hits.length);
    r.hits.forEach(h => console.log('   ', h.y, h.text));
  }
  fs.writeFileSync(path.join(OUT, 'hits.json'), JSON.stringify(report, null, 1), 'utf-8');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
