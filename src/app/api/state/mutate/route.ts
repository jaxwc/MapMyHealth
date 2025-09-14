import { NextResponse } from 'next/server';
import { useHealthStore } from '@/app/state/healthStore';

type Op = 'addFinding' | 'removeFinding' | 'applyActionOutcome' | 'setPatientData' | 'resetAll';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const op: Op = body?.op;
    const payload = body?.payload ?? {};

    const store = useHealthStore.getState();

    if (op === 'addFinding') {
      await store.addFinding(payload);
    } else if (op === 'removeFinding') {
      await store.removeFinding(payload?.id);
    } else if (op === 'applyActionOutcome') {
      await store.applyActionOutcome(payload?.actionId, payload?.outcomeId);
    } else if (op === 'setPatientData') {
      await store.setPatientData(payload);
    } else if (op === 'resetAll') {
      await (useHealthStore.getState() as any).resetAll();
    } else {
      return NextResponse.json({ error: `Unknown op: ${op}` }, { status: 400 });
    }

    // Return full snapshot for replacement on client
    const snapshot = useHealthStore.getState();
    return NextResponse.json(snapshot, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 });
  }
}


