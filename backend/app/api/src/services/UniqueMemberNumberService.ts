import { Database } from '@simonbackx/simple-database';
import { logger, StyledText } from '@simonbackx/simple-logging';
import chalk from 'chalk';

const UNIQUE_PLATFORM_KEY_NAME = 'memberNumber';
const UNIQUE_ORGANIZATION_KEY_NAME = 'memberNumber_organizationId';

/**
 * This service is responsible for creating MySQL unique constraints on boot depending on the environment configuration.
 * If STAMHOOFD.userMode = 'platform' then we'll create a unique constraint on the memberNumber column of the member table.
 * If not, we'll add a unique constraint on the memberNumber and organizationId column combination of the member table.
 */
export class UniqueMemberNumberService {
    private static async hasUniquePlatformConstraint() {
        const [results] = await Database.select('SHOW INDEX FROM `members` WHERE Key_name = ?', [UNIQUE_PLATFORM_KEY_NAME]);
        return results.length > 0;
    }

    private static async hasUniqueOrganizationConstraint() {
        const [results] = await Database.select('SHOW INDEX FROM `members` WHERE Key_name = ?', [UNIQUE_ORGANIZATION_KEY_NAME]);
        return results.length > 0;
    }

    static async check() {
        await logger.setContext({
            prefixes: [
                new StyledText(`[UniqueUserService] `).addClass('unique-user-service', 'tag'),
            ],
            tags: ['unique-user-service'],
        }, async () => {
            if (STAMHOOFD.userMode === 'platform') {
                if (await this.hasUniqueOrganizationConstraint()) {
                    console.warn('Unique memberNumber_organizationId constraint exists but should be removed. Deleting it now...');
                    await this.dropOrganizationConstraint();
                }

                if (!(await this.hasUniquePlatformConstraint())) {
                    console.warn('Unique memberNumber constraint is missing. Creating it now...');
                    await this.createConstraint(true);
                }
            }
            else {
                if (await this.hasUniquePlatformConstraint()) {
                    console.warn('Unique constraint exists but should be removed. Deleting it now...');
                    await this.dropPlatformConstraint();
                }

                if (!(await this.hasUniqueOrganizationConstraint())) {
                    console.warn('Unique memberNumber_organizationId constraint is missing. Creating it now...');
                    await this.createConstraint(false);
                }
            }
        });
    }

    private static async createConstraint(isPlatform: boolean) {
        const key = isPlatform ? UNIQUE_PLATFORM_KEY_NAME : UNIQUE_ORGANIZATION_KEY_NAME;

        try {
            if (isPlatform) {
                await Database.statement('ALTER TABLE `members` ADD UNIQUE INDEX `' + key + '` (`memberNumber`) USING BTREE;');
            }
            else {
                await Database.statement('ALTER TABLE `members` ADD UNIQUE INDEX `' + key + '` (`memberNumber`, `organizationId`) USING BTREE;');
            }

            console.log(`Unique constraint ${key} created.`);
        }
        catch (e) {
            console.error(chalk.red(`Failed to create unique constraint ${key} on members table:`));
            console.error(e);
        }
    }

    private static async dropConstraint(key: string) {
        try {
            await Database.statement('ALTER TABLE `members` DROP INDEX `' + key + '`;');
            console.log(`Unique ${key} constraint dropped.`);
        }
        catch (e) {
            console.error(chalk.red(`Failed to drop unique constraint ${key}:`));
            console.error(e);
        }
    }

    private static async dropPlatformConstraint() {
        await this.dropConstraint(UNIQUE_PLATFORM_KEY_NAME);
    }

    private static async dropOrganizationConstraint() {
        await this.dropConstraint(UNIQUE_ORGANIZATION_KEY_NAME);
    }
}
