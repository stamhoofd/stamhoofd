import { SessionContext } from '@stamhoofd/frontend-session/SessionContext';
import { Platform } from '@stamhoofd/structures';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { configureApplicationPresentation, getApplicationPresentation } from './ApplicationPresentation';
import { GlobalEventBus } from './EventBus';
import { ThemeManager } from './ThemeManager';

describe('theme presentation', () => {
    let restore: ReturnType<typeof getApplicationPresentation>;
    const setPrimaryColor = vi.fn();

    beforeEach(() => {
        restore = getApplicationPresentation();
        configureApplicationPresentation({ setPrimaryColor });
    });

    afterEach(() => {
        configureApplicationPresentation(restore);
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    test('applies the current color and follows platform changes', () => {
        const platform = Platform.create({});
        platform.config.color = '#123456';
        const session = new SessionContext(null, platform);
        const send = vi.spyOn(GlobalEventBus, 'sendEvent').mockResolvedValue([]);
        const manager = new ThemeManager(session, 'auto');
        expect(setPrimaryColor).toHaveBeenCalledExactlyOnceWith('#123456');

        session.platform.config.color = '#654321';
        session.callListeners('platform');
        expect(setPrimaryColor).toHaveBeenLastCalledWith('#654321');
        expect(send).toHaveBeenCalledExactlyOnceWith('platform-updated', session.platform);
        session.removeListener(manager);
    });

    test('does not apply platform colors to webshops', () => {
        const platform = Platform.create({});
        platform.config.color = '#123456';
        const session = new SessionContext(null, platform);
        const manager = new ThemeManager(session, 'webshop');
        expect(setPrimaryColor).not.toHaveBeenCalled();
        session.removeListener(manager);
    });
});
