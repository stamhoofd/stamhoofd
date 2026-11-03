import { SimpleError } from '@common/errors';
import { JudicialRecordCheck, JudicialRecordCheckReport, JudicialRecordCheckResult, JudicialRecordCheckStatus, MemberDetails, MemberWithRegistrationsBlob, Organization, Platform, PlatformFamily, PlatformMember } from '@stamhoofd/structures';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { reactive } from 'vue';
import JudicialRecordResultView from './JudicialRecordResultView.vue';

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

function renderView(request: ReturnType<typeof vi.fn>, dismissHandler = vi.fn().mockResolvedValue(undefined), pop = vi.fn().mockResolvedValue(undefined)) {
    const view = render(JudicialRecordResultView, {
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

function root() {
    return document.querySelector<HTMLElement>('.judicial-record-result-view')!;
}

function click(testId: string) {
    document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!.click();
}

test('Delivers the chosen pdf as soon as the step opens', async () => {
    const request = vi.fn().mockResolvedValue({ data: passedReport() });
    renderView(request);

    await vi.waitFor(() => {
        expect(request).toHaveBeenCalledTimes(1);
    });

    const options = request.mock.calls[0][0];
    expect(options.method).toBe('POST');
    expect(options.path).toMatch(/^\/members\/.+\/judicial-record$/);
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).get('file')).toBeInstanceOf(File);
});

test('Shows the checks without a verdict while the control runs', async () => {
    // A request that never answers: the step is in the state it has while the control runs
    const request = vi.fn().mockReturnValue(new Promise(() => {}));
    renderView(request);

    await vi.waitFor(() => {
        expect(root().textContent).toContain('We controleren je uittreksel');
    });

    expect(root().textContent).toContain('Echt attest van FOD Justitie');
    expect(root().textContent).toContain('Naam en geboortedatum');
});

test('Never shows the member whether their record is blank', async () => {
    const request = vi.fn().mockResolvedValue({ data: passedReport() });
    renderView(request);

    await vi.waitFor(() => {
        expect(root().textContent).toContain('Je uittreksel is goedgekeurd');
    });

    expect(root().textContent).not.toContain('Blanco');
});

test('Leaves the flow when the member closes an approved delivery', async () => {
    const request = vi.fn().mockResolvedValue({ data: passedReport() });
    const { dismissHandler } = renderView(request);

    await vi.waitFor(() => {
        expect(root().textContent).toContain('Je uittreksel is goedgekeurd');
    });

    click('judicial-record-close');

    await vi.waitFor(() => {
        expect(dismissHandler).toHaveBeenCalledTimes(1);
    });
});

test('Says what refused the document and offers to deliver another one', async () => {
    const request = vi.fn().mockResolvedValue({
        data: createReport({
            [JudicialRecordCheck.Authentic]: JudicialRecordCheckStatus.Passed,
            [JudicialRecordCheck.Identity]: JudicialRecordCheckStatus.Failed,
            [JudicialRecordCheck.Model]: JudicialRecordCheckStatus.Passed,
            [JudicialRecordCheck.Age]: JudicialRecordCheckStatus.Passed,
            [JudicialRecordCheck.Blank]: JudicialRecordCheckStatus.Passed,
        }, {
            [JudicialRecordCheck.Identity]: 'Komen niet overeen met ‘Simon Backx’',
        }),
    });
    const { pop } = renderView(request);

    await vi.waitFor(() => {
        expect(root().textContent).toContain('We konden je uittreksel niet automatisch goedkeuren');
    });

    expect(root().textContent).toContain('Komen niet overeen met ‘Simon Backx’');

    // Sending it in anyway keeps the document for a reviewer, and nothing is kept yet
    expect(document.querySelector<HTMLButtonElement>('[data-testid="judicial-record-send-anyway"]')!.disabled).toBe(true);

    // Back to the delivery step, which is the step right below this one
    click('judicial-record-retry-upload');

    await vi.waitFor(() => {
        expect(pop).toHaveBeenCalledTimes(1);
    });
});

test('A request that never got an answer can be retried without picking the pdf again', async () => {
    const request = vi.fn()
        .mockRejectedValueOnce(new SimpleError({ code: 'network_error', message: 'Geen verbinding' }))
        .mockResolvedValueOnce({ data: passedReport() });

    renderView(request);

    await vi.waitFor(() => {
        expect(document.querySelector('.error-box')).not.toBeNull();
    });

    click('judicial-record-retry');

    await vi.waitFor(() => {
        expect(root().textContent).toContain('Je uittreksel is goedgekeurd');
    });
    expect(request).toHaveBeenCalledTimes(2);
});
