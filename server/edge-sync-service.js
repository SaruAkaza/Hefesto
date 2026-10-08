import http from 'http';
import https from 'https';
import * as db from './db.js';

let syncTimer = null;
let inFlight = false;

const syncStatus = {
  inFlight: false,
  lastSyncTime: null,
  lastSuccess: null,
  lastError: null,
  syncedPrintersCount: 0,
  syncedRechargesCount: 0,
  hubUrl: null,
  isEdge: false,
  edgeUnitName: ''
};

/**
 * Utilitário HTTP/HTTPS nativo sem dependências externas adicionais
 */
function requestJson(urlStr, options = {}, bodyData = null) {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(urlStr);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers: {
          'Accept': 'application/json',
          ...(options.headers || {})
        },
        timeout: options.timeout || 15000
      };

      if (bodyData) {
        reqOptions.headers['Content-Type'] = 'application/json';
        reqOptions.headers['Content-Length'] = Buffer.byteLength(bodyData);
      }

      const req = client.request(reqOptions, (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          try {
            const parsed = raw ? JSON.parse(raw) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.error || `HTTP ${res.statusCode}: ${res.statusMessage}`));
            }
          } catch (e) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ raw });
            } else {
              reject(new Error(`HTTP ${res.statusCode}: Resposta não-JSON recebida`));
            }
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy(new Error('Tempo limite de conexão esgotado (timeout 15s)'));
      });

      if (bodyData) {
        req.write(bodyData);
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Inicializa o serviço de sincronização do Edge (Filial)
 */
export async function initEdgeSyncService(options = {}) {
  const appMode = (process.env.APP_MODE || options.appMode || 'hub').toLowerCase();
  const isEdge = appMode === 'edge';
  const hubUrl = (process.env.HUB_URL || options.hubUrl || '').replace(/\/+$/, '');
  const hubToken = process.env.HUB_TOKEN || options.hubToken || '';
  const edgeUnitName = process.env.EDGE_UNIT_NAME || options.edgeUnitName || 'Filial Local';
  const edgeUnitId = process.env.EDGE_UNIT_ID || options.edgeUnitId || '';
  const intervalSec = parseInt(process.env.EDGE_SYNC_INTERVAL_SEC || options.intervalSec || '300', 10);
  const bootstrapOnInit = process.env.EDGE_BOOTSTRAP_ON_INIT !== 'false';

  syncStatus.isEdge = isEdge;
  syncStatus.hubUrl = hubUrl;
  syncStatus.edgeUnitName = edgeUnitName;

  if (!isEdge) {
    console.log('[EdgeSync] Modo Hub (Matriz) ativo. Aguardando sincronizações satélites das filiais.');
    return;
  }

  if (!hubUrl || !hubToken) {
    console.warn('[EdgeSync] HUB_URL/HUB_TOKEN não configurados. Sincronização Edge desabilitada até a configuração do ambiente.');
    return;
  }

  console.log('\x1b[35m%s\x1b[0m', `====================================================`);
  console.log('\x1b[35m%s\x1b[0m', ` [HEFESTO EDGE] INICIADO EM MODO FILIAL`);
  console.log('\x1b[36m%s\x1b[0m', ` -> Filial Local:    ${edgeUnitName}`);
  console.log('\x1b[36m%s\x1b[0m', ` -> Servidor Hub:    ${hubUrl}`);
  console.log('\x1b[36m%s\x1b[0m', ` -> Intervalo Sync:  ${intervalSec} segundos`);
  console.log('\x1b[35m%s\x1b[0m', `====================================================`);

  // Se o banco local estiver vazio de impressoras e configurado para bootstrap, tenta carregar da Matriz
  if (bootstrapOnInit) {
    try {
      const localPrinters = db.getPrinters();
      if (localPrinters.length === 0) {
        console.log(`[EdgeSync] Banco local vazio. Tentando bootstrap inicial para "${edgeUnitName}" a partir da Matriz...`);
        await bootstrapFromHub({ hubUrl, hubToken, edgeUnitName });
      }
    } catch (err) {
      console.warn('[EdgeSync] Falha no bootstrap inicial (continuando operação local normal):', err.message);
    }
  }

  // Executa uma sincronização inicial após 10 segundos para dar tempo ao servidor local de inicializar caches
  setTimeout(() => {
    triggerEdgeSync({ hubUrl, hubToken, edgeUnitName, edgeUnitId }).catch(() => {});
  }, 10000);

  // Intervalo periódico em background
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(() => {
    triggerEdgeSync({ hubUrl, hubToken, edgeUnitName, edgeUnitId }).catch(() => {});
  }, intervalSec * 1000);
}

/**
 * Dispara uma sincronização imediata do Edge para a Matriz
 */
export async function triggerEdgeSync(customParams = {}) {
  if (inFlight) {
    return { success: false, message: 'Sincronização já em andamento.', status: syncStatus };
  }

  const hubUrl = (customParams.hubUrl || process.env.HUB_URL || syncStatus.hubUrl || '').replace(/\/+$/, '');
  const hubToken = customParams.hubToken || process.env.HUB_TOKEN || '';
  const edgeUnitName = customParams.edgeUnitName || process.env.EDGE_UNIT_NAME || syncStatus.edgeUnitName || 'Filial Local';
  const edgeUnitId = customParams.edgeUnitId || process.env.EDGE_UNIT_ID || '';

  if (!hubUrl || !hubToken) {
    return { success: false, message: 'HUB_URL/HUB_TOKEN não configurados.', status: syncStatus };
  }

  inFlight = true;
  syncStatus.inFlight = true;

  let attemptedOutbox = [];
  try {
    const allPrinters = db.getPrinters({ includeInactive: true }) || [];
    const printers = allPrinters.filter(p => {
      if (!edgeUnitId && !edgeUnitName) return true;
      if (edgeUnitId && p.unitId) return p.unitId === edgeUnitId;
      if (edgeUnitName && p.unitName && p.unitName.toLowerCase() === edgeUnitName.toLowerCase()) return true;
      // Impressoras sem unidade associada explicitamente no edge herdam a unidade da filial
      return !p.unitId && (!p.unitName || p.unitName === 'Sem Unidade' || p.unitName === 'Filial Local');
    });

    const enrichedPrinters = printers.map(p => {
      let cachedStatus = null;
      try {
        cachedStatus = db.getCachedStatus(p.id);
      } catch {}
      return {
        id: p.id,
        name: p.name,
        ip: p.ip,
        registryIp: p.registryIp,
        isActive: p.isActive,
        decommissionedAt: p.decommissionedAt,
        location: p.location,
        unitId: p.unitId || edgeUnitId,
        unitName: p.unitName || edgeUnitName,
        community: p.community,
        initialPageCount: p.initialPageCount,
        hefestoActivatedAt: p.hefestoActivatedAt,
        installedAt: p.installedAt,
        macAddress: p.macAddress,
        createdAt: p.createdAt,
        status: cachedStatus ? {
          online: Boolean(cachedStatus.online),
          observedAt: cachedStatus.observedAt || cachedStatus.cachedAt,
          status: cachedStatus.status,
          protocol: cachedStatus.protocol,
          alerts: cachedStatus.alerts,
          alertsAvailable: cachedStatus.alertsAvailable,
          statusCode: cachedStatus.status?.code ?? cachedStatus.statusCode ?? 3,
          statusDescription: cachedStatus.status?.description ?? cachedStatus.statusDescription ?? 'Operando',
          info: {
            pageCount: cachedStatus.info?.pageCount ?? cachedStatus.pageCount ?? null,
            model: cachedStatus.info?.model ?? cachedStatus.model ?? '',
            serialNumber: cachedStatus.info?.serialNumber ?? cachedStatus.serialNumber ?? ''
          },
          supplies: cachedStatus.supplies || [],
          trays: cachedStatus.trays || []
        } : null
      };
    });

    const scopedPrinterIds = new Set(printers.map(p => p.id));
    // Snapshot recente; a outbox entrega os eventos fora deste limite.
    const allRecharges = db.getRecharges() || [];
    const recharges = allRecharges
      .filter(r => scopedPrinterIds.has(r.printerId))
      .slice(0, 100);

    // Pega as reposições pendentes da filial
    const allReplenishments = typeof db.getReplenishments === 'function' ? db.getReplenishments() : [];
    const replenishments = allReplenishments
      .filter(rep => scopedPrinterIds.has(rep.printerId));

    // Itens pendentes na outbox de sincronização resiliente
    const pendingOutbox = db.getPendingSyncOutbox(50, { printerIds: printers.map(p => p.id), readyOnly: true });

    const payload = {
      edgeUnitName,
      edgeUnitId,
      nodeTimestamp: new Date().toISOString(),
      printersCount: enrichedPrinters.length,
      printers: enrichedPrinters,
      printerLifecycle: db.getPrinterLifecycleBundle(printers.map(p => p.id)),
      recharges: recharges.map(r => ({
        id: r.id,
        printerId: r.printerId,
        printerName: r.printerName,
        ip: r.ip,
        unitName: r.unitName || edgeUnitName,
        location: r.location,
        supplyName: r.supplyName,
        supplyType: r.supplyType,
        previousLevel: r.previousLevel,
        newLevel: r.newLevel,
        pageCount: r.pageCount,
        pagesSinceLastRecharge: r.pagesSinceLastRecharge,
        source: r.source,
        isFullRecharge: r.isFullRecharge,
        statusTag: r.statusTag,
        technician: r.technician,
        notes: r.notes,
        timestamp: r.timestamp
      })),
      replenishments: replenishments.map(rep => ({
        id: rep.id,
        printerId: rep.printerId,
        printerName: rep.printerName,
        location: rep.location,
        unitName: rep.unitName || edgeUnitName,
        orderStatus: rep.orderStatus,
        modelPart: rep.modelPart,
        percentage: rep.percentage,
        notes: rep.notes,
        createdAt: rep.createdAt,
        updatedAt: rep.updatedAt
      })),
      outbox: pendingOutbox.map(item => ({
        id: item.id,
        eventType: item.eventType || item.event_type,
        payload: item.payload,
        createdAt: item.createdAt || item.created_at
      }))
    };

    const targetUrl = `${hubUrl}/api/edge/sync`;
    attemptedOutbox = pendingOutbox;
    const res = await requestJson(targetUrl, {
      method: 'POST',
      headers: {
        'x-edge-token': hubToken
      }
    }, JSON.stringify(payload));

    if (res.success !== true) throw new Error('Hub não confirmou sucesso no processamento.');
    if (pendingOutbox.length) {
      if (!Array.isArray(res.acknowledgedOutboxIds)) throw new Error('Hub sem confirmação por ID; eventos mantidos na outbox.');
      const sentIds = new Set(pendingOutbox.map(item => item.id));
      if (res.acknowledgedOutboxIds.some(id => !sentIds.has(id))) throw new Error('Hub confirmou ID não enviado neste lote.');
      const acknowledged = [...new Set(res.acknowledgedOutboxIds)];
      db.markSyncOutboxItemsCompleted(acknowledged);
      attemptedOutbox = pendingOutbox.filter(item => !acknowledged.includes(item.id));
      if (attemptedOutbox.length) throw new Error(`${attemptedOutbox.length} evento(s) sem confirmação do Hub; entrega pendente.`);
    }

    syncStatus.lastSyncTime = new Date().toISOString();
    syncStatus.lastSuccess = true;
    syncStatus.lastError = null;
    syncStatus.syncedPrintersCount = enrichedPrinters.length;
    syncStatus.syncedRechargesCount = recharges.length;

    console.log(`\x1b[32m[EdgeSync]\x1b[0m Sincronização concluída com sucesso para a Matriz (${hubUrl}): ${enrichedPrinters.length} impressora(s), ${recharges.length} recarga(s), ${pendingOutbox.length} item(ns) outbox.`);
    return { success: true, message: 'Sincronizado com a Matriz com sucesso!', data: res, status: syncStatus };
  } catch (err) {
    // Falha: registrar erro na outbox para retry posterior
    try {
      const pendingOutbox = attemptedOutbox;
      if (pendingOutbox.length > 0 && typeof db.recordSyncOutboxError === 'function') {
        for (const item of pendingOutbox) {
          db.recordSyncOutboxError(item.id, err.message);
        }
      }
    } catch (outboxErr) {
      console.warn('[EdgeSync Outbox] Erro ao registrar falha na outbox:', outboxErr.message);
    }

    syncStatus.lastSyncTime = new Date().toISOString();
    syncStatus.lastSuccess = false;
    syncStatus.lastError = err.message || 'Erro desconhecido na conexão com o Hub';

    console.warn(`\x1b[33m[EdgeSync]\x1b[0m Aviso: Não foi possível sincronizar com o Hub (${hubUrl}): ${err.message}. Operação local mantida.`);
    return { success: false, message: `Falha de conexão com a Matriz: ${err.message}`, status: syncStatus };
  } finally {
    inFlight = false;
    syncStatus.inFlight = false;
  }
}

/**
 * Baixa impressoras da Matriz para a unidade local (Bootstrap inicial)
 */
export async function bootstrapFromHub(options = {}) {
  const hubUrl = (options.hubUrl || process.env.HUB_URL || syncStatus.hubUrl || '').replace(/\/+$/, '');
  const hubToken = options.hubToken || process.env.HUB_TOKEN || '';
  const edgeUnitName = options.edgeUnitName || process.env.EDGE_UNIT_NAME || syncStatus.edgeUnitName || '';

  if (!edgeUnitName) {
    throw new Error('Nome da filial (EDGE_UNIT_NAME) não especificado para bootstrap.');
  }
  if (!hubUrl || !hubToken) {
    throw new Error('HUB_URL/HUB_TOKEN não configurados para bootstrap.');
  }

  const targetUrl = `${hubUrl}/api/edge/bootstrap?unitName=${encodeURIComponent(edgeUnitName)}`;
  const data = await requestJson(targetUrl, {
    method: 'GET',
    headers: {
      'x-edge-token': hubToken
    }
  });

  let importedPrinters = 0;
  if (data?.printerLifecycle) {
    db.applyPrinterLifecycleSync({ printers: data.printers || [], ...data.printerLifecycle });
    importedPrinters = data.printers.length;
  }
  if (data && Array.isArray(data.printers) && !data.printerLifecycle) {
    for (const p of data.printers) {
      try {
        db.savePrinter({
          id: p.id,
          name: p.name,
          ip: p.ip,
          location: p.location,
          unitId: p.unitId,
          unitName: edgeUnitName,
          community: p.community || 'public',
          initialPageCount: p.initialPageCount ?? null,
          hefestoActivatedAt: p.hefestoActivatedAt,
          installedAt: p.installedAt,
          macAddress: p.macAddress,
          createdAt: p.createdAt
        });
        importedPrinters++;
      } catch (err) {
        console.warn(`[EdgeSync Bootstrap] Erro ao importar impressora ${p.ip}:`, err.message);
      }
    }
  }

  let importedRecharges = 0;
  if (data && Array.isArray(data.recharges)) {
    for (const r of data.recharges) {
      try {
        db.recordRecharge({
          ...r,
          unitName: edgeUnitName
        }, { suppressSync: true });
        importedRecharges++;
      } catch (err) {
        // Ignora duplicatas na importação
      }
    }
  }

  console.log(`\x1b[32m[EdgeSync Bootstrap]\x1b[0m Carga inicial da filial concluída: ${importedPrinters} impressoras importadas, ${importedRecharges} recargas.`);
  return {
    success: true,
    importedPrinters,
    importedRecharges
  };
}

/**
 * Retorna o status atual da sincronização
 */
export function getSyncStatus() {
  return {
    ...syncStatus,
    inFlight
  };
}
