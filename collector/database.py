import os
import requests
from io import BytesIO
from supabase import create_client, Client

class Database:
    def __init__(self):
        url: str = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        key: str = os.environ.get("SUPABASE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        if not url or not key:
            raise ValueError("Supabase URL and Key must be set in environment variables")
        self.supabase: Client = create_client(url, key)

    def get_blacklist(self):
        """블랙리스트 목록을 가져와 캐싱하거나 반환합니다."""
        try:
            res = self.supabase.table("blacklist").select("type, value").execute()
            return res.data
        except:
            return []

    def get_whitelist(self):
        """화이트리스트 목록을 가져옵니다."""
        try:
            res = self.supabase.table("whitelist").select("type, value, auto_publish").execute()
            return res.data
        except:
            return []

    def save_raw_post(self, data: dict):
        """포스트를 저장하며 블랙리스트/화이트리스트 로직을 실행합니다."""
        source = data.get('source')
        source_id = data.get('source_id')
        source_url = data.get('source_url')
        
        # 1. 블랙리스트 체크
        blacklist = self.get_blacklist()
        for item in blacklist:
            if item['value'] in [source_id, source_url]:
                print(f"🚫 [Blacklist] Skipping blacklisted source: {item['value']}")
                return None

        # 2. 화이트리스트 체크 (자동 승인)
        whitelist = self.get_whitelist()
        is_whitelisted = False
        auto_pub = False
        for item in whitelist:
            if item['value'] in [source_id, source_url]:
                is_whitelisted = True
                auto_pub = item.get('auto_publish', False)
                break

        # 3. 기본 저장 (raw_posts)
        status = "PUBLISHED" if (is_whitelisted and auto_pub) else "COLLECTED"
        data['status'] = status
        
        try:
            # 중복 체크 (URL 기반)
            if self.check_duplicate(source_url):
                print(f"⏭️ [Duplicate] Skipping: {source_url}")
                return None

            response = self.supabase.table("raw_posts").upsert(data, on_conflict="source, source_id").execute()
            
            # 4. 화이트리스트 자동 승인 시 events 테이블 바로 입력
            if is_whitelisted and auto_pub:
                print(f"⚡ [Whitelist] Auto-publishing: {data.get('content', {}).get('title')}")
                # 이 시점에는 AI 요약이 아직 안 되었을 수 있으므로 주 수집 로직에서 처리 권장되나, 
                # 여기서는 원본 데이터를 기반으로 기본 필드를 채워 넣습니다.
                event_data = {
                    "title": data['content'].get('title', '제목 없음'),
                    "description": data['content'].get('description', data['content'].get('text', '')),
                    "category": data['content'].get('ai_suggestion', {}).get('category', '행사'),
                    "region": data['content'].get('ai_suggestion', {}).get('region', '경남'),
                    "poster_image_url": data.get('image_urls', [None])[0],
                    "source": source,
                    "original_url": source_url,
                    "status": "PUBLISHED",
                    "raw_post_id": response.data[0]['id'] if response.data else None
                }
                self.supabase.table("events").insert([event_data]).execute()

            return response
        except Exception as e:
            print(f"Error in save_raw_post: {e}")
            return None

    def upload_image(self, image_url: str, filename: str) -> str:
        """외부 이미지 URL을 다운로드하여 Supabase Storage에 업로드하고 경로를 반환합니다."""
        import requests
        from io import BytesIO
        try:
            response = requests.get(image_url, timeout=10)
            if response.status_code != 200:
                return image_url # 실패 시 원본 유지
            
            image_data = BytesIO(response.content)
            storage_path = f"posters/{filename}"
            
            # 업로드
            self.supabase.storage.from_("posters").upload(
                path=storage_path,
                file=image_data.getvalue(),
                file_options={"content-type": response.headers.get("content-type", "image/jpeg")}
            )
            
            # 공개 URL 반환
            public_url = self.supabase.storage.from_("posters").get_public_url(storage_path)
            return public_url
        except Exception as e:
            print(f"Image upload error: {e}")
            return image_url

    def get_crawler_configs(self):
        """활성화된 크롤링 설정을 가져옵니다. (현재는 whitelist 기반으로 통합 사용)"""
        # crawler_configs 테이블이 없으므로 빈 리스트 반환 (main.py에서 whitelist를 사용하도록 유도)
        return []

    def check_duplicate(self, source_url: str) -> bool:
        try:
            response = self.supabase.table("raw_posts").select("id").eq("source_url", source_url).execute()
            return len(response.data) > 0
        except Exception:
            return False

    def save_crawl_log(self, log: dict):
        """Save a crawl log entry.
        Expected keys: target_name, started_at (ISO), finished_at (ISO), result_summary, error_msg (optional).
        """
        try:
            self.supabase.table("crawl_logs").insert([log]).execute()
        except Exception as e:
            print(f"Error saving crawl log: {e}")

    def get_crawl_logs(self, limit: int = 20):
        """Fetch recent crawl logs ordered by started_at desc."""
        try:
            res = self.supabase.table("crawl_logs").select("*").order("started_at", {"ascending": false}).limit(limit).execute()
            return res.data
        except Exception as e:
            print(f"Error fetching crawl logs: {e}")
            return []
