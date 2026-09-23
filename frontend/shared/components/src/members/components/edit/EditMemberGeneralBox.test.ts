import { Language } from '@stamhoofd/types/Language';
import { expect, test } from 'vitest';
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

function renderBox(options: TaxCertificateMemberOptions = {}) {
    const { member, organization } = createTaxCertificateMember(options);
    organization.language = Language.Dutch;

    return render(EditMemberGeneralBox, {
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
                    },
                    organization,
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
                'format-input': {},
                'tooltip': {},
            },
        },
    });
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
