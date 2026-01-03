import os
import asyncio
import instaloader
from datetime import datetime, timedelta
from database import Database
from dotenv import load_dotenv

# 환경 변수 로드 (우선순위: 시스템 -> .env -> .env.local)
load_dotenv()
if not os.getenv("INSTAGRAM_USERNAME"):
    load_dotenv(".env.local")

class InstaScraper:
    def __init__(self, db: Database):
        self.db = db
        # 검색할 프로필 목록 (로그인 문제로 해시태그 대신 프로필 타겟팅)
        # gncaf: 경남문화예술진흥원, socialceo4: 사용자 요청 타겟
        self.target_profiles = ["gncaf", "socialceo4", "315art"]
        
        # Instaloader 초기화
        self.L = instaloader.Instaloader(
            download_pictures=False,
            download_videos=False, 
            download_video_thumbnails=False,
            compress_json=False,
            max_connection_attempts=3,
            sleep=True # 요청 간 랜덤 딜레이 자동 적용
        )
        
        # 로그인 시도
        # [안전 모드] 계정 차단 방지를 위해 로그인을 시도하지 않고 Guest 모드로만 동작합니다.
        self.login_user = None # os.getenv("INSTAGRAM_USERNAME")
        self.login_pass = None # os.getenv("INSTAGRAM_PASSWORD")
        self._login()

    def _login(self):
        """인스타그램 로그인 (현재 비활성화됨)"""
        print("ℹ️ Safety Mode: Skipping login to protect account.")
        print("   Continuing explicitly as Guest.")
        return

    async def scrape(self):
        """메인 수집 로직"""
        print("Starting Instagram scrape (Profile Mode)...")
        
        SINCE = datetime.now() - timedelta(days=7)
        
        for username in self.target_profiles:
            print(f"Scanning profile: @{username}")
            count = 0
            
            try:
                # 프로필 객체 가져오기
                profile = instaloader.Profile.from_username(self.L.context, username)
                
                posts = profile.get_posts()

                for post in posts:
                    if post.date_utc < SINCE:
                        print(f"Old post reached ({post.date_utc}), stopping for @{username}")
                        break
                        
                    post_url = f"https://www.instagram.com/p/{post.shortcode}/"
                    if self.db.check_duplicate(post_url):
                        print(f"Duplicate found: {post_url}")
                        continue
                        
                    print(f"Processing: {post_url} ({post.date_utc})")
                    await self._process_post(post, post_url, username)
                    
                    count += 1
                    if count >= 3: # 계정당 3개만 (테스트)
                        print(f"Limit reached for @{username}")
                        break
                        
            except instaloader.ProfileNotExistsException:
                print(f"Profile @{username} does not exist.")
            except instaloader.LoginRequiredException:
                print(f"Login required to view @{username}. Skipping.")
            except Exception as e:
                print(f"Error processing @{username}: {e}")
                
            await asyncio.sleep(5)

    async def _process_post(self, post, post_url, tag):
        try:
            # 1. 메타데이터 추출
            description = post.caption or ""
            
            # AI 메타데이터 분석
            from ai_extractor import AIExtractor
            ai = AIExtractor()
            # 해시태그 맥락을 AI에게 힌트로 제공
            ai_input = f"[Hashtag: #{tag}]\n{description}"
            ai_suggestion = await ai.extract_metadata(ai_input)
            
            # 2. 이미지 처리
            # Instaloader의 post.url은 원본 이미지 URL임
            img_urls = [post.url]
            # 사이드카(여러 장)인 경우 추가 이미지 수집
            if post.typename == 'GraphSidecar':
                img_urls = [node.display_url for node in post.get_sidecar_nodes()]
            
            # Supabase Storage에 영구 저장
            thumbnail_url = None
            permanent_img_urls = []
            img_hashes = []
            from utils import process_and_upload_image
            
            for i, img_url in enumerate(img_urls[:5]): # 최대 5장
                t_url, p_url, p_hash = await process_and_upload_image(
                    self.db.supabase, 
                    img_url, 
                    f"insta_{post.shortcode}_{i}"
                )
                if p_url:
                    if i == 0: thumbnail_url = t_url
                    permanent_img_urls.append(p_url)
                    img_hashes.append(p_hash)
            
            if not permanent_img_urls:
                print("Failed to save images. Skipping post.")
                return

            # 3. DB 저장
            post_data = {
                "source": "instagram",
                "source_id": post.shortcode,
                "source_url": post_url,
                "content": {
                    "title": (description.split('\n')[0].strip()[:50] or "제목 없음") if description else "제목 없음",
                    "description": description,
                    "date": post.date_utc.isoformat(),
                    "author": post.owner_username,
                    "likes": post.likes,
                    "ai_suggestion": ai_suggestion,
                    "hashtag_context": tag
                },
                "image_urls": permanent_img_urls,
                # "poster_thumbnail_url": thumbnail_url, # DB 컬럼 없음 이슈로 일시 제거
                # "images_hash": img_hashes, # DB 컬럼 없음 이슈로 일시 제거
                "status": "CANDIDATE" if ai_suggestion else "COLLECTED" 
                # AI 분석 결과가 있으면 바로 CANDIDATE로 격상 고려 가능, 일단은 수집 상태로.
            }
            
            self.db.save_raw_post(post_data)
            print(f"Saved: {post.shortcode}")
            
        except Exception as e:
            print(f"Error saving post {post.shortcode}: {e}")
