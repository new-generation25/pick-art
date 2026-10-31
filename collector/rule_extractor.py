"""AI 없이 공고 문자열에서 날짜를 뽑는 규칙 파서.

흡수하는 표기: 2026.08.20 / 2026-08-20 / 2026.8.20(목) / 2026.10.03(토) ~ 2026.10.04(일)
/ 2026-10-27 ~ 2026-11-01 / 2026.11.05 ~ 11.30 / 11월 5일 ~ 11월 30일 / 상시
파싱에 실패하면 원문을 그대로 두고 parsed=False 를 돌려준다(버리지 않는다).
"""
import re
from datetime import date

_FULL = re.compile(r"(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})")
_MD = re.compile(r"(?<!\d)(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?")


def _iso(y, m, d):
    try:
        return date(int(y), int(m), int(d)).isoformat()
    except ValueError:
        return ""


def parse_period(text: str, default_year: int = None) -> dict:
    """{'start','end','raw','parsed'}. start/end는 'YYYY-MM-DD' 또는 ''."""
    raw = (text or "").strip()
    out = {"start": "", "end": "", "raw": raw, "parsed": False}
    if not raw:
        return out
    if "상시" in raw:
        out["parsed"] = True
        return out
    if re.search(r"[~∼–]", raw):
        parts = re.split(r"\s*[~∼–]\s*", raw, maxsplit=1)
    elif " - " in raw:  # 2026.10.27 - 2026.11.01 처럼 띄운 하이픈으로 구분
        parts = raw.split(" - ", 1)
    else:
        parts = [raw]
    first = _FULL.search(parts[0])
    if first:
        y = first.group(1)
        out["start"] = _iso(y, first.group(2), first.group(3))
    else:
        md = _MD.search(parts[0])
        if md and default_year:
            y = default_year
            out["start"] = _iso(y, md.group(1), md.group(2))
        else:
            return out
    if len(parts) > 1:
        sec = _FULL.search(parts[1])
        if sec:
            out["end"] = _iso(sec.group(1), sec.group(2), sec.group(3))
        else:
            md = _MD.search(parts[1])
            if md:
                out["end"] = _iso(out["start"][:4], md.group(1), md.group(2))
    else:
        out["end"] = out["start"]
    out["parsed"] = bool(out["start"] and out["end"])
    return out


if __name__ == "__main__":
    for s in ["2026.10.03(토) ~ 2026.10.04(일)", "2026-10-27 ~ 2026-11-01", "2026.11.05 ~ 11.30",
              "2026.8.20(목)", "11월 5일 ~ 11월 30일", "상시", "일정 추후 공지"]:
        print(f"{s!r:40} -> {parse_period(s, 2026)}")
