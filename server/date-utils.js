export const DEFAULT_BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

function resolveTimeZone(timeZone) {
  const candidate = String(timeZone || process.env.APP_TIME_ZONE || DEFAULT_BUSINESS_TIME_ZONE).trim();
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_BUSINESS_TIME_ZONE;
  }
}

export function getBusinessDateKey(date = new Date(), timeZone) {
  const tz = resolveTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getBusinessDateKeyDaysAgo(days, date = new Date(), timeZone) {
  const shifted = new Date(date.getTime() - (Number(days) || 0) * 86400000);
  return getBusinessDateKey(shifted, timeZone);
}


export function getRollingPeriodStartDateKey(periodDays, date = new Date(), timeZone) {
  const days = Number(periodDays);
  if (!Number.isInteger(days) || days < 1) {
    throw new RangeError('periodDays must be an integer greater than or equal to 1');
  }
  return getBusinessDateKeyDaysAgo(days - 1, date, timeZone);
}


export function getInclusiveDateSpanDays(startDateKey, endDateKey, maxDays = null) {
  const parseKey = (key) => {
    const match = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) throw new RangeError('date keys must use YYYY-MM-DD');
    const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const check = new Date(ms);
    if (
      check.getUTCFullYear() !== Number(match[1]) ||
      check.getUTCMonth() !== Number(match[2]) - 1 ||
      check.getUTCDate() !== Number(match[3])
    ) {
      throw new RangeError('invalid calendar date');
    }
    return ms;
  };

  const startMs = parseKey(startDateKey);
  const endMs = parseKey(endDateKey);
  if (endMs < startMs) throw new RangeError('end date must not be before start date');

  let days = Math.floor((endMs - startMs) / 86400000) + 1;
  if (maxDays !== null && maxDays !== undefined) {
    const cap = Number(maxDays);
    if (!Number.isInteger(cap) || cap < 1) throw new RangeError('maxDays must be a positive integer');
    days = Math.min(days, cap);
  }
  return days;
}
