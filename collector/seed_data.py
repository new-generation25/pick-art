import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load root or collector .env
load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url, key)

DUMMY_EVENTS = [
    {
        "title": "진주 남강 유등축제 2024",
        "description": "밤하늘을 수놓는 수천 개의 유등과 함께하는 진주의 대표 축제입니다. 남강의 아름다운 야경과 전통의 조화를 느껴보세요.",
        "category": "축제",
        "region": "진주",
        "venue": "진주 남강 일원",
        "is_free": True,
        "price_info": "무료",
        "event_date_start": "2024-10-05",
        "event_date_end": "2024-10-20",
        "poster_image_url": "https://images.unsplash.com/photo-1533230408702-5e6919dd3366?q=80&w=800",
        "original_url": "https://example.com/1",
        "source": "manual",
        "status": "PUBLISHED"
    },
    {
        "title": "창원 성산아트홀 기획전시: 미디어 아트의 세계",
        "description": "현대 기술과 예술의 만남. 창원 출신 작가들과 함께하는 몰입형 미디어 아트 전시입니다.",
        "category": "전시",
        "region": "창원",
        "venue": "성산아트홀 제1전시실",
        "is_free": False,
        "price_info": "성인 10,000원",
        "event_date_start": "2024-11-01",
        "event_date_end": "2024-12-15",
        "poster_image_url": "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=800",
        "original_url": "https://example.com/2",
        "source": "manual",
        "status": "PUBLISHED"
    },
    {
        "title": "김해 가야테마파크 상설 공연: 가야의 혼",
        "description": "가야의 역사를 웅장한 퍼포먼스로 재현한 상설 뮤지컬 공연입니다.",
        "category": "공연",
        "region": "김해",
        "venue": "가야테마파크 철광산 공연장",
        "is_free": False,
        "price_info": "25,000원",
        "event_date_start": "2024-05-01",
        "event_date_end": "2024-10-31",
        "poster_image_url": "https://images.unsplash.com/photo-1514525253440-b393452e8d26?q=80&w=800",
        "original_url": "https://example.com/3",
        "source": "manual",
        "status": "PUBLISHED"
    },
    {
        "title": "통영 국제 음악당: 클래식의 밤",
        "description": "세계적인 피아니스트와 함께하는 통영의 클래식 선율. 바다가 보이는 공연장에서 특별한 경험을 하세요.",
        "category": "공연",
        "region": "통영",
        "venue": "통영국제음악당 콘서트홀",
        "is_free": False,
        "price_info": "R석 50,000원",
        "event_date_start": "2024-11-20",
        "event_date_end": None,
        "poster_image_url": "https://images.unsplash.com/photo-1507838153414-b4b713384ebd?q=80&w=800",
        "original_url": "https://example.com/4",
        "source": "manual",
        "status": "PUBLISHED"
    },
    {
        "title": "거제 바다 미술제: 경계 너머",
        "description": "거제도의 아름다운 해변을 배경으로 설치된 거대 조각상과 현대 미술 작품들을 만나보세요.",
        "category": "전시",
        "region": "거제",
        "venue": "거제 아주동 해안가",
        "is_free": True,
        "price_info": "무료",
        "event_date_start": "2024-09-15",
        "event_date_end": "2024-10-30",
        "poster_image_url": "https://images.unsplash.com/photo-1561214115-f2f134cc4912?q=80&w=800",
        "original_url": "https://example.com/5",
        "source": "manual",
        "status": "PUBLISHED"
    },
    {
        "title": "양산 매화 축제 2025",
        "description": "봄의 전령사 매화가 가득한 원동역 일대에서 펼쳐지는 향기로운 축제입니다.",
        "category": "축제",
        "region": "양산",
        "venue": "양산 원동면 일원",
        "is_free": True,
        "price_info": "무료",
        "event_date_start": "2025-03-10",
        "event_date_end": "2025-03-20",
        "poster_image_url": "https://images.unsplash.com/photo-1522383225653-ed111181a951?q=80&w=800",
        "original_url": "https://example.com/6",
        "source": "manual",
        "status": "PUBLISHED"
    },
    {
        "title": "밀양 아리랑 대축제",
        "description": "유네스코 인류무형문화유산 밀양아리랑을 주제로 한 전통과 현대의 융합 축제입니다.",
        "category": "축제",
        "region": "밀양",
        "venue": "영남루 및 밀양강 일원",
        "is_free": True,
        "price_info": "무료",
        "event_date_start": "2024-05-18",
        "event_date_end": "2024-05-22",
        "poster_image_url": "https://images.unsplash.com/photo-1541018939203-36eeab6d9f21?q=80&w=800",
        "original_url": "https://example.com/7",
        "source": "manual",
        "status": "PUBLISHED"
    },
    {
        "title": "경남 도립 미술관: 근대 회화展",
        "description": "한국 근대 회화의 거장들을 만나보는 시간. 경남도립미술관의 특별 기획전시입니다.",
        "category": "전시",
        "region": "창원",
        "venue": "경남도립미술관 1, 2전시실",
        "is_free": False,
        "price_info": "3,000원",
        "event_date_start": "2024-10-01",
        "event_date_end": "2024-12-31",
        "poster_image_url": "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=800",
        "original_url": "https://example.com/8",
        "source": "manual",
        "status": "PUBLISHED"
    },
    {
        "title": "함안 아라가야 문화제",
        "description": "찬란했던 아라가야의 문화를 직접 체험하고 배우는 역사 축제입니다.",
        "category": "행사",
        "region": "함안",
        "venue": "함안 박물관 및 아라길 일원",
        "is_free": True,
        "price_info": "무료",
        "event_date_start": "2024-04-20",
        "event_date_end": "2024-04-22",
        "poster_image_url": "https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?q=80&w=800",
        "original_url": "https://example.com/9",
        "source": "manual",
        "status": "PUBLISHED"
    },
    {
        "title": "창원 로봇랜드: 봄맞이 가족 축제",
        "description": "온 가족이 함께 즐기는 로봇과 체험의 만남. 아이들을 위한 풍성한 프로그램이 준비되어 있습니다.",
        "category": "체험",
        "region": "창원",
        "venue": "창원 마산 로봇랜드",
        "is_free": False,
        "price_info": "자유이용권 35,000원",
        "event_date_start": "2024-04-01",
        "event_date_end": "2024-05-31",
        "poster_image_url": "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=800",
        "original_url": "https://example.com/10",
        "source": "manual",
        "status": "PUBLISHED"
    }
]

print(f"🚀 Inserting {len(DUMMY_EVENTS)} dummy events into Supabase...")
try:
    response = supabase.table("events").insert(DUMMY_EVENTS).execute()
    print("✅ Success! Dummy data inserted.")
except Exception as e:
    print(f"❌ Error: {e}")
