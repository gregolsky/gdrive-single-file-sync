const { google } = require('googleapis');
const md5 = require('md5');
const path = require('path');
const stream = require('stream');
const util = require('util');
const tmp = require('tmp');

const { log } = require('./log');

const pipeline = util.promisify(stream.pipeline);

const { lstat, readFile, utimes, createReadStream, createWriteStream } = require('./fs');

class GoogleDriveSynchronizedFile {
    constructor ({
        auth,
        localFilePath,
        remoteFilePath
    }) {
        this._drive = google.drive({
            version: 'v3',
            auth
        });

        this._localFilePath = localFilePath;
        this._remoteFilePath = remoteFilePath;
        this._status = null;
    }

    async sync () {
        const local = await this._findLocalFile();
        const remote = await this._findRemoteFile();
        console.table({ Local: local, Remote: remote });

        if (local && !remote) {
            this._status = 'FileDoesNotExist';
            log(`Remote file does not exist yet. Attempt to upload it to ${this._remoteFilePath}.`);
            await this._createRemoteFile();
        } else if (!local && remote) {
            log(`Local file does not exist yet. Attempt to download it to ${this._localFilePath}.`);
            this._downloadFile(remote);
        } else {
            if (remote.md5Checksum === local.md5Checksum) {
                log('Files are the same. Exiting...');
                return;
            }

            if (local.modifiedTime > remote.modifiedTime) {
                log('Local is newer - uploading...');
                await this._uploadNewVersion(remote);
            } else {
                log('Remote is newer. Pull.');
                await this._downloadFile(remote);
            }
        }

        log('Done.');
    }

    async _uploadNewVersion (remoteFile) {
        try {
            await this._drive.files.update({
                fileId: remoteFile.id,
                media: {
                    body: createReadStream(this._localFilePath),
                    mimeType: 'application/octet-stream'
                }
            });
        } catch (err) {
            log('Error uploading to GDrive: ' + err.stack);
            throw err;
        }
    }

    async _downloadFile (remoteFile) {
        const res = await this._drive.files.get({
            fileId: remoteFile.id,
            alt: 'media'
        }, { responseType: 'stream' });

        const tempPath = tmp.tmpNameSync();
        try {
            const writeStream = createWriteStream(tempPath);
            await pipeline(res.data, writeStream);
        } catch (err) {
            log('Error downloading from GDrive: ' + err.stack);
            throw err;
        }

        try {
            await pipeline(createReadStream(tempPath), createWriteStream(this._localFilePath));
        } catch (err) {
            log(`Error copying from ${tempPath} to ${this._localFilePath}: ${err.stack}`);
            throw err;
        } finally {
            log(`Delete temp file: ${tempPath}.`);
            // unlink
        }

        await utimes(this._localFilePath, remoteFile.modifiedTime, remoteFile.modifiedTime);
    }

    async _findLocalFile () {
        let filestat = null;

        try {
            filestat = await lstat(this._localFilePath);
        } catch (err) {
            if (err.code === 'ENOENT') {
                return null;
            }

            throw err;
        }

        if (!filestat) {
            return null;
        }

        const buf = await readFile(this._localFilePath);
        const md5Checksum = md5(buf);

        return {
            name: this._localFilePath,
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
        const remoteDirId = await this._createOrGetRemoteSubdirs();

        await this._drive.files.create({
            media: {
                body: createReadStream(this._localFilePath)
            },
            requestBody: {
                name: filename,
                parents: remoteDirId ? [remoteDirId] : undefined

            }
        });
    }

    async _createOrGetRemoteSubdirs () {
        const dir = path.dirname(this._remoteFilePath);
        const subdirs = dir.split('/');
        let lastDir = null;
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
                log(`Creating partial directory ${subdir}...`);
                const createResult = await this._drive.files.create({
                    requestBody: {
                        name: subdir,
                        mimeType: 'application/vnd.google-apps.folder',
                        parents: lastDir ? [lastDir] : undefined
                    }
                });

                dirId = createResult.data.id;
            } else {
                log('Found existing subdirectory...');
            }

            lastDir = dirId;
        }

        return lastDir;
    }
}

module.exports = { GoogleDriveSynchronizedFile };
