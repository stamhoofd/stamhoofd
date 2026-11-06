import { ComponentWithProperties } from '@browser/navigation';
import { Group, GroupPrice, GroupSettings, JudicialRecordCheckReport, JudicialRecordDeliveryStatus, MemberDetails, MemberWithRegistrationsBlob, Organization, Platform, PlatformFamily, PlatformMember, Registration } from '@stamhoofd/structures';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { userEvent } from 'vitest/browser';
import { defineComponent, h, KeepAlive, reactive, ref } from 'vue';
import type { NavigationActions } from '../types/NavigationActions';
import { JUDICIAL_RECORD_MAX_PDF_SIZE } from './useJudicialRecordPdfSelection';
import JudicialRecordDeliveryView from './JudicialRecordDeliveryView.vue';
import type { JudicialRecordDelivery } from './JudicialRecordStepProps';

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
let present: ReturnType<typeof vi.fn>;
let delivery: JudicialRecordDelivery;

/**
 * With `shown`, the step is rendered in a KeepAlive the way a navigation controller keeps it: hidden
 * while a later step is on top, and activated again when the member comes back to it.
 */
function renderView(member = createMember(), { isMobile = false, shown }: { isMobile?: boolean; shown?: ReturnType<typeof ref<boolean>> } = {}) {
    saveHandler = vi.fn<(navigate: NavigationActions) => Promise<void>>().mockResolvedValue(undefined);
    present = vi.fn().mockResolvedValue(undefined);
    delivery = { file: null, url: null, report: null, status: null };

    const props = {
        member,
        onBehalfOfMember: false,
        stepNumber: 2,
        stepCount: 3,
        delivery,
        saveHandler,
        dismissHandler: vi.fn().mockResolvedValue(undefined),
    };

    const component = shown
        ? defineComponent({
            setup: () => () => h(KeepAlive, null, [shown.value ? h(JudicialRecordDeliveryView, { ...props, key: 'delivery' }) : h('div', { key: 'next' })]),
        })
        : JudicialRecordDeliveryView;

    return render(component as typeof JudicialRecordDeliveryView, {
        props: shown ? undefined : props,
        global: {
            provide: {
                reactive_navigation_pop: vi.fn().mockResolvedValue(undefined),
                reactive_navigation_dismiss: vi.fn().mockResolvedValue(undefined),
                reactive_navigation_present: present,
                reactive_navigation_push: vi.fn().mockResolvedValue(undefined),
            },
            config: {
                globalProperties: {
                    $t: (globalThis as any).$t,
                    STAMHOOFD: (globalThis as any).STAMHOOFD,
                    $isMobile: isMobile,
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

function dropArea() {
    return document.querySelector<HTMLElement>('[data-testid="judicial-record-pdf-drop-area"]');
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
    expect(view().textContent).toContain('Het originele document');
    expect(view().textContent).toContain('Gratis aan te vragen');
    expect(view().textContent).toContain('het moet voldoen aan deze voorwaarden:');
});

test('Points at De Ambrassade for how to get an extract', () => {
    renderView();

    const link = document.querySelector<HTMLAnchorElement>('a[href*="ambrassade"]')!;
    expect(link).not.toBeNull();
    expect(link.textContent!.trim()).toBe('Hoe vraag ik een uittreksel aan?');
    expect(link.target).toBe('_blank');
});

test('Offers both ways to deliver an extract', () => {
    renderView();

    expect(dropArea()).not.toBeNull();
    expect(document.querySelector('[data-testid="judicial-record-scan-qr"]')).not.toBeNull();
});

for (const isMobile of [false, true]) {
    test(`Offers both methods as buttons, in the toolbar only on a phone (${isMobile ? 'phone' : 'wide'})`, async () => {
        renderView(createMember(), { isMobile });

        // Like the other steps: below the content on a wider screen, in the toolbar on a phone
        expect(document.querySelector('.st-toolbar') !== null).toBe(isMobile);
        const buttons = document.querySelector<HTMLElement>(isMobile ? '.st-toolbar' : 'main .style-button-bar')!;
        const upload = buttons.querySelector('[data-testid="judicial-record-pdf-upload"]')!;
        expect(upload.classList.contains('primary')).toBe(true);
        expect(upload.textContent!.trim()).toBe('Bestand kiezen');
        expect(buttons.querySelector('[data-testid="judicial-record-scan-qr"]')).not.toBeNull();

        // Nothing gets dragged on a phone, so the drop zone is only there on a wider screen
        expect(dropArea() !== null).toBe(!isMobile);

        await userEvent.upload(document.querySelector('input[type="file"]')!, createPdf());

        await vi.waitFor(() => {
            expect(saveHandler).toHaveBeenCalledTimes(1);
        });
    });
}

test('Hands a pdf picked from the file dialog to the next step', async () => {
    renderView();

    const pdf = createPdf();
    await userEvent.upload(document.querySelector('input[type="file"]')!, pdf);

    await vi.waitFor(() => {
        expect(saveHandler).toHaveBeenCalledTimes(1);
    });
    expect(delivery.file?.name).toBe(pdf.name);
    expect(document.querySelector('.error-box')).toBeNull();
});

test('Hands a pdf dropped anywhere on the view to the next step', async () => {
    renderView();

    const pdf = createPdf('model-596-2.pdf');
    dispatchDrag('drop', [pdf]);

    await vi.waitFor(() => {
        expect(saveHandler).toHaveBeenCalledTimes(1);
    });
    expect(delivery.file).toBe(pdf);
    expect(document.querySelector('.error-box')).toBeNull();
});

for (const [description, file] of [
    ['a file that is not a pdf', new File([new Uint8Array(10)], 'scan.png', { type: 'image/png' })],
    ['a pdf that is larger than an extract can be', createPdf('groot.pdf', JUDICIAL_RECORD_MAX_PDF_SIZE + 1)],
] as const) {
    test(`Hands ${description} to the next step as well, which says what is wrong with it`, async () => {
        renderView();

        dispatchDrag('drop', [file]);

        await vi.waitFor(() => {
            expect(saveHandler).toHaveBeenCalledTimes(1);
        });
        expect(delivery.file).toBe(file);
        expect(document.querySelector('.error-box')).toBeNull();
    });
}

test('Forgets what the step after it found about an earlier file', async () => {
    renderView();
    delivery.url = 'https://just-crimeviewer-ctz.just.fgov.be/record/earlier';
    delivery.report = JudicialRecordCheckReport.create({});
    delivery.status = JudicialRecordDeliveryStatus.Manual;

    const pdf = createPdf();
    dispatchDrag('drop', [pdf]);

    await vi.waitFor(() => {
        expect(saveHandler).toHaveBeenCalledTimes(1);
    });
    expect(delivery.file).toBe(pdf);
    // A picked file comes from nowhere FOD Justitie serves it, until the control step reads it off the document
    expect(delivery.url).toBeNull();
    expect(delivery.report).toBeNull();
    expect(delivery.status).toBeNull();
});

test('Opens the scanner on top of this step', async () => {
    renderView();

    await userEvent.click(document.querySelector<HTMLElement>('[data-testid="judicial-record-scan-qr"]')!);

    await vi.waitFor(() => {
        expect(present).toHaveBeenCalledTimes(1);
    });
    // Nothing is delivered by opening it, and the step it was opened from stays below it
    expect(saveHandler).not.toHaveBeenCalled();
});

/** The properties the scanner that was presented got, once its component is loaded */
async function presentedScanner() {
    const controller = present.mock.calls[0][0].components[0] as ComponentWithProperties;
    const root = controller.properties.root as ComponentWithProperties;
    const scanner = await (root.properties.promise as () => Promise<ComponentWithProperties>)();
    return scanner.properties as { selectHandler: (file: File, url: string) => Promise<void> };
}

test('Hands the extract the scanner fetched to the next step, with the link it came from', async () => {
    renderView();

    await userEvent.click(document.querySelector<HTMLElement>('[data-testid="judicial-record-scan-qr"]')!);

    await vi.waitFor(() => {
        expect(present).toHaveBeenCalledTimes(1);
    });

    const pdf = createPdf();
    const url = 'https://just-crimeviewer-ctz.just.fgov.be/record/123e4567-e89b-12d3-a456-426614174000-CJCS';
    await (await presentedScanner()).selectHandler(pdf, url);

    expect(saveHandler).toHaveBeenCalledTimes(1);
    expect(delivery.file).toBe(pdf);
    expect(delivery.url).toBe(url);
});

test('Highlights the drop area while a file is dragged over the view, including over child elements', async () => {
    renderView();

    dispatchDrag('dragenter');
    // Moving onto a child element fires dragenter on the child before dragleave on the parent
    dispatchDrag('dragenter');
    dispatchDrag('dragleave');

    await vi.waitFor(() => {
        expect(dropArea()!.classList.contains('dragging')).toBe(true);
    });

    dispatchDrag('dragleave');

    await vi.waitFor(() => {
        expect(dropArea()!.classList.contains('dragging')).toBe(false);
    });
});

test('Starts over when the member comes back to this step', async () => {
    const shown = ref(true);
    renderView(createMember(), { shown });

    dispatchDrag('drop', [createPdf()]);

    await vi.waitFor(() => {
        expect(saveHandler).toHaveBeenCalledTimes(1);
    });

    // The next step is on top, and checks and sends the extract in
    shown.value = false;
    await vi.waitFor(() => {
        expect(view()).toBeNull();
    });
    delivery.url = 'https://just-crimeviewer-ctz.just.fgov.be/record/earlier';
    delivery.report = JudicialRecordCheckReport.create({});
    delivery.status = JudicialRecordDeliveryStatus.AutoOk;

    // The member goes back
    shown.value = true;

    await vi.waitFor(() => {
        expect(delivery.file).toBeNull();
    });
    expect(delivery.url).toBeNull();
    expect(delivery.report).toBeNull();
    expect(delivery.status).toBeNull();
    expect(dropArea()).not.toBeNull();
});
