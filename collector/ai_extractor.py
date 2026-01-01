import os
import json
import requests
from io import BytesIO
from PIL import Image
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv(".env.local")

class AIExtractor:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("NEXT_PUBLIC_GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
            # Use gemini-2.5-flash for better performance
            self.model = genai.GenerativeModel('gemini-2.5-flash')
            self.enabled = True
        else:
            self.enabled = False
            print("⚠️ GEMINI_API_KEY not found. AI extraction disabled.")

    def _load_prompt_from_db(self):
        """Load AI prompt from Supabase configs table"""
        try:
            from supabase import create_client
            import os

            supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

            if not supabase_url or not supabase_key:
                return None

            supabase = create_client(supabase_url, supabase_key)
            response = supabase.from_("configs").select("value").eq("key", "ai_prompt").single().execute()

            if response.data:
                return response.data["value"]
            return None
        except Exception as e:
            print(f"Warning: Could not load prompt from database: {e}")
            return None

    async def extract_metadata(self, text: str, image_urls: list = None):
        if not self.enabled:
            return None

        content_parts = []

        # 프롬프트 구성 (우선순위: Database > .env > fallback)
        prompt_text = self._load_prompt_from_db()

        if not prompt_text:
            prompt_text = os.getenv("AI_PROMPT")

        if not prompt_text:
            # 기존 프롬프트 (fallback)
            prompt_text = """Role: You are an expert Cultural Event Information Extractor specialized in Korean cultural events.

Task: Analyze the provided text and image (poster) to extract structured event data with high accuracy.

CRITICAL RULES:
1. Extract information EXACTLY as written - do not invent or guess dates/times/prices
2. If information is missing, use null (NOT "정보 없음" or empty strings)
3. Dates MUST be in YYYY-MM-DD format or null
4. Title should be clean and descriptive (remove emoji, remove source prefixes like "[페이스북]")
5. Description should preserve original formatting and line breaks
6. Region inference priority: venue name > address > context clues

Extraction Guidelines:

**Title Extraction:**
- Remove source indicators: "[Facebook]" "[Instagram]" "@username"
- Remove excessive emoji (keep 1-2 if meaningful)
- Example: "🎨[경남문화재단] 봄맞이 전시회" → "봄맞이 전시회"

**Date/Time Extraction:**
- Look for: "YYYY.MM.DD", "MM월 DD일", "~까지", "부터"
- If range: extract both date_start and date_end
- If single day: date_start = date_end
- If no date found: null (DO NOT guess)

**Venue & Region:**
- venue: Specific place name ("경남도립미술관", "성산아트홀")
- region: City from [창원, 김해, 진주, 통영, 거제, 양산, 밀양, 함안, 기타]
- Inference: "창원 성산아트홀" → region: "창원", venue: "성산아트홀"

**Category Classification:**
Choose EXACTLY ONE from: [전시, 공연, 축제, 전통문화, 체험/교육, 기타]
- 전시: 미술, 사진, 조각 등 전시회
- 공연: 연극, 뮤지컬, 콘서트, 무용
- 축제: 지역 축제, 문화제
- 전통문화: 국악, 전통예술
- 체험/교육: 워크샵, 강연, 교육 프로그램

**Price Information:**
- is_free: true if "무료", "입장료 없음", "free"
- price_details: Exact text ("5,000원", "성인 10,000원 / 청소년 5,000원")

**Tags Generation:**
Create 5 relevant hashtags:
- 1 region tag: "#창원" "#김해"
- 1-2 category tags: "#전시" "#공연" "#축제"
- 2-3 theme/audience tags: "#가족" "#주말" "#무료" "#현대미술"

Required JSON Output:
{
    "title": "string",
    "description": "string",
    "category": "전시|공연|축제|전통문화|체험/교육|기타",
    "region": "창원|김해|진주|통영|거제|양산|밀양|함안|기타",
    "venue": "string or null",
    "date_start": "YYYY-MM-DD or null",
    "date_end": "YYYY-MM-DD or null",
    "is_free": boolean,
    "price_details": "string or null",
    "contact": "string or null",
    "organizer": "string or null",
    "tags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
}

Return ONLY valid JSON. No markdown, no explanations, no extra text."""

        content_parts.append(prompt_text)

        if text and len(text) > 5:
            content_parts.append(f"원문 텍스트:\n{text}")
        else:
            content_parts.append("원문 텍스트가 부족합니다. 이미지 분석에 의존하세요.")

        # 이미지 처리 (첫 번째 이미지만 사용)
        if image_urls and len(image_urls) > 0:
            try:
                img_url = image_urls[0]
                # 다운로드
                response = requests.get(img_url, timeout=10)
                if response.status_code == 200:
                    img_data = Image.open(BytesIO(response.content))
                    content_parts.append(img_data)
                    print(f"🖼️ Analyzing image for better metadata...")
            except Exception as e:
                print(f"Failed to load image for AI analysis: {e}")

        try:
            response = self.model.generate_content(content_parts)
            clean_json = response.text.replace('```json', '').replace('```', '').strip()
            return json.loads(clean_json)
        except Exception as e:
            print(f"AI Extraction failed: {e}")
            return None
