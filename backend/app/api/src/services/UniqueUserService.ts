import { Database } from '@simonbackx/simple-database';
import { logger, StyledText } from '@simonbackx/simple-logging';
import chalk from 'chalk';

const UNIQUE_KEY_NAME = 'email';

/**
 * This service is responsible for creating MySQL unique constraints on boot depending on the environment configuration.
 * If STAMHOOFD.userMode = 'platform' then we'll create a unique constraint on the email column of the user table.
 * If not, we'll delete the constraint if it exists.
 */
export class UniqueUserService {
    static async hasUniqueConstraint() {
        const [results] = await Database.select('SHOW INDEX FROM `users` WHERE Key_name = ?', [UNIQUE_KEY_NAME]);
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
                if (!(await this.hasUniqueConstraint())) {
                    console.warn('Unique constraint is missing. Creating it now...');
                    await this.createConstraint();
                }
            }
            else {
                if (await this.hasUniqueConstraint()) {
                    console.warn('Unique constraint exists but should be removed. Deleting it now...');
                    await this.dropConstraint();
                }
            }
        });
    }

    static async createConstraint() {
        try {
            await Database.statement('ALTER TABLE `users` ADD UNIQUE INDEX `' + UNIQUE_KEY_NAME + '` (`email`) USING BTREE;');
            console.log('Unique constraint created.');
        }
        catch (e) {
            console.error(chalk.red('Failed to create unique constraint on email column of users table:'));
            console.error(e);
        }
    }

    static async dropConstraint() {
        try {
            await Database.statement('ALTER TABLE `users` DROP INDEX `' + UNIQUE_KEY_NAME + '`;');
            console.log('Unique constraint dropped.');
        }
        catch (e) {
            console.error(chalk.red('Failed to drop unique constraint on email column of users table:'));
            console.error(e);
        }
    }
}
