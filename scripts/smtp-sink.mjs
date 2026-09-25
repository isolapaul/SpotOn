// Dev/test tool only (never imported by the app): a local SMTP server that accepts any login and
// appends every raw message to a file, followed by a separator line. Used by feedback-smoke.sh.
//   SMTP_SINK_PORT (default 2525), SMTP_SINK_FILE (default /tmp/spoton-smtp-sink.eml)
import { appendFileSync } from 'node:fs';
import { SMTPServer } from 'smtp-server';

const port = Number(process.env.SMTP_SINK_PORT || 2525);
const file = process.env.SMTP_SINK_FILE || '/tmp/spoton-smtp-sink.eml';

const server = new SMTPServer({
  authOptional: true,
  allowInsecureAuth: true,
  disabledCommands: ['STARTTLS'],
  onAuth: (auth, session, cb) => cb(null, { user: 'test' }),
  onData(stream, session, cb) {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', cb);
    stream.on('end', () => {
      appendFileSync(file, Buffer.concat(chunks).toString('utf8') + '\n----- END -----\n');
      cb();
    });
  },
});

server.on('error', (err) => console.error('smtp-sink:', err.message));
server.listen(port, '127.0.0.1', () => console.log(`smtp-sink listening on 127.0.0.1:${port} → ${file}`));

const stop = () => server.close(() => process.exit(0));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
