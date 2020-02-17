const fs = require('fs');
const { promisify } = require('util');

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const lstat = promisify(fs.lstat);
const utimes = promisify(fs.utimes);
const copyFile = promisify(fs.copyFile);
const unlink = promisify(fs.unlink);

module.exports = {
    writeFile,
    readFile,
    copyFile,
    lstat,
    utimes,
    createReadStream: fs.createReadStream,
    createWriteStream: fs.createWriteStream
};
