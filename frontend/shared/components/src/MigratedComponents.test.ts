/* eslint-disable vue/one-component-per-file */
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { Organization, Webshop } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { userEvent } from 'vitest/browser';
import { defineComponent, ref } from 'vue';
import TestAppWithModalStackComponent from '../tests/helpers/TestAppWithModalStackComponent.vue';

import OrganizationLogo from './context/OrganizationLogo.vue';
import STErrorsDefault from './errors/STErrorsDefault.vue';
import STInputBox from './inputs/STInputBox.vue';
import LoadingButton from './navigation/LoadingButton.vue';
import LoadingInputBox from './navigation/LoadingInputBox.vue';
import STNavigationBar from './navigation/STNavigationBar.vue';
import STNavigationTitle from './navigation/STNavigationTitle.vue';
import { Toast, ToastButton } from './overlays/Toast';
import ToastBox from './overlays/ToastBox.vue';
import ToastView from './overlays/ToastView.vue';
import AddDiscountCodeBox from './views/AddDiscountCodeBox.vue';

function renderComponent(component: any, props: Record<string, unknown> = {}, slots?: Record<string, string>, extra: Record<string, unknown> = {}) {
    return render(component, {
        props,
        slots,
        global: {
            provide: {
                reactive_navigation_pop: vi.fn().mockResolvedValue(undefined),
                reactive_navigation_dismiss: vi.fn().mockResolvedValue(undefined),
                reactive_navigation_present: vi.fn().mockResolvedValue(undefined),
                reactive_navigation_push: vi.fn().mockResolvedValue(undefined),
                ...extra,
            },
            config: {
                globalProperties: {
                    $t: (value: string, replacements?: Record<string, string>) => replacements?.organization ?? value,
                    $isMobile: false,
                    $context: (extra as any).$context,
                } as any,
            },
            directives: {
                autofocus: {},
                tooltip: {},
            },
        },
    });
}

test('OrganizationLogo uses the organization identity unless the webshop opts into its own logo', async () => {
    const organization = Organization.create({ name: 'Scouts Gent' });
    const webshop = Webshop.create({});
    webshop.meta.name = 'Weekendwinkel';
    webshop.meta.useLogo = false;

    const result = renderComponent(OrganizationLogo, { organization, webshop });
    expect(document.querySelector('.organization-logo-text')?.textContent).toBe('Scouts Gent');

    const webshopWithLogo = Webshop.create({});
    webshopWithLogo.meta.name = 'Weekendwinkel';
    webshopWithLogo.meta.useLogo = true;
    await result.rerender({ organization, webshop: webshopWithLogo });
    expect(document.querySelector('.organization-logo-text')?.textContent).toBe('Weekendwinkel');
});

test('LoadingButton keeps the spinner briefly after loading finishes', async () => {
    const result = renderComponent(LoadingButton, { loading: false }, { default: '<button>Opslaan</button>' });
    expect(document.querySelector('.spinner-container')).toBeNull();

    await result.rerender({ loading: true });
    expect(document.querySelector('.loading-button.loading')).not.toBeNull();
    expect(document.querySelector('.spinner-container')).not.toBeNull();

    await result.rerender({ loading: false });
    expect(document.querySelector('.loading-button.loading')).toBeNull();
    expect(document.querySelector('.spinner-container')).not.toBeNull();

    await vi.waitFor(() => expect(document.querySelector('.spinner-container')).toBeNull(), { timeout: 800 });
});

test('LoadingInputBox swaps its real input for a disabled loading input', async () => {
    const result = renderComponent(LoadingInputBox, { loading: false }, {
        default: '<input data-testid="real-input" value="Klaar">',
    });
    expect(document.querySelector('[data-testid="real-input"]')).not.toBeNull();

    await result.rerender({ loading: true });
    const loadingInput = document.querySelector<HTMLInputElement>('input.with-spinner')!;
    expect(loadingInput.disabled).toBe(true);
    expect(document.querySelector('[data-testid="real-input"]')).toBeNull();

    await result.rerender({ loading: false });
    expect(document.querySelector('input.with-spinner')).not.toBeNull();
    await vi.waitFor(() => expect(document.querySelector('[data-testid="real-input"]')).not.toBeNull(), { timeout: 800 });
});

test('STNavigationTitle renders consumer content as the page heading', () => {
    renderComponent(STNavigationTitle, {}, { default: 'Instellingen' });
    const heading = document.querySelector('h1');
    expect(heading?.textContent).toBe('Instellingen');
    expect(heading?.classList.contains('st-navigation-title')).toBe(true);
});

test('ToastView runs the toast action and closes after a user click', async () => {
    const action = vi.fn();
    const onClose = vi.fn();
    const pop = vi.fn().mockResolvedValue(undefined);
    const toast = new Toast('Opgeslagen').setAction(action).setHide(null);
    renderComponent(ToastView, { toast, onClose }, undefined, {
        reactive_navigation_pop: pop,
    });

    await userEvent.click(document.querySelector('.toast-view')!);

    expect(action).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(pop).toHaveBeenCalledTimes(1);
});

test('ToastView runs a button action without also running the toast action', async () => {
    const action = vi.fn();
    const buttonAction = vi.fn();
    const toast = new Toast('Download klaar')
        .setAction(action)
        .setButton(new ToastButton('Download', buttonAction))
        .setHide(null);
    renderComponent(ToastView, { toast });

    await userEvent.click(document.querySelector('.toast-view .button')!);

    expect(buttonAction).toHaveBeenCalledTimes(1);
    expect(action).not.toHaveBeenCalled();
});

test('ToastBox shows and removes real toasts through the listener lifecycle', async () => {
    const result = renderComponent(ToastBox);
    const toast = new Toast('Netwerk hersteld').setHide(null).setWithOffset();

    toast.show();
    await vi.waitFor(() => {
        expect(document.querySelector('.toast-view')?.textContent).toContain('Netwerk hersteld');
        expect(document.querySelector('.toast-box.withOffset')).not.toBeNull();
    });

    await userEvent.click(document.querySelector('.toast-view')!);
    await vi.waitFor(() => expect(document.querySelector('.toast-view')).toBeNull());

    await result.unmount();
});

test('ToastBox preserves its public tagged-component hide behavior', async () => {
    const Child = defineComponent({
        template: '<div data-testid="tagged-component">Tagged</div>',
    });
    const Harness = defineComponent({
        components: { ToastBox },
        setup() {
            const box = ref<InstanceType<typeof ToastBox> | null>(null);
            const show = () => box.value?.show(new ComponentWithProperties(Child, { tags: ['sync'] }));
            const hide = () => box.value?.hide('sync');
            return { box, hide, show };
        },
        template: `
            <button data-testid="show-tagged" @click="show">Show</button>
            <button data-testid="hide-tagged" @click="hide">Hide</button>
            <ToastBox ref="box" />
        `,
    });
    renderComponent(Harness);

    await userEvent.click(document.querySelector('[data-testid="show-tagged"]')!);
    await vi.waitFor(() => expect(document.querySelector('[data-testid="tagged-component"]')).not.toBeNull());
    await userEvent.click(document.querySelector('[data-testid="hide-tagged"]')!);
    await vi.waitFor(() => expect(document.querySelector('[data-testid="tagged-component"]')).toBeNull());
});

test('LoginView reacts to a realistically typed developer email', async () => {
    TestUtils.setEnvironment('userMode', 'organization');
    render(TestAppWithModalStackComponent, {
        props: {
            root: AsyncComponent(() => import('./auth/LoginView.vue'), {}),
        },
        global: {
            config: {
                globalProperties: {
                    $t: (value: string) => value,
                    STAMHOOFD,
                } as any,
            },
            directives: {
                autofocus: {},
            },
            components: {
                LoadingButton,
                STErrorsDefault,
                STInputBox,
                STNavigationBar,
            },
        },
    });

    const email = document.querySelector<HTMLInputElement>('[data-testid="email-input"]')!;
    const password = document.querySelector<HTMLInputElement>('[data-testid="password-input"]')!;

    await userEvent.click(email);
    await userEvent.keyboard('stamhoofd@dev.dev');
    await userEvent.click(password);

    await vi.waitFor(() => expect(document.querySelector('.version-footer')).not.toBeNull());
});

test('AddDiscountCodeBox cleans and applies a code through the visible user flow', async () => {
    const applyCode = vi.fn().mockResolvedValue(true);
    renderComponent(AddDiscountCodeBox, { applyCode });

    await userEvent.click(document.querySelector<HTMLButtonElement>('button')!);

    const input = document.querySelector<HTMLInputElement>('input[type="text"]')!;
    await userEvent.click(input);
    await userEvent.keyboard('  Summer Deal  ');
    await userEvent.click(document.querySelector<HTMLButtonElement>('button[type="submit"]')!);

    await vi.waitFor(() => expect(applyCode).toHaveBeenCalledWith('SUMMER-DEAL'));
    await vi.waitFor(() => expect(document.querySelector('form')).toBeNull());
});
