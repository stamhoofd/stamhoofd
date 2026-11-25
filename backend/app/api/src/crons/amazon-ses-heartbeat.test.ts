import {
    DeleteMessageCommand,
    ReceiveMessageCommand,
    SQSClient,
    SQSServiceException,
    type ReceiveMessageCommandOutput,
} from '@aws-sdk/client-sqs';
import { TestUtils } from '@stamhoofd/test-utils';
import { checkBounces, checkComplaints, checkReplies } from './amazon-ses.js';
import { ForwardHandler } from '../helpers/ForwardHandler.js';

const empty = { $metadata: {} };
const client: {
    send(cmd: ReceiveMessageCommand | DeleteMessageCommand): Promise<ReceiveMessageCommandOutput>;
} = SQSClient.prototype;
const request = vi.fn();
const queues = [
    [checkBounces, 'AWS_BOUNCE_QUEUE_URL', 'SES_BOUNCE_HEARTBEAT_URL'],
    [checkComplaints, 'AWS_COMPLAINTS_QUEUE_URL', 'SES_COMPLAINT_HEARTBEAT_URL'],
    [checkReplies, 'AWS_FORWARDING_QUEUE_URL', 'SES_REPLY_HEARTBEAT_URL'],
] as const;
beforeEach(() => {
    TestUtils.setEnvironment('AWS_ACCESS_KEY_ID', 'test-only');
    for (const [, queue, heartbeat] of queues) {
        TestUtils.setEnvironment(queue, `https://queue.invalid/${queue}`);
        TestUtils.setEnvironment(heartbeat, `https://monitor.invalid/${heartbeat}`);
    }
    vi.stubGlobal(
        'fetch',
        request.mockReset().mockResolvedValue(new Response(null, { status: 204 })),
    );
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

it.each(queues)(
    'signals only the owner of a successful empty %s poll',
    async (poll, queue, heartbeat) => {
        const send = vi.spyOn(client, 'send').mockResolvedValue(empty);
        await poll();
        expect(send.mock.calls[0][0].input.QueueUrl).toBe(STAMHOOFD[queue]);
        expect(request).toHaveBeenCalledExactlyOnceWith(STAMHOOFD[heartbeat], expect.anything());
        TestUtils.setEnvironment(heartbeat, undefined);
        await poll();
        expect(send).toHaveBeenCalledTimes(2);
        TestUtils.setEnvironment(queue, null);
        await poll();
        expect(send).toHaveBeenCalledTimes(2);
        expect(request).toHaveBeenCalledOnce();
    },
);

const reply = {
    MessageId: '0a6f6ae0-3123-4baf-8992-01d7c4cac168',
    ReceiptHandle: 'private-handle',
    Body: JSON.stringify({
        Message: JSON.stringify({ content: 'private-body', mail: {}, receipt: {} }),
    }),
};
it.each([true, false])(
    'preserves delete-before-dispatch and continues across batches (first handler fails: %s)',
    async (fails) => {
        const order: string[] = [];
        const handle = vi.spyOn(ForwardHandler, 'handle').mockImplementation(async () => {
            order.push('handle');
            if (fails && order.length === 3) throw new Error('private-message-data');
            return undefined; // reply intentionally not forwarded
        });
        let receives = 0;
        vi.spyOn(client, 'send').mockImplementation(async (cmd) => {
            if (cmd instanceof DeleteMessageCommand) {
                order.push('delete');
                return empty;
            }
            order.push('receive');
            return ++receives < 3 ? { ...empty, Messages: [reply] } : empty;
        });
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        await checkReplies();
        expect(order).toEqual([
            'receive',
            'delete',
            'handle',
            'receive',
            'delete',
            'handle',
            'receive',
        ]);
        expect(handle).toHaveBeenCalledTimes(2);
        expect(request).toHaveBeenCalledTimes(fails ? 0 : 1);
        if (fails) {
            expect(error).toHaveBeenCalledExactlyOnceWith('[AWS Queue] Message processing failed', {
                queue: 'reply',
                messageId: reply.MessageId,
                deleted: true,
                step: 'handler',
                errorType: 'Error',
                frames: expect.arrayContaining([expect.stringContaining('amazon-ses')]),
            });
            expect(JSON.stringify(error.mock.calls)).not.toContain('private-');
        }
    },
);

it.each(['receive', 'delete'] as const)(
    'surfaces a sanitized %s failure without signaling or processing the unacknowledged reply',
    async (operation) => {
        const send = vi.spyOn(client, 'send');
        if (operation === 'delete') send.mockResolvedValueOnce({ ...empty, Messages: [reply] });
        send.mockRejectedValueOnce(
            new SQSServiceException({
                name: 'AccessDenied',
                $fault: 'client',
                $metadata: { httpStatusCode: 403, requestId: reply.MessageId },
                message: 'private-url/receipt',
            }),
        );
        const handle = vi.spyOn(ForwardHandler, 'handle');
        await expect(checkReplies()).rejects.toEqual(
            new Error(
                `SES queue ${operation} failed (reply, AccessDenied, HTTP 403, request ${reply.MessageId})`,
            ),
        );
        expect(handle).not.toHaveBeenCalled();
        expect(request).not.toHaveBeenCalled();
    },
);

it('skips all uncredentialed queues and withholds success for an unsupported envelope', async () => {
    const send = vi.spyOn(client, 'send');
    TestUtils.setEnvironment('AWS_ACCESS_KEY_ID', '');
    for (const [poll] of queues) await poll();
    expect(send).not.toHaveBeenCalled();
    TestUtils.setEnvironment('AWS_ACCESS_KEY_ID', 'test-only');
    send.mockResolvedValueOnce({
        ...empty,
        Messages: [{ ReceiptHandle: 'test', Body: '{}' }],
    }).mockResolvedValue(empty);
    await checkComplaints();
    expect(send.mock.calls.map(([cmd]) => cmd.constructor.name)).toEqual([
        'ReceiveMessageCommand',
        'DeleteMessageCommand',
        'ReceiveMessageCommand',
    ]);
    expect(request).not.toHaveBeenCalled();
});

it('identifies a malformed unacknowledged message without exposing its body', async () => {
    vi.spyOn(client, 'send')
        .mockResolvedValueOnce({
            ...empty,
            Messages: [{ MessageId: reply.MessageId, Body: 'private-body' }],
        })
        .mockResolvedValueOnce(empty);
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    await checkReplies();
    const context = { queue: 'reply', messageId: reply.MessageId, deleted: false };
    expect(warn).toHaveBeenCalledWith('[AWS Queue] Missing receipt handle', context);
    expect(error).toHaveBeenCalledWith('[AWS Queue] Message processing failed', {
        ...context,
        step: 'parsing',
        errorType: 'SyntaxError',
        frames: expect.any(Array),
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain('private-body');
    expect(request).not.toHaveBeenCalled();
});

it('signals once at the work limit without requiring the queue to be drained', async () => {
    const message = {
        ReceiptHandle: 'test',
        Body: JSON.stringify({
            Message: JSON.stringify({ mail: {}, bounce: { bouncedRecipients: [] } }),
        }),
    };
    let receives = 0;
    const send = vi.spyOn(client, 'send').mockImplementation(async (cmd) => {
        if (cmd instanceof DeleteMessageCommand) return empty;
        if (++receives > 2) throw new Error('Unexpected third receive');
        return { ...empty, Messages: Array.from({ length: 10 }, () => message) };
    });
    await checkBounces();
    expect(send).toHaveBeenCalledTimes(22);
    expect(request).toHaveBeenCalledExactlyOnceWith(
        STAMHOOFD.SES_BOUNCE_HEARTBEAT_URL,
        expect.anything(),
    );
});
