import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// 기본값: frontend/ 옆의 collector/. 다른 위치면 COLLECTOR_PATH로 지정한다
const collectorPath = process.env.COLLECTOR_PATH || path.resolve(process.cwd(), '..', 'collector');
const pidFile = path.join(collectorPath, '.running.pid');

// collector/main.py가 시작할 때 남긴 PID가 살아 있는 파이썬 프로세스인지 본다.
// (예전에는 'tasklist | findstr python'이라 다른 파이썬만 떠 있어도 ON으로 보였다)
async function checkCollector(): Promise<{ running: boolean; message: string; pid?: number }> {
    if (!fs.existsSync(pidFile)) {
        return { running: false, message: 'Collector is not running (no PID file)' };
    }
    const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
    if (!Number.isInteger(pid)) {
        return { running: false, message: 'Collector is not running (invalid PID file)' };
    }
    try {
        const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
        if (stdout.toLowerCase().includes('python')) {
            return { running: true, message: 'Collector is running', pid };
        }
    } catch {
        // tasklist 실패는 '확인 못 함'이지만 ON으로 보이지 않게 한다
    }
    return { running: false, message: `Collector is not running (stale PID ${pid})` };
}

export async function GET() {
    return NextResponse.json(await checkCollector());
}

export async function POST() {
    if (!fs.existsSync(path.join(collectorPath, 'main.py'))) {
        return NextResponse.json({
            success: false,
            message: `Collector not found at ${collectorPath}. Set COLLECTOR_PATH.`
        }, { status: 400 });
    }

    const current = await checkCollector();
    if (current.running) {
        return NextResponse.json({ success: true, message: `Collector already running (PID ${current.pid})` });
    }

    try {
        // 백그라운드에서 Collector 실행
        exec(
            `cd /d "${collectorPath}" && start /B python -u main.py > collector_auto.log 2>&1`,
            (error) => {
                if (error) {
                    console.error('Failed to start collector:', error);
                }
            }
        );

        // 시작 결과를 PID 파일로 확인한다 (최대 10초)
        for (let i = 0; i < 20; i++) {
            await new Promise(resolve => setTimeout(resolve, 500));
            const status = await checkCollector();
            if (status.running) {
                return NextResponse.json({ success: true, message: `Collector started (PID ${status.pid})` });
            }
        }
        return NextResponse.json({
            success: false,
            message: `Collector did not report running within 10s. See ${path.join(collectorPath, 'collector_auto.log')}`
        }, { status: 500 });
    } catch (error) {
        return NextResponse.json({
            success: false,
            message: `Failed to start collector: ${error}`
        }, { status: 500 });
    }
}
