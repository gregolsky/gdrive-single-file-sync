const { loadSettings } = require('./settings');
const { authorize } = require('./auth');
const { GoogleDriveSynchronizedFile } = require('./gdrive');

async function main () {
    const settings = await loadSettings();
    const auth = await authorize(settings.google);

    const gdriveFile = new GoogleDriveSynchronizedFile({
        auth,
        localFilePath: settings.localFilePath,
        remoteFilePath: settings.remoteFilePath
    });

    await gdriveFile.sync();
}

module.exports = { main };
