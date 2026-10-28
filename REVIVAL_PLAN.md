# pick-art 되살리기 — 수정 계획서

  ㅇ 작성 2026-08-20 · 근거는 **이날 저장소를 직접 읽은 실측**이다. 추정은 「추정」이라고 적었다
  ㅇ 이 문서는 **Claude Code에 넘기는 작업 지시서**다. 사람이 읽을 요약이 아니다
  ㅇ 전제 — **비용 0.** 유료 API를 상시 경로에 두지 않는다
  ㅇ 범위 — pick-art 하나. 다른 프로젝트는 건드리지 않는다

---

## Ⅰ. 확인된 사실

전부 코드에서 직접 확인한 것이다. 인용은 실제 파일 내용이다.

### ① 프로젝트가 7.5개월 정지해 있다

```
6491724  2026-01-04 13:08  style(admin): fix description textarea height…
```

  ㅇ 마지막 커밋 **2026-01-04**. `.agent/AGENT_ARCHITECTURE.md` 의 Last Updated 도 2026-01-11
  ㅇ 그 사이 파이썬·의존성·Supabase 스킴이 움직였을 수 있다. **되살리기 전에 「지금 도는가」부터 재야 한다**

### ② AI 추출기가 코드로 꺼져 있다 ★★ — 이것이 중단의 직접 원인으로 보인다

`collector/ai_extractor.py`

```python
def __init__(self):
    # 🚨 EMERGENCY: AI 비활성화 (비용 문제로 임시 중단)
    self.enabled = False
    print("⚠️ AI extraction temporarily disabled due to cost concerns.")
    return          # ← 아래 코드가 영원히 안 돈다
```

  ㅇ `extract_metadata()` 는 `if not self.enabled: return None` 으로 **항상 None** 을 돌려준다
  ㅇ 그런데 `public_scraper` 는 여전히 `🤖 Running AI metadata extraction` 을 찍는다.
    **로그는 「했다」고 말하는데 실제로는 아무것도 안 한다**
  ㅇ 즉 지금 수집물에는 제목·일시·장소 같은 구조화 필드가 비어 있을 가능성이 크다 (추정 — DB 확인 필요)
  ㅇ **비용 때문에 껐고, 끄니 품질이 무너졌고, 그래서 손을 놓은 것**으로 읽힌다.
    이 계획의 핵심은 **AI 없이도 그 값이 채워지게 만드는 것**이다 (Ⅳ-P3)

### ③ 정기 크롤이 웹사이트만 돈다

`collector/main.py`

```python
elif not specific_target:
    public = PublicScraper(db)
    await public.scrape([c for c in configs if c['target_type'] == 'website'])
    # ... 다른 스크래퍼들 (FB, Insta) ...        ← 주석. 안 돈다
```

  ㅇ 화이트리스트에 인스타그램이 있어도 정기 크롤에서 **조용히 빠진다**
  ㅇ 완료 알림은 `✅ 정기 크롤링 완료` 로 똑같이 나간다. **빠진 것을 알 방법이 없다**

### ④ 수동 요청이 website 가 아니면 영원히 RUNNING 으로 남는다

`main.py` `check_manual_requests()` → `run_crawlers()`

```python
if specific_target and specific_target.get('target_type') == 'website':
    ...   # 처리
elif not specific_target:
    ...   # 정기
# website 가 아닌 수동 요청 → 어느 가지에도 안 걸린다
```

  ㅇ 그 직전에 `status = RUNNING` 으로 이미 바꿔 놓았다. 아무 일도 안 하고 함수가 끝난다
  ㅇ **되돌리는 코드가 없다.** `TROUBLESHOOTING.md` 의 「RUNNING 상태로 멈춤 → 수동으로 정리」가 이것이다
  ㅇ 게다가 `running_targets` 검사 때문에 **그 대상은 이후 요청이 전부 CANCELLED 된다.** 한 번 고착되면 영구다

### ⑤ 셀렉터가 코드에 박혀 있다 ★★ — 유지가 안 되는 구조적 원인

`collector/public_scraper.py`

```python
if "wgcc.ghct.or.kr" in original_url and "board/show" not in original_url:
    target_url = "https://wgcc.ghct.or.kr/board/show01_01"
...
if is_wgcc:
    rows = soup.select("ul.img_list li")
else:
    rows = soup.select(".board_list tbody tr") or soup.select("ul.list_type li") or soup.select(".table-list tr")
```

  ㅇ **사이트 하나 = 파이썬 분기 하나.** 새 기관을 붙이려면 코드를 고쳐야 한다
  ㅇ 그 대가가 `collector/` 에 그대로 쌓여 있다 —
    `debug_kimhae_selectors.py` · `find_exhibition_selector.py` · `find_kimhae_container.py` ·
    `analyze_kimhae_museum.py` · `inspect_gasc.py` · `test_wgcc_direct.py` · `test_kimhae_museum.py` …
  ㅇ 사이트가 개편되면 이 탐색을 **처음부터 다시** 한다

**답은 같은 저장소 옆 프로젝트에 이미 있다.** `F:\projects\class-to-pdf\selectors.json` :

```json
"_comment": "경남대 e-Class (ILOS LMS) 셀렉터. 플랫폼 업데이트 시 이 파일만 수정하세요."
```

요구사항정의서 2.2 에 **「셀렉터 외부화 원칙」**으로 못박아 둔 그 구조다. pick-art 는 같은 문제를 안고도 안 쓰고 있다.

### ⑥ 문서의 경로가 낡았다 — 자동 시작 기능이 깨져 있다

`AUTO_COLLECTOR_GUIDE.md`

```env
COLLECTOR_PATH=E:\developement\pick-art\collector
```

  ㅇ 실제 위치는 **`F:\projects\pick-art\collector`** 다
  ㅇ 프론트의 `/api/collector/status` POST(자동 시작)가 이 경로로 `python -u main.py` 를 띄운다 →
    **환경변수를 안 주면 없는 경로에서 실행을 시도한다**
  ㅇ 이 API 는 `tasklist | findstr python` 으로 상태를 본다. **아무 파이썬 프로세스나 잡는다** —
    다른 프로젝트의 파이썬이 떠 있으면 collector 가 죽어 있어도 🟢 ON 으로 뜬다. 또 하나의 거짓 신호다

### ⑦ 저장소가 일회성 스크립트로 덮여 있다

  ㅇ 최상위에 `fix_profiles_rls.sql` · `fix_profiles_rls_final.sql` · `fix_schema_columns.sql` ·
    `apply_fix.mjs` · `create_configs_direct.mjs` … **한 번 쓰고 남은 것이 30개 이상**
  ㅇ `collector/` 도 같다 — `delete_all_fb.py` · `delete_gasc_data.py` · `clear_inbox.py` 처럼
    **데이터를 지우는 스크립트가 실행 가능한 상태로 널려 있다**
  ㅇ 되살리는 사람이 어느 것이 「지금 쓰는 것」인지 알 수 없다. 잘못 실행하면 데이터가 날아간다

### ⑧ 멀티에이전트 구조가 멈춰 있다

  ㅇ `.agent/system/personas/` 에 페르소나 MD 10개. `.agent/automation/agents/` 의 파이썬 구현은 절반이 `(TBD)`
  ㅇ 2026-01-11 이후 갱신 없음. **설계만 있고 안 돈다**

### ⑨ 페이스북 스크래퍼는 이 계획에서 뺀다

`collector/fb_scraper_service.py` 는 `navigator.webdriver` 를 지우고 아이폰 UA 로 위장한다.
봇 탐지 우회다. **이 계획은 이 경로를 되살리지 않는다.** 공식 창구가 있는 나머지 기관만으로
문화·전시 공고의 대부분이 덮이므로, 이 하나 때문에 전체 구조를 그쪽으로 끌고 갈 이유가 없다.
살릴지 말지는 사람이 판단할 일이고, 이 문서는 **판단 전까지 실행 대상에서 제외**한다.

---

## Ⅱ. 근본 원인 셋

세부 증상은 많지만 뿌리는 셋이다.

| | 원인 | 나타난 곳 |
|---|---|---|
| **①** | **「했다」를 「됐다」로 센다** | ② AI 로그 · ③ 완료 알림 · ④ RUNNING 고착 · ⑥ 프로세스 검사 · `TROUBLESHOOTING` 1번 항목 |
| **②** | **절차가 코드에 박혀 있다** | ⑤ 셀렉터 하드코딩 · `debug_*`/`find_*` 십수 개 |
| **③** | **AI 를 «실행 경로» 에 뒀다** | ② 매 건마다 과금 → 껐다 → 품질 붕괴 → 중단 |

원인 ③이 특히 중요하다. **AI 는 셀렉터가 없어서 하던 일을 대신하고 있었다.**
셀렉터를 제대로 갖추면 AI 가 하던 일의 대부분이 필요 없어진다 — 원인 ②를 풀면 원인 ③이 같이 풀린다.

---

## Ⅲ. 목표 구조

```
[사이트 정의]  sources/<slug>.json      ← 셀렉터·URL·필드 매핑. 코드가 아니다
      │
      ▼
[수집]  public_scraper.py               ← 사이트별 분기 없음. 정의를 읽어 그대로 실행
      │                                    비용 0 · 결정론적 · 매일 자동
      ▼
[추출]  rule_extractor.py               ← 정의된 셀렉터로 제목·일시·장소·썸네일
      │                                    실패한 필드만 목록에 남긴다
      ▼
[저장]  database.py  → raw_posts        ← 저장 성공을 «읽어서» 확인한다
      │
      ▼
[검토]  admin/inbox (Next.js)           ← 사람이 채택
```

**AI 와 사람은 여기 없다.** 둘은 딱 한 곳에만 등장한다 :

```
[발굴]  사이트가 깨졌을 때만
        Claude Code 가 한 번 들어가 새 셀렉터를 찾아 sources/<slug>.json 을 갱신
        → 그다음부터는 다시 스크립트가 혼자 돈다
```

  ㅇ 일상 경로에서 AI 가 빠지므로 **비용도 부정확성도 0**
  ㅇ AI 는 1년에 몇 번뿐인 개편 대응에만 쓰인다. 그때는 구독 안에서 끝난다

---

## Ⅳ. 단계 계획

각 단계는 **완료 판정**이 있어야 넘어간다. 판정은 「돌려 보니 되더라」가 아니라 **숫자나 파일**이다.
원인 ①이 이 프로젝트의 지병이므로, 이 규칙을 어기면 계획 자체가 같은 병에 걸린다.

---

### P0 — 지금 도는가 (반나절)

**목적** : 7.5개월 뒤에도 실행이 되는지부터 잰다. 안 되면 그 아래 계획이 전부 무의미하다.

**할 일**

  ㅇ `collector/requirements.txt` 로 새 가상환경 구성. 설치 실패 패키지를 **전부 기록**한다
  ㅇ Supabase 연결 확인 — `raw_posts` · `crawl_logs` · `whitelist` 세 테이블의
    **현재 컬럼 목록을 파일로 떠 놓는다** (`docs/schema_snapshot_20260820.md`)
    - `TROUBLESHOOTING` 1번이 컬럼 불일치 사고였다. 스킴을 모르고 시작하면 같은 일이 반복된다
  ㅇ `crawl_logs` 에서 **RUNNING 으로 고착된 행** 을 센다. 몇 건인지 기록
  ㅇ `raw_posts` 에서 **제목·일시·장소가 비어 있는 비율**을 센다 → ②의 피해 규모 확정
  ㅇ 프론트 `npm ci && npm run build` 가 통과하는지

**완료 판정**

  ㅇ `docs/P0_현황.md` 에 다음 숫자가 적혀 있다 :
    설치 실패 패키지 수 · 테이블 3종 컬럼 수 · RUNNING 고착 건수 · 빈 필드 비율 · 프론트 빌드 성공 여부
  ㅇ **하나라도 「확인 못 함」이면 P1 으로 넘어가지 않는다**

**하지 말 것**

  ㅇ 이 단계에서 **코드를 고치지 않는다.** 재는 단계다
  ㅇ `delete_*.py` · `clear_inbox.py` 계열을 실행하지 않는다

---

### P1 — 거짓 신호 제거 (1~2일) ★ 먼저 해야 한다

**목적** : 앞으로의 모든 판단이 로그에 의존한다. 로그가 거짓말을 하면 P2 이후를 검증할 수 없다.

**손댈 파일** : `collector/main.py` · `collector/public_scraper.py` · `collector/database.py` ·
`frontend/src/app/api/collector/status/route.ts`

**할 일**

  ㅇ **RUNNING 고착을 없앤다** (사실 ④)
    - `run_crawlers()` 를 «어느 가지에도 안 걸리는 입력」이 없도록 고친다.
      알 수 없는 `target_type` 은 **즉시 FAIL + 이유** 로 마감한다
    - `check_manual_requests()` 에 **타임아웃 회수** 를 넣는다 :
      `started_at` 이 N분(예: 30분) 지난 RUNNING 은 `FAIL / "시간 초과"` 로 마감
    - P0 에서 센 기존 고착 건은 이 로직으로 한 번 청소한다
  ㅇ **저장을 «읽어서» 확인한다** (원인 ①의 본체)
    - `save_raw_post()` 가 insert 응답을 받고 끝내지 말고, **id 로 다시 select 해 존재를 확인**한다
    - 확인 실패는 예외로 올린다. 스크래퍼의 「성공 N건」 카운터는 **이 확인을 통과한 것만** 센다
  ㅇ **정기 크롤이 무엇을 안 돌렸는지 말하게 한다** (사실 ③)
    - 화이트리스트를 유형별로 세고, **처리한 유형과 건너뛴 유형을 완료 알림에 싣는다**
    - 예 : `✅ 정기 크롤링 완료 — website 7건 처리 / instagram 3건 건너뜀(미구현)`
  ㅇ **AI 가 꺼져 있으면 그렇게 찍는다** (사실 ②)
    - `🤖 Running AI metadata extraction` 을 무조건 찍지 않는다.
      `self.enabled` 를 보고 `⏭️ AI 추출 비활성 — 규칙 추출만 사용` 으로 갈라 찍는다
  ㅇ **프로세스 검사를 정직하게** (사실 ⑥)
    - `tasklist | findstr python` 을 버린다. collector 가 시작할 때
      **PID 파일**(`collector/.running.pid`)을 쓰고 종료 시 지운다. 상태 API 는 그 파일과 PID 생존을 본다
    - `COLLECTOR_PATH` 기본값을 현재 경로로 고치고, **경로가 없으면 시작 시도 대신 명확한 오류**를 낸다

**완료 판정** — 아래를 재현해 각각 기대대로 나오는지 확인한다

  ㅇ 존재하지 않는 컬럼을 일부러 하나 끼워 저장 시도 → **성공 카운터가 0** 이고 로그에 오류가 남는다
    (지금은 「1건 성공」이 뜬다)
  ㅇ `target_type='instagram'` 수동 요청 → **30분 안에 FAIL 로 마감**되고 사유가 남는다
  ㅇ collector 를 끈 상태에서 상태 API → **🔴 OFF** (다른 파이썬이 떠 있어도)
  ㅇ 정기 크롤 완료 알림에 **건너뛴 유형이 숫자로** 들어 있다

**하지 말 것**

  ㅇ AI 를 여기서 다시 켜지 않는다. P3 에서 다룬다
  ㅇ 셀렉터를 여기서 건드리지 않는다. P2 의 일이다

---

### P2 — 셀렉터 외부화 (3~5일) ★★ 이 계획의 중심

**목적** : 사이트를 붙이는 일이 **코드 수정이 아니라 파일 추가**가 되게 한다.

**만들 것** : `collector/sources/<slug>.json` · `collector/source_loader.py`

**정의 파일 형태** (초안 — class-to-pdf `selectors.json` 을 이 도메인에 맞춘 것)

```jsonc
{
  "slug": "wgcc",
  "name": "김해서부문화센터",
  "_comment": "사이트 개편 시 이 파일만 고친다. 파이썬은 건드리지 않는다",
  "verified_at": "2026-08-20",          // 마지막으로 실측한 날. 오래되면 경고

  "list": {
    "url": "https://wgcc.ghct.or.kr/board/show01_01",
    "rows": "ul.img_list li",           // 목록 한 건의 컨테이너
    "link": "a@href",                   // 상세 링크 (선택자@속성)
    "title": ".tit",
    "thumb": "img@src"
  },
  "detail": {
    "title":  "h3.view_tit",
    "period": ".info .date",
    "venue":  ".info .place",
    "body":   ".view_cont",
    "images": ".view_cont img@src"
  },
  "expect": {                            // ★ 이 정의가 살아 있는지 재는 기준
    "min_rows": 3,                       // 목록이 이보다 적으면 «깨졌다»
    "required": ["title", "link"],       // 이 필드가 비면 그 건은 실패로 센다
    "date_format_hint": "YYYY.MM.DD ~ YYYY.MM.DD"
  }
}
```

**할 일**

  ㅇ `source_loader.py` — 정의를 읽고 검증한다. **필수 키가 없으면 로딩 자체를 실패**시킨다
  ㅇ `public_scraper.py` 에서 **사이트별 `if` 를 전부 걷어낸다.** 정의를 받아 그대로 실행하는 한 함수로 만든다
    - 지금의 `wgcc` 분기와 generic 분기는 각각 `sources/wgcc.json` · `sources/_generic.json` 으로 옮긴다
  ㅇ **`expect` 를 실제 판정에 쓴다.** `min_rows` 미달이면 그 수집은 **성공이 아니라 「정의 만료 의심」**으로 끝낸다
    - 이게 원인 ①에 대한 구조적 방어다. 0건을 「오늘은 공고가 없네」로 넘기지 않는다
  ㅇ 화이트리스트 항목에 `source_slug` 를 연결한다 (컬럼 추가 또는 매핑 파일)

**완료 판정**

  ㅇ **파이썬 코드에 기관명 문자열이 하나도 남아 있지 않다** — `grep -rn "wgcc\|kimhae\|ghct" collector/*.py` 가 비어야 한다
  ㅇ 기존에 되던 사이트가 **정의 파일만으로 그대로** 수집된다 (P0 대비 건수 동일)
  ㅇ 정의의 `rows` 를 일부러 틀린 값으로 바꾸면 → **「정의 만료 의심」으로 실패**한다 (성공 0건이 아니라 명시적 실패)

**하지 말 것**

  ㅇ 정의 파일에 **파이썬 표현식이나 코드 조각을 넣지 않는다.** 넣는 순간 다시 코드가 된다
  ㅇ 한 번에 모든 사이트를 옮기지 않는다. **wgcc 하나로 끝까지 검증한 뒤** 나머지를 옮긴다

---

### P3 — AI 없이 채운다 (2~3일)

**목적** : 비용 0 으로 돌아가되, 필드가 비지 않게 한다. 원인 ③의 해소.

**만들 것** : `collector/rule_extractor.py`

**할 일**

  ㅇ 정의 파일의 `detail` 셀렉터로 제목·기간·장소·본문·이미지를 **직접** 뽑는다
  ㅇ 날짜만 별도 처리 — 한국 공고에서 흔한 표기를 규칙으로 흡수한다
    `2026.08.20` · `2026-08-20` · `8월 20일` · `2026.8.20(목)` · `~ 09.15` · `상시`
    - **파싱 실패는 원문을 그대로 보존**하고 `date_parsed=false` 로 표시한다. 버리지 않는다
  ㅇ `AIExtractor` 의 하드 비활성(`return`)을 **설정값으로 바꾼다** — `.env` 의 `AI_EXTRACT=off|fallback`
    - `off`(기본) : 규칙만. 비용 0
    - `fallback` : **규칙이 실패한 건에 한해서만** 호출. 사람이 명시적으로 켤 때만
    - 어느 쪽이든 **몇 건에 AI 를 썼는지 로그와 완료 알림에 숫자로** 남긴다
  ㅇ 인박스에 **「규칙 추출 실패 필드」 배지**를 띄운다. 사람이 그 건만 보고 채우면 된다

**완료 판정**

  ㅇ `AI_EXTRACT=off` 로 wgcc 수집 → **제목·링크 100%, 기간·장소 채움률을 숫자로 기록**
  ㅇ 그 실행에서 **AI 호출 0회** 임이 로그로 증명된다
  ㅇ 채움률이 낮은 필드가 무엇인지 목록으로 나온다 → P4 의 입력이 된다

---

### P4 — 사이트 붙이는 절차를 하나로 (1~2일)

**목적** : `debug_*` · `find_*` 십수 개를 **하나의 절차**로 접는다. 앞으로 사이트 추가 = 파일 하나.

**만들 것** : `docs/새_사이트_붙이기.md` · `collector/tools/probe.py`

**할 일**

  ㅇ `probe.py` — URL 하나를 받아 **후보 셀렉터와 그 적중 수를 표로 찍는다**
    - 반복되는 컨테이너 후보 상위 N개 · 각 후보의 자식 중 링크/제목/날짜처럼 보이는 것
    - **숫자를 남기는 것이 목적이다.** video-creator 의 `probeUpload` 가 방향을 잡아 준 것과 같은 역할
  ㅇ 절차 문서에 순서를 못박는다 :
    ① `probe.py <url>` 로 후보를 본다
    ② `sources/<slug>.json` 초안을 쓴다
    ③ `python -m collector.dryrun <slug>` — **DB 에 쓰지 않고** 몇 건이 어떤 필드로 잡히는지만 본다
    ④ 눈으로 확인되면 `verified_at` 을 오늘로 적고 화이트리스트에 연결
  ㅇ 기존 `debug_*` · `find_*` · `analyze_*` · `test_*_direct.py` 를 `collector/_attic/` 로 옮긴다
    - **지우지 않는다.** 옮기고, 절차 문서에 「이제 probe.py 를 쓴다」고 적는다

**완료 판정**

  ㅇ **아직 안 붙인 기관 하나**를 이 절차만으로 붙인다. 코드 수정 0줄
  ㅇ 걸린 시간을 기록한다. 30분 안에 안 되면 절차가 부족한 것이다
  ㅇ `collector/` 최상위에 `debug_*`/`find_*` 가 하나도 없다

---

### P5 — 화면과 인박스 복구 (2~3일)

**목적** : 수집된 것이 사람에게 보이고 채택되는 데까지 잇는다.

**할 일**

  ㅇ P0 의 빌드 결과에 따라 Next.js·의존성 갱신
  ㅇ 인박스에 **P3 의 실패 필드 배지** 표시
  ㅇ 출처 관리 화면에 **정의 파일 상태**를 띄운다 : `verified_at` · 마지막 수집 건수 · 「정의 만료 의심」 여부
    - 이게 있으면 사이트가 깨진 것을 **다음 수집 때 바로** 안다. 지금은 몇 주 뒤에 안다
  ㅇ 자동 시작(P1 의 PID 방식)과 상태 배지 연결

**완료 판정**

  ㅇ 수집 → 인박스 표시 → 채택까지 **한 번 끝까지** 통과한다
  ㅇ 정의를 일부러 깨면 출처 관리 화면에 **경고가 뜬다**

---

### P6 — 정리 (1일)

  ㅇ 최상위 일회성 스크립트 30여 개를 `_attic/` 으로 옮긴다. **지우지 않는다**
  ㅇ 데이터 삭제 스크립트(`delete_*.py` · `clear_inbox.py`)는 `_attic/danger/` 로 옮기고,
    **실행 시 대상 이름을 인자로 요구**하도록 바꾼다 (video-creator ㉘ 의 「이름 하나만 받는다」와 같은 자물쇠)
  ㅇ `.agent/` — 되살릴지 접을지 **결정한다.**
    - 접는다면 `_attic/` 으로. 남긴다면 TBD 를 채운다. **중간 상태로 두지 않는다**
  ㅇ 낡은 문서 정리 — `AUTO_COLLECTOR_GUIDE.md` 의 `E:\developement` 경로 등
  ㅇ `README.md` 를 **지금 구조 기준**으로 다시 쓴다

---

## Ⅴ. 가드레일 — 하지 말 것

  ㅇ **데이터를 지우지 않는다.** 옮기거나 표시로 감춘다. 되살리는 도중의 삭제는 되돌릴 수 없다
  ㅇ **AI 를 상시 경로에 두지 않는다.** `fallback` 도 기본값은 꺼짐이다
  ㅇ **단계를 건너뛰지 않는다.** 특히 P1 전에 P2 를 하면, 셀렉터가 맞는지 로그로 확인할 수 없다
  ㅇ **정의 파일에 코드를 넣지 않는다**
  ㅇ **페이스북 경로를 되살리지 않는다** (사실 ⑨)
  ㅇ **`.env` 계열을 커밋하지 않는다.** `collector/.env` · `collector/.env.local` · `.env.local` 이 있다 —
    P0 에서 `git check-ignore` 로 전부 확인하고, **커밋 이력에 들어간 적이 있으면 해당 키를 폐기 후 재발급**한다
    (video-creator 에서 같은 문제가 미해결로 남아 있다. 여기서 반복하지 않는다)

---

## Ⅵ. 우선순위

전부 할 여력이 없다면 이 순서다.

| 순위 | 단계 | 이유 |
|---|---|---|
| **1** | **P1** | 이게 없으면 그다음 무엇을 해도 됐는지 안 됐는지 모른다 |
| **2** | **P2** | 중단의 구조적 원인. 여기만 풀려도 유지가 가능해진다 |
| **3** | **P3** | 비용 0 복귀. P2 가 끝나면 대부분 저절로 풀린다 |
| 4 | P4 | 다음 사람(또는 반년 뒤의 나)을 위한 것 |
| 5 | P5·P6 | 위 셋이 되면 나머지는 일이지 문제가 아니다 |

**P1+P2+P3 만으로도 「도는 수집기」가 된다.** 화면 없이도 데이터는 쌓인다.

---

## Ⅶ. Claude Code 에 넘기는 법

이 파일을 `F:\projects\pick-art\REVIVAL_PLAN.md` 에 두고, 그 폴더에서 Claude Code 를 띄운 뒤 :

```
REVIVAL_PLAN.md 를 읽고 P0 만 수행해라.

  - P0 는 재는 단계다. 코드를 고치지 마라
  - 결과를 docs/P0_현황.md 에 적어라. 「확인 못 함」도 그대로 적어라
  - delete_*.py · clear_inbox.py 계열을 실행하지 마라
  - 끝나면 P1 로 넘어가도 되는지 판단해서 알려라
```

  ㅇ **단계마다 세션을 끊는다.** P0 결과를 사람이 보고 P1 을 지시한다
  ㅇ 각 단계 지시에 **그 단계의 「완료 판정」을 그대로 복사해 넣는다.** 판정 없이 시키면 「했다」로 끝난다
  ㅇ 먼저 `git switch -c revive/p1` 처럼 **가지를 따고 시작**한다. 되돌릴 길을 열어 둔다

---

## Ⅷ. 이 계획이 답하지 못하는 것

정직하게 적어 둔다.

  ㅇ **Supabase 프로젝트가 아직 살아 있는지 모른다.** 무료 등급은 장기 미사용 시 정지된다.
    P0 에서 연결이 안 되면 이 계획은 처음부터 다시 짜야 한다
  ㅇ **기존 수집 데이터의 품질을 확인하지 못했다.** 사실 ②의 피해 규모는 P0 에서 재야 안다
  ㅇ `frontend/` 와 `admin/`(파이썬 Flask 로 보임)의 **역할 중복**을 확인하지 못했다.
    둘 다 관리자 화면이면 P5 에서 하나를 접어야 한다
  ㅇ 화이트리스트에 지금 **몇 개 기관이 등록돼 있는지** 모른다. P2 의 이관 분량이 여기서 정해진다
  ㅇ 각 단계의 소요는 **어림**이다. P0 결과에 따라 크게 달라진다
