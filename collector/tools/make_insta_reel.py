"""행사 facts 로 9:16 숏폼(릴스·쇼츠) mp4 를 만든다. 게시는 하지 않는다.

카드를 차례로 넘기는 슬라이드쇼가 아니라 숏폼 문법으로 짠다.
  - 0.5초 박자(120bpm)마다 컷이 바뀐다. 한 화면을 1.5초 넘게 붙들지 않는다
  - 첫 2초는 큰 글자 한 단어씩 화면을 때리는 훅
  - 모음은 5→1 카운트다운(끝까지 보게 한다). 행사마다 6박(3초):
      번호 + 색면 와이프 → 포스터가 확 당겨짐 → 날짜 쾅(흔들림) → 한마디 → 제목 띠
  - 배경은 그 행사 포스터를 흐리게 깔아 화면을 채운다. 위에는 진행 바
  - 반주는 페이지 안 WebAudio 로 직접 합성(킥·스네어·하이햇·베이스, 구간 시작마다 히트). 외부 음원 0개
  - 글자는 인스타 UI 가 덮는 위 14%·아래 35%를 피해 y 270~1250 에 둔다

facts JSON(카드 생성기와 같은 파일, 키 "id" 필수)에 숏폼용 키를 더할 수 있다:
  short       띠에 쓸 짧은 제목
  reel_day    날짜 쾅 컷 글자 (예: "금 저녁")  — 없으면 chip
  reel_punch  한마디 (예: ["망원경으로", "별 보기"]) — 없으면 hook 줄
  reel_hook   single 의 훅 단어 4개 — 없으면 hook 줄
  poster      DB 포스터 대신 쓸 공식 포스터 경로

굽기는 F:\\projects\\html-to-video\\build.js 가 페이지 시계를 가상 시계로 바꿔 30fps 를 정확히 찍는다.

사용:
  python tools/make_insta_reel.py week a.json b.json ... --region 김해 --range "11.2~11.8" --out DIR --slug NAME
  python tools/make_insta_reel.py single f.json --out DIR --slug NAME
  --sample 1,2.5,4  : 그 시각 프레임만 PNG 로 (굽기 전 확인)   --html-only : HTML 만
"""
import argparse
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_insta_cards as mic  # noqa: E402  (collector 로 chdir·.env.local 로드까지 한다)

B = 0.5  # 한 박(초)
H2V = os.environ.get("HTML_TO_VIDEO", r"F:\projects\html-to-video\build.js")
R = mic.RISO

CSS = """
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css');
@import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=block');
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1080px; height: 1920px; overflow: hidden; background: #111; }
body { font-family: 'Pretendard Variable', sans-serif; word-break: keep-all; letter-spacing: -0.02em; }
#stage { position: absolute; inset: 0; overflow: hidden; }
.bg { position: absolute; left: -80px; top: -80px; width: 1240px; height: 2080px; object-fit: cover;
  filter: blur(26px) brightness(.5) saturate(1.35); display: none; }
#solid { position: absolute; inset: 0; display: none; }
#dots { position: absolute; inset: 0; pointer-events: none;
  background-image: radial-gradient(rgba(255,255,255,.08) 1.6px, transparent 1.7px); background-size: 12px 12px; }
.pst { position: absolute; left: 540px; top: 760px; display: none; border: 6px solid #1a1a1a;
  box-shadow: 20px 20px 0 #2350d8; background: #fff; transform-origin: 50% 50%; }
.pst img { display: block; }
#big { position: absolute; left: 50px; right: 50px; top: 760px; transform-origin: 50% 50%;
  text-align: center; font-family: 'Black Han Sans', sans-serif; line-height: 1.04; color: #fff; display: none; }
#num { position: absolute; left: 0; right: 0; top: 470px; text-align: center; font-family: 'Black Han Sans';
  font-size: 620px; line-height: 1; color: #fff; text-shadow: 16px 12px 0 #ff4fa3; display: none; }
#numlab { position: absolute; left: 60px; right: 60px; top: 1120px; text-align: center; font-size: 56px; font-weight: 900;
  color: #fff; display: none; }
#chip { position: absolute; left: 72px; top: 330px; display: none; background: #ff4fa3; color: #1a1a1a;
  border: 5px solid #1a1a1a; padding: 10px 26px; font-size: 50px; font-weight: 900; }
#band { position: absolute; left: 0; right: 0; top: 1040px; background: #2350d8; color: #fff;
  padding: 28px 72px; display: none; }
#band .t { font-size: 58px; font-weight: 900; line-height: 1.18; }
#band .s { font-size: 40px; font-weight: 700; margin-top: 10px; }
.ph { position: absolute; left: 70px; width: 940px; display: none; border: 6px solid #fff; box-shadow: 16px 16px 0 #ff4fa3; }
#head { position: absolute; left: 60px; right: 60px; top: 290px; height: 280px; display: none; flex-direction: column;
  justify-content: flex-end; font-family: 'Black Han Sans', sans-serif; color: #fff; line-height: 1.05;
  text-shadow: 7px 6px 0 #ff4fa3; }
#head small { display: block; font-family: 'Pretendard Variable'; font-weight: 800; font-size: 40px; text-shadow: none;
  color: #fff; margin-top: 14px; }
#phcap { position: absolute; left: 40px; right: 40px; font-size: 26px; font-weight: 700; color: rgba(255,255,255,.85); display: none; }
#cap { position: absolute; left: 72px; right: 72px; top: 1236px; font-size: 26px; color: rgba(255,255,255,.8); display: none; }
#wipe { position: absolute; top: -200px; bottom: -200px; width: 1400px; left: -1600px; transform: skewX(-12deg); }
#prog { position: absolute; left: 72px; right: 72px; top: 282px; display: flex; gap: 10px; }
#prog i { flex: 1; height: 12px; background: rgba(255,255,255,.3); position: relative; overflow: hidden; }
#prog i b { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: #ff4fa3; }
#brand { position: absolute; right: 72px; top: 1300px; font-size: 34px; font-weight: 900; color: #fff; opacity: .9; }
#brand b { color: #ff4fa3; }
"""

JS = r"""
const T = %(T)s, CUTS = %(cuts)s, NSEG = %(nseg)d;
const $ = id => document.getElementById(id);
const bgs = [...document.querySelectorAll('.bg')], psts = [...document.querySelectorAll('.pst')];
const back = u => { const c = 1.9, k = u - 1; return 1 + (c + 1) * k * k * k + c * k * k; };  // easeOutBack
const out3 = u => 1 - Math.pow(1 - u, 3);
const clamp = u => Math.max(0, Math.min(1, u));
const has = v => v !== null && v !== undefined;
function show(el, on) { el.style.display = on ? 'block' : 'none'; }
function render(t) {
  const c = CUTS.find(x => t >= x.s && t < x.e) || CUTS[CUTS.length - 1];
  const dt = t - c.s, u = clamp(dt / (c.e - c.s));
  bgs.forEach((im, i) => show(im, c.bg === i));
  if (has(c.bg)) bgs[c.bg].style.transform = 'scale(' + (1.05 + 0.08 * u) + ')';
  show($('solid'), !!c.solid); if (c.solid) $('solid').style.background = c.solid;
  // 포스터: 당겨지듯 확대(z0→z1)
  psts.forEach((p, i) => show(p, c.pst === i));
  if (has(c.pst)) {
    const z = c.z0 + (c.z1 - c.z0) * out3(clamp((t - c.zs) / c.zd));
    psts[c.pst].style.transform = 'translate(-50%%,-50%%) rotate(' + (c.rot || 0) + 'deg) scale(' + z + ')';
  }
  // 큰 글자: 박자 첫 0.16초에 튀어나온다. 흔들림 옵션
  const big = $('big'); show(big, !!c.big);
  if (c.big) {
    big.innerHTML = c.big; big.style.fontSize = c.size + 'px'; big.style.top = (c.y || 760) + 'px';
    const dark = c.ink === '#1a1a1a';
    big.style.color = c.ink || '#fff';
    big.style.textShadow = dark ? '10px 8px 0 #fff' : '10px 8px 0 #ff4fa3, 0 0 34px rgba(0,0,0,.45)';
    const sc = 1.45 - 0.45 * back(clamp(dt / 0.16));
    let sx = 0, sy = 0;
    if (c.shake && dt < 0.22) { const a = 1 - dt / 0.22; sx = Math.sin(dt * 120) * 18 * a; sy = Math.cos(dt * 97) * 12 * a; }
    big.style.transform = 'translate(' + sx + 'px,' + sy + 'px) scale(' + sc + ') rotate(' + (c.brot || 0) + 'deg)';
  }
  show($('num'), !!c.num); show($('numlab'), !!c.num);
  if (c.num) { $('num').textContent = c.num; $('numlab').textContent = c.numlab || '';
    $('num').style.transform = 'scale(' + (1.6 - 0.6 * back(clamp(dt / 0.2))) + ')'; }
  show($('chip'), !!c.chip); if (c.chip) $('chip').textContent = c.chip;
  show($('band'), !!c.band);
  if (c.band) { $('band').innerHTML = '<div class="t">' + c.band + '</div><div class="s">' + (c.sub || '') + '</div>';
    $('band').style.transform = 'translateX(' + (-1080 * (1 - out3(clamp(dt / 0.25)))) + 'px)'; }
  const phs = [...document.querySelectorAll('.ph')];
  phs.forEach((p, i) => show(p, c.ph === i));
  if (has(c.ph)) {
    const p = phs[c.ph], h = p.offsetHeight, top = 1230 - h;
    const x = 1080 * (1 - out3(clamp(dt / 0.22))) * (c.from || 1);
    p.style.top = top + 'px'; p.style.transform = 'translate(' + x + 'px,' + (-14 * u) + 'px) rotate(' + (c.prot || 0) + 'deg)';
    $('phcap').style.top = (top + h + 18) + 'px';
  }
  show($('phcap'), has(c.ph)); if (has(c.ph)) $('phcap').textContent = c.phcap || '';
  const hd = $('head'); hd.style.display = c.head ? 'flex' : 'none';
  if (c.head) { hd.innerHTML = '<div style="font-size:' + (c.hsize || 110) + 'px">' + c.head + '</div>' + (c.hsub ? '<small>' + c.hsub + '</small>' : '');
    hd.style.transform = 'scale(' + (1.25 - 0.25 * back(clamp(dt / 0.16))) + ')'; hd.style.transformOrigin = '0%% 100%%'; }
  show($('cap'), !!c.cap); if (c.cap) $('cap').textContent = c.cap;
  // 색면 와이프 — 컷 시작 0.32초 동안 화면을 쓸고 지나간다
  const w = $('wipe');
  if (c.wipe && dt < 0.32) { w.style.background = c.wipe; w.style.left = (-1600 + 3300 * out3(dt / 0.32)) + 'px'; }
  else w.style.left = '-1600px';
  document.querySelectorAll('#prog i b').forEach((b, i) => {
    let f = 0;
    if (c.segDone) f = 1; else if (has(c.seg)) f = i < c.seg ? 1 : i === c.seg ? clamp((t - c.segS) / c.segL) : 0;
    b.style.width = (f * 100) + '%%';
  });
  $('prog').style.display = (NSEG && (has(c.seg) || c.segDone)) ? 'flex' : 'none';
}
%(music)s
let t0 = null;
function loop(now) { if (t0 === null) t0 = now; const t = (now - t0) / 1000; render(Math.min(t, T - 0.001)); if (t < T) requestAnimationFrame(loop); }
let started = false;
function go() { if (started) return; started = true; try { music(); } catch (e) {} requestAnimationFrame(loop); }
render(0);
document.addEventListener('click', go);
if (!navigator.webdriver) setTimeout(go, 500);
"""

MUSIC = r"""
function music() {
  const c = new (window.AudioContext || window.webkitAudioContext)(), T0 = c.currentTime, B = %(B)s, T = %(T)s;
  const out = c.createGain(); out.connect(c.destination);
  out.gain.setValueAtTime(1, T0); out.gain.setValueAtTime(1, T0 + T - 0.6); out.gain.linearRampToValueAtTime(0.0001, T0 + T - 0.02);
  const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), d = nb.getChannelData(0);
  let seed = 7; for (let i = 0; i < d.length; i++) { seed = (seed * 16807) %% 2147483647; d[i] = seed / 1073741823.5 - 1; }
  function kick(t) { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, T0 + t);
    o.frequency.exponentialRampToValueAtTime(42, T0 + t + 0.12); g.gain.setValueAtTime(0.9, T0 + t);
    g.gain.exponentialRampToValueAtTime(0.001, T0 + t + 0.28); o.connect(g); g.connect(out); o.start(T0 + t); o.stop(T0 + t + 0.3); }
  function noise(t, dur, vol, hp) { const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = nb; f.type = 'highpass'; f.frequency.value = hp; g.gain.setValueAtTime(vol, T0 + t);
    g.gain.exponentialRampToValueAtTime(0.001, T0 + t + dur); s.connect(f); f.connect(g); g.connect(out);
    s.start(T0 + t); s.stop(T0 + t + dur + 0.02); }
  function tone(n, t, dur, type, vol) { const o = c.createOscillator(), g = c.createGain(); o.type = type;
    o.frequency.value = 440 * Math.pow(2, (n - 69) / 12); g.gain.setValueAtTime(0.0001, T0 + t);
    g.gain.exponentialRampToValueAtTime(vol, T0 + t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, T0 + t + dur);
    o.connect(g); g.connect(out); o.start(T0 + t); o.stop(T0 + t + dur + 0.03); }
  const roots = [45, 41, 36, 43];               // Am F C G
  for (let i = 0; i * B < T - 0.3; i++) {
    const t = i * B, bar = Math.floor(i / 4);
    if (i %% 2 === 0) kick(t);
    if (i %% 2 === 1) noise(t, 0.16, 0.35, 1800);                 // 스네어
    noise(t, 0.04, 0.12, 7000); noise(t + B / 2, 0.04, 0.08, 7000); // 하이햇 8분
    tone(roots[bar %% 4], t, B * 0.9, 'sawtooth', 0.07);           // 베이스
    if (i %% 4 === 0) [0, 3, 7].forEach(x => tone(roots[bar %% 4] + 24 + x, t, B * 3.6, 'triangle', 0.025));
  }
  %(hits)s.forEach(t => { noise(t, 0.5, 0.25, 400); tone(81, t, 0.25, 'square', 0.04); });  // 구간 히트
}
"""


def _ratio(data_uri):
    import base64
    import io
    from PIL import Image
    im = Image.open(io.BytesIO(base64.b64decode(data_uri.split(",", 1)[1])))
    return im.width / im.height


def _poster_size(r, maxh=880, maxw=860):
    h = maxh
    w = int(h * r)
    if w > maxw:
        w, h = maxw, int(maxw / r)
    return w, h


def _lines(s):
    return [x.strip() for x in mic._strip(s).split("\n") if x.strip()]


def _bigsize(text):
    """가장 긴 줄이 폭 940px 에 꽉 차는 글자 크기. 한글은 1em, 숫자·기호·공백은 약 0.6em 으로 친다."""
    def em(line):
        return sum(1.0 if "가" <= ch <= "힣" else 0.6 for ch in line)
    n = max(em(x) for x in text.split("<br>"))
    return int(max(90, min(260, 940 / max(n, 1))))


def _wrap(x):
    """8자 넘는 문구는 가운데 가까운 띄어쓰기에서 두 줄로 나눈다."""
    if len(x) <= 8 or " " not in x:
        return x
    sp = [i for i, ch in enumerate(x) if ch == " "]
    i = min(sp, key=lambda k: abs(k - len(x) / 2))
    return x[:i] + "<br>" + x[i + 1:]


def _sub(f):
    return " · ".join(x for x in [f["time"] if len(f["time"]) <= 16 else "", f["venue"]] if x)


def week_cuts(fs, region, rng):
    """5→1 카운트다운. 리스트 첫 행사가 1위(마지막)로 나온다."""
    cuts, hits, t = [], [0.0], 0.0
    hook = [("이번 주", R["pink"], "#1a1a1a"), (region, R["blue"], "#fff"), ("뭐 하고", "#1a1a1a", "#fff"), ("놀지?", R["pink"], "#1a1a1a")]
    for i, (w, bg, ink) in enumerate(hook):
        cuts.append(dict(s=t, e=t + B, solid=bg, big=w, size=260, ink=ink, brot=(-4 if i % 2 else 3), chip=rng if i == 3 else None))
        t += B
    n = len(fs)
    for k, idx in enumerate(range(n - 1, -1, -1)):
        f = fs[idx]
        hits.append(t)
        punch = f.get("reel_punch") or _lines(f["hook"])[:2]
        day = f.get("reel_day") or f["chip"]
        seg = dict(seg=k, segS=t, segL=6 * B)
        cuts.append(dict(s=t, e=t + B, bg=idx, num=str(idx + 1), numlab=f.get("short") or f["title"],
                         wipe=R["pink"] if k % 2 == 0 else R["blue"], **seg))
        t += B
        cuts.append(dict(s=t, e=t + 2 * B, bg=idx, pst=idx, z0=1.6, z1=1.0, zs=t, zd=0.35, rot=-2, chip=day, **seg))
        t += 2 * B
        cuts.append(dict(s=t, e=t + B, bg=idx, pst=idx, z0=1.0, z1=1.04, zs=t, zd=B, rot=-2, big=day, size=_bigsize(day), y=1000, shake=True, **seg))
        t += B
        pj = "<br>".join(_wrap(p) for p in punch)
        cuts.append(dict(s=t, e=t + B, bg=idx, big=pj, size=_bigsize(pj), y=640, brot=-2, chip=day, **seg))
        t += B
        cuts.append(dict(s=t, e=t + B, bg=idx, pst=idx, z0=0.82, z1=0.86, zs=t, zd=B, rot=2, band=f.get("short") or f["title"],
                         sub=_sub(f), cap=f["poster_credit"], chip=day, **seg))
        t += B
    hits.append(t)
    end = [("저장해 두고", R["blue"]), ("같이 갈 사람", R["pink"]), ("태그!", "#1a1a1a"), ("@picka.news", R["blue"])]
    for i, (w, bg) in enumerate(end):
        cuts.append(dict(s=t, e=t + B, solid=bg, big=w, size=_bigsize(w) if i < 3 else 120, ink="#1a1a1a" if bg == R["pink"] else "#fff",
                         segDone=True, cap="포스터 저작권은 각 주최·주관 측 · 일정은 공식 안내로 확인" if i == 3 else None))
        t += B
    return cuts, hits, round(t, 3), n


def single_cuts(f):
    cuts, hits, t = [], [0.0], 0.0
    words = f.get("reel_hook") or (_lines(f["hook"]) + ["가볼까?"])[:4]
    cols = [(R["pink"], "#1a1a1a"), (R["blue"], "#fff"), ("#1a1a1a", "#fff"), (R["pink"], "#1a1a1a")]
    for i, w in enumerate(words[:4]):
        cuts.append(dict(s=t, e=t + B, solid=cols[i][0], big=w, size=_bigsize(w), ink=cols[i][1], brot=(-4 if i % 2 else 3)))
        t += B
    hits.append(t)
    day = f.get("reel_day") or f["chip"]
    cuts.append(dict(s=t, e=t + 3 * B, bg=0, pst=0, z0=1.7, z1=0.95, zs=t, zd=0.45, rot=-2, chip=day, wipe=R["pink"]))
    t += 3 * B
    cuts.append(dict(s=t, e=t + B, bg=0, pst=0, z0=0.95, z1=0.98, zs=t, zd=B, rot=-2, big=day, size=_bigsize(day), y=1000, shake=True))
    t += B
    for p in (f.get("reel_punch") or _lines(f["hook"])[:2]):
        cuts.append(dict(s=t, e=t + B, bg=0, big=p, size=_bigsize(p), y=720, brot=-2, chip=day))
        t += B
    hits.append(t)
    for lab, x in [("언제", f["date_label"]), ("몇 시", f["time"]), ("어디", f["venue"]), ("얼마", f["price"])]:
        if not x:
            continue
        w = _wrap(x)
        cuts.append(dict(s=t, e=t + 2 * B, bg=0, big=w, size=_bigsize(w), chip=lab, brot=(-2 if t % 1 else 2)))
        t += 2 * B
    cuts.append(dict(s=t, e=t + 2 * B, bg=0, pst=0, z0=0.82, z1=0.86, zs=t, zd=2 * B, rot=2, band=f["title"], sub=_sub(f), cap=f["poster_credit"]))
    t += 2 * B
    hits.append(t)
    for i, (w, bg) in enumerate([("저장해 두고", R["blue"]), ("같이 가요!", R["pink"]), ("@picka.news", R["blue"])]):
        cuts.append(dict(s=t, e=t + B, solid=bg, big=w, size=_bigsize(w) if i < 2 else 120, ink="#1a1a1a" if bg == R["pink"] else "#fff",
                         cap="포스터 저작권은 주최·주관 측 · 일정은 공식 안내로 확인" if i == 2 else None))
        t += B
    return cuts, hits, round(t, 3), 0


def story_cuts(f, base_dir):
    """facts["reel_script"] 대본대로 컷을 만든다. 장면 키:
      beats       박 수(0.5초 단위)
      solid       "pink"|"blue"|"ink"|"paper" 색면 + big
      big         가운데 큰 글자(<br> 줄바꿈)        photo  사진 경로(원본 그대로, 자르지 않음)
      head/hsub   사진·포스터 위쪽 큰 글자/작은 글자   phcap  사진 아래 출처
      poster      true 면 행사 포스터                 chip   왼쪽 위 분홍 칩
      shake       글자 흔들림                          hit    이 컷 시작에 히트음
    """
    cols = {"pink": (R["pink"], "#1a1a1a"), "blue": (R["blue"], "#fff"), "ink": ("#1a1a1a", "#fff"), "paper": (R["paper"], "#1a1a1a")}
    cuts, hits, photos, t = [], [0.0], [], 0.0
    for i, sc in enumerate(f["reel_script"]):
        d = sc.get("beats", 1) * B
        c = dict(s=t, e=t + d, chip=sc.get("chip"), shake=sc.get("shake", False), brot=sc.get("rot", 0))
        if sc.get("solid"):
            bg, ink = cols[sc["solid"]]
            c.update(solid=bg, ink=ink)
        else:
            c.update(bg=0)
        if sc.get("big"):
            c.update(big=sc["big"], size=sc.get("size") or _bigsize(sc["big"]), y=sc.get("y", 760))
        if sc.get("photo"):
            pth = os.path.join(base_dir, sc["photo"]) if not os.path.isabs(sc["photo"]) else sc["photo"]
            photos.append(mic.poster_data_uri(pth))
            c.update(ph=len(photos) - 1, phcap=sc.get("phcap", ""), **{"from": (-1 if i % 2 else 1)}, prot=(-1.5 if i % 2 else 1.5))
        if sc.get("poster"):
            c.update(pst=0, z0=1.5, z1=0.95, zs=t, zd=0.35, rot=-2)
        if sc.get("head"):
            c.update(head=sc["head"], hsub=sc.get("hsub"), hsize=sc.get("hsize") or min(104, _bigsize(sc["head"])))
        if sc.get("cap"):
            c["cap"] = sc["cap"]
        if sc.get("hit") or i == 0:
            hits.append(t)
        cuts.append(c)
        t += d
    return cuts, hits, round(t, 3), 0, photos


def page(posters, cuts, hits, T, nseg, photos=()):
    imgs = "".join(f'<img class="bg" src="{p}">' for p in posters)
    phs = "".join(f'<img class="ph" src="{p}">' for p in photos)
    pst = ""
    for p in posters:
        w, h = _poster_size(_ratio(p))
        pst += f'<div class="pst"><img src="{p}" style="width:{w}px;height:{h}px"></div>'
    music = MUSIC % {"B": B, "T": T, "hits": json.dumps(hits)}
    js = JS % {"T": T, "cuts": json.dumps(cuts, ensure_ascii=False), "nseg": nseg, "music": music}
    prog = "<i><b></b></i>" * nseg
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>{CSS}</style></head>
<body><div id="stage">{imgs}<div id="solid"></div><div id="dots"></div>{pst}
{phs}<div id="phcap"></div><div id="head"></div>
<div id="num"></div><div id="numlab"></div><div id="big"></div><div id="chip"></div><div id="band"></div><div id="cap"></div>
<div id="prog">{prog}</div><div id="brand">픽아트 <b>pica</b></div><div id="wipe"></div></div>
<script>{js}</script></body></html>"""


def load(path):
    facts = json.load(open(path, encoding="utf-8"))
    db = mic.Database()
    ev = db.supabase.table("events").select("*").eq("id", facts["id"]).single().execute().data
    f = mic.build_facts(ev, facts)
    return f, mic.poster_data_uri(facts.get("poster") or ev.get("poster_image_url"))


def bake(html_path, T, mp4, sample=None):
    if sample:
        cap = os.path.join(os.path.dirname(H2V), "capture.js")
        out = os.path.splitext(mp4)[0] + "_frames"
        frames = ",".join(str(int(round(x * 30))) for x in sample)
        subprocess.run(["node", cap, html_path, "--sample", frames, "--sec", str(T), "--out", out], check=True)
        return out
    subprocess.run(["node", H2V, html_path, "--sec", str(T), "--crf", "18", "--out", mp4], check=True)
    return mp4


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["single", "week", "story"])
    ap.add_argument("facts", nargs="+")
    ap.add_argument("--out", required=True)
    ap.add_argument("--slug", required=True)
    ap.add_argument("--region", default="김해")
    ap.add_argument("--range", default="")
    ap.add_argument("--html-only", action="store_true")
    ap.add_argument("--sample", help="쉼표로 초 단위. 그 시각 프레임만 PNG 로 뽑는다")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    loaded = [load(p) for p in a.facts]
    fs, posters = [x[0] for x in loaded], [x[1] for x in loaded]
    photos = []
    if a.mode == "single":
        cuts, hits, T, nseg = single_cuts(fs[0])
        posters = posters[:1]
    elif a.mode == "story":
        cuts, hits, T, nseg, photos = story_cuts(fs[0], os.path.dirname(os.path.abspath(a.facts[0])))
        posters = posters[:1]
    else:
        cuts, hits, T, nseg = week_cuts(fs, a.region, a.range)
    hp = os.path.join(a.out, a.slug + ".html")
    open(hp, "w", encoding="utf-8").write(page(posters, cuts, hits, T, nseg, photos))
    print(hp, f"{T}s")
    if a.html_only:
        return
    sample = [float(x) for x in a.sample.split(",")] if a.sample else None
    print(bake(hp, T, os.path.join(a.out, a.slug + ".mp4"), sample))


if __name__ == "__main__":
    main()
