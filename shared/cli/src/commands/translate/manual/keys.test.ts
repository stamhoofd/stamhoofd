import { beforeEach, expect, it, vi } from 'vitest';
import TranslateKeys from './keys.js';
import { translateKeys } from '../../../runtime/translate.js';
import { info } from '../../../runtime/ux.js';

vi.mock('../../../runtime/translate.js', () => ({ translateKeys: vi.fn() }));
vi.mock('../../../runtime/ux.js', () => ({ info: vi.fn() }));

beforeEach(() => vi.resetAllMocks());

it.each([false, true])('shows manual cleanup guidance only after successful key registration (failure: %s)', async (failure) => {
    const command = new TranslateKeys([], {} as never);
    vi.spyOn(command, 'parse' as never).mockResolvedValue({} as never);
    if (failure) {
        vi.mocked(translateKeys).mockRejectedValue(new Error('failed'));
        await expect(command.run()).rejects.toThrow('failed');
        expect(info).not.toHaveBeenCalled();
    }
    else {
        await command.run();
        expect(info).toHaveBeenCalledExactlyOnceWith('Next, run "stam translate manual cleanup" to merge duplicate translations and remove unused keys.');
        expect(info).toHaveBeenCalledAfter(translateKeys);
    }
});
