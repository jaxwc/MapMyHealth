/**
 * API endpoint to serve content pack data
 * Loads JSON files from filesystem and serves to browser
 */

import * as fs from 'fs';
import * as path from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const contentDir = path.join(process.cwd(), 'src', 'content');

    const meta = JSON.parse(fs.readFileSync(path.join(contentDir, 'pack.meta.json'), 'utf8'));
    const findings = JSON.parse(fs.readFileSync(path.join(contentDir, 'findings.json'), 'utf8'));
    const conditions = JSON.parse(fs.readFileSync(path.join(contentDir, 'conditions.json'), 'utf8'));
    const actions = JSON.parse(fs.readFileSync(path.join(contentDir, 'actions.json'), 'utf8'));
    const testPerformance = JSON.parse(fs.readFileSync(path.join(contentDir, 'test_performance.json'), 'utf8'));

    const contentPack = {
      meta,
      findings,
      conditions,
      actions,
      testPerformance
    };

    return NextResponse.json(contentPack);
  } catch (error) {
    console.error('Error loading content pack:', error);
    return NextResponse.json(
      { error: 'Failed to load content pack' },
      { status: 500 }
    );
  }
}