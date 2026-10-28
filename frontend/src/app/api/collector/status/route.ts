import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
    try {
        // Windows에서 Python 프로세스 확인
        const { stdout } = await execAsync('tasklist | findstr python');

        // main.py가 실행 중인지 확인
        const isRunning = stdout.includes('python');

        return NextResponse.json({
            running: isRunning,
            message: isRunning ? 'Collector is running' : 'Collector is not running'
        });
    } catch (error) {
        // 프로세스가 없으면 findstr이 에러를 반환함
        return NextResponse.json({
            running: false,
            message: 'Collector is not running'
        });
    }
}

export async function POST() {
    try {
        // Collector 시작
        const collectorPath = process.env.COLLECTOR_PATH || 'E:\\developement\\pick-art\\collector';

        // 백그라운드에서 Collector 실행
        exec(
            `cd ${collectorPath} && start /B python -u main.py > collector_auto.log 2>&1`,
            (error) => {
                if (error) {
                    console.error('Failed to start collector:', error);
                }
            }
        );

        // 시작 시간을 주기 위해 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 2000));

        return NextResponse.json({
            success: true,
            message: 'Collector started successfully'
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            message: `Failed to start collector: ${error}`
        }, { status: 500 });
    }
}
