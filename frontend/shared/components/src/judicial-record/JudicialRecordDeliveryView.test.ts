import { SimpleError } from '@common/errors';
import { Group, GroupPrice, GroupSettings, MemberDetails, MemberWithRegistrationsBlob, Organization, Platform, PlatformFamily, PlatformMember, Registration } from '@stamhoofd/structures';
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { userEvent } from 'vitest/browser';
import { reactive } from 'vue';
import type { NavigationActions } from '../types/NavigationActions';
import { JUDICIAL_RECORD_MAX_PDF_SIZE } from './useJudicialRecordPdfSelection';
import JudicialRecordDeliveryView from './JudicialRecordDeliveryView.vue';

/**
 * The signature check itself is covered by @stamhoofd/pdf-verify-core, which builds its own
 * certificates and signed pdfs for it. What this suite needs is a pdf that passes and one that does
 * not, which no fixture small enough to write here can give: the policy pins FOD Justitie.
 */
vi.mock('@stamhoofd/pdf-verify-core', () => ({
    FOD_JUSTITIE_SIGNATURE_POLICY: { signerName: 'FOD Justitie', maximumFileSize: 20 * 1024 * 1024 },
    verifyPdfSignature: vi.fn(),
}));

const { verifyPdfSignature } = await import('@stamhoofd/pdf-verify-core');
const verify = vi.mocked(verifyPdfSignature);

beforeEach(() => {
    verify.mockReset();
    verify.mockResolvedValue({} as never);
});

function createMember() {
    const platform = Platform.create({});
    const organization = Organization.create({ name: 'KSA Sint-Jan' });
    const family = new PlatformFamily({ platform, contextOrganization: organization });

    const member = new PlatformMember({
        family,
        member: MemberWithRegistrationsBlob.create({
            organizationId: organization.id,
            registrations: [Registration.create({
                organizationId: organization.id,
                groupPrice: GroupPrice.create({}),
                group: Group.create({
                    organizationId: organization.id,
                    settings: GroupSettings.create({}),
                    periodId: 'period',
                }),
            })],
            details: MemberDetails.create({
                firstName: 'Simon',
                lastName: 'Backx',
            }),
        }),
    });
    family.add(member);

    return reactive(member) as unknown as PlatformMember;
}

let saveHandler: ReturnType<typeof vi.fn<(navigate: NavigationActions) => Promise<void>>>;
let delivery: { file: File | null };

function renderView() {
    saveHandler = vi.fn<(navigate: NavigationActions) => Promise<void>>().mockResolvedValue(undefined);
    delivery = { file: null };

    return render(JudicialRecordDeliveryView, {
        props: {
            member: createMember(),
            onBehalfOfMember: false,
            stepNumber: 2,
            stepCount: 3,
            delivery,
            saveHandler,
            dismissHandler: vi.fn().mockResolvedValue(undefined),
        },
        global: {
            provide: {
                reactive_navigation_pop: vi.fn().mockResolvedValue(undefined),
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
}

function dropArea() {
    return document.querySelector<HTMLElement>('[data-testid="judicial-record-pdf-drop-area"]')!;
}

function view() {
    return document.querySelector<HTMLElement>('.judicial-record-delivery-view')!;
}

function createPdf(name = 'uittreksel.pdf', size = 1024) {
    return new File([new Uint8Array(size)], name, { type: 'application/pdf' });
}

function dispatchDrag(type: 'dragenter' | 'dragleave' | 'drop', files: File[] = []) {
    const dataTransfer = new DataTransfer();
    for (const file of files) {
        dataTransfer.items.add(file);
    }
    view().dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
}

test('Shows the requirements of the extract', () => {
    renderView();

    expect(view().textContent).toContain('Model 596.2');
    expect(view().textContent).toContain('Maximaal 1 maand oud');
    expect(view().textContent).toContain('Hoe vraag ik een uittreksel aan?');
    expect(view().textContent).toContain('Dit is gratis.');
});

test('Points at De Ambrassade from the requirement that asks how to get an extract', () => {
    renderView();

    const link = document.querySelector<HTMLAnchorElement>('a[href*="ambrassade"]')!;
    expect(link).not.toBeNull();
    // Part of the answer, so it sits in the list item rather than on its own below the list
    expect(link.closest('.st-list-item')).not.toBeNull();
});

test('Shows the name of a pdf picked from the file dialog', async () => {
    renderView();

    await userEvent.upload(document.querySelector('input[type="file"]')!, createPdf());

    await vi.waitFor(() => {
        expect(dropArea().textContent).toContain('uittreksel.pdf');
    });
    expect(document.querySelector('.error-box')).toBeNull();
});

test('Shows the name of a pdf dropped anywhere on the view', async () => {
    renderView();

    dispatchDrag('drop', [createPdf('model-596-2.pdf')]);

    await vi.waitFor(() => {
        expect(dropArea().textContent).toContain('model-596-2.pdf');
    });
    expect(document.querySelector('.error-box')).toBeNull();
});

test('Hands a pdf that FOD Justitie signed to the next step', async () => {
    renderView();

    const pdf = createPdf();
    dispatchDrag('drop', [pdf]);

    await vi.waitFor(() => {
        expect(saveHandler).toHaveBeenCalledTimes(1);
    });
    expect(delivery.file).toBe(pdf);
    expect(verify).toHaveBeenCalledTimes(1);
});

test('Says the signature is being checked while it runs', async () => {
    verify.mockReturnValue(new Promise(() => {}));
    renderView();

    dispatchDrag('drop', [createPdf()]);

    await vi.waitFor(() => {
        expect(dropArea().textContent).toContain('We controleren de handtekening');
    });
    expect(saveHandler).not.toHaveBeenCalled();
});

test('Keeps a pdf that FOD Justitie did not sign on this machine', async () => {
    verify.mockRejectedValue(new SimpleError({
        code: 'not_signed',
        message: 'Not signed',
        human: 'Dit bestand werd niet ondertekend door FOD Justitie. Kijk na of je het juiste bestand koos.',
    }));
    renderView();

    dispatchDrag('drop', [createPdf('scan.pdf')]);

    await vi.waitFor(() => {
        expect(document.querySelector('.error-box')!.textContent).toContain('niet ondertekend door FOD Justitie');
    });

    expect(saveHandler).not.toHaveBeenCalled();
    expect(delivery.file).toBeNull();

    // Scanning the code on a paper extract arrives with the scanner
    expect(document.querySelector<HTMLButtonElement>('[data-testid="judicial-record-scan-qr"]')!.disabled).toBe(true);
    expect(document.querySelector('[data-testid="judicial-record-choose-other"]')).not.toBeNull();
});

test('Does not check the signature of a file that is not a pdf', async () => {
    renderView();

    dispatchDrag('drop', [new File([new Uint8Array(10)], 'scan.png', { type: 'image/png' })]);

    await vi.waitFor(() => {
        expect(document.querySelector('.error-box')).not.toBeNull();
    });
    expect(verify).not.toHaveBeenCalled();
});

test('Refuses a dropped file that is not a pdf', async () => {
    renderView();

    dispatchDrag('drop', [new File([new Uint8Array(10)], 'scan.png', { type: 'image/png' })]);

    await vi.waitFor(() => {
        expect(document.querySelector('.error-box')).not.toBeNull();
    });
    expect(dropArea().textContent).not.toContain('scan.png');
});

test('Refuses a pdf that is larger than an extract can be', async () => {
    renderView();

    dispatchDrag('drop', [createPdf('groot.pdf', JUDICIAL_RECORD_MAX_PDF_SIZE + 1)]);

    await vi.waitFor(() => {
        expect(document.querySelector('.error-box')).not.toBeNull();
    });
    expect(dropArea().textContent).not.toContain('groot.pdf');
});

test('Highlights the drop area while a file is dragged over the view, including over child elements', async () => {
    renderView();

    dispatchDrag('dragenter');
    // Moving onto a child element fires dragenter on the child before dragleave on the parent
    dispatchDrag('dragenter');
    dispatchDrag('dragleave');

    await vi.waitFor(() => {
        expect(dropArea().classList.contains('dragging')).toBe(true);
    });

    dispatchDrag('dragleave');

    await vi.waitFor(() => {
        expect(dropArea().classList.contains('dragging')).toBe(false);
    });
});

test('Clears the error once a valid pdf is selected', async () => {
    renderView();

    dispatchDrag('drop', [new File([new Uint8Array(10)], 'scan.png', { type: 'image/png' })]);
    await vi.waitFor(() => {
        expect(document.querySelector('.error-box')).not.toBeNull();
    });

    dispatchDrag('drop', [createPdf()]);

    await vi.waitFor(() => {
        expect(document.querySelector('.error-box')).toBeNull();
    });
    expect(dropArea().textContent).toContain('uittreksel.pdf');
});
