"""행사 장소 이름 정규화와 좌표 자동 확정 규칙 (specs/002-nearby-events).

순수 함수만 둔다. 네트워크·DB 호출 없음 → tests/test_venue_norm.py 로 검사한다.
"""
import math
import re

# 끝에 붙는 관(공간) 이름 — 확실한 것
_ROOM = re.compile(
    r"(?:대극장|중극장|소극장|대공연장|소공연장|공연장|"
    r"제?\d+\s*전시(?:실|장|관)|전시(?:실|장|관)|다목적홀|챔버홀|\d+홀)"
)
# 「○○홀」 토막 — 건물 이름으로 끝나지 않을 때만 관 이름으로 본다
_HALL = re.compile(r"[가-힣A-Za-z0-9]{1,8}홀")
_BUILDING_TAIL = re.compile(r"(?:아트홀|콘서트홀|아트센터|회관|문화의전당)$")
# 운영 기관 이름이 앞에 붙은 경우(「창원문화재단 성산아트홀」 → 「성산아트홀」)
_OPERATOR_HEAD = re.compile(r"^(?:[가-힣]{2,4}문화재단|[가-힣]{2,4}시설관리공단)\s+")

# 부산·경남 경계 상자(여유 포함)
GN_BBOX = (34.4, 35.95, 127.5, 129.4)


def _drop_brackets(s: str) -> str:
    prev = None
    while prev != s:
        prev = s
        s = re.sub(r"\([^()]*\)|\[[^\[\]]*\]|（[^（）]*）", " ", s)
    return s.replace("(", " ").replace(")", " ")


def normalize_venue(name: str) -> str:
    """'해운대문화회관\\xa0고운홀' → '해운대문화회관', '부산문화회관 (중극장)' → '부산문화회관'."""
    s = (name or "").replace("\xa0", " ").replace("　", " ")
    s = _drop_brackets(s)
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"(\d)\s*·\s*(\d)", r"\1·\2", s)
    s = re.sub(r"(\d·\d+)\s+(아트홀)", r"\1\2", s)
    parts = s.split(" ")
    while len(parts) > 1 and len("".join(parts[:-1])) >= 4:
        last = parts[-1]
        if _ROOM.fullmatch(last) or (_HALL.fullmatch(last) and not _BUILDING_TAIL.search(last)):
            parts = parts[:-1]
        else:
            break
    s = " ".join(parts)
    if _OPERATOR_HEAD.match(s) and len(_OPERATOR_HEAD.sub("", s)) >= 3:
        s = _OPERATOR_HEAD.sub("", s)
    return s.strip()


def strip_html(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s or "").replace("&amp;", "&").strip()


def naver_to_wgs84(mapx, mapy):
    """네이버 지역 검색 mapx·mapy(WGS84 × 1e7 정수 문자열) → (lat, lng). 형식이 다르면 None."""
    try:
        x, y = int(mapx), int(mapy)
    except (TypeError, ValueError):
        return None
    lng, lat = x / 1e7, y / 1e7
    if not (33 <= lat <= 39 and 124 <= lng <= 132):  # 한국 범위가 아니면 다른 좌표계로 본다
        return None
    return lat, lng


def in_gn(lat, lng) -> bool:
    a, b, c, d = GN_BBOX
    return a <= lat <= b and c <= lng <= d


def haversine_m(lat1, lng1, lat2, lng2) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def _squash(s: str) -> str:
    return re.sub(r"[\s·・.\-()]", "", s or "").lower()


def name_matches(query: str, found: str) -> bool:
    q, f = _squash(query), _squash(strip_html(found))
    return bool(q) and bool(f) and (q in f or f in q)


def region_in_address(region: str, address: str) -> bool:
    """region='부산'이면 주소가 '부산'으로 시작, 경남 시군이면 주소에 '<시군>시'·'<시군>군'이 있는지."""
    a = address or ""
    if region == "부산":
        return a.startswith("부산")
    return (region + "시") in a or (region + "군") in a


def decide(query_name: str, region: str, candidates: list) -> tuple:
    """후보 [{name,address,lat,lng}] → ('confirmed', 후보) / ('pending', None) / ('failed', None).

    research.md §2: 경계 안 + 시군 일치 + 이름 일치. 이름이 맞는 후보가 여럿이면 1·2순위가 300m 안일 때만.
    """
    if not candidates:
        return "failed", None
    ok = [c for c in candidates
          if c.get("lat") is not None and in_gn(c["lat"], c["lng"])
          and region_in_address(region, c.get("address", ""))]
    if not ok:
        return "pending", None
    top = ok[0]
    if not name_matches(query_name, top.get("name", "")):
        return "pending", None
    if len(ok) > 1 and name_matches(query_name, ok[1].get("name", "")):
        if haversine_m(top["lat"], top["lng"], ok[1]["lat"], ok[1]["lng"]) > 300:
            return "pending", None
    return "confirmed", top
