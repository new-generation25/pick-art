"""2026-11-27 공개 판단 전수 검토 판정 적용. 번호는 review_show.py 가 보여 준 갈래별 순서(계정·시작일·제목 순)."""
import sys, json, os
from datetime import datetime, timezone, timedelta
SNAP, MODE = sys.argv[1], sys.argv[2]   # dry | apply
d = json.load(open(SNAP, encoding="utf-8"))
order = lambda b: sorted([x for x in d if x["bucket"] == b], key=lambda x: (x["account"] or x["source"], x["start"], x["title"]))
B = {b: order(b) for b in ("candidate", "human", "consent", "pending")}

def R(*parts):
    out = set()
    for p in parts:
        if isinstance(p, int): out.add(p)
        else: out.update(range(p[0], p[1] + 1))
    return out

WHY = {
    "out": "부산·경남 밖에서 열리는 행사",
    "notevent": "행사 정보가 아닌 글(홍보·소식·안내·모집·할인)",
    "past": "이미 끝난 행사의 글(후기·지난 공연)",
    "dup": "같은 행사의 다른 글(대표 글을 남김)",
    "noinfo": "날짜·장소가 없어 확인할 수 없는 글",
}

# ---- 공개 후보: 뺄 것
CAND = {"out": R(23, 43, 50), "notevent": R(34, 54, 61, 59, 30, 13, 14), "dup": R(47, 52, 4, 19, 32)}
# ---- 사람 판단: 남길 것(나머지는 뺀다)
HUMAN_KEEP = R(17, 18, 19, 20, 47, 50, 56, 57, 74, 78, 93, 95, 96, 97, 102, 126, 130, 131, 132, 152, 165, 169, 179)
HUMAN = {"out": R((85, 91), 98, 99, 100, (103, 117), 119, 150), "dup": R(59, 145, 173, 170),
         "past": R(1, (8, 12), 70, 123, 133, 157, 162, 163, 164, 166, 174, 175, 177, 180, 181, 182), "noinfo": R(60, 148, 176)}
# ---- 동의 필요: 남길 것(나머지는 뺀다)
CONS_KEEP = R(5, 25, 26, 27, 28, 29, 30, 33, 35, 37, 41, 47, 48, 58, 60, 61, 66, 67, 69, 77, 79, 81, 88, 90, 96, 100, 126, 129, 130, 147, 148,
              156, 166, 169, 195, 196, 197, 200, 202, 241, 253, 264, 269, 277, 278, 280, 281, 286, 289, 298)
CONS = {
    "out": R((6, 15), (18, 24), 44, 120, 125, 136, (138, 142), 146, 149, 150, 151, 158, 159, 161, 163, 164, 165, 167, 172, (179, 183), (185, 188), 191, 192, 215, 223, 251, 270, 272),
    "dup": R(34, 36, 40, 51, 78, 80, 91, 92, 93, 101, 133, 134, 190, 194, 220, 221, 222, 224, 263, 265, 266, 267, 268, 290, 291),
    "past": R((0, 4), 17, 31, 39, 43, 46, 56, (71, 76), (82, 87), 89, 94, 95, 97, 98, 99, 105, 106, 107, 112, (116, 119), 121, 122, 124, 153, 155, 157, 160, 162, 170, 171,
              173, 174, 193, 201, 235, 236, 237, (246, 250), 254, 260, 261, 262, 273, 282, 293, 299, 301),
    "noinfo": R(32, 42, 54, 62, 63, 70, 111, 154, 177, 189, 203, 204, 207, 216, 217, 218, 255, 256, 258, 271, 276),
}
PEND = {"notevent": R(6, 14)}

def plan_reject():
    out = []   # (row, why)
    for why, idx in CAND.items():
        out += [(B["candidate"][i], why) for i in idx]
    for name, keep, cats in (("human", HUMAN_KEEP, HUMAN), ("consent", CONS_KEEP, CONS)):
        for i, row in enumerate(B[name]):
            if i in keep: continue
            why = next((w for w, idx in cats.items() if i in idx), "notevent")
            out.append((row, why))
    out += [(B["pending"][i], "notevent") for i in PEND["notevent"]]
    return out

# ---- 고칠 것: (갈래, 번호) → {title, venue, start, end, region, bucket, note}
FIX = {
 ("candidate", 58): dict(title="합천한의학박물관 특별전 '살아있는 맥(脈)'", venue="합천한의학박물관", bucket="human", note="12/12까지 하는 특별전인데 시작일이 글에 없습니다. 시작일을 확인해야 공개할 수 있습니다."),
 ("candidate", 60): dict(title="의령 리치 합창단 정기연주회"),
 ("candidate", 42): dict(title="하모프렌즈 팬미팅 & 콘서트 · 하모 팝업스토어", end="2026-12-06", note="팬미팅·콘서트는 12/5 사전 응모 당첨자 대상, 팝업스토어는 12/5~6입니다."),
 ("candidate", 25): dict(venue="김해시청소년수련관 2층 강당 · 김해문화관광재단 영상미디어센터"),
 ("candidate", 27): dict(title="《잃어버린 시간을 찾아서》", venue="김해시립김영원미술관 제3전시실(B3층)"),
 ("candidate", 28): dict(title="어린이 융합예술교육 《빛으로 춤추는 조각》"),
 ("candidate", 20): dict(title="제20회 이웃사랑 김장나눔축제"),
 ("candidate", 12): dict(title="행암문예마루 12월 문화예술교육 「앨범 바인딩」"),
 ("candidate", 16): dict(title="《카본 클럭 Carbon Clock》"),
 ("candidate", 17): dict(title="클레이아크 해설이 있는 영화산책", venue="클레이아크김해미술관 시청각실(큐빅하우스 3층)"),
 ("candidate", 18): dict(title="고성오광대보존회 '춤의 고을 고성사람들'", venue="고성군 문화체육센터 2층 공연장"),
 ("candidate", 29): dict(title="뮤지엄 음악놀이터"),
 ("candidate", 37): dict(title="홍티예술촌 기획전시 《무른 것들의 단단한 궤도》", venue="홍티예술촌"),
 ("candidate", 38): dict(title="특별전 〈나의 인생 박물관〉 연계 전문가 특별강연"),
 ("candidate", 39): dict(title="시니어 교육프로그램 '내 인생의 보물찾기'", venue="국립진주박물관 교육실"),
 ("candidate", 49): dict(title="제19회 밀양시 소년소녀 합창단 정기연주회"),
 ("candidate", 2): dict(title="춤이 말하다: 문소리X리아킴"),
 ("candidate", 3): dict(title="디토오케스트라 〈아리랑 랩소디〉"),
 ("candidate", 55): dict(title="2026 산청군민 교양강좌 'AI 시대 생존법: 창의적 인간으로 살아남는 법'"),
 ("candidate", 62): dict(title="2026 문화예술인 공동창작소 성과 공유 페스타"),
 ("candidate", 45): dict(title="2026 달마다 빛마루 「빛마루, 문화놀이터」"),
 ("candidate", 7): dict(title="2026 백양시네마 〈Sounds Like Dance〉"),
 ("human", 18): dict(title="창원 명곡도서관 12월 체험형 동화구연", venue="창원 명곡도서관"),
 ("human", 19): dict(title="고향의봄도서관 매직서커스 가족공연", venue="창원 고향의봄도서관"),
 ("human", 20): dict(title="진해 동부도서관 가족 요리체험(크리스마스 쿠키)", venue="진해 동부도서관"),
 ("human", 56): dict(title="장진호 전투 거제포럼 · 서경석 특별강연", venue="삼성호텔 스타라이즈홀", bucket="candidate"),
 ("human", 95): dict(title="크리스마스 빌리지 부산", venue="영화의전당(해운대구 수영강변대로 120)", region="부산"),
 ("human", 102): dict(title="해운대 빛축제", region="부산"),
 ("human", 152): dict(title="조선의 정원, 마음을 심다", venue="부산박물관", region="부산"),
 ("consent", 25): dict(title="무대 위 과학자들: TO THE MOON (부산)", venue="", note="부산 공연 장소가 수집한 글에서 잘렸습니다. 원문에서 장소를 확인해야 합니다."),
 ("consent", 26): dict(title="아람 아티스트 시리즈 콘서트 — 피아니스트 유주연"),
 ("consent", 27): dict(title="TKC Violin Quartet Series 3 〈WINTER RHAPSODY in BUSAN〉", start="2026-12-09", end="2026-12-09", venue="부산문화회관 챔버홀"),
 ("consent", 28): dict(title="춤패 배김새 창단 40주년 기념공연 〈바리고 벼려, 배기다〉", venue="영화의전당 하늘연극장"),
 ("consent", 29): dict(title="창작뮤지컬 〈호출된 사람들〉", venue="경성대학교 콘서트홀"),
 ("consent", 37): dict(venue="부산 가온아트홀 1관"),
 ("consent", 41): dict(title="제114회 백경극예술연구회 정기공연 〈진범〉"),
 ("consent", 47): dict(title="부산심포니오케스트라 송년음악회"),
 ("consent", 48): dict(title="Sound of Busan : 리턴 투 B, 베토벤 1 — 오충근 & BSO with 유다윤", venue="부산문화회관 대극장"),
 ("consent", 77): dict(title="소소리예술회 《12월의 선물》", venue="사천미술관"),
 ("consent", 79): dict(note="디오티미술관 김민지 작가 전시(11/24~12/5)인데 전시 이름이 글에 없습니다. 제목을 원문 포스터에서 확인해야 합니다."),
 ("consent", 88): dict(title="연극 〈더 배드맘즈〉"),
 ("consent", 90): dict(title="연극 《한여름밤의 꿈》", start="2026-12-09", end="2026-12-13", venue="에저또소극장"),
 ("consent", 96): dict(title="앙상블 블랑쉬 CANDLELIGHT CONCERT", venue="", note="장소가 수집한 글에서 잘렸습니다. 원문에서 확인해야 합니다."),
 ("consent", 100): dict(note="매주 금·토·일 공연(11월 첫째 주~12월, 부산 동구 중앙대로195번가길 21 동우빌딩 지하)입니다. 끝나는 날이 글에 없어 날짜를 넣지 않았습니다."),
 ("consent", 129): dict(title="초록마술극장 과학마술쇼"),
 ("consent", 130): dict(venue="초록마술극장"),
 ("consent", 147): dict(title="장하윤 개인전 〈Over there - 조용한 반복〉", start="2026-11-09", end="2026-12-11", venue="모제이갤러리 부산"),
 ("consent", 156): dict(title="극단 큰들 특별공연 〈하동 박치화〉", venue="하동 삼화에코하우스", note="시민 참여자 80명을 모집하는 글입니다(12/5 10:30)."),
 ("consent", 195): dict(venue=""),
 ("consent", 196): dict(title="소요 김지영 개인전 〈자기연서〉"),
 ("consent", 197): dict(title="김지영 개인전 연계 찻자리 '茶와 사물의 시간'"),
 ("consent", 200): dict(venue="나비아트홀"),
 ("consent", 202): dict(title="남가람박물관 〈숙독완미Ⅲ_여중유진〉 제20회 결과발표전", venue="남가람박물관 2F 제3전시실"),
 ("consent", 241): dict(title="임윤묵·서지희 2인전 〈느슨하고 다정한 질서〉", end="2026-12-26", venue="스페이스167"),
 ("consent", 253): dict(title="연극 〈THE BOX〉", venue="해운대문화회관 해운홀"),
 ("consent", 269): dict(title="뮤지컬 〈차트〉", start="2026-12-17", end="2026-12-27"),
 ("consent", 277): dict(title="비바아첼 영아티스트콘서트 12", start="2026-11-28", end="2026-11-28", venue="비바아첼챔버홀"),
 ("consent", 278): dict(venue="비바아첼챔버홀"),
 ("consent", 280): dict(title="2026 VIP 실내악 페스티벌 〈12월의 세레나데〉"),
 ("consent", 281): dict(title="부산원먼스페스티벌 9th — 앙상블 참", venue="비바아첼챔버홀"),
 ("consent", 286): dict(title="밀실 추리극 〈플라워〉"),
 ("consent", 289): dict(title="뮤지컬 〈BLINDED ISLAND〉", start="2026-12-03", end="2026-12-04"),
 ("consent", 298): dict(title="2026 부네치아 낙낙데이"),
 ("human", 17): dict(title="병뚜껑 업사이클링 캠페인(키링 만들기)"),
 ("human", 57): dict(title="2026 거제 삶겹로드 축제"),
 ("human", 165): dict(title="1318 청소년 스타킹 대회"),
 ("consent", 5): dict(title="윤지영 조각 드로잉 전시", venue="나무88갤러리"),
 ("consent", 30): dict(title="제10회 통영청년아트페스티벌 《아트, 완내스 ART FAIR》"),
 ("consent", 66): dict(title="월간공예 11월 「공예로 온기가득」"),
 ("consent", 67): dict(title="「수공의 미학」 ep2. 금속 레이저 조각기·용접기"),
 ("consent", 69): dict(title="UmYull 3rd Concert 〈Dear Cheska〉", venue="가빈아트홀"),
 ("consent", 148): dict(title="깽세x다준 hiphop live", venue="전포와일드클럽 소극장"),
 ("consent", 264): dict(title="움라우트 뮤직 12월 키즈클래식 '두근두근 설레는 크리스마스 음악회'"),
}

rej = plan_reject()
import collections
print("빼는 글:", len(rej), dict(collections.Counter(w for _, w in rej)), "| 갈래별:", dict(collections.Counter(r["bucket"] for r, _ in rej)))
print("고치는 글:", len(FIX))
rej_ids = {r["id"] for r, _ in rej}
assert not any(B[b][i]["id"] in rej_ids for (b, i) in FIX), "고칠 글이 빼는 목록에 있다"
if MODE == "dry":
    for name, keep in (("human", HUMAN_KEEP), ("consent", CONS_KEEP)):
        print(f"--- {name} 남길 글 {len(keep)}")
        for i in sorted(keep):
            x = B[name][i]
            f = FIX.get((name, i), {})
            print(f"  {i:3} @{x['account'][:20]:20} | {(f.get('title') or x['title'])[:44]} | {f.get('start', x['start'])[5:]}~{f.get('end', x['end'])[5:]} | {(f['venue'] if 'venue' in f else x['venue'])[:22]}")
    print("--- candidate 빼는 글")
    for why, idx in CAND.items():
        for i in sorted(idx): print("  ", why, i, B["candidate"][i]["account"], "|", B["candidate"][i]["title"][:40])
    print("--- 기본값(notevent)으로 빠지는 동의 필요 글 수:", sum(1 for i in range(len(B["consent"])) if i not in CONS_KEEP and not any(i in s for s in CONS.values())))
    sys.exit(0)

# ---------------- 적용
sys.path.insert(0, "F:/projects/pick-art/collector")
from dotenv import load_dotenv
load_dotenv("F:/projects/pick-art/collector/.env.local")
from database import Database
sb = Database().supabase
now = datetime.now(timezone.utc).isoformat()
log, done_r, done_f, skipped = [], 0, 0, 0
for row, why in rej:
    cur = sb.table("raw_posts").select("status,content").eq("id", row["id"]).maybe_single().execute()
    cur = cur.data if cur else None
    if not cur or cur["status"] != row["status"]:
        skipped += 1; continue
    c = json.loads(json.dumps(cur["content"] or {}))
    c.pop("publish_approved_at", None); c.pop("publish_failed_at", None)
    c["rejected_reason"] = WHY[why]; c["rejected_by"] = "세션: 전수 검토 11/27"
    got = sb.table("raw_posts").update({"status": "REJECTED", "content": c}).eq("id", row["id"]).eq("status", row["status"]).execute().data or []
    if got:
        done_r += 1; log.append({"id": row["id"], "act": "reject", "why": why, "status_before": row["status"], "content_before": cur["content"]})
for (b, i), f in FIX.items():
    row = B[b][i]
    cur = sb.table("raw_posts").select("status,content").eq("id", row["id"]).maybe_single().execute()
    cur = cur.data if cur else None
    if not cur or cur["status"] != row["status"]:
        skipped += 1; continue
    c = json.loads(json.dumps(cur["content"] or {}))
    a = c.setdefault("ai_suggestion", {})
    if "title" in f: c["title"] = f["title"]
    if "venue" in f: a["venue"] = f["venue"]
    if "region" in f: a["region"] = f["region"]
    if "start" in f: a["date_start"] = f["start"]; a["date_parsed"] = True
    if "end" in f: a["date_end"] = f["end"]
    if "bucket" in f:
        c["review_bucket"], c["review_bucket_at"], c["review_reason"] = f["bucket"], now, "session_review"
    if "note" in f:
        c["admin_notes"] = (c.get("admin_notes") or []) + [{"at": now, "by": "세션: 전수 검토 11/27", "text": "[검토] " + f["note"], "bucket": c.get("review_bucket") or cur["status"], "reason": c.get("review_reason")}]
    c["edited_by"] = "세션: 전수 검토 11/27"
    got = sb.table("raw_posts").update({"content": c}).eq("id", row["id"]).eq("status", row["status"]).execute().data or []
    if got:
        done_f += 1; log.append({"id": row["id"], "act": "fix", "fix": f, "status_before": row["status"], "content_before": cur["content"]})
out_dir = "F:/projects/pick-art/collector/logs/manual_review"
os.makedirs(out_dir, exist_ok=True)
path = f"{out_dir}/applied_{datetime.now(timezone(timedelta(hours=9))).strftime('%Y%m%d_%H%M%S')}.json"
json.dump(log, open(path, "w", encoding="utf-8"), ensure_ascii=False)
print(f"뺌 {done_r}/{len(rej)} · 고침 {done_f}/{len(FIX)} · 건너뜀(그사이 바뀜) {skipped} · 기록 {path}")
