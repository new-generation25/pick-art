// node full.js <html 절대경로> <captures 폴더> <화면키,…> : 화면 전체 길이를 한 장으로 (검토용)
const puppeteer = require('F:/projects/html-to-video/node_modules/puppeteer-core');
const path = require('path'), fs = require('fs'), os = require('os');
const [,, htmlPath, outDir, keyList] = process.argv;
(async () => {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'pica-edge-'));
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', userDataDir: prof, args: ['--allow-file-access-from-files', '--no-first-run'] });
  const page = await browser.newPage();
  for (const key of keyList.split(',')) {
    await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 1 });
    await page.goto('file:///' + htmlPath.split(path.sep).join('/') + '?only=' + key, { waitUntil: 'load' });
    await page.evaluate(async () => { await document.fonts.ready; });
    const h = await page.evaluate(k => { const p = document.querySelector(`[data-screen="${k}"]`); const h = p.scrollHeight; p.style.height = h + 'px'; return h; }, key);
    await page.setViewport({ width: 375, height: h, deviceScaleFactor: 1 });
    await new Promise(r => setTimeout(r, 200));
    await page.screenshot({ path: path.join(outDir, key + '_full.png') });
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
