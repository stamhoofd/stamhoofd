import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlatformReportStart from './start.js';
import { migratePlatformStatistics, runPlatformStatisticsSync } from '../../runtime/monorepo-runner.js';
import { warning } from '../../runtime/ux.js';
import { CaddyService } from '../../services/definitions/caddy-service.js';
import { metabaseService } from '../../services/definitions/metabase-service.js';
import { allRunning, startServices } from '../../services/manager.js';

vi.mock('../../runtime/monorepo-runner.js', () => ({
    migratePlatformStatistics: vi.fn(),
    runPlatformStatisticsSync: vi.fn(),
}));

vi.mock('../../runtime/ux.js', () => ({
    command: (value: string) => value,
    info: vi.fn(),
    link: (label: string) => label,
    step: vi.fn(async (_message: string, fn: () => Promise<unknown>) => await fn()),
    warning: vi.fn(),
}));

vi.mock('../../services/definitions/caddy-service.js', () => ({
    CaddyService: { reload: vi.fn() },
}));

vi.mock('../../services/registry.js', () => ({
    sharedServiceDefinitions: [],
}));

vi.mock('../../services/definitions/metabase-service.js', () => ({
    metabaseService: {
        start: vi.fn(async () => ({ message: 'Metabase started' })),
        provision: vi.fn(),
        provisionReport: vi.fn(),
    },
}));

vi.mock('../../services/manager.js', () => ({
    allRunning: vi.fn(),
    startServices: vi.fn(),
}));

vi.mock('../../services/metabase-config.js', () => ({
    buildMetabaseConfigOutput: vi.fn(() => 'config output'),
}));

vi.mock('../../config/build-config.js', () => ({
    buildDomains: vi.fn(() => ({ metabase: 'metabase.stamhoofd' })),
}));

vi.mock('../../context/ports.js', () => ({
    buildPorts: vi.fn(() => ({ mysql: 3307 })),
}));

describe('Platform report start command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(allRunning).mockResolvedValue(true);
        vi.mocked(metabaseService.provision).mockResolvedValue({
            database: 'platform-statistics-development',
            dataSource: 'Platform statistics (stamhoofd)',
            created: true,
            removedSampleDatabase: false,
            hiddenTables: [],
            tableCount: 12,
        });
        vi.mocked(metabaseService.provisionReport).mockResolvedValue({
            collection: 'Ledenstatistieken (stamhoofd)',
            collectionId: 4,
            createdCollection: true,
            renamedCollection: undefined,
            dashboards: [{ name: 'Ledenstatistieken', id: 2, tabs: ['Ledenaantallen'], bookmarked: true }],
            cards: 24,
            mapsWithoutCoordinates: [],
            database: 'platform-statistics-development',
            dataSource: 'Platform statistics (stamhoofd)',
            tableCount: 12,
            postalCodeCount: 1149,
        });
    });

    it('migrates the statistics database before Metabase reads its schema', async () => {
        await createCommand().run();

        expect(migratePlatformStatistics).toHaveBeenCalledWith(expect.objectContaining({ env: 'stamhoofd' }));
        expect(order(migratePlatformStatistics)).toBeLessThan(order(metabaseService.provision));
    });

    it('writes the report and then syncs until it is stopped', async () => {
        await createCommand().run();

        expect(order(metabaseService.provisionReport)).toBeLessThan(order(runPlatformStatisticsSync));
        expect(runPlatformStatisticsSync).toHaveBeenCalledWith(expect.objectContaining({ env: 'stamhoofd' }));
    });

    it('starts the shared services only when they are not running', async () => {
        await createCommand().run();
        expect(startServices).not.toHaveBeenCalled();

        vi.mocked(allRunning).mockResolvedValue(false);
        await createCommand().run();
        expect(startServices).toHaveBeenCalledTimes(1);
        expect(CaddyService.reload).toHaveBeenCalledTimes(2);
    });

    it('warns about maps that fall back to a bar chart', async () => {
        vi.mocked(metabaseService.provisionReport).mockResolvedValue({
            collection: 'Ledenstatistieken (stamhoofd)',
            collectionId: 4,
            createdCollection: true,
            renamedCollection: undefined,
            dashboards: [],
            cards: 24,
            mapsWithoutCoordinates: ['Leden per postcode'],
            database: 'platform-statistics-development',
            dataSource: 'Platform statistics (stamhoofd)',
            tableCount: 12,
            postalCodeCount: 0,
        });

        await createCommand().run();

        expect(warning).toHaveBeenCalledWith(expect.stringContaining('Leden per postcode'));
    });

    it('says which collection it renamed into the one it writes', async () => {
        vi.mocked(metabaseService.provisionReport).mockResolvedValue({
            collection: 'Ledenstatistieken',
            collectionId: 4,
            createdCollection: false,
            renamedCollection: 'Ledenstatistieken (stamhoofd)',
            dashboards: [],
            cards: 24,
            mapsWithoutCoordinates: [],
            database: 'platform-statistics-development',
            dataSource: 'Platform statistics (stamhoofd)',
            tableCount: 12,
            postalCodeCount: 1149,
        });

        const command = createCommand();
        await command.run();

        expect((command as any).log).toHaveBeenCalledWith(expect.stringContaining('renamed from Ledenstatistieken (stamhoofd)'));
    });

    it('warns when the statistics database is still empty after migrating', async () => {
        vi.mocked(metabaseService.provision).mockResolvedValue({
            database: 'platform-statistics-development',
            dataSource: 'Platform statistics (stamhoofd)',
            created: true,
            removedSampleDatabase: false,
            hiddenTables: [],
            tableCount: 0,
        });

        await createCommand().run();

        expect(warning).toHaveBeenCalledWith(expect.stringContaining('has no tables'));
    });
});

function order(mock: unknown): number {
    return vi.mocked(mock as (...args: unknown[]) => unknown).mock.invocationCallOrder[0];
}

function createCommand(): PlatformReportStart {
    const command = new PlatformReportStart([], {} as any);
    (command as any).config = {};
    (command as any).log = vi.fn();
    (command as any).parse = vi.fn(async () => ({ flags: { env: 'stamhoofd', verbose: false } }));
    (command as any).createContext = vi.fn(async () => ({
        rootDir: '/repo',
        generatedDir: '/repo/.development/cli/generated',
        env: 'stamhoofd',
        workspace: 'main',
        verbose: false,
        instance: {
            name: 'stamhoofd',
            prefix: '',
            primary: true,
            portOffset: 0,
        },
    }));
    return command;
}
