import 'dotenv/config';
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';

import { healthAgent } from './agents/health-agent';
import { healthAssessmentWorkflow } from './workflows/health';
import { bridgeReadTools } from './tools/bridge-read';
import { bridgeWriteTools } from './tools/bridge-write';
import { externalSearchTool } from './tools/external-search';

export const mastra = new Mastra({
  agents: { healthAgent },
  workflows: { healthAssessmentWorkflow },
  tools: {
    ...bridgeReadTools,
    ...bridgeWriteTools,
    externalSearch: externalSearchTool,
  },
  logger: new PinoLogger({ name: 'MapMyHealth', level: 'info' }),
});


