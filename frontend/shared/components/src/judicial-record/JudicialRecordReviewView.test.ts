import { JudicialRecordCheck, JudicialRecordCheckReport, JudicialRecordCheckResult, JudicialRecordCheckStatus, JudicialRecordReviewDetails, JudicialRecordReviewDecision, JudicialRecordReviewView as JudicialRecordReviewViewStruct, MemberDetails, MemberJudicialRecord, MemberWithRegistrationsBlob, MembersBlob, Organization, Platform, PlatformFamily, PlatformMember } from '@stamhoofd/structures';
import { SimpleError } from '@common/errors';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { reactive } from 'vue';
import JudicialRecordReviewView from './JudicialRecordReviewView.vue';

/**
 * The checks themselves are covered by @stamhoofd/judicial-record-check, which builds its own signed pdfs for
 * it. Every one of the five leans on a real document from FOD Justitie, so what this suite supplies is a
 * verdict rather than a fixture.
 */
vi.mock('@stamhoofd/judicial-record-check', () => ({
    checkJudicialRecord: vi.fn(),
}));

const { checkJudicialRecord } = await import('@stamhoofd/judicial-record-check');
const check = vi.mocked(checkJudicialRecord);

/** Drawing the pdf is pdfjs's business and has nothing to do with what this view decides. */
vi.mock('@stamhoofd/frontend-pdf-viewer/PdfViewer.vue', () => ({
    default: {
        name: 'PdfViewer',
        props: ['data', 'horizontal', 'fixedHeight'],
        emits: ['error', 'loaded', 'page'],
        template: '<div data-testid="pdf-viewer" />',
        methods: { goToPage: () => undefined },
        mounted(this: { $emit: (event: string, ...args: unknown[]) => void }) {
            this.$emit('loaded', { pageCount: 1 });
        },
    },
}));

const DELIVERED_AT = new Date(2026, 0, 15, 10, 30);
const DOCUMENT = new Uint8Array([1, 2, 3, 4]);

function createReport(statuses: Partial<Record<JudicialRecordCheck, JudicialRecordCheckStatus>>): JudicialRecordCheckReport {
    return JudicialRecordCheckReport.create({
        checks: Object.entries(statuses).map(([check, status]) => JudicialRecordCheckResult.create({
            check: check as JudicialRecordCheck,
            status,
            reason: 'Een reden.',
        })),
    });
}

/** Everything about the document is in order, there is simply something on the record. */
const notEmptyReport = () => createReport({
    [JudicialRecordCheck.Authentic]: JudicialRecordCheckStatus.Passed,
    [JudicialRecordCheck.Model]: JudicialRecordCheckStatus.Passed,
    [JudicialRecordCheck.Identity]: JudicialRecordCheckStatus.Passed,
    [JudicialRecordCheck.Age]: JudicialRecordCheckStatus.Passed,
    [JudicialRecordCheck.EmptyRecord]: JudicialRecordCheckStatus.Failed,
});

beforeEach(() => {
    check.mockReset();
    check.mockResolvedValue({ report: notEmptyReport(), certificatePath: null, extract: null } as never);
});

afterEach(() => {
    vi.restoreAllMocks();
});

function createMember({ hasDocument = true }: { hasDocument?: boolean } = {}) {
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
                birthDay: new Date(Date.UTC(1990, 3, 5)),
            }),
            judicialRecord: MemberJudicialRecord.create({
                reviewDecision: JudicialRecordReviewDecision.UnderReview,
                reviewedAt: null,
                hasDocument,
            }),
        }),
    });
    family.add(member);

    return reactive(member) as unknown as PlatformMember;
}

/**
 * One request handler for the three calls the view makes, told apart by path: what was decided before, the
 * bytes, and the decision going back.
 */
function createRequest({ reviewView, document = DOCUMENT }: { reviewView: JudicialRecordReviewViewStruct | Error; document?: Uint8Array | Error }) {
    return vi.fn().mockImplementation(({ path, method }: { path: string; method: string }) => {
        if (path.endsWith('/judicial-record/review') && method === 'GET') {
            return reviewView instanceof Error
                ? Promise.reject(reviewView)
                : Promise.resolve({ data: reviewView });
        }

        if (path.endsWith('/judicial-record/document')) {
            return document instanceof Error
                ? Promise.reject(document)
                : Promise.resolve({ data: document.buffer });
        }

        if (path.endsWith('/judicial-record/review') && method === 'POST') {
            return Promise.resolve({ data: MembersBlob.create({ members: [], organizations: [] }) });
        }

        throw new Error('Unexpected request ' + method + ' ' + path);
    });
}

function waiting(options: Partial<{ reviewDecision: JudicialRecordReviewDecision; comment: string | null; hasDocument: boolean }> = {}) {
    return JudicialRecordReviewViewStruct.create({
        reviewDecision: options.reviewDecision ?? JudicialRecordReviewDecision.UnderReview,
        reviewDetails: options.comment === undefined
            ? null
            : JudicialRecordReviewDetails.create({ name: 'Benjamin', email: 'benjamin@example.com', comment: options.comment }),
        reviewedAt: null,
        hasDocument: options.hasDocument ?? true,
        deliveredAt: DELIVERED_AT,
    });
}

function renderView({ member = createMember(), reviewView = waiting(), document = DOCUMENT }: {
    member?: PlatformMember;
    reviewView?: JudicialRecordReviewViewStruct | Error;
    document?: Uint8Array | Error;
} = {}) {
    const request = createRequest({ reviewView, document });
    const dismiss = vi.fn().mockResolvedValue(undefined);

    const view = render(JudicialRecordReviewView, {
        props: { member },
        attrs: { style: 'width: 600px;' },
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

    return { view, request, dismiss };
}

function byTestId(testId: string) {
    return document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

function saveButton() {
    return byTestId('save-button') as HTMLButtonElement;
}

function pick(outcome: JudicialRecordReviewDecision) {
    const radio = document.querySelector<HTMLInputElement>(`input[type="radio"][name="judicial-record-outcome"][value="${outcome}"]`)!;
    radio.click();
}

function postedBody(request: ReturnType<typeof vi.fn>) {
    return request.mock.calls.find(([options]) => options.method === 'POST')?.[0].body;
}

test('judges the document on the day it was delivered, not on today', async () => {
    const { view } = renderView();

    await expect.element(view.getByTestId('judicial-record-outcome')).toBeVisible();

    // An extract that waited a fortnight for a reviewer was not out of date when the member handed it in
    expect(check.mock.calls[0][0].atDate).toEqual(DELIVERED_AT);
});

test('tells the reviewer what the checks found, in their words rather than the member’s', async () => {
    const { view } = renderView();

    await expect.element(view.getByTestId('judicial-record-outcome')).toHaveTextContent('Het uittreksel moet beoordeeld worden');
});

test('cannot be saved until an outcome is picked', async () => {
    const { view } = renderView();

    await expect.element(view.getByTestId('judicial-record-outcome')).toBeVisible();
    expect(saveButton().disabled).toBe(true);

    pick(JudicialRecordReviewDecision.Ok);
    await expect.poll(() => saveButton().disabled).toBe(false);
});

test('records the outcome with the comment, trimmed', async () => {
    const { view, request, dismiss } = renderView();

    await expect.element(view.getByTestId('judicial-record-outcome')).toBeVisible();

    pick(JudicialRecordReviewDecision.TemporarilyRejected);

    const comment = byTestId('judicial-record-comment') as HTMLTextAreaElement;
    comment.value = '  Onleesbaar.  ';
    comment.dispatchEvent(new Event('input'));

    await expect.poll(() => saveButton().disabled).toBe(false);
    saveButton().click();

    await expect.poll(() => postedBody(request)).toEqual({
        reviewDecision: JudicialRecordReviewDecision.TemporarilyRejected,
        comment: 'Onleesbaar.',
    });
    await expect.poll(() => dismiss).toHaveBeenCalled();
});

test('refuses a conditional acceptance with no conditions, without asking the backend', async () => {
    const { view, request } = renderView();

    await expect.element(view.getByTestId('judicial-record-outcome')).toBeVisible();

    pick(JudicialRecordReviewDecision.ConditionallyAccepted);
    await expect.poll(() => saveButton().disabled).toBe(false);
    saveButton().click();

    await expect.element(view.getByText('Schrijf op onder welke voorwaarden', { exact: false })).toBeVisible();
    expect(postedBody(request)).toBeUndefined();
});

test('says so when the document is gone, and offers nothing to decide', async () => {
    const { view } = renderView({ reviewView: waiting({ hasDocument: false }) });

    await expect.element(view.getByText('niet meer beschikbaar', { exact: false })).toBeVisible();

    expect(document.querySelector('input[name="judicial-record-outcome"]')).toBeNull();
    expect(saveButton().disabled).toBe(true);
    expect(check).not.toHaveBeenCalled();
});

test('shows what a previous reviewer wrote down, so a second look starts from it', async () => {
    const { view } = renderView({
        reviewView: waiting({ reviewDecision: JudicialRecordReviewDecision.ConditionallyAccepted, comment: 'Nooit alleen met een groep.' }),
    });

    await expect.element(view.getByTestId('judicial-record-outcome')).toBeVisible();

    expect((byTestId('judicial-record-comment') as HTMLTextAreaElement).value).toBe('Nooit alleen met een groep.');
});

test('offers nothing to decide when the document could not be fetched', async () => {
    const { view } = renderView({
        document: new SimpleError({ code: 'judicial_record_document_not_available', message: 'Niet beschikbaar.' }),
    });

    await expect.element(view.getByText('Niet beschikbaar.', { exact: false })).toBeVisible();

    // Saving deletes the extract, so a reviewer who never saw it may not record an outcome
    expect(document.querySelector('input[name="judicial-record-outcome"]')).toBeNull();
    expect(byTestId('judicial-record-comment')).toBeNull();
    expect(saveButton().disabled).toBe(true);
});

test('offers nothing to decide when the review itself could not be fetched', async () => {
    const { view } = renderView({
        reviewView: new SimpleError({ code: 'not_available', message: 'De beoordeling is niet beschikbaar.' }),
    });

    await expect.element(view.getByText('De beoordeling is niet beschikbaar.', { exact: false })).toBeVisible();

    expect(document.querySelector('input[name="judicial-record-outcome"]')).toBeNull();
    expect(saveButton().disabled).toBe(true);
});

test('still lets the reviewer decide when the automatic check crashed, which is not a failed load', async () => {
    check.mockRejectedValue(new Error('pdfjs gave up'));

    const { view } = renderView();

    await expect.element(view.getByText('automatische controle niet uitvoeren', { exact: false })).toBeVisible();

    pick(JudicialRecordReviewDecision.Ok);
    await expect.poll(() => saveButton().disabled).toBe(false);
});
