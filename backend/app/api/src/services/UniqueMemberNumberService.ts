import { Database } from '@simonbackx/simple-database';
import { logger, StyledText } from '@simonbackx/simple-logging';
import chalk from 'chalk';

const UNIQUE_KEY_PLATFORM = 'memberNumber';
const UNIQUE_KEY_ORGANIZATION = 'memberNumber_organizationId';

/**
 * This service is responsible for creating MySQL unique constraints on boot depending on the environment configuration.
 * If STAMHOOFD.userMode = 'platform' then we'll create a unique constraint on the memberNumber column of the member table.
 * If 'organization' we will create a unique constraint on memberNumber and organizationId.
 */
export class UniqueMemberNumberService {
    static async check() {
        await logger.setContext({
            prefixes: [
                new StyledText(`[UniqueMemberNumberService] `).addClass('unique-member-number-service', 'tag'),
            ],
            tags: ['unique-member-number-service'],
        }, async () => {
            if (STAMHOOFD.userMode === 'platform') {
                if (await this.hasUniqueConstraint(UNIQUE_KEY_ORGANIZATION)) {
                    console.warn('Unique constraint for userMode organization exists but should be removed. Deleting it now...');
                    await this.dropConstraint(UNIQUE_KEY_ORGANIZATION);
                }

                if (!(await this.hasUniqueConstraint(UNIQUE_KEY_PLATFORM))) {
                    console.warn('Unique constraint for userMode platform is missing. Creating it now...');
                    await this.createConstraintForPlatform();
                }
            }
            else {
                if (await this.hasUniqueConstraint(UNIQUE_KEY_PLATFORM)) {
                    console.warn('Unique constraint for userMode platform exists but should be removed. Deleting it now...');
                    await this.dropConstraint(UNIQUE_KEY_PLATFORM);
                }

                if (!(await this.hasUniqueConstraint(UNIQUE_KEY_ORGANIZATION))) {
                    console.warn('Unique constraint for userMode organization is missing. Creating it now...');
                    await this.createConstraintForOrganization();
                }
            }
        });
    }

    private static async hasUniqueConstraint(key: string) {
        const [results] = await Database.select('SHOW INDEX FROM `members` WHERE Key_name = ?', [key]);
        return results.length > 0;
    }

    private static async dropConstraint(key: string) {
        try {
            await Database.statement('ALTER TABLE `members` DROP INDEX `' + key + '`;');
            console.log('Unique constraint dropped.');
        }
        catch (e) {
            console.error(chalk.red(`Failed to drop unique constraint "${key}" of members table:`));
            console.error(e);
        }
    }

    private static async createConstraintForOrganization() {
        try {
            await Database.statement('ALTER TABLE `members` ADD UNIQUE INDEX `' + UNIQUE_KEY_ORGANIZATION + '` (`memberNumber`, `organizationId`) USING BTREE;');
            console.log('Unique constraint created.');
        }
        catch (e) {
            console.error(chalk.red('Failed to create unique constraint on memberNumber and organizationId column of members table:'));
            console.error(e);
        }
    }

    private static async createConstraintForPlatform() {
        try {
            await Database.statement('ALTER TABLE `members` ADD UNIQUE INDEX `' + UNIQUE_KEY_PLATFORM + '` (`memberNumber`) USING BTREE;');
            console.log('Unique constraint created.');
        }
        catch (e) {
            console.error(chalk.red('Failed to create unique constraint on memberNumber column of members table:'));
            console.error(e);
        }
    }
}
