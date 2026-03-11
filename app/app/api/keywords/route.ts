import { NextResponse } from 'next/server';
import { getFullKeywordData } from '@/lib/sheet-data';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sheetId = searchParams.get('sheetId') ?? undefined;
    const keywords = await getFullKeywordData(sheetId);
    return NextResponse.json(keywords);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
