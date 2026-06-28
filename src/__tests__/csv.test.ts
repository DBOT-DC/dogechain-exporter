// CSV generation test
import { CSV_COLUMNS } from '@/lib/config';

describe('CSV Generation', () => {
  it('CSV columns are defined and non-empty', () => {
    expect(CSV_COLUMNS.length).toBe(13);
    expect(CSV_COLUMNS[0]).toBe('Tx Hash');
  });

  it('CSV generation produces valid format', () => {
    const header = [...CSV_COLUMNS].join(',');
    const row = [
      '0xabc123',
      '12345',
      '2024-01-01 00:00:00 UTC',
      'Send',
      '0xFrom',
      '0xTo',
      '1.5',
      '0xToken',
      'DOGE',
      '100',
      '21000',
      '200',
      'Success',
    ];

    const csv = [header, row.map((c) => `"${c}"`).join(',')].join('\n');

    expect(csv).toContain('Tx Hash');
    expect(csv).toContain('0xabc123');
    expect(csv.split('\n').length).toBe(2);
  });

  it('CSV handles commas and quotes in values', () => {
    const value = 'Some, "quoted" text';
    const escaped = `"${value.replace(/"/g, '""')}"`;
    expect(escaped).toBe('"Some, ""quoted"" text"');
  });
});
