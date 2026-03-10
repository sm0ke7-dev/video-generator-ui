import { NextResponse } from 'next/server';
import { getBackgroundMusic } from '@/lib/sheet-data';

export async function GET() {
  try {
    const tracks = await getBackgroundMusic();
    return NextResponse.json(tracks);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
