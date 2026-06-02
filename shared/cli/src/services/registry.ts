import { caddyService } from './definitions/caddy-service.js';
import { corednsService } from './definitions/coredns-service.js';
import { maildevService } from './definitions/maildev-service.js';
import { mysqlService } from './definitions/mysql-service.js';
import { rustfsService } from './definitions/rustfs-service.js';
import type { SharedServiceDefinition } from './service.js';

export const sharedServiceDefinitions: SharedServiceDefinition[] = [
    corednsService,
    caddyService,
    mysqlService,
    maildevService,
    rustfsService,
];
