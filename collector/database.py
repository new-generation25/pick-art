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
            res = self.supabase.table("whitelist").select("type, value, name, auto_publish").execute()
            return res.data
        except:
            return []

    def save_raw_post(self, data: dict):
        """포스트를 저장하며 블랙리스트/화이트리스트 로직을 실행합니다."""
        source = data.get('source')
        source_id = data.get('source_id')
        source_url = data.get('source_url')
        title = data.get('content', {}).get('title', 'N/A')

        print(f"        💾 [DB] save_raw_post called for: {title[:30]}...", flush=True)
        print(f"        💾 [DB] Source: {source}, URL: {source_url}", flush=True)

        # 1. 블랙리스트 체크
        blacklist = self.get_blacklist()
        for item in blacklist:
            if item['value'] in [source_id, source_url]:
                print(f"        🚫 [DB:Blacklist] Blocked: {item['value']}", flush=True)
                return None

        # 2. 화이트리스트 체크 (자동 승인)
        whitelist = self.get_whitelist()
        is_whitelisted = False
        auto_pub = False
        for item in whitelist:
            wl_value = item['value']
            # 다양한 매칭 전략 사용
            is_match = False

            # 전략 1: 정확한 매칭 (source_id 또는 source_url 정확히 일치)
            if wl_value in [source_id, source_url]:
                is_match = True
                print(f"        🎯 [DB:Whitelist] Exact match: {wl_value}", flush=True)

            # 전략 2: URL 도메인 기반 매칭 (같은 도메인이면 허용)
            elif source_url and wl_value:
                # URL에서 도메인 추출 (https://wgcc.ghct.or.kr/... → wgcc.ghct.or.kr)
                from urllib.parse import urlparse
                try:
                    wl_domain = urlparse(wl_value).netloc if 'http' in wl_value else wl_value
                    source_domain = urlparse(source_url).netloc if 'http' in source_url else source_url

                    # 도메인이 일치하거나 포함되면 매칭
                    if wl_domain and source_domain and (wl_domain == source_domain or wl_domain in source_domain or source_domain in wl_domain):
                        is_match = True
                        print(f"        🌐 [DB:Whitelist] Domain match: {wl_domain} in {source_domain}", flush=True)
                    # URL 경로 부분 매칭 (예: show01_01 포함 확인)
                    elif wl_value and any(part in source_url for part in wl_value.split('/') if part and part not in ['http:', 'https:', '']):
                        is_match = True
                        print(f"        🔗 [DB:Whitelist] Path component match: {wl_value}", flush=True)
                except:
                    pass

            if is_match:
                is_whitelisted = True
                auto_pub = item.get('auto_publish', False)
                print(f"        ✅ [DB:Whitelist] Matched: {item['value']}, auto_publish={auto_pub}", flush=True)
                break

        # 3. 기본 저장 (raw_posts)
        # 자동 발행이 꺼져 있으므로 항상 COLLECTED. PUBLISHED로 저장하면 인박스에도 events에도 안 보인다
        status = "COLLECTED"
        data['status'] = status
        print(f"        📋 [DB] Status determined: {status}", flush=True)

        try:
            # 중복 체크 (URL 기반)
            if self.check_duplicate(source_url):
                print(f"        ⏭️ [DB:Duplicate] Already exists: {source_url}", flush=True)
                return None

            print(f"        💾 [DB] Upserting to raw_posts table...", flush=True)
            response = self.supabase.table("raw_posts").upsert(data, on_conflict="source, source_id").execute()

            if not response.data:
                print(f"        ❌ [DB:Error] Upsert returned no data", flush=True)
                return None
            saved_id = response.data[0].get('id')

            # 저장됐다는 응답만 믿지 않고 다시 읽어서 확인한다
            check = self.supabase.table("raw_posts").select("id").eq("id", saved_id).execute()
            if not check.data:
                print(f"        ❌ [DB:Error] Saved row not found on re-read: ID={saved_id}", flush=True)
                return None
            print(f"        ✅ [DB] Saved and verified in raw_posts: ID={saved_id}, Status={status}", flush=True)

            # 4. 자동 승인 로직 비활성화 - 모든 데이터는 인박스(검토 대기)로 먼저 이동
            # 이전: 화이트리스트 + auto_publish=true 시 바로 events 테이블에 삽입
            # 변경: 모든 데이터는 raw_posts에 COLLECTED 상태로 저장 → 관리자 승인 후 events로 이동
            if is_whitelisted and auto_pub:
                print(f"        ℹ️ [DB:Auto-publish] Disabled - data will go to inbox for review", flush=True)
                # 자동 발행 비활성화됨 - 아래 코드는 실행되지 않음
                # 관리자가 인박스에서 승인해야 events 테이블로 이동
                pass


            return response
        except Exception as e:
            print(f"        ❌ [DB:Error] save_raw_post failed: {str(e)}", flush=True)
            import traceback
            print(f"        🔍 [DB:Traceback] {traceback.format_exc()}", flush=True)
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
            res = self.supabase.table("crawl_logs").select("*").order("started_at", desc=True).limit(limit).execute()
            return res.data
        except Exception as e:
            print(f"Error fetching crawl logs: {e}")
            return []
