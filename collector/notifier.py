import os
import asyncio
from telegram import Bot
from dotenv import load_dotenv

load_dotenv()

class TelegramNotifier:
    def __init__(self):
        self.token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.chat_id = os.getenv("TELEGRAM_CHAT_ID")
        self.enabled = all([self.token, self.chat_id])
        if self.enabled:
            self.bot = Bot(token=self.token)
        else:
            print("⚠️ Telegram Notifier not configured. Skipping.")

    async def send_message(self, text: str):
        if not self.enabled:
            return
        try:
            async with self.bot:
                await self.bot.send_message(chat_id=self.chat_id, text=text, parse_mode='HTML')
        except Exception as e:
            print(f"Failed to send telegram message: {e}")

    async def send_daily_report(self, stats: dict):
        report = (
            f"📊 <b>경남 아트 네비게이터 일일 리포트</b>\n\n"
            f"✅ 신규 수집: {stats.get('collected', 0)}건\n"
            f"📋 검토 대기: {stats.get('pending', 0)}건\n"
            f"✨ 오늘 발행: {stats.get('published', 0)}건\n\n"
            f"관리자 대시보드에서 확인하세요!"
        )
        await self.send_message(report)

    async def send_error(self, module: str, error: str):
        message = (
            f"🚨 <b>크롤러 에러 발생</b>\n"
            f"모듈: {module}\n"
            f"내용: {error}"
        )
        await self.send_message(message)
