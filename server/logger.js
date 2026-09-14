const isDev = process.env.NODE_ENV !== 'production';

function formatMessage(level, message, extra) {
  const ts = new Date().toISOString();
  const extraStr = extra
    ? ' ' + (typeof extra === 'object' ? JSON.stringify(extra) : extra)
    : '';
  return `[${ts}] [${level}] ${message}${extraStr}`;
}

const logger = {
  info:  (msg, extra) => console.log(formatMessage('INFO',  msg, extra)),
  warn:  (msg, extra) => console.warn(formatMessage('WARN',  msg, extra)),
  error: (msg, extra) => console.error(formatMessage('ERROR', msg, extra)),
  debug: (msg, extra) => { if (isDev) console.log(formatMessage('DEBUG', msg, extra)); },
};

export default logger;