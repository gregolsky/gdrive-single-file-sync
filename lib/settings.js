const os = require('os');
const path = require('path');
const { readFile } = require('./fs');

const userHomeDir = os.homedir();
const settingsPath = path.join(userHomeDir, '.gdrive-single-file-sync.settings');

async function loadSettings () {
    const settingsContents = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(settingsContents);
    return settings;
}

module.exports = { loadSettings };
