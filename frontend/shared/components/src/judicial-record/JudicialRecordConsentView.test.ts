import { MemberDetails, MemberWithRegistrationsBlob, Organization, Platform, PlatformFamily, PlatformMember, PlatformPolicy } from '@stamhoofd/structures';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { userEvent } from 'vitest/browser';
import { reactive } from 'vue';
import JudicialRecordConsentView from './JudicialRecordConsentView.vue';

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

function createPlatform(privacyUrl: string | null, privacyName: string) {
    const platform = Platform.create({});
    if (privacyUrl) {
        platform.config.privacy.policies.push(PlatformPolicy.create({ name: privacyName, url: privacyUrl }));
    }
    return platform;
}

function renderView(props: Record<string, unknown> = {}, privacyUrl: string | null = 'https://example.com/privacy', saveHandler = vi.fn().mockResolvedValue(undefined), privacyName = 'Privacyverklaring') {
    return render(JudicialRecordConsentView, {
        props: {
            member: createMember(),
            onBehalfOfMember: false,
            stepNumber: 1,
            stepCount: 3,
            delivery: { file: null, url: null, report: null, status: null },
            saveHandler,
            dismissHandler: vi.fn().mockResolvedValue(undefined),
            ...props,
        },
        global: {
            provide: {
                $context: { platform: createPlatform(privacyUrl, privacyName) },
                reactive_navigation_pop: vi.fn().mockResolvedValue(undefined),
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
}

function continueButton() {
    return document.querySelector<HTMLButtonElement>('[data-testid="judicial-record-continue"]')!;
}

function consentCheckbox() {
    return document.querySelector<HTMLElement>('[data-testid="judicial-record-consent"]')!;
}

test('Explains who sees the document, what for and for how long', () => {
    renderView();

    const text = document.body.textContent ?? '';
    expect(text).toContain('Wie kan het bekijken?');
    expect(text).toContain('Waarvoor?');
    expect(text).toContain('Hoe lang?');
});

test('Cannot continue before giving consent', async () => {
    renderView();

    expect(continueButton().disabled).toBe(true);

    await userEvent.click(consentCheckbox());

    await vi.waitFor(() => {
        expect(continueButton().disabled).toBe(false);
    });
});

test('An administrator confirms the consent of the member instead of giving it', () => {
    renderView({ onBehalfOfMember: true });

    expect(consentCheckbox().textContent).toContain('Simon');
    expect(consentCheckbox().textContent).not.toContain('Ik geef toestemming');

    // What the extract is for is about the member as well, not about the administrator uploading it
    expect(document.body.textContent).toContain('of Simon mag werken met minderjarigen');
});

test('Links the privacy policy of the reviewer', () => {
    renderView({}, 'https://example.com/privacy');

    const link = document.querySelector<HTMLAnchorElement>('a[href="https://example.com/privacy"]')!;
    expect(link).not.toBeNull();
    expect(link.textContent).toContain('Privacyverklaring');
    // Part of the sentence the member agrees to, not a footnote under it
    expect(consentCheckbox().contains(link)).toBe(true);
});

test('Names the privacy policy the way the platform named it', () => {
    renderView({}, 'https://example.com/privacy', undefined, 'Privacybeleid van de koepel');

    expect(document.querySelector<HTMLAnchorElement>('a[href="https://example.com/privacy"]')!.textContent).toBe('Privacybeleid van de koepel');
});

test('Calls a privacy policy without a name a privacy policy', () => {
    renderView({}, 'https://example.com/privacy', undefined, '');

    expect(document.querySelector<HTMLAnchorElement>('a[href="https://example.com/privacy"]')!.textContent).toBe('Privacyverklaring');
});

test('Leaves out the privacy link when nobody published one', () => {
    renderView({}, null);

    expect(document.querySelector('a')).toBeNull();
    expect(document.body.textContent).not.toContain('Privacyverklaring');
});

test('Opening the privacy policy does not tick the consent box', async () => {
    renderView();

    await userEvent.click(document.querySelector<HTMLAnchorElement>('a[href="https://example.com/privacy"]')!);

    expect(document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false);
    expect(continueButton().disabled).toBe(true);
});

test('Continues to the next step once consent is given', async () => {
    const saveHandler = vi.fn().mockResolvedValue(undefined);
    renderView({}, null, saveHandler);

    await userEvent.click(consentCheckbox());
    await userEvent.click(continueButton());

    await vi.waitFor(() => {
        expect(saveHandler).toHaveBeenCalledTimes(1);
    });
});

test('Shows the step number it was given, not one it decided itself', () => {
    renderView({ stepNumber: 2, stepCount: 4 }, null);

    expect(document.body.textContent).toContain('Stap 2 van 4');
});
