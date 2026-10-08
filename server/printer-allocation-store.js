import crypto from 'node:crypto';
import { getBusinessDateKey } from './date-utils.js';

export function ensurePrinterAllocationSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS printer_allocations (
      id TEXT PRIMARY KEY,
      printer_id TEXT NOT NULL REFERENCES printers(id) ON DELETE RESTRICT,
      unit_id TEXT, unit_name TEXT, location TEXT,
      started_at TEXT NOT NULL, ended_at TEXT,
      start_counter INTEGER, end_counter INTEGER,
      source TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_printer_allocation_open
      ON printer_allocations(printer_id) WHERE ended_at IS NULL;
    CREATE TABLE IF NOT EXISTS printer_allocation_page_history (
      allocation_id TEXT NOT NULL REFERENCES printer_allocations(id) ON DELETE RESTRICT,
      date TEXT NOT NULL, start_page_count INTEGER NOT NULL, end_page_count INTEGER NOT NULL,
      last_updated_at TEXT NOT NULL,
      PRIMARY KEY(allocation_id, date)
    );
    CREATE TRIGGER IF NOT EXISTS preserve_printer_replacement_history
    BEFORE DELETE ON printers
    WHEN EXISTS (SELECT 1 FROM printer_replacements WHERE replaced_printer_id = OLD.id OR new_printer_id = OLD.id)
    BEGIN SELECT RAISE(ABORT, 'Ativo vinculado ao histórico de substituição não pode ser excluído.'); END;
  `);
}
export function openAllocation(database, printer, counter = null, source = 'observed', now = new Date().toISOString()) {
  const current = database.prepare('SELECT * FROM printer_allocations WHERE printer_id = ? AND ended_at IS NULL').get(printer.id);
  if (current) return current;
  const id = `alloc-${crypto.randomUUID()}`;
  database.prepare(`INSERT INTO printer_allocations
    (id, printer_id, unit_id, unit_name, location, started_at, start_counter, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, printer.id, printer.unit_id ?? printer.unitId ?? null, printer.unit_name ?? printer.unitName ?? null,
      printer.location ?? null, now, counter, source);
  if (Number.isSafeInteger(counter) && counter >= 0) {
    database.prepare(`INSERT INTO printer_allocation_page_history
      (allocation_id, date, start_page_count, end_page_count, last_updated_at) VALUES (?, ?, ?, ?, ?)`)
      .run(id, getBusinessDateKey(new Date(now)), counter, counter, now);
  }
  return database.prepare('SELECT * FROM printer_allocations WHERE id = ?').get(id);
}
export function closeAllocation(database, printer, counter, now) {
  // Sem prova retroativa: o primeiro retrato de um ativo legado começa agora.
  openAllocation(database, printer, null, 'legacy_snapshot', now);
  database.prepare('UPDATE printer_allocations SET ended_at = ?, end_counter = ? WHERE printer_id = ? AND ended_at IS NULL')
    .run(now, counter ?? null, printer.id);
}
export function recordAllocationCount(database, printer, counter, now) {
  const allocation = openAllocation(database, printer, counter, 'first_reading', now);
  if (allocation.start_counter === null) {
    database.prepare('UPDATE printer_allocations SET start_counter = ? WHERE id = ?').run(counter, allocation.id);
  }
  database.prepare(`INSERT INTO printer_allocation_page_history
    (allocation_id, date, start_page_count, end_page_count, last_updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(allocation_id, date) DO UPDATE SET end_page_count = excluded.end_page_count, last_updated_at = excluded.last_updated_at`)
    .run(allocation.id, getBusinessDateKey(), counter, counter, now);
}
