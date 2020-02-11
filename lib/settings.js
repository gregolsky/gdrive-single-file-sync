const { readFile } = require('./fs');

async function loadSettings () {
    const settingsContents = await readFile('settings.json', 'utf-8');
    const settings = JSON.parse(settingsContents);
    return settings;
}

module.exports = { loadSettings };
