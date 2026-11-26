import { localRendererDestination, rendererPostUrl } from '../../src/services/InvoicePdfService.js';
import { Version } from '@stamhoofd/structures';
import { runWaterfall } from './trace-waterfall.js';

it('canonicalizes renderer authorities and rejects non-authorities before posting', () => {
    expect(rendererPostUrl('Renderer.Example:443', false).href).toBe(
        `https://renderer.example/v${Version}/html-to-pdf`,
    );
    for (const authority of [
        'user@renderer.example',
        'renderer.example/a',
        'renderer.example?x',
        'renderer.example#x',
        'renderer.example\\evil',
    ]) {
        expect(() => rendererPostUrl(authority, false)).toThrow();
    }
});

it('never admits a nonlocal HTTPS destination to the local renderer lane', () => {
    expect(
        localRendererDestination(new URL('https://renderer.example/'), 'renderer.example', 9090),
    ).toBeUndefined();
});

it.skipIf(!process.env.STAM_BACKEND_TRACE_SMOKE)(
    'traces real invoice requests: production',
    () => runWaterfall('production'),
    30_000,
);
