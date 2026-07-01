import { Platform } from '@stamhoofd/models';

/**
 * Require (or stop requiring) two-factor authentication for users with platform
 * permissions.
 *
 * The platform row survives WorkerData.resetDatabase(), so a test file that enables this
 * in beforeAll has to disable it again in afterAll, otherwise the other test files of the
 * same worker inherit it.
 */
export async function setPlatformRequiresTwoFactor(requireTwoFactor: boolean) {
    const platform = await Platform.getForEditing();
    platform.privateConfig.requireTwoFactor = requireTwoFactor;
    await platform.save();
}
