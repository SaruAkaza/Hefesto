import { Router } from 'express';
import { requireAdmin } from './auth.js';
import { PRINTING_COST_CATALOG, PRINTING_COST_REFERENCE } from './printing-cost-catalog.js';
import { listPrintingCostTariffs, savePrintingCostTariff } from './printing-cost-store.js';
import { calculatePrintingCostReport, calculatePrintingCostMonthlyHistory } from './printing-cost-service.js';
import { listPrintingPagePrices, currentPrintingPagePriceOptions, savePrintingPagePrice } from './printing-cost-prices.js';

export function createPrintingCostRouter(getDatabase) {
  const router = Router();
  router.use(requireAdmin);
  router.get('/config', (req, res) => {
    const database = getDatabase();
    const tariffs = listPrintingCostTariffs(database);
    const printers = database.prepare(`SELECT p.id, p.name, p.ip, p.unit_id AS unitId, p.unit_name AS unitName,
      p.location, p.is_active AS isActive, c.model, c.serial_number AS serialNumber
      FROM printers p LEFT JOIN printer_status_cache c ON c.printer_id=p.id ORDER BY p.unit_name, p.location, p.name`).all();
    const units = database.prepare('SELECT id, name FROM units ORDER BY name').all();
    const historicalSectors = tariffs.map(t => ({ unitId: t.unit_id, location: t.location }));
    const sectors = [...new Map([...printers, ...historicalSectors].filter(p => p.location).map(p => [JSON.stringify([p.unitId, p.location]), { unitId: p.unitId, location: p.location }])).values()];
    const pagePrices = listPrintingPagePrices(database);
    res.json({ reference: PRINTING_COST_REFERENCE, catalog: PRINTING_COST_CATALOG, printers, units, tariffs, sectors,
      pagePrices, pagePriceOptions: currentPrintingPagePriceOptions(pagePrices) });
  });
  router.post('/tariffs', (req, res) => {
    try { res.status(201).json(savePrintingCostTariff(getDatabase(), req.body || {}, req.user.username)); }
    catch (error) { res.status(400).json({ error: error.message }); }
  });
  router.post('/page-prices', (req, res) => {
    try { res.status(201).json(savePrintingPagePrice(getDatabase(), req.body || {}, req.user.username)); }
    catch (error) { res.status(400).json({ error: error.message }); }
  });
  router.get('/report', (req, res) => {
    try { res.json(calculatePrintingCostReport(getDatabase(), req.query)); }
    catch (error) { res.status(400).json({ error: error.message }); }
  });
  router.get('/history', (req, res) => {
    try { res.json(calculatePrintingCostMonthlyHistory(getDatabase(), req.query)); }
    catch (error) { res.status(400).json({ error: error.message }); }
  });
  return router;
}
