import streamlit as st
import pandas as pd
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# Supabase Initialization
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

@st.cache_resource
def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        st.warning("Supabase URL or Key is missing. Check .env file.")
        return None
    return create_client(SUPABASE_URL, SUPABASE_KEY)

supabase = get_supabase()

st.set_page_config(
    page_title="ArtNavi Admin",
    page_icon="🎨",
    layout="wide"
)

st.title("🎨 경남 아트 네비게이터 관리 시스템")

st.sidebar.header("Navigation")
menu = st.sidebar.radio(
    "메뉴 이동",
    ["📊 대시보드", "📥 인박스 (수집 목록)", "✅ 발행 관리", "🚫 블랙리스트", "⚙️ 설정"]
)

if menu == "📊 대시보드":
    st.header("운영 현황")
    col1, col2, col3, col4 = st.columns(4)
    
    # Placeholder metrics (Will be updated with actual DB queries)
    col1.metric("오늘 수집", "0 건")
    col2.metric("검토 대기", "0 건")
    col3.metric("DM 발송", "0 건")
    col4.metric("최종 발행", "0 건")
    
    st.divider()
    st.subheader("최근 수집 트렌드")
    st.info("데이터가 충분히 쌓이면 그래프가 표시됩니다.")

elif menu == "📥 인박스 (수집 목록)":
    st.header("데이터 검수 (Inbox)")
    
    col_filters = st.columns([2, 1])
    with col_filters[0]:
        status_filter = st.selectbox("상태 필터", ["COLLECTED", "WAITING_DM", "PROCESSED", "FAILED"])
    
    if supabase:
        try:
            # Fetch data
            response = supabase.table("raw_posts").select("*").eq("status", status_filter).order("collected_at", desc=True).limit(20).execute()
            data = response.data
            
            if not data:
                st.write("표시할 수집 데이터가 없습니다.")
            else:
                for item in data:
                    with st.expander(f"[{item['source'].upper()}] {item.get('content', {}).get('title', item['source_id'])}", expanded=(status_filter=="COLLECTED")):
                        c1, c2 = st.columns([1, 2])
                        with c1:
                            img_url = item.get("image_urls", [None])[0]
                            if img_url:
                                st.image(img_url, use_container_width=True)
                            st.json(item['content'])
                        
                        with c2:
                            st.subheader("발행 정보 편집")
                            # Auto-populate fields from content or AI suggestion
                            raw_content = item.get('content', {})
                            ai_suggest = raw_content.get('ai_suggestion') or {}
                            
                            default_title = ai_suggest.get('title') or raw_content.get('title', '')
                            default_desc = ai_suggest.get('description') or raw_content.get('description', '')
                            default_cat = ai_suggest.get('category') or "공연"
                            default_reg = ai_suggest.get('region') or "기타"
                            default_venue = ai_suggest.get('venue', '')
                            default_is_free = ai_suggest.get('is_free', False)
                            
                            st.write("---")
                            st.subheader("💡 협업 및 DM 관리")
                            
                            author = item['content'].get('author', '작성자')
                            dm_template = f"안녕하세요 @{author}님! 경남 아트 네비게이터입니다. 올려주신 {edit_title} 관련 게시물이 너무 좋아서 저희 앱 사용자분들께 소개해드리고 싶습니다. 혹시 출처를 밝히고 공유해도 괜찮을까요? 확인 부탁드립니다! (이미지 사용 허락 요청)"
                            
                            st.text_area("DM 요청 문구 (복사 가능)", value=dm_template, height=100)
                            
                            dm_col1, dm_col2 = st.columns(2)
                            if dm_col1.button("📩 DM 대기함으로 이동", key=f"btn_dm_{item['id']}"):
                                supabase.table("raw_posts").update({"status": "WAITING_DM"}).eq("id", item['id']).execute()
                                st.info("DM 대기 상태로 변경되었습니다.")
                                st.rerun()

                            st.write("---")
                            st.subheader("🚀 최종 발행 (Publish)")
                            with st.form(key=f"publish_form_{item['id']}"):
                                edit_title = st.text_input("제목", value=default_title)
                                # ... existing title and desc fields ...
                                edit_desc = st.text_area("설명", value=default_desc, height=150)
                                
                                # (Self-Correction: Re-inserting all fields for the form replacement to be correct)
                                f_col1, f_col2 = st.columns(2)
                                categories = ["공연", "전시", "축제", "행사", "강연", "체험"]
                                edit_category = f_col1.selectbox("카테고리", categories, index=categories.index(default_cat) if default_cat in categories else 0)
                                regions = ["창원", "김해", "진주", "통영", "거제", "양산", "밀양", "기타"]
                                edit_region = f_col2.selectbox("지역", regions, index=regions.index(default_reg) if default_reg in regions else regions.index("기타"))
                                
                                f_col3, f_col4 = st.columns(2)
                                edit_venue = f_col3.text_input("장소", value=default_venue)
                                edit_price = f_col4.text_input("비용 정보", value="무료" if default_is_free else "")
                                
                                edit_is_free = st.checkbox("무료 여부", value=default_is_free)
                                
                                d_col1, d_col2 = st.columns(2)
                                edit_start = d_col1.text_input("시작일 (YYYY-MM-DD)", value=ai_suggest.get('event_date_start', ''))
                                edit_end = d_col2.text_input("종료일 (YYYY-MM-DD)", value=ai_suggest.get('event_date_end', ''))

                                publish_submit = st.form_submit_button("✅ 최종 승인 및 발행")
                                
                                if publish_submit:
                                    try:
                                        event_data = {
                                            "raw_post_id": item['id'],
                                            "title": edit_title,
                                            "description": edit_desc,
                                            "category": edit_category,
                                            "region": edit_region,
                                            "venue": edit_venue,
                                            "price_info": edit_price,
                                            "is_free": edit_is_free,
                                            "event_date_start": edit_start if edit_start else None,
                                            "event_date_end": edit_end if edit_end else None,
                                            "poster_image_url": img_url,
                                            "poster_thumbnail_url": item.get('poster_thumbnail_url'),
                                            "source": item['source'],
                                            "original_url": item['source_url'],
                                            "status": "PUBLISHED",
                                            "published_at": "now()"
                                        }
                                        supabase.table("events").insert(event_data).execute()
                                        supabase.table("raw_posts").update({"status": "PROCESSED"}).eq("id", item['id']).execute()
                                        st.success(f"발행 성공: {edit_title}")
                                        st.rerun()
                                    except Exception as e:
                                        st.error(f"오류: {e}")
                                        
                            if st.button("🗑️ 거절(Reject)", key=f"btn_rej_{item['id']}"):
                                supabase.table("raw_posts").update({"status": "FAILED", "error_message": "Admin rejected"}).eq("id", item['id']).execute()
                                st.warning("거절 처리되었습니다.")
                                st.rerun()
        except Exception as e:
            st.error(f"데이터 로드 오류: {e}")

elif menu == "✅ 발행 관리":
    st.header("발행 및 편집")
    st.info("APPROVED 상태의 데이터를 편집하고 최종 PUBLISHED로 변경합니다.")

elif menu == "🚫 블랙리스트":
    st.header("블랙리스트 관리")
    st.write("광고 계정이나 부적절한 키워드를 관리합니다.")

elif menu == "⚙️ 설정":
    st.header("시스템 설정")
    st.text_input("Instagram Session Cookie")
    st.button("설정 저장")
