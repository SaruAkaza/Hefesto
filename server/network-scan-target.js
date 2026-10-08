import { isValidIpv4, formatMacAddress } from './snmp-service.js';
import { physicalSerialKey, hasPrinterIdentityConflict } from './printer-identity.js';

const serialKey = value => {
  const key = physicalSerialKey(value);
  return key && !['DESCONHECIDO', 'UNDEFINED', 'NULL'].includes(key)
    ? key.replace(/-/g, '') : null;
};

export function parseNetworkScanTarget(body = {}) {
  const raw = String(body.targetIp ?? body.targetIdentifier ?? body.targetMac ?? body.targetSerial ?? '').trim();
  if (body.targetIp !== undefined || /^\d+(?:\.\d+){3}$/.test(raw)) {
    if (!isValidIpv4(raw)) throw new Error('Informe um endereço IPv4 válido, como 192.0.2.10.');
    return { raw, ip: raw, mac: null, serial: null };
  }
  const isMac = /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(raw) || /^[0-9a-f]{12}$/i.test(raw);
  return { raw, ip: null, mac: isMac ? formatMacAddress(raw) : null,
    serial: !isMac && raw ? raw.toUpperCase().replace(/[\s-]/g, '') : null };
}

// One address only. A cached ARP entry alone cannot establish that a printer responded.
export async function discoverPrinterAtIp(ip, { community = 'public', query, getMac }) {
  if (!isValidIpv4(ip)) throw new Error('Endereço IPv4 inválido.');
  const [statusResult, macResult] = await Promise.allSettled([
    query(ip, community), getMac(ip, community, 1000)
  ]);
  const status = statusResult.status === 'fulfilled' ? statusResult.value : null;
  if (status?.online !== true) return [];
  const info = status.info || {};
  return [{ ip, mac: macResult.status === 'fulfilled' ? macResult.value : null,
    name: info.name || info.model || `Impressora ${ip}`, model: info.model || null,
    serial: serialKey(info.serialNumber) ? info.serialNumber : null,
    matched: true, method: status.source || 'SNMP', foundInSubnet: ip.split('.').slice(0, 3).join('.'),
    subnetDescription: 'Consulta direta por IP' }];
}

// Identity comes from persisted physical readings, never from an IP or a display name.
export function classifyScannedPrinter(device, printers, getCachedStatus) {
  const detected = { serialNumber: serialKey(device.serial), macAddress: formatMacAddress(device.mac) };
  const identityOf = printer => {
    const info = getCachedStatus(printer.id)?.info || {};
    return { serialNumber: serialKey(printer.serialNumber || info.serialNumber),
      macAddress: formatMacAddress(printer.macAddress || info.macAddress) };
  };
  const existingByIp = printers.find(p => p.ip === device.ip);
  const matched = printers.find(p => {
    const prior = identityOf(p);
    return (prior.serialNumber && prior.serialNumber === detected.serialNumber) ||
      (prior.macAddress && prior.macAddress === detected.macAddress);
  });
  const previous = existingByIp || matched;
  if (!previous) return { identityState: 'unregistered' };
  const previousIdentity = identityOf(previous);
  const context = { registeredName: previous.name, registeredLocation: previous.location,
    registeredUnit: previous.unitName, registeredUnitId: previous.unitId,
    previousIp: previous.ip, previousIdentity };
  if (hasPrinterIdentityConflict(previousIdentity, detected) ||
      (existingByIp && matched && existingByIp.id !== matched.id)) {
    return { ...context, identityState: 'replacement_required', replacementRequired: true,
      replacementPrinterId: previous.id };
  }
  if (!matched) return { ...context, identityState: 'unconfirmed', identityUnconfirmed: true,
    existingPrinterId: previous.id };
  return { ...context, identityState: 'confirmed', registeredPrinterId: matched.id };
}
