"""공개 행사에서 개인 휴대전화 번호를 가린다(운영자 2026-11-27 「휴대폰 번호는 가려」).

일반전화(055-…, 051-…, 1588-… 등)는 그대로 두고, 휴대전화(010·011·016·017·018·019, +82 10 …)만
「(번호는 원문 안내 페이지에서 확인)」으로 바꿔 원문 링크로 안내한다. 판별식은 리플렛 접수(tools/leaflet_queue.py MOBILE,
specs/017)와 같다. 가리는 것은 수집한 글뿐이다 — 포스터 이미지는 그대로 둔다(운영자 11/27 「포스터는 놔두고」).
행사를 공개하는 곳(tools/publish_verified.py, tools/review_instagram.py)이 저장 직전에 부른다.
"""
import re

MOBILE = re.compile(r"(?:\+?82[\s.\-]*0?|(?<!\d)0)1[016789][\s.\-)]*\d{3,4}[\s.\-]*\d{4}(?!\d)")
MASK = "(번호는 원문 안내 페이지에서 확인)"


def mask_mobile(text):
    """문자열의 휴대전화 번호를 가린다. 문자열이 아니면 그대로 돌려준다"""
    if not isinstance(text, str) or not text:
        return text
    return MOBILE.sub(MASK, text)


def mask_event(event: dict) -> dict:
    """행사 저장값 가운데 글 칸(제목·설명·관람료·장소)의 휴대전화 번호를 가린 사본"""
    out = dict(event)
    for k in ("title", "description", "price_info", "venue"):
        if k in out:
            out[k] = mask_mobile(out[k])
    return out
