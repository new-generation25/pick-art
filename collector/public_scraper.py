import aiohttp
from bs4 import BeautifulSoup
from database import Database
import asyncio
import random
import re
import html
import json
from urllib.parse import urljoin
from ai_extractor import AIExtractor
from datetime import datetime, timezone, timedelta

from source_loader import find_for_url
from rule_extractor import parse_period
from utils import check_link, process_and_upload_image

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}


def _pick(node, spec):
    """'선택자' 는 글자, '선택자@속성' 은 속성 값을 돌려준다."""
    if not spec:
        return ""
    sel, _, attr = spec.partition("@")
    el = node.select_one(sel) if sel else node
    if el is None:
        return ""
    return (el.get(attr) or "") if attr else el.get_text(" ", strip=True)


class PublicScraper:
    def __init__(self, db: Database):
        self.db = db

    async def scrape(self, dynamic_targets):
        """대상별 결과 [{name, status, summary}]를 돌려준다."""
        results = []
        if not dynamic_targets: return results

        async with aiohttp.ClientSession(headers=UA) as session:
            for target in dynamic_targets:
                target_name = target.get('name', 'unknown')
                target_url = target.get('value') or target.get('url')
                log_id = target.get('log_id')

                print(f"\n{'='*60}", flush=True)
                print(f"[Scraper] 🎯 Target: {target_name}", flush=True)
                print(f"[Scraper] 🔗 URL: {target_url}", flush=True)
                print(f"[Scraper] 📋 Log ID: {log_id}", flush=True)
                print(f"{'='*60}", flush=True)

                try:
                    definition = find_for_url(target_url)
                    if definition:
                        result = await self._scrape_definition(session, definition, target_name)
                    else:
                        result = await self._scrape_generic(session, target_url, target_name)
                except Exception as e:
                    result = {"name": target_name, "status": "FAIL", "summary": f"❌ 사이트 오류: {str(e)}"}

                print(f"\n{'='*60}\n[Scraper] {result['summary']}\n{'='*60}\n", flush=True)
                self._update_log(log_id, result["summary"], result["status"])
                results.append(result)
        return results

    async def _scrape_definition(self, session, d, target_name):
        """collector/sources/<slug>.json 정의를 그대로 실행한다. 사이트별 분기 없음."""
        new = dup = fail = updated = 0
        found = 0
        expired = []
        print(f"[Scraper] 📐 Definition: {d['slug']} (verified_at {d.get('verified_at')})", flush=True)
        for board in d["boards"]:
            items = await self._list_items(session, d, board)
            print(f"[Scraper] 📊 {board['category']} {board.get('api') and 'API' or board['url']} → {len(items)} items", flush=True)
            if len(items) < d["expect"]["min_rows"]:
                expired.append(board["url"])
                continue
            found += len(items)
            for it in items:
                title = it["title"]
                period = it["period"]
                link = it["link"]
                # 정의가 id 를 주면 그것을, 아니면 링크 끝부분을 쓴다 (같은 출처 안에서 유일하면 된다)
                lst = board.get("list") or d.get("list") or {}
                source_id = str(it.get("id") or "") if (board.get("api") or lst.get("id") or lst.get("id_regex")) else ""
                source_id = source_id or link.rstrip("/").split("/")[-1]
                if not title or not source_id:
                    fail += 1
                    continue
                suggestion = {
                    "category": it.get("category") or board["category"],
                    "region": d["region"],
                    "venue": f"{d['venue']} {it['venue']}".strip() if it.get("venue") and d["venue"] not in it["venue"] else (it.get("venue") or d["venue"]),
                    "date_start": period["start"],
                    "date_end": period["end"],
                    "date_raw": period["raw"],
                    "date_parsed": period["parsed"],
                    "extracted_by": "rule",
                    "source_slug": d["slug"],
                }
                existing = self.db.get_raw_post(target_name, source_id)
                if existing:
                    dup += 1
                    # 예전 수집분에 날짜가 비어 있으면 규칙 추출값으로 채운다
                    old = (existing.get("content") or {}).get("ai_suggestion") or {}
                    if period["parsed"] and not old.get("date_start"):
                        content = dict(existing["content"]); content["ai_suggestion"] = {**old, **suggestion}
                        self.db.supabase.table("raw_posts").update({"content": content}).eq("id", existing["id"]).execute()
                        updated += 1
                    continue
                ok, status, _ = await check_link(session, link)
                if not ok:
                    print(f"  ❌ 링크 열리지 않음 ({status}): {link}", flush=True)
                    fail += 1
                    continue
                description = ""
                body_sel = (d.get("detail") or {}).get("body")
                if body_sel:
                    try:
                        async with session.get(link, timeout=aiohttp.ClientTimeout(total=20)) as r:
                            description = _pick(BeautifulSoup(await r.text(), "html.parser"), body_sel)
                    except Exception:
                        pass
                image = it["image"]
                p_url = None
                if image:
                    _, p_url, _ = await process_and_upload_image(self.db.supabase, image, f"{d['slug']}_{source_id}")
                post = {
                    "source": target_name,
                    "source_id": source_id,
                    "source_url": link,
                    "content": {"title": title, "description": description, "ai_suggestion": suggestion},
                    "image_urls": [p_url] if p_url else [],
                    "status": "COLLECTED",
                }
                if self.db.save_raw_post(post):
                    new += 1
                    print(f"  ✅ {title[:40]} | {period['start']}~{period['end']}", flush=True)
                else:
                    fail += 1
                await asyncio.sleep(random.uniform(0.3, 0.8))

        if expired and not found:
            return {"name": target_name, "status": "FAIL",
                    "summary": f"❌ 정의 만료 의심: {d['slug']} 목록 선택자가 0건 ({', '.join(expired)})"}
        status = "SUCCESS" if new or dup else "FAIL"
        mark = "❌" if status == "FAIL" else ("⚠️" if fail or expired else "✅")
        extra = f", 날짜보완 {updated}" if updated else ""
        warn = f" / 정의 만료 의심 게시판 {len(expired)}" if expired else ""
        return {"name": target_name, "status": status,
                "summary": f"{mark} 수집 완료: 발견 {found}건 (신규 {new}, 중복 {dup}, 실패 {fail}{extra}){warn}"}

    async def _fetch_text(self, session, url, d, board, headers=None):
        """정의의 encoding(예: euc-kr)을 따른다. 없으면 응답 헤더, 그다음 utf-8."""
        async with session.get(url, headers=headers or {}, timeout=aiohttp.ClientTimeout(total=30)) as r:
            raw = await r.read()
            enc = board.get("encoding") or d.get("encoding") or r.charset or "utf-8"
        return raw.decode(enc, errors="replace")

    async def _list_items(self, session, d, board):
        """게시판 하나의 항목을 [{id, title, period, link, image, venue}]로 만든다.
        board.api 가 있으면 JSON(월별 또는 기간 조회), 없으면 목록 HTML. 게시판마다 list 를 따로 둘 수 있다."""
        items = []
        now = datetime.now()

        def fill(template, values):
            return re.sub(r"\{([\w-]+)\}", lambda m: str(values.get(m.group(1)) or ""), template)

        def clean(t):
            t = html.unescape(re.sub(r"<br\s*/?>", " ", t or ""))
            return re.sub(r"\s+", " ", re.sub(r"^\[[^\]]*\]\s*", "", t)).strip()

        if board.get("api"):
            f = {**d.get("api_fields", {}), **board.get("api_fields", {})}
            seen = set()

            def take(rows, year):
                for row in rows:
                    rid = str(row.get(f["id"]))
                    if rid in seen:
                        continue
                    seen.add(rid)
                    if f.get("period"):
                        period_text = str(row.get(f["period"]) or "")
                    else:
                        start, end = str(row.get(f["start"]) or ""), str(row.get(f["end"]) or "")
                        period_text = f"{start} ~ {end}" if end and end != start else start
                    img = f.get("image_template")
                    items.append({
                        "id": rid,
                        "title": clean(row.get(f["title"])),
                        "period": parse_period(period_text, year),
                        "link": fill(board["link_template"], row),
                        "image": fill(img, row) if img and row.get(f.get("image_key", "fileKey")) else "",
                        "venue": clean(str(row.get(f["venue"]) or "")) if f.get("venue") else "",
                        # 한 API에 공연·전시가 섞여 있으면 category 필드 값으로 나눈다 (category_map: {"전시": "전시"} 처럼 포함 문자열 → 분류)
                        "category": next((v for k, v in (f.get("category_map") or {}).items() if k in str(row.get(f.get("category"), ""))), None),
                    })

            def rows_of(data):
                for key in (f.get("rows") or "").split("."):
                    if key:
                        data = data.get(key, []) if isinstance(data, dict) else []
                return data if isinstance(data, list) else []

            if board.get("api_mode") == "range":
                # 기간 조회 API: 오늘부터 range_days 일 뒤까지. 페이지가 page_size 미만이면 멈춘다
                frm = now.date()
                to = frm + timedelta(days=d.get("range_days", 62))
                for page in range(1, f.get("max_pages", 10) + 1):
                    url = fill(board["api"], {"from": frm.isoformat(), "to": to.isoformat(),
                                              "from_compact": frm.strftime("%Y%m%d"), "to_compact": to.strftime("%Y%m%d"), "page": page})
                    rows = rows_of(json.loads(await self._fetch_text(session, url, d, board)))
                    take(rows, now.year)
                    if "{page}" not in board["api"] or len(rows) < f.get("page_size", 20):
                        break
                return items

            for k in range(d.get("months_ahead", 0) + 1):
                y, m = now.year + (now.month - 1 + k) // 12, (now.month - 1 + k) % 12 + 1
                page = 1
                while True:
                    url = fill(board["api"], {"year": y, "month": m, "page": page})
                    data = rows_of(json.loads(await self._fetch_text(session, url, d, board, {"X-Requested-With": "XMLHttpRequest"})))
                    take(data, y)
                    if len(data) < f.get("page_size", 20):
                        break
                    page += 1
            return items

        lst = board.get("list") or d["list"]
        soup = BeautifulSoup(await self._fetch_text(session, board["url"], d, board), "html.parser")
        for row in soup.select(lst["rows"]):
            rid = _pick(row, lst["id"]) if lst.get("id") else row.get(lst.get("id_attr", "data-idx"))
            values = {**row.attrs, "idx": rid}
            if lst.get("link_regex"):
                # onclick="goView('123')" 처럼 링크가 스크립트 안에 있을 때: 첫 그룹을 {m} 으로 쓴다
                m = re.search(lst["link_regex"], str(row))
                if not m:
                    continue
                values["m"] = m.group(1)
            link = fill(board["link_template"], values) if board.get("link_template") else urljoin(board["url"], _pick(row, lst["link"]))
            if lst.get("id_regex"):
                m = re.search(lst["id_regex"], link)
                rid = m.group(1) if m else rid
            image = _pick(row, lst.get("image"))
            items.append({
                "id": rid,
                "title": clean(_pick(row, lst["title"])),
                "period": parse_period(_pick(row, lst["period"]), now.year),
                "link": link,
                "image": urljoin(board["url"], image) if image else "",
                # "장소 : 남가람박물관" 처럼 앞에 붙은 이름표는 뗀다
                "venue": re.sub(r"^[^:]{1,6}:\s*", "", _pick(row, lst.get("venue"))),
                "category": next((v for k, v in (lst.get("category_map") or {}).items() if k in _pick(row, lst.get("category"))), None),
            })
        if lst.get("dedupe"):
            # 회차마다 한 줄인 목록: 같은 id 는 하나로 합치고 기간을 첫 회~마지막 회로 넓힌다
            merged = {}
            for it in items:
                k = it["id"] or it["link"]
                if k in merged:
                    p, q = merged[k]["period"], it["period"]
                    if q["parsed"] and p["parsed"]:
                        p["start"], p["end"] = min(p["start"], q["start"]), max(p["end"], q["end"])
                        p["raw"] = f"{p['start']} ~ {p['end']}"
                else:
                    merged[k] = it
            items = list(merged.values())
        return items

    async def _scrape_generic(self, session, target_url, target_name):
        """정의 파일이 없는 사이트: 흔한 게시판 선택자로 목록만 시도한다."""
        async with session.get(target_url, timeout=aiohttp.ClientTimeout(total=20)) as response:
            soup = BeautifulSoup(await response.text(), 'html.parser')
        rows = soup.select(".board_list tbody tr") or soup.select("ul.list_type li") or soup.select(".table-list tr")
        print(f"[Scraper] 📊 Found {len(rows)} items using generic selectors (정의 파일 없음)", flush=True)
        if not rows:
            return {"name": target_name, "status": "FAIL",
                    "summary": "❌ 데이터 없음: 선택자 불일치 (정의 파일을 만들어야 함: collector/sources/)"}
        new = dup = fail = 0
        for row in rows:
            link_elem = row.select_one("a")
            if not link_elem:
                continue
            full_url = urljoin(target_url, link_elem.get('href'))
            if self.db.check_duplicate(full_url):
                dup += 1
                continue
            if await self.scrape_detail(session, full_url, target_name, link_elem.get_text(strip=True)):
                new += 1
            else:
                fail += 1
        status = "SUCCESS" if new or dup else "FAIL"
        mark = "❌" if status == "FAIL" else ("⚠️" if fail else "✅")
        return {"name": target_name, "status": status,
                "summary": f"{mark} 수집 완료: 발견 {len(rows)}건 (신규 {new}, 중복 {dup}, 실패 {fail})"}

    def _update_log(self, log_id, summary, status):
        if not log_id: return
        try:
            self.db.supabase.table("crawl_logs").update({
                "result_summary": summary,
                "status": status,
                "finished_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", log_id).execute()
        except: pass

    async def scrape_detail(self, session, url, source, title):
        """정의 파일 없는 사이트용 상세 수집(본문 텍스트에서 날짜 규칙 추출)."""
        try:
            ok, status, _ = await check_link(session, url)
            if not ok:
                print(f"      ❌ 링크 열리지 않음 ({status}): {url}", flush=True)
                return False
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=20)) as response:
                soup = BeautifulSoup(await response.text(), 'html.parser')
            content_div = soup.select_one(".board_view_cont") or soup.select_one(".view_content") or soup.select_one(".cont")
            description = content_div.get_text(" ", strip=True) if content_div else ""
            img_urls = [urljoin(url, img.get('src')) for img in soup.select("img") if img.get('src') and 'download' in img.get('src')]
            clean_title = re.sub(r'^\[.*?\]\s*', '', title).strip()

            ai = AIExtractor()
            suggestion = await ai.extract_metadata(f"제목: {clean_title}\n본문: {description[:1000]}") if ai.enabled else None
            if suggestion is None:
                period = parse_period(description, datetime.now().year)
                suggestion = {'category': '행사', 'region': '경남', 'venue': '',
                              'date_start': period['start'], 'date_end': period['end'],
                              'date_raw': period['raw'][:80], 'date_parsed': period['parsed'], 'extracted_by': 'rule'}
                print(f"      ⏭️ AI 추출 비활성 — 규칙 추출 사용 (날짜 {'성공' if period['parsed'] else '실패'})", flush=True)

            p_url = None
            if img_urls:
                _, p_url, _ = await process_and_upload_image(self.db.supabase, img_urls[0], f"web_{abs(hash(url)) % 10**8}")
            post_data = {
                "source": source,
                "source_id": url.rstrip("/").split("/")[-1],
                "source_url": url,
                "content": {"title": clean_title, "description": description, "ai_suggestion": suggestion},
                "image_urls": [p_url] if p_url else [],
                "status": "COLLECTED"
            }
            return bool(self.db.save_raw_post(post_data))
        except Exception as e:
            print(f"      ❌ Detail error ({url}): {str(e)}", flush=True)
            return False
