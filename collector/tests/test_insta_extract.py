"""인스타 글에서 제목·날짜·장소 뽑기 (2026-11-27 운영자 코멘트로 보완한 규칙)"""
from datetime import date

import insta_browser_scraper as ibs

REF = date(2026, 11, 20)


def one(cap):
    evs = ibs.extract_post_event(ibs.caption_lines(cap), REF, "https://www.instagram.com/p/x/")
    assert len(evs) == 1, evs
    return evs[0]


def test_work_title_line_beats_promo_first_line():
    e = one("""이럴 수가!
부산을 대표하는 배우들이 한 무대!!!

그리고 지금, 이 배우들이 연극 [나는 나를 죽였다]를 위해 한자리에 모였습니다.

🎭 연극 〈나는 나를 죽였다〉

📅 2026. 12. 3.(목) – 12. 5.(토)
📍 나다소극장
⏰ 목·금 오후 7시 30분 / 토 오후 4시
#나는나를죽였다""")
    assert (e["title"], e["venue"], e["start"], e["end"]) == ("나는 나를 죽였다", "나다소극장", "2026-12-03", "2026-12-05")


def test_bare_venue_line_and_day_only_range_end():
    e = one("""드렁큰씨어터의 18번째 창의적 주사
[열세 번째 아이]에 이은 '어른들을 위한 동화' 두번 째 시리즈

연극 [나는 나를 죽였다]
2026.12.03(목)-05(토)
목,금 오후7시30분 | 토 오후4시
나다소극장

예매 | 네이버예약, 인스타그램DM""")
    assert (e["title"], e["venue"], e["start"], e["end"]) == ("나는 나를 죽였다", "나다소극장", "2026-12-03", "2026-12-05")


def test_venue_line_is_not_the_title():
    e = one("""2026 부산국제아트페어 BIAF
점·선·면, 환영에 빠져 시공을 맹글다
2026년 12월 3일(목)–12월 6일(일)
벡스코 제2전시장

김승희
#BIAF #부산전시""")
    assert (e["title"], e["venue"], e["start"], e["end"]) == ("2026 부산국제아트페어 BIAF", "벡스코 제2전시장", "2026-12-03", "2026-12-06")


def test_venue_after_bar_on_date_line():
    e = one("""2026 부산국제아트페어 BIAF
점·선·면, 환영에 빠져 시공을 맹글다
2026년 12월 3일(목)–6일(일) | 벡스코 제2전시장

국내에 처음 소개되는 북한 초대형 작품을 2026 부산국제아트페어에서 만나보세요""")
    assert (e["title"], e["venue"], e["start"], e["end"]) == ("2026 부산국제아트페어 BIAF", "벡스코 제2전시장", "2026-12-03", "2026-12-06")


def test_giveaway_dates_are_not_the_event_date():
    e = one("""🎟️ 2026 부산국제아트페어 무료 티켓 이벤트
전시 취향 확인하고, 친구 태그해서 같이 전시 보러 가요!

🗓️ 응모 마감 | 11월 29일(일) 밤 11시 59분
💌 당첨 안내 | 11월 30일(월), 개별 DM

2026 부산국제아트페어 BIAF
2026년 12월 3일(목)–12월 6일(일) | 벡스코 제2전시장""")
    assert (e["start"], e["end"], e["venue"]) == ("2026-12-03", "2026-12-06", "벡스코 제2전시장")


def test_venue_line_rules():
    assert ibs.venue_line("• 나다소극장") == "나다소극장"
    assert ibs.venue_line("벡스코 제2전시장") == "벡스코 제2전시장"
    assert ibs.venue_line("대학로 보라아트홀 (서울 종로구 창경궁로 260)") == "대학로 보라아트홀"
    assert ibs.venue_line("3·15아트센터 대극장") == "3·15아트센터 대극장"
    # 행사 이름·시각·문장은 장소가 아니다
    assert ibs.venue_line("가을 음악회 in 성산아트홀") == ""
    assert ibs.venue_line("김해문화의전당 기획전시 안내") == ""
    assert ibs.venue_line("목·금 19:30 · 토 16:00 소극장") == ""
    assert ibs.venue_line("소극장에서 만나요!") == ""


def test_third_party_roundup():
    lines = ibs.caption_lines("""놓치면 끝나는 공연 4편
📌 나는 나를 죽였다
• 12.03(목) – 12.05(토)
• 나다소극장
📌 타자기 치는 남자
• 12.03(목) – 12.26(토)
📌 라흐스트
• 12.04(금) – 12.06(일)""")
    assert ibs.third_party_roundup(lines, "backstage.desk", "drunken_theater")
    assert not ibs.third_party_roundup(lines, "drunken_theater", "drunken_theater")
    assert not ibs.third_party_roundup(lines[:4], "backstage.desk", "drunken_theater")


def test_day_only_end_does_not_eat_a_time():
    from naver_blog_scraper import parse_period
    assert parse_period("12.3(목) - 7시 30분", REF)[:2] == ("2026-12-03", "2026-12-03")
    assert parse_period("12.3(목) ~ 19:30", REF)[:2] == ("2026-12-03", "2026-12-03")
    assert parse_period("12.3(목)~5(토)", REF)[:2] == ("2026-12-03", "2026-12-05")
