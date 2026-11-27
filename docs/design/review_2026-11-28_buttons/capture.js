// node capture.js [base] : 버튼 알약 통일(57721fc) 확인용. 로컬 운영 빌드를 375×812로, 로그인 안 한 상태
const puppeteer = require('F:/projects/html-to-video/node_modules/puppeteer-core');
const path = require('path'), fs = require('fs'), os = require('os');
const BASE = process.argv[2] || 'http://localhost:3002';
const OUT = __dirname;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'rbt-')), args: ['--no-first-run'] });
  const p = await b.newPage();
  await p.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  const go = async (u) => { await p.goto(BASE + u, { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(1200); };
  const shot = async (n) => { await p.screenshot({ path: path.join(OUT, n) }); console.log('saved', n); };
  const toText = async (re) => p.evaluate((src) => { const r = new RegExp(src); const el = [...document.querySelectorAll('a,button')].find(e => r.test(e.innerText)); if (el) { el.scrollIntoView({ block: 'center' }); return true; } return false; }, re);
  // 모서리가 높이 절반보다 작은 버튼(채움·테두리 있는 것) 세기
  const square = async () => p.evaluate(() => [...document.querySelectorAll('a,button')].filter(e => {
    const s = getComputedStyle(e), r = e.getBoundingClientRect(); if (!r.width || r.height < 30) return false;
    const filled = s.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(s.borderTopWidth) > 0;
    return filled && parseFloat(s.borderTopLeftRadius) + 0.5 < r.height / 2;
  }).map(e => e.innerText.trim().slice(0, 20)));
  const ev = await (async () => { await go('/'); return p.evaluate(() => { const a = document.querySelector('a[href^="/events/"]'); return a ? a.getAttribute('href') : null; }); })();
  const plan = [
    ['detail_top', ev, null], ['detail_actions', ev, '길찾기|공간 페이지'], ['detail_bar', ev, 'END'],
    ['partners_cta', '/partners', '사진 한 장으로|카카오톡 채널'], ['partners_send', '/partners', '로그인하고 보내기'],
    ['leaflet', '/tip/leaflet', null], ['login', '/login', null], ['calendar', '/calendar', null], ['notfound', '/no-such-page', null],
  ];
  const sq = {};
  for (const [n, u, t] of plan) {
    if (!u) continue;
    await go(u);
    if (t === 'END') { await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await sleep(600); }
    else if (t) { await toText(t); await sleep(600); }
    await shot(n + '.png');
    sq[n] = await square();
  }
  console.log('square-ish buttons per screen:', JSON.stringify(sq));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
