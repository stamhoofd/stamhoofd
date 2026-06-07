import type { CliContext } from './create-context.js';
import { maildevInternalHttpPort, maildevInternalSmtpPort, mysqlInternalPort, rustfsInternalApiPort, rustfsInternalConsolePort } from '../config/shared-service-config.js';

export function buildPorts(context: CliContext) {
    const offset = context.instance.portOffset;
    return {
        webApp: 8080 + offset,
        webshop: 8082 + offset,
        api: 9091 + offset,
        renderer: 9093 + offset,
        mysql: Number.parseInt(process.env.MYSQL_PORT ?? String(mysqlInternalPort + 1), 10),
        maildevSmtp: Number.parseInt(process.env.MAILDEV_SMTP_PORT ?? String(maildevInternalSmtpPort), 10),
        maildevHttp: Number.parseInt(process.env.MAILDEV_HTTP_PORT ?? String(maildevInternalHttpPort), 10),
        rustfs: Number.parseInt(process.env.RUSTFS_PORT ?? String(rustfsInternalApiPort), 10),
        rustfsConsole: Number.parseInt(process.env.RUSTFS_CONSOLE_PORT ?? String(rustfsInternalConsolePort), 10),
        sso: 5556 + offset,
    };
}
