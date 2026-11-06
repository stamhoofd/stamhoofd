import { SimpleError } from '@common/errors';
import { MemberDetails, MemberWithRegistrationsBlob, Organization, Platform, PlatformFamily, PlatformMember } from '@stamhoofd/structures';
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { userEvent } from 'vitest/browser';
import { reactive } from 'vue';
import JudicialRecordQrScannerView from './JudicialRecordQrScannerView.vue';

/**
 * The camera is the one thing a test cannot have, so the library is replaced by something that
 * hands us the callback it would have been given. What is tested here is what happens with a code
 * that was read, not the reading itself.
 */
let onDecode: ((result: { data: string }) => void) | null = null;
let startResult: Promise<void> = Promise.resolve();
const destroy = vi.fn();

vi.mock('qr-scanner', () => ({
    default: class {
        constructor(_video: HTMLVideoElement, callback: (result: { data: string }) => void) {
            onDecode = callback;
        }

        start() {
            return startResult;
        }

        stop() {}

        destroy() {
            destroy();
        }
    },
}));

const URL_OF_AN_EXTRACT = 'https://just-crimeviewer-ctz.just.fgov.be/record/2331f637-9f30-46bd-9a3f-be62ff76d7dc-CJCS';

function createMember() {
    const platform = Platform.create({});
    const organization = Organization.create({ name: 'KSA Sint-Jan' });
    const family = new PlatformFamily({ platform, contextOrganization: organization });

    const member = new PlatformMember({
        family,
        member: MemberWithRegistrationsBlob.create({
            organizationId: organization.id,
            details: MemberDetails.create({
                firstName: 'Simon',
                lastName: 'Backx',
            }),
        }),
    });
    family.add(member);

    return reactive(member) as unknown as PlatformMember;
}

let selectHandler: ReturnType<typeof vi.fn<(file: File) => Promise<void>>>;
let dismiss: ReturnType<typeof vi.fn>;

beforeEach(() => {
    onDecode = null;
    startResult = Promise.resolve();
    destroy.mockReset();
});

function renderView(request: ReturnType<typeof vi.fn>) {
    selectHandler = vi.fn<(file: File) => Promise<void>>().mockResolvedValue(undefined);
    dismiss = vi.fn().mockResolvedValue(undefined);

    return render(JudicialRecordQrScannerView, {
        props: {
            member: createMember(),
            selectHandler,
        },
        global: {
            provide: {
                $context: { authenticatedServer: { request } },
                reactive_navigation_pop: vi.fn().mockResolvedValue(undefined),
                reactive_navigation_dismiss: dismiss,
                reactive_navigation_present: vi.fn().mockResolvedValue(undefined),
                reactive_navigation_push: vi.fn().mockResolvedValue(undefined),
            },
            config: {
                globalProperties: {
                    $t: (globalThis as any).$t,
                    STAMHOOFD: (globalThis as any).STAMHOOFD,
                    $isMobile: false,
                    $isPhone: false,
                } as any,
            },
            directives: {
                autofocus: {},
                tooltip: {},
            },
        },
    });
}

function pdfResponse() {
    return { data: new Blob([new Uint8Array(1024)], { type: 'application/pdf' }) };
}

function urlInput() {
    return document.querySelector<HTMLInputElement>('[data-testid="judicial-record-qr-url-input"]')!;
}

function root() {
    return document.querySelector<HTMLElement>('.judicial-record-qr-scanner-view')!;
}

test('Fetches the extract behind a scanned code and hands it over', async () => {
    const request = vi.fn().mockResolvedValue(pdfResponse());
    renderView(request);

    await vi.waitFor(() => {
        expect(onDecode).not.toBeNull();
    });
    onDecode!({ data: URL_OF_AN_EXTRACT });

    await vi.waitFor(() => {
        expect(selectHandler).toHaveBeenCalledTimes(1);
    });

    const options = request.mock.calls[0][0];
    expect(options.method).toBe('POST');
    expect(options.body).toEqual({ url: URL_OF_AN_EXTRACT });

    // What the member gets is a pdf, indistinguishable from one they picked themselves
    const file = selectHandler.mock.calls[0][0] as File;
    expect(file.type).toBe('application/pdf');

    // The step underneath pushes the control step, so the scanner is gone before that happens
    expect(dismiss).toHaveBeenCalled();
});

test('Keeps scanning when the code is not the one on an extract', async () => {
    const request = vi.fn().mockResolvedValue(pdfResponse());
    renderView(request);

    await vi.waitFor(() => {
        expect(onDecode).not.toBeNull();
    });
    onDecode!({ data: 'https://example.com/not-an-extract' });

    await vi.waitFor(() => {
        expect(document.querySelector('.error-box')).not.toBeNull();
    });

    expect(request).not.toHaveBeenCalled();
    expect(selectHandler).not.toHaveBeenCalled();

    onDecode!({ data: URL_OF_AN_EXTRACT });

    await vi.waitFor(() => {
        expect(selectHandler).toHaveBeenCalledTimes(1);
    });
});

test('Takes a pasted link just like a scanned one', async () => {
    const request = vi.fn().mockResolvedValue(pdfResponse());
    renderView(request);

    await userEvent.fill(urlInput(), URL_OF_AN_EXTRACT);
    await userEvent.click(document.querySelector<HTMLElement>('[data-testid="judicial-record-qr-use-link"]')!);

    await vi.waitFor(() => {
        expect(selectHandler).toHaveBeenCalledTimes(1);
    });
    expect(request.mock.calls[0][0].body).toEqual({ url: URL_OF_AN_EXTRACT });
});

test('Refuses a pasted link that is not one of FOD Justitie', async () => {
    const request = vi.fn().mockResolvedValue(pdfResponse());
    renderView(request);

    await userEvent.fill(urlInput(), 'https://example.com/record/1234-CJCS');
    await userEvent.click(document.querySelector<HTMLElement>('[data-testid="judicial-record-qr-use-link"]')!);

    await vi.waitFor(() => {
        expect(document.querySelector('.error-box')).not.toBeNull();
    });
    expect(request).not.toHaveBeenCalled();
});

test('Says what went wrong when FOD Justitie has no pdf behind the code', async () => {
    const request = vi.fn().mockRejectedValue(new SimpleError({
        code: 'no_pdf',
        message: 'No pdf',
        human: 'FOD Justitie gaf geen document terug voor deze code.',
    }));
    renderView(request);

    await vi.waitFor(() => {
        expect(onDecode).not.toBeNull();
    });
    onDecode!({ data: URL_OF_AN_EXTRACT });

    await vi.waitFor(() => {
        expect(document.querySelector('.error-box')!.textContent).toContain('geen document');
    });
    expect(selectHandler).not.toHaveBeenCalled();
    expect(dismiss).not.toHaveBeenCalled();
});

test('Falls back to the paste field when the camera cannot be used', async () => {
    startResult = Promise.reject(new Error('NotAllowedError'));
    const request = vi.fn().mockResolvedValue(pdfResponse());
    renderView(request);

    await vi.waitFor(() => {
        expect(document.querySelector('[data-testid="judicial-record-qr-camera-error"]')).not.toBeNull();
    });

    expect(document.querySelector('[data-testid="judicial-record-qr-video"]')).toBeNull();
    // Pasting the link is the way in, so it is still there
    expect(urlInput()).not.toBeNull();
    expect(root().textContent).toContain('camera');
});
