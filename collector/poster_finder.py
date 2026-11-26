"""상세 페이지에서 진짜 포스터 찾기 (specs/014 보완, 2026-11-26 문화정보 수집 세션 요청).

공연장 누리집 중에는 목록·포스터 칸에 «공연 이미지 준비 중» 같은 안내 그림을 두고, 실제 포스터는 나중에 상세 페이지에
올리는 곳이 있다(예: 김해서부문화센터 구지가 — 수집 10/31, 포스터 등록 11/7). 어디서 찾을지는 사이트 정의 파일
(sources/*.json)의 detail 에만 적는다(사이트별 코드를 넣지 않는다, 헌장 IV):
  detail.poster : 포스터 이미지 선택자(CSS). 맞는 이미지를 앞에서부터 후보로 쓴다
  detail.body   : 본문 선택자. 그 안 첫 이미지를 마지막 후보로 쓴다
후보가 안내 그림인지는 placeholder_images 의 지문으로 가린다. 그 지문은 저장본(encode_poster 결과)의 SHA-256 이라,
원본 파일 지문과 저장본 지문을 둘 다 비교한다.
"""
import hashlib
from urllib.parse import urljoin

from utils import encode_poster


def poster_candidates(soup, page_url: str, detail: dict) -> list:
    """상세 페이지(BeautifulSoup)에서 포스터 후보 주소 목록. 겹치는 주소는 한 번만"""
    out = []
    poster_sel = (detail or {}).get("poster")
    body_sel = (detail or {}).get("body")
    if poster_sel:
        for img in soup.select(poster_sel):
            src = (img.get("src") or "").strip()
            if src and not src.startswith("data:"):
                out.append(urljoin(page_url, src))
    if body_sel:
        body = soup.select_one(body_sel)
        if body:
            for img in body.select("img[src]"):
                src = (img.get("src") or "").strip()
                if src and not src.startswith("data:"):
                    out.append(urljoin(page_url, src))
                    break
    seen, uniq = set(), []
    for u in out:
        if u not in seen:
            seen.add(u)
            uniq.append(u)
    return uniq


def has_poster_rule(detail: dict) -> bool:
    return bool((detail or {}).get("poster") or (detail or {}).get("body"))


def fingerprints(data: bytes) -> set:
    """원본 지문과 저장본 지문. 그림으로 읽히지 않으면 원본 지문만"""
    out = {hashlib.sha256(data).hexdigest()}
    try:
        out.add(hashlib.sha256(encode_poster(data)).hexdigest())
    except Exception:
        pass
    return out


def is_placeholder(data: bytes, placeholders: set) -> bool:
    return bool(fingerprints(data) & placeholders)


def load_placeholders(sb) -> set:
    return {r["sha256"] for r in sb.table("placeholder_images").select("sha256").execute().data}
