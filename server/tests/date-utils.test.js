import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BUSINESS_TIME_ZONE,
  getBusinessDateKey,
  getBusinessDateKeyDaysAgo,
  getRollingPeriodStartDateKey,
  getInclusiveDateSpanDays
} from '../date-utils.js';

test('business date remains on previous local day after UTC midnight in Sao Paulo', () => {
  const date = new Date('2026-09-26T00:30:00.000Z');
  assert.equal(getBusinessDateKey(date, 'America/Sao_Paulo'), '2026-09-25');
});

test('business date advances at local midnight in Sao Paulo', () => {
  const date = new Date('2026-09-26T03:05:00.000Z');
  assert.equal(getBusinessDateKey(date, 'America/Sao_Paulo'), '2026-09-26');
});

test('business day range keys use the same timezone', () => {
  const date = new Date('2026-09-26T00:30:00.000Z');
  assert.equal(getBusinessDateKeyDaysAgo(7, date, 'America/Sao_Paulo'), '2026-09-18');
  assert.equal(getBusinessDateKeyDaysAgo(30, date, 'America/Sao_Paulo'), '2026-08-26');
});

test('invalid timezone falls back to default business timezone', () => {
  const date = new Date('2026-09-26T00:30:00.000Z');
  assert.equal(DEFAULT_BUSINESS_TIME_ZONE, 'America/Sao_Paulo');
  assert.equal(getBusinessDateKey(date, 'Invalid/Timezone'), '2026-09-25');
});


test('rolling 7-day period includes today plus the previous 6 local dates', () => {
  const date = new Date('2026-09-25T17:30:00.000Z');
  assert.equal(getBusinessDateKey(date, 'America/Sao_Paulo'), '2026-09-25');
  assert.equal(getRollingPeriodStartDateKey(7, date, 'America/Sao_Paulo'), '2026-09-19');
});

test('rolling 30-day period includes today plus the previous 29 local dates', () => {
  const date = new Date('2026-09-25T17:30:00.000Z');
  assert.equal(getRollingPeriodStartDateKey(30, date, 'America/Sao_Paulo'), '2026-08-27');
});

test('rolling period rejects invalid lengths', () => {
  assert.throws(() => getRollingPeriodStartDateKey(0), RangeError);
  assert.throws(() => getRollingPeriodStartDateKey(1.5), RangeError);
});


test('inclusive calendar span counts elapsed calendar days, not number of observations', () => {
  assert.equal(getInclusiveDateSpanDays('2026-09-20', '2026-09-26'), 7);
  assert.equal(getInclusiveDateSpanDays('2026-09-24', '2026-09-26'), 3);
  assert.equal(getInclusiveDateSpanDays('2026-08-28', '2026-09-26'), 30);
});

test('inclusive calendar span can be capped to the analytics window', () => {
  assert.equal(getInclusiveDateSpanDays('2026-09-01', '2026-09-26', 7), 7);
  assert.equal(getInclusiveDateSpanDays('2026-08-01', '2026-09-26', 30), 30);
});

test('inclusive calendar span rejects invalid ranges and dates', () => {
  assert.throws(() => getInclusiveDateSpanDays('2026-09-27', '2026-09-26'), RangeError);
  assert.throws(() => getInclusiveDateSpanDays('2026-02-30', '2026-03-01'), RangeError);
});
