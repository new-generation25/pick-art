// node capture.js [base] : 홈 «새 소식 받아 보기»의 «앱으로 설치» 안내(0a10a4a) 확인용. 375×812, 로그인 안 함
const puppeteer = require('F:/projects/html-to-video/node_modules/puppeteer-core');
const path = require('path'), fs = require('fs'), os = require('os');
const BASE = process.argv[2] || 'http://localhost:3002';
const OUT = __dirname;
const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'rin-')), args: ['--no-first-run'] });
  for (const [k, ua] of Object.entries(UA)) {
    const p = await b.newPage();
    await p.setUserAgent(ua);
    await p.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(1200);
    // «새 소식 받아 보기» 상자로
    await p.evaluate(() => { const h = [...document.querySelectorAll('h2,h3,p,b')].find(e => /새 소식 받아 보기/.test(e.innerText)); if (h) { h.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); } });
    await sleep(700);
    await p.screenshot({ path: path.join(OUT, `home_${k}_closed.png`) }); console.log('saved', k, 'closed');
    const opened = await p.evaluate(() => { const el = [...document.querySelectorAll('button,summary,a')].find(e => /설치 방법/.test(e.innerText)); if (el) { el.click(); return true; } return false; });
    await sleep(800);
    await p.evaluate(() => { const h = [...document.querySelectorAll('h2,h3,p,b')].find(e => /새 소식 받아 보기/.test(e.innerText)); if (h) { h.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); } });
    await sleep(500);
    await p.screenshot({ path: path.join(OUT, `home_${k}_open.png`) }); console.log('saved', k, 'open', opened);
    console.log(' overflowX', await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth));
    await p.close();
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
