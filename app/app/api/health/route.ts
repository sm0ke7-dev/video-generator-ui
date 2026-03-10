import { NextResponse } from 'next/server';
import { checkHealth } from '@/lib/video-api';

export async function GET() {
  try {
    const result = await checkHealth();
    return NextResponse.json({ healthy: result.apiWorking });
  } catch (error) {
    return NextResponse.json({ healthy: false, error: String(error) });
  }
}
