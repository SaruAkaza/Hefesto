import { Router } from 'express';
import { isIP } from 'node:net';
import { requireAuth, requireAdmin } from './auth.js';

export function createPrinterReplacementRouter({ db, queryPrinterStatus, getPrinterMacAddress, onReplaced = () => {} }) {
  const router = Router();
  router.get('/printer-assets', requireAuth(), (req, res) => res.json(db.getPrinters({ includeInactive: true })));
  router.get('/printer-replacements', requireAuth(), (req, res) => res.json(db.getPrinterReplacements()));
  router.get('/printers/:id/replacements', requireAuth(), (req, res) => res.json(db.getPrinterReplacements(req.params.id)));
  router.get('/printers/:id/asset-history', requireAuth(), (req, res) => {
    const printer = db.getPrinterById(req.params.id);
    if (!printer) return res.status(404).json({ error: 'Impressora não encontrada.' });
    res.json({ printer, status: db.getCachedStatus(printer.id), replacements: db.getPrinterReplacements(printer.id),
      allocations: db.getPrinterAllocations(printer.id),
      pageHistory: db.getAllPageHistory().filter(h => h.printerId === printer.id),
      recharges: db.getRecharges().filter(h => h.printerId === printer.id) });
  });
  router.post('/printers/:id/replacement-preview', requireAdmin, async (req, res) => {
    const printer = db.getPrinterById(req.params.id);
    if (!printer?.isActive) return res.status(404).json({ error: 'Impressora ativa não encontrada.' });
    const ip = typeof req.body?.ip === 'string' ? req.body.ip.trim() : '';
    if (isIP(ip) !== 4) return res.status(400).json({ error: 'Endereço IPv4 válido é obrigatório.' });
    const community = typeof req.body?.community === 'string' ? req.body.community.trim() : 'public';
    try {
      const [status, macAddress] = await Promise.all([
        queryPrinterStatus(ip, community).catch(() => null), getPrinterMacAddress(ip).catch(() => null)
      ]);
      const raw = status?.info?.pageCount;
      res.json({ ip, online: status?.online === true, macAddress: macAddress || null,
        info: { model: status?.info?.model || null, serialNumber: status?.info?.serialNumber || null,
          pageCount: Number.isSafeInteger(raw) && raw >= 0 ? raw : null },
        message: status?.online ? 'Consulta concluída. Revise os dados antes de confirmar.' : 'Sem leitura válida. Preencha manualmente os dados disponíveis.' });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });
  router.post('/printers/:id/replace', requireAdmin, (req, res) => {
    let result;
    try {
      result = db.executePrinterReplacement({ ...req.body, replacedPrinterId: req.params.id, replacedBy: req.user.username });
    } catch (error) {
      return res.status(error.message.includes('não encontrada') ? 404 : 400).json({ error: error.message });
    }
    // Notificações de cache/sincronização acontecem depois do commit e não desfazem a troca.
    try { onReplaced(result); }
    catch (error) { console.warn('[Substituição] Falha na notificação após a gravação:', error.message); }
    return res.status(201).json(result);
  });
  return router;
}
