import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    const { prompt } = await request.json();
    if (typeof prompt !== 'string') {
        return NextResponse.json({ error: 'Invalid prompt' }, { status: 400 });
    }
    const envPath = path.resolve(process.cwd(), '.env.local');
    let envData = await fs.promises.readFile(envPath, 'utf-8');
    const newLine = `AI_PROMPT=${prompt}`;
    if (envData.includes('AI_PROMPT=')) {
        envData = envData.replace(/AI_PROMPT=.*/g, newLine);
    } else {
        envData = envData.trimEnd() + '\n' + newLine + '\n';
    }
    await fs.promises.writeFile(envPath, envData, 'utf-8');
    return NextResponse.json({ success: true });
}
