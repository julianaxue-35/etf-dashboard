import test from 'node:test';
import assert from 'node:assert/strict';
import { alignSeries, rebased } from '../js/charts.js';

test('alignSeries puts each fund on the right dates and rebases at its own start', () => {
  const long = { label: 'L', dates: ['2023-01-01', '2024-01-01', '2025-01-01'], prices: [100, 110, 121] };
  const short = { label: 'S', dates: ['2024-01-01', '2025-01-01'], prices: [50, 75] };
  const { dates, series } = alignSeries([long, short]);
  const r6 = a => a.map(v => v === null ? null : Math.round(v * 1e6) / 1e6);
  assert.deepEqual(dates, ['2023-01-01', '2024-01-01', '2025-01-01']);
  assert.deepEqual(r6(series[0].values), [100, 110, 121]);
  assert.deepEqual(r6(series[1].values), [null, 100, 150]);      // starts at its own first date
});

test('alignSeries tolerates empty input', () => {
  assert.deepEqual(alignSeries([]), { dates: [], series: [] });
});

test('rebased', () => { assert.deepEqual(rebased(null, [50, 100]), [100, 200]); });
