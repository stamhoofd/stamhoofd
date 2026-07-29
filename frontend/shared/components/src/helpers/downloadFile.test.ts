import { AppManager } from '@stamhoofd/networking/AppManager';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { downloadFile } from './downloadFile.ts';

/**
 * The url of a file is not always a server of ours (see File in @stamhoofd/structures), so opening it would
 * send the user from our own interface to a page we don't control. These tests pin that a file is always
 * fetched and saved, and that nothing ever navigates to its url.
 */
describe('downloadFile', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('It saves the bytes of a file instead of opening its url', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(new Blob(['hello'], { type: 'application/pdf' }), { status: 200 }),
        );
        const downloadSpy = vi.spyOn(AppManager.shared, 'downloadFile').mockResolvedValue();
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

        await downloadFile('https://files.example.com/p/1/contract.pdf', 'contract.pdf');

        expect(fetchSpy).toHaveBeenCalledWith('https://files.example.com/p/1/contract.pdf');
        expect(downloadSpy).toHaveBeenCalledTimes(1);
        expect(downloadSpy.mock.calls[0][0]).toBeInstanceOf(Blob);
        expect(downloadSpy.mock.calls[0][1]).toBe('contract.pdf');

        expect(openSpy).not.toHaveBeenCalled();
    });

    test('It fails instead of opening the url when a server does not let us read the file', async () => {
        // A server we don't control doesn't have to allow us to fetch from it (CORS)
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
        const downloadSpy = vi.spyOn(AppManager.shared, 'downloadFile').mockResolvedValue();
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

        await expect(downloadFile('https://evil.example.com/invoice.pdf', 'invoice.pdf')).rejects.toThrow(/failed to download/i);

        expect(downloadSpy).not.toHaveBeenCalled();
        expect(openSpy).not.toHaveBeenCalled();
    });

    test('It fails on a file the server refuses to return', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 403 }));
        const downloadSpy = vi.spyOn(AppManager.shared, 'downloadFile').mockResolvedValue();

        await expect(downloadFile('https://files.example.com/p/1/private.pdf', 'private.pdf')).rejects.toThrow(/failed to download/i);

        expect(downloadSpy).not.toHaveBeenCalled();
    });
});
