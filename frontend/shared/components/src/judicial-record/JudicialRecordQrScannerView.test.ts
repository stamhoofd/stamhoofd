import { SimpleError } from '@common/errors';
import { AppManager } from '@stamhoofd/frontend-platform/AppManager';
import { MemberDetails, MemberWithRegistrationsBlob, Organization, Platform, PlatformFamily, PlatformMember } from '@stamhoofd/structures';
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { reactive, ref } from 'vue';
import JudicialRecordQrScannerView from './JudicialRecordQrScannerView.vue';

/**
 * The camera is the one thing a test cannot have, so the composable that runs it is replaced by
 * something that hands us the callback it would have been given. What is tested here is what
 * happens with a code that was read, not the reading itself.
 */
let onCode: ((value: string) => void) | null = null;
const cameraFailed = ref(false);
const pause = vi.fn();
const resume = vi.fn();
const stop = vi.fn();

vi.mock('../hooks/useQrScanner', () => ({
    useQrScanner: ({ onCode: callback }: { onCode: (value: string) => void }) => {
        onCode = callback;
        return {
            cameras: ref([]),
            hasFlash: ref(false),
            isFlashOn: ref(false),
            nativeCamera: ref(false),
            cameraFailed,
            start: vi.fn().mockResolvedValue(undefined),
            pause,
            resume,
            stop,
            switchCamera: vi.fn(),
            toggleFlash: vi.fn(),
        };
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

let selectHandler: ReturnType<typeof vi.fn<(file: File, url: string) => Promise<void>>>;
let dismiss: ReturnType<typeof vi.fn>;

beforeEach(() => {
    onCode = null;
    cameraFailed.value = false;
    pause.mockReset();
    resume.mockReset();
    stop.mockReset();
});

function renderView(request: ReturnType<typeof vi.fn>) {
    selectHandler = vi.fn<(file: File, url: string) => Promise<void>>().mockResolvedValue(undefined);
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

function status() {
    return document.querySelector<HTMLElement>('[data-testid="judicial-record-qr-status"]')!;
}

test('Fetches the extract behind a scanned code and hands it over', async () => {
    const request = vi.fn().mockResolvedValue(pdfResponse());
    renderView(request);

    await vi.waitFor(() => {
        expect(onCode).not.toBeNull();
    });
    onCode!(URL_OF_AN_EXTRACT);

    await vi.waitFor(() => {
        expect(selectHandler).toHaveBeenCalledTimes(1);
    });

    const options = request.mock.calls[0][0];
    expect(options.method).toBe('POST');
    expect(options.body).toEqual({ url: URL_OF_AN_EXTRACT });

    // What the member gets is a pdf, indistinguishable from one they picked themselves
    const [file, url] = selectHandler.mock.calls[0];
    expect(file.type).toBe('application/pdf');
    // The control step offers the original at FOD Justitie by this link
    expect(url).toBe(URL_OF_AN_EXTRACT);

    // The step underneath pushes the control step, so the scanner is gone before that happens
    expect(dismiss).toHaveBeenCalled();
});

test('Keeps scanning when the code is not the one on an extract', async () => {
    const request = vi.fn().mockResolvedValue(pdfResponse());
    renderView(request);

    await vi.waitFor(() => {
        expect(onCode).not.toBeNull();
    });
    onCode!('https://example.com/not-an-extract');

    await vi.waitFor(() => {
        expect(document.querySelector('[data-testid="judicial-record-qr-error"]')).not.toBeNull();
    });

    expect(request).not.toHaveBeenCalled();
    expect(selectHandler).not.toHaveBeenCalled();
    expect(pause).not.toHaveBeenCalled();

    onCode!(URL_OF_AN_EXTRACT);

    await vi.waitFor(() => {
        expect(selectHandler).toHaveBeenCalledTimes(1);
    });
});

test('Says what went wrong when FOD Justitie has no pdf behind the code', async () => {
    const request = vi.fn().mockRejectedValue(new SimpleError({
        code: 'no_pdf',
        message: 'No pdf',
        human: 'FOD Justitie gaf geen document terug voor deze code.',
    }));
    renderView(request);

    await vi.waitFor(() => {
        expect(onCode).not.toBeNull();
    });
    onCode!(URL_OF_AN_EXTRACT);

    await vi.waitFor(() => {
        expect(status().textContent).toContain('geen document');
    });
    expect(selectHandler).not.toHaveBeenCalled();
    expect(dismiss).not.toHaveBeenCalled();

    // The camera stopped reading while the request ran, and reads again for another try
    expect(pause).toHaveBeenCalled();
    expect(resume).toHaveBeenCalled();
});

test('Shows a spinner over the camera while it fetches the extract', async () => {
    let finish!: (value: unknown) => void;
    const request = vi.fn().mockReturnValue(new Promise((resolve) => {
        finish = resolve;
    }));
    renderView(request);

    await vi.waitFor(() => {
        expect(onCode).not.toBeNull();
    });
    onCode!(URL_OF_AN_EXTRACT);

    await vi.waitFor(() => {
        expect(document.querySelector('[data-testid="judicial-record-qr-fetching"] .spinner-container')).not.toBeNull();
    });

    finish(pdfResponse());

    await vi.waitFor(() => {
        expect(selectHandler).toHaveBeenCalledTimes(1);
    });
});

test('Blames the connection when the extract could not be fetched for lack of one', async () => {
    const request = vi.fn().mockRejectedValue(new SimpleError({
        code: 'network_error',
        message: 'Network error',
        human: 'Iets dat de server zou zeggen',
    }));
    renderView(request);

    await vi.waitFor(() => {
        expect(onCode).not.toBeNull();
    });
    onCode!(URL_OF_AN_EXTRACT);

    await vi.waitFor(() => {
        expect(status().textContent).toContain('internetverbinding');
    });
    expect(document.querySelector('[data-testid="judicial-record-qr-fetching"]')).toBeNull();
    expect(selectHandler).not.toHaveBeenCalled();
});

test('Does not fetch a code again while it is still in front of the camera after FOD Justitie had no pdf', async () => {
    const request = vi.fn().mockRejectedValue(new SimpleError({
        code: 'no_pdf',
        message: 'No pdf',
        human: 'FOD Justitie gaf geen document terug voor deze code.',
    }));
    const hapticError = vi.spyOn(AppManager.shared, 'hapticError').mockImplementation(() => {});
    renderView(request);

    await vi.waitFor(() => {
        expect(onCode).not.toBeNull();
    });
    onCode!(URL_OF_AN_EXTRACT);

    await vi.waitFor(() => {
        expect(status().textContent).toContain('geen document');
    });

    // The camera keeps reading the same code after the request failed
    onCode!(URL_OF_AN_EXTRACT);
    onCode!(URL_OF_AN_EXTRACT);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(request).toHaveBeenCalledTimes(1);
    expect(hapticError).toHaveBeenCalledTimes(1);
    expect(status().textContent).toContain('geen document');

    hapticError.mockRestore();
});

test('Does not offer to try again after an error', async () => {
    const request = vi.fn().mockRejectedValue(new SimpleError({
        code: 'too_many_requests',
        message: 'Too many judicial record fetches',
        human: 'Je hebt te veel uittreksels opgehaald. Probeer het later opnieuw.',
        statusCode: 429,
    }));
    renderView(request);

    await vi.waitFor(() => {
        expect(onCode).not.toBeNull();
    });
    onCode!(URL_OF_AN_EXTRACT);

    await vi.waitFor(() => {
        expect(status().textContent).toContain('te veel uittreksels');
    });
    expect(status().textContent).not.toContain('Opnieuw proberen');

    // Not fetched again while the code stays in front of the camera
    onCode!(URL_OF_AN_EXTRACT);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(request).toHaveBeenCalledTimes(1);
});

test('Stops the camera when the scanner closes', async () => {
    const { unmount } = renderView(vi.fn());

    await unmount();

    expect(stop).toHaveBeenCalled();
});

test('Says so when the camera cannot be used', async () => {
    cameraFailed.value = true;
    renderView(vi.fn());

    await vi.waitFor(() => {
        expect(document.querySelector('[data-testid="judicial-record-qr-camera-error"]')).not.toBeNull();
    });

    expect(document.querySelector('[data-testid="judicial-record-qr-video"]')).toBeNull();
    // Without the camera the pdf is the way in
    expect(status().textContent).toContain('pdf');
});
