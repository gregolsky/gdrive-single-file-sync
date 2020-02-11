const fs = require('fs');
const { promisify } = require('util');

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const lstat = promisify(fs.lstat);

module.exports = {
    writeFile,
    readFile,
    lstat,
    createReadStream: fs.createReadStream,
    createWriteStream: fs.createWriteStream
};
