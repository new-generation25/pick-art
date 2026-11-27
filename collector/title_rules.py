"""행사 제목 노출 규칙 (운영자 2026-11-27).

«제목에는 원제와 부제만 노출한다.» 회차·연도는 부제로 보고 남긴다. 원래 노출 형식은 유지한다.
꺾쇠·<>가 든 제목은 그대로 둔다. **판단이 애매하면 그대로 둔다.**
그래서 기계가 걷어내는 것은 원제도 부제도 아닌 것이 확실한 두 가지뿐이다.
  1. 제목 끝 대괄호 안이 모두 지역 이름인 꼬리표: «노인의 꿈 [밀양]» → «노인의 꿈» (KOPIS 제목).
     대괄호 안에 다른 말이 섞이면 그대로(«PLAY ME, PIANO GIMHAE [플레이 미, 피아노 김해]», «연극 [더 드레서]»).
     괄호 덧말은 남긴다: «무명전설 전국투어 콘서트 [부산 (앵콜) ]» → «무명전설 전국투어 콘서트 (앵콜)».
  2. 제목 끝의 안내 꼬리: «행사 안내», «개최 안내», «상연»(앞이 빈칸·닫는 괄호·따옴표일 때만 — «정기공연» 같은 이름은 건드리지 않음).
     운영자 11/27 «「저승할망」상연 < 상연 삭제». «(N월) (공연·행사) (프로그램·일정) 안내»까지(«축제»·«전시»는 이름 일부일 때가 많아 남긴다) 한 덩어리로 뺀다:
     «「광안리 M 드론×레이저쇼」 11월 공연 프로그램 안내» → «「광안리 M 드론×레이저쇼」»(운영자 11/27).
  3. 제목 끝 괄호 안이 시각뿐인 것: «여전히 찬란하게(오후7시)» → «여전히 찬란하게», «(19:30)», «(오전 11시 30분)».
     시각은 따로 보여 준다. 운영자 11/27 «여전히 찬란하게(오후7시) < 시간 삭제». «(11월)» 같은 회차·날짜는 부제라 남긴다.
걷어내고 나서 제목이 비면 원래 제목을 그대로 둔다.
근거·50건 표: docs/plan/title_cleanup_50_2026-11-27.md, title_cleanup_50b_2026-11-27.md
"""
import re

from dedupe import REGION_WORDS

# 끝의 [지역] — 뒤에 괄호 덧말만 더 붙은 «ONE HOUR [부산] (12월)» 도 같은 꼬리표다(덧말은 남긴다)
_TAIL_TAG = re.compile(r"\s*\[([^\[\]]{1,30})\](?=(?:\s*\([^()]*\))*\s*$)")
_PAREN = re.compile(r"\([^)]*\)")
# 안내 꼬리: «… 행사 안내», «… 개최 안내», «…「저승할망」상연»
_NOTICE = re.compile(r"(?:\s+|(?<=[」』〉>》）)\]'\"’”]))(?:"
                     r"(?:\d{1,2}\s*월\s*)?(?:(?:공연|행사)\s*)?(?:(?:프로그램|일정)\s*)?(?:개최\s*)?안내"
                     r"|상연)\s*$")
# 시각뿐인 괄호 꼬리: «(오후7시)», «(오후 7시 30분)», «(19:30)», «(오전 11시)»
_TIME_TAIL = re.compile(r"\s*[(（]\s*(?:(?:(?:오전|오후|낮|저녁|밤)\s*)?\d{1,2}\s*시(?:\s*\d{1,2}\s*분|\s*반)?|(?:(?:오전|오후)\s*)?\d{1,2}\s*:\s*\d{2})\s*[)）]\s*$")


_ANY_TAG = re.compile(r"\s*\[([^\[\]]{1,30})\]")


def clean_venue(name):
    """장소 칸의 [ ] 꼬리표를 모두 뺀다. KOPIS 공연장명 «KBS홀 [부산]», «킨키[부산] (킨키 [부산])», «신세계 문화홀 [센텀시티]», «공간소극장 [대연역]».
    운영자 11/27 «장소 이름의 [부산]도 삭제해», «센텀시티 대연역. 공연명(부제, 원제)이 아닌 것들은 모두 삭제야».
    (제목 칸은 다르다: 제목의 [ ] 는 원제일 수 있어 지역 이름뿐일 때만 뺀다 — clean_title)
    빼고 나서 «A (A)» 꼴이 되면 «A» 하나로(kopis_scraper.clean_venue 와 같은 정리)."""
    orig = (name or "").strip()
    out = re.sub(r"\s{2,}", " ", _ANY_TAG.sub("", orig)).replace("( ", "(").replace(" )", ")").strip()
    m = re.fullmatch(r"(.+?)\s*\(\s*(.+?)\s*\)", out)
    if m and m.group(1).strip() == m.group(2).strip():
        out = m.group(1).strip()
    return out or orig


def clean_title(title):
    """제목 → (노출 제목, 걷어낸 조각 목록). 걷어낼 것이 없으면 제목을 그대로 돌려준다"""
    orig = (title or "").strip()
    out, removed = orig, []
    m = _TAIL_TAG.search(out)
    if m:
        inner = m.group(1)
        extras = _PAREN.findall(inner)
        words = _PAREN.sub(" ", inner).split()
        rest = (out[:m.start()] + ("".join(" " + e for e in extras)) + out[m.end():]).strip()
        if words and all(w in REGION_WORDS for w in words) and out[:m.start()].strip():
            removed.append(f"[{inner.strip()}]")
            out = rest
    for rx in (_NOTICE, _TIME_TAIL):
        m = rx.search(out)
        if m and out[:m.start()].strip():
            removed.append(m.group(0).strip())
            out = out[:m.start()].strip()
    return out, removed
