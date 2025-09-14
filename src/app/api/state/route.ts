import { NextResponse } from 'next/server';
import { useHealthStore } from '@/app/state/healthStore';

export async function GET() {
  try {
    const snapshot = useHealthStore.getState();
    return NextResponse.json(snapshot, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 });
  }
}


