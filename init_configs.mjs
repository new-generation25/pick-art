import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseKey);

const improvedPrompt = `Role: You are an expert Cultural Event Information Extractor specialized in Korean cultural events.

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

Return ONLY valid JSON. No markdown, no explanations, no extra text.`;

async function initConfigs() {
    console.log('🔧 Creating configs table...');

    // Try to insert - table should already exist from migration
    const { data, error } = await supabase
        .from('configs')
        .upsert([
            {
                key: 'ai_prompt',
                value: improvedPrompt,
                description: 'Gemini AI prompt for extracting cultural event metadata'
            }
        ], { onConflict: 'key' })
        .select();

    if (error) {
        console.error('❌ Error:', error.message);
        console.log('\n📝 You may need to run this SQL manually in Supabase Studio:');
        console.log(fs.readFileSync('create_configs_table.sql', 'utf8'));
    } else {
        console.log('✅ Configs table initialized!');
        console.log('✅ AI Prompt saved to database');
        console.log(`   Length: ${improvedPrompt.length} characters`);
    }
}

initConfigs();
