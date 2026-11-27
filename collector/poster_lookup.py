"""포스터가 없을 때만 KOPIS 에서 같은 공연의 포스터를 찾는다(운영자 2026-11-27 「크롤링 단계에서, 포스터가 없을시」).

게시판 수집(public_scraper)이 목록 그림·상세 페이지에서 포스터를 못 찾은 공연에만 부른다.
- KOPIS 공연 목록(pblprfr)을 그 공연의 시작일 하루·같은 시도(부산 26 / 경남 48)로 받아 제목을 느슨하게 맞춘다
  (dedupe.loose/similar — [지역] 표기·연도·괄호를 빼고, 짧은 쪽이 긴 쪽에 들어 있으면 같다고 본다)
- 같은 날·같은 시도만 보므로 다른 도시·다른 회차의 포스터를 쓰지 않는다
- 한 실행 안에서 (날짜, 시도) 목록은 한 번만 받는다. KOPIS 는 연달아 부르면 400 을 주므로 요청 사이에 쉰다
따로 매일 도는 검색 작업은 두지 않는다(운영자 「매일 찾는건 비효율적」).
"""
import asyncio

import kopis_scraper as ks
from dedupe import loose, similar

KOPIS_GAP = 1.5  # 초. 연속 요청 400 을 피한다(2026-11-27 시험: 간격 없이 56회 → 모두 400)
BUSAN = "26"
GYEONGNAM = "48"


class KopisPosterLookup:
    def __init__(self):
        self.cache = {}
        self.calls = 0
        self._k = ks.KopisScraper(None)

    async def _day(self, session, day: str, sido: str) -> list:
        key = (day, sido)
        if key in self.cache:
            return self.cache[key]
        out = []
        for page in (1, 2, 3):
            if self.calls:
                await asyncio.sleep(KOPIS_GAP)
            self.calls += 1
            root = await self._k._xml(session, "pblprfr", stdate=day, eddate=day, cpage=page, rows=100, signgucode=sido)
            rows = root.findall("db") if root is not None else []
            out += [(x.findtext("prfnm") or "", x.findtext("poster") or "", x.findtext("mt20id") or "") for x in rows]
            if len(rows) < 100:
                break
        self.cache[key] = out
        return out

    async def find(self, session, title: str, date_start: str, region: str):
        """(포스터 주소, KOPIS 공연명) 또는 (None, None). date_start 는 YYYY-MM-DD"""
        if not ks.API_KEY or not title or not date_start:
            return None, None
        sido = BUSAN if (region or "").startswith("부산") else GYEONGNAM
        lt = loose(title)
        if len(lt) < 3:
            return None, None
        try:
            rows = await self._day(session, date_start.replace("-", ""), sido)
        except Exception:
            return None, None
        for name, poster, _ in rows:
            if poster and similar(lt, loose(name)):
                return poster.replace("http://www.kopis.or.kr/", "https://kopis.or.kr/"), name
        return None, None
