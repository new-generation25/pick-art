"use client";

import { useState, useEffect } from "react";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { Brain, Save, RotateCcw, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function AIPromptPage() {
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    const defaultPrompt = `Role: You are an expert Cultural Event Information Extractor specialized in Korean cultural events.

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

    useEffect(() => {
        fetchPrompt();
    }, []);

    const fetchPrompt = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("configs")
            .select("*")
            .eq("key", "ai_prompt")
            .single();

        if (data) {
            setPrompt(data.value);
        } else {
            setPrompt(defaultPrompt);
        }
        setLoading(false);
    };

    const savePrompt = async () => {
        setSaving(true);
        setMessage("");

        const { data, error } = await supabase
            .from("configs")
            .upsert([
                {
                    key: "ai_prompt",
                    value: prompt,
                    description: "Gemini AI prompt for extracting cultural event metadata"
                }
            ], { onConflict: "key" })
            .select();

        if (error) {
            setMessage(`❌ 저장 실패: ${error.message}`);
        } else {
            setMessage("✅ AI 프롬프트가 성공적으로 저장되었습니다!");
            setTimeout(() => setMessage(""), 3000);
        }
        setSaving(false);
    };

    const resetToDefault = () => {
        if (confirm("기본 프롬프트로 복원하시겠습니까?")) {
            setPrompt(defaultPrompt);
            setMessage("기본 프롬프트로 복원되었습니다. 저장 버튼을 눌러 적용하세요.");
        }
    };

    return (
        <main className="min-h-screen bg-neutral-50 pb-20">
            <AdminHeader />
            <div className="container mx-auto px-4 pt-28">
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h1 className="text-4xl font-black text-neutral-900 flex items-center gap-3">
                            <Brain className="w-10 h-10 text-purple-600" />
                            AI 프롬프트 설정
                        </h1>
                        <p className="text-neutral-500 mt-2 font-medium">
                            Gemini AI가 이벤트 정보를 추출할 때 사용하는 프롬프트를 편집할 수 있습니다.
                        </p>
                        <div className="flex gap-4 mt-2">
                            <Link href="/admin/inbox" className="text-sm font-bold text-purple-600 hover:underline">
                                인박스 바로가기
                            </Link>
                            <Link href="/admin/configs" className="text-sm font-bold text-purple-600 hover:underline">
                                크롤링 설정 바로가기
                            </Link>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={resetToDefault}
                            className="flex items-center gap-2 px-6 py-3 bg-neutral-200 text-neutral-700 rounded-2xl font-bold hover:bg-neutral-300 transition-all active:scale-95"
                        >
                            <RotateCcw className="w-5 h-5" />
                            기본값 복원
                        </button>
                        <button
                            onClick={savePrompt}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-2xl font-bold hover:bg-purple-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                        >
                            <Save className="w-5 h-5" />
                            {saving ? "저장 중..." : "변경사항 저장"}
                        </button>
                    </div>
                </div>

                {message && (
                    <div className={`mb-6 p-4 rounded-2xl font-bold ${message.includes("✅") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {message}
                    </div>
                )}

                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm ring-1 ring-neutral-200">
                    <div className="flex items-center gap-3 mb-6">
                        <FileText className="w-6 h-6 text-purple-600" />
                        <h2 className="text-2xl font-black text-neutral-900">프롬프트 내용</h2>
                        <span className="text-sm text-neutral-400 font-medium">
                            ({prompt.length.toLocaleString()} 글자)
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center h-96">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                        </div>
                    ) : (
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full h-[600px] p-6 font-mono text-sm bg-neutral-50 rounded-2xl border-2 border-neutral-200 focus:border-purple-400 focus:outline-none resize-none"
                            placeholder="AI 프롬프트를 입력하세요..."
                        />
                    )}

                    <div className="mt-6 p-4 bg-purple-50 rounded-2xl">
                        <p className="text-sm font-bold text-purple-900 mb-2">💡 프롬프트 작성 팁</p>
                        <ul className="text-sm text-purple-700 space-y-1 list-disc list-inside">
                            <li>명확하고 구체적인 지시사항을 작성하세요</li>
                            <li>예시를 포함하면 AI가 더 정확하게 이해합니다</li>
                            <li>출력 형식(JSON)을 명확히 지정하세요</li>
                            <li>한국어 이벤트 특성(날짜 형식, 지역명 등)을 고려하세요</li>
                        </ul>
                    </div>
                </div>
            </div>
        </main>
    );
}
