import { AppManager } from '@stamhoofd/networking/AppManager';
import type { ObjectWithRecords, RecordAnswer } from '@stamhoofd/structures';
import { File as FileStruct, RecordCategory, RecordFileAnswer, RecordSettings, RecordType, TranslatedString } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { afterEach, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-vue';
import RecordCategoryAnswersBox from './RecordCategoryAnswersBox.vue';

const recordSettings = RecordSettings.create({
    id: 'file-record',
    name: TranslatedString.create('Attest'),
    type: RecordType.File,
});

class RecordsValue implements ObjectWithRecords {
    constructor(private readonly answers: Map<string, RecordAnswer>) {}

    isRecordEnabled(): boolean {
        return true;
    }

    getRecordAnswers(): Map<string, RecordAnswer> {
        return this.answers;
    }

    patchRecordAnswers(): this {
        return this;
    }

    doesMatchFilter(): boolean {
        return true;
    }
}

function createFile(options: { isPrivate: boolean; signedUrl?: string | null }) {
    return new FileStruct({
        id: 'file-1',
        server: 'https://files.example.com',
        path: 'users/1/abc/attest.pdf',
        name: 'attest.pdf',
        size: 100,
        isPrivate: options.isPrivate,
        signature: options.isPrivate ? 'signature' : null,
        signedUrl: options.signedUrl ?? null,
    });
}

function renderBox(file: FileStruct, request: ReturnType<typeof vi.fn>) {
    const answers = new Map<string, RecordAnswer>();
    answers.set(recordSettings.id, RecordFileAnswer.create({ settings: recordSettings, file }));

    return render(RecordCategoryAnswersBox, {
        props: {
            value: new RecordsValue(answers),
            category: RecordCategory.create({ name: TranslatedString.create('Documenten'), records: [recordSettings] }),
            isAdmin: true,
        },
        global: {
            config: {
                globalProperties: {
                    $t: (globalThis as any).$t ?? ((value: string) => value),
                    $isMobile: false,
                    $context: null,
                    formatPrice: Formatter.price.bind(Formatter),
                    formatDate: Formatter.date.bind(Formatter),
                } as any,
            },
            provide: {
                $context: { optionalAuthenticatedServer: { request } },
            },
            directives: {
                tooltip: {},
                copyable: {},
                autofocus: {},
            },
        },
    });
}

function downloadButton(): HTMLButtonElement {
    return document.querySelector<HTMLButtonElement>('.button.text')!;
}

afterEach(() => {
    vi.restoreAllMocks();
});

test('It asks the server for a new signed url when a private file does not have one', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(new Blob(['hello'], { type: 'application/pdf' }), { status: 200 }),
    );
    const downloadSpy = vi.spyOn(AppManager.shared, 'downloadFile').mockResolvedValue();

    const file = createFile({ isPrivate: true });
    const request = vi.fn().mockResolvedValue({
        data: createFile({ isPrivate: true, signedUrl: 'https://files.example.com/users/1/abc/attest.pdf?signed=1' }),
    });

    renderBox(file, request);
    await userEvent.click(downloadButton());

    await vi.waitFor(() => {
        expect(downloadSpy).toHaveBeenCalledTimes(1);
    });

    expect(request.mock.calls[0][0]).toMatchObject({
        method: 'POST',
        path: '/file-signed-url',
        body: file,
    });

    // The file is downloaded with the fresh signed url, not with its public path
    expect(fetchSpy).toHaveBeenCalledWith('https://files.example.com/users/1/abc/attest.pdf?signed=1');
    expect(downloadSpy.mock.calls[0][1]).toBe('attest.pdf');
});

test('It downloads a file that already has a url without asking the server', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(new Blob(['hello'], { type: 'application/pdf' }), { status: 200 }),
    );
    vi.spyOn(AppManager.shared, 'downloadFile').mockResolvedValue();

    const request = vi.fn();
    renderBox(createFile({ isPrivate: false }), request);
    await userEvent.click(downloadButton());

    await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith('https://files.example.com/users/1/abc/attest.pdf');
    });

    expect(request).not.toHaveBeenCalled();
});

test('It shows a spinner while it waits for the signed url', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(new Blob(['hello'], { type: 'application/pdf' }), { status: 200 }),
    );
    vi.spyOn(AppManager.shared, 'downloadFile').mockResolvedValue();

    let resolveRequest: (value: unknown) => void = () => { /* set below */ };
    const request = vi.fn().mockImplementation(() => new Promise((resolve) => {
        resolveRequest = resolve;
    }));

    renderBox(createFile({ isPrivate: true }), request);
    expect(document.querySelector('.spinner-container')).toBeNull();

    await userEvent.click(downloadButton());

    await vi.waitFor(() => {
        expect(document.querySelector('.spinner-container')).not.toBeNull();
    });

    // The download can't be started a second time while it is running
    expect(downloadButton().disabled).toBe(true);
    await userEvent.click(downloadButton(), { force: true });
    expect(request).toHaveBeenCalledTimes(1);

    resolveRequest({
        data: createFile({ isPrivate: true, signedUrl: 'https://files.example.com/users/1/abc/attest.pdf?signed=1' }),
    });

    await vi.waitFor(() => {
        expect(document.querySelector('.spinner-container')).toBeNull();
    });
    expect(document.querySelector('.icon.download')).not.toBeNull();
});
