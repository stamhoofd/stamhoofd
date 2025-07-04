import { logger } from '@simonbackx/simple-logging';

export function loadLogger() {
    logger.infectConsole();

    logger.hideTags('silent-seed');

    // Requests
    logger.addClassStyle(['request', 'tag', 'first'], ['cyan']);
    logger.addClassStyle(['request', 'tag', 'output'], ['cyan', 'dim']);
    logger.addClassStyle(['request', 'tag', 'query'], ['cyan']);
    logger.addClassStyle(['request', 'tag', 'body'], ['cyan']);

    logger.addClassAfterStyle(['request', 'tag', 'output'], ['dim']);

    logger.addClassStyle(['request', 'ip'], ['dim', 'italic']);
    logger.addClassAfterStyle(['request', 'ip'], ['dim']);
    logger.addClassStyle(['request', 'host'], ['dim', 'italic']);
    logger.addClassStyle(['request', 'method'], ['cyan', 'italic']);

    logger.addClassStyle(['request', 'status-code'], ['bold']);
    logger.addClassAfterStyle(['request', 'status-code'], ['dim']);

    // CRONS
    logger.addClassStyle(['crons', 'tag'], ['magenta']);
    logger.addClassAfterStyle(['crons', 'tag'], ['dim']);

    // Migrations and seeds
    logger.addClassStyle(['migration', 'prefix'], ['yellow']);
    logger.addClassStyle(['migration', 'name'], ['bold']);
    logger.addClassStyle(['migration', 'success', 'tag'], ['green', 'bold']);
    logger.addClassStyle(['migration', 'success', 'text'], ['dim']);

    logger.addClassStyle(['migration', 'failed', 'tag'], ['red', 'bold']);
    logger.addClassStyle(['migration', 'failed', 'text'], ['red', 'bold']);

    // Errors
    logger.addClassStyle(['error'], ['red']);

    // I18n
    logger.addClassStyle(['i18n', 'tag'], ['blue']);
    logger.addClassAfterStyle(['i18n', 'tag'], ['dim']);

    // UniqueUserService
    logger.addClassStyle(['unique-user-service', 'tag'], ['yellow']);
}
