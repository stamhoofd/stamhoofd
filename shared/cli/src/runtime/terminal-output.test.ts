import { expect, it, vi } from 'vitest';
import { createTerminalOutput } from './terminal-output.js';

const terminal = vi.hoisted(() => ({ isTTY: true, createRegion: vi.fn(), write: vi.fn() }));
vi.mock('./telemetry.js', () => ({ getCliTelemetry: () => ({ terminal }) }));

it('uses separate regions on the shared terminal without disposing its owner', () => {
    const first = { update: vi.fn(), finish: vi.fn() };
    const second = { update: vi.fn(), finish: vi.fn() };
    terminal.createRegion.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const a = createTerminalOutput();
    const b = createTerminalOutput();
    a.setLive('first');
    b.setLive('second');
    a.done();
    b.write('still running');
    expect(first.finish).toHaveBeenCalledWith('first');
    expect(second.finish).not.toHaveBeenCalled();
    expect(terminal.write).toHaveBeenCalledWith('still running');
});
