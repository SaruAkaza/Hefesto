import crypto from 'node:crypto';
import { isIP } from 'node:net';
import { physicalSerialKey, hasPrinterIdentityConflict } from './printer-identity.js';
import { getBusinessDateKey } from './date-utils.js';
import { openAllocation, closeAllocation } from './printer-allocation-store.js';

const text = value => typeof value === 'string' ? value.trim() : '';
function macKey(value) {
  if (!text(value)) return null;
  const clean = text(value).replace(/[:-]/g, '').toUpperCase();
  if (!/^[A-F0-9]{12}$/.test(clean)) throw new Error('MAC inválido.');
  return clean.match(/.{2}/g).join(':');
}
function counter(value) {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('O contador deve ser inteiro não negativo ou desconhecido (null).');
  return value;
}
function sameSerial(a, b) {
  const key = physicalSerialKey(a);
  return key !== null && key === physicalSerialKey(b);
}
function storedMac(value) {
  try { return macKey(value); } catch { return null; }
}

export function replacePrinter(database, options = {}) {
  const { replacedPrinterId, associatedPrinterId, newPrinter = {}, confirmed, initialCounter } = options;
  if (confirmed !== true) throw new Error('A substituição requer confirmação explícita (confirmed: true).');
  if (!text(options.replacedBy)) throw new Error('Responsável pela substituição é obrigatório.');
  if (!text(options.reason)) throw new Error('Motivo da substituição é obrigatório.');
  const suppliedCounter = counter(initialCounter);
  const now = new Date().toISOString();
  database.exec('BEGIN IMMEDIATE');
  try {
    const old = database.prepare('SELECT * FROM printers WHERE id = ?').get(replacedPrinterId);
    if (!old) throw new Error('Impressora substituída não encontrada.');
    if (old.is_active === 0) throw new Error('Esta impressora já está desativada. Atualize a tela antes de repetir a operação.');
    const oldCache = database.prepare('SELECT * FROM printer_status_cache WHERE printer_id = ?').get(old.id);
    const existing = associatedPrinterId ? database.prepare('SELECT * FROM printers WHERE id = ?').get(associatedPrinterId) : null;
    if (associatedPrinterId && !existing) throw new Error('Impressora de reserva não encontrada.');
    if (existing?.id === old.id) throw new Error('Não é possível substituir uma impressora por ela mesma.');
    if (!existing && newPrinter.id && database.prepare('SELECT 1 FROM printers WHERE id = ?').get(newPrinter.id)) {
      throw new Error('ID já cadastrado. Selecione explicitamente a associação de equipamento existente.');
    }
    const cache = existing ? database.prepare('SELECT * FROM printer_status_cache WHERE printer_id = ?').get(existing.id) : null;
    const ip = text(newPrinter.ip || existing?.ip);
    if (isIP(ip) !== 4) throw new Error('Endereço IPv4 válido é obrigatório.');
    const name = text(existing?.name || newPrinter.name);
    if (!name) throw new Error('Nome da nova impressora é obrigatório.');
    const model = text(cache?.model || newPrinter.model) || null;
    const serial = text(newPrinter.serialNumber || newPrinter.serial_number || newPrinter.serial || cache?.serial_number) || null;
    const mac = macKey(newPrinter.macAddress || newPrinter.mac_address || existing?.mac_address);
    if (existing && hasPrinterIdentityConflict({ serialNumber: cache?.serial_number, macAddress: existing.mac_address }, { serialNumber: serial, macAddress: mac })) {
      throw new Error('A identidade detectada difere do equipamento selecionado. Cadastre o novo ativo em vez de sobrescrever a reserva.');
    }
    if (sameSerial(oldCache?.serial_number, serial) || (old.mac_address && mac && storedMac(old.mac_address) === mac)) {
      throw new Error('Os identificadores indicam o mesmo equipamento. Para mudança de endereço, edite o IP sem substituir.');
    }
    for (const other of database.prepare(`SELECT p.id, p.mac_address, c.serial_number FROM printers p
      LEFT JOIN printer_status_cache c ON c.printer_id = p.id WHERE p.id != ? AND p.id != ?`).all(old.id, existing?.id || '')) {
      if (sameSerial(other.serial_number, serial) || (other.mac_address && mac && storedMac(other.mac_address) === mac)) {
        throw new Error('Equipamento já cadastrado. Associe o ativo existente para preservar seu histórico.');
      }
    }
    const unitId = options.targetUnitId ?? newPrinter.unitId ?? newPrinter.unit_id ?? old.unit_id ?? null;
    const unit = unitId ? database.prepare('SELECT * FROM units WHERE id = ?').get(unitId) : null;
    if (unitId && !unit) throw new Error('Unidade de destino não encontrada.');
    const unitName = unit?.name || text(options.targetUnitName || newPrinter.unitName || newPrinter.unit_name || old.unit_name) || null;
    const location = text(options.targetLocation ?? newPrinter.location ?? old.location) || null;
    const baseline = suppliedCounter ?? (existing ? counter(cache?.page_count) : counter(newPrinter.initial_page_count));
    const id = existing?.id || newPrinter.id || `prn-${crypto.randomUUID()}`;
    const mode = existing ? 'associated_existing' : (options.replacementMode === 'manual' ? 'manual' : 'created_new');
    closeAllocation(database, old, oldCache?.page_count ?? null, now);
    if (existing) closeAllocation(database, existing, baseline, now);
    database.prepare('DELETE FROM pending_recharges WHERE printer_id = ?').run(old.id);
    database.prepare(`UPDATE printers SET archived_ip = COALESCE(archived_ip, ip), ip = ?,
      is_active = 0, decommissioned_at = ?, updated_at = ? WHERE id = ?`)
      .run(`${old.ip}#replaced_${crypto.randomUUID()}`, now, now, old.id);
    if (existing) {
      database.prepare(`UPDATE printers SET ip = ?, unit_id = ?, unit_name = ?, location = ?, mac_address = ?,
        is_active = 1, decommissioned_at = NULL, archived_ip = NULL, updated_at = ? WHERE id = ?`)
        .run(ip, unitId, unitName, location, mac, now, id);
      database.prepare(`INSERT INTO printer_status_cache (printer_id, page_count, model, serial_number, online, cached_at)
        VALUES (?, ?, ?, ?, 0, ?) ON CONFLICT(printer_id) DO UPDATE SET
        page_count = COALESCE(excluded.page_count, printer_status_cache.page_count),
        model = excluded.model, serial_number = excluded.serial_number, online = 0, cached_at = excluded.cached_at`)
        .run(id, baseline, model, serial, now);
    } else {
      database.prepare(`INSERT INTO printers (id, name, ip, location, unit_id, unit_name, community,
        initial_page_count, hefesto_activated_at, installed_at, mac_address, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`)
        .run(id, name, ip, location, unitId, unitName, text(newPrinter.community) || 'public', baseline, now, now, mac, now, now);
      database.prepare(`INSERT INTO printer_status_cache (printer_id, page_count, model, serial_number, cached_at)
        VALUES (?, ?, ?, ?, ?)`).run(id, baseline, model, serial, now);
    }
    // Nunca sobrescrever a produção prévia de uma reserva neste dia.
    if (baseline !== null) database.prepare(`INSERT INTO page_history
      (printer_id, date, start_page_count, end_page_count, last_updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(printer_id, date) DO NOTHING`).run(id, getBusinessDateKey(), baseline, baseline, now);
    openAllocation(database, { id, unit_id: unitId, unit_name: unitName, location }, baseline, 'replacement', now);
    const replacementId = `sub-${crypto.randomUUID()}`;
    database.prepare(`INSERT INTO printer_replacements (
      id, replaced_printer_id, new_printer_id, replaced_model, replaced_serial, replaced_mac,
      new_model, new_serial, new_mac, target_unit_id, target_unit_name, target_location,
      replacement_mode, replaced_at, replaced_by, reason, initial_counter, notes, confirmed, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`)
      .run(replacementId, old.id, id, oldCache?.model || null, oldCache?.serial_number || null, old.mac_address,
        model, serial, mac, unitId, unitName, location, mode, now, text(options.replacedBy), text(options.reason),
        baseline, text(options.notes) || null, now);
    database.exec('COMMIT');
    return { success: true, replacementId, replacementMode: mode,
      targetSector: { unitId, unitName, location },
      replacedPrinter: { id: old.id, name: old.name, model: oldCache?.model || null, serial: oldCache?.serial_number || null, mac: old.mac_address, preservedHistory: true },
      newPrinter: { id, name, model, serial, mac, initialCounter: baseline },
      replacedAt: now, replacedBy: text(options.replacedBy), reason: text(options.reason) };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
