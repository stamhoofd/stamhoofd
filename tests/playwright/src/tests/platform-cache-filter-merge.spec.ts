// test should always be imported first
import { setup, test } from '../test-fixtures/platform.js';
setup();

// other imports
import type { Decoder } from '@simonbackx/simple-encoding';
import { ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Platform } from '@stamhoofd/models';
import type { StamhoofdFilter } from '@stamhoofd/structures';
import { Platform as PlatformStruct, PropertyFilter, RecordCategory, Version } from '@stamhoofd/structures';
import { WorkerData } from '../helpers/index.js';

/**
 * Regression coverage for the platform cache merge.
 *
 * When a Platform is already cached in localStorage and the app boots, it loads that cached
 * Platform and then merges the fresh Platform received from the backend on top of it using
 * `deepSet` (see PlatformManager.forceUpdate -> `this.$platform.deepSet(...)`), saving the
 * merged result back to localStorage.
 *
 * A StamhoofdFilter is a plain-object dictionary (e.g. `{ $and: [...] }`) whose key set is data.
 * `deepSet` used to copy over the keys of the *new* value only, never removing keys that existed on
 * the cached filter but not the new one. So when the record-category filter was simplified from a
 * two-condition `$and` to a single bare condition (the `$and` wrapper being dropped), the stale
 * `$and` key survived the merge and the filter ended up as a mix of the old and the new state.
 *
 * This was fixed in `@simonbackx/simple-encoding` (deepSet now syncs the key set of plain-object
 * dictionaries); these tests guard against a regression.
 */
test.describe('[Regression] Platform cache filter merge @platform-filter-merge', () => {
    const CATEGORY_ID = 'deepset-filter-merge-category';

    // Two independent record-category filter conditions.
    const conditionA: StamhoofdFilter = { age: { $gt: 18 } };
    const conditionB: StamhoofdFilter = { gender: { $eq: 'male' } };

    test.afterEach(async () => {
        await WorkerData.resetDatabase();
    });

    /**
     * - Configure the backend platform so `/platform` serves `backendFilter`.
     * - Seed localStorage with a cached platform that is identical to the backend one, except that
     *   its record-category filter is `cachedFilter` (the stale state).
     * - Boot the dashboard so PlatformManager loads the cached platform, fetches the fresh one and
     *   merges it with `deepSet`, then persists the merged platform back to localStorage.
     * - Return the merged record-category `enabledWhen` filter that ended up in localStorage.
     */
    async function mergeCachedPlatform(options: {
        page: Page;
        cachedFilter: StamhoofdFilter;
        backendFilter: StamhoofdFilter;
    }): Promise<StamhoofdFilter | null | undefined> {
        // 1. Make the backend serve the fresh (new) filter.
        const platform = await Platform.getForEditing();
        platform.config.recordsConfiguration.recordCategories = [
            RecordCategory.create({
                id: CATEGORY_ID,
                filter: new PropertyFilter(options.backendFilter, null),
            }),
        ];
        await platform.save();

        // 2. Build the cached platform: identical to the backend one, but with the stale filter.
        const cachedStruct = (await Platform.getSharedPrivateStruct()).clone();
        const cachedCategory = cachedStruct.config.recordsConfiguration.recordCategories.find(c => c.id === CATEGORY_ID);
        if (!cachedCategory) {
            throw new Error('Record category not found in cached platform struct');
        }
        cachedCategory.filter = new PropertyFilter(options.cachedFilter, null);
        const cachedBlob = JSON.stringify(new VersionBox(cachedStruct).encode({ version: Version }));

        // 3. Seed the cached platform in localStorage before the app boots.
        await options.page.addInitScript((blob) => {
            window.localStorage.setItem('platform', blob);
        }, cachedBlob);

        // 4. Boot the dashboard. This triggers the background platform fetch + deepSet merge.
        await options.page.goto(WorkerData.urls.dashboard);

        // 5. The fresh platform is fetched in the background and merged onto the cached one with
        // deepSet, after which the merged platform is persisted back to localStorage. Wait until
        // that write lands (the stored blob changes), then read and decode it.
        const deadline = Date.now() + 30_000;
        let mergedBlob: string | null = null;
        while (Date.now() < deadline) {
            const raw = await options.page.evaluate(() => window.localStorage.getItem('platform'));
            if (raw && raw !== cachedBlob) {
                mergedBlob = raw;
                break;
            }
            await options.page.waitForTimeout(200);
        }

        if (!mergedBlob) {
            throw new Error('Merged platform was not written back to localStorage in time');
        }

        const decoded = new VersionBoxDecoder(PlatformStruct as Decoder<PlatformStruct>)
            .decode(new ObjectData(JSON.parse(mergedBlob), { version: 0 }));
        const mergedCategory = decoded.data.config.recordsConfiguration.recordCategories.find(c => c.id === CATEGORY_ID);
        return mergedCategory?.filter?.enabledWhen;
    }

    /**
     * The regression: the cached filter is a two-condition `$and`, the fresh filter is a single bare
     * condition (the `$and` wrapper dropped). After the merge the filter must equal the fresh one -
     * before the fix the stale `$and` key survived, leaving the merged filter as a mix of both.
     */
    test('replaces a two-condition $and filter with a single bare condition', async ({ page }) => {
        const merged = await mergeCachedPlatform({
            page,
            cachedFilter: { $and: [conditionA, conditionB] },
            backendFilter: conditionA,
        });

        expect(merged).toEqual(conditionA);
    });

    /**
     * Control: the cached filter is a two-condition `$and`, the fresh filter is a single-condition
     * `$and`. Here the top-level `$and` key still exists on the new filter, so deepSet replaces the
     * array in place and the merge is correct. This proves the harness reports a real pass when the
     * merge behaves correctly (and isn't just failing for infrastructure reasons).
     */
    test('replaces a two-condition $and filter with a single-condition $and filter', async ({ page }) => {
        const backendFilter: StamhoofdFilter = { $and: [conditionA] };
        const merged = await mergeCachedPlatform({
            page,
            cachedFilter: { $and: [conditionA, conditionB] },
            backendFilter,
        });

        expect(merged).toEqual(backendFilter);
    });
});
