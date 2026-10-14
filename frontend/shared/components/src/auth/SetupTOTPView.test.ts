import { MFAManager } from '@stamhoofd/networking/MFAManager';
import { SessionContext } from '@stamhoofd/networking/SessionContext';
import { MFAEnrollmentResult, Platform, TOTPSetupResponse } from '@stamhoofd/structures';
import { flushPromises, shallowMount } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { shallowRef } from 'vue';
import CodeInput from '#inputs/CodeInput.vue';
import type { FreshAction } from './FreshAction';
import SetupTOTPView from './SetupTOTPView.vue';

afterEach(() => vi.restoreAllMocks());

test('TOTP confirmation passes the local session and current navigation to the fresh-action handler', async () => {
    const context = new SessionContext(null, Platform.create({}));
    const result = MFAEnrollmentResult.create({});
    const confirm = vi.spyOn(MFAManager, 'confirmTotp').mockResolvedValue(result);
    const apply = vi.spyOn(MFAManager, 'applyEnrollmentResult').mockResolvedValue(undefined);
    const freshOptions = vi.fn<(options: Parameters<FreshAction>[1]) => void>();
    const runFresh: FreshAction = async (action, options) => {
        freshOptions(options);
        return action();
    };
    const onCompleted = vi.fn();
    const show = vi.fn();
    const present = vi.fn();
    const wrapper = shallowMount(SetupTOTPView, {
        props: {
            totpSetup: TOTPSetupResponse.create({ totpId: 'temporary-totp', secret: 'secret', otpauthUri: 'otpauth://totp/test' }),
            setupToken: 'temporary-setup-token',
            runFresh,
            onCompleted,
        },
        global: {
            renderStubDefaultSlot: true,
            mocks: { $t, $isIOS: true },
            provide: {
                $context: context,
                reactive_navigation_show: show,
                reactive_navigation_present: present,
                reactive_navigationController: shallowRef(null),
            },
            stubs: { I18nComponent: true },
            directives: { 'submit-last-field': {}, 'copyable': {} },
        },
    });
    wrapper.findComponent(CodeInput).vm.$emit('update:modelValue', '123456');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(freshOptions).toHaveBeenCalledOnce();
    const options = freshOptions.mock.calls[0][0]!;
    expect(options.context).toBe(context);
    await options.navigation.show({ components: [] });
    await options.navigation.present({ components: [] });
    expect(show).toHaveBeenCalledOnce();
    expect(present).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledWith(context, 'temporary-totp', '123456', '', 'temporary-setup-token');
    expect(apply).toHaveBeenCalledWith(context, result);
    expect(onCompleted).toHaveBeenCalledWith(options.navigation);
    wrapper.unmount();
});
