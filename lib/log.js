const dateFormatISO = require('date-fns/format');
const os = require('os');

function log (message, opts = null) {
    let { noNewLine, level } = opts || {};
    level = level || 'INFO';
    noNewLine = noNewLine === 'undefined' ? false : noNewLine;

    const logline = `${dateFormatISO(new Date())} [${level.toUpperCase()}]: ${message}${noNewLine ? '' : os.EOL}`;
    process.stdout.write(logline);
}

module.exports = { log };
