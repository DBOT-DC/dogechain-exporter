import { isValidAddress, normalizeAddress, addressToTopic, hexWeiToValue, hexGasToGwei, hexTimestampToUTC, classifyTx } from '@/lib/utils';

describe('isValidAddress', () => {
  it('accepts valid lowercase address', () => {
    expect(isValidAddress('0x0123456789abcdef0123456789abcdef01234567')).toBe(true);
  });

  it('accepts valid checksummed address', () => {
    expect(isValidAddress('0x0123456789ABCDEF0123456789ABCDEF01234567')).toBe(true);
  });

  it('accepts mixed case', () => {
    expect(isValidAddress('0xa6Aa74E88Fbc8346Fc9cEe28F5cAE6fE42E27A70')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidAddress('')).toBe(false);
  });

  it('rejects non-0x prefix', () => {
    expect(isValidAddress('123456789abcdef0123456789abcdef01234567')).toBe(false);
  });

  it('rejects too short', () => {
    expect(isValidAddress('0x0123456789abcdef0123456789abcdef0123456')).toBe(false);
  });

  it('rejects too long', () => {
    expect(isValidAddress('0x0123456789abcdef0123456789abcdef012345678')).toBe(false);
  });

  it('rejects non-hex characters', () => {
    expect(isValidAddress('0xzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')).toBe(false);
  });

  it('rejects non-string', () => {
    expect(isValidAddress(null as any)).toBe(false);
    expect(isValidAddress(undefined as any)).toBe(false);
    expect(isValidAddress(123 as any)).toBe(false);
  });
});

describe('normalizeAddress', () => {
  it('lowercases address', () => {
    expect(normalizeAddress('0xAaBbCcDdEeFf00112233445566778899AaBbCcDd')).toBe(
      '0xaabbccddeeff00112233445566778899aabbccdd',
    );
  });
});

describe('addressToTopic', () => {
  it('pads address to 32 bytes', () => {
    const topic = addressToTopic('0x0123456789abcdef0123456789abcdef01234567');
    expect(topic).toBe(
      '0x0000000000000000000000000123456789abcdef0123456789abcdef01234567',
    );
    expect(topic.length).toBe(66); // 0x + 64 hex chars
  });
});

describe('hexWeiToValue', () => {
  it('converts zero', () => {
    expect(hexWeiToValue('0x0')).toBe('0');
  });

  it('converts whole number', () => {
    expect(hexWeiToValue('0x8ac7230489e80000')).toBe('10'); // 10 ETH
  });

  it('converts with decimals', () => {
    // 1.5 ETH = 1500000000000000000 wei
    expect(hexWeiToValue('0x14d1120d7b160000')).toBe('1.5');
  });

  it('handles small values', () => {
    // 0.001 ETH = 1000000000000000 wei
    expect(hexWeiToValue('0x38d7ea4c68000')).toBe('0.001');
  });

  it('respects custom decimals', () => {
    expect(hexWeiToValue('0x64', 6)).toBe('0.0001');
  });
});

describe('hexGasToGwei', () => {
  it('converts zero', () => {
    expect(hexGasToGwei('0x0')).toBe('0');
  });

  it('converts to Gwei', () => {
    // 200 Gwei = 200000000000 wei
    expect(hexGasToGwei('0x2e90edd000')).toBe('200');
  });
});

describe('hexTimestampToUTC', () => {
  it('converts timestamp', () => {
    // 1700000000 = Nov 14, 2023 22:13:20 UTC
    const result = hexTimestampToUTC('0x6553d600');
    expect(result).toContain('2023');
    expect(result).toContain('UTC');
  });
});

describe('classifyTx', () => {
  const wallet = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

  it('classifies outgoing', () => {
    expect(classifyTx(wallet, '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', wallet)).toBe('Send');
  });

  it('classifies incoming', () => {
    expect(classifyTx('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', wallet, wallet)).toBe('Receive');
  });

  it('classifies self', () => {
    expect(classifyTx(wallet, wallet, wallet)).toBe('Self');
  });
});
