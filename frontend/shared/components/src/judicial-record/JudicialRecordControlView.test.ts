import { SimpleError } from '@common/errors';
import { JudicialRecordCheck, JudicialRecordCheckReport, JudicialRecordCheckResult, JudicialRecordCheckStatus, JudicialRecordDeliveryResponse, JudicialRecordDeliveryStatus, MemberDetails, MemberWithRegistrationsBlob, Organization, Platform, PlatformFamily, PlatformMember } from '@stamhoofd/structures';
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { userEvent } from 'vitest/browser';
import { reactive } from 'vue';
import JudicialRecordControlView from './JudicialRecordControlView.vue';

/**
 * The checks themselves are covered by @stamhoofd/judicial-record-check, which builds its own signed
 * pdfs for it. What this suite needs is a verdict, which no fixture small enough to write here can
 * produce: every one of the five checks leans on a real document from FOD Justitie.
 */
vi.mock('@stamhoofd/judicial-record-check', () => ({
    checkJudicialRecord: vi.fn(),
}));

/**
 * The viewer draws the pdf with pdfjs, which has nothing to do with what this step decides. What
 * does matter is the error it emits for a document it cannot draw, so the stand-in can emit one.
 */
let viewerFails = false;

vi.mock('@stamhoofd/frontend-pdf-viewer/PdfViewer.vue', () => ({
    default: {
        name: 'PdfViewer',
        props: ['data'],
        emits: ['error'],
        template: '<div data-testid="pdf-viewer" />',
        mounted(this: { $emit: (event: string, ...args: unknown[]) => void }) {
            if (viewerFails) {
                this.$emit('error', new Error('Cannot render'));
            }
        },
    },
}));

const { checkJudicialRecord } = await import('@stamhoofd/judicial-record-check');
const check = vi.mocked(checkJudicialRecord);

beforeEach(() => {
    check.mockReset();
    viewerFails = false;
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

function renderView(request: ReturnType<typeof vi.fn>, isMobile = false) {
    const dismissHandler = vi.fn().mockResolvedValue(undefined);
    const pop = vi.fn().mockResolvedValue(undefined);

    const view = render(JudicialRecordControlView, {
        props: {
            member: createMember(),
            onBehalfOfMember: false,
            stepNumber: 3,
            stepCount: 3,
            delivery: { file: new File([new Uint8Array(1024)], 'uittreksel.pdf', { type: 'application/pdf' }) },
            saveHandler: vi.fn().mockResolvedValue(undefined),
            dismissHandler,
        },
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
                    $isMobile: isMobile,
                    $isPhone: isMobile,
                } as any,
            },
            directives: {
                autofocus: {},
                tooltip: {},
            },
        },
    });

    return { view, dismissHandler, pop };
}

/** What the upload endpoint answers with: the status, and nothing about the checks. */
function deliveryResponse(status: JudicialRecordDeliveryStatus) {
    return { data: JudicialRecordDeliveryResponse.create({ status }) };
}

function root() {
    return document.querySelector<HTMLElement>('.judicial-record-control-view')!;
}

function summary() {
    return document.querySelector<HTMLElement>('[data-testid="judicial-record-summary"]')!;
}

function click(testId: string) {
    document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!.click();
}

test('Runs the checks in the browser as soon as the step opens', async () => {
    check.mockResolvedValue({ report: passedReport(), certificatePath: [] } as never);
    const request = vi.fn().mockResolvedValue(deliveryResponse(JudicialRecordDeliveryStatus.AutoOk));
    renderView(request);

    await vi.waitFor(() => {
        expect(check).toHaveBeenCalledTimes(1);
    });

    const options = check.mock.calls[0][0];
    expect(options.data).toBeInstanceOf(Uint8Array);
    expect(options.firstName).toBe('Simon');
    expect(options.lastName).toBe('Backx');
});

test('Says it is checking while the control runs, and nothing is sent yet', async () => {
    check.mockReturnValue(new Promise(() => {}) as never);
    const request = vi.fn();
    renderView(request);

    await vi.waitFor(() => {
        expect(root().textContent).toContain('We controleren je uittreksel');
    });
    expect(request).not.toHaveBeenCalled();
});

test('Uploads an extract that passed every check without asking, and only offers to close', async () => {
    check.mockResolvedValue({ report: passedReport(), certificatePath: [] } as never);
    const request = vi.fn().mockResolvedValue(deliveryResponse(JudicialRecordDeliveryStatus.AutoOk));
    const { dismissHandler } = renderView(request);

    await vi.waitFor(() => {
        expect(summary().textContent).toContain('goedgekeurd');
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(summary().classList.contains('success-box')).toBe(true);
    expect(document.querySelector('[data-testid="judicial-record-send-anyway"]')).toBeNull();

    click('judicial-record-close');

    await vi.waitFor(() => {
        expect(dismissHandler).toHaveBeenCalledTimes(1);
    });
});

test('Shows the blank check to the member', async () => {
    check.mockResolvedValue({ report: notBlankReport(), certificatePath: [] } as never);
    renderView(vi.fn());

    await vi.waitFor(() => {
        expect(summary()).not.toBeNull();
    });

    await userEvent.click(summary());

    await vi.waitFor(() => {
        expect(root().textContent).toContain('Blanco');
    });
});

test('Warns, but does not refuse, an extract that is real and not blank', async () => {
    check.mockResolvedValue({ report: notBlankReport(), certificatePath: [] } as never);
    const request = vi.fn().mockResolvedValue(deliveryResponse(JudicialRecordDeliveryStatus.Manual));
    renderView(request);

    await vi.waitFor(() => {
        expect(summary().classList.contains('warning-box')).toBe(true);
    });

    // Nothing is sent until the member says so
    expect(request).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="judicial-record-send-anyway"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="judicial-record-retry-upload"]')).not.toBeNull();
});

test('Puts the reason of the first failing check in the box, and advises the scanner for a signature', async () => {
    check.mockResolvedValue({ report: notSignedReport(), certificatePath: null } as never);
    const request = vi.fn();
    renderView(request);

    await vi.waitFor(() => {
        expect(summary().classList.contains('error-box')).toBe(true);
    });

    expect(summary().textContent).toContain('niet ondertekend door FOD Justitie');
    expect(summary().textContent).toContain('QR-code');
    expect(request).not.toHaveBeenCalled();
});

test('Shows the steps behind the box, and the box is gone once they are out', async () => {
    check.mockResolvedValue({ report: notSignedReport(), certificatePath: null } as never);
    renderView(vi.fn());

    await vi.waitFor(() => {
        expect(document.querySelector('[data-testid="judicial-record-show-checks"]')).not.toBeNull();
    });

    await userEvent.click(summary());

    await vi.waitFor(() => {
        expect(root().textContent).toContain('Echt attest van FOD Justitie');
    });
    expect(document.querySelector('[data-testid="judicial-record-summary"]')).toBeNull();
});

test('Always shows the document itself', async () => {
    check.mockResolvedValue({ report: notSignedReport(), certificatePath: null } as never);
    renderView(vi.fn());

    await vi.waitFor(() => {
        expect(document.querySelector('[data-testid="pdf-viewer"]')).not.toBeNull();
    });
});

test('Says so when the document cannot be drawn, without touching the verdict', async () => {
    viewerFails = true;
    check.mockResolvedValue({ report: passedReport(), certificatePath: [] } as never);
    renderView(vi.fn().mockResolvedValue(deliveryResponse(JudicialRecordDeliveryStatus.AutoOk)));

    await vi.waitFor(() => {
        expect(document.querySelector('[data-testid="judicial-record-viewer-error"]')).not.toBeNull();
    });

    // An empty frame under a verdict is the thing this avoids
    expect(document.querySelector('[data-testid="pdf-viewer"]')).toBeNull();
    expect(summary().classList.contains('success-box')).toBe(true);
});

test('Sends in a refused extract anyway when the member asks for it', async () => {
    check.mockResolvedValue({ report: notBlankReport(), certificatePath: [] } as never);
    const request = vi.fn().mockResolvedValue(deliveryResponse(JudicialRecordDeliveryStatus.Manual));
    renderView(request);

    await vi.waitFor(() => {
        expect(document.querySelector('[data-testid="judicial-record-send-anyway"]')).not.toBeNull();
    });

    click('judicial-record-send-anyway');

    await vi.waitFor(() => {
        expect(summary().textContent).toContain('beoordeeld');
    });

    const options = request.mock.calls[0][0];
    expect(options.method).toBe('POST');
    expect(options.path).toMatch(/^\/members\/.+\/judicial-record$/);
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).get('file')).toBeInstanceOf(File);

    // In is in: there is nothing left to try
    expect(document.querySelector('[data-testid="judicial-record-send-anyway"]')).toBeNull();
    expect(document.querySelector('[data-testid="judicial-record-close"]')).not.toBeNull();
});

test('Says what the backend answered, even when the checks were open', async () => {
    check.mockResolvedValue({ report: notBlankReport(), certificatePath: [] } as never);
    const request = vi.fn().mockResolvedValue(deliveryResponse(JudicialRecordDeliveryStatus.Manual));
    renderView(request);

    await vi.waitFor(() => {
        expect(summary()).not.toBeNull();
    });

    // The member reads the checks first and then sends it in anyway
    await userEvent.click(summary());
    await vi.waitFor(() => {
        expect(document.querySelector('[data-testid="judicial-record-summary"]')).toBeNull();
    });

    click('judicial-record-send-anyway');

    // Five rows they have already read are no answer: the box comes back to say what happened
    await vi.waitFor(() => {
        expect(summary().textContent).toContain('beoordeeld');
    });
});

test('Goes back to the delivery step for another document', async () => {
    check.mockResolvedValue({ report: notSignedReport(), certificatePath: null } as never);
    const { pop } = renderView(vi.fn());

    await vi.waitFor(() => {
        expect(document.querySelector('[data-testid="judicial-record-retry-upload"]')).not.toBeNull();
    });

    click('judicial-record-retry-upload');

    await vi.waitFor(() => {
        expect(pop).toHaveBeenCalledTimes(1);
    });
});

test('Says what the backend refused an extract the browser approved of for', async () => {
    check.mockResolvedValue({ report: passedReport(), certificatePath: [] } as never);
    const request = vi.fn().mockRejectedValue(new SimpleError({
        code: 'certificate_revoked',
        message: 'Revoked',
        human: 'Het certificaat van dit uittreksel werd ingetrokken.',
    }));
    renderView(request);

    await vi.waitFor(() => {
        expect(summary().classList.contains('error-box')).toBe(true);
    });

    expect(summary().textContent).toContain('ingetrokken');
    // Both ways out are back: another document, or another attempt
    expect(document.querySelector('[data-testid="judicial-record-send-anyway"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="judicial-record-retry-upload"]')).not.toBeNull();
});

test('Offers another attempt, not insistence, when the delivery never landed', async () => {
    check.mockResolvedValue({ report: passedReport(), certificatePath: [] } as never);
    const request = vi.fn()
        .mockRejectedValueOnce(new SimpleError({
            code: 'revocation_unknown',
            message: 'Unknown',
            human: 'We konden de digitale ondertekening van dit bestand niet volledig controleren. Probeer het later opnieuw.',
        }))
        .mockResolvedValueOnce(deliveryResponse(JudicialRecordDeliveryStatus.AutoOk));
    renderView(request);

    const submit = () => document.querySelector<HTMLButtonElement>('[data-testid="judicial-record-send-anyway"]')!;

    // The buttons are on the screen during the automatic upload too, so wait for the refusal itself
    await vi.waitFor(() => {
        expect(summary().textContent).toContain('niet volledig controleren');
    });

    // A status we could not establish asks to be retried, so that is the button to reach for
    expect(submit().textContent).toContain('Opnieuw proberen');
    expect(submit().classList.contains('primary')).toBe(true);
    expect(document.querySelector('[data-testid="judicial-record-retry-upload"]')!.classList.contains('secundary')).toBe(true);

    submit().click();

    await vi.waitFor(() => {
        expect(summary().textContent).toContain('goedgekeurd');
    });
    expect(request).toHaveBeenCalledTimes(2);
});

test('Keeps the buttons on the screen on a phone', async () => {
    check.mockResolvedValue({ report: notSignedReport(), certificatePath: null } as never);
    renderView(vi.fn(), true);

    await vi.waitFor(() => {
        expect(document.querySelector('[data-testid="judicial-record-retry-upload"]')).not.toBeNull();
    });

    // A long pdf in the viewer would push a button under the page, so it sits in the bottom bar
    expect(document.querySelector('[data-testid="judicial-record-retry-upload"]')!.closest('.st-toolbar')).not.toBeNull();
});
