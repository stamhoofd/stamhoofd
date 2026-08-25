import { BooleanStatus, MemberDetails, MemberWithRegistrationsBlob, Platform, PlatformFamily, PlatformMember } from '@stamhoofd/structures';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-vue';
import STErrorsDefault from '../../../errors/STErrorsDefault.vue';
import { Validator } from '../../../errors/Validator';
import Radio from '../../../inputs/Radio.vue';
import STInputBox from '../../../inputs/STInputBox.vue';
import EditMemberGeneralBox from './EditMemberGeneralBox.vue';

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
    return render(EditMemberGeneralBox, {
        props: {
            member: createMember(),
            validator: new Validator(),
        },
        global: {
            components: {
                Radio,
                STErrorsDefault,
                STInputBox,
            },
            provide: {
                $context: {
                    auth: {
                        canAccessPlatformMember: () => true,
                        hasFullAccess: () => hasFullAccess,
                    },
                    organization: null,
                    user: null,
                },
                stamhoofd_app: 'dashboard',
            },
            config: {
                globalProperties: {
                    $t: (value: string) => value,
                    formatDate: (date: Date) => date.toISOString(),
                } as any,
            },
            directives: {
                tooltip: {},
            },
        },
    });
}

function severeDisabilityCheckbox(): HTMLInputElement | undefined {
    const label = Array.from(document.querySelectorAll('label')).find(element => element.textContent?.includes('zware beperking'));
    return label?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? undefined;
}

test('shows the severe disability checkbox and its value to full administrators', () => {
    renderBox(true);

    expect(severeDisabilityCheckbox()?.checked).toBe(true);
});

test('hides the severe disability checkbox from users without full access', () => {
    renderBox(false);

    expect(severeDisabilityCheckbox()).toBeUndefined();
});
