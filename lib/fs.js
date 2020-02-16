const fs = require('fs');
const { promisify } = require('util');

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const lstat = promisify(fs.lstat);
const utimes = promisify(fs.utimes);

module.exports = {
    writeFile,
    readFile,
    lstat,
    utimes,
    createReadStream: fs.createReadStream,
    createWriteStream: fs.createWriteStream
};
