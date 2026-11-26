"""같은 행사 판정 (중복 검수). publish_verified·dedupe_published·insta_state 가 같이 쓴다.

2026-11-26 보완(문화정보 수집 세션 요청, 사용자 «중복데이터가 없도록 검수절차 더 보완»):
- 예전 loose() 는 대괄호를 모두 [지역] 표기로 보고 지워서 「연극 [더 드레서]」가 빈 제목이 됐다 → 중복을 못 잡았다.
  이제 지역 이름이 든 대괄호만 지우고, 다른 대괄호는 기호만 지운다. 그래도 비면 원래 제목에서 기호만 뺀 값으로 본다.
- 묶음 축제(12/1~12/5)와 그 안의 일자별 공연(「(12.01)」 꼬리, 하루짜리)은 중복이 아니다.
"""
import re

# 대괄호 안에 오면 «지역 표기»로 보는 이름 (경남 18 시군·부산 16 구군·옛 시 이름·광역)
REGION_WORDS = {
    "경남", "부산", "창원", "마산", "진해", "진주", "통영", "사천", "김해", "밀양", "거제", "양산", "의령", "함안", "창녕",
    "고성", "남해", "하동", "산청", "함양", "거창", "합천", "중구", "서구", "동구", "영도", "영도구", "부산진", "부산진구",
    "동래", "동래구", "남구", "북구", "해운대", "해운대구", "사하", "사하구", "금정", "금정구", "강서", "강서구", "연제",
    "연제구", "수영", "수영구", "사상", "사상구", "기장", "기장군", "서울", "대구", "울산", "광주", "대전", "인천", "세종",
}
_DATE_TAIL = re.compile(r"\(\s*\d{1,2}\s*[./]\s*\d{1,2}\s*\)")


def norm(title: str) -> str:
    """중복 판정용 제목: [지역]·(괄호) 안을 빼고 한글·영문·숫자만 남긴다.
    출처마다 기호가 달라도(쉼표·×·⨉·＜＞·〈〉 등) 같은 제목으로 본다(2026-11-26 「콘서트누리, 플라워」 vs 「콘서트누리 ⨉ 플라워」)."""
    t = re.sub(r"\[[^\]]*\]|\([^)]*\)", "", title or "").lower()
    t = re.sub(r"[×⨉✕]", "x", t)
    t = re.sub(r"(?<=\s)x(?=\s)", " ", t)  # 「A x B」「A × B」처럼 띄어 쓴 x 는 기호로 본다
    return re.sub(r"[^0-9a-z가-힣]", "", t)


def _strip_region_brackets(title: str) -> str:
    """[지역] 대괄호만 지우고, 다른 대괄호는 괄호 기호만 지운다(안 글자는 남긴다)"""
    def repl(m):
        inner = m.group(1).strip()
        return " " if inner.replace(" ", "") in REGION_WORDS else f" {inner} "
    return re.sub(r"\[([^\]]*)\]", repl, title or "")


def loose(title: str) -> str:
    """이미 공개된 행사와 견줄 느슨한 제목: [지역]·연극/뮤지컬/오페라 접두·〈〉<> 기호·공백·연도를 뺀다(norm 위에).
    ×를 x로 본다(11/26 중복 「한화클래식 2026: …」 「A × B」)."""
    t = _strip_region_brackets(title).strip()
    t = re.sub(r"^(연극|뮤지컬|오페라)\s*", "", t)
    t = re.sub(r"(?<!\d)20\d\d(?!\d)", "", t).replace("×", "x")
    out = norm(t)
    if not out:  # 그래도 비면 원래 제목에서 기호만 뺀 값
        out = re.sub(r"[^0-9a-z가-힣]", "", (title or "").lower())
    return out


def similar(a: str, b: str) -> bool:
    """느슨한 제목이 같거나, 짧은 쪽(3글자 이상)이 긴 쪽에 들어 있으면 같은 행사로 본다"""
    if not a or not b:
        return False
    short, long_ = (a, b) if len(a) <= len(b) else (b, a)
    return short == long_ or (len(short) >= 3 and short in long_)


def is_bundle_and_day(a: dict, b: dict) -> bool:
    """묶음 축제와 그 안의 일자별 공연: 끝나는 날이 다르고, 한쪽 제목에 「(12.01)」 같은 날짜 꼬리가 있다"""
    if (a.get("event_date_end") or "") == (b.get("event_date_end") or ""):
        return False
    return bool(_DATE_TAIL.search(a.get("title") or "") or _DATE_TAIL.search(b.get("title") or ""))


def same_event(a: dict, b: dict) -> bool:
    """두 events 행이 같은 행사인가: 시작일·지역이 같고, 느슨한 제목이 비슷하고, 묶음/일자별 관계가 아니다"""
    if (a.get("event_date_start") or "") != (b.get("event_date_start") or ""):
        return False
    if (a.get("region") or "") != (b.get("region") or ""):
        return False
    if is_bundle_and_day(a, b):
        return False
    return similar(loose(a.get("title")), loose(b.get("title")))


def keep_rank(row: dict) -> int:
    """중복 중 남길 쪽(작을수록 남김): KOPIS → 기관 누리집 등 → 인스타그램 → 웹검색"""
    s = row.get("source") or ""
    if s == "KOPIS":
        return 0
    if s == "인스타그램":
        return 2
    if s == "웹검색":
        return 3
    return 1
