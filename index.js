const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const { promisify } = require('util');

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const lstat = promisify(fs.lstat);

async function main () {
    const settingsContents = await readFile('settings.json', 'utf-8');
    const settings = JSON.parse(settingsContents);
    const auth = await authorize(settings.google);

    const gdriveFile = new GoogleDriveSynchronizedFile({
        auth,
        localFilePath: settings.localFilePath,
        remoteFilePath: settings.remoteFilePath
    });

    await gdriveFile.sync();
}

main();

// If modifying these scopes, delete token.json.
const SCOPES = [
    'https://www.googleapis.com/auth/drive.file'
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = '.token';

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 */
async function authorize (credentials) {
    // eslint-disable-next-line camelcase
    const { client_secret, client_id, redirect_uris } = credentials;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    try {
        const token = await readFile(TOKEN_PATH, 'utf-8');
        oAuth2Client.setCredentials(JSON.parse(token));
        return oAuth2Client;
    } catch (err) {
        return getAccessToken(oAuth2Client);
    }
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
async function getAccessToken (oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    // TODO xdg-open / start
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve, reject) => {
        rl.question('Enter the code from that page here: ', (code) => {
            rl.close();
            oAuth2Client.getToken(code, (err, token) => {
                if (err) {
                    reject(err);
                    return console.error('Error retrieving access token', err);
                }

                oAuth2Client.setCredentials(token);
                // Store the token to disk for later program executions
                writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                    if (err) return console.error(err);
                    console.log('Token stored to', TOKEN_PATH);
                });

                resolve(oAuth2Client);
            });
        });
    });
}

class GoogleDriveSynchronizedFile {
    constructor ({
        auth,
        localFilePath,
        remoteFilePath,
        log
    }) {
        this._drive = google.drive({
            version: 'v3',
            auth
        });

        this._localFilepath = localFilePath;
        this._remoteFilePath = remoteFilePath;
        this._status = null;
        this._log = log || console.log;
    }

    async sync () {
        const local = await this._findLocalFile();
        const remote = await this._findRemoteFile();
        if (local && !remote) {
            this._status = 'FileDoesNotExist';
            this._log('File does not exist yet. Attempt to upload it.');
            await this._createFile();
        } else if (!local && remote) {
            this._log('pull TODO');
            // pull file
        } else {
            this._log('sync TODO');
            // check mod date
            // send new version or pull
        }
    }

    async _findLocalFile () {
        const filestat = lstat(this._localFilepath);
        return filestat;
    }

    async _findRemoteFile () {
        const filename = path.basename(this._remoteFilePath);
        const result = await this._drive.files.list({
            q: `name='${filename}'`,
            fields: 'nextPageToken, files(id, name)'
        });

        return result.data && result.data.files.length && result.data.files.length
            ? result.data.files[0]
            : null;
    }

    async _createRemoteFile () {
        const filename = path.basename(this._remoteFilePath);
        const subdirIds = await this._createRemoteSubdirs();

        await this._drive.files.create({
            media: {
                body: fs.createReadStream(this._localFilepath)
            },
            requestBody: {
                name: filename,
                parents: subdirIds.length ? subdirIds[subdirIds.length - 1] : undefined

            }
        });
    }

    async _createRemoteSubdirs () {
        const resultingDirIds = [];
        const dir = path.dirname(this._remoteFilePath);
        const subdirs = dir.split('/');
        for (let i = 0; i < subdirs.length; i++) {
            const subdir = subdirs[i];
            const parents = i === 0 ? [] : subdirs.slice(0, i - 1);
            const parentsStr = parents.length === 0
                ? ''
                : parents.reduce((result, next, parenIndex) => {
                    if (parenIndex === parents.length - 1) {
                        return `${result}'${next}' in parents`;
                    } else {
                        return `${result}'${next}' in parents and `;
                    }
                }, 'and ');
            const dirListResult = await this._drive.files.list({
                q: `name='${subdir}' and mimeType = 'application/vnd.google-apps.folder'${parentsStr}`,
                fields: 'nextPageToken, files(id, name)'
            });

            let dirId = (dirListResult.data &&
                dirListResult.data.files &&
                dirListResult.data.files[0]) || null;
            if (!dirId) {
                this._log(`Create partial directory ${subdir}`);
                const createResult = await this._drive.files.create({
                    requestBody: {
                        name: subdir,
                        mimeType: 'application/vnd.google-apps.folder'
                    }
                });

                dirId = createResult.data.id;
            }

            resultingDirIds.push(dirId);
        }

        return resultingDirIds;
    }

    async pushVersion ({ localFilepath }) {
        this._drive.files.update({
        });
    }

    // async pull () {
    //     this._drive.files.get({
    //     })
    // }
}
