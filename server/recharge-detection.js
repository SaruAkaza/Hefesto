// A failed confirmation or process restart must not discard the persisted pre-swap level.
export function resolveRechargeBaseline(previousSupply, currentSupply, pending, nowMs = Date.now()) {
  const unchanged = { supply: previousSupply, resumed: false };
  if (!pending || !previousSupply || !currentSupply) return unchanged;
  const firstSeen = Date.parse(pending.firstSeen || '');
  if (!Number.isFinite(firstSeen) || firstSeen > nowMs || nowMs - firstSeen > 86400000) return unchanged;
  const levels = [pending.baselineLevel, pending.targetLevel, currentSupply.percentage];
  if (levels.some(n => !Number.isFinite(n) || n < 0 || n > 100)) return unchanged;
  if (currentSupply.estimated || previousSupply.estimated ||
      currentSupply.semantics === 'estimated_remaining_supply' ||
      previousSupply.semantics === 'estimated_remaining_supply') return unchanged;
  if (Math.abs(currentSupply.percentage - pending.targetLevel) > 5 ||
      currentSupply.percentage <= pending.baselineLevel) return unchanged;
  return { supply: { ...previousSupply, percentage: pending.baselineLevel }, resumed: true };
}
