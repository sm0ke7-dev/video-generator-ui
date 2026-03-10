import { NextResponse } from 'next/server';
import { getAllJobs, getActiveJobs } from '@/lib/job-store';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get('active') === 'true';
  const jobs = activeOnly ? getActiveJobs() : getAllJobs();
  return NextResponse.json({ jobs });
}
