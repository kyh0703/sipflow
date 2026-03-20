import { describe, expect, it } from 'vitest';

import { validateRequiredFields } from './validation';

describe('validateRequiredFields', () => {
  it('requires both primaryCallId and consultCallId for MuteTransfer', () => {
    const errors = validateRequiredFields([
      {
        id: 'mute-transfer',
        type: 'command',
        position: { x: 0, y: 0 },
        data: {
          command: 'MuteTransfer',
          sipInstanceId: 'inst-a',
          consultCallId: 'consult',
        },
      },
    ]);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'mute-transfer',
          message: 'MuteTransfer command requires primaryCallId',
        }),
      ])
    );
  });

  it('accepts MuteTransfer when both call IDs are present', () => {
    const errors = validateRequiredFields([
      {
        id: 'mute-transfer',
        type: 'command',
        position: { x: 0, y: 0 },
        data: {
          command: 'MuteTransfer',
          sipInstanceId: 'inst-a',
          primaryCallId: 'primary',
          consultCallId: 'consult',
        },
      },
    ]);

    expect(errors).toEqual([]);
  });

  it('requires Number for SIP Instance', () => {
    const errors = validateRequiredFields([
      {
        id: 'sip-a',
        type: 'sipInstance',
        position: { x: 0, y: 0 },
        data: {
          label: 'Caller',
          register: false,
        },
      },
    ]);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'sip-a',
          message: 'SIP Instance requires Number',
        }),
      ])
    );
  });
});
