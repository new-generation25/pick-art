"""포스터가 없을 때만 크롤링 단계에서 찾기(운영자 2026-11-27): poster_lookup(KOPIS 같은 날 공연) +
public_scraper._find_poster / _refill_existing. 실행: python -m pytest collector/tests -q"""
import asyncio
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import poster_lookup as pl  # noqa: E402
import public_scraper  # noqa: E402

FUTURE = (date.today() + timedelta(days=20)).isoformat()
PAST = (date.today() - timedelta(days=2)).isoformat()


def test_kopis_lookup_matches_same_day_title_and_caches(monkeypatch):
    lk = pl.KopisPosterLookup()
    calls = []

    async def fake_day(session, day, sido):
        calls.append((day, sido))
        return [("해피 크리스마스 콘서트 [창원]", "http://www.kopis.or.kr/upload/a.png", "PF1"),
                ("다른 공연", "http://www.kopis.or.kr/upload/b.png", "PF2")]

    monkeypatch.setattr(pl.ks, "API_KEY", "k")
    monkeypatch.setattr(lk, "_day", fake_day)
    poster, name = asyncio.run(lk.find(None, "해피 크리스마스 콘서트", "2026-12-20", "창원"))
    assert poster == "https://kopis.or.kr/upload/a.png" and "[창원]" in name
    assert calls == [("20261220", "48")]
    assert asyncio.run(lk.find(None, "없는 공연 제목", "2026-12-20", "부산")) == (None, None)
    assert calls[-1] == ("20261220", "26")  # 부산은 시도 26
    assert asyncio.run(lk.find(None, "ab", "2026-12-20", "창원")) == (None, None)  # 너무 짧은 제목은 맞추지 않는다


class T:
    def __init__(self, db, name): self.db, self.name, self.patch, self.id = db, name, None, None
    def select(self, *_a): return self
    def eq(self, _c, v): self.id = v; return self
    def ilike(self, *_a): return self
    def update(self, p): self.patch = p; return self

    def execute(self):
        if self.patch is not None:
            self.db.updates.append((self.name, self.id, self.patch))
            return type("R", (), {"data": []})()
        return type("R", (), {"data": self.db.hidden if self.name == "events" else []})()


class DB:
    def __init__(self, hidden=()):
        self.hidden, self.updates = list(hidden), []
        self.supabase = self
    def table(self, n): return T(self, n)


def scraper(db, kopis=(None, None), uploads=None):
    s = public_scraper.PublicScraper(db)
    s._placeholders = {"PH"}

    async def fake_find(session, title, start, region):
        return kopis

    s._kopis.find = fake_find
    up = uploads if uploads is not None else {}

    async def fake_upload(sb, url, key):
        return None, up.get(url, (None, None))[0], up.get(url, (None, None))[1]

    public_scraper.process_and_upload_image = fake_upload
    return s


D = {"slug": "x", "region": "창원", "detail": None}
IT = {"image": None}


def test_find_poster_list_placeholder_then_kopis():
    s = scraper(DB(), kopis=("https://kopis.or.kr/p.png", "공연 [창원]"),
                uploads={"list.png": ("store/list.webp", "PH"), "https://kopis.or.kr/p.png": ("store/k.webp", "SHA1")})
    url, sha = asyncio.run(s._find_poster(None, D, {}, "l", None, {"image": "list.png"}, "공연", FUTURE, "공연", "k"))
    assert (url, sha) == ("store/k.webp", "SHA1")  # 목록 그림이 안내 그림이라 버리고 KOPIS 를 쓴다


def test_find_poster_kopis_only_for_performances():
    s = scraper(DB(), kopis=("https://kopis.or.kr/p.png", "x"), uploads={"https://kopis.or.kr/p.png": ("store/k.webp", "S")})
    assert asyncio.run(s._find_poster(None, D, {}, "l", None, IT, "전시", FUTURE, "전시", "k")) == (None, None)


def test_refill_skips_items_that_have_a_poster():
    db = DB()
    s = scraper(db, kopis=("https://kopis.or.kr/p.png", "x"), uploads={"https://kopis.or.kr/p.png": ("store/k.webp", "S")})
    ex = {"id": "r1", "status": "COLLECTED", "image_urls": ["store/old.webp"], "source_url": "l", "source_id": "1"}
    assert asyncio.run(s._refill_existing(None, D, {}, IT, ex, "공연", {"start": FUTURE, "end": FUTURE}, {"category": "공연"})) is False
    assert db.updates == []


def test_refill_hidden_event_gets_poster_and_is_republished():
    db = DB(hidden=[{"id": "ev1", "raw_post_id": "r2"}])
    s = scraper(db, kopis=("https://kopis.or.kr/p.png", "x"), uploads={"https://kopis.or.kr/p.png": ("store/k.webp", "S9")})
    ex = {"id": "r2", "status": "PUBLISHED", "image_urls": ["store/placeholder.webp"], "source_url": "l", "source_id": "2"}
    ok = asyncio.run(s._refill_existing(None, D, {}, IT, ex, "공연", {"start": FUTURE, "end": FUTURE}, {"category": "공연"}))
    assert ok is True
    assert ("raw_posts", "r2", {"image_urls": ["store/k.webp"]}) in db.updates
    ev = [u for u in db.updates if u[0] == "events"][0]
    assert ev[1] == "ev1" and ev[2]["status"] == "PUBLISHED" and ev[2]["poster_image_url"] == "store/k.webp" and ev[2]["poster_sha256"] == "S9"


def test_refill_ignores_finished_events():
    db = DB(hidden=[{"id": "ev1", "raw_post_id": "r3"}])
    s = scraper(db, kopis=("https://kopis.or.kr/p.png", "x"), uploads={"https://kopis.or.kr/p.png": ("store/k.webp", "S")})
    ex = {"id": "r3", "status": "PUBLISHED", "image_urls": [], "source_url": "l", "source_id": "3"}
    assert asyncio.run(s._refill_existing(None, D, {}, IT, ex, "공연", {"start": PAST, "end": PAST}, {"category": "공연"})) is False
