/** @file server/utils/logger.js — minimal timestamped logger (swap for pino/winston later). */
 
const stamp = () => new Date().toISOString();
 
const logger = {
  info:  (...a) => console.log(`[${stamp()}] [INFO]`, ...a),
  warn:  (...a) => console.warn(`[${stamp()}] [WARN]`, ...a),
  error: (...a) => console.error(`[${stamp()}] [ERROR]`, ...a),
};
 
export default logger;
