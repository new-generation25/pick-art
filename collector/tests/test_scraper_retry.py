import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import aiohttp  # noqa: E402
import public_scraper  # noqa: E402


class FakeDB:
    supabase = None


def make(scraper_errors):
    """_scrape_definition 이 scraper_errors 를 차례로 던지고, 다 던지면 성공한다"""
    s = public_scraper.PublicScraper(FakeDB())
    calls = {"n": 0}

    async def fake_def(session, d, name):
        calls["n"] += 1
        if scraper_errors:
            raise scraper_errors.pop(0)
        return {"name": name, "status": "SUCCESS", "summary": "✅ 수집 완료: 발견 1건 (신규 1, 중복 0, 실패 0)"}

    s._scrape_definition = fake_def
    s._update_log = lambda *a: None
    return s, calls


def run(s):
    public_scraper.find_for_url = lambda url: {"slug": "x"}
    public_scraper.RETRY_WAIT = 0
    return asyncio.run(s.scrape([{"name": "시험", "value": "https://example.invalid/"}]))[0]


def test_network_error_retried_once_then_success():
    s, calls = make([aiohttp.ClientConnectionError("끊김")])
    r = run(s)
    assert calls["n"] == 2 and r["status"] == "SUCCESS" and "재시도 1회 뒤 성공" in r["summary"]


def test_network_error_twice_fails():
    s, calls = make([asyncio.TimeoutError(), asyncio.TimeoutError()])
    r = run(s)
    assert calls["n"] == 2 and r["status"] == "FAIL" and "재시도 1회" in r["summary"]


def test_other_error_not_retried():
    s, calls = make([ValueError("선택자")])
    r = run(s)
    assert calls["n"] == 1 and r["status"] == "FAIL"
