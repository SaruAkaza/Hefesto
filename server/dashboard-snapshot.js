import { createHash, randomUUID } from 'node:crypto';

// Retain signatures, never historical telemetry payloads. Unknown revisions receive a full snapshot.
export function createDashboardSnapshot(read, { historyLimit = 16 } = {}) {
  const prefix = randomUUID(), history = new Map();
  let sequence = 0, latest = null;
  return (req, res) => {
    try {
      const data = read(), signatures = new Map(), values = new Map();
      const add = (key, value) => {
        signatures.set(key, createHash('sha256').update(JSON.stringify(value)).digest('hex'));
        values.set(key, value);
      };
      for (const key of ['units', 'printers', 'healthOverview', 'rechargesSummary', 'collectionAt']) add(key, data[key]);
      for (const status of data.statuses) add('status:' + status.id, status);
      for (const item of data.health) add('health:' + item.printerId, item);
      const same = latest && signatures.size === latest.signatures.size && [...signatures].every(([key, hash]) => latest.signatures.get(key) === hash);
      if (!same) {
        latest = { revision: prefix + ':' + ++sequence, signatures };
        history.set(latest.revision, signatures);
        while (history.size > historyLimit) history.delete(history.keys().next().value);
      }
      res.setHeader('Cache-Control', 'no-store');
      if (req.query.since === latest.revision) return res.status(204).end();
      const previous = typeof req.query.since === 'string' ? history.get(req.query.since) : null;
      const result = { revision: latest.revision, full: !previous, statuses: [], health: [], removedIds: [] };
      for (const [key, value] of values) {
        if (previous?.get(key) === signatures.get(key)) continue;
        if (key.startsWith('status:')) result.statuses.push(value);
        else if (key.startsWith('health:')) result.health.push(value);
        else result[key] = value;
      }
      for (const key of previous?.keys() || []) {
        if (key.startsWith('status:') && !signatures.has(key)) result.removedIds.push(key.slice(7));
      }
      res.json(result);
    } catch (error) {
      console.error('[Dashboard snapshot]', error.code || error.name);
      res.status(500).json({ error: 'Não foi possível atualizar o painel.' });
    }
  };
}
