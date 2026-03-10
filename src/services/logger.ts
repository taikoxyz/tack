import pino from 'pino';

const isTestRuntime = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

export const logger = pino({
  level: isTestRuntime ? 'silent' : 'info',
  timestamp: pino.stdTimeFunctions.isoTime
});
