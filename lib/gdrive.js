const { google } = require('googleapis');
const md5 = require('md5');
const path = require('path');

const { lstat, readFile, createReadStream, createWriteStream } = require('./fs');

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
            if (remote.md5Checksum === local.md5Checksum) {
                this._log('Files are the same.');
                return;
            }

            if (local.modifiedTime > remote.modifiedTime) {
                this._log('Local is newer. Push.');
                await this._drive.files.update({
                    fileId: remote.id,
                    media: {
                        body: createReadStream(this._localFilepath)
                    }
                });
            } else {
                this._log('Remote is newer. Pull.');

                const downloaded = await this._drive.files.get({
                    fileId: remote.id,
                    alt: 'media'
                });
                console.log(downloaded);

                downloaded.data.on('error', (err) => {
                    this._log('Error downloading from GDrive: ' + err);
                }).pipe(createWriteStream(this._localFilepath));
            }
        }
    }

    async _findLocalFile () {
        const filestat = await lstat(this._localFilepath);
        if (!filestat) {
            return null;
        }
        const buf = await readFile(this._localFilepath);
        const md5Checksum = md5(buf);

        return {
            name: this._localFilepath,
            md5Checksum,
            modifiedTime: filestat.mtime
        };
    }

    async _findRemoteFile () {
        const filename = path.basename(this._remoteFilePath);
        const result = await this._drive.files.list({
            q: `name='${filename}'`,
            fields: 'nextPageToken, files(id, name, modifiedTime, md5Checksum)'
        });

        if (result.data && result.data.files.length && result.data.files.length) {
            const f = result.data.files[0];
            return Object.assign({}, f, {
                modifiedTime: new Date(f.modifiedTime)
            });
        }

        return null;
    }

    async _createRemoteFile () {
        const filename = path.basename(this._remoteFilePath);
        const subdirIds = await this._createRemoteSubdirs();

        await this._drive.files.create({
            media: {
                body: createReadStream(this._localFilepath)
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

module.exports = { GoogleDriveSynchronizedFile };
