import { NextResponse } from 'next/server';
import { getFullKeywordData } from '@/lib/sheet-data';

export async function GET() {
  try {
    const keywords = await getFullKeywordData();
    return NextResponse.json(keywords);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
