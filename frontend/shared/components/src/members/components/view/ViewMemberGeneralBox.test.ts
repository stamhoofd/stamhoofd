import { BooleanStatus, MemberDetails, MemberWithRegistrationsBlob, Platform, PlatformFamily, PlatformMember } from '@stamhoofd/structures';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-vue';
import ViewMemberGeneralBox from './ViewMemberGeneralBox.vue';

function createMember() {
    const family = new PlatformFamily({ platform: Platform.create({}) });
    const member = new PlatformMember({
        family,
        member: MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({
                firstName: 'Jan',
                lastName: 'Peeters',
                severeDisability: BooleanStatus.create({ value: true }),
            }),
        }),
    });
    family.add(member);
    return member;
}

function renderBox(hasFullAccess: boolean) {
    return render(ViewMemberGeneralBox, {
        props: {
            member: createMember(),
        },
        global: {
            provide: {
                $context: {
                    auth: {
                        hasFullAccess: () => hasFullAccess,
                    },
                    organization: null,
                },
            },
            config: {
                globalProperties: {
                    $t: (value: string) => value,
                    formatCountry: (country: string) => country,
                    formatDate: (date: Date) => date.toISOString(),
                } as any,
            },
            directives: {
                copyable: {},
                tooltip: {},
            },
        },
    });
}

function severeDisabilityField(): HTMLElement | undefined {
    return Array.from(document.querySelectorAll<HTMLElement>('dt')).find(element => element.textContent?.includes('Zware beperking'));
}

test('shows the severe disability field and its value to full administrators', () => {
    renderBox(true);

    const field = severeDisabilityField();
    expect(field).toBeDefined();
    expect(field?.nextElementSibling?.tagName).toBe('DD');
    expect(field?.nextElementSibling?.textContent).toContain('Aangevinkt');
});

test('hides the severe disability field from users without full access', () => {
    renderBox(false);

    expect(severeDisabilityField()).toBeUndefined();
});
