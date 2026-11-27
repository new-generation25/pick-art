"""privacy.mask_mobile — 공개 행사 글의 휴대전화만 가리고 일반전화는 둔다(운영자 2026-11-27). 실행: python -m pytest collector/tests -q"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from privacy import MASK, mask_event, mask_mobile  # noqa: E402


@pytest.mark.parametrize("text", ["문의 010-2568-0225", "예매 문의 : 010.1234.5678", "01012345678", "011-123-4567",
                                  "019 1234 5678", "+82 10-1234-5678", "(010)1234-5678"])
def test_mobile_masked(text):
    out = mask_mobile(text)
    assert MASK in out and "1234" not in out and "2568" not in out


@pytest.mark.parametrize("text", ["문의 055-331-4183", "051-607-8034", "1588-1234", "2026-12-15 19:30", "관람료 10,000원"])
def test_landline_and_others_kept(text):
    assert mask_mobile(text) == text


def test_mask_event_text_fields_only():
    ev = {"title": "정기연주회", "description": "일시 12/15\n문의 010-2568-0225 / 055-331-4183", "price_info": "무료",
          "venue": "하늬홀", "poster_image_url": "https://x/p.jpg", "event_date_start": "2026-12-15"}
    out = mask_event(ev)
    assert out["description"] == f"일시 12/15\n문의 {MASK} / 055-331-4183"
    assert out["poster_image_url"] == ev["poster_image_url"] and out["event_date_start"] == "2026-12-15"
    assert ev["description"].endswith("055-331-4183") and "010-2568" in ev["description"]  # 원본은 바꾸지 않는다
    assert mask_mobile(None) is None
