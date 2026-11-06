import { SimpleError } from '@common/errors';
import { JudicialRecordCheck, JudicialRecordCheckReport, JudicialRecordCheckResult, JudicialRecordCheckStatus, JudicialRecordDeliveryResponse, JudicialRecordDeliveryStatus, MemberDetails, MemberWithRegistrationsBlob, Organization, Platform, PlatformFamily, PlatformMember } from '@stamhoofd/structures';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { reactive } from 'vue';
import { ContextMenu } from '../overlays/ContextMenu';
import JudicialRecordControlView from './JudicialRecordControlView.vue';
import type { JudicialRecordDelivery } from './JudicialRecordStepProps';
import { JUDICIAL_RECORD_MAX_PDF_SIZE } from './useJudicialRecordPdfSelection';

/**
 * The checks themselves are covered by @stamhoofd/judicial-record-check, which builds its own signed
 * pdfs for it. What this suite needs is a verdict, which no fixture small enough to write here can
 * produce: every one of the five checks leans on a real document from FOD Justitie.
 */
vi.mock('@stamhoofd/judicial-record-check', () => ({
    checkJudicialRecord: vi.fn(),
}));

const { checkJudicialRecord } = await import('@stamhoofd/judicial-record-check');
const check = vi.mocked(checkJudicialRecord);

/** What the checks answer: the report, and the link the document prints when it prints one */
function checkOutcome(report: JudicialRecordCheckReport, extract: { url: string; urlExpiry: Date | null } | null = null) {
    return { report, certificatePath: null, extract } as never;
}

/**
 * The viewer draws the pdf with pdfjs, which has nothing to do with what this step decides. What
 * does matter is the error it emits for a document it cannot draw, so the stand-in can emit one.
 */
let viewerFails = false;
let viewerPageCount = 1;
const goToPage = vi.fn();

vi.mock('@stamhoofd/frontend-pdf-viewer/PdfViewer.vue', () => ({
    default: {
        name: 'PdfViewer',
        props: ['data', 'horizontal', 'fixedHeight'],
        emits: ['error', 'loaded', 'page'],
        template: '<div data-testid="pdf-viewer" />',
        methods: {
            goToPage: (pageNumber: number) => goToPage(pageNumber),
        },
        mounted(this: { $emit: (event: string, ...args: unknown[]) => void }) {
            if (viewerFails) {
                this.$emit('error', new Error('Cannot render'));
            }
            else {
                this.$emit('loaded', { pageCount: viewerPageCount });
            }
        },
    },
}));

beforeEach(() => {
    viewerFails = false;
    viewerPageCount = 1;
    goToPage.mockClear();
    check.mockReset();
    check.mockResolvedValue(checkOutcome(notSignedReport()));
});

afterEach(() => {
    vi.restoreAllMocks();
});

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

function createReport(statuses: Partial<Record<JudicialRecordCheck, JudicialRecordCheckStatus>>, reasons: Partial<Record<JudicialRecordCheck, string>> = {}) {
    return JudicialRecordCheckReport.create({
        checks: Object.entries(statuses).map(([check, status]) => JudicialRecordCheckResult.create({
            check: check as JudicialRecordCheck,
            status,
            reason: reasons[check as JudicialRecordCheck] ?? '',
        })),
    });
}

const passedReport = () => createReport({
    [JudicialRecordCheck.Authentic]: JudicialRecordCheckStatus.Passed,
    [JudicialRecordCheck.Identity]: JudicialRecordCheckStatus.Passed,
    [JudicialRecordCheck.Model]: JudicialRecordCheckStatus.Passed,
    [JudicialRecordCheck.Age]: JudicialRecordCheckStatus.Passed,
    [JudicialRecordCheck.Blank]: JudicialRecordCheckStatus.Passed,
});

/** Everything about the document is in order, there is simply something on the record. */
const notBlankReport = () => createReport({
    [JudicialRecordCheck.Authentic]: JudicialRecordCheckStatus.Passed,
    [JudicialRecordCheck.Identity]: JudicialRecordCheckStatus.Passed,
    [JudicialRecordCheck.Model]: JudicialRecordCheckStatus.Passed,
    [JudicialRecordCheck.Age]: JudicialRecordCheckStatus.Passed,
    [JudicialRecordCheck.Blank]: JudicialRecordCheckStatus.Failed,
});

/** A scan or a photo: the signature does not hold, so the content checks have no verdict. */
const notSignedReport = () => createReport({
    [JudicialRecordCheck.Authentic]: JudicialRecordCheckStatus.Failed,
    [JudicialRecordCheck.Identity]: JudicialRecordCheckStatus.Pending,
    [JudicialRecordCheck.Model]: JudicialRecordCheckStatus.Pending,
    [JudicialRecordCheck.Age]: JudicialRecordCheckStatus.Pending,
    [JudicialRecordCheck.Blank]: JudicialRecordCheckStatus.Pending,
}, {
    [JudicialRecordCheck.Authentic]: 'Dit bestand werd niet ondertekend door FOD Justitie.',
});

/** At least this wide, the extract gets a column of its own next to the view (see PreviewPanel) */
const wideWidth = 1000;
const narrowWidth = 600;

const extractUrl = 'https://just-crimeviewer-ctz.just.fgov.be/record/123e4567-e89b-12d3-a456-426614174000-CJCS';

function createPdf(name = 'uittreksel.pdf', size = 1024) {
    return new File([new Uint8Array(size)], name, { type: 'application/pdf' });
}

/**
 * The delivery step hands over the file it was given. When the member comes back to this step, the
 * delivery also holds what the checks found (`report`) and what the backend answered (`status`).
 */
function renderView({ file = createPdf(), report = null, status = null, request = vi.fn().mockResolvedValue(deliveryResponse(JudicialRecordDeliveryStatus.AutoOk)), width = narrowWidth, url = null }: {
    file?: File;
    report?: JudicialRecordCheckReport | null;
    status?: JudicialRecordDeliveryStatus | null;
    request?: ReturnType<typeof vi.fn>;
    width?: number;
    url?: string | null;
} = {}) {
    const dismissHandler = vi.fn().mockResolvedValue(undefined);
    const pop = vi.fn().mockResolvedValue(undefined);
    const delivery: JudicialRecordDelivery = {
        file,
        url,
        report,
        status,
    };

    const view = render(JudicialRecordControlView, {
        props: {
            member: createMember(),
            onBehalfOfMember: false,
            stepNumber: 3,
            stepCount: 3,
            delivery,
            saveHandler: vi.fn().mockResolvedValue(undefined),
            dismissHandler,
        },
        attrs: { style: `width: ${width}px;` },
        global: {
            provide: {
                $context: { authenticatedServer: { request } },
                reactive_navigation_pop: pop,
                reactive_navigation_dismiss: vi.fn().mockResolvedValue(undefined),
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

    return { view, dismissHandler, pop, delivery, request };
}

/** What the upload endpoint answers with: the status, and nothing about the checks. */
function deliveryResponse(status: JudicialRecordDeliveryStatus) {
    return { data: JudicialRecordDeliveryResponse.create({ status }) };
}

function byTestId(testId: string) {
    return document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

function summary() {
    return byTestId('judicial-record-summary')!;
}

function click(testId: string) {
    byTestId(testId)!.click();
}

/** Whether leaving the page now would ask the member first */
function preventsLeaving() {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
}

function selectedFile() {
    return byTestId('judicial-record-selected-file')!;
}

/** What is said below the file about what went wrong with it */
function fileError() {
    return selectedFile().querySelector<HTMLElement>('.error-box');
}

function processing() {
    return byTestId('judicial-record-processing');
}

/** A promise the test settles itself, to look at the step while it waits */
function pending<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}


test('Checks the pdf against the member as soon as the step opens', async () => {
    const pdf = createPdf();
    const { delivery } = renderView({ file: pdf });

    await vi.waitFor(() => {
        expect(check).toHaveBeenCalledTimes(1);
    });

    const options = check.mock.calls[0][0];
    expect(options.data).toBeInstanceOf(Uint8Array);
    expect(options.data.byteLength).toBe(pdf.size);
    expect(options.firstName).toBe('Simon');
    expect(options.lastName).toBe('Backx');

    await vi.waitFor(() => {
        expect(delivery.report).not.toBeNull();
    });
});

test('Shows the file, and what happens to it while it is checked and sent in', async () => {
    const checking = pending<unknown>();
    check.mockReturnValue(checking.promise as never);
    const sending = pending<unknown>();
    renderView({ file: createPdf('model-596-2.pdf'), request: vi.fn().mockReturnValue(sending.promise) });

    await vi.waitFor(() => {
        expect(selectedFile().textContent).toContain('Bezig met controleren');
    });
    expect(selectedFile().textContent).toContain('model-596-2.pdf');
    expect(selectedFile().querySelector('.icon.file-pdf')).not.toBeNull();
    expect(processing()).not.toBeNull();
    // The document is drawn while it is checked
    expect(byTestId('pdf-viewer')).not.toBeNull();
    // Nothing to ask for until it answers
    expect(byTestId('judicial-record-send-anyway')).toBeNull();
    expect(byTestId('judicial-record-retry-upload')!.hasAttribute('disabled')).toBe(true);
    expect(preventsLeaving()).toBe(true);

    checking.resolve(checkOutcome(passedReport()));

    await vi.waitFor(() => {
        expect(selectedFile().textContent).toContain('Bezig met inzenden');
    });

    sending.resolve(deliveryResponse(JudicialRecordDeliveryStatus.AutoOk));

    await vi.waitFor(() => {
        expect(summary().textContent).toContain('goedgekeurd');
    });
    expect(processing()).toBeNull();
    expect(selectedFile().textContent).toContain('1 kB');
});

test('Sends in an extract that passed every check right away, and only offers to close', async () => {
    check.mockResolvedValue(checkOutcome(passedReport()));
    const { request, delivery, dismissHandler } = renderView();

    await vi.waitFor(() => {
        expect(summary().textContent).toContain('goedgekeurd');
    });

    expect(summary().classList.contains('success-box')).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    const options = request.mock.calls[0][0];
    expect(options.method).toBe('POST');
    expect(options.path).toMatch(/^\/members\/.+\/judicial-record$/);
    expect((options.body as FormData).get('file')).toBe(delivery.file);
    expect(delivery.status).toBe(JudicialRecordDeliveryStatus.AutoOk);

    expect(byTestId('judicial-record-send-anyway')).toBeNull();
    expect(byTestId('judicial-record-retry-upload')).toBeNull();
    expect(preventsLeaving()).toBe(false);

    click('judicial-record-close');

    await vi.waitFor(() => {
        expect(dismissHandler).toHaveBeenCalledTimes(1);
    });
});

test('Sends in an extract that is real but not blank as well, and says a reviewer looks at it', async () => {
    check.mockResolvedValue(checkOutcome(notBlankReport()));
    const { request, delivery } = renderView({
        request: vi.fn().mockResolvedValue(deliveryResponse(JudicialRecordDeliveryStatus.Manual)),
    });

    await vi.waitFor(() => {
        expect(summary().classList.contains('warning-box')).toBe(true);
    });
    expect(summary().textContent).toContain('beoordeeld');
    expect(request).toHaveBeenCalledTimes(1);
    expect(delivery.status).toBe(JudicialRecordDeliveryStatus.Manual);
    expect(fileError()).toBeNull();
    expect(byTestId('judicial-record-close')).not.toBeNull();
});

test('Says below the file what needs fixing, without sending it in', async () => {
    const { request, delivery } = renderView();

    await vi.waitFor(() => {
        expect(fileError()!.textContent).toContain('niet ondertekend door FOD Justitie');
    });

    expect(request).not.toHaveBeenCalled();
    expect(delivery.report?.isPassed).toBe(false);
    expect(delivery.status).toBeNull();
    expect(byTestId('judicial-record-summary')).toBeNull();

    // Trying another document is the better idea than insisting on this one
    expect(byTestId('judicial-record-retry-upload')!.classList.contains('primary')).toBe(true);
    expect(byTestId('judicial-record-send-anyway')!.classList.contains('secundary')).toBe(true);
    expect(byTestId('judicial-record-close')).toBeNull();
});

test('Opens on what the backend answered when it has the extract already, without checking or sending it again', async () => {
    const { request } = renderView({ report: notBlankReport(), status: JudicialRecordDeliveryStatus.Manual });

    await vi.waitFor(() => {
        expect(summary().textContent).toContain('beoordeeld');
    });
    expect(check).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    expect(byTestId('judicial-record-close')).not.toBeNull();
});

test('Does not check a document again that it has a verdict for', async () => {
    const { request } = renderView({ report: notSignedReport() });

    await vi.waitFor(() => {
        expect(fileError()!.textContent).toContain('niet ondertekend door FOD Justitie');
    });
    expect(check).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
});

test('Advises the QR-code scanner below a file that is not a pdf, without checking it', async () => {
    const { request } = renderView({ file: new File([new Uint8Array(10)], 'scan.png', { type: 'image/png' }) });

    await vi.waitFor(() => {
        expect(fileError()!.textContent).toContain('QR-code');
    });
    expect(selectedFile().textContent).toContain('scan.png');
    expect(selectedFile().querySelector('.icon.file-image')).not.toBeNull();

    expect(check).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    expect(byTestId('pdf-viewer')).toBeNull();

    // Nothing can be done with it other than picking another, and nothing is lost by leaving
    expect(byTestId('judicial-record-send-anyway')).toBeNull();
    expect(byTestId('judicial-record-retry-upload')).not.toBeNull();
    expect(preventsLeaving()).toBe(false);
});

test('Refuses a pdf that is larger than an extract can be, without checking it', async () => {
    renderView({ file: createPdf('groot.pdf', JUDICIAL_RECORD_MAX_PDF_SIZE + 1) });

    await vi.waitFor(() => {
        expect(fileError()!.textContent).toContain('te groot');
    });
    expect(check).not.toHaveBeenCalled();
    expect(byTestId('judicial-record-send-anyway')).toBeNull();
});

test('Only offers another document when the checks could not run', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    check.mockRejectedValue(new Error('pdf.js broke'));
    const { request } = renderView();

    await vi.waitFor(() => {
        expect(fileError()!.textContent).toContain('niet controleren');
    });

    // There is no verdict to disagree with, so nothing to send in anyway
    expect(request).not.toHaveBeenCalled();
    expect(byTestId('judicial-record-send-anyway')).toBeNull();
    expect(byTestId('judicial-record-retry-upload')!.classList.contains('primary')).toBe(true);
    expect(preventsLeaving()).toBe(false);
});

test('Sends in a refused extract anyway when the member asks for it', async () => {
    const sending = pending<unknown>();
    const { request, delivery } = renderView({ request: vi.fn().mockReturnValue(sending.promise) });

    await vi.waitFor(() => {
        expect(byTestId('judicial-record-send-anyway')).not.toBeNull();
    });

    click('judicial-record-send-anyway');

    // The button the member pressed shows it is busy, and the reason it was pressed for stays
    await vi.waitFor(() => {
        expect(request).toHaveBeenCalledTimes(1);
    });
    expect(selectedFile().textContent).not.toContain('Bezig met inzenden');
    expect(fileError()!.textContent).toContain('niet ondertekend door FOD Justitie');

    sending.resolve(deliveryResponse(JudicialRecordDeliveryStatus.Manual));

    await vi.waitFor(() => {
        expect(summary().textContent).toContain('beoordeeld');
    });

    const options = request.mock.calls[0][0];
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).get('file')).toBeInstanceOf(File);
    expect(delivery.status).toBe(JudicialRecordDeliveryStatus.Manual);
    expect(fileError()).toBeNull();

    // In is in: there is nothing left to try
    expect(byTestId('judicial-record-send-anyway')).toBeNull();
    expect(byTestId('judicial-record-close')).not.toBeNull();
});

test('Goes back to the delivery step for another document', async () => {
    const { pop } = renderView();

    await vi.waitFor(() => {
        expect(byTestId('judicial-record-retry-upload')).not.toBeNull();
    });

    click('judicial-record-retry-upload');

    await vi.waitFor(() => {
        expect(pop).toHaveBeenCalledTimes(1);
    });
});

test('Only offers another document when the backend says the certificate was revoked', async () => {
    check.mockResolvedValue(checkOutcome(passedReport()));
    renderView({
        request: vi.fn().mockRejectedValue(new SimpleError({
            code: 'certificate_revoked',
            message: 'Revoked',
            human: 'Het certificaat van dit uittreksel werd ingetrokken.',
        })),
    });

    await vi.waitFor(() => {
        expect(fileError()!.textContent).toContain('ingetrokken');
    });

    // The same document gets the same answer
    expect(byTestId('judicial-record-send-anyway')).toBeNull();
    expect(byTestId('judicial-record-retry-upload')!.classList.contains('primary')).toBe(true);
    expect(byTestId('judicial-record-summary')).toBeNull();
    expect(preventsLeaving()).toBe(false);
});

test('Offers another attempt, not insistence, when the delivery never landed', async () => {
    const { request } = renderView({
        request: vi.fn()
            .mockRejectedValueOnce(new SimpleError({
                code: 'revocation_unknown',
                message: 'Unknown',
                human: 'We konden de digitale ondertekening van dit bestand niet volledig controleren. Probeer het later opnieuw.',
            }))
            .mockResolvedValueOnce(deliveryResponse(JudicialRecordDeliveryStatus.AutoOk)),
    });

    const submit = () => document.querySelector<HTMLButtonElement>('[data-testid="judicial-record-send-anyway"]')!;

    await vi.waitFor(() => {
        expect(submit()).not.toBeNull();
    });
    expect(submit().textContent).toContain('Toch inzenden');

    submit().click();

    await vi.waitFor(() => {
        expect(fileError()!.textContent).toContain('niet volledig controleren');
    });

    // A status we could not establish asks to be retried, so that is the button to reach for
    expect(submit().textContent).toContain('Opnieuw proberen');
    expect(submit().classList.contains('primary')).toBe(true);
    expect(byTestId('judicial-record-retry-upload')!.classList.contains('secundary')).toBe(true);
    expect(preventsLeaving()).toBe(true);

    submit().click();

    await vi.waitFor(() => {
        expect(summary().textContent).toContain('goedgekeurd');
    });
    expect(fileError()).toBeNull();
    expect(request).toHaveBeenCalledTimes(2);
});

test('Only offers to try again without a connection, since nothing is wrong with the document', async () => {
    check.mockResolvedValue(checkOutcome(passedReport()));
    renderView({
        request: vi.fn().mockRejectedValue(new SimpleError({ code: 'network_error', message: 'Network error' })),
    });

    await vi.waitFor(() => {
        expect(fileError()).not.toBeNull();
    });

    expect(byTestId('judicial-record-send-anyway')!.textContent).toContain('Opnieuw proberen');
    expect(byTestId('judicial-record-send-anyway')!.classList.contains('primary')).toBe(true);
    expect(byTestId('judicial-record-retry-upload')).toBeNull();
    expect(preventsLeaving()).toBe(true);
});

test('Only offers to close after too many attempts, since trying again right away is not allowed', async () => {
    check.mockResolvedValue(checkOutcome(passedReport()));
    renderView({
        request: vi.fn().mockRejectedValue(new SimpleError({
            code: 'too_many_requests',
            message: 'Too many requests',
            human: 'Je hebt te veel uittreksels ingezonden. Probeer het later opnieuw.',
            statusCode: 429,
        })),
    });

    await vi.waitFor(() => {
        expect(fileError()!.textContent).toContain('te veel uittreksels');
    });

    expect(byTestId('judicial-record-close')).not.toBeNull();
    expect(byTestId('judicial-record-send-anyway')).toBeNull();
    expect(byTestId('judicial-record-retry-upload')).toBeNull();
    expect(preventsLeaving()).toBe(false);
});

test('Shows the document in the view, with the buttons in the toolbar, without room for a column', async () => {
    renderView({ width: narrowWidth });

    await vi.waitFor(() => {
        expect(byTestId('pdf-viewer')).not.toBeNull();
    });

    expect(byTestId('pdf-viewer')!.closest('.judicial-record-control-view main')).not.toBeNull();
    // A long pdf in the view would push a button under the page, so it sits in the bottom bar
    expect(byTestId('judicial-record-retry-upload')!.closest('.st-toolbar')).not.toBeNull();
});

test('Shows the document in a column of its own, with the buttons below the file, when there is room', async () => {
    renderView({ width: wideWidth });

    await vi.waitFor(() => {
        expect(byTestId('pdf-viewer')?.closest('.preview-panel-column')).toBeTruthy();
    });

    expect(byTestId('pdf-viewer')!.closest('.judicial-record-control-view')).toBeNull();
    expect(byTestId('judicial-record-retry-upload')!.closest('main .style-button-bar')).not.toBeNull();
    expect(document.querySelector('.st-toolbar')).toBeNull();
});

test('Offers to open a document it cannot draw from its row, without touching the verdict', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    viewerFails = true;
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderView({ report: passedReport(), status: JudicialRecordDeliveryStatus.AutoOk });

    await vi.waitFor(() => {
        expect(byTestId('judicial-record-open-file')).not.toBeNull();
    });

    // An empty frame under a verdict is the thing this avoids
    expect(byTestId('pdf-viewer')).toBeNull();
    expect(summary().classList.contains('success-box')).toBe(true);
    expect(byTestId('judicial-record-open-file')!.getAttribute('aria-label')).toBe('Openen in nieuw tabblad');

    click('judicial-record-open-file');

    expect(open).toHaveBeenCalledOnce();
    expect(open.mock.calls[0][0]).toMatch(/^blob:/);
});

test('Opens a document it cannot draw at FOD Justitie, when they serve it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    viewerFails = true;
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderView({ report: passedReport(), status: JudicialRecordDeliveryStatus.AutoOk, url: extractUrl });

    await vi.waitFor(() => {
        expect(byTestId('judicial-record-open-file')).not.toBeNull();
    });
    expect(byTestId('judicial-record-open-file')!.getAttribute('aria-label')).toBe('Openen bij FOD Justitie');

    click('judicial-record-open-file');

    expect(open).toHaveBeenCalledExactlyOnceWith(extractUrl, '_blank');
});

test('Puts nothing in a column of its own for a document it cannot draw', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    viewerFails = true;
    renderView({ width: wideWidth });

    await vi.waitFor(() => {
        expect(byTestId('judicial-record-open-file')).not.toBeNull();
    });

    expect(byTestId('pdf-viewer')).toBeNull();
    expect(document.querySelector('.preview-panel.wide')).toBeNull();
    expect(byTestId('judicial-record-open-file')!.closest('.judicial-record-control-view main')).not.toBeNull();
});

test('Asks before leaving with an extract that was not sent in', async () => {
    renderView({
        request: vi.fn().mockResolvedValue(deliveryResponse(JudicialRecordDeliveryStatus.Manual)),
    });

    await vi.waitFor(() => {
        expect(byTestId('judicial-record-send-anyway')).not.toBeNull();
    });
    expect(preventsLeaving()).toBe(true);

    click('judicial-record-send-anyway');

    await vi.waitFor(() => {
        expect(byTestId('judicial-record-close')).not.toBeNull();
    });
    expect(preventsLeaving()).toBe(false);
});

/** The groups of the menu a right click on `element` opens, by the names of their items */
function rightClick(element: Element) {
    const show = vi.spyOn(ContextMenu.prototype, 'show').mockImplementation(async function (this: ContextMenu) {
        return this;
    });
    element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(show).toHaveBeenCalledOnce();
    return (show.mock.contexts[0] as ContextMenu).items;
}

function names(items: ContextMenu['items']) {
    return items.map(group => group.map(item => item.name));
}

test('Offers to open and download the file from the menu of its row, and the original while FOD Justitie serves it', async () => {
    renderView({ report: passedReport(), status: JudicialRecordDeliveryStatus.AutoOk, url: extractUrl });

    await vi.waitFor(() => {
        expect(byTestId('judicial-record-selected-file')).not.toBeNull();
    });

    const row = byTestId('judicial-record-selected-file')!.querySelector('.st-list-item')!;
    expect(names(rightClick(row))).toEqual([['Openen in nieuw tabblad', 'Origineel bij FOD Justitie bekijken', 'Downloaden']]);
});

test('Leaves the original out of the menu when FOD Justitie does not serve it', async () => {
    renderView({ report: passedReport(), status: JudicialRecordDeliveryStatus.AutoOk });

    await vi.waitFor(() => {
        expect(byTestId('judicial-record-selected-file')).not.toBeNull();
    });

    const row = byTestId('judicial-record-selected-file')!.querySelector('.st-list-item')!;
    expect(names(rightClick(row))).toEqual([['Openen in nieuw tabblad', 'Downloaden']]);
});

test('Offers the original by the link the document prints, until the day it says', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    check.mockResolvedValue(checkOutcome(passedReport(), { url: extractUrl, urlExpiry: tomorrow }));
    renderView();

    await vi.waitFor(() => {
        expect(summary().textContent).toContain('goedgekeurd');
    });

    const row = selectedFile().querySelector('.st-list-item')!;
    expect(names(rightClick(row))).toEqual([['Openen in nieuw tabblad', 'Origineel bij FOD Justitie bekijken', 'Downloaden']]);
});

test('Leaves the original out once the day the document prints has passed', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    check.mockResolvedValue(checkOutcome(passedReport(), { url: extractUrl, urlExpiry: twoDaysAgo }));
    renderView();

    await vi.waitFor(() => {
        expect(summary().textContent).toContain('goedgekeurd');
    });

    const row = selectedFile().querySelector('.st-list-item')!;
    expect(names(rightClick(row))).toEqual([['Openen in nieuw tabblad', 'Downloaden']]);
});

test('Offers the same in the menu of the document', async () => {
    renderView({ report: passedReport(), status: JudicialRecordDeliveryStatus.AutoOk, url: extractUrl });

    await vi.waitFor(() => {
        expect(byTestId('pdf-viewer')).not.toBeNull();
    });

    expect(names(rightClick(byTestId('pdf-viewer')!))).toEqual([['Openen in nieuw tabblad', 'Origineel bij FOD Justitie bekijken', 'Downloaden']]);
});

test('Turns the pages of the document with the arrow keys, as far as there are pages', async () => {
    viewerPageCount = 3;
    renderView({ report: passedReport(), status: JudicialRecordDeliveryStatus.AutoOk });

    await vi.waitFor(() => {
        expect(byTestId('pdf-viewer')).not.toBeNull();
    });

    const press = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }));

    press('ArrowLeft');
    expect(goToPage).not.toHaveBeenCalled();

    press('ArrowRight');
    expect(goToPage).toHaveBeenCalledExactlyOnceWith(2);
});
