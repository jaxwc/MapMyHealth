/**
 * Node.js version of engine facade factory
 * Uses filesystem to load content pack directly
 */

import * as fs from 'fs';
import * as path from 'path';
import { ContentPack } from './types';
import { EngineFacadeImpl } from './facade';

/**
 * Load content pack from JSON files (Node.js only)
 */
async function loadContentPackNode(): Promise<ContentPack> {
  const contentDir = path.join(process.cwd(), 'src', 'content');

  const meta = JSON.parse(fs.readFileSync(path.join(contentDir, 'pack.meta.json'), 'utf8'));
  const findings = JSON.parse(fs.readFileSync(path.join(contentDir, 'findings.json'), 'utf8'));
  const conditions = JSON.parse(fs.readFileSync(path.join(contentDir, 'conditions.json'), 'utf8'));
  const actions = JSON.parse(fs.readFileSync(path.join(contentDir, 'actions.json'), 'utf8'));
  const testPerformance = JSON.parse(fs.readFileSync(path.join(contentDir, 'test_performance.json'), 'utf8'));

  return {
    meta,
    findings,
    conditions,
    actions,
    testPerformance
  };
}

/**
 * Factory function to create engine facade (Node.js environment)
 */
export async function createEngineFacadeNode() {
  const contentPack = await loadContentPackNode();
  return new EngineFacadeImpl(contentPack);
}