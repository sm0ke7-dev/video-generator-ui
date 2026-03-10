import { NextResponse } from 'next/server';
import { checkHealth } from '@/lib/video-api';
import { getSheetNames, getSheetData } from '@/lib/sheets';

export async function GET() {
  try {
    // Test video API health
    const health = await checkHealth();

    // Test sheet connectivity — get tab names
    const sheetNames = await getSheetNames();

    // Sample a few tabs to confirm names + data
    const businessData = await getSheetData('Business Data', 'A1:B5');
    const contentGenerator = await getSheetData('Content Generator', 'A1:C5');
    const text = await getSheetData('Text', 'A1:E5');

    return NextResponse.json({
      videoApi: health,
      sheetTabs: sheetNames,
      samples: { businessData, contentGenerator, text },
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
