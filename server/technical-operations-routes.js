import { Router } from 'express';
import { requireAuth, requireAdmin } from './auth.js';
import { captureTechnicalSnapshot, compareTechnicalSnapshots, remotePanelSupport, summarizeRecurrence, TECHNICAL_ACTIONS } from './technical-diagnostics.js';
import { getTechnicalIntervention, listTechnicalInterventions, startTechnicalIntervention, appendTechnicalEvent, replayTechnicalEvent } from './technical-audit-store.js';

export function createTechnicalOperationsRouter({ db, getCachedStatus, refreshPrinter }) {
  const router = Router(), inFlight = new Map();
  router.use('/:id/technical', requireAuth(), (req, res, next) => {
    const printer = db.getPrinterById(req.params.id);
    if (!printer) return res.status(404).json({ error: 'Impressora não encontrada.' });
    if (req.user.role !== 'admin' && (!req.user.unitId || req.user.unitId !== printer.unitId)) return res.status(403).json({ error: 'Impressora fora da sua unidade.' });
    req.printer = printer; res.set('Cache-Control', 'no-store'); next();
  });
  const snapshot = printer => captureTechnicalSnapshot({ printer,
    cached: getCachedStatus(printer.id) || db.getCachedStatus(printer.id) || {},
    report: db.getPrinterAlertReport(printer.id), health: db.getPrinterHealth(printer.id) });
  const recordFor = (req, res) => {
    const record = getTechnicalIntervention(db.getDb(), req.params.interventionId);
    if (!record || record.printerId !== req.printer.id) { res.status(404).json({ error: 'Intervenção não encontrada para esta impressora.' }); return null; }
    return record;
  };
  const errorResponse = (res, error) => res.status(error.status || 400).json({ error: error.message });
  router.get('/:id/technical', (req, res) => {
    const current = snapshot(req.printer);
    res.json({ printerId: req.printer.id, snapshot: current, actions: TECHNICAL_ACTIONS,
      audit: listTechnicalInterventions(db.getDb(), req.printer.id, req.query),
      recurrence: summarizeRecurrence(db.getDb(), req.printer.id), remote: remotePanelSupport(req.printer, current) });
  });
  router.post('/:id/technical/interventions', requireAdmin, (req, res) => {
    try { const result = startTechnicalIntervention(db.getDb(), { printer: req.printer, snapshot: snapshot(req.printer), input: req.body || {}, actor: req.user.username });
      res.status(result.duplicate ? 200 : 201).json(result); } catch (error) { errorResponse(res, error); }
  });
  router.post('/:id/technical/interventions/:interventionId/outcome', requireAdmin, (req, res) => {
    try {
      const record = recordFor(req, res); if (!record) return;
      const after = snapshot(req.printer), result = appendTechnicalEvent(db.getDb(), { record, actor: req.user.username,
        request: req.body || {}, kind: 'outcome', snapshot: after, comparison: compareTechnicalSnapshots(record.before, after, record.startedAt) });
      res.status(result.duplicate ? 200 : 201).json(result);
    } catch (error) { errorResponse(res, error); }
  });
  router.post('/:id/technical/interventions/:interventionId/verify', requireAdmin, async (req, res) => {
    try {
      let record = recordFor(req, res); if (!record) return;
      if (!record.outcome || record.outcome.result !== 'performed') return res.status(409).json({ error: 'Declare a intervenção realizada antes de verificar a telemetria.' });
      const replay = replayTechnicalEvent(db.getDb(), { record, actor: req.user.username, request: req.body || {}, kind: 'verification' });
      if (replay) return res.json(replay);
      const printerId = req.printer.id;
      if (!inFlight.has(printerId)) inFlight.set(printerId, Promise.resolve().then(() => refreshPrinter(req.printer)).finally(() => inFlight.delete(printerId)));
      await inFlight.get(printerId);
      const current = db.getPrinterById(printerId);
      if (!current || current.ip !== req.printer.ip || current.unitId !== req.printer.unitId) return res.status(409).json({ error: 'O cadastro mudou durante a coleta. Consulte os detalhes novamente.' });
      record = getTechnicalIntervention(db.getDb(), record.id);
      const after = snapshot(current), result = appendTechnicalEvent(db.getDb(), { record, actor: req.user.username,
        request: req.body || {}, kind: 'verification', snapshot: after, comparison: compareTechnicalSnapshots(record.before, after, record.startedAt) });
      res.status(result.duplicate ? 200 : 201).json({ ...result, telemetry: getCachedStatus(current.id) || db.getCachedStatus(current.id) });
    } catch (error) { errorResponse(res, error); }
  });
  return router;
}
