import { Header } from "@/components/ui/Header";
import { getEventById, getPublishedEvents } from "@/lib/supabase";
import { Calendar, MapPin, ExternalLink, ArrowLeft, Tag, Share2, Info, Ticket, Sparkles } from "lucide-react";
import { ShareButton } from "@/components/ui/ShareButton";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { EventCard } from "@/components/ui/EventCard";

interface EventPageProps {
    params: Promise<{
        id: string;
    }>;
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
    const { id } = await params;
    const event = await getEventById(id);

    if (!event) return { title: "행사를 찾을 수 없습니다" };

    return {
        title: `${event.title} | 픽아트 pica`,
        description: event.description?.slice(0, 160) || "경남의 문화예술 소식을 픽아트(pica)에서 확인하세요.",
        openGraph: {
            title: event.title,
            description: event.description?.slice(0, 160),
            images: [event.poster_image_url],
            type: "article",
        },
        twitter: {
            card: "summary_large_image",
            title: event.title,
            description: event.description?.slice(0, 160),
            images: [event.poster_image_url],
        }
    };
}

export default async function EventDetailPage({ params }: EventPageProps) {
    const { id } = await params;
    const event = await getEventById(id);

    if (!event) {
        return (
            <div className="min-h-screen flex flex-col pt-20 items-center justify-center text-neutral-500">
                <p>행사 정보를 불러올 수 없거나 존재하지 않는 행사입니다.</p>
                <Link href="/" className="mt-4 text-indigo-600 hover:underline">홈으로 돌아가기</Link>
            </div>
        );
    }

    // Related Events (Same category or region, excluding current)
    const allRelated = await getPublishedEvents({ category: event.category });
    const suggestions = allRelated
        .filter(e => e.id !== event.id)
        .slice(0, 3)
        .map(e => ({
            id: e.id,
            title: e.title,
            category: e.category,
            date: `${e.event_date_start}${e.event_date_end ? ` ~ ${e.event_date_end}` : ''}`,
            location: e.venue || e.region,
            imageUrl: e.poster_image_url,
            isFree: e.is_free,
        }));

    return (
        <main className="min-h-screen bg-neutral-50 pb-20">
            {/* layout.tsx에 이미 Header가 있으므로 여기서 제거합니다. */}


            <div className="container mx-auto px-4 pt-24 pb-8 max-w-6xl">
                {/* ... (Previous Breadcrumb & Back logic) */}
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-neutral-500 hover:text-indigo-600 transition-all mb-8 group"
                >
                    <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    </div>
                    <span className="font-medium text-sm">목록으로 돌아가기</span>
                </Link>

                <div className="flex flex-col lg:flex-row gap-10">
                    {/* ... (Poster Image Section) */}
                    <div className="w-full lg:w-[450px] shrink-0">
                        <div className="sticky top-24">
                            <div className="relative aspect-[3/4] w-full rounded-3xl overflow-hidden shadow-2xl ring-1 ring-black/5">
                                <Image
                                    src={event.poster_image_url || "/images/placeholder.webp"}
                                    alt={event.title}
                                    fill
                                    className="object-cover"
                                    priority
                                    sizes="(max-width: 768px) 100vw, 450px"
                                    unoptimized={event.poster_image_url?.startsWith('http')}
                                />
                                <div className="absolute top-6 left-6 flex flex-col gap-2">
                                    <span className="px-4 py-2 bg-indigo-600/90 backdrop-blur-md text-white text-xs font-bold rounded-full shadow-lg uppercase tracking-wider">
                                        {event.category}
                                    </span>
                                    {event.is_free && (
                                        <span className="px-4 py-2 bg-green-500/90 backdrop-blur-md text-white text-xs font-bold rounded-full shadow-lg uppercase tracking-wider">
                                            FREE
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="mt-8 flex gap-3">
                                <a
                                    href={event.original_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 inline-flex items-center justify-center gap-3 h-14 px-6 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-xl hover:shadow-indigo-200 active:scale-[0.98]"
                                >
                                    <ExternalLink className="w-5 h-5" />
                                    원본 소식 방문하기
                                </a>
                                <ShareButton title={event.title} />
                            </div>
                        </div>
                    </div>

                    {/* Right: Content Info Section */}
                    <div className="flex-1">
                        <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-sm ring-1 ring-neutral-200">
                            {/* Header Info */}
                            <div className="mb-10">
                                <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm mb-4 bg-indigo-50 w-fit px-3 py-1 rounded-full">
                                    <Tag className="w-3.5 h-3.5" />
                                    <span>{event.region}</span>
                                </div>
                                <h1 className="text-4xl md:text-5xl font-black text-neutral-900 leading-[1.15] mb-6">
                                    {event.title}
                                </h1>
                                <p className="text-neutral-500 text-lg leading-relaxed font-medium">
                                    {event.description?.slice(0, 150)}...
                                </p>
                            </div>

                            {/* Detail Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
                                <div className="flex items-center gap-5 p-6 rounded-2xl bg-neutral-50 transition-colors hover:bg-neutral-100/50">
                                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0">
                                        <Calendar className="w-6 h-6 text-indigo-600" />
                                    </div>
                                    <div>
                                        <div className="text-xs text-neutral-400 font-bold uppercase tracking-tight mb-0.5">일시</div>
                                        <div className="text-base font-extrabold text-neutral-800">
                                            {event.event_date_start} {event.event_date_end ? ` ~ ${event.event_date_end}` : ""}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-5 p-6 rounded-2xl bg-neutral-50 transition-colors hover:bg-neutral-100/50">
                                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0">
                                        <MapPin className="w-6 h-6 text-indigo-600" />
                                    </div>
                                    <div>
                                        <div className="text-xs text-neutral-400 font-bold uppercase tracking-tight mb-0.5">장소</div>
                                        <div className="text-base font-extrabold text-neutral-800">{event.venue || "정보 없음"}</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-5 p-6 rounded-2xl bg-neutral-50 transition-colors hover:bg-neutral-100/50">
                                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0">
                                        <Ticket className="w-6 h-6 text-indigo-600" />
                                    </div>
                                    <div>
                                        <div className="text-xs text-neutral-400 font-bold uppercase tracking-tight mb-0.5">비용</div>
                                        <div className="text-base font-extrabold text-neutral-800">{event.price_info || "정보 없음"}</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-5 p-6 rounded-2xl bg-neutral-50 transition-colors hover:bg-neutral-100/50">
                                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0">
                                        <Info className="w-6 h-6 text-indigo-600" />
                                    </div>
                                    <div>
                                        <div className="text-xs text-neutral-400 font-bold uppercase tracking-tight mb-0.5">제공/출처</div>
                                        <div className="text-base font-extrabold text-neutral-800 uppercase">{event.source}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Main Text Content */}
                            <div className="space-y-8">
                                <div className="h-px bg-neutral-100 w-full" />
                                <h3 className="text-2xl font-black text-neutral-900">상세 안내</h3>
                                <div className="text-neutral-600 leading-[1.8] text-lg lg:text-xl whitespace-pre-wrap font-medium">
                                    {event.description}
                                </div>
                            </div>

                            {/* Note / Disclaimer */}
                            <div className="mt-16 p-6 rounded-2xl bg-indigo-50 border border-indigo-100 flex gap-4">
                                <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                                <p className="text-sm text-indigo-900 leading-relaxed">
                                    본 정보는 수집된 데이터를 바탕으로 제공되며, 주최측의 사정에 따라 변동될 수 있습니다.
                                    정확한 정보는 반드시 <b>원본 소식 방문하기</b>를 통해 확인해 주세요. - <b>pica</b>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Suggestions Section */}
                {suggestions.length > 0 && (
                    <div className="mt-24">
                        <div className="flex items-center gap-4 mb-10">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                                <Sparkles className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-neutral-900">가볼 만한 다른 행사</h2>
                                <p className="text-neutral-500 font-medium tracking-tight">좋아하실 만한 비슷한 행사를 추천해 드려요.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            {suggestions.map((suggestion) => (
                                <EventCard key={suggestion.id} event={suggestion} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
