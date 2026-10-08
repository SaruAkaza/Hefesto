export function physicalSerialKey(value) {
  if (typeof value !== 'string') return null;
  const key = value.trim().toUpperCase().replace(/\s/g, '');
  return !key || ['UNKNOWN', 'N/A', 'N/D', '-', 'LEXMARK-WEB'].includes(key) || key.startsWith('MAC:') ? null : key;
}
function mac(value) {
  const key = typeof value === 'string' ? value.replace(/[^a-f0-9]/gi, '').toUpperCase() : '';
  return /^[A-F0-9]{12}$/.test(key) ? key : null;
}
export function hasPrinterIdentityConflict(previous = {}, detected = {}) {
  previous = previous || {};
  detected = detected || {};
  const oldSerial = physicalSerialKey(previous.serialNumber);
  const newSerial = physicalSerialKey(detected.serialNumber);
  const oldMac = mac(previous.macAddress);
  const newMac = mac(detected.macAddress);
  return Boolean((oldSerial && newSerial && oldSerial !== newSerial) || (oldMac && newMac && oldMac !== newMac));
}
export function isCurrentPrinterSnapshot(snapshot, current) {
  return Boolean(current?.isActive && current.ip === snapshot.ip && current.unitId === snapshot.unitId &&
    current.unitName === snapshot.unitName && current.location === snapshot.location);
}

export async function queryCurrentPrinterTelemetry({ snapshot, previousIdentity, getCurrent, query }) {
  if (!isCurrentPrinterSnapshot(snapshot, getCurrent(snapshot.id))) return null;
  const fresh = await query(snapshot.ip, snapshot.community);
  if (!isCurrentPrinterSnapshot(snapshot, getCurrent(snapshot.id))) return null;
  if (hasPrinterIdentityConflict(previousIdentity, fresh?.info)) return null;
  return fresh;
}
