const { google } = require('googleapis');
const readline = require('readline');
const os = require('os');
const path = require('path');
const { readFile, writeFile } = require('./fs');

const SCOPES = [
    'https://www.googleapis.com/auth/drive.file'
];

const TOKEN_PATH = path.join(os.homedir(), '.gdrive-single-file-sync.auth');

module.exports = { authorize };

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
