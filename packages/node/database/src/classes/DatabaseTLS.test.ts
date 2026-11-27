import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import mysql from 'mysql2';
import mysqlPromise from 'mysql2/promise';
import { DatabaseInstance } from './Database.js';

describe('verified database TLS', () => {
    let folder: string;
    let server: tls.Server;
    let port: number;
    const sockets = new Set<net.Socket>();
    const observedSNI: string[] = [];

    beforeAll(async () => {
        folder = fs.mkdtempSync(path.join(os.tmpdir(), 'database-tls-'));
        for (const name of ['server', 'untrusted']) {
            execFileSync('openssl', [
                'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
                '-subj', '/CN=mysql.example.test', '-addext', 'subjectAltName=DNS:mysql.example.test',
                '-keyout', path.join(folder, `${name}.key`), '-out', path.join(folder, `${name}.pem`),
            ], { stdio: 'ignore' });
        }
        const credentials = {
            cert: fs.readFileSync(path.join(folder, 'server.pem')),
            key: fs.readFileSync(path.join(folder, 'server.key')),
        };
        server = tls.createServer({
            ...credentials,
            SNICallback(name, callback) {
                observedSNI.push(name);
                callback(null, tls.createSecureContext(credentials));
            },
        });
        server.on('connection', (socket) => {
            sockets.add(socket);
            socket.on('close', () => sockets.delete(socket));
        });
        server.on('tlsClientError', () => {});
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        port = (server.address() as net.AddressInfo).port;
    });

    afterAll(async () => {
        for (const socket of sockets) {
            socket.destroy();
        }
        if (server) {
            await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        }
        if (folder) {
            fs.rmSync(folder, { recursive: true });
        }
    });

    async function handshake(host: string, ca = 'server.pem', withoutClientCredentials = false): Promise<void> {
        observedSNI.length = 0;
        const createPool = vi.spyOn(mysqlPromise, 'createPool');
        const database = new DatabaseInstance({
            database: null, host, port, connectHost: '127.0.0.1',
            useSSL: true, ca: path.join(folder, ca), verifyIdentity: true,
            ...(withoutClientCredentials ? { cert: null, key: null } : {}),
        });
        const options = createPool.mock.calls.at(-1)![0];
        createPool.mockRestore();
        // Exercise the installed driver's TLS upgrade against real TLS, without a second MySQL
        // server or hand-written MySQL protocol. Authentication is not part of this regression.
        const connection = mysql.createConnection({ ...options as mysql.ConnectionOptions, connectTimeout: 2000 });
        connection.on('error', () => {});
        try {
            await new Promise<void>((resolve, reject) => {
                (connection as unknown as { startTLS: (callback: (error?: Error) => void) => void })
                    .startTLS(error => error ? reject(error) : resolve());
            });
        } finally {
            connection.destroy();
            await database.end();
        }
    }

    it('accepts a trusted DNS identity over an explicit TCP route without client certificates', async () => {
        await expect(handshake('mysql.example.test')).resolves.toBeUndefined();
        expect(observedSNI).toEqual(['mysql.example.test']);
    });

    it('rejects the wrong endpoint identity even when the CA is trusted', async () => {
        await expect(handshake('wrong.example.test')).rejects.toMatchObject({ code: 'ERR_TLS_CERT_ALTNAME_INVALID' });
    });

    it('rejects an untrusted CA even when the identity matches', async () => {
        await expect(handshake('mysql.example.test', 'untrusted.pem')).rejects.toThrow();
    });

    it.each(['10.90.0.4', '::1', ''])('rejects a non-DNS reference identity (%s) before connecting', (host) => {
        expect(() => new DatabaseInstance({
            database: null, host, useSSL: true, verifyIdentity: true, ca: path.join(folder, 'server.pem'),
        })).toThrow(/DNS hostname/);
    });

    it('can explicitly disable inherited client credentials for server-auth TLS', async () => {
        vi.stubEnv('DB_CERT', '/must-not-read-legacy-client.pem');
        vi.stubEnv('DB_KEY', '/must-not-read-legacy-client-key.pem');
        try {
            await expect(handshake('mysql.example.test', 'server.pem', true)).resolves.toBeUndefined();
        } finally {
            vi.unstubAllEnvs();
        }
    });
});
