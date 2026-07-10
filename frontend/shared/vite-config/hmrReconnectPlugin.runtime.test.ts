import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { createServer } from 'vite';
import hmrReconnectPlugin from './hmrReconnectPlugin.js';

/**
 * Unlike hmrReconnectPlugin.test.ts (which only checks the string surgery), this
 * actually *runs* the patched client. It boots a real Vite dev server with the
 * plugin, grabs the served & transformed `/@vite/client`, and executes it in a
 * sandbox with a fake WebSocket so we can drive a disconnect and observe what
 * the client does: it must reconnect (open a fresh HMR socket) instead of
 * reloading the page, and the new socket must be wired to the message handler.
 */

type Listener = (event: unknown) => void;

class MockWebSocket {
    static instances: MockWebSocket[] = [];

    static reset(): void {
        MockWebSocket.instances = [];
    }

    static ofProtocol(protocol: string): MockWebSocket[] {
        return MockWebSocket.instances.filter(ws => ws.protocol === protocol);
    }

    static last(protocol: string): MockWebSocket | undefined {
        return MockWebSocket.ofProtocol(protocol).at(-1);
    }

    // Mirror the WebSocket readyState constants the client reads via `socket.OPEN`.
    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSING = 2;
    readonly CLOSED = 3;

    readyState = 0;
    private readonly listeners: Record<string, Listener[]> = {};

    constructor(public readonly url: string, public readonly protocol?: string) {
        MockWebSocket.instances.push(this);
    }

    addEventListener(type: string, cb: Listener): void {
        (this.listeners[type] ??= []).push(cb);
    }

    removeEventListener(type: string, cb: Listener): void {
        this.listeners[type] = (this.listeners[type] ?? []).filter(fn => fn !== cb);
    }

    send(): void {}

    close(): void {
        this.readyState = this.CLOSED;
    }

    private emit(type: string, event: unknown): void {
        for (const cb of [...(this.listeners[type] ?? [])]) {
            cb(event);
        }
    }

    /** Test helper: server accepted the socket. */
    simulateOpen(): void {
        this.readyState = this.OPEN;
        this.emit('open', {});
    }

    /** Test helper: connection dropped (e.g. Caddy reload). */
    simulateDrop(): void {
        this.readyState = this.CLOSED;
        this.emit('close', { wasClean: false });
    }

    /** Test helper: a message pushed by the server. */
    simulateMessage(data: unknown): void {
        this.emit('message', { data: JSON.stringify(data) });
    }
}

/** Let queued microtasks and any setTimeout(0) work drain. */
async function flush(rounds = 6): Promise<void> {
    for (let i = 0; i < rounds; i++) {
        await new Promise(resolve => setTimeout(resolve, 0));
    }
}

async function loadPatchedClient(): Promise<string> {
    const server = await createServer({
        configFile: false,
        root: import.meta.dirname,
        logLevel: 'silent',
        optimizeDeps: { noDiscovery: true },
        server: { middlewareMode: true, hmr: false, ws: false },
        plugins: [hmrReconnectPlugin()],
    });
    try {
        const result = await server.transformRequest('/@vite/client');
        if (!result) {
            throw new Error('Vite did not return a /@vite/client module');
        }
        return result.code;
    } finally {
        await server.close();
    }
}

function runClient(code: string, reload: () => void): void {
    // The served client has three ESM-only bits that a classic vm.Script can't
    // parse: a side-effect `import "…/env.mjs"`, `import.meta`, and the trailing
    // `export { … }`. Strip/stub them so we can run the (otherwise fully
    // define-replaced) client in a sandbox.
    const script = 'const __viteImportMeta = { url: "http://localhost:5173/@vite/client", env: { DEV: true, PROD: false, MODE: "development", BASE_URL: "/" } };\n'
        + code
            .replace(/^\s*import\s+["'][^"']+["'];?\s*$/gm, '')
            .replace(/import\.meta/g, '__viteImportMeta')
            .replace(/^export\s*\{[^}]*\};?\s*$/m, '');

    const sandbox: Record<string, unknown> = {
        console: { debug() {}, log() {}, info() {}, warn() {}, error() {} },
        URL,
        Blob,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        queueMicrotask,
        Promise,
        WebSocket: MockWebSocket,
        fetch: vi.fn(),
        addEventListener() {},
        removeEventListener() {},
        document: {
            visibilityState: 'visible',
            addEventListener() {},
            removeEventListener() {},
            querySelector: () => null,
            querySelectorAll: () => [] as unknown[],
            createElement: () => ({
                setAttribute() {}, addEventListener() {}, appendChild() {},
                remove() {}, insertAdjacentElement() {}, cloneNode() { return this; },
                style: {},
            }),
            head: { appendChild() {} },
            body: { appendChild() {} },
        },
        location: { href: 'http://localhost:5173/', reload },
    };
    // The client reads `window`/`self` and checks `"document" in globalThis`.
    sandbox.window = sandbox;
    sandbox.self = sandbox;

    vm.createContext(sandbox);
    new vm.Script(script, { filename: 'vite-client-patched.js' }).runInContext(sandbox as vm.Context);
}

describe('hmrReconnectPlugin (runtime)', () => {
    it('reconnects the HMR socket instead of reloading the page', async () => {
        const code = await loadPatchedClient();
        expect(code).toContain('transport.connect(createHMRHandler(handleMessage))');

        MockWebSocket.reset();
        const reload = vi.fn();
        runClient(code, reload);

        // The client opens its HMR socket on load.
        await flush();
        const firstSocket = MockWebSocket.last('vite-hmr');
        expect(firstSocket).toBeDefined();
        firstSocket!.simulateOpen();
        await flush();

        const hmrSocketsBefore = MockWebSocket.ofProtocol('vite-hmr').length;

        // Simulate Caddy tearing down the proxied WebSocket.
        firstSocket!.simulateDrop();
        await flush();

        // It should be probing the server (vite-ping), NOT reloading.
        const pingSocket = MockWebSocket.last('vite-ping');
        expect(pingSocket).toBeDefined();
        expect(reload).not.toHaveBeenCalled();

        // Server is reachable again: the ping succeeds.
        pingSocket!.simulateOpen();
        await flush();

        // A brand new HMR socket must have been opened, and still no reload.
        expect(MockWebSocket.ofProtocol('vite-hmr').length).toBe(hmrSocketsBefore + 1);
        expect(reload).not.toHaveBeenCalled();

        // The reconnected socket is live: a server message is handled without error.
        const secondSocket = MockWebSocket.last('vite-hmr');
        expect(secondSocket).not.toBe(firstSocket);
        expect(() => secondSocket!.simulateMessage({ type: 'connected' })).not.toThrow();
        await flush();
        expect(reload).not.toHaveBeenCalled();
    });
});
