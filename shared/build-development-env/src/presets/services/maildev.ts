import { type ConcurrentlyCommandInput } from 'concurrently';
import { Service } from '../../Service.js';

export function build(service: Service): any {
    const config = {
        // Uses the local SMTP test server
        SMTP_HOST: '0.0.0.0',
        SMTP_USERNAME: 'username',
        SMTP_PASSWORD: 'password',
        SMTP_PORT: 1025,

        TRANSACTIONAL_SMTP_HOST: '0.0.0.0',
        TRANSACTIONAL_SMTP_USERNAME: 'username',
        TRANSACTIONAL_SMTP_PASSWORD: 'password',
        TRANSACTIONAL_SMTP_PORT: 1025,
    };

    return config;
}

export function init(): ConcurrentlyCommandInput[] {
    return [
        {
            name: 'MailDev',
            command: 'maildev --ip 0.0.0.0 --incoming-user username --incoming-pass password',
            prefixColor: 'red',
        },
    ];
}
