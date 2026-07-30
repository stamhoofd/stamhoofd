import { AppManager } from '@stamhoofd/networking/AppManager';
import { afterEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import ShowRecoveryCodesView from '#auth/ShowRecoveryCodesView.vue';
import { printRecoveryCodes } from '#auth/printRecoveryCodes.ts';

// The print dialog of the browser cannot be opened in a test
vi.mock('#auth/printRecoveryCodes.ts', () => ({
    printRecoveryCodes: vi.fn(),
}));

const codes = ['aaaa-1111', 'bbbb-2222'];

function renderView() {
    return render(ShowRecoveryCodesView, {
        props: {
            codes,
        },
        global: {
            // Global properties of the app that are not installed on the test app
            mocks: {
                $t: (globalThis as any).$t,
                STAMHOOFD: (globalThis as any).STAMHOOFD,
            },
        },
    });
}

afterEach(() => {
    AppManager.shared.platform = 'web';
});

test('printing sends the codes to the print dialog', async () => {
    const screen = renderView();

    await screen.getByTestId('print-recovery-codes').click();

    expect(printRecoveryCodes).toHaveBeenCalledWith(codes);
});

test('no print button in the app, because it has no print dialog', async () => {
    AppManager.shared.platform = 'ios';
    const screen = renderView();

    await expect.element(screen.getByTestId('copy-recovery-codes')).toBeVisible();
    expect(document.querySelector('[data-testid="print-recovery-codes"]')).toBeNull();
});
