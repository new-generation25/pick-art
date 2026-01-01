import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envData = await fs.promises.readFile(envPath, 'utf-8');
    const match = envData.match(/AI_PROMPT=(.*)/);
    const prompt = match ? match[1] : '';
    return NextResponse.json({ prompt });
}
