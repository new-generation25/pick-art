import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { blockOnDeploy } from '@/lib/localOnly';

const execAsync = promisify(exec);

export async function POST() {
    const blocked = blockOnDeploy();
    if (blocked) return blocked;
    try {
        // Define path to collector directory
        const projectRoot = path.resolve(process.cwd(), '..', 'collector');
        const scriptPath = path.join(projectRoot, 'kopis_scraper.py');

        console.log(`[API] Triggering KOPIS Scraper...`);
        console.log(`[API] Script: ${scriptPath}`);

        // 윈도우와 리눅스 모두 호환되도록 python 명령어 사용
        const command = `python kopis_scraper.py`;

        console.log(`[API] Executing: ${command} in ${projectRoot}`);

        exec(command, {
            cwd: projectRoot,
            env: { ...process.env, PYTHONUNBUFFERED: "1" }
        }, (error, stdout, stderr) => {
            if (error) {
                console.error(`[KOPIS Scraper Exec Error]: ${error.message}`);
                return;
            }
            console.log(`[KOPIS Scraper Finished]`);
        });

        return NextResponse.json({
            success: true,
            message: 'KOPIS 수집이 시작되었습니다. (로그를 확인해주세요)'
        });

    } catch (error: any) {
        console.error('Failed to trigger KOPIS scraper:', error);
        return NextResponse.json({
            success: false,
            message: `Failed to start KOPIS scraper: ${error.message}`
        }, { status: 500 });
    }
}
