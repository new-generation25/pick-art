import os
import io
import asyncio
import aiohttp
from PIL import Image
from io import BytesIO
from datetime import datetime
from supabase import Client

async def process_and_upload_image(supabase: Client, img_url: str, storage_path: str) -> tuple:
    """
    이미지를 다운로드하여 원본과 썸네일(600px) WebP로 변환 후 업로드합니다.
    """
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(img_url, timeout=10) as resp:
                if resp.status != 200:
                    print(f"Failed to download image: {img_url} (status: {resp.status})")
                    return None, None, None
                img_data = await resp.read()
        except Exception as e:
            print(f"Error downloading image {img_url}: {e}")
            return None, None, None

    try:
        # 1. 이미지 처리 (Pillow)
        img = Image.open(io.BytesIO(img_data))
        
        # 파일명 생성
        filename = os.path.basename(storage_path)
        name_only, _ = os.path.splitext(filename)
        timestamp = int(datetime.now().timestamp())
        
        orig_path = f"posters/{name_only}_orig.webp"
        
        # 원본 (WebP 변환)
        orig_io = io.BytesIO()
        img.save(orig_io, format="WEBP", quality=85)
        orig_data = orig_io.getvalue()

        # Supabase Upload (upsert=True)
        # 원본 업로드
        supabase.storage.from_("posters").upload(
            path=orig_path,
            file=orig_data,
            file_options={"content-type": "image/webp", "upsert": "true"}
        )

        # Public URL 가져오기
        # 주의: 로컬 Supabase는 기본적으로 http://127.0.0.1:54321/... 를 반환함.
        # Docker 내부 통신 등 이슈로 인해 Next.js에서 127.0.0.1 접속 시 에러가 날 수 있으므로
        # localhost 로 치환하여 반환한다.
        orig_url = supabase.storage.from_("posters").get_public_url(orig_path)
        
        # 중요: 127.0.0.1 -> localhost 치환
        if "127.0.0.1" in orig_url:
            orig_url = orig_url.replace("127.0.0.1", "localhost")

        # 썸네일은 일단 원본 URL을 같이 쓰거나 필요 시 추가 구현 (여기선 원본만 리턴)
        return orig_url, orig_url, "hash_placeholder"

    except Exception as e:
        print(f"Error processing image {img_url}: {e}")
        return None, None, None
