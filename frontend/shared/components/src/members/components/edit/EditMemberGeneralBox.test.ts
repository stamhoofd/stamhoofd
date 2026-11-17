import { OrganizationPrivateMetaData, Platform } from '@stamhoofd/structures';
import { Language } from '@stamhoofd/types/Language';
import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-vue';
import Checkbox from '#inputs/Checkbox.vue';
import STListItem from '#layout/STListItem.vue';
import STErrorsDefault from '../../../errors/STErrorsDefault.vue';
import { Validator } from '../../../errors/Validator';
import Radio from '../../../inputs/Radio.vue';
import STInputBox from '../../../inputs/STInputBox.vue';
import type { TaxCertificateMemberOptions } from '../../testing/createTaxCertificateMember';
import { createTaxCertificateMember } from '../../testing/createTaxCertificateMember';
import EditMemberGeneralBox from './EditMemberGeneralBox.vue';

function renderBox(options: TaxCertificateMemberOptions & { featureFlags?: string[]; app?: string } = {}) {
    const { member, organization } = createTaxCertificateMember(options);
    organization.language = Language.Dutch;
    organization.privateMeta = OrganizationPrivateMetaData.create({ featureFlags: options.featureFlags ?? [] });

    render(EditMemberGeneralBox, {
        props: {
            member,
            validator: new Validator(),
        },
        global: {
            components: {
                Radio,
                Checkbox,
                STErrorsDefault,
                STInputBox,
                STListItem,
            },
            provide: {
                $context: {
                    auth: {
                        canAccessPlatformMember: () => true,
                        hasFullAccess: () => true,
                        hasPlatformFullAccess: () => true,
                    },
                    organization,
                    platform: Platform.create({}),
                    user: null,
                },
                stamhoofd_app: options.app ?? 'dashboard',
            },
            config: {
                globalProperties: {
                    $t: (globalThis as any).$t,
                    formatDate: (date: Date) => date.toISOString(),
                } as any,
            },
            directives: {
                'format-input': {},
                'tooltip': {},
            },
        },
    });

    return { member };
}

function memberNumberInput(): HTMLInputElement | null {
    return document.querySelector<HTMLInputElement>('input[data-testid="member-number-input"]');
}

function nationalRegisterNumberInput(): HTMLInputElement | null {
    return document.querySelector<HTMLInputElement>('input[data-testid="member-nrn-input"]');
}

test('asks the national register number when the organization collects it', () => {
    renderBox({ taxCertificates: false, nationalRegisterNumberEnabled: true });

    expect(nationalRegisterNumberInput()).not.toBeNull();
});

test('a stored number stays editable when the organization stopped collecting it', () => {
    renderBox({ taxCertificates: false, nationalRegisterNumber: '15.04.20-001.62' });

    expect(nationalRegisterNumberInput()?.value).toBe('15.04.20-001.62');
});

test('leaves the number to the tax certificate section when that is collected', () => {
    renderBox({ taxCertificates: true, nationalRegisterNumberEnabled: true });

    expect(nationalRegisterNumberInput()).toBeNull();
});

test('does not ask the number of a new member yet', () => {
    renderBox({ taxCertificates: false, nationalRegisterNumberEnabled: true, isNew: true });

    expect(nationalRegisterNumberInput()).toBeNull();
});

test('hides the member number without the feature flag', () => {
    renderBox();

    expect(memberNumberInput()).toBeNull();
});

test('hides the member number for members editing their own data', () => {
    renderBox({ featureFlags: ['edit-member-number'], app: 'registration' });

    expect(memberNumberInput()).toBeNull();
});

test('admins can set a member number when the member has none', async () => {
    const { member } = renderBox({ featureFlags: ['edit-member-number'] });

    const input = memberNumberInput()!;
    expect(input.value).toBe('');

    await userEvent.fill(input, ' 12345 ');
    expect(member.patchedMember.details.memberNumber).toBe('12345');
});

test('clearing the member number removes it', async () => {
    const { member } = renderBox({ featureFlags: ['edit-member-number'] });
    member.addDetailsPatch({ memberNumber: '12345' });

    await userEvent.clear(memberNumberInput()!);
    expect(member.patchedMember.details.memberNumber).toBeNull();
});
