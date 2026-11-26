"""행사 세부 갈래 판정 (specs/015). 규칙은 rules/genre_rules.json 에 있다(코드에 사이트별·낱말별 규칙을 넣지 않는다).

- KOPIS 행사: 설명의 «장르: …» 줄(공개할 때 publish_verified 가 적는다)을 KOPIS 대응표로 바꾼다 → by='kopis'
- 나머지: 제목·설명에서 단서 낱말을 찾는다. 한 갈래만 걸리면 확정(by='rule'), 둘 이상이면 prefer 로 하나가 남을 때만 확정,
  그 밖에는 운영자 검토 대기(pending). 대분류에 fallback 이 있으면 단서가 없을 때 그 값으로 확정.
- AI 를 쓰지 않는다(헌장 IV). 근거(걸린 낱말)를 evidence 로 남긴다.
"""
import json
import os
import re

_RULES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rules", "genre_rules.json")
_rules = None


def rules():
    global _rules
    if _rules is None:
        with open(_RULES_PATH, encoding="utf-8") as f:
            _rules = json.load(f)
    return _rules


def normalize_category(cat):
    """예전 분야 이름을 지금 이름으로 (체험·교육 → 체험, 사용자 결정 1)"""
    if not cat:
        return cat
    return rules()["category_alias"].get(cat, cat)


_GENRE_LINE = re.compile(r"^\s*장르\s*[:：]\s*(.+?)\s*$", re.M)


def kopis_genre(description):
    m = _GENRE_LINE.search(description or "")
    return m.group(1) if m else None


def _hits(text, words):
    t = text.lower()
    return [w for w in words if w.lower() in t]


def is_theater_film(event):
    text = " ".join(str(event.get(k) or "") for k in ("title", "venue", "description"))
    return bool(_hits(text, rules()["theater_film"]["words"]))


def screening_move(event):
    """공연·전시로 들어온 소규모 상영회면 True (→ 행사 › 상영회)"""
    if event.get("category") not in ("공연", "전시", "행사"):  # 행사는 이미 옮긴 것(다시 돌려도 같은 값이 나오게)
        return False
    text = " ".join(str(event.get(k) or "") for k in ("title",))
    s = rules()["screening"]
    return bool(_hits(text, s["words"])) and not _hits(text, s["not_if"])


def classify(event):
    """→ (category, subcategory|None, by|None, evidence, pending)
    category 는 상영회 이동·이름 합치기를 반영한 값이다."""
    R = rules()
    cat = normalize_category(event.get("category"))
    title = event.get("title") or ""
    desc = event.get("description") or ""

    if screening_move({**event, "category": cat}):
        hit = _hits(title, R["screening"]["words"])
        return "행사", "상영회", "rule", f"상영회 단서: {', '.join(hit)}"[:200], False

    # KOPIS 장르
    g = kopis_genre(desc)
    if cat == "공연" and g and g in R["kopis"]:
        return cat, R["kopis"][g], "kopis", f"KOPIS 장르: {g}"[:200], False

    spec = R["categories"].get(cat)
    if not spec:
        return cat, None, None, "", False

    # 제목을 먼저 본다. 제목에 단서가 없을 때만 설명 앞부분(300자)을 본다(설명은 군더더기 낱말이 많다)
    found = {}
    for source, text in (("제목", title), ("설명", desc[:300])):
        for sub, words in spec["subs"].items():
            h = _hits(text, words)
            if h:
                found.setdefault(sub, (source, h))
        if found:
            break

    subs = list(found)
    if len(subs) > 1:
        for win, lose in spec.get("prefer", []):
            if win in subs and lose in subs and len(subs) > 1:
                subs.remove(lose)
    if len(subs) == 1:
        sub = subs[0]
        source, h = found[sub]
        return cat, sub, "rule", f"{source}: {', '.join(h[:4])}"[:200], False
    if not subs and spec.get("fallback"):
        return cat, spec["fallback"], "rule", "단서 없음 → 기본값"[:200], False
    ev = "; ".join(f"{s}({', '.join(found[s][1][:2])})" for s in found) if found else "단서 없음"
    return cat, None, None, f"판정 대기: {ev}"[:200], True
