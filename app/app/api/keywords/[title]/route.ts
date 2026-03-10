import { NextResponse } from 'next/server';
import { getFullKeywordData } from '@/lib/sheet-data';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ title: string }> }
) {
  try {
    const { title } = await params;
    const decoded = decodeURIComponent(title);
    const keywords = await getFullKeywordData();
    const entry = keywords.find((k) => k.title === decoded);
    if (!entry) {
      return NextResponse.json({ error: 'Keyword not found' }, { status: 404 });
    }
    return NextResponse.json(entry);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
