import { AppManager } from '@stamhoofd/networking/AppManager';
import type { PlatformMember } from '@stamhoofd/structures';
import { afterEach, describe, expect, it } from 'vitest';
import { SelectablePdfData } from '../SelectablePdfData';
import { SelectablePdfSheet } from '../SelectablePdfSheet';
import { MembersPdfDocument } from './MembersPdfDocument';

describe('MembersPdfDocument', () => {
    const originalDownloadFile = AppManager.shared.downloadFile;

    afterEach(() => {
        AppManager.shared.downloadFile = originalDownloadFile;
    });

    it('renders a pdf without depending on the ticket builder having loaded first', async () => {
        let downloaded: Blob | File | URL | null = null;
        AppManager.shared.downloadFile = async (data) => {
            downloaded = data;
        };

        const sheet = new SelectablePdfSheet<PlatformMember>({
            id: 'details',
            name: 'Details',
            items: [
                new SelectablePdfData<PlatformMember>({ id: 'name', name: 'Naam', getValue: m => m.member.name }),
            ],
        });

        const document = new MembersPdfDocument([], sheet, sheet, 'Leden', null);
        await document.download();

        expect(downloaded).toBeInstanceOf(Blob);
        const bytes = new Uint8Array(await (downloaded as unknown as Blob).arrayBuffer());
        expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    });
});
