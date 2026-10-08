/**
 * ==========================================================================
 * MONITOR DE IMPRESSORAS - PAINEL OPERACIONAL E GERENCIAL
 * ==========================================================================
 */

// ==========================================================================
// 1. DICIONÁRIO DE ÍCONES VETORIAIS SVG
// ==========================================================================
const Icons = {
  printer: `<svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
  eye: `<svg class="icon icon-xs" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/></svg>`,
  refresh: `<svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`,
  edit: `<svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
  trash: `<svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
  zap: `<svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  alertTriangle: `<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`,
  checkCircle: `<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  alertOctagon: `<svg class="icon icon-sm" viewBox="0 0 24 24"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
  wifiOff: `<svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="1" x2="23" y1="1" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" x2="12.01" y1="20" y2="20"/></svg>`,
  toner: `<svg class="icon icon-xs" viewBox="0 0 24 24"><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/></svg>`,
  paper: `<svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  crown: `<svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M5 16 3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5Z"/><path d="M5 19h14v2H5z"/></svg>`,
  folder: `<svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>`,
  clock: `<svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  plus: `<svg class="icon icon-xs" viewBox="0 0 24 24"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>`,
  info: `<svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg>`,
  more: `<svg class="icon icon-xs" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,
  search: `<svg class="icon icon-xs" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`
};

// ==========================================================================
// 2. ESTADO GLOBAL DA APLICAÇÃO (PROJETO HEFESTO)
// ==========================================================================
const AppState = {
  theme: 'dark',
  userRole: 'operator',       // 'operator' | 'admin'
  units: [],
  printers: [],
  statusData: new Map(),
  healthData: new Map(),       // MON-001.1: saúde operacional por impressora
  healthOverview: null,        // Resumo agregado retornado por /api/health
  rechargesSummary: {},       // Resumo de última recarga por impressora
  rechargesList: [],          // Histórico completo de recargas
  seenRechargeIds: new Set(), // IDs de recargas já notificadas via Toast em tempo real
  activeUnitFilter: '',
  activeFloorFilter: '',      // Filtro de andar ativo (ex: '1º Andar', 'Térreo' ou '' para todos)
  collapsedFloors: new Set(), // Andares recolhidos na visão agrupada
  overviewFilter: 'all',
  locationFilter: '',
  sortBy: 'lowest-supply',
  searchQuery: '',
  testedPrinterIp: '',
  // Módulo de Volume e Previsibilidade (Projeto Hefesto)
  activeAdminTab: 'printers', // 'printers' | 'forecast'
  forecastData: [],
  stagedSheetPrinters: [],    // impressoras pré-carregadas da planilha
  forecastSearch: '',
  forecastUnitFilter: '',
  forecastWorkloadFilter: '',
  forecastTimeFilter: '',
  loginUnitSearchQuery: '',
  activeRegionFilter: 'all',  // 'all' | 'RJ' | 'SP'
  loginRegionFilter: 'all',   // 'all' | 'RJ' | 'SP'
  isRefreshing: false,
  autoRefreshInterval: null,
  lastUpdated: null,
  refreshIntervalMs: 15000, // atualização leve da tela; coleta permanece independente

  // Hefesto Edge (Filiais) & Hub (Matriz)
  systemMode: 'hub',
  isEdge: false,
  edgeUnitName: '',
  edgeUnitId: '',
  hubUrl: '',
  syncStatus: null
};

// ==========================================================================
// 3. SELETORES DO DOM
// ==========================================================================
const DOM = {
  // Modal Subir Planilha de Impressoras
  btnImportSheetHeader: document.getElementById('btn-import-sheet-header'),
  modalImportSheet: document.getElementById('modal-import-sheet'),
  btnCloseModalSheet: document.getElementById('btn-close-modal-sheet'),
  btnCancelModalSheet: document.getElementById('btn-cancel-modal-sheet'),
  btnConfirmImportSheet: document.getElementById('btn-confirm-import-sheet'),
  sheetDefaultUnit: document.getElementById('sheet-default-unit'),
  sheetDefaultRegion: document.getElementById('sheet-default-region'),
  btnSheetQuickNewUnit: document.getElementById('btn-sheet-quick-new-unit'),
  tabSheetFile: document.getElementById('tab-sheet-file'),
  tabSheetPaste: document.getElementById('tab-sheet-paste'),
  panelSheetFile: document.getElementById('panel-sheet-file'),
  panelSheetPaste: document.getElementById('panel-sheet-paste'),
  sheetDropzone: document.getElementById('sheet-dropzone'),
  dropzoneTitle: document.getElementById('dropzone-title'),
  sheetFileInput: document.getElementById('sheet-file-input'),
  btnBrowseSheet: document.getElementById('btn-browse-sheet'),
  sheetPasteInput: document.getElementById('sheet-paste-input'),
  btnParsePasted: document.getElementById('btn-parse-pasted'),
  sheetPreviewContainer: document.getElementById('sheet-preview-container'),
  previewFilenameBadge: document.getElementById('preview-filename-badge'),
  previewCountNew: document.getElementById('preview-count-new'),
  previewCountUpdate: document.getElementById('preview-count-update'),
  previewCountTotal: document.getElementById('preview-count-total'),
  sheetPreviewBody: document.getElementById('sheet-preview-body'),

  // Tela de Login / Seleção Inicial
  loginOverlay: document.getElementById('login-overlay'),
  tabLoginOperator: document.getElementById('tab-login-operator'),
  tabLoginAdmin: document.getElementById('tab-login-admin'),
  formLoginUnit: document.getElementById('form-login-unit'),
  formLoginAdmin: document.getElementById('form-login-admin'),
  loginRegionPills: document.getElementById('login-region-pills'),
  loginUnitSearchInput: document.getElementById('login-unit-search-input'),
  loginUnitSearchClear: document.getElementById('btn-clear-login-unit-search'),
  loginUnitSelect: document.getElementById('login-unit-select'),
  loginUnitHint: document.getElementById('login-unit-hint'),
  adminUserInput: document.getElementById('admin-user-input'),
  adminPasswordInput: document.getElementById('admin-password-input'),
  adminRememberInput: document.getElementById('admin-remember-input'),
  loginMainTitle: document.getElementById('login-main-title'),
  loginSystemTag: document.getElementById('login-system-tag'),
  loginMainDesc: document.getElementById('login-main-desc'),

  // Cabeçalho
  headerBrandTitle: document.getElementById('header-brand-title'),
  appVersionText: document.getElementById('app-version-text'),
  edgeModeBadge: document.getElementById('edge-mode-badge'),
  edgeModeBadgeText: document.getElementById('edge-mode-badge-text'),
  edgeHubSyncIndicator: document.getElementById('edge-hub-sync-indicator'),
  edgeHubSyncText: document.getElementById('edge-hub-sync-text'),
  btnForceEdgeSync: document.getElementById('btn-force-edge-sync'),
  currentUnitBadge: document.getElementById('current-unit-badge'),
  adminRoleBadge: document.getElementById('admin-role-badge'),
  headerUnitDesc: document.getElementById('header-unit-desc'),
  btnLogout: document.getElementById('btn-logout'),
  btnOpenDiagnoseIp: document.getElementById('btn-open-diagnose-ip'),
  btnOpenMacScanner: document.getElementById('btn-open-mac-scanner'),
  lastUpdatedText: document.getElementById('last-updated-text'),
  btnRefreshAll: document.getElementById('btn-refresh-all'),
  refreshIcon: document.getElementById('refresh-icon'),
  btnAddPrinterHeader: document.getElementById('btn-add-printer-header'),
  btnThemeToggle: document.getElementById('btn-theme-toggle'),
  themeIconMoon: document.getElementById('theme-icon-moon'),
  themeIconSun: document.getElementById('theme-icon-sun'),

  // Faixa de status do parque
  countConnectedBanner: document.getElementById('count-connected-banner'),
  overviewUnitSelectorBox: document.getElementById('overview-unit-selector-box'),
  overviewRegionPills: document.getElementById('overview-region-pills'),
  overviewUnitFilter: document.getElementById('overview-unit-filter'),
  countCritical: document.getElementById('count-critical'),
  countWarning: document.getElementById('count-warning'),
  countOffline: document.getElementById('count-offline'),
  countUnconfigured: document.getElementById('count-unconfigured'),

  // Seção "Minhas Impressoras"
  countAll: document.getElementById('count-all'),
  searchInput: document.getElementById('search-input'),
  filterLocationSelect: document.getElementById('filter-location-select'),
  sortFleetSelect: document.getElementById('sort-fleet-select'),
  fleetFloorNav: document.getElementById('fleet-floor-nav'),
  myPrintersListBody: document.getElementById('my-printers-list-body'),

  // Exportar Relatórios (Cabeçalho ADM)
  btnExportInkCsvHeader: document.getElementById('btn-export-ink-csv-header'),
  btnExportRechargesCsvHeader: document.getElementById('btn-export-recharges-csv-header'),
  btnExportIntegrationCsvHeader: document.getElementById('btn-export-integration-csv-header'),
  searchClearBtn: document.getElementById('search-clear-btn'),
  searchKeycap: document.getElementById('search-keycap'),

  // Modal Testar Conexão por IP
  modalTestIp: document.getElementById('modal-test-ip'),
  formTestIpModal: document.getElementById('form-test-ip-modal'),
  inputTestIp: document.getElementById('input-test-ip'),
  testIpResultBox: document.getElementById('test-ip-result-box'),
  btnSubmitTestIp: document.getElementById('btn-submit-test-ip'),
  btnQuickAddFromTest: document.getElementById('btn-quick-add-from-test'),
  btnCloseModalTestIp: document.getElementById('btn-close-modal-test-ip'),
  btnCancelModalTestIp: document.getElementById('btn-cancel-modal-test-ip'),

  // Modal Scanner de Rede por MAC Address
  modalMacScanner: document.getElementById('modal-mac-scanner'),
  btnToggleSubnetsCatalog: document.getElementById('btn-toggle-subnets-catalog'),
  macScannerSubnetsManager: document.getElementById('mac-scanner-subnets-manager'),
  corporateSubnetsCount: document.getElementById('corporate-subnets-count'),
  formAddCorporateSubnet: document.getElementById('form-add-corporate-subnet'),
  inputNewSubnet: document.getElementById('input-new-subnet'),
  inputNewSubnetDesc: document.getElementById('input-new-subnet-desc'),
  btnSaveCorporateSubnet: document.getElementById('btn-save-corporate-subnet'),
  corporateSubnetsList: document.getElementById('corporate-subnets-list'),
  formMacScanner: document.getElementById('form-mac-scanner'),
  macScanUnitSelect: document.getElementById('mac-scan-unit-select'),
  macScanSubnet: document.getElementById('mac-scan-subnet'),
  macScanSubnetRequired: document.getElementById('mac-scan-subnet-required'),
  macScanTargetMac: document.getElementById('mac-scan-target-mac'),
  macScannerProgress: document.getElementById('mac-scanner-progress'),
  macScannerStatusText: document.getElementById('mac-scanner-status-text'),
  macScannerCountText: document.getElementById('mac-scanner-count-text'),
  macScannerBar: document.getElementById('mac-scanner-bar'),
  macScannerResults: document.getElementById('mac-scanner-results'),
  btnSubmitMacScan: document.getElementById('btn-submit-mac-scan'),
  btnCloseModalMacScanner: document.getElementById('btn-close-modal-mac-scanner'),
  btnCancelModalMacScanner: document.getElementById('btn-cancel-modal-mac-scanner'),

  // Modal Atribuir / Vincular IP a Impressora
  modalAssignIp: document.getElementById('modal-assign-ip'),
  formAssignIp: document.getElementById('form-assign-ip'),
  btnCloseModalAssignIp: document.getElementById('btn-close-modal-assign-ip'),
  btnCancelModalAssignIp: document.getElementById('btn-cancel-modal-assign-ip'),
  btnSubmitAssignIp: document.getElementById('btn-submit-assign-ip'),
  assignIpDisplayIp: document.getElementById('assign-ip-display-ip'),
  assignIpDisplayMac: document.getElementById('assign-ip-display-mac'),
  assignIpDisplaySerial: document.getElementById('assign-ip-display-serial'),
  assignIpDisplaySerialContainer: document.getElementById('assign-ip-display-serial-container'),
  assignIpDisplayModel: document.getElementById('assign-ip-display-model'),
  assignIpVal: document.getElementById('assign-ip-val'),
  assignMacVal: document.getElementById('assign-mac-val'),
  assignSerialVal: document.getElementById('assign-serial-val'),
  assignTargetPrinterSelect: document.getElementById('assign-target-printer-select'),
  assignIpWarning: document.getElementById('assign-ip-warning'),

  // Modais Formulários Impressora
  modalPrinterForm: document.getElementById('modal-printer-form'),
  modalFormTitleText: document.getElementById('modal-form-title-text'),
  printerForm: document.getElementById('printer-form'),
  formId: document.getElementById('printer-form-id'),
  formUnitSelect: document.getElementById('printer-unit-select'),
  formName: document.getElementById('printer-name'),
  formIp: document.getElementById('printer-ip'),
  formMac: document.getElementById('printer-mac'),
  btnDetectPrinterMac: document.getElementById('btn-detect-printer-mac'),
  formLocation: document.getElementById('printer-location'),
  formCommunity: document.getElementById('printer-community'),
  formInitialPageCount: document.getElementById('printer-initial-page-count'),
  formActivatedAt: document.getElementById('printer-activated-at'),
  formInstalledAt: document.getElementById('printer-installed-at'),
  btnCloseModalForm: document.getElementById('btn-close-modal-form'),
  btnCancelModalForm: document.getElementById('btn-cancel-modal-form'),
  btnQuickNewUnit: document.getElementById('btn-quick-new-unit'),

  // Modal Unidade
  modalUnitForm: document.getElementById('modal-unit-form'),
  modalUnitFormTitleText: document.getElementById('modal-unit-form-title-text'),
  unitForm: document.getElementById('unit-form'),
  unitFormId: document.getElementById('unit-form-id'),
  unitNameInput: document.getElementById('unit-name'),
  unitRegionSelect: document.getElementById('unit-region'),
  unitDescInput: document.getElementById('unit-description'),
  btnCloseModalUnit: document.getElementById('btn-close-modal-unit'),
  btnCancelModalUnit: document.getElementById('btn-cancel-modal-unit'),

  // Modal Gerenciador de Pastas (Unidades)
  btnManageUnitsHeader: document.getElementById('btn-manage-units-header'),
  modalManageUnits: document.getElementById('modal-manage-units'),
  manageUnitsListBody: document.getElementById('manage-units-list-body'),
  btnOpenCreateUnitInsideManage: document.getElementById('btn-open-create-unit-inside-manage'),
  btnCloseModalManageUnits: document.getElementById('btn-close-modal-manage-units'),
  btnCloseModalManageUnitsBtn: document.getElementById('btn-close-modal-manage-units-btn'),

  // Modal Registro Manual de Recarga (Projeto Hefesto)
  modalManualRecharge: document.getElementById('modal-manual-recharge'),
  formManualRecharge: document.getElementById('form-manual-recharge'),
  rechargeModalPrinterInfo: document.getElementById('recharge-modal-printer-info'),
  rechargePrinterId: document.getElementById('recharge-printer-id'),
  rechargePrinterName: document.getElementById('recharge-printer-name'),
  rechargePrinterIp: document.getElementById('recharge-printer-ip'),
  rechargeUnitName: document.getElementById('recharge-unit-name'),
  rechargeLocation: document.getElementById('recharge-location'),
  rechargePageCount: document.getElementById('recharge-page-count'),
  rechargePageCountInput: document.getElementById('recharge-page-count-input'),
  rechargeUpdateBaseline: document.getElementById('recharge-update-baseline'),
  rechargeSupplySelect: document.getElementById('recharge-supply-select'),
  optRechargeFullCard: document.getElementById('opt-recharge-full-card'),
  optRechargePartialCard: document.getElementById('opt-recharge-partial-card'),
  optRechargeFullInput: document.getElementById('opt-recharge-full-input'),
  optRechargePartialInput: document.getElementById('opt-recharge-partial-input'),
  rechargeNewLevel: document.getElementById('recharge-new-level'),
  rechargeCustomDate: document.getElementById('recharge-custom-date'),
  rechargeTechnician: document.getElementById('recharge-technician'),
  rechargeNotes: document.getElementById('recharge-notes'),
  btnCloseModalRecharge: document.getElementById('btn-close-modal-recharge'),
  btnCancelModalRecharge: document.getElementById('btn-cancel-modal-recharge'),

  // Modal Edição de Instalação Física
  modalEditInstalledAt: document.getElementById('modal-edit-installed-at'),
  formEditInstalledAt: document.getElementById('form-edit-installed-at'),
  editInstalledPrinterId: document.getElementById('edit-installed-printer-id'),
  installedModalPrinterInfo: document.getElementById('installed-modal-printer-info'),
  editInstalledDateInput: document.getElementById('edit-installed-date-input'),
  btnCloseModalInstalled: document.getElementById('btn-close-modal-installed'),
  btnCancelModalInstalled: document.getElementById('btn-cancel-modal-installed'),

  // Side Drawer Raio-X
  drawerPrinterDetail: document.getElementById('drawer-printer-detail'),
  detailPrinterName: document.getElementById('detail-printer-name'),
  detailModalBody: document.getElementById('detail-modal-body'),
  btnDetailClose: document.getElementById('btn-detail-close'),
  btnDetailRefresh: document.getElementById('btn-detail-refresh'),
  btnDetailEdit: document.getElementById('btn-detail-edit'),
  btnDetailDelete: document.getElementById('btn-detail-delete'),
  btnCloseDrawerDetail: document.getElementById('btn-close-drawer-detail'),

  // Histórico Recente de Trocas da Unidade
  unitRecentRechargesSection: document.getElementById('unit-recent-recharges-section'),
  unitRecentRechargesList: document.getElementById('unit-recent-recharges-list'),
  unitRechargesCountBadge: document.getElementById('unit-recharges-count-badge'),
  toggleUnitRechargesBtn: document.getElementById('toggle-unit-recharges-btn'),
  btnToggleUnitRechargesText: document.getElementById('btn-toggle-unit-recharges-text'),

  // Abas Administrativas & Previsibilidade
  adminMainTabs: document.getElementById('admin-main-tabs'),
  btnTabPrinters: document.getElementById('btn-tab-printers'),
  btnTabForecast: document.getElementById('btn-tab-forecast'),
  tabViewPrinters: document.getElementById('tab-view-printers'),
  tabViewForecast: document.getElementById('tab-view-forecast'),
  kpiPagesToday: document.getElementById('kpi-pages-today'),
  kpiPagesWeek: document.getElementById('kpi-pages-week'),
  kpiPagesMonth: document.getElementById('kpi-pages-month'),
  kpiCriticalSwapsCount: document.getElementById('kpi-critical-swaps-count'),
  kpiPeriodToday: document.getElementById('kpi-period-today'),
  kpiPeriodWeek: document.getElementById('kpi-period-week'),
  kpiPeriodMonth: document.getElementById('kpi-period-month'),
  kpiPeriodSwaps: document.getElementById('kpi-period-swaps'),
  kpiSubPagesToday: document.getElementById('kpi-sub-pages-today'),
  kpiSubPagesWeek: document.getElementById('kpi-sub-pages-week'),
  kpiSubPagesMonth: document.getElementById('kpi-sub-pages-month'),
  kpiSubCriticalSwaps: document.getElementById('kpi-sub-critical-swaps'),
  btnExportForecastCsv: document.getElementById('btn-export-forecast-csv'),
  forecastSearchInput: document.getElementById('forecast-search-input'),
  forecastUnitSelect: document.getElementById('forecast-unit-select'),
  forecastWorkloadSelect: document.getElementById('forecast-workload-select'),
  forecastTimeFilter: document.getElementById('forecast-time-filter'),
  forecastTableBody: document.getElementById('forecast-table-body'),

  // Botão Voltar ao Topo
  btnScrollTop: document.getElementById('btn-scroll-top'),

  toastContainer: document.getElementById('toast-container')
};

// ==========================================================================
// 4. API CLIENT & AUTHENTICATION
// ==========================================================================
function getAuthToken() {
  return sessionStorage.getItem('hefesto_session_token') || localStorage.getItem('hefesto_session_token') || '';
}

function setAuthToken(token, remember = false) {
  if (token) {
    sessionStorage.setItem('hefesto_session_token', token);
    if (remember) {
      localStorage.setItem('hefesto_session_token', token);
    } else {
      localStorage.removeItem('hefesto_session_token');
    }
  } else {
    sessionStorage.removeItem('hefesto_session_token');
    localStorage.removeItem('hefesto_session_token');
  }
}

async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getAuthToken();
  if (token && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && !url.includes('/api/auth/')) {
    setAuthToken(null);
    if (AppState.userRole === 'admin') {
      window.ReleaseNotes?.onLogout();
      window.DashboardRefresh?.reset();
      window.WorkstationModule?.closeDetail();
      AppState.userRole = 'operator';
      sessionStorage.removeItem('auth_role');
      localStorage.removeItem('auth_role');
      if (typeof showToast === 'function') {
        showToast('Sessão administrativa expirada. Por favor, faça login novamente.', 'warning');
      }
      if (DOM.loginOverlay) {
        DOM.loginOverlay.classList.add('active');
        if (typeof setLoginMode === 'function') setLoginMode('admin');
      }
    }
  }
  return res;
}

const API = {
  async getTechnicalReport(id, offset = 0) {
    const res = await apiFetch(`/api/printers/${encodeURIComponent(id)}/technical?limit=30&offset=${offset}`);
    if (!res.ok) throw new Error('Não foi possível consultar o histórico técnico');
    return res.json();
  },
  async technicalRequest(id, path, input) {
    const res = await apiFetch(`/api/printers/${encodeURIComponent(id)}/technical/interventions${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input)
    });
    const result = await res.json(); if (!res.ok) throw new Error(result.error || 'Não foi possível registrar');
    return result;
  },
  startTechnicalIntervention(id, input) { return this.technicalRequest(id, '', input); },
  technicalOutcome(id, recordId, input) { return this.technicalRequest(id, `/${encodeURIComponent(recordId)}/outcome`, input); },
  verifyTechnicalIntervention(id, recordId, input) { return this.technicalRequest(id, `/${encodeURIComponent(recordId)}/verify`, input); },
  async getPrinterAlerts(id, offset = 0) {
    const res = await apiFetch(`/api/printers/${encodeURIComponent(id)}/alerts?limit=50&offset=${offset}`);
    if (!res.ok) throw new Error('Não foi possível consultar os alertas');
    return res.json();
  },
  async getSystemMode() {
    try {
      const res = await apiFetch('/api/system/mode');
      return res.ok ? await res.json() : { appMode: 'hub', isEdge: false };
    } catch {
      return { appMode: 'hub', isEdge: false };
    }
  },
  async verifyAdmin(username, password) {
    const res = await apiFetch('/api/auth/verify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Credenciais inválidas.');
    }
    const data = await res.json();
    if (data.token) {
      setAuthToken(data.token, true);
    }
    return data;
  },
  async checkSession() {
    try {
      const res = await apiFetch('/api/auth/session');
      return res.ok ? await res.json() : { authenticated: false, role: null };
    } catch {
      return { authenticated: false, role: null };
    }
  },
  async logout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setAuthToken(null);
  },
  async triggerEdgeSync() {
    const res = await apiFetch('/api/edge/trigger-sync', { method: 'POST' });
    return res.ok ? await res.json() : { success: false, message: 'Falha no disparo de sincronização' };
  },
  async getUnits() {
    const res = await apiFetch('/api/units');
    return res.ok ? await res.json() : [];
  },
  async addUnit(data) {
    const res = await apiFetch('/api/units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao salvar unidade');
    }
    return await res.json();
  },
  async updateUnit(id, data) {
    const res = await apiFetch(`/api/units/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao atualizar unidade');
    }
    return await res.json();
  },
  async deleteUnit(id) {
    const res = await apiFetch(`/api/units/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao excluir unidade');
    }
  },
  async getPrinters() {
    const res = await apiFetch('/api/printers');
    return res.ok ? await res.json() : [];
  },
  async addPrinter(data) {
    const res = await apiFetch('/api/printers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao cadastrar impressora');
    }
    return await res.json();
  },
  async batchImportPrinters(payload) {
    const res = await apiFetch('/api/printers/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao importar planilha de impressoras');
    }
    return await res.json();
  },
  async updatePrinter(id, data) {
    const res = await apiFetch(`/api/printers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = new Error(err.error || 'Erro ao atualizar impressora');
      error.code = err.code;
      throw error;
    }
    return await res.json();
  },
  async deletePrinter(id) {
    const res = await apiFetch(`/api/printers/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao excluir impressora');
    }
  },
  async calibrateInitialCounts(unitId = null) {
    const res = await apiFetch('/api/printers/calibrate-initial-counts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitId })
    });
    return await res.json();
  },
  async getPrinterStatus(id) {
    const res = await apiFetch(`/api/printers/${id}/status`);
    if (!res.ok) throw new Error('Erro ao consultar status da impressora');
    const json = await res.json();
    return json.data || json;
  },
  async testAnyIp(ip) {
    const res = await apiFetch(`/api/test-ip?ip=${encodeURIComponent(ip)}`);
    return res.ok ? await res.json() : { success: false, message: 'Falha na resposta do servidor' };
  },
  async detectPrinterMac(ip) {
    const res = await apiFetch(`/api/network/detect-mac?ip=${encodeURIComponent(ip)}`);
    return res.ok ? await res.json() : { success: false, message: 'Não foi possível consultar o MAC' };
  },
  async scanSubnetForMac(payload) {
    const res = await apiFetch('/api/network/scan-mac', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro na varredura de sub-rede');
    }
    return await res.json();
  },
  async reconcilePrinterIp(payload) {
    const res = await apiFetch('/api/network/reconcile-ip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao reconciliar IP');
    }
    return await res.json();
  },
  async assignIpToPrinter(payload) {
    const res = await apiFetch('/api/network/assign-ip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao atribuir IP à impressora');
    }
    return await res.json();
  },
  async getCorporateSubnets() {
    const res = await apiFetch('/api/network/subnets');
    if (!res.ok) throw new Error('Erro ao carregar catálogo de faixas corporativas');
    return await res.json();
  },
  async addCorporateSubnet(payload) {
    const res = await apiFetch('/api/network/subnets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao adicionar faixa corporativa');
    }
    return await res.json();
  },
  async deleteCorporateSubnet(id) {
    const res = await apiFetch(`/api/network/subnets/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao excluir faixa corporativa');
    }
    return await res.json();
  },
  async getAllStatus(force = false) {
    const res = await apiFetch(`/api/status/all${force ? '?force=true' : ''}`);
    return res.ok ? await res.json() : [];
  },
  async getHealthOverview() {
    const res = await apiFetch('/api/health');
    if (!res.ok) throw new Error('Erro ao carregar saúde operacional');
    return await res.json();
  },
  async getPrinterHealth(id) {
    const res = await apiFetch(`/api/printers/${encodeURIComponent(id)}/health`);
    if (!res.ok) return null;
    return await res.json();
  },

  // Projeto Hefesto: Métodos de Recargas
  async getRechargesSummary() {
    const res = await apiFetch('/api/recharges/summary');
    return res.ok ? await res.json() : {};
  },
  async getRecharges(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await apiFetch(`/api/recharges${query ? '?' + query : ''}`);
    return res.ok ? await res.json() : [];
  },
  async getRecentRechargeEvents() {
    const res = await apiFetch('/api/recharges/recent-events');
    return res.ok ? await res.json() : [];
  },
  async addRecharge(data) {
    const res = await apiFetch('/api/recharges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao registrar recarga');
    }
    return await res.json();
  },
  async deleteRecharge(id) {
    const res = await apiFetch(`/api/recharges/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erro ao excluir registro de recarga');
  },

  // Motor Analítico de Volume e Previsibilidade (Projeto Hefesto)
  async getVolumeForecast() {
    const res = await apiFetch('/api/analytics/volume-forecast');
    return res.ok ? await res.json() : [];
  },

  // Relatório Histórico de Início na Rede & Integração
  async getInitialIntegrationReport() {
    const res = await apiFetch('/api/reports/initial-integration');
    return res.ok ? await res.json() : [];
  },

  // Identidade Visual / White-Label
  async getBranding() {
    try {
      const res = await apiFetch('/api/config/branding');
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }
};

async function applyBranding() {
  try {
    const branding = await API.getBranding();
    if (!branding) return;
    AppState.branding = branding;

    const brandName = branding.brandName || 'HEFESTO';
    const companyName = branding.companyName || brandName;
    const subTitle = branding.subTitle || 'Monitor de Impressoras e Gestão de Suprimentos';
    const systemTag = branding.systemTag || `${companyName} • Gestão de Tecnologia`;

    // Atualiza título da página
    document.title = `${brandName} — Painel de Monitoramento de Impressoras`;

    // Atualiza Tela de Acesso
    const loginCompanyEl = document.querySelector('.login-brand-company');
    if (loginCompanyEl) loginCompanyEl.textContent = companyName.toUpperCase();

    const loginTagEl = document.querySelector('.login-brand-text span');
    if (loginTagEl) loginTagEl.textContent = systemTag;

    // Atualiza Cabeçalho
    const brandTextSpan = document.querySelector('.brand-text span');
    if (brandTextSpan) brandTextSpan.textContent = companyName.toUpperCase();

    if (DOM.headerUnitDesc && !AppState.activeUnitFilter) {
      DOM.headerUnitDesc.textContent = subTitle;
    }
  } catch (err) {
    console.warn('[Branding] Usando identidade padrão:', err);
  }
}

// ==========================================================================
// COMPARADOR RESILIENTE DE FILTROS DE UNIDADE (ID / NOME NORMALIZADO)
// ==========================================================================
function matchesUnitFilter(item, filter) {
  if (!filter) return true;
  if (!item) return false;
  if (item.unitId && (item.unitId === filter || item.unitId.toLowerCase() === filter.toLowerCase())) {
    return true;
  }
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const itemNorm = norm(item.unitName);
  const filterNorm = norm(filter);
  if (!itemNorm || !filterNorm) return false;
  return itemNorm === filterNorm || itemNorm.includes(filterNorm) || filterNorm.includes(itemNorm);
}

// ==========================================================================
// 5. TRADUÇÃO DE SUPRIMENTOS E CORES PARA PORTUGUÊS
// ==========================================================================
function translateSupplyName(name, type = '') {
  if (!name) return 'Suprimento';
  const lower = name.toLowerCase();

  // 1. Caixas de Resíduos
  if (lower.includes('waste') || lower.includes('resíduo') || lower.includes('residuo')) {
    return 'Garrafa de Resíduo de Toner';
  }
  if (lower.includes('maintenance box') || lower.includes('caixa de manutenção') || lower.includes('caixa de manutencao')) {
    return 'Caixa de Manutenção';
  }

  // 2. Fotocondutores / Cilindros (Drums)
  if (lower.includes('drum') || lower.includes('imaging') || lower.includes('fotocondutor') || lower.includes('cilindro') || type === 'imaging_kit') {
    if (lower.includes('black') || lower.includes('preto') || lower.includes('[r1]')) return 'Cilindro Preto';
    if (lower.includes('cyan') || lower.includes('ciano') || lower.includes('[r2]')) return 'Cilindro Ciano';
    if (lower.includes('magenta') || lower.includes('[r3]')) return 'Cilindro Magenta';
    if (lower.includes('yellow') || lower.includes('amarel') || lower.includes('[r4]')) return 'Cilindro Amarelo';
    return 'Kit Fotocondutor / Cilindro';
  }

  // 3. Fusores e Transferência
  if (lower.includes('fuser') || lower.includes('fusor') || type === 'fuser') {
    return 'Unidade Fusora';
  }
  if (lower.includes('transfer') || type === 'transfer') {
    return 'Módulo de Transferência';
  }
  if (lower.includes('maintenance kit') || lower.includes('kit de manutenção')) {
    return 'Kit de Manutenção Preventiva';
  }

  // 4. Toners e Tintas com slots múltiplos (K1, K2, etc.)
  if (lower.includes('k1') || lower.includes('[k1]')) return 'Toner Preto (K1)';
  if (lower.includes('k2') || lower.includes('[k2]')) return 'Toner Preto (K2)';
  if (lower.includes('black') || lower.includes('preto') || lower.includes('preta') || lower.includes('k cartridge') || lower.includes('bk') || lower.includes('t11a1')) {
    return 'Toner / Tinta Preta';
  }
  if (lower.includes('cyan') || lower.includes('ciano') || lower.includes('c cartridge') || lower.includes('[c]') || lower.includes('t11a2')) {
    return 'Toner / Tinta Ciano';
  }
  if (lower.includes('magenta') || lower.includes('m cartridge') || lower.includes('[m]') || lower.includes('t11a3')) {
    return 'Toner / Tinta Magenta';
  }
  if (lower.includes('yellow') || lower.includes('amarelo') || lower.includes('amarela') || lower.includes('y cartridge') || lower.includes('[y]') || lower.includes('t11a4')) {
    return 'Toner / Tinta Amarela';
  }

  return name;
}

function getSupplyColorByName(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('cyan') || n.includes('ciano') || n.includes('[c]') || n.includes('[r2]') || n.includes('t11a2')) return '#06b6d4'; // Cyan
  if (n.includes('magenta') || n.includes('[m]') || n.includes('[r3]') || n.includes('t11a3')) return '#ec4899'; // Magenta
  if (n.includes('yellow') || n.includes('amarel') || n.includes('[y]') || n.includes('[r4]') || n.includes('t11a4')) return '#eab308'; // Yellow
  if (n.includes('black') || n.includes('preto') || n.includes('preta') || n.includes('[k') || n.includes('[r1]') || n.includes('t11a1')) return '#334155'; // Black
  return 'var(--color-primary)';
}

function normalizeSupplyPercentage(supply) {
  return HefestoSupplySemantics.describe(supply).percentage ?? -1;
}

function getOperationalSupplies(supplies) {
  if (!Array.isArray(supplies)) return [];
  const known = supplies.filter(s => normalizeSupplyPercentage(s) >= 0);
  const dualBlack = known.filter(s => HefestoSupplySemantics.component(s) === 'consumable' && /(?:^|[^a-z0-9])k[12](?:[^a-z0-9]|$)/i.test(s.name || ''));
  if (dualBlack.length < 2 || !dualBlack.some(s => normalizeSupplyPercentage(s) > 10)) return known;
  return known.filter(s => !dualBlack.includes(s) || normalizeSupplyPercentage(s) > 10);
}

function isWasteSupply(supply) {
  return HefestoSupplySemantics.component(supply) === 'receptacle' ||
    /maintenance box|caixa de manuten[cç][aã]o/i.test(supply?.name || '');
}

function extractInkLevels(supplies = []) {
  const result = { black: null, cyan: null, magenta: null, yellow: null };

  supplies.forEach(s => {
    const pct = normalizeSupplyPercentage(s);
    if (pct < 0) return;
    const lower = s.name.toLowerCase();

    if (lower.includes('black') || lower.includes('preto') || lower.includes('preta') || lower.includes('bk') || lower.includes('k cartridge') || lower.includes('tanque de tinta preta')) {
      if (result.black === null || pct < result.black) result.black = pct;
    } else if (lower.includes('cyan') || lower.includes('ciano') || lower.includes('c cartridge')) {
      if (result.cyan === null || pct < result.cyan) result.cyan = pct;
    } else if (lower.includes('magenta') || lower.includes('m cartridge')) {
      if (result.magenta === null || pct < result.magenta) result.magenta = pct;
    } else if (lower.includes('yellow') || lower.includes('amarelo') || lower.includes('y cartridge')) {
      if (result.yellow === null || pct < result.yellow) result.yellow = pct;
    }
  });

  return result;
}

// ==========================================================================
// 6. FORMATAÇÃO DE DATAS E TEMPO RELATIVO (PROJETO HEFESTO)
// ==========================================================================
function formatFullDateTime(iso) {
  if (!iso) return 'N/D';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'N/D';
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'N/D';
  }
}

function formatRelativeTime(iso) {
  if (!iso) return 'Sem registro';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Sem registro';
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 2) return 'Agora mesmo';
    if (diffMin < 60) return `Há ${diffMin} min`;
    if (diffHours < 24) {
      if (d.getDate() === now.getDate()) {
        return `Hoje às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      }
      return `Há ${diffHours}h`;
    }
    if (diffDays === 1) {
      return `Ontem às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (diffDays < 7) {
      return `Há ${diffDays} dias`;
    }
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return 'Sem registro';
  }
}

// ==========================================================================
// 7. TEMA (DARK / LIGHT)
// ==========================================================================
function initTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(currentTheme);

  DOM.btnThemeToggle.addEventListener('click', () => {
    const newTheme = AppState.theme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    showToast(`Modo ${newTheme === 'dark' ? 'Escuro' : 'Claro'} ativado`, 'info');
  });
}

function applyTheme(theme) {
  AppState.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);

  if (theme === 'dark') {
    DOM.themeIconMoon.style.display = 'block';
    DOM.themeIconSun.style.display = 'none';
  } else {
    DOM.themeIconMoon.style.display = 'none';
    DOM.themeIconSun.style.display = 'block';
  }
}

// ==========================================================================
// 8. CARREGAMENTO E SINCRONIZAÇÃO DE DADOS
// ==========================================================================
async function loadDashboardData(showLoading = true, force = false) {
  if (AppState.isRefreshing) return;
  AppState.isRefreshing = true;
  window.DashboardRefresh?.reset();

  if (DOM.refreshIcon) DOM.refreshIcon.classList.add('rotating');
  if (DOM.btnRefreshAll) {
    DOM.btnRefreshAll.disabled = true;
    DOM.btnRefreshAll.setAttribute('aria-busy', 'true');
  }
  const refreshText = document.getElementById('btn-refresh-text');
  if (refreshText) refreshText.textContent = 'Sincronizando...';
  const startTime = Date.now();

  try {
    const [units, printers] = await Promise.all([
      API.getUnits(),
      API.getPrinters()
    ]);

    AppState.units = units;
    AppState.printers = printers;

    if (AppState.printers.length === 0) {
      AppState.statusData.clear();
      AppState.healthData.clear();
      AppState.healthOverview = null;
      AppState.rechargesSummary = {};
      renderAllViews();
      updateLastUpdatedTimestamp();
      return;
    }

    // A telemetria forçada precisa terminar antes da leitura do Health Engine,
    // evitando exibir status novo com saúde do ciclo anterior.
    const [statuses, rechargesSummary] = await Promise.all([
      API.getAllStatus(force),
      API.getRechargesSummary()
    ]);
    const healthOverview = await API.getHealthOverview();

    AppState.statusData.clear();
    statuses.forEach(item => AppState.statusData.set(item.id, item));

    AppState.healthData.clear();
    (healthOverview?.printers || []).forEach(item => {
      if (item?.printerId && item?.health) AppState.healthData.set(item.printerId, item.health);
    });
    AppState.healthOverview = healthOverview || null;
    AppState.rechargesSummary = rechargesSummary || {};

    updateLastUpdatedTimestamp();
    renderAllViews();
    checkRecentRechargeEvents();

    if (force) {
      showToast('Telemetria e histórico de recargas sincronizados!', 'success');
    }

  } catch (err) {
    console.error('[Dashboard]', err);
    showToast(err.message || 'Erro ao conectar ao servidor', 'error');
  } finally {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, 650 - elapsed);
    setTimeout(() => {
      AppState.isRefreshing = false;
      if (DOM.refreshIcon) DOM.refreshIcon.classList.remove('rotating');
      if (DOM.btnRefreshAll) {
        DOM.btnRefreshAll.disabled = false;
        DOM.btnRefreshAll.removeAttribute('aria-busy');
      }
      if (refreshText) refreshText.textContent = 'Sincronizar';
    }, remaining);
  }
}

function renderAllViews() {
  updateHeaderRoleAndUnit();
  populateDropdownFilters();
  renderOverviewTab();
  if (AppState.activeAdminTab === 'forecast') {
    loadAndRenderForecastTab();
  }
}

// Controle de Permissões e Visibilidade baseado no Perfil (Operador vs Admin)
function updateHeaderRoleAndUnit() {
  const adminOnlyElements = document.querySelectorAll('.admin-only');

  if (AppState.userRole === 'admin') {
    // Modo Administrador (Ferramenta HEFESTO)
    if (DOM.headerBrandTitle) DOM.headerBrandTitle.textContent = 'HEFESTO';
    if (DOM.adminRoleBadge) DOM.adminRoleBadge.style.display = 'inline-flex';
    document.title = 'HEFESTO — Painel de Gestão & Administração TI';

    if (AppState.activeUnitFilter) {
      const u = AppState.units.find(x => x.id === AppState.activeUnitFilter);
      const reg = u ? (u.region || 'RJ') : '';
      if (DOM.currentUnitBadge) DOM.currentUnitBadge.textContent = u ? `${reg ? `[${reg}] ` : ''}${u.name}` : 'Unidade Selecionada';
      if (DOM.headerUnitDesc) DOM.headerUnitDesc.textContent = `Gestão focada na unidade: ${u ? u.name : ''}${reg ? ` (${reg})` : ''}`;
    } else {
      const regLabel = AppState.activeRegionFilter === 'RJ' ? ' (Rio de Janeiro)' : (AppState.activeRegionFilter === 'SP' ? ' (São Paulo)' : ' (Visão Global)');
      if (DOM.currentUnitBadge) DOM.currentUnitBadge.textContent = `Todas as Unidades${regLabel}`;
      if (DOM.headerUnitDesc) DOM.headerUnitDesc.textContent = `Painel Administrativo Completo - Acesso Total${regLabel}`;
    }

    if (DOM.overviewRegionPills) {
      DOM.overviewRegionPills.querySelectorAll('.region-pill').forEach(b => {
        b.classList.toggle('active', (b.dataset.region || 'all') === (AppState.activeRegionFilter || 'all'));
      });
    }

    adminOnlyElements.forEach(el => {
      if (el.id === 'unit-recent-recharges-section') {
        // Controlado separadamente pelo renderUnitRecentRecharges
      } else if (el.classList.contains('deck-action-cluster')) {
        el.style.display = 'flex';
      } else if (el.classList.contains('menu') || el.classList.contains('admin-unit-filter-slot')) {
        el.style.display = 'inline-flex';
      } else {
        el.style.display = el.tagName === 'BUTTON' ? 'inline-flex' : 'block';
      }
    });

  } else {
    // Modo Operador / Sessão do Usuário (HEFESTO)
    if (DOM.headerBrandTitle) DOM.headerBrandTitle.textContent = 'HEFESTO';
    if (DOM.adminRoleBadge) DOM.adminRoleBadge.style.display = 'none';
    document.title = 'Hefesto — Monitor de Impressoras';

    const selectedUnitObj = AppState.units.find(u => u.id === AppState.activeUnitFilter);
    if (selectedUnitObj) {
      const reg = selectedUnitObj.region || 'RJ';
      if (DOM.currentUnitBadge) DOM.currentUnitBadge.textContent = `[${reg}] ${selectedUnitObj.name}`;
      if (DOM.headerUnitDesc) DOM.headerUnitDesc.textContent = selectedUnitObj.description || `Operação local da unidade ${selectedUnitObj.name} (${reg})`;
    } else {
      if (DOM.currentUnitBadge) DOM.currentUnitBadge.textContent = 'Minha Unidade';
      if (DOM.headerUnitDesc) DOM.headerUnitDesc.textContent = 'Visão operacional da unidade em tempo real';
    }

    // Esconde botões de administração técnica
    closeOpenMenus();
    adminOnlyElements.forEach(el => {
      el.style.display = 'none';
    });
  }

  // Gerencia visibilidade das abas (comutável tanto para Administrador quanto para Visualizador de Unidade)
  applyAdminTabVisibility();
}

function populateLoginUnitSelect() {
  if (!DOM.loginUnitSelect) return;

  const query = (AppState.loginUnitSearchQuery || '').trim().toLowerCase();
  const regionFilter = AppState.loginRegionFilter || 'all';

  // Filtrar unidades por região e por texto da busca (nome ou descrição)
  let filtered = AppState.units || [];
  if (regionFilter !== 'all') {
    filtered = filtered.filter(u => (u.region || 'RJ') === regionFilter);
  }
  if (query) {
    filtered = filtered.filter(u => {
      const name = (u.name || '').toLowerCase();
      const desc = (u.description || '').toLowerCase();
      return name.includes(query) || desc.includes(query);
    });
  }

  const prevValue = DOM.loginUnitSelect.value;

  if (filtered.length === 0) {
    DOM.loginUnitSelect.innerHTML = '<option value="">Nenhuma unidade encontrada</option>';
    if (DOM.loginUnitHint) {
      DOM.loginUnitHint.textContent = 'Nenhuma unidade corresponde aos critérios informados.';
    }
    return;
  }

  const defaultText = query
    ? `Selecione entre as ${filtered.length} unidades encontradas...`
    : 'Selecione a sua unidade...';

  DOM.loginUnitSelect.innerHTML = `<option value="">${defaultText}</option>` +
    filtered.map(u => {
      const isSelected = prevValue === u.id;
      const reg = escapeHtml(u.region || 'RJ');
      return `<option value="${escapeHtml(u.id)}" ${isSelected ? 'selected' : ''}>[${reg}] ${escapeHtml(u.name)}</option>`;
    }).join('');

  // Se a busca retornar exatamente 1 resultado, auto-seleciona para agilizar o acesso
  if (query && filtered.length === 1) {
    DOM.loginUnitSelect.value = filtered[0].id;
  }

  if (DOM.loginUnitHint) {
    DOM.loginUnitHint.textContent = 'Exibição restrita aos equipamentos da unidade selecionada.';
  }
}

function populateDropdownFilters() {
  const curUnit = AppState.activeUnitFilter;
  const regFilter = AppState.activeRegionFilter || 'all';

  let overviewUnits = AppState.units || [];
  if (regFilter !== 'all') {
    overviewUnits = overviewUnits.filter(u => (u.region || 'RJ') === regFilter);
  }

  // Se a unidade ativa atual não estiver no escopo da região filtrada, redefinir
  if (curUnit && regFilter !== 'all' && !overviewUnits.some(u => u.id === curUnit)) {
    AppState.activeUnitFilter = '';
  }

  // Select no bloco Status Agora (Apenas Administrador)
  DOM.overviewUnitFilter.innerHTML = '<option value="">Todas as Unidades</option>' +
    overviewUnits.map(u => {
      const reg = escapeHtml(u.region || 'RJ');
      return `<option value="${escapeHtml(u.id)}" ${AppState.activeUnitFilter === u.id ? 'selected' : ''}>[${reg}] ${escapeHtml(u.name)}</option>`;
    }).join('');

  // Select na tela de Login (Operador)
  populateLoginUnitSelect();

  // Select no Modal de Cadastro
  if (DOM.formUnitSelect) {
    const activeSelected = AppState.activeUnitFilter || '';
    DOM.formUnitSelect.innerHTML = '<option value="">Selecione a Pasta de Unidade...</option>' +
      AppState.units.map(u => {
        const reg = escapeHtml(u.region || 'RJ');
        return `<option value="${escapeHtml(u.id)}" ${activeSelected === u.id ? 'selected' : ''}>[${reg}] ${escapeHtml(u.name)}</option>`;
      }).join('');
  }

  // Select no Modal de Upload de Planilha
  if (DOM.sheetDefaultUnit) {
    const curSheetUnit = DOM.sheetDefaultUnit.value;
    DOM.sheetDefaultUnit.innerHTML = '<option value="">Detectar pela coluna da planilha</option>' +
      AppState.units.map(u => {
        const reg = escapeHtml(u.region || 'RJ');
        return `<option value="${escapeHtml(u.id)}">[${reg}] ${escapeHtml(u.name)}</option>`;
      }).join('') +
      '<option value="__NEW_FOLDER__">➕ Criar nova pasta...</option>';
    if (curSheetUnit && curSheetUnit !== '__NEW_FOLDER__') {
      DOM.sheetDefaultUnit.value = curSheetUnit;
    }
  }

  updateLocationFilterOptions();
}

function updateLocationFilterOptions() {
  if (!DOM.filterLocationSelect) return;
  const scoped = getScopedPrinters();
  const curLoc = AppState.locationFilter || DOM.filterLocationSelect.value || '';

  const realFloors = new Set();
  scoped.forEach(p => {
    const f = parseFloorFromLocation(p.location);
    if (f) realFloors.add(f);
  });

  if (AppState.activeFloorFilter) {
    // Se um andar específico estiver selecionado nas pílulas:
    // Exibe apenas os setores daquele andar
    const floorLocations = new Set();
    scoped.forEach(p => {
      const pFloor = parseFloorFromLocation(p.location) || 'Outros';
      if (p.location?.trim() && pFloor === AppState.activeFloorFilter) {
        floorLocations.add(p.location.trim());
      }
    });

    const sortedLocs = Array.from(floorLocations).sort();
    let opts = `<option value="">Todos os Setores (${escapeHtml(AppState.activeFloorFilter)})</option>`;
    sortedLocs.forEach(loc => {
      const cleanName = getCleanSectorName(loc);
      opts += `<option value="${escapeHtml(loc)}" ${curLoc === loc ? 'selected' : ''}>${escapeHtml(cleanName)}</option>`;
    });
    DOM.filterLocationSelect.innerHTML = opts;
  } else {
    // Se a unidade só tiver 1 andar ou nenhum (ex: Unidade A, Unidade B), lista direta normal
    if (realFloors.size <= 1) {
      const allLocs = new Set();
      scoped.forEach(p => { if (p.location?.trim()) allLocs.add(p.location.trim()); });
      DOM.filterLocationSelect.innerHTML = '<option value="">Todos os Setores</option>' +
        Array.from(allLocs).sort().map(loc => `<option value="${escapeHtml(loc)}" ${curLoc === loc ? 'selected' : ''}>${escapeHtml(getCleanSectorName(loc))}</option>`).join('');
    } else {
      // Múltiplos andares: Agrupa por <optgroup>
      const floorMap = new Map();
      scoped.forEach(p => {
        const loc = p.location?.trim();
        if (loc) {
          const floor = parseFloorFromLocation(loc) || 'Outros Setores';
          if (!floorMap.has(floor)) floorMap.set(floor, new Set());
          floorMap.get(floor).add(loc);
        }
      });

      const sortedFloors = getSortedFloors(Array.from(floorMap.keys()));
      let opts = '<option value="">Todos os Setores (Todos os Andares)</option>';
      sortedFloors.forEach(floor => {
        const locs = Array.from(floorMap.get(floor) || []).sort();
        opts += `<optgroup label="${escapeHtml(floor)}">`;
        locs.forEach(loc => {
          const cleanName = getCleanSectorName(loc);
          opts += `<option value="${escapeHtml(loc)}" ${curLoc === loc ? 'selected' : ''}>${escapeHtml(cleanName)}</option>`;
        });
        opts += `</optgroup>`;
      });
      DOM.filterLocationSelect.innerHTML = opts;
    }
  }
}

// ==========================================================================
// FUNÇÕES AUXILIARES DE ANDAR & AGRUPAMENTO NATURAL (FLOOR MATRIX)
// ==========================================================================
function isFloorIndicator(str) {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim().toLowerCase();
  if (/^(t[ée]rreo|(-?\d+\s*[ºªo°a]?\s*)?sub[- ]?solo(\s*\d+)?|ss\s*\d*|mezanino|cobertura|anexo|externo)$/i.test(s)) return true;
  if (/(andar|pavimento|piso)/i.test(s) && (/\d/i.test(s) || /t[ée]rreo|sub[- ]?solo/i.test(s))) return true;
  if (/^\d+\s*[ºªo°a]$/i.test(s)) return true;
  return false;
}

function parseFloorFromLocation(location) {
  if (!location || typeof location !== 'string') return null;
  const match = location.match(/\(([^)]+)\)\s*$/);
  if (match && match[1] && isFloorIndicator(match[1])) {
    return match[1].trim();
  }
  return null;
}

function getCleanSectorName(location) {
  if (!location || typeof location !== 'string') return 'Setor Geral';
  const match = location.match(/\(([^)]+)\)\s*$/);
  if (match && match[1] && isFloorIndicator(match[1])) {
    return location.replace(/\s*\([^)]*\)\s*$/, '').trim() || location;
  }
  return location;
}

function getFloorNumericWeight(floorName) {
  if (!floorName) return 999;
  const lower = floorName.toLowerCase();
  if (lower.includes('subsolo') || lower.startsWith('ss')) {
    const numMatch = lower.match(/(\d+)/);
    return numMatch ? -parseInt(numMatch[1], 10) : -1;
  }
  if (lower.includes('térreo') || lower.includes('terreo')) return 0;
  if (lower.includes('mezanino')) return 0.5;
  const numMatch = lower.match(/(\d+)/);
  if (numMatch) {
    return parseInt(numMatch[1], 10);
  }
  if (lower.includes('cobertura')) return 990;
  return 999;
}

function getSortedFloors(floorList) {
  return Array.from(new Set(floorList)).sort((a, b) => {
    const weightA = getFloorNumericWeight(a);
    const weightB = getFloorNumericWeight(b);
    if (weightA !== weightB) return weightA - weightB;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

function renderFloorNavPills(scopedPrinters) {
  if (!DOM.fleetFloorNav) return;

  const realFloors = new Set();
  let hasUnassigned = false;
  scopedPrinters.forEach(p => {
    const floor = parseFloorFromLocation(p.location);
    if (floor) {
      realFloors.add(floor);
    } else {
      hasUnassigned = true;
    }
  });

  // Se a unidade possuir apenas 1 andar ou nenhum (ex: Unidade A, Unidade B no 13º Andar), oculta completamente a barra
  if (realFloors.size <= 1) {
    DOM.fleetFloorNav.style.display = 'none';
    AppState.activeFloorFilter = '';
    return;
  }

  DOM.fleetFloorNav.style.display = 'flex';

  const totalPrinters = scopedPrinters.length;
  const isAllActive = !AppState.activeFloorFilter;

  const sortedFloors = getSortedFloors(Array.from(realFloors));
  if (hasUnassigned) {
    sortedFloors.push('Outros');
  }

  let html = `
    <span class="floor-nav-label">
      <svg class="icon icon-xs" viewBox="0 0 24 24" style="width: 13px; height: 13px; stroke: currentColor; fill: none; stroke-width: 2.2;"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>
      Andares
    </span>
    <button type="button" class="floor-nav-pill ${isAllActive ? 'active' : ''}" data-floor="">
      <span>Todos</span>
      <span class="floor-nav-count">${totalPrinters}</span>
    </button>
  `;

  sortedFloors.forEach(floor => {
    const floorPrinters = scopedPrinters.filter(p => {
      const f = parseFloorFromLocation(p.location);
      return floor === 'Outros' ? !f : f === floor;
    });
    const count = floorPrinters.length;
    if (count === 0) return;
    const isActive = AppState.activeFloorFilter === floor;

    let hasCritical = false;
    let hasWarning = false;
    floorPrinters.forEach(p => {
      const state = getEffectiveHealthState(p, AppState.statusData.get(p.id));
      if (state === 'critical' || isHealthFailureState(state)) hasCritical = true;
      else if (isHealthAttentionState(state)) hasWarning = true;
    });

    const alertDot = hasCritical
      ? '<span class="floor-nav-alert-dot" title="Há condição crítica ou falha confirmada neste andar"></span>'
      : (hasWarning ? '<span class="floor-nav-warning-dot" title="Há equipamento em atenção neste andar"></span>' : '');

    html += `
      <button type="button" class="floor-nav-pill ${isActive ? 'active' : ''}" data-floor="${escapeHtml(floor)}">
        ${alertDot}
        <span>${escapeHtml(floor)}</span>
        <span class="floor-nav-count">${count}</span>
      </button>
    `;
  });

  if (window.DashboardRefresh) window.DashboardRefresh.patch(DOM.fleetFloorNav, html);
  else DOM.fleetFloorNav.innerHTML = html;

  DOM.fleetFloorNav.querySelectorAll('.floor-nav-pill').forEach(btn => {
    btn.onclick = () => {
      const selectedFloor = btn.dataset.floor || '';
      AppState.activeFloorFilter = selectedFloor;

      // Se o setor selecionado não pertencer ao novo andar ativo, reseta o setor
      if (AppState.locationFilter && selectedFloor) {
        const match = scopedPrinters.some(p => {
          const loc = (p.location || '').trim();
          const f = parseFloorFromLocation(p.location);
          const pFloor = f || 'Outros';
          return loc === AppState.locationFilter && pFloor === selectedFloor;
        });
        if (!match) {
          AppState.locationFilter = '';
          if (DOM.filterLocationSelect) DOM.filterLocationSelect.value = '';
        }
      }

      renderFloorNavPills(scopedPrinters);
      updateLocationFilterOptions();
      renderMyPrinters(scopedPrinters);
    };
  });
}

function getScopedPrinters() {
  if (AppState.isEdge && AppState.edgeUnitName) {
    // No modo filial (Edge), todas as impressoras locais pertencem à filial
    return AppState.printers;
  }
  let list = AppState.printers;
  if (AppState.activeRegionFilter && AppState.activeRegionFilter !== 'all') {
    list = list.filter(p => {
      const pRegion = p.region || (AppState.units.find(u => u.id === p.unitId)?.region) || 'RJ';
      return pRegion === AppState.activeRegionFilter;
    });
  }
  if (AppState.activeUnitFilter) {
    return list.filter(p => p.unitId === AppState.activeUnitFilter || (p.unitName && p.unitName.toLowerCase() === AppState.activeUnitFilter.toLowerCase()));
  }
  return list;
}

// ==========================================================================
// 7.1 HEFESTO EDGE & HUB (GESTÃO DISTRIBUÍDA DE FILIAIS)
// ==========================================================================
function applyEdgeModeUi() {
  if (!AppState.isEdge) return;

  // Ativa crachá visual no topo
  if (DOM.edgeModeBadge && DOM.edgeModeBadgeText) {
    DOM.edgeModeBadge.style.display = 'inline-flex';
    DOM.edgeModeBadgeText.textContent = `EDGE · ${AppState.edgeUnitName || 'FILIAL'}`;
  }

  // Ativa indicador de sincronização com o Hub
  updateEdgeSyncUi(AppState.syncStatus);

  // Trava visual de operador na filial configurada
  if (AppState.edgeUnitName) {
    if (DOM.currentUnitBadge) {
      DOM.currentUnitBadge.textContent = AppState.edgeUnitName;
    }
    if (DOM.headerUnitDesc) {
      DOM.headerUnitDesc.textContent = `Instância Local Autônoma da Filial ${AppState.edgeUnitName}`;
    }
    if (DOM.loginUnitHint) {
      DOM.loginUnitHint.textContent = `Painel exclusivo configurado para: ${AppState.edgeUnitName}`;
    }
  }
}

function updateEdgeSyncUi(syncStat) {
  if (!AppState.isEdge || !DOM.edgeHubSyncIndicator || !DOM.edgeHubSyncText) return;

  DOM.edgeHubSyncIndicator.style.display = 'inline-flex';

  if (!syncStat || syncStat.lastSyncTime === null) {
    DOM.edgeHubSyncIndicator.className = 'deck-hub-sync-status syncing';
    DOM.edgeHubSyncText.textContent = 'Conectando à Matriz...';
    DOM.edgeHubSyncIndicator.title = `Conectando ao Hub Central (${AppState.hubUrl || 'endereço não configurado'})...`;
  } else if (syncStat.lastSuccess) {
    DOM.edgeHubSyncIndicator.className = 'deck-hub-sync-status';
    const rel = formatRelativeTime(syncStat.lastSyncTime);
    DOM.edgeHubSyncText.textContent = `Matriz OK (${rel})`;
    DOM.edgeHubSyncIndicator.title = `Sincronizado com sucesso com a Matriz (${AppState.hubUrl}) em ${formatFullDateTime(syncStat.lastSyncTime)}. Total: ${syncStat.syncedPrintersCount} impressoras enviadas.`;
  } else {
    DOM.edgeHubSyncIndicator.className = 'deck-hub-sync-status offline';
    DOM.edgeHubSyncText.textContent = 'Matriz Offline (Local OK)';
    DOM.edgeHubSyncIndicator.title = `Falha na última sincronização com a Matriz: ${syncStat.lastError || 'Sem resposta'}. O painel local continua operando 100%.`;
  }
}

async function handleForceEdgeSync() {
  if (!DOM.edgeHubSyncIndicator || !DOM.edgeHubSyncText) return;
  DOM.edgeHubSyncIndicator.className = 'deck-hub-sync-status syncing';
  DOM.edgeHubSyncText.textContent = 'Sincronizando...';
  try {
    const res = await API.triggerEdgeSync();
    if (res.success) {
      showToast('Sincronizado com a Matriz com sucesso!', 'success');
    } else {
      showToast('Não foi possível conectar à Matriz: ' + res.message, 'warning');
    }
    AppState.syncStatus = res.status || AppState.syncStatus;
    updateEdgeSyncUi(AppState.syncStatus);
  } catch (err) {
    showToast('Erro ao disparar sincronização: ' + err.message, 'error');
  }
}
window.handleForceEdgeSync = handleForceEdgeSync;

// ==========================================================================
// 8. FUNÇÕES AUXILIARES DE NOMENCLATURA & MODELO LIMPO
// ==========================================================================
function formatCleanModel(modelStr) {
  if (!modelStr || modelStr === 'Desconhecido' || modelStr === 'N/D') return '';
  return String(modelStr).split(/\r?\n/).map(l => l.trim()).filter(Boolean)[0] || '';
}

function getPrinterLocationTitle(printer) {
  if (printer.location && printer.location.trim()) {
    return printer.location.trim();
  }
  if (printer.name && !/^[0-9A-Z]{10,}$/i.test(printer.name.replace(/[-_]/g, ''))) {
    return printer.name;
  }
  return 'Impressora Local';
}

function getPrinterModelSubtitle(printer, status) {
  const cleanModel = formatCleanModel(status?.info?.model);
  if (cleanModel && cleanModel !== 'Desconhecido') {
    return cleanModel;
  }
  if (printer.model && printer.model.trim()) {
    return printer.model.trim();
  }
  if (printer.name && !/^[0-9A-Z]{10,}$/i.test(printer.name) && printer.name !== printer.location) {
    return printer.name;
  }
  return 'Modelo não detectado';
}

function navigateToUnit(unitId) {
  AppState.activeUnitFilter = unitId;
  AppState.activeFloorFilter = '';
  AppState.locationFilter = '';
  AppState.collapsedFloors.clear();
  const u = AppState.units.find(x => x.id === unitId);
  AppState.forecastUnitFilter = u ? u.name : '';
  if (DOM.overviewUnitFilter) DOM.overviewUnitFilter.value = unitId;
  if (DOM.forecastUnitSelect) DOM.forecastUnitSelect.value = AppState.forecastUnitFilter;
  updateHeaderRoleAndUnit();
  populateDropdownFilters();
  renderOverviewTab();
  if (AppState.userRole === 'admin' && AppState.activeAdminTab === 'forecast') {
    updateForecastKPIs(AppState.forecastUnitFilter);
    renderForecastTable();
  }
  showToast(`Visualizando pasta: ${u ? u.name : 'Unidade'}`, 'info');
}
window.navigateToUnit = navigateToUnit;

// ==========================================================================
// MON-001.1 — ADAPTADOR VISUAL DO PRINTER HEALTH ENGINE
// ==========================================================================
const KNOWN_HEALTH_STATES = new Set(['ok', 'attention', 'critical', 'offline', 'snmp_timeout', 'partial', 'stale', 'unconfigured']);

function getPrinterHealth(printerId) {
  return AppState.healthData.get(printerId) || null;
}

function isPrinterUnconfigured(printer) {
  if (printer?.connectionType === 'usb') return false;
  const ip = String(printer?.ip || '').trim().toLowerCase();
  return !ip || ip === '-' || ip === 'n/d' || ip.startsWith('pendente-');
}

function getEffectiveHealthState(printer, status = null) {
  if (printer?.connectionType === 'usb') return status?.collectorOnline ? 'partial' : 'offline';
  if (isPrinterUnconfigured(printer)) return 'unconfigured';
  const health = getPrinterHealth(printer?.id);
  // Ausência de avaliação não confirma disponibilidade nem perda de conexão.
  return KNOWN_HEALTH_STATES.has(health?.state) ? health.state : 'unknown';
}

function isHealthAttentionState(state) {
  return ['attention', 'partial', 'stale', 'unknown'].includes(state);
}

function isHealthFailureState(state) {
  return ['offline', 'snmp_timeout'].includes(state);
}

// MON-001.3C — toda a apresentação de conectividade deve seguir o Health Engine,
// não uma leitura bruta isolada de status.online.
function isHealthConnectivityAvailable(printer, status = null) {
  const state = getEffectiveHealthState(printer, status);
  return ['ok', 'attention', 'critical', 'partial'].includes(state);
}

function isConnectivityConfirmationPending(printer, status = null) {
  const health = getPrinterHealth(printer?.id);
  return ['connectivity_degraded', 'recovering'].includes(health?.reasonCode);
}

function getHealthUiMeta(printer, status = null) {
  if (printer?.connectionType === 'usb') return { state: status?.collectorOnline ? 'partial' : 'offline', health: null,
    className: status?.collectorOnline ? 'partial' : 'offline', label: status?.collectorOnline ? 'Coletor ativo' : 'Coletor sem comunicação', icon: Icons.clock };
  const state = getEffectiveHealthState(printer, status);
  const health = state === 'unknown' ? null : getPrinterHealth(printer?.id);
  const byState = {
    ok: { className: 'online', label: 'Operacional', icon: Icons.checkCircle },
    attention: {
      className: 'warning',
      label: health?.reasonCode === 'connectivity_degraded' ? 'Conexão instável' : 'Atenção',
      icon: Icons.alertTriangle
    },
    critical: { className: 'critical', label: 'Crítico', icon: Icons.alertOctagon },
    offline: { className: 'offline', label: 'Offline confirmado', icon: Icons.wifiOff },
    snmp_timeout: { className: 'timeout', label: 'Offline confirmado', icon: Icons.wifiOff },
    partial: { className: 'partial', label: 'Telemetria parcial', icon: Icons.alertTriangle },
    stale: { className: 'stale', label: 'Telemetria atrasada', icon: Icons.clock },
    unknown: { className: 'warning', label: 'Estado não confirmado', icon: Icons.clock },
    unconfigured: { className: 'unconfigured', label: 'Sem configuração', icon: Icons.clock }
  };
  return { state, health, ...(byState[state] || byState.unknown) };
}

function getPrinterActivity(printer, status, nowMs = Date.now()) {
  const meta = getHealthUiMeta(printer, status);
  const sampledAt = Date.parse(status?.cachedAt || '');
  const age = nowMs - sampledAt;
  if (status?.online !== true || isHealthFailureState(meta.state) ||
      ['stale', 'unknown', 'unconfigured'].includes(meta.state) || !Number.isFinite(age) || age < 0 || age > 300000) return null;
  const printing = status.status?.printerCode === 4 || /^imprimindo\b/i.test(status.status?.printerDescription || '');
  return printing ? { label: 'Imprimindo', icon: Icons.printer,
    reason: `Informado pela impressora na leitura de ${formatFullDateTime(status.cachedAt)}` } : null;
}

function formatHealthOfflineDuration(health, nowMs = Date.now()) {
  if (!health) return 'Falha confirmada';

  // Para a operação diária, tempo indisponível é mais útil que quantidade de polls.
  // Usa a última leitura válida; quando ela não existe, usa a transição do estado
  // degradado/confirmado e, por último, a falha mais recente.
  const referenceAt = health.lastSuccessAt || health.lastTransitionAt || health.lastFailureAt;
  const referenceMs = referenceAt ? new Date(referenceAt).getTime() : NaN;
  const currentMs = Number(nowMs);

  if (!Number.isFinite(referenceMs) || !Number.isFinite(currentMs) || currentMs < referenceMs) {
    return 'Falha confirmada';
  }

  const totalMinutes = Math.max(0, Math.floor((currentMs - referenceMs) / 60000));
  if (totalMinutes < 1) return 'Offline há <1 min';

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `Offline há ${days}d ${hours}h`;
  if (hours > 0) return `Offline há ${hours}h ${minutes}min`;
  return `Offline há ${minutes}min`;
}

function getHealthSecondaryText(health) {
  if (!health) return '';
  const failures = Number(health.consecutiveFailures) || 0;
  if (health.reasonCode === 'connectivity_degraded') return `${failures}/3 falhas`;
  if (health.reasonCode === 'snmp_timeout') return `Timeout SNMP • ${formatHealthOfflineDuration(health)}`;
  if (health.reasonCode === 'offline_confirmed') return formatHealthOfflineDuration(health);
  if (health.reasonCode === 'unconfigured') return 'IP não configurado';
  if (health.reasonCode === 'telemetry_partial') return 'SNMP incompleto';
  if (health.reasonCode === 'telemetry_stale') return 'Sem leitura recente';
  const supply = health.reasonCode === 'supply_critical' ? health.criticalSupply
    : health.reasonCode === 'supply_warning' ? health.warningSupply : null;
  if (supply) return `${translateSupplyName(supply.name, supply.type)} · ${HefestoSupplySemantics.text(supply)}`;
  return '';
}

// ==========================================================================
// 9. VISÃO GERAL / MINHAS IMPRESSORAS (FORMATO LISTA/TABELA COM AÇÕES POR PERFIL)
// ==========================================================================
function renderOverviewTab(background = false) {
  const scopedPrinters = getScopedPrinters();
  const total = scopedPrinters.length;

  let countCrit = 0;
  let countWarn = 0;
  let countOff = 0;
  let countUnconfigured = 0;
  let countHealthy = 0;
  let countAccessible = 0;

  scopedPrinters.forEach(p => {
    const st = AppState.statusData.get(p.id);
    const state = getEffectiveHealthState(p, st);

    if (isHealthConnectivityAvailable(p, st)) countAccessible++;
    if (state === 'ok') countHealthy++;
    else if (state === 'critical') countCrit++;
    else if (isHealthAttentionState(state)) countWarn++;
    else if (isHealthFailureState(state)) countOff++;
    else if (state === 'unconfigured') countUnconfigured++;
  });

  DOM.countCritical.textContent = countCrit;
  DOM.countWarning.textContent = countWarn;
  DOM.countOffline.textContent = countOff;
  if (DOM.countUnconfigured) DOM.countUnconfigured.textContent = countUnconfigured;

  // Faixa de status: usa o Health Engine para separar saúde, falha confirmada
  // e equipamentos ainda sem configuração. "Operacionais" = conectividade disponível.
  const onlineCount = countAccessible;
  if (DOM.countConnectedBanner) {
    DOM.countConnectedBanner.textContent = onlineCount;
  }
  if (DOM.countAll) DOM.countAll.textContent = total;

  syncOverviewFilterUi();

  renderFloorNavPills(scopedPrinters);
  renderMyPrinters(scopedPrinters);
  if (!background) renderUnitRecentRecharges();
}

// Faixa de status: marca o filtro ativo e esmaece contagens zeradas
function syncOverviewFilterUi() {
  document.querySelectorAll('.status-strip-item[data-filter]').forEach(item => {
    const isActive = item.dataset.filter === AppState.overviewFilter;
    const count = Number(item.querySelector('.status-strip-value')?.textContent) || 0;
    item.classList.toggle('active', isActive);
    item.classList.toggle('is-zero', count === 0);
    item.setAttribute('aria-pressed', String(isActive));
  });
}

let isUnitRecentRechargesExpanded = false;

function sanitizeDisplayText(str) {
  if (!str) return '';
  return String(str)
    .replaceAll('\uFFFD', 'ó')
    .replace(/Consultrio/gi, 'Consultório')
    .replace(/Consult\?rio/gi, 'Consultório');
}

function rechargeEvidenceLabel(event) {
  const level = typeof event.newLevel === 'number' && event.newLevel >= 0 && event.newLevel <= 100 ? ` • ${event.newLevel}%` : '';
  return `Troca registrada${level}`;
}

function printEvidenceLabel(evidence) {
  if (!evidence) return 'Sem leituras auditáveis';
  if (evidence.quality === 'counter_regression') return 'Contador diminuiu — revisar';
  if (evidence.quality === 'legacy_unverified') return 'Histórico sem evidência';
  if (evidence.quality !== 'observed') return 'Aguardando leituras';
  const start = new Date(evidence.firstReadingAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  return `${evidence.pages.toLocaleString('pt-BR')} observadas desde ${start}`;
}

async function openPrintAudit(printerId, date = '') {
  try {
    const response = await apiFetch(`/api/printers/${encodeURIComponent(printerId)}/print-audit${date ? `?date=${encodeURIComponent(date)}` : ''}`);
    const audit = await response.json();
    if (!response.ok) throw new Error(audit.error || 'Falha ao consultar leituras');
    document.getElementById('print-audit-dialog')?.remove();
    const dialog = document.createElement('dialog');
    dialog.id = 'print-audit-dialog';
    dialog.style.cssText = 'width:min(760px,90vw);max-height:85vh;overflow:auto;padding:1.5rem;background:var(--bg-card);color:var(--text-primary);border:1px solid var(--border-color);border-radius:12px';
    const summary = audit.summary;
    const statusLabels = { accepted: 'Aceita', counter_regression: 'Contador diminuiu', out_of_order: 'Fora de ordem' };
    const sourceLabels = { device_poll: 'Sensor local', edge_sync: 'Leitura da filial' };
    dialog.innerHTML = `<button type="button" data-close-audit style="float:right">Fechar</button>
      <h3>Leituras de impressão</h3><label>Dia <input type="date" data-audit-date value="${escapeHtml(summary.date)}"></label>
      <p>${escapeHtml(printEvidenceLabel(summary))}</p><p>${escapeHtml(summary.description)}</p>
      <p>Contador inicial: <strong>${summary.startCounter ?? '—'}</strong> • Contador final: <strong>${summary.endCounter ?? '—'}</strong> • Leituras: <strong>${summary.readingCount}</strong></p>
      <table style="width:100%;text-align:left"><thead><tr><th>Horário da leitura</th><th>Contador físico</th><th>Validação</th><th>Origem</th></tr></thead>
      <tbody>${audit.readings.map(r => `<tr><td>${escapeHtml(formatFullDateTime(r.observedAt))}</td><td>${r.pageCount.toLocaleString('pt-BR')}</td><td>${escapeHtml(statusLabels[r.status] || r.status)}</td><td>${escapeHtml(sourceLabels[r.source] || r.source)}</td></tr>`).join('')}</tbody></table>
      <p style="font-size:.8rem">Exibindo as ${audit.readings.length} leituras mais recentes (limite ${audit.limit}). O contador mede páginas do equipamento; não identifica documentos ou usuários.</p>`;
    dialog.querySelector('[data-close-audit]').onclick = () => { dialog.close(); dialog.remove(); };
    dialog.querySelector('[data-audit-date]').onchange = event => openPrintAudit(printerId, event.target.value);
    document.body.append(dialog);
    dialog.showModal();
  } catch (error) { showToast(error.message, 'error'); }
}
document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-print-audit]');
  if (button) openPrintAudit(button.dataset.printAudit);
});

// Histórico Resumido de Reposições na Unidade (Visível no Visualizador de Unidade e Administrador)
async function renderUnitRecentRecharges() {
  if (!DOM.unitRecentRechargesSection || !DOM.unitRecentRechargesList) return;

  if (AppState.activeAdminTab !== 'printers') {
    DOM.unitRecentRechargesSection.style.display = 'none';
    return;
  }

  DOM.unitRecentRechargesSection.style.display = 'block';

  const scopedPrinters = getScopedPrinters();
  const scopedIds = new Set(scopedPrinters.map(p => p.id));

  try {
    let recharges = await API.getRecharges();
    recharges = recharges.filter(r => scopedIds.has(r.printerId));

    if (DOM.unitRechargesCountBadge) {
      DOM.unitRechargesCountBadge.textContent = recharges.length;
    }

    if (recharges.length === 0) {
      DOM.unitRecentRechargesList.innerHTML = `
        <div class="unit-recharges-empty">Nenhuma reposição recente registrada nesta unidade.</div>
      `;
      return;
    }

    // Lista compacta: 5 reposições por padrão, todas se expandido
    const defaultLimit = 5;
    const shouldPaginate = recharges.length > defaultLimit;
    const displayList = (shouldPaginate && !isUnitRecentRechargesExpanded)
      ? recharges.slice(0, defaultLimit)
      : recharges;

    const itemsHtml = displayList.map(r => {
      const relTime = formatRelativeTime(r.timestamp);
      const fullDate = formatFullDateTime(r.timestamp);
      const rawLocation = r.location || r.printerName || 'Impressora';
      const locationLabel = sanitizeDisplayText(rawLocation);
      const supplyNameLabel = sanitizeDisplayText(translateSupplyName(r.supplyName));

      return `
        <div class="unit-recharge-item">
          <div class="unit-recharge-left">
            <span class="unit-recharge-dot"></span>
            <div>
              <span class="unit-recharge-supply">${escapeHtml(supplyNameLabel)}</span>
              <span class="unit-recharge-printer">• ${escapeHtml(locationLabel)}</span>
            </div>
          </div>
          <div class="unit-recharge-right">
            <span class="printer-recharge-tag">${escapeHtml(rechargeEvidenceLabel(r))}</span>
            <span title="${escapeHtml(fullDate)}">Detectado ${escapeHtml(relTime)}</span>
          </div>
        </div>
      `;
    }).join('');

    let footerHtml = '';
    if (shouldPaginate) {
      const toggleText = isUnitRecentRechargesExpanded
        ? 'Mostrar menos'
        : `Ver todas (${recharges.length})`;
      footerHtml = `
        <div class="unit-recharges-footer">
          <button type="button" class="link-btn" id="btn-toggle-expand-unit-recharges" aria-expanded="${isUnitRecentRechargesExpanded}">${toggleText}</button>
        </div>
      `;
    }

    DOM.unitRecentRechargesList.innerHTML = itemsHtml + footerHtml;

    if (shouldPaginate) {
      const btnExpand = document.getElementById('btn-toggle-expand-unit-recharges');
      if (btnExpand) {
        btnExpand.addEventListener('click', (e) => {
          e.stopPropagation();
          isUnitRecentRechargesExpanded = !isUnitRecentRechargesExpanded;
          renderUnitRecentRecharges();
        });
      }
    }
  } catch (err) {
    // Silencioso em caso de erro de rede
  }
}

function setInventoryHtml(html) {
  if (window.DashboardRefresh) window.DashboardRefresh.patch(DOM.myPrintersListBody, html);
  else DOM.myPrintersListBody.innerHTML = html;
}

function renderMyPrinters(scopedPrinters) {
  if (!DOM.myPrintersListBody) return;

  if (scopedPrinters.length === 0) {
    setInventoryHtml(`
      <tr>
        <td colspan="7">
          <div class="empty-matrix-state">
            <div class="empty-state-icon">${Icons.printer}</div>
            <div class="empty-state-title">Nenhuma impressora encontrada nesta unidade</div>
            <p class="empty-state-text">${AppState.userRole === 'admin'
              ? 'Cadastre uma nova impressora usando o botão "Nova impressora" no topo.'
              : 'Solicite ao administrador o cadastro de impressoras para sua filial.'}</p>
          </div>
        </td>
      </tr>
    `);
    return;
  }

  let filtered = scopedPrinters.filter(printer => {
    const status = AppState.statusData.get(printer.id);
    const isOnline = status && status.online;
    const supplies = (status && status.supplies) || [];

    const query = AppState.searchQuery.toLowerCase().trim();
    if (query) {
      const cleanQuery = query.replace(/[\s-]/g, '');
      const matchName = printer.name.toLowerCase().includes(query);
      const matchIp = (printer.ip || '').toLowerCase().includes(query);
      const matchHost = (printer.hostname || '').toLowerCase().includes(query) || (printer.connectionType === 'usb' && query === 'usb');
      const matchLoc = (printer.location || '').toLowerCase().includes(query);
      const matchModel = (status?.info?.model || printer.model || '').toLowerCase().includes(query);
      const macStr = (printer.macAddress || status?.info?.macAddress || '').toLowerCase();
      const matchMac = macStr.includes(query) || (macStr && macStr.replace(/[:-]/g, '').includes(cleanQuery));
      const serialStr = (printer.serialNumber || printer.serial || status?.info?.serialNumber || '').toLowerCase();
      const cleanSerial = serialStr.replace(/[\s-]/g, '');
      const matchSerial = (serialStr && serialStr.includes(query)) || (cleanSerial && cleanSerial.includes(cleanQuery));
      if (!matchName && !matchIp && !matchLoc && !matchModel && !matchMac && !matchSerial && !matchHost) return false;
    }

    if (AppState.locationFilter && (printer.location || '').trim() !== AppState.locationFilter) {
      return false;
    }

    if (AppState.activeFloorFilter) {
      const pFloor = parseFloorFromLocation(printer.location) || 'Outros';
      if (pFloor !== AppState.activeFloorFilter) {
        return false;
      }
    }

    const healthState = getEffectiveHealthState(printer, status);
    if (AppState.overviewFilter === 'critical') {
      return healthState === 'critical';
    }
    if (AppState.overviewFilter === 'warning') {
      return isHealthAttentionState(healthState);
    }
    if (AppState.overviewFilter === 'offline') {
      return isHealthFailureState(healthState);
    }
    if (AppState.overviewFilter === 'unconfigured') {
      return healthState === 'unconfigured';
    }
    if (AppState.overviewFilter === 'online') {
      return isHealthConnectivityAvailable(printer, status);
    }

    return true;
  });

  filtered.sort((a, b) => {
    const stA = AppState.statusData.get(a.id);
    const stB = AppState.statusData.get(b.id);

    if (AppState.sortBy === 'lowest-supply') {
      const getLowest = (printer, st) => {
        if (!isHealthConnectivityAvailable(printer, st) || !st?.supplies?.length) return 999;
        const valid = getOperationalSupplies(st.supplies);
        return valid.length > 0 ? Math.min(...valid.map(s => normalizeSupplyPercentage(s))) : 999;
      };
      return getLowest(a, stA) - getLowest(b, stB);
    }
    if (AppState.sortBy === 'name-asc') return (a.location || a.name).localeCompare(b.location || b.name);
    if (AppState.sortBy === 'ip-asc') return (a.ip || a.hostname || '').localeCompare(b.ip || b.hostname || '', undefined, { numeric: true });
    return 0;
  });

  if (filtered.length === 0) {
    const query = AppState.searchQuery.toLowerCase().trim();
    let crossFolderMatches = [];
    if (query && AppState.activeUnitFilter) {
      const cleanQuery = query.replace(/[\s-]/g, '');
      crossFolderMatches = AppState.printers.filter(printer => {
        if (printer.unitId === AppState.activeUnitFilter) return false;
        const status = AppState.statusData.get(printer.id);
        const matchName = (printer.name || '').toLowerCase().includes(query);
        const matchIp = (printer.ip || '').toLowerCase().includes(query);
        const matchLoc = (printer.location || '').toLowerCase().includes(query);
        const matchModel = (status?.info?.model || printer.model || '').toLowerCase().includes(query);
        const macStr = (printer.macAddress || status?.info?.macAddress || '').toLowerCase();
        const matchMac = macStr.includes(query) || (macStr && macStr.replace(/[:-]/g, '').includes(cleanQuery));
        const serialStr = (printer.serialNumber || printer.serial || status?.info?.serialNumber || '').toLowerCase();
        const cleanSerial = serialStr.replace(/[\s-]/g, '');
        const matchSerial = (serialStr && serialStr.includes(query)) || (cleanSerial && cleanSerial.includes(cleanQuery));
        return matchName || matchIp || matchLoc || matchModel || matchMac || matchSerial || (printer.hostname || '').toLowerCase().includes(query) || (printer.connectionType === 'usb' && query === 'usb');
      });
    }

    if (crossFolderMatches.length > 0) {
      setInventoryHtml(`
        <tr>
          <td colspan="7">
            <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 1.25rem; margin: 0.5rem 0;">
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-primary); font-weight: 600; font-size: 0.95rem;">
                  <svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>
                  <span>Equipamento encontrado em outra pasta de filial!</span>
                </div>
                <span class="state-chip" style="font-size: 0.72rem;">${crossFolderMatches.length} localizado(s) em outras pastas</span>
              </div>
              <p style="font-size: 0.825rem; color: var(--text-secondary); margin: 0 0 0.85rem 0;">
                O termo "<strong>${escapeHtml(query)}</strong>" não pertence à unidade atual, mas foi localizado com sucesso em outra(s) pasta(s):
              </p>
              <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                ${crossFolderMatches.map(m => {
                  const mUnit = AppState.units.find(u => u.id === m.unitId);
                  const unitName = mUnit ? mUnit.name : (m.unitName || 'Outra Filial');
                  const mStatus = AppState.statusData.get(m.id);
                  const mSerial = (mStatus?.info?.serialNumber && mStatus.info.serialNumber !== '-' && !/^(n\/a|desconhecido)$/i.test(mStatus.info.serialNumber))
                    ? mStatus.info.serialNumber
                    : (m.serialNumber || m.serial || '');
                  return `
                    <div style="background: var(--bg-surface-light); border: 1px solid var(--border-card); border-radius: var(--radius-sm); padding: 0.75rem 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                      <div>
                        <div style="font-weight: 700; color: var(--text-primary); font-size: 0.88rem; display: flex; align-items: center; gap: 0.4rem;">
                          <span>${escapeHtml(m.location || m.name)}</span>
                          <span class="deck-status-capsule">${escapeHtml(unitName)}</span>
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary); font-family: var(--font-mono); margin-top: 3px;">
                          IP: <strong style="color: var(--color-primary-text);">${escapeHtml(m.ip)}</strong>
                          ${mSerial ? ` • S/N: <strong style="color: var(--text-primary);">${escapeHtml(mSerial)}</strong>` : ''}
                          ${m.macAddress ? ` • MAC: ${escapeHtml(m.macAddress)}` : ''}
                        </div>
                      </div>
                      <div style="display: flex; gap: 0.4rem;">
                        <button type="button" class="deck-action-pill" onclick="navigateToUnit(${jsArg(m.unitId)})" title="Navegar até a pasta ${escapeHtml(unitName)}">
                          <svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                          <span>Ir para ${escapeHtml(unitName.split(' ')[0])}</span>
                        </button>
                        <button type="button" class="deck-action-pill" onclick="openPrinterDetailDrawer(${jsArg(m.id)})" title="Visualizar detalhes do equipamento">
                          ${Icons.eye}
                          <span>Detalhes</span>
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </td>
        </tr>
      `);
      return;
    }

    setInventoryHtml(`
      <tr>
        <td colspan="7">
          <div class="empty-matrix-state">
            <div class="empty-state-icon">
              <svg class="icon icon-md" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </div>
            <div class="empty-state-title">Nenhum equipamento corresponde aos filtros</div>
            <p class="empty-state-text">
              Tente redefinir o termo de busca ou selecionar outra situação nos filtros acima.
            </p>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-clear-empty-filters">
              <svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
              <span>Limpar todos os filtros</span>
            </button>
          </div>
        </td>
      </tr>
    `);
    return;
  }

  const isAdmin = AppState.userRole === 'admin';

  // Verifica se há múltiplos andares na unidade para ativar a visão agrupada
  const unitFloors = new Set();
  scopedPrinters.forEach(p => {
    const f = parseFloorFromLocation(p.location);
    if (f) unitFloors.add(f);
  });
  const sortedUnitFloors = getSortedFloors(Array.from(unitFloors));
  const shouldGroupFloors = !AppState.activeFloorFilter && sortedUnitFloors.length > 1;

  if (!shouldGroupFloors) {
    // Sem andares para agrupar (andar selecionado ou unidade de 1 andar): divide por conectividade,
    // para manter a mesma separação conectadas / fora da conexão ao trocar de região ou unidade.
    const connectivityGroups = [
      { key: 'Conectadas', test: p => isHealthConnectivityAvailable(p, AppState.statusData.get(p.id)) },
      { key: 'Sem leitura recente', test: p => ['unknown', 'stale'].includes(getEffectiveHealthState(p, AppState.statusData.get(p.id))) },
      { key: 'Fora da conexão', test: p => isHealthFailureState(getEffectiveHealthState(p, AppState.statusData.get(p.id))) },
      { key: 'Sem configuração', test: p => getEffectiveHealthState(p, AppState.statusData.get(p.id)) === 'unconfigured' }
    ];
    setInventoryHtml(connectivityGroups.map(({ key, test }) => {
      const groupPrinters = filtered.filter(test);
      if (groupPrinters.length === 0) return '';
      return renderGroupHeaderHtml(key, groupPrinters) +
        groupPrinters.map(printer => renderPrinterRowHtml(printer, isAdmin, key)).join('');
    }).join(''));
    return;
  }

  // Renderização Agrupada por Andar (Seções Retráteis por Andar)
  const printersByFloor = new Map();
  sortedUnitFloors.forEach(f => printersByFloor.set(f, []));
  const unassignedFloorPrinters = [];
  filtered.forEach(p => {
    const f = parseFloorFromLocation(p.location);
    if (f && printersByFloor.has(f)) {
      printersByFloor.get(f).push(p);
    } else {
      unassignedFloorPrinters.push(p);
    }
  });
  if (unassignedFloorPrinters.length > 0) {
    printersByFloor.set('Outros Setores', unassignedFloorPrinters);
    if (!sortedUnitFloors.includes('Outros Setores')) {
      sortedUnitFloors.push('Outros Setores');
    }
  }

  let fullTableHTML = '';
  sortedUnitFloors.forEach(floor => {
    const floorPrinters = printersByFloor.get(floor) || [];
    if (floorPrinters.length === 0) return;

    fullTableHTML += renderGroupHeaderHtml(floor, floorPrinters);

    floorPrinters.forEach(printer => {
      fullTableHTML += renderPrinterRowHtml(printer, isAdmin, floor);
    });
  });

  setInventoryHtml(fullTableHTML);
}

// Cabeçalho retrátil de grupo (andar ou conectividade) com o resumo de saúde dos equipamentos.
function renderGroupHeaderHtml(title, groupPrinters) {
  let online = 0;
  let crit = 0;
  let warn = 0;
  let off = 0;
  let unconfigured = 0;

  groupPrinters.forEach(p => {
    const st = AppState.statusData.get(p.id);
    const state = getEffectiveHealthState(p, st);
    if (isHealthConnectivityAvailable(p, st)) online++;
    if (state === 'critical') crit++;
    else if (isHealthAttentionState(state)) warn++;
    else if (isHealthFailureState(state)) off++;
    else if (state === 'unconfigured') unconfigured++;
  });

  const isCollapsed = AppState.collapsedFloors.has(title);

  return `
    <tr data-live-key="group:${escapeHtml(title)}" class="floor-section-header ${isCollapsed ? 'collapsed' : ''}" data-floor="${escapeHtml(title)}">
      <td colspan="7">
        <div class="floor-header-content">
          <div class="floor-header-left">
            <svg class="floor-chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="6 9 12 15 18 9"/></svg>
            <span class="floor-title">${escapeHtml(title)}</span>
            <span class="floor-badge-count">${groupPrinters.length} ${groupPrinters.length === 1 ? 'equipamento' : 'equipamentos'}</span>
          </div>
          <div class="floor-header-status-summary">
            <span class="floor-status-badge ok">${online} Online</span>
            ${crit > 0 ? `<span class="floor-status-badge danger">${crit} Crítica</span>` : ''}
            ${warn > 0 ? `<span class="floor-status-badge warn">${warn} Atenção</span>` : ''}
            ${off > 0 ? `<span class="floor-status-badge off">${off} Falha confirmada</span>` : ''}
            ${unconfigured > 0 ? `<span class="floor-status-badge pending">${unconfigured} Sem config.</span>` : ''}
          </div>
        </div>
      </td>
    </tr>
  `;
}

function renderPrinterRowHtml(printer, isAdmin, floor = '') {
  const status = AppState.statusData.get(printer.id);
  if (printer.connectionType === 'usb') return window.WorkstationModule.renderRow(printer,status,isAdmin,floor,AppState.collapsedFloors.has(floor));
  const isOnline = status && status.online;
  const supplies = (status && status.supplies) || [];
  const healthMeta = getHealthUiMeta(printer, status);
  const health = healthMeta.health;
  const isUnconfigured = healthMeta.state === 'unconfigured';
  const hasConfirmedConnectivityFailure = isHealthFailureState(healthMeta.state);
  const connectivityConfirmationPending = isConnectivityConfirmationPending(printer, status);
  const storedReading = ['unknown', 'stale'].includes(healthMeta.state);

  // Nível não observável permanece desconhecido; componentes compartilham a semântica do motor.
  const normalizedSupplies = supplies.map(s => ({
    ...s,
    _normalizedPct: normalizeSupplyPercentage(s),
    _isWaste: isWasteSupply(s)
  }));
  const validSupplies = normalizedSupplies.filter(s => s._normalizedPct >= 0).sort((a, b) => a._normalizedPct - b._normalizedPct);

  // Insumos operacionais considerando redundância de toner duplo (K1 / K2)
  const opSupplies = getOperationalSupplies(supplies).map(s => ({
    ...s,
    _normalizedPct: normalizeSupplyPercentage(s),
    _isWaste: isWasteSupply(s)
  })).sort((a, b) => a._normalizedPct - b._normalizedPct);

  const rank = { critical: 0, warning: 1, ok: 2, unknown: 3 };
  opSupplies.sort((a, b) => rank[HefestoSupplySemantics.describe(a).status] - rank[HefestoSupplySemantics.describe(b).status] || a._normalizedPct - b._normalizedPct);
  const lowest = opSupplies[0] || normalizedSupplies[0];

  // Detecta se há toner duplo preto (ex: Xerox C60/C70)
  const blackTonersList = validSupplies.filter(s => HefestoSupplySemantics.component(s) === 'consumable' && /(?:^|[^a-z0-9])k[12](?:[^a-z0-9]|$)/i.test(s.name || ''));
  const hasDualBlack = blackTonersList.length > 1;
  const maxBlackPct = hasDualBlack ? Math.max(...blackTonersList.map(b => b._normalizedPct)) : 0;

  // Apenas tinta/toner na paleta; vida útil e receptáculos ficam no resumo/diagnóstico.
  const mainToners = normalizedSupplies.filter(s => s._normalizedPct >= 0 && HefestoSupplySemantics.component(s) === 'consumable');

  const locationTitle = getPrinterLocationTitle(printer);
  const modelSubtitle = getPrinterModelSubtitle(printer, status);
  const serialNumber = (status?.info?.serialNumber && status.info.serialNumber !== '-' && !/^(n\/a|desconhecido)$/i.test(status.info.serialNumber))
    ? status.info.serialNumber
    : (printer.serialNumber || printer.serial || (/^[0-9A-Z]{7,}$/i.test(printer.name) ? printer.name : ''));

  const activity = getPrinterActivity(printer, status);
  const statusClass = healthMeta.className;
  const statusText = activity?.label || healthMeta.label;
  const statusDetail = getHealthSecondaryText(health);
  const statusReason = [activity?.reason, health?.reason || healthMeta.label].filter(Boolean).join(' • ');
  const internalAlert = status?.diagnostic?.lastKnownState === 'error' ? 'Erro interno' : status?.diagnostic?.lastKnownState === 'attention' ? 'Alerta interno' : null;

  let supplyCellHTML = '';
  if (isUnconfigured) {
    supplyCellHTML = `<span class="cell-muted cell-inline">${Icons.clock}<span>Aguardando ativação física</span></span>`;
  } else if (hasConfirmedConnectivityFailure) {
    supplyCellHTML = `<span class="cell-muted">Inacessível na rede</span>`;
  } else if (lowest) {
    const view = HefestoSupplySemantics.describe(lowest);
    const displayVal = escapeHtml(view.valueLabel);
    const fillWidth = view.percentage ?? 0;
    const supplyColorStatus = view.status;

    // Mini-paleta limpa exclusivamente com os toners/tintas principais (sem poluir com cilindros/fusores)
    let allSuppliesDotsHTML = '';
    if (mainToners.length > 1) {
      allSuppliesDotsHTML = `
        <div class="cmyk-fluid-chips" title="Níveis dos toners e tintas">
          ${mainToners.map(s => {
            const dotColor = getSupplyColorByName(s.name);
            const statusClr = HefestoSupplySemantics.describe(s).status;
            const translatedShort = translateSupplyName(s.name, s.type)
              .replace('Toner / Tinta ', '')
              .replace('Cartucho / Toner ', '')
              .replace('Bolsa de Tinta ', '');

            const isDualK = hasDualBlack && /k1|k2/i.test(s.name || '');
            let statusTextSuffix = '';
            let chipClass = statusClr === 'critical' ? 'chip-critical' : (statusClr === 'warning' ? 'chip-warning' : 'chip-success');

            if (isDualK) {
              if (s._normalizedPct > 10) {
                statusTextSuffix = ' (Ativo)';
              } else if (maxBlackPct > 10) {
                statusTextSuffix = ' (Reserva vazia)';
                chipClass = 'chip-warning';
              }
            }

            return `
              <span class="cmyk-micro-pill ${chipClass}" title="${escapeHtml(translateSupplyName(s.name, s.type))}: ${s._normalizedPct}%${statusTextSuffix}">
                <span class="cmyk-micro-dot" style="background-color: ${dotColor};"></span>
                <span>${escapeHtml(translatedShort)}: ${s._normalizedPct}%${statusTextSuffix}</span>
              </span>
            `;
          }).join('')}
        </div>
      `;
    }

    // Tag de última recarga recente se houver
    const rechargeInfo = AppState.rechargesSummary && AppState.rechargesSummary[printer.id];
    let recentRechargeHTML = '';
    if (rechargeInfo && rechargeInfo.lastRecharge) {
      const rec = rechargeInfo.lastRecharge;
      const isRecent = (Date.now() - new Date(rec.timestamp).getTime()) < (7 * 86400000);
      if (isRecent) {
        const recName = translateSupplyName(rec.supplyName).replace('Cartucho / Toner ', '').replace('Bolsa de Tinta ', '');
        recentRechargeHTML = `
          <div class="cell-note is-success cell-inline" title="Última reposição: ${escapeHtml(rec.supplyName)} (${rec.newLevel}%) em ${formatFullDateTime(rec.timestamp)}">
            <span>${escapeHtml(rechargeEvidenceLabel(rec))}: ${escapeHtml(recName)}</span>
          </div>
        `;
      }
    }

    supplyCellHTML = `
      <div class="cmyk-reservoir-cell">
        <div class="cmyk-reservoir-top">
          <span class="cmyk-supply-title">${escapeHtml(translateSupplyName(lowest.name, lowest.type))}</span>
          <strong class="cmyk-percentage-tag ${supplyColorStatus}">${displayVal}</strong>
        </div>
        <div class="cmyk-capillary-tube">
          <div class="cmyk-fluid-fill ${supplyColorStatus}" style="width: ${fillWidth}%"></div>
        </div>
        ${view.status !== 'ok' ? `<div class="cell-note ${view.status === 'unknown' ? '' : 'is-warning'}">${escapeHtml(view.label)}</div>` : ''}
        ${allSuppliesDotsHTML}
        ${recentRechargeHTML}
        ${storedReading ? `<div class="cell-note is-warning">Leitura armazenada • ${escapeHtml(healthMeta.label)}</div>` : connectivityConfirmationPending && !isOnline ? `
          <div class="cell-note is-warning" title="A última consulta falhou; aguardando confirmação da rede.">
            Última leitura válida • Verificando conexão
          </div>
        ` : ''}
      </div>
    `;
  } else {
    supplyCellHTML = `<span class="cell-muted">Suprimentos: N/D</span>`;
  }

  const curPageCount = Number.isSafeInteger(status?.info?.pageCount) && status.info.pageCount >= 0 ? status.info.pageCount : null;
  const printEvidence = status?.printEvidence;
  const pagesToday = Number.isSafeInteger(status?.pagesToday) && status.pagesToday >= 0 ? status.pagesToday : null;

  let pageCellHTML = '';
  if (isUnconfigured) {
    pageCellHTML = `<div class="cell-muted">Aguardando IP</div>`;
  } else if (hasConfirmedConnectivityFailure) {
    if (curPageCount !== null) {
      pageCellHTML = `
        <div class="counter-value mono cell-muted" title="Última leitura física antes da perda de conexão">
          ${curPageCount.toLocaleString('pt-BR')} <span class="counter-unit">pág.</span>
        </div>
        <div class="cell-note is-danger">Offline</div>
      `;
    } else {
      pageCellHTML = `<div class="cell-muted">—</div>`;
    }
  } else {
    pageCellHTML = `
      <div class="counter-value mono" title="Total vitalício de páginas do hardware">
        ${curPageCount !== null ? curPageCount.toLocaleString('pt-BR') : '—'} <span class="counter-unit">pág.</span>
      </div>
      ${pagesToday > 0
        ? `<div class="cell-note is-success" title="${escapeHtml(printEvidence?.description || 'Páginas registradas hoje')}">+${pagesToday.toLocaleString('pt-BR')} hoje</div>`
        : `<div class="cell-note" title="${escapeHtml(printEvidence?.description || '')}">${pagesToday === null ? '—' : '0'} hoje</div>`}
      ${storedReading
        ? `<div class="cell-note is-warning">Leitura armazenada</div>`
        : connectivityConfirmationPending && !isOnline
        ? `<div class="cell-note is-warning" title="Valor preservado da última leitura válida.">Última leitura válida</div>`
        : ''}
    `;
  }

  if (isAdmin && !isUnconfigured) pageCellHTML += `<button type="button" class="link-subtle" data-print-audit="${escapeHtml(printer.id)}">Ver leituras</button>`;

  const isCollapsed = floor ? AppState.collapsedFloors.has(floor) : false;
  const floorAttr = floor ? `data-floor-row="${escapeHtml(floor)}"` : '';
  const collapseClass = isCollapsed ? 'floor-row-collapsed' : '';
  const printerRegion = printer.region || (AppState.units.find(u => u.id === printer.unitId)?.region) || 'RJ';

  const canFindIp = isAdmin && (printer.macAddress || serialNumber) && (hasConfirmedConnectivityFailure || isUnconfigured);
  const findIpKey = printer.macAddress || serialNumber;

  return `
    <tr data-live-key="printer:${escapeHtml(printer.id)}" class="printer-telemetry-row ${collapseClass}" ${floorAttr}>
      <td class="cell-local" data-label="Local / Setor">
        <div class="cell-title-row">
          <span class="cell-title">${escapeHtml(locationTitle)}</span>
          <span class="state-chip">${escapeHtml(printerRegion)}</span>
        </div>
        ${isAdmin && printer.unitName ? `<div class="unit-name-text">${escapeHtml(printer.unitName)}</div>` : ''}
      </td>
      <td class="cell-model" data-label="Modelo">
        <div class="cell-main">${escapeHtml(modelSubtitle)}</div>
        ${serialNumber ? `<div class="serial-text">S/N: ${escapeHtml(serialNumber)}</div>` : ''}
      </td>
      <td class="cell-ip" data-label="Endereço IP">
        ${isUnconfigured
          ? '<span class="state-chip" title="Equipamento físico aguardando configuração de IP">Pendente</span>'
          : `<code class="ip-code">${escapeHtml(printer.ip)}</code>`
        }
        ${printer.macAddress ? `<div class="mac-text" title="Endereço MAC físico da placa">${escapeHtml(printer.macAddress)}</div>` : ''}
      </td>
      <td class="cell-supply" data-label="Suprimentos">
        ${supplyCellHTML}
      </td>
      <td class="cell-counter" data-label="Contador">
        ${pageCellHTML}
      </td>
      <td class="cell-status" data-label="Status">
        <span class="status-indicator ${statusClass}" title="${escapeHtml(statusReason)}">
          <span class="status-dot"></span>
          <span>${escapeHtml(statusText)}</span>
        </span>
        ${statusDetail ? `<div class="health-status-detail" title="${escapeHtml(statusReason)}">${escapeHtml(statusDetail)}</div>` : ''}
        ${internalAlert ? `<div class="health-status-detail">${status?.diagnostic?.current && !storedReading ? '' : 'Último: '}${escapeHtml(internalAlert)} · Ver detalhes</div>` : ''}
      </td>
      <td class="cell-actions" data-label="Ações">
        <div class="row-actions">
          <button type="button" class="deck-action-pill" onclick="openPrinterDetailDrawer(${jsArg(printer.id)})" title="Visualizar detalhes da impressora">
            ${Icons.eye}
            <span>Detalhes</span>
          </button>
          <div class="menu row-menu">
            <button type="button" class="btn-icon btn-icon-sm menu-toggle" aria-haspopup="menu" aria-expanded="false" aria-label="Mais ações: ${escapeHtml(locationTitle)}" title="Mais ações">
              ${Icons.more}
            </button>
            <div class="menu-list" role="menu" aria-label="Ações: ${escapeHtml(locationTitle)}">
              <button type="button" class="menu-item" role="menuitem" id="btn-refresh-row-${escapeHtml(printer.id)}" onclick="refreshSinglePrinter(${jsArg(printer.id)}, this)" title="Reconsultar esta impressora">
                ${Icons.refresh}
                <span>Atualizar</span>
              </button>
              ${canFindIp ? `
              <button type="button" class="menu-item" role="menuitem" onclick="openMacScannerModal(${jsArg(findIpKey)}, ${jsArg(printer.ip)})" title="Buscar IP na rede por ${printer.macAddress ? 'MAC' : 'Serial'} (${escapeHtml(findIpKey)})">
                ${Icons.search}
                <span>Achar IP na rede</span>
              </button>` : ''}
              ${isAdmin ? `
              <button type="button" class="menu-item" role="menuitem" onclick="openEditPrinterModal(${jsArg(printer.id)})" title="Editar dados cadastrais">
                ${Icons.edit}
                <span>Editar</span>
              </button>
              <div class="menu-sep" role="separator"></div>
              <button type="button" class="menu-item danger" role="menuitem" onclick="confirmDeletePrinter(${jsArg(printer.id)}, ${jsArg(locationTitle)})" title="Excluir impressora">
                ${Icons.trash}
                <span>Excluir</span>
              </button>` : ''}
            </div>
          </div>
        </div>
      </td>
    </tr>
  `;
}

// ==========================================================================
// 10. ATUALIZAÇÃO INDIVIDUAL DE UMA IMPRESSORA
// ==========================================================================
async function refreshSinglePrinter(id, btnElement, options = {}) {
  const silent = Boolean(options.silent);
  const icon = btnElement ? btnElement.querySelector('svg') : null;
  if (icon) icon.classList.add('rotating');
  if (btnElement) btnElement.disabled = true;

  try {
    const updatedStatus = await API.getPrinterStatus(id);
    const existing = AppState.statusData.get(id) || {};
    const merged = { ...existing, ...updatedStatus };
    AppState.statusData.set(id, merged);

    const healthResponse = await API.getPrinterHealth(id).catch(() => null);
    if (healthResponse?.health) AppState.healthData.set(id, healthResponse.health);

    renderOverviewTab();
    updateLastUpdatedTimestamp();
    if (!silent) showToast('Dados da impressora atualizados com sucesso!', 'success');
    return merged;
  } catch (err) {
    if (!silent) showToast(`Erro ao atualizar: ${err.message}`, 'error');
    throw err;
  } finally {
    if (icon) icon.classList.remove('rotating');
    if (btnElement) btnElement.disabled = false;
  }
}

// ==========================================================================
// ==========================================================================
// 11. EXPORTAÇÃO GERENCIAL DE RELATÓRIO DE INSUMOS & TINTAS (CSV / EXCEL)
// (Implementação consolidada no módulo de relatórios analíticos)
// ==========================================================================

// ==========================================================================
// 12. MODAL DE TESTE DE CONEXÃO COM IMPRESSORA NÃO CADASTRADA (ADM)
// ==========================================================================
function openTestIpModal() {
  if (AppState.userRole !== 'admin') {
    showToast('Apenas administradores podem executar testes de conexão IP.', 'error');
    return;
  }
  DOM.inputTestIp.value = '';
  DOM.testIpResultBox.innerHTML = '';
  DOM.btnQuickAddFromTest.style.display = 'none';
  AppState.testedPrinterIp = '';
  lockBodyScroll('modal');
  DOM.modalTestIp.classList.add('active');
  setTimeout(() => DOM.inputTestIp.focus(), 100);
}

function closeTestIpModal() {
  DOM.modalTestIp.classList.remove('active');
  unlockBodyScroll('modal');
}

async function handleTestIpSubmit(e) {
  e.preventDefault();
  const ip = DOM.inputTestIp.value.trim();
  if (!ip) return;

  DOM.btnSubmitTestIp.disabled = true;
  DOM.btnSubmitTestIp.innerHTML = `<span>Testando rede...</span>`;
  DOM.testIpResultBox.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-secondary); padding: 0.5rem 0;">Enviando pacotes SNMP (UDP 161) para <code>${escapeHtml(ip)}</code>...</div>`;
  DOM.btnQuickAddFromTest.style.display = 'none';

  try {
    const res = await API.testAnyIp(ip);

    if (res.success) {
      AppState.testedPrinterIp = ip;
      const cleanModel = formatCleanModel(res.details?.info?.model) || 'Impressora Compatível';
      const serial = res.details?.info?.serialNumber || 'Detectado';

      DOM.testIpResultBox.innerHTML = `
        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); padding: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--color-success); font-weight: 700;">
            ${Icons.checkCircle}
            <span>Comunicação Estabelecida com Sucesso!</span>
          </div>
          <div style="font-size: 0.825rem; color: var(--text-secondary); margin-top: 0.5rem; line-height: 1.5;">
            <div><strong>Modelo Detectado:</strong> ${escapeHtml(cleanModel)}</div>
            <div><strong>Número de Série:</strong> ${escapeHtml(serial)}</div>
            <div><strong>Porta SNMP:</strong> UDP 161 (Ativa)</div>
          </div>
        </div>
      `;
      DOM.btnQuickAddFromTest.style.display = 'inline-flex';
      showToast(`Impressora no IP ${ip} respondeu com sucesso!`, 'success');
    } else {
      DOM.testIpResultBox.innerHTML = `
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-md); padding: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--color-danger); font-weight: 700;">
            ${Icons.alertOctagon}
            <span>Sem Resposta no IP Informado</span>
          </div>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.4rem;">
            O equipamento não respondeu na porta SNMP UDP 161. Verifique se a impressora está ligada, conectada à rede local e com o protocolo SNMP habilitado.
          </p>
        </div>
      `;
      showToast(`O IP ${ip} não respondeu na rede local.`, 'error');
    }
  } catch (err) {
    DOM.testIpResultBox.innerHTML = `<div style="color: var(--color-danger); font-size: 0.85rem;">Falha no teste: ${escapeHtml(err.message)}</div>`;
  } finally {
    DOM.btnSubmitTestIp.disabled = false;
    DOM.btnSubmitTestIp.innerHTML = `${Icons.zap}<span>Testar Conexão</span>`;
  }
}

function handleQuickAddFromTest() {
  const ip = AppState.testedPrinterIp || DOM.inputTestIp.value.trim();
  closeTestIpModal();
  openAddPrinterModal();
  if (ip) {
    DOM.formIp.value = ip;
  }
}

// ==========================================================================
// 12.1 MODAL DE LOCALIZAÇÃO E RECONCILIAÇÃO POR MAC ADDRESS (ADM)
// ==========================================================================
async function renderCorporateSubnetsCatalog() {
  if (!DOM.corporateSubnetsList) return;
  try {
    const subnets = await API.getCorporateSubnets();
    AppState.corporateSubnets = subnets;
    if (DOM.corporateSubnetsCount) {
      DOM.corporateSubnetsCount.textContent = `${subnets.length} faixa(s) ativa(s)`;
    }
    if (!subnets || subnets.length === 0) {
      DOM.corporateSubnetsList.innerHTML = `<div style="font-size: 0.75rem; color: var(--text-muted); padding: 0.35rem 0;">Nenhuma faixa corporativa cadastrada.</div>`;
      return;
    }
    DOM.corporateSubnetsList.innerHTML = subnets.map(s => `
      <div style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0.55rem; background: var(--bg-surface); border: 1px solid var(--border-card); border-radius: var(--radius-sm); font-size: 0.75rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
        <span style="font-family: var(--font-mono); font-weight: 700; color: var(--color-brand);">${escapeHtml(s.subnet)}.0/24</span>
        <span style="color: var(--text-secondary); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(s.description || '')}">${escapeHtml(s.description || 'Filial')}</span>
        ${s.printerCount > 0 ? `<span style="font-size: 0.65rem; color: var(--text-muted); background: var(--bg-hover); padding: 0.1rem 0.35rem; border-radius: 999px;">${s.printerCount} imp.</span>` : ''}
        ${s.isManual ? `
          <button type="button" onclick="handleDeleteCorporateSubnet(${jsArg(s.id)}, ${jsArg(s.subnet)})" title="Remover esta faixa do catálogo" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 0 2px; line-height: 1; font-size: 0.95rem; font-weight: bold; transition: color 0.15s ease;" onmouseover="this.style.color='var(--color-danger)'" onmouseout="this.style.color='var(--text-muted)'">
            &times;
          </button>
        ` : ''}
      </div>
    `).join('');
  } catch (err) {
    console.error('Falha ao renderizar catálogo de faixas:', err);
    if (DOM.corporateSubnetsList) {
      DOM.corporateSubnetsList.innerHTML = `<div style="font-size: 0.75rem; color: var(--color-danger);">Erro ao carregar faixas corporativas.</div>`;
    }
  }
}

async function handleSaveCorporateSubnet() {
  if (!DOM.inputNewSubnet) return;
  const subnet = DOM.inputNewSubnet.value.trim();
  const description = DOM.inputNewSubnetDesc ? DOM.inputNewSubnetDesc.value.trim() : '';

  if (!subnet || !/^(\d{1,3}\.){2}\d{1,3}$/.test(subnet)) {
    showToast('Informe um prefixo de sub-rede válido com 3 octetos (ex: 198.18.2)', 'error');
    return;
  }

  try {
    await API.addCorporateSubnet({ subnet, description });
    showToast(`Faixa ${subnet}.0/24 adicionada ao catálogo de varredura global!`, 'success');
    DOM.inputNewSubnet.value = '';
    if (DOM.inputNewSubnetDesc) DOM.inputNewSubnetDesc.value = '';
    await renderCorporateSubnetsCatalog();
  } catch (err) {
    showToast(err.message || 'Erro ao adicionar faixa corporativa', 'error');
  }
}

async function handleDeleteCorporateSubnet(id, subnet) {
  if (!confirm(`Deseja remover a faixa ${subnet}.0/24 do catálogo de varredura global?`)) return;
  try {
    await API.deleteCorporateSubnet(id);
    showToast(`Faixa ${subnet}.0/24 removida do catálogo.`, 'info');
    await renderCorporateSubnetsCatalog();
  } catch (err) {
    showToast(err.message || 'Erro ao remover faixa corporativa', 'error');
  }
}

function openMacScannerModal(prefillTarget = '', prefillSubnetOrIp = '') {
  if (AppState.userRole !== 'admin') {
    showToast('Apenas administradores podem executar a localização de hardware.', 'error');
    return;
  }

  // Carrega em segundo plano o catálogo de faixas corporativas
  renderCorporateSubnetsCatalog().catch(err => console.warn('Erro ao carregar faixas:', err));

  // Popula o seletor de unidades com a opção global em destaque
  if (DOM.macScanUnitSelect) {
    let selectHTML = `<option value="global">🌐 Todas as Filiais & Faixas Corporativas (Varredura Global)</option>`;
    if (AppState.units && AppState.units.length > 0) {
      selectHTML += `<optgroup label="Filiais Cadastradas">` +
        AppState.units.map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)}</option>`).join('') +
        `</optgroup>`;
    }
    DOM.macScanUnitSelect.innerHTML = selectHTML;
  }

  // Preenche o MAC ou Serial se fornecido
  if (DOM.macScanTargetMac) {
    DOM.macScanTargetMac.value = prefillTarget || '';
  }

  // Determina se deve iniciar focado em uma filial ou em modo global
  let detectedSubnet = '';
  if (prefillSubnetOrIp) {
    const parts = prefillSubnetOrIp.split('.');
    if (parts.length >= 3) {
      detectedSubnet = parts.slice(0, 3).join('.');
    }
  }

  let matchedUnitId = null;
  if (detectedSubnet) {
    const pUnit = AppState.printers.find(p => p.ip && p.ip.startsWith(detectedSubnet + '.'));
    if (pUnit) matchedUnitId = pUnit.unitId;
  }

  if (matchedUnitId && DOM.macScanUnitSelect) {
    DOM.macScanUnitSelect.value = matchedUnitId;
    if (DOM.macScanSubnet) {
      DOM.macScanSubnet.disabled = false;
      DOM.macScanSubnet.value = detectedSubnet;
      DOM.macScanSubnet.placeholder = 'Ex: 198.18.5';
    }
    if (DOM.macScanSubnetRequired) DOM.macScanSubnetRequired.style.display = 'inline';
  } else if (AppState.activeUnitFilter && DOM.macScanUnitSelect) {
    DOM.macScanUnitSelect.value = AppState.activeUnitFilter;
    const unitPrinters = AppState.printers.filter(p => p.unitId === AppState.activeUnitFilter && p.ip && !p.ip.startsWith('pendente-'));
    let uSubnet = '';
    if (unitPrinters.length > 0) {
      const parts = unitPrinters[0].ip.split('.');
      if (parts.length >= 3) uSubnet = parts.slice(0, 3).join('.');
    }
    if (DOM.macScanSubnet) {
      DOM.macScanSubnet.disabled = false;
      DOM.macScanSubnet.value = uSubnet || '';
      DOM.macScanSubnet.placeholder = 'Ex: 198.18.5';
    }
    if (DOM.macScanSubnetRequired) DOM.macScanSubnetRequired.style.display = 'inline';
  } else {
    // Modo padrão: Varredura Global
    if (DOM.macScanUnitSelect) DOM.macScanUnitSelect.value = 'global';
    if (DOM.macScanSubnet) {
      DOM.macScanSubnet.disabled = true;
      DOM.macScanSubnet.value = '';
      DOM.macScanSubnet.placeholder = 'Varredura Global (Todas as Faixas)';
    }
    if (DOM.macScanSubnetRequired) DOM.macScanSubnetRequired.style.display = 'none';
  }

  if (DOM.macScannerProgress) DOM.macScannerProgress.style.display = 'none';
  if (DOM.macScannerResults) DOM.macScannerResults.innerHTML = '';
  if (DOM.btnSubmitMacScan) {
    DOM.btnSubmitMacScan.disabled = false;
    updateMacScanButtonText();
  }

  lockBodyScroll('modal');
  DOM.modalMacScanner.classList.add('active');
  setTimeout(() => {
    if (DOM.macScanTargetMac && prefillTarget) {
      DOM.macScanTargetMac.focus();
    } else if (DOM.macScanSubnet && !DOM.macScanSubnet.disabled) {
      DOM.macScanSubnet.focus();
    }
  }, 100);
}

function isScannerIpv4(value) {
  const parts = value.split('.');
  return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) &&
    String(Number(part)) === part && Number(part) <= 255);
}

function updateMacScanButtonText() {
  if (!DOM.btnSubmitMacScan) return;
  const isGlobal = DOM.macScanUnitSelect && DOM.macScanUnitSelect.value === 'global';
  const rawTarget = DOM.macScanTargetMac ? DOM.macScanTargetMac.value.trim() : '';
  const isLikelyIp = isScannerIpv4(rawTarget);
  if (DOM.macScanSubnet) DOM.macScanSubnet.disabled = isGlobal || isLikelyIp;
  if (DOM.macScanSubnetRequired) DOM.macScanSubnetRequired.style.display = isGlobal || isLikelyIp ? 'none' : 'inline';
  if (isLikelyIp) {
    DOM.btnSubmitMacScan.innerHTML = `<svg class="icon icon-xs" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><span>Buscar por IP (1 endereço)</span>`;
    return;
  }
  const cleanTarget = rawTarget.toUpperCase().replace(/[\s-]/g, '');
  const isLikelyMac = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(rawTarget) ||
                      (/^[0-9A-Fa-f]{12}$/.test(cleanTarget) && /^[0-9A-F]+$/.test(cleanTarget));

  if (isGlobal) {
    if (rawTarget) {
      DOM.btnSubmitMacScan.innerHTML = `<svg class="icon icon-xs" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><span>Buscar ${isLikelyMac ? 'MAC' : 'Serial'} no Parque (Global)</span>`;
    } else {
      DOM.btnSubmitMacScan.innerHTML = `<svg class="icon icon-xs" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><span>Varredura Global de Todas as Filiais</span>`;
    }
  } else {
    if (rawTarget) {
      DOM.btnSubmitMacScan.innerHTML = `<svg class="icon icon-xs" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><span>Localizar por ${isLikelyMac ? 'MAC' : 'Serial'}</span>`;
    } else {
      DOM.btnSubmitMacScan.innerHTML = `<svg class="icon icon-xs" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><span>Escanear Sub-rede (254 IPs)</span>`;
    }
  }
}

function closeMacScannerModal() {
  if (DOM.modalMacScanner) DOM.modalMacScanner.classList.remove('active');
  unlockBodyScroll('modal');
}

async function handleMacScanSubmit(e) {
  e.preventDefault();
  const isGlobal = DOM.macScanUnitSelect && DOM.macScanUnitSelect.value === 'global';
  const subnet = DOM.macScanSubnet ? DOM.macScanSubnet.value.trim() : '';
  const rawTarget = DOM.macScanTargetMac ? DOM.macScanTargetMac.value.trim() : '';
  const isLikelyIp = isScannerIpv4(rawTarget);
  if (/^[\d.]+$/.test(rawTarget) && rawTarget.includes('.') && !isLikelyIp) {
    showToast('Informe um endereço IPv4 válido, como 192.0.2.10.', 'error');
    return;
  }
  const cleanTarget = rawTarget.toUpperCase().replace(/[\s-]/g, '');
  const isLikelyMac = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(rawTarget) ||
                      (/^[0-9A-Fa-f]{12}$/.test(cleanTarget) && /^[0-9A-F]+$/.test(cleanTarget));
  const cleanTargetMac = isLikelyMac ? rawTarget.toUpperCase().replace(/[:-]/g, '') : null;
  const cleanTargetSerial = (!isLikelyIp && !isLikelyMac && rawTarget) ? cleanTarget : null;

  if (!isLikelyIp && !isGlobal) {
    if (!subnet || !/^(\d{1,3}\.){2}\d{1,3}$/.test(subnet)) {
      showToast('Informe um prefixo de sub-rede válido no formato X.X.X (ex: 198.18.5)', 'error');
      return;
    }
  }

  DOM.btnSubmitMacScan.disabled = true;
  DOM.btnSubmitMacScan.innerHTML = rawTarget
    ? `<span>Buscando ${isLikelyIp ? 'IP' : isLikelyMac ? 'MAC' : 'S/N'} ${escapeHtml(rawTarget)}...</span>`
    : `<span>Varrendo ${isGlobal ? 'todas as faixas' : '254 IPs'}...</span>`;

  if (DOM.macScannerProgress) DOM.macScannerProgress.style.display = 'block';
  if (DOM.macScannerStatusText) {
    const targetLabel = isLikelyMac ? `MAC ${rawTarget}` : `Serial ${rawTarget}`;
    DOM.macScannerStatusText.textContent = isLikelyIp ? `Consultando a impressora no IP ${rawTarget}...` : isGlobal
      ? (rawTarget ? `Procurando ${targetLabel} em todas as faixas corporativas...` : `Varrendo faixas corporativas (Porta UDP 161)...`)
      : (rawTarget ? `Procurando ${targetLabel} em ${subnet}.1 até ${subnet}.254...` : `Varrendo ${subnet}.1 até ${subnet}.254 (Porta UDP 161)...`);
  }
  if (DOM.macScannerCountText) {
    DOM.macScannerCountText.textContent = isLikelyIp ? 'Consultando 1 endereço...' : isGlobal
      ? 'Consultando faixas em sequência com parada rápida...'
      : 'Enviando sondas SNMP em paralelo...';
  }
  if (DOM.macScannerResults) {
    DOM.macScannerResults.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-secondary); padding: 0.5rem 0;">Aguardando respostas SNMP das impressoras${isLikelyIp ? ` no IP <code>${escapeHtml(rawTarget)}</code>` : isGlobal ? ' em todas as faixas corporativas' : ` na faixa <code>${subnet}.0/24</code>`}...</div>`;
  }

  try {
    const payload = {
      isGlobal: !isLikelyIp && isGlobal,
      targetIp: isLikelyIp ? rawTarget : undefined,
      subnet: isGlobal ? 'global' : subnet,
      unitId: isGlobal ? 'global' : (DOM.macScanUnitSelect.value || undefined),
      targetIdentifier: rawTarget || undefined,
      targetMac: cleanTargetMac || undefined,
      targetSerial: cleanTargetSerial || undefined,
      autoReconcile: true
    };

    const res = await API.scanSubnetForMac(payload);

    if (DOM.macScannerProgress) DOM.macScannerProgress.style.display = 'none';

    if (res.success) {
      let found = res.devices || res.found || [];
      const reconciled = res.reconciled || [];
      const telemetryRefreshed = res.telemetryRefreshed || [];

      // Se o usuário especificou um alvo, filtra estritamente para exibir APENAS a impressora correspondente
      if (rawTarget) {
        found = found.filter(dev => {
          if (isLikelyIp) return dev.ip === rawTarget;
          if (cleanTargetMac) {
            const devMac = (dev.macAddress || dev.mac || '').toUpperCase().replace(/[:-]/g, '');
            return devMac === cleanTargetMac;
          }
          if (cleanTargetSerial) {
            const devSerial = (dev.serial || dev.serialNumber || '').toUpperCase().replace(/[\s-]/g, '');
            const pSerial = (dev.registeredName || '').toUpperCase().replace(/[\s-]/g, '');
            return (devSerial && (devSerial === cleanTargetSerial || devSerial.includes(cleanTargetSerial))) ||
                   (pSerial && (pSerial === cleanTargetSerial || pSerial.includes(cleanTargetSerial)));
          }
          return true;
        });
      }

      const successfulTelemetryRefreshes = telemetryRefreshed.filter(t => t?.online === true);
      const sameIpConfirmedCount = found.filter(dev => dev.sameIpConfirmed).length;

      if (found.length === 0) {
        if (rawTarget) {
          DOM.macScannerResults.innerHTML = `
            <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: var(--radius-md); padding: 1.25rem; text-align: center;">
              <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; color: var(--color-danger); font-weight: 700; margin-bottom: 0.35rem; font-size: 0.95rem;">
                ${Icons.alertOctagon}
                <span>Impressora com ${isLikelyIp ? 'IP' : isLikelyMac ? 'MAC' : 'Número de Série'} não encontrada</span>
              </div>
              <p style="font-size: 0.85rem; color: var(--text-primary); margin: 0 0 0.4rem 0;">
                Nenhuma impressora retornou uma leitura válida para ${isLikelyIp ? 'o IP' : isLikelyMac ? 'o MAC' : 'a série'} <code>${escapeHtml(rawTarget)}</code>${isLikelyIp ? '' : isGlobal ? ' nas faixas corporativas' : ` na sub-rede <code>${subnet}.0/24</code>`}.
              </p>
              <p style="font-size: 0.775rem; color: var(--text-muted); margin: 0;">
                Certifique-se de que a impressora está ligada, conectada à rede corporativa e com o protocolo SNMP (UDP 161) habilitado. Se for um prédio novo, adicione a faixa em "Faixas Corporativas".
              </p>
            </div>
          `;
          showToast(`Impressora com ${isLikelyIp ? 'IP' : isLikelyMac ? 'MAC' : 'S/N'} ${rawTarget} não encontrada.`, 'warning');
        } else {
          DOM.macScannerResults.innerHTML = `
            <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: var(--radius-md); padding: 1rem; text-align: center;">
              <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; color: var(--color-danger); font-weight: 700; margin-bottom: 0.35rem;">
                ${Icons.alertOctagon}
                <span>Nenhuma impressora respondeu ${isGlobal ? 'nas faixas corporativas' : `na sub-rede ${subnet}.0/24`}</span>
              </div>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">
                Certifique-se de que as sub-redes estão corretas e que os equipamentos estão com SNMP UDP 161 ativo.
              </p>
            </div>
          `;
          showToast('Nenhuma impressora respondeu no escopo informado.', 'warning');
        }
      } else {
        const headerTitle = rawTarget
          ? `<span style="color: var(--color-success); font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem;">
               ${Icons.checkCircle}
               <span>Impressora localizada pelo ${isLikelyIp ? 'IP' : isLikelyMac ? 'MAC' : 'Número de Série'}:</span>
             </span>`
          : `<span>Encontradas <strong>${found.length}</strong> impressora(s)${isGlobal ? ' no parque' : ' na sub-rede'}:</span>`;

        let resultsHTML = `
          <div style="margin-bottom: 0.75rem; font-size: 0.825rem; color: var(--text-secondary); display: flex; justify-content: space-between; align-items: center;">
            ${headerTitle}
            ${reconciled.length > 0 ? `<span class="state-chip ok" style="font-size: 0.75rem;">${reconciled.length} reconciliada(s) automaticamente!</span>` : ''}
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        `;

        found.forEach(dev => {
          const devMac = dev.macAddress || dev.mac || '';
          const devSerial = dev.serial || dev.serialNumber || '';
          const recInfo = reconciled.find(r => (devMac && (r.macAddress || r.mac) === devMac) || (devSerial && (r.serialNumber || r.serial) === devSerial));
          const isReconciled = !!recInfo;
          const matchedPrinter = AppState.printers.find(p => p.id === dev.registeredPrinterId) || null;
          const previousPrinterId = dev.replacementPrinterId || dev.existingPrinterId;
          const previousPrinter = AppState.printers.find(p => p.id === previousPrinterId);
          const telemetryInfo = telemetryRefreshed.find(t => t.printerId === dev.registeredPrinterId);
          const telemetryRevalidated = Boolean(dev.telemetryOnline || telemetryInfo?.online);

          // Sugestão de filial com base na sub-rede encontrada
          let suggestedUnit = null;
          if (dev.foundInSubnet) {
            const pWithSubnet = AppState.printers.find(p => p.ip && p.ip.startsWith(dev.foundInSubnet + '.'));
            if (pWithSubnet) {
              suggestedUnit = AppState.units.find(u => u.id === pWithSubnet.unitId);
            }
          }

          resultsHTML += `
            <div style="background: var(--bg-surface-light); border: 1px solid ${dev.replacementRequired ? 'var(--color-warning)' : isReconciled ? 'var(--color-success)' : 'var(--border-card)'}; border-radius: var(--radius-md); padding: 0.75rem; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;">
              <div>
                <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.4rem;">
                  <span>${escapeHtml(formatCleanModel(dev.model) || dev.name || 'Impressora')}</span>
                  ${dev.vendor ? `<span class="deck-status-capsule" style="font-size: 0.65rem;">${escapeHtml(dev.vendor)}</span>` : ''}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 3px; font-family: var(--font-mono);">
                  IP: <strong style="color: var(--color-primary);">${escapeHtml(dev.ip)}</strong> • MAC: <strong>${escapeHtml(devMac || 'N/D')}</strong>
                  ${dev.serial ? ` • S/N: <strong style="color: var(--color-brand);">${escapeHtml(dev.serial)}</strong>` : ''}
                </div>
                ${dev.foundInSubnet ? `
                  <div style="font-size: 0.72rem; color: var(--color-brand); margin-top: 2px; display: flex; align-items: center; gap: 0.3rem;">
                    <svg class="icon icon-xs" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    <span>Faixa: <strong>${escapeHtml(dev.foundInSubnet)}.0/24</strong> ${dev.subnetDescription ? `(${escapeHtml(dev.subnetDescription)})` : ''}</span>
                  </div>
                ` : ''}
                ${previousPrinter ? `<div style="font-size: 0.75rem; color: var(--color-warning); margin-top: 6px;">${dev.replacementRequired ? 'Equipamento diferente do cadastro.' : 'Identidade física ainda não confirmada.'}<br>Cadastro anterior: ${escapeHtml(previousPrinter.location || previousPrinter.name)} · Série ${escapeHtml(dev.previousIdentity?.serialNumber || 'Desconhecida')} · MAC ${escapeHtml(dev.previousIdentity?.macAddress || 'Desconhecido')}</div>` : ''}
                ${matchedPrinter ? `
                  <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
                    Cadastro: <strong>${escapeHtml(matchedPrinter.location || matchedPrinter.name)}</strong> (${escapeHtml(matchedPrinter.unitName || 'Sem Unidade')})
                  </div>
                ` : ''}
              </div>
              <div id="action-cell-${escapeHtml(dev.ip).replace(/[^a-zA-Z0-9]/g, '_')}" style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.35rem;">
                ${previousPrinterId ? `
                  <span class="state-chip warning">${dev.replacementRequired ? 'Substituição detectada' : 'Identidade não confirmada'}</span>
                  <button type="button" class="cyber-button primary btn-sm" data-scanner-replace data-printer-id="${escapeHtml(previousPrinterId)}" data-ip="${escapeHtml(dev.ip)}">Registrar substituição</button>
                  <span style="font-size: 0.7rem; color: var(--text-muted); max-width: 180px;">O histórico anterior será preservado.</span>
                ` : isReconciled ? `
                  <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; justify-content: flex-end;">
                    ${telemetryRevalidated && (dev.registeredPrinterId || matchedPrinter?.id) ? `
                      <button type="button" class="cyber-button primary btn-sm" onclick="closeMacScannerModal(); openPrinterDetailDrawer(${jsArg(dev.registeredPrinterId || matchedPrinter?.id)});" style="font-size: 0.75rem; padding: 0.35rem 0.75rem; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.35rem;" title="Ver detalhes da impressora">
                        ${Icons.eye}
                        <span>Ver Detalhes</span>
                      </button>
                      <button type="button" class="cyber-button btn-sm" onclick="closeMacScannerModal();" style="font-size: 0.72rem; padding: 0.35rem 0.6rem; white-space: nowrap;">
                        Fechar
                      </button>
                    ` : `
                      <button type="button" class="cyber-button primary btn-sm" onclick="handleScannerReconnect(${jsArg(dev.registeredPrinterId || matchedPrinter?.id || '')}, ${jsArg(dev.ip)}, this)" style="font-size: 0.75rem; padding: 0.35rem 0.75rem; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.35rem;" title="Forçar revalidação e reconectar esta impressora agora">
                        <svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                        <span>Reconectar / Atualizar Agora</span>
                      </button>
                    `}
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <span class="state-chip ok" style="font-size: 0.72rem; white-space: nowrap;" title="IP atualizado de ${escapeHtml(recInfo.previousIp || recInfo.oldIp)} para ${escapeHtml(recInfo.newIp)}">
                      ${telemetryRevalidated ? '✔ IP atualizado • Telemetria revalidada (Online)' : 'IP atualizado • Telemetria pendente'}
                    </span>
                    <button type="button" class="deck-action-pill" onclick="openAssignIpModal(${jsArg(dev.ip)}, ${jsArg(devMac)}, ${jsArg(dev.serial || '')}, ${jsArg(dev.registeredPrinterId || matchedPrinter?.id || '')}, ${jsArg(dev.model || '')})" style="font-size: 0.68rem; padding: 2px 6px;" title="Vincular este IP a outra impressora">
                      Vincular a outra...
                    </button>
                  </div>
                ` : matchedPrinter ? `
                  ${matchedPrinter.ip !== dev.ip && !dev.sameIpConfirmed ? `
                    <button type="button" class="cyber-button primary btn-sm" onclick="handleDirectAssignIp(${jsArg(matchedPrinter.id)}, ${jsArg(dev.ip)}, ${jsArg(devMac)}, ${jsArg(dev.serial || '')}, this)" style="font-size: 0.75rem; padding: 0.35rem 0.75rem; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.35rem;" title="Adicionar e salvar o IP ${escapeHtml(dev.ip)} para a impressora ${escapeHtml(matchedPrinter.location || matchedPrinter.name)}">
                      <svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
                      <span>Usar IP Encontrado</span>
                    </button>
                  ` : `
                    <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; justify-content: flex-end;">
                      ${telemetryRevalidated ? `
                        <button type="button" class="cyber-button primary btn-sm" onclick="closeMacScannerModal(); openPrinterDetailDrawer(${jsArg(matchedPrinter.id)});" style="font-size: 0.75rem; padding: 0.35rem 0.75rem; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.35rem;" title="Ver detalhes da impressora">
                          ${Icons.eye}
                          <span>Ver Detalhes</span>
                        </button>
                        <button type="button" class="cyber-button btn-sm" onclick="closeMacScannerModal();" style="font-size: 0.72rem; padding: 0.35rem 0.6rem; white-space: nowrap;">
                          Fechar
                        </button>
                      ` : `
                        <button type="button" class="cyber-button primary btn-sm" onclick="handleScannerReconnect(${jsArg(matchedPrinter.id)}, ${jsArg(dev.ip)}, this)" style="font-size: 0.75rem; padding: 0.35rem 0.75rem; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.35rem;" title="Forçar revalidação e reconectar esta impressora agora">
                          <svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                          <span>Reconectar / Atualizar Agora</span>
                        </button>
                      `}
                    </div>
                  `}
                  <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <span class="state-chip ok" style="font-size: 0.68rem;">${dev.sameIpConfirmed || matchedPrinter.ip === dev.ip
                      ? (telemetryRevalidated ? '✔ Conexão Ativa • Online (Mesmo IP confirmado • Telemetria revalidada)' : 'Mesmo IP confirmado • Telemetria pendente')
                      : 'IP encontrado'}</span>
                    <button type="button" class="deck-action-pill" onclick="openAssignIpModal(${jsArg(dev.ip)}, ${jsArg(devMac)}, ${jsArg(dev.serial || '')}, ${jsArg(matchedPrinter.id)}, ${jsArg(dev.model || '')})" style="font-size: 0.68rem; padding: 2px 7px;" title="Vincular a outra impressora do parque">
                      Outra Impressora...
                    </button>
                  </div>
                ` : `
                  <button type="button" class="cyber-button primary btn-sm" onclick="openAssignIpModal(${jsArg(dev.ip)}, ${jsArg(devMac)}, ${jsArg(dev.serial || '')}, '', ${jsArg(dev.model || '')})" style="font-size: 0.75rem; padding: 0.35rem 0.75rem; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.35rem;" title="Vincular este IP a uma impressora existente">
                    <svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><line x1="2" x2="22" y1="12" y2="12"/></svg>
                    <span>Adicionar IP à Impressora</span>
                  </button>
                  <button type="button" class="btn btn-secondary btn-sm" onclick="handleQuickAddDiscovered(${jsArg(dev.ip)}, ${jsArg(devMac)}, ${jsArg(dev.model || '')}, ${jsArg(suggestedUnit ? suggestedUnit.id : '')}, ${jsArg(dev.serial || '')})" style="font-size: 0.7rem; padding: 0.2rem 0.55rem; white-space: nowrap;">
                    ${suggestedUnit ? `+ Cadastrar em ${escapeHtml(suggestedUnit.name.split(' ')[0])}` : '+ Cadastrar Nova'}
                  </button>
                `}
              </div>
            </div>
          `;
        });

        resultsHTML += `</div>`;
        DOM.macScannerResults.innerHTML = resultsHTML;
        for (const button of DOM.macScannerResults.querySelectorAll('[data-scanner-replace]')) {
          button.addEventListener('click', () => {
            closeMacScannerModal();
            window.PrinterReplacement.open(button.dataset.printerId, button.dataset.ip);
          });
        }

        if (reconciled.length > 0 || telemetryRefreshed.length > 0) {
          await loadDashboardData(false, true);
        }

        if (found.some(dev => dev.replacementRequired || dev.identityUnconfirmed)) {
          showToast('Revise o equipamento encontrado e registre a substituição para preservar o histórico.', 'warning');
        } else if (reconciled.length > 0) {
          if (successfulTelemetryRefreshes.length > 0) {
            showToast(`IP localizado e reconciliado. Telemetria revalidada para ${successfulTelemetryRefreshes.length} impressora(s).`, 'success');
          } else {
            showToast('IP localizado e reconciliado, mas a telemetria completa ainda está pendente.', 'warning');
          }
        } else if (successfulTelemetryRefreshes.length > 0) {
          showToast('Mesmo IP confirmado. Telemetria da impressora foi revalidada.', 'success');
        } else if (sameIpConfirmedCount > 0) {
          showToast('Mesmo IP confirmado. O hardware respondeu ao scanner, mas a telemetria completa ainda está pendente.', 'warning');
        } else if (rawTarget) {
          showToast(`Impressora localizada no IP ${found[0]?.ip}; telemetria ainda não foi confirmada.`, 'warning');
        } else {
          showToast(`${found.length} dispositivo(s) localizado(s).`, 'info');
        }
      }
    } else {
      DOM.macScannerResults.innerHTML = `<div style="color: var(--color-danger); font-size: 0.85rem;">Erro: ${escapeHtml(res.error || 'Falha na varredura')}</div>`;
      showToast(res.error || 'Falha na varredura', 'error');
    }
  } catch (err) {
    if (DOM.macScannerProgress) DOM.macScannerProgress.style.display = 'none';
    DOM.macScannerResults.innerHTML = `<div style="color: var(--color-danger); font-size: 0.85rem;">Falha na varredura: ${escapeHtml(err.message)}</div>`;
    showToast(err.message || 'Falha na varredura', 'error');
  } finally {
    DOM.btnSubmitMacScan.disabled = false;
    updateMacScanButtonText();
  }
}

function handleQuickAddDiscovered(ip, mac, model, suggestedUnitId = '', serial = '') {
  closeMacScannerModal();
  openAddPrinterModal();
  if (DOM.formIp) DOM.formIp.value = ip;
  if (DOM.formMac) DOM.formMac.value = mac;
  if (DOM.formLocation) DOM.formLocation.value = formatCleanModel(model) || '';
  if (serial && DOM.formName && !DOM.formName.value) DOM.formName.value = serial;
  if (suggestedUnitId && DOM.formUnitSelect) {
    DOM.formUnitSelect.value = suggestedUnitId;
  }
}

// ==========================================================================
// 12.2 ATRIBUIÇÃO E VINCULAÇÃO DIRETA DE IP A IMPRESSORA
// ==========================================================================
async function handleDirectAssignIp(printerId, newIp, mac = '', serial = '', btnElement = null) {
  const origHTML = btnElement ? btnElement.innerHTML : '';
  if (btnElement) {
    btnElement.disabled = true;
    btnElement.innerHTML = `<span style="font-size: 0.72rem;">Salvando IP...</span>`;
  }

  try {
    const res = await API.assignIpToPrinter({
      printerId,
      newIp,
      macAddress: mac || undefined,
      serialNumber: serial || undefined
    });

    showToast(res.message || `IP ${newIp} atribuído à impressora com sucesso!`, 'success');

    // Atualiza a célula de ação para estado de sucesso
    const cellId = `action-cell-${newIp.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const cell = document.getElementById(cellId);
    if (cell) {
      cell.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem;">
          <span class="state-chip ok" style="font-size: 0.75rem; white-space: nowrap;">
            ✅ IP Atribuído!
          </span>
          <button type="button" class="deck-action-pill" onclick="openAssignIpModal(${jsArg(newIp)}, ${jsArg(mac)}, ${jsArg(serial)}, ${jsArg(printerId)})" style="font-size: 0.68rem; padding: 2px 6px;">
            Alterar Impressora
          </button>
        </div>
      `;
    }

    await loadDashboardData(false, true);
  } catch (err) {
    if (btnElement) {
      btnElement.disabled = false;
      btnElement.innerHTML = origHTML;
    }
    showToast(err.message || 'Erro ao atribuir IP à impressora', 'error');
  }
}
window.handleDirectAssignIp = handleDirectAssignIp;

// ==========================================================================
// 12.3 RECONEXÃO E ATUALIZAÇÃO IMEDIATA A PARTIR DO SCANNER
// ==========================================================================
async function handleScannerReconnect(printerId, ip, btnElement) {
  if (!printerId) return;
  const origHtml = btnElement ? btnElement.innerHTML : '';
  if (btnElement) {
    btnElement.disabled = true;
    btnElement.innerHTML = `
      <svg class="icon icon-xs rotating" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
      <span>Reconectando...</span>
    `;
  }

  try {
    const updatedStatus = await API.getPrinterStatus(printerId);
    const existing = AppState.statusData.get(printerId) || {};
    AppState.statusData.set(printerId, { ...existing, ...updatedStatus });

    const healthResponse = await API.getPrinterHealth(printerId).catch(() => null);
    if (healthResponse?.health) {
      AppState.healthData.set(printerId, healthResponse.health);
    }

    await loadDashboardData(false, true);

    const cellId = `action-cell-${ip.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const cell = document.getElementById(cellId);
    if (cell) {
      cell.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.35rem;">
          <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; justify-content: flex-end;">
            <button type="button" class="cyber-button primary btn-sm" onclick="closeMacScannerModal(); openPrinterDetailDrawer(${jsArg(printerId)});" style="font-size: 0.75rem; padding: 0.35rem 0.75rem; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.35rem;" title="Ver detalhes completos desta impressora">
              ${Icons.eye}
              <span>Ver Detalhes</span>
            </button>
            <button type="button" class="cyber-button btn-sm" onclick="handleScannerReconnect(${jsArg(printerId)}, ${jsArg(ip)}, this)" style="font-size: 0.7rem; padding: 0.3rem 0.55rem; white-space: nowrap;" title="Reconsultar status novamente">
              <svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              <span>Atualizar</span>
            </button>
          </div>
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <span class="state-chip ok" style="font-size: 0.72rem; white-space: nowrap;">
              ✔ Conexão Reestabelecida • Online
            </span>
            <button type="button" class="deck-action-pill" onclick="openAssignIpModal(${jsArg(ip)}, '', '', ${jsArg(printerId)})" style="font-size: 0.68rem; padding: 2px 7px;" title="Vincular a outra impressora do parque">
              Outra Impressora...
            </button>
          </div>
        </div>
      `;
    }
    showToast('Conexão reestabelecida e telemetria atualizada com sucesso!', 'success');
  } catch (err) {
    if (btnElement) {
      btnElement.disabled = false;
      btnElement.innerHTML = origHtml;
    }
    showToast('Erro ao reconectar impressora: ' + err.message, 'error');
  }
}
window.handleScannerReconnect = handleScannerReconnect;

function openAssignIpModal(newIp, mac = '', serial = '', preselectPrinterId = '', model = '') {
  if (!DOM.modalAssignIp) return;

  if (DOM.assignIpDisplayIp) DOM.assignIpDisplayIp.textContent = `IP: ${newIp}`;
  if (DOM.assignIpDisplayMac) DOM.assignIpDisplayMac.textContent = mac || 'Não informado';
  if (DOM.assignIpDisplaySerial) DOM.assignIpDisplaySerial.textContent = serial || 'N/D';
  if (DOM.assignIpDisplaySerialContainer) {
    DOM.assignIpDisplaySerialContainer.style.display = serial ? 'inline' : 'none';
  }
  if (DOM.assignIpDisplayModel) {
    DOM.assignIpDisplayModel.textContent = `Modelo: ${formatCleanModel(model) || model || 'Detectado via SNMP'}`;
  }

  if (DOM.assignIpVal) DOM.assignIpVal.value = newIp || '';
  if (DOM.assignMacVal) DOM.assignMacVal.value = mac || '';
  if (DOM.assignSerialVal) DOM.assignSerialVal.value = serial || '';

  // Popula o seletor com as impressoras cadastradas
  if (DOM.assignTargetPrinterSelect) {
    const allPrinters = (AppState.printers || []).filter(p => p.connectionType !== 'usb');
    const pendingPrinters = allPrinters.filter(p => !p.ip || p.ip.startsWith('pendente-') || p.ip === '-');
    const normalPrinters = allPrinters.filter(p => p.ip && !p.ip.startsWith('pendente-') && p.ip !== '-');

    pendingPrinters.sort((a, b) => (a.location || a.name).localeCompare(b.location || b.name));
    normalPrinters.sort((a, b) => (a.unitName || '').localeCompare(b.unitName || '') || (a.location || a.name).localeCompare(b.location || b.name));

    let selectHTML = '<option value="">-- Selecione a Impressora de Destino --</option>';

    if (pendingPrinters.length > 0) {
      selectHTML += `<optgroup label="⚠️ Impressoras Aguardando / Pendentes de IP (${pendingPrinters.length})">`;
      selectHTML += pendingPrinters.map(p => {
        const uName = p.unitName || 'Sem Unidade';
        const isSel = preselectPrinterId === p.id;
        return `<option value="${escapeHtml(p.id)}" ${isSel ? 'selected' : ''}>[PENDENTE] ${escapeHtml(p.location || p.name)} (${escapeHtml(uName)})</option>`;
      }).join('');
      selectHTML += `</optgroup>`;
    }

    if (normalPrinters.length > 0) {
      const byUnit = new Map();
      normalPrinters.forEach(p => {
        const u = p.unitName || 'Outras / Sem Pasta';
        if (!byUnit.has(u)) byUnit.set(u, []);
        byUnit.get(u).push(p);
      });

      byUnit.forEach((prisInUnit, uName) => {
        selectHTML += `<optgroup label="Filial: ${escapeHtml(uName)}">`;
        selectHTML += prisInUnit.map(p => {
          const isSel = preselectPrinterId === p.id;
          return `<option value="${escapeHtml(p.id)}" ${isSel ? 'selected' : ''}>${escapeHtml(p.location || p.name)} (IP atual: ${escapeHtml(p.ip)})</option>`;
        }).join('');
        selectHTML += `</optgroup>`;
      });
    }

    DOM.assignTargetPrinterSelect.innerHTML = selectHTML;
    if (preselectPrinterId) {
      DOM.assignTargetPrinterSelect.value = preselectPrinterId;
    }
  }

  updateAssignIpWarning();
  DOM.modalAssignIp.classList.add('active');
}
window.openAssignIpModal = openAssignIpModal;

function closeAssignIpModal() {
  if (DOM.modalAssignIp) DOM.modalAssignIp.classList.remove('active');
}

function updateAssignIpWarning() {
  if (!DOM.assignIpWarning || !DOM.assignTargetPrinterSelect) return;
  const printerId = DOM.assignTargetPrinterSelect.value;
  if (!printerId) {
    DOM.assignIpWarning.style.display = 'none';
    return;
  }
  const printer = AppState.printers.find(p => p.id === printerId);
  const targetIp = DOM.assignIpVal ? DOM.assignIpVal.value : '';

  if (printer && printer.ip && !isPrinterUnconfigured(printer) && printer.ip !== targetIp) {
    DOM.assignIpWarning.style.display = 'block';
    DOM.assignIpWarning.innerHTML = `
      <strong>Atenção:</strong> Esta impressora já possui o IP <code>${escapeHtml(printer.ip)}</code> cadastrado.
      Ao confirmar, o IP anterior será substituído pelo novo IP <code>${escapeHtml(targetIp)}</code>.
    `;
  } else {
    DOM.assignIpWarning.style.display = 'none';
  }
}

async function handleAssignIpSubmit(e) {
  e.preventDefault();
  const printerId = DOM.assignTargetPrinterSelect ? DOM.assignTargetPrinterSelect.value : '';
  const newIp = DOM.assignIpVal ? DOM.assignIpVal.value.trim() : '';
  const mac = DOM.assignMacVal ? DOM.assignMacVal.value.trim() : '';
  const serial = DOM.assignSerialVal ? DOM.assignSerialVal.value.trim() : '';

  if (!printerId) {
    showToast('Selecione uma impressora de destino para atribuir o IP.', 'error');
    return;
  }
  if (!newIp) {
    showToast('Endereço IP inválido.', 'error');
    return;
  }

  if (DOM.btnSubmitAssignIp) {
    DOM.btnSubmitAssignIp.disabled = true;
    DOM.btnSubmitAssignIp.innerHTML = '<span>Salvando...</span>';
  }

  try {
    const res = await API.assignIpToPrinter({
      printerId,
      newIp,
      macAddress: mac || undefined,
      serialNumber: serial || undefined
    });

    closeAssignIpModal();
    showToast(res.message || `IP ${newIp} atribuído com sucesso!`, 'success');

    // Atualiza a célula de ação no scanner se o card estiver aberto
    const cellId = `action-cell-${newIp.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const cell = document.getElementById(cellId);
    if (cell) {
      cell.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem;">
          <span class="state-chip ok" style="font-size: 0.75rem; white-space: nowrap;">
            ✅ IP ${escapeHtml(newIp)} Atribuído!
          </span>
          <button type="button" class="deck-action-pill" onclick="openAssignIpModal(${jsArg(newIp)}, ${jsArg(mac)}, ${jsArg(serial)}, ${jsArg(printerId)})" style="font-size: 0.68rem; padding: 2px 6px;">
            Alterar Impressora
          </button>
        </div>
      `;
    }

    await loadDashboardData(false, true);
  } catch (err) {
    showToast(err.message || 'Erro ao atribuir IP à impressora.', 'error');
  } finally {
    if (DOM.btnSubmitAssignIp) {
      DOM.btnSubmitAssignIp.disabled = false;
      DOM.btnSubmitAssignIp.innerHTML = `<svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg><span>Salvar e Atribuir IP</span>`;
    }
  }
}

// ==========================================================================
// 13. SIDE DRAWER (RAIO-X 360° DA IMPRESSORA)
// ==========================================================================
let currentDrawerPrinterId = null;
let scrollLockCount = 0;
let savedScrollPosition = 0;
let lastActiveTriggerElement = null;

function lockBodyScroll(type = 'modal') {
  if (scrollLockCount === 0) {
    savedScrollPosition = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    lastActiveTriggerElement = document.activeElement;

    // Compensa a largura da barra de rolagem para evitar layout shift horizontal
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.classList.add('scroll-locked');
  }
  scrollLockCount++;

  if (type === 'drawer') {
    document.body.classList.add('drawer-open');
  } else {
    document.body.classList.add('modal-open');
  }
}

function unlockBodyScroll(type = 'modal') {
  if (type === 'drawer') {
    if (DOM.drawerPrinterDetail) {
      DOM.drawerPrinterDetail.classList.remove('active');
    }
    document.body.classList.remove('drawer-open');
  } else {
    document.body.classList.remove('modal-open');
  }

  // Verifica se ainda há qualquer gaveta ou modal ativo
  const anyActiveDrawer = document.querySelector('.drawer-backdrop.active');
  const anyActiveModal = document.querySelector('.modal-backdrop.active');

  if (!anyActiveDrawer && !anyActiveModal) {
    scrollLockCount = 0;
    document.body.classList.remove('scroll-locked');
    document.body.classList.remove('drawer-open');
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('scroll-locked');
    document.documentElement.classList.remove('drawer-open');
    document.documentElement.classList.remove('modal-open');
    document.body.style.paddingRight = '';

    const targetY = savedScrollPosition;
    if (typeof targetY === 'number' && targetY >= 0) {
      window.scrollTo({ top: targetY, behavior: 'instant' });
      requestAnimationFrame(() => {
        window.scrollTo({ top: targetY, behavior: 'instant' });
      });
    }

    if (lastActiveTriggerElement && typeof lastActiveTriggerElement.focus === 'function') {
      try {
        lastActiveTriggerElement.focus({ preventScroll: true });
      } catch {}
      lastActiveTriggerElement = null;
    }
  } else {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
  }
}

async function openPrinterDetailDrawer(id) {
  if (window.PrinterDiagnosticUI) window.PrinterDiagnosticUI.close(DOM.detailModalBody);
  const printer = AppState.printers.find(p => p.id === id);
  if (!printer) return;

  window.WorkstationModule?.closeDetail();
  currentDrawerPrinterId = id;
  const status = AppState.statusData.get(id);
  DOM.btnDetailRefresh.style.display = printer.connectionType === 'usb' ? 'none' : 'inline-flex';
  if (printer.connectionType === 'usb') {
    DOM.detailPrinterName.textContent = printer.name + ' · USB';
    lockBodyScroll('drawer'); DOM.drawerPrinterDetail.classList.add('active');
    DOM.btnDetailEdit.style.display='none';DOM.btnDetailDelete.style.display='none';
    document.getElementById('btn-detail-replace').style.display='none';
    await window.WorkstationModule.renderDetail(printer,status,DOM.detailModalBody,AppState.userRole==='admin');
    return;
  }
  const info = status?.info || {};
  const supplies = status?.supplies || [];
  const trays = status?.trays || [];
  const isOnline = status?.online;
  const healthMeta = getHealthUiMeta(printer, status);
  const health = healthMeta.health;
  const hasConfirmedConnectivityFailure = isHealthFailureState(healthMeta.state);
  const connectivityConfirmationPending = isConnectivityConfirmationPending(printer, status);
  const storedReading = ['unknown', 'stale'].includes(healthMeta.state);
  const healthFailureCount = Number.isInteger(health?.consecutiveFailures) ? health.consecutiveFailures : null;
  const healthLastSuccess = health?.lastSuccessAt ? formatFullDateTime(health.lastSuccessAt) : 'Sem leitura válida registrada';
  const healthLastCheck = health?.lastCheckAt ? formatFullDateTime(health.lastCheckAt) : 'N/D';
  const activity = getPrinterActivity(printer, status);
  const healthOperationalText = activity?.label || getHealthSecondaryText(health) || healthMeta.label;
  const healthReasonText = health?.reason || healthMeta.label;

  const cleanModel = formatCleanModel(info.model);
  const locationTitle = getPrinterLocationTitle(printer);

  DOM.detailPrinterName.textContent = locationTitle;

  // Trava scroll da tela de fundo e abre a gaveta imediatamente
  lockBodyScroll('drawer');
  DOM.drawerPrinterDetail.classList.add('active');

  const tonerSupplies = [];
  const drumSupplies = [];
  const maintenanceSupplies = [];
  const wasteSupplies = [];

  if (!hasConfirmedConnectivityFailure && supplies.length > 0) {
    supplies.forEach(s => {
      const kind = HefestoSupplySemantics.component(s);
      if (isWasteSupply(s)) {
        wasteSupplies.push(s);
      } else if (kind === 'imaging') {
        drumSupplies.push(s);
      } else if (kind === 'maintenance') {
        maintenanceSupplies.push(s);
      } else {
        tonerSupplies.push(s);
      }
    });
  }

  // Buscar histórico de recargas específico desta impressora
  let printerRecharges = [];
  try {
    printerRecharges = await API.getRecharges({ printerId: printer.id });
  } catch (err) {
    printerRecharges = [];
  }

  const isAdmin = AppState.userRole === 'admin';

  function renderSupplyCardsList(list) {
    return list.map(s => {
      const pct = normalizeSupplyPercentage(s);
      const view = HefestoSupplySemantics.describe(s);
      const textVal = escapeHtml(view.valueLabel);
      const fillWidth = view.percentage ?? 0;
      const statusClass = view.status;
      const borderStatus = statusClass === 'critical' ? 'var(--color-danger)' : statusClass === 'warning' ? 'var(--color-warning)' : statusClass === 'unknown' ? 'var(--text-muted)' : 'var(--color-success)';
      const dotColor = getSupplyColorByName(s.name);

      const matchedRec = printerRecharges.find(r => r.supplyName === s.name || r.supplyType === s.type);
      const isRecentlyRecharged = matchedRec && (Date.now() - new Date(matchedRec.timestamp).getTime()) < (7 * 86400000);
      const rechargeBadge = isRecentlyRecharged
        ? `<span class="printer-recharge-tag" style="margin-left: 0.4rem; font-size: 0.65rem;" title="Trocado em ${formatFullDateTime(matchedRec.timestamp)} (${matchedRec.newLevel}%)">Recarga (${matchedRec.newLevel}%)</span>`
        : '';

      // Identificação inteligente de compartimento duplo K1 / K2 (ex: Xerox C60/C70)
      const isDualK = view.kind === 'consumable' && /(?:^|[^a-z0-9])k[12](?:[^a-z0-9]|$)/i.test(s.name || '');
      let dualBadge = '';
      if (isDualK) {
        const partner = tonerSupplies.find(o => o !== s && /k1|k2/i.test(o.name || ''));
        const partnerPct = partner ? normalizeSupplyPercentage(partner) : 0;
        if (/k1/i.test(s.name) && pct > 10) {
          dualBadge = `<span class="printer-recharge-tag" style="margin-left: 0.4rem; font-size: 0.65rem; background: rgba(16, 185, 129, 0.15); color: var(--color-success); border: 1px solid var(--color-success);">● Cartucho Ativo</span>`;
        } else if (/k2/i.test(s.name)) {
          if (pct >= 0 && pct <= 10 && partnerPct > 10) {
            dualBadge = `<span class="printer-recharge-tag partial" style="margin-left: 0.4rem; font-size: 0.65rem;" title="A máquina está operando normalmente com o toner K1. Este compartimento pode ser abastecido preventivamente.">Reserva Vazia (K1 Ativo)</span>`;
          } else if (pct > 10) {
            dualBadge = `<span class="printer-recharge-tag" style="margin-left: 0.4rem; font-size: 0.65rem; background: rgba(16, 185, 129, 0.15); color: var(--color-success); border: 1px solid var(--color-success);">● Cartucho Reserva Pronto</span>`;
          }
        }
      }

      return `
        <div class="detail-chip" style="border-left: 3px solid ${borderStatus};">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary); display: inline-flex; align-items: center; flex-wrap: wrap; gap: 0.35rem;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${dotColor}; display: inline-block;"></span>
              <span>${escapeHtml(translateSupplyName(s.name, s.type))}</span>
              ${rechargeBadge}
              ${dualBadge}
            </span>
            <span class="supply-percentage ${statusClass}" style="font-size: 0.9rem; font-weight: 800; font-family: var(--font-mono);">${textVal}</span>
          </div>
          <div class="progress-track" style="margin-top: 0.45rem;">
            <div class="progress-fill ${statusClass}" style="width: ${fillWidth}%"></div>
          </div>
          ${view.status !== 'ok' ? `<div class="cell-note">${escapeHtml(view.label)}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  // Suprimentos divididos de forma elegante e intuitiva
  let suppliesHTML = '';
  if (!hasConfirmedConnectivityFailure && (tonerSupplies.length > 0 || drumSupplies.length > 0 || maintenanceSupplies.length > 0 || wasteSupplies.length > 0)) {
    if (storedReading) {
      suppliesHTML += `<p style="color: var(--color-warning); font-size: 0.85rem;">Leitura armazenada • ${escapeHtml(healthMeta.label)}. Os valores abaixo não confirmam a conectividade atual.</p>`;
    } else if (connectivityConfirmationPending && !isOnline) {
      suppliesHTML += `
        <div style="font-size: 0.75rem; color: var(--color-warning); background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: var(--radius-sm); padding: 0.55rem 0.65rem; margin-bottom: 0.65rem;">
          Última tentativa de comunicação falhou. Exibindo a última leitura registrada enquanto a conexão é reestabelecida.
        </div>
      `;
    }
    if (tonerSupplies.length > 0) {
      suppliesHTML += `
        <div style="display: flex; flex-direction: column; gap: 0.65rem;">
          ${renderSupplyCardsList(tonerSupplies)}
        </div>
      `;
    }

    if (drumSupplies.length > 0) {
      suppliesHTML += `
        <h4 style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary); margin-top: 1.25rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.35rem;">
          <svg class="icon icon-xs" viewBox="0 0 24 24" style="color: var(--color-primary);"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span>Cilindros / Fotocondutores (Drums)</span>
        </h4>
        <div style="display: flex; flex-direction: column; gap: 0.65rem;">
          ${renderSupplyCardsList(drumSupplies)}
        </div>
      `;
    }

    if (maintenanceSupplies.length > 0) {
      suppliesHTML += `
        <h4 style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary); margin-top: 1.25rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.35rem;">
          <svg class="icon icon-xs" viewBox="0 0 24 24" style="color: var(--color-primary);"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          <span>Unidades de Fusão & Manutenção</span>
        </h4>
        <div style="display: flex; flex-direction: column; gap: 0.65rem;">
          ${renderSupplyCardsList(maintenanceSupplies)}
        </div>
      `;
    }

    if (drumSupplies.length > 0 || maintenanceSupplies.length > 0) {
      suppliesHTML += '<p class="cell-muted">Vida útil estimada não confirma parada da impressão.</p>';
    }

    if (wasteSupplies.length > 0) {
      suppliesHTML += `
        <h4 style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary); margin-top: 1.25rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.35rem;">
          ${Icons.trash}
          <span>Caixas de Resíduos & Manutenção</span>
        </h4>
        <div style="display: flex; flex-direction: column; gap: 0.65rem;">
          ${renderSupplyCardsList(wasteSupplies)}
        </div>
      `;
    }
  } else if (hasConfirmedConnectivityFailure) {
    suppliesHTML = `<p style="color: var(--color-danger); font-size: 0.85rem;">Equipamento com falha de conectividade confirmada. Exibindo o estado operacional como offline.</p>`;
  } else if (storedReading) {
    suppliesHTML = `<p style="color: var(--color-warning); font-size: 0.85rem;">${escapeHtml(healthMeta.label)}. Sem leitura de suprimentos disponível.</p>`;
  } else if (connectivityConfirmationPending && !isOnline) {
    suppliesHTML = `<p style="color: var(--color-warning); font-size: 0.85rem;">Última tentativa de comunicação falhou; aguardando confirmação antes de declarar o equipamento offline.</p>`;
  } else {
    suppliesHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Suprimentos: N/D (Equipamento não reportou níveis).</p>`;
  }

  let traysHTML = '';
  if (!hasConfirmedConnectivityFailure && trays.length > 0) {
    traysHTML = trays.map(t => `
      <div class="detail-chip">
        <div class="detail-chip-lbl">${Icons.paper} ${escapeHtml(t.name.replace(/Tray/i, 'Bandeja'))}</div>
        <div class="detail-chip-val tabular-nums">${t.percentage >= 0 ? t.percentage + '%' : 'Nível não observável'}</div>
      </div>
    `).join('');
  }

  const serialVal = info.serialNumber && info.serialNumber !== 'N/D'
    ? info.serialNumber
    : (printer.serialNumber || printer.serial || 'N/D');

  // Linha do tempo das recargas e trocas de insumos (Visível para Visualizador de Unidade e Administrador)
  let rechargesSectionHTML = '';
  let rechargesTimelineHTML = '';
  if (printerRecharges.length === 0) {
    rechargesTimelineHTML = `
      <div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.8rem; background: var(--bg-input); border-radius: var(--radius-md); border: 1px dashed var(--border-card);">
        Nenhuma troca de insumo registrada no histórico desta impressora ainda.
      </div>
    `;
  } else {
    rechargesTimelineHTML = printerRecharges.map(rec => {
      const isOfficial = rec.isFullRecharge;
      const formattedDate = formatFullDateTime(rec.timestamp);
      const relTime = formatRelativeTime(rec.timestamp);
      const pagesText = rec.pagesSinceLastRecharge > 0
        ? `<span style="color: var(--color-success); font-weight: 700;">+${escapeHtml(rec.pagesSinceLastRecharge.toLocaleString('pt-BR'))}</span> pág. no ciclo`
        : 'Ciclo inicial';

      return `
        <div class="recharge-item-card">
          <div class="recharge-item-top">
            <div>
              <span class="recharge-item-supply">${escapeHtml(translateSupplyName(rec.supplyName))}</span>
              <span class="printer-recharge-tag ${isOfficial ? '' : 'partial'}" style="margin-left: 0.5rem;">${escapeHtml(rechargeEvidenceLabel(rec))}</span>
            </div>
            <span class="recharge-item-date" title="${escapeHtml(formattedDate)}">${escapeHtml(relTime)}</span>
          </div>
          <div class="recharge-item-meta">
            <span class="recharge-item-stat">Nível: <strong>${escapeHtml(String(rec.previousLevel))}% ➔ ${escapeHtml(String(rec.newLevel))}%</strong></span>
            <span class="recharge-item-stat">Total: <strong>${rec.pageCount ? Number(rec.pageCount).toLocaleString('pt-BR') : '0'} pág.</strong></span>
            <span class="recharge-item-stat">${pagesText}</span>
            <span style="color: var(--text-muted); font-size: 0.7rem;">• ${escapeHtml(rec.technician || 'Sensor SNMP')}</span>
          </div>
          ${rec.notes ? `<div class="recharge-item-notes">Obs: ${escapeHtml(rec.notes)}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  rechargesSectionHTML = `
    <div data-diagnostic-panel="history" class="drawer-recharges-header" style="margin-top: 1.75rem;">
      <div class="drawer-recharges-title">
        <svg class="icon icon-xs" viewBox="0 0 24 24" style="color: var(--color-primary); width: 16px; height: 16px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>Histórico de Trocas de Insumos</span>
      </div>
    </div>
    <div data-diagnostic-panel="history" class="recharges-timeline-list">
      ${rechargesTimelineHTML}
    </div>
  `;

  const curCount = Number.isSafeInteger(info.pageCount) ? info.pageCount : null;
  const initCount = Number.isSafeInteger(printer.initialPageCount) ? printer.initialPageCount : null;
  const pagesUnderManagement = curCount !== null && initCount !== null && curCount >= initCount ? curCount - initCount : null;
  const activatedDateStr = printer.hefestoActivatedAt || printer.createdAt || '2026-08-19T08:00:00.000Z';
  const formattedActivated = formatFullDateTime(activatedDateStr);
  const relActivated = formatRelativeTime(activatedDateStr);
  const installedDateStr = printer.installedAt ? formatFullDateTime(printer.installedAt).split(' ')[0] : 'Não cadastrada';

  if (currentDrawerPrinterId !== id) return;

  DOM.detailModalBody.innerHTML = `
    <div class="detail-meta-grid">
      <div class="detail-chip">
        <div class="detail-chip-lbl">Pasta / Unidade</div>
        <div class="detail-chip-val" style="display: flex; align-items: center; gap: 6px;">
          <span>${escapeHtml(printer.unitName || 'Sem Unidade')}</span>
          <span class="state-chip ${(printer.region || (AppState.units.find(u => u.id === printer.unitId)?.region) || 'RJ') === 'SP' ? 'sp' : 'rj'}">${escapeHtml(printer.region || (AppState.units.find(u => u.id === printer.unitId)?.region) || 'RJ')}</span>
        </div>
      </div>
      <div class="detail-chip">
        <div class="detail-chip-lbl">Modelo da Impressora</div>
        <div class="detail-chip-val" style="font-weight: 700;">${escapeHtml(cleanModel || 'N/D')}</div>
      </div>
      <div class="detail-chip">
        <div class="detail-chip-lbl">Endereço IP</div>
        <div class="detail-chip-val"><code style="font-family: var(--font-mono); color: var(--color-primary);">${escapeHtml(printer.ip)}</code></div>
      </div>
      <div class="detail-chip">
        <div class="detail-chip-lbl">Setor / Local</div>
        <div class="detail-chip-val">${escapeHtml(printer.location || 'Sem localização')}</div>
      </div>
      <div class="detail-chip" style="grid-column: 1 / -1;">
        <div class="detail-chip-lbl">Número de Série</div>
        <div class="detail-chip-val tabular-nums">${escapeHtml(serialVal)}</div>
      </div>
      <div class="detail-chip" style="grid-column: 1 / -1;">
        <div class="detail-chip-lbl">Endereço MAC (Físico)</div>
        <div class="detail-chip-val tabular-nums" style="display: flex; justify-content: space-between; align-items: center;">
          <code style="font-family: var(--font-mono); color: var(--color-primary); font-weight: 700;">${escapeHtml(printer.macAddress || info.macAddress || 'Não cadastrado')}</code>
          ${isAdmin && (hasConfirmedConnectivityFailure || healthMeta.state === 'unconfigured') ? `
            <button type="button" class="btn btn-secondary btn-sm" onclick="openMacScannerModal(${jsArg(printer.macAddress || info.macAddress || '')}, ${jsArg(printer.ip || '')})" style="padding: 0.15rem 0.55rem; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 0.3rem;" title="Rastrear impressora na rede por este MAC">
              <svg class="icon icon-xs" viewBox="0 0 24 24" style="width: 12px; height: 12px;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <span>Buscar na Rede</span>
            </button>
          ` : ''}
        </div>
      </div>
    </div>

    <div class="integration-audit-card" style="margin-top: 1rem; background: var(--bg-surface-light); border: 1px solid var(--border-card); border-left: 4px solid ${isHealthFailureState(healthMeta.state) ? 'var(--color-danger)' : (isHealthAttentionState(healthMeta.state) ? 'var(--color-warning)' : 'var(--color-success)')}; border-radius: var(--radius-md); padding: 0.9rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.65rem;">
        <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary);">Saúde Operacional</span>
        <span class="operational-state-badge ${healthMeta.className}" title="${escapeHtml(healthReasonText)}">${healthMeta.icon}<span>${escapeHtml(healthMeta.label)}</span></span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 0.5rem;">
        <div style="background: var(--bg-card); padding: 0.5rem 0.65rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Situação Atual</div>
          <div style="font-size: 0.85rem; font-weight: 800; color: var(--text-primary); margin-top: 2px;">${escapeHtml(healthOperationalText)}</div>
        </div>
        <div style="background: var(--bg-card); padding: 0.5rem 0.65rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Falhas Consecutivas</div>
          <div style="font-size: 0.85rem; font-weight: 800; color: var(--text-secondary); font-family: var(--font-mono); margin-top: 2px;">${healthFailureCount === null ? 'N/D' : healthFailureCount.toLocaleString('pt-BR')}</div>
          <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 2px;">Auditoria técnica</div>
        </div>
        <div style="background: var(--bg-card); padding: 0.5rem 0.65rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Última Leitura Válida</div>
          <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); margin-top: 2px;">${escapeHtml(healthLastSuccess)}</div>
        </div>
        <div style="background: var(--bg-card); padding: 0.5rem 0.65rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Última Tentativa</div>
          <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); margin-top: 2px;">${escapeHtml(healthLastCheck)}</div>
        </div>
      </div>
      <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 0.65rem;" title="${escapeHtml(healthReasonText)}">Motivo: ${escapeHtml(healthReasonText)}</div>
    </div>

    <section id="device-alert-details" class="device-alert-card" aria-live="polite">
      <h4>Estado do equipamento</h4><p class="device-alert-meta">Consultando alertas…</p>
    </section>

    <!-- Card de Rastreamento Histórico & Produção sob Gestão (Modelo Híbrido) -->
    <div class="integration-audit-card" style="margin-top: 1.25rem; background: var(--bg-surface-light); border: 1px solid var(--border-card); border-left: 4px solid var(--color-primary); border-radius: var(--radius-md); padding: 0.9rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem; flex-wrap: wrap; gap: 0.5rem;">
        <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary); display: inline-flex; align-items: center; gap: 0.4rem;">
          <svg class="icon icon-xs" viewBox="0 0 24 24" style="color: var(--color-primary); width: 15px; height: 15px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>Rastreamento Histórico & Produção sob Gestão</span>
        </span>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 0.725rem; color: var(--text-muted);" title="Monitoramento Ativo: ${escapeHtml(formattedActivated)}">Ativo ${escapeHtml(relActivated)}</span>
          ${isAdmin ? `
            <button type="button" class="btn btn-secondary btn-sm" onclick="openEditInstalledAtModal(${jsArg(printer.id)})" style="padding: 0.2rem 0.55rem; font-size: 0.725rem; display: inline-flex; align-items: center; gap: 0.35rem;" title="Editar data de instalação física deste equipamento">
              <svg class="icon icon-xs" viewBox="0 0 24 24" style="width: 12px; height: 12px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>Editar Instalação</span>
            </button>
          ` : ''}
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.5rem;">
        <div style="background: var(--bg-card); padding: 0.5rem 0.65rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Total Vitalício (Hardware)</div>
          <div style="font-size: 0.9rem; font-weight: 800; color: var(--text-primary); font-family: var(--font-mono); margin-top: 2px;">${curCount === null ? 'Desconhecido' : curCount.toLocaleString('pt-BR') + ' pág.'}</div>
          <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 2px;">Páginas impressas (Hardware)</div>
        </div>
        <div style="background: var(--bg-card); padding: 0.5rem 0.65rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Contador na Ativação</div>
          <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); font-family: var(--font-mono); margin-top: 2px;">${initCount === null ? 'Desconhecido' : initCount.toLocaleString('pt-BR') + ' pág.'}</div>
          <div style="font-size: 0.65rem; color: ${initCount > curCount ? 'var(--color-danger)' : 'var(--text-muted)'}; margin-top: 2px;">${initCount > curCount ? 'Ajuste recomendado' : `Em ${escapeHtml(formattedActivated.split(' ')[0])}`}</div>
        </div>
        <div style="background: var(--bg-card); padding: 0.5rem 0.65rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Produção sob Gestão</div>
          <div style="font-size: 0.9rem; font-weight: 800; color: var(--color-success); font-family: var(--font-mono); margin-top: 2px;">${pagesUnderManagement === null ? 'Indisponível' : '+' + pagesUnderManagement.toLocaleString('pt-BR') + ' pág.'}</div>
          <div style="font-size: 0.65rem; color: var(--color-success); margin-top: 2px;">Sob monitoramento</div>
        </div>
        <div style="background: var(--bg-card); padding: 0.5rem 0.65rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Instalação Física</div>
              ${isAdmin ? `
                <button type="button" onclick="openEditInstalledAtModal(${jsArg(printer.id)})" title="Editar data de instalação física" style="background: none; border: none; padding: 0; cursor: pointer; color: var(--color-primary); display: inline-flex; align-items: center; gap: 2px; font-size: 0.68rem; font-weight: 600;">
                  <svg class="icon icon-xs" viewBox="0 0 24 24" style="width: 11px; height: 11px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  <span>Alterar</span>
                </button>
              ` : ''}
            </div>
            <div style="font-size: 0.825rem; font-weight: 700; color: var(--text-secondary); font-family: var(--font-mono); margin-top: 2px;">${escapeHtml(installedDateStr)}</div>
          </div>
          <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 2px;">Entrega na filial</div>
        </div>
      </div>
    </div>

    <div data-diagnostic-panel="supplies" style="margin-top: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); margin: 0;">Todos os Suprimentos & Tintas</h4>
        ${isAdmin ? `
          <button type="button" class="btn btn-secondary btn-sm" onclick="openManualRechargeModal(${jsArg(printer.id)})" title="Registrar carga de insumo e marco de páginas">
            <svg class="icon icon-xs" viewBox="0 0 24 24" style="color: var(--color-primary); width: 14px; height: 14px;"><path d="M12 5v14M5 12h14"/></svg>
            <span>+ Registrar Carga</span>
          </button>
        ` : ''}
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.65rem;">
        ${suppliesHTML}
      </div>
    </div>

    ${rechargesSectionHTML}

    ${trays.length > 0 ? `
      <div data-diagnostic-panel="supplies" style="margin-top: 1.5rem;">
        <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.75rem;">Bandejas de Papel</h4>
        <div class="detail-meta-grid">
          ${traysHTML}
        </div>
      </div>
    ` : ''}
  `;

  if (window.PrinterDiagnosticUI) {
    window.PrinterDiagnosticUI.mount(DOM.detailModalBody, id, API, { canWrite: isAdmin, onTelemetry: async telemetry => {
      if (currentDrawerPrinterId !== id) return;
      AppState.statusData.set(id, telemetry);
      if (telemetry.health) AppState.healthData.set(id, telemetry.health);
      renderOverviewTab(); await openPrinterDetailDrawer(id);
    } });
  } else window.DeviceAlertsUI?.load(document.getElementById('device-alert-details'), id, API.getPrinterAlerts);
  DOM.btnDetailEdit.style.display = isAdmin ? 'inline-flex' : 'none';
  document.getElementById('btn-detail-replace').style.display = isAdmin ? 'inline-flex' : 'none';
  DOM.btnDetailDelete.style.display = isAdmin ? 'inline-flex' : 'none';
}

function closePrinterDetailDrawer() {
  window.PrinterDiagnosticUI?.close(DOM.detailModalBody);
  currentDrawerPrinterId = null;
  window.WorkstationModule?.closeDetail();
  if (DOM.drawerPrinterDetail) {
    DOM.drawerPrinterDetail.classList.remove('active');
  }
  unlockBodyScroll('drawer');
}

// ==========================================================================
// 14. REGISTRO MANUAL DE RECARGAS & MODAL (PROJETO HEFESTO)
// ==========================================================================
function openManualRechargeModal(printerId) {
  const printer = AppState.printers.find(p => p.id === printerId);
  if (!printer) return;

  const status = AppState.statusData.get(printerId) || { info: {}, supplies: [] };
  const info = status.info || {};
  const supplies = status.supplies || [];

  DOM.rechargePrinterId.value = printer.id;
  DOM.rechargePrinterName.value = printer.name || printer.location || 'Impressora';
  DOM.rechargePrinterIp.value = printer.ip || '';
  DOM.rechargeUnitName.value = printer.unitName || 'Sem Unidade';
  DOM.rechargeLocation.value = printer.location || '';
  const curPageCount = Number(info.pageCount || printer.initialPageCount || 0);
  DOM.rechargePageCount.value = curPageCount;
  if (DOM.rechargePageCountInput) {
    DOM.rechargePageCountInput.value = curPageCount || '';
  }
  if (DOM.rechargeUpdateBaseline) {
    DOM.rechargeUpdateBaseline.checked = true;
  }

  DOM.rechargeModalPrinterInfo.innerHTML = `
    <div class="p-name">${escapeHtml(printer.location || printer.name)}</div>
    <div class="p-meta">
      <span>IP: <code>${escapeHtml(printer.ip)}</code></span>
      <span>Unidade: <strong>${escapeHtml(printer.unitName || 'Sem Unidade')}</strong></span>
      <span>Páginas: <strong>${info.pageCount ? Number(info.pageCount).toLocaleString('pt-BR') : '0'}</strong></span>
    </div>
  `;

  DOM.rechargeSupplySelect.innerHTML = '<option value="">Selecione o suprimento / carga...</option>';
  if (supplies.length > 0) {
    supplies.forEach(s => {
      if (!isWasteSupply(s)) {
        const translated = translateSupplyName(s.name);
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.dataset.type = s.type || 'toner';
        opt.textContent = `${translated} (${s.percentage >= 0 ? s.percentage + '%' : 'Atual'})`;
        DOM.rechargeSupplySelect.appendChild(opt);
      }
    });
  } else {
    [
      { name: 'Cartucho / Toner Preto', type: 'toner' },
      { name: 'Bolsa de Tinta Ciano', type: 'toner' },
      { name: 'Bolsa de Tinta Magenta', type: 'toner' },
      { name: 'Bolsa de Tinta Amarela', type: 'toner' },
      { name: 'Kit Fotocondutor / Cilindro', type: 'imaging_kit' },
      { name: 'Caixa de Manutenção', type: 'waste_toner' }
    ].forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.name;
      opt.dataset.type = item.type;
      opt.textContent = item.name;
      DOM.rechargeSupplySelect.appendChild(opt);
    });
  }

  if (DOM.rechargeSupplySelect.options.length > 1) {
    DOM.rechargeSupplySelect.selectedIndex = 1;
  }
  setRechargeTypeOption('full');
  DOM.rechargeNewLevel.value = 100;
  if (DOM.rechargeCustomDate) {
    const localIso = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    DOM.rechargeCustomDate.value = localIso;
  }
  DOM.rechargeTechnician.value = '';
  DOM.rechargeNotes.value = '';

  lockBodyScroll('modal');
  DOM.modalManualRecharge.classList.add('active');
  setTimeout(() => DOM.rechargeSupplySelect.focus(), 100);
}

function closeManualRechargeModal() {
  DOM.modalManualRecharge.classList.remove('active');
  unlockBodyScroll('modal');
}

function setRechargeTypeOption(type) {
  if (type === 'full') {
    DOM.optRechargeFullCard.classList.add('active');
    DOM.optRechargePartialCard.classList.remove('active');
    DOM.optRechargeFullInput.checked = true;
    DOM.optRechargePartialInput.checked = false;
    DOM.rechargeNewLevel.value = 100;
  } else {
    DOM.optRechargeFullCard.classList.remove('active');
    DOM.optRechargePartialCard.classList.add('active');
    DOM.optRechargeFullInput.checked = false;
    DOM.optRechargePartialInput.checked = true;
    DOM.rechargeNewLevel.value = 50;
  }
}

async function handleManualRechargeSubmit(e) {
  e.preventDefault();

  const printerId = DOM.rechargePrinterId.value.trim();
  const printerName = DOM.rechargePrinterName.value.trim();
  const ip = DOM.rechargePrinterIp.value.trim();
  const unitName = DOM.rechargeUnitName.value.trim();
  const location = DOM.rechargeLocation.value.trim();

  const inputPages = DOM.rechargePageCountInput ? Number(DOM.rechargePageCountInput.value) : NaN;
  const pageCount = !isNaN(inputPages) && inputPages >= 0 ? inputPages : (Number(DOM.rechargePageCount.value) || 0);
  const shouldUpdateBaseline = DOM.rechargeUpdateBaseline ? DOM.rechargeUpdateBaseline.checked : false;

  const supplySelect = DOM.rechargeSupplySelect;
  const supplyName = supplySelect.value;
  const selectedOption = supplySelect.options[supplySelect.selectedIndex];
  const supplyType = selectedOption ? (selectedOption.dataset.type || 'toner') : 'toner';

  const isFull = DOM.optRechargeFullInput.checked;
  const newLevel = Number(DOM.rechargeNewLevel.value);
  const customDateVal = DOM.rechargeCustomDate ? DOM.rechargeCustomDate.value : '';
  const timestamp = customDateVal ? new Date(customDateVal).toISOString() : new Date().toISOString();
  const technician = DOM.rechargeTechnician.value.trim();
  const notes = DOM.rechargeNotes.value.trim();

  if (!supplyName) {
    showToast('Por favor, selecione qual suprimento foi trocado.', 'error');
    return;
  }

  const submitBtn = document.getElementById('btn-submit-manual-recharge');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Gravando...';

  try {
    const status = AppState.statusData.get(printerId);
    const existingSupply = status?.supplies?.find(s => s.name === supplyName);
    const previousLevel = existingSupply ? existingSupply.percentage : 0;

    await API.addRecharge({
      printerId,
      printerName,
      ip,
      unitName,
      location,
      supplyName,
      supplyType,
      previousLevel,
      newLevel,
      pageCount,
      isFull,
      technician,
      notes,
      timestamp,
      updateInitialPageCount: shouldUpdateBaseline,
      initialPageCount: pageCount
    });

    if (shouldUpdateBaseline && pageCount >= 0) {
      const printerObj = AppState.printers.find(p => p.id === printerId);
      if (printerObj) {
        printerObj.initialPageCount = pageCount;
        printerObj.hefestoActivatedAt = timestamp;
      }
    }

    showToast(shouldUpdateBaseline ? `Carga de "${supplyName}" e marco de ${pageCount.toLocaleString('pt-BR')} pág. salvos com sucesso!` : `Carga de "${supplyName}" gravada com sucesso!`, 'success');
    closeManualRechargeModal();

    AppState.rechargesSummary = await API.getRechargesSummary();
    renderAllViews();
    renderUnitRecentRecharges();

    if (currentDrawerPrinterId === printerId) {
      openPrinterDetailDrawer(printerId);
    }
  } catch (err) {
    showToast(err.message || 'Erro ao gravar recarga', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Salvar Carga';
  }
}

// ==========================================================================
// 14.1 EDIÇÃO RÁPIDA DA DATA DE INSTALAÇÃO FÍSICA NA FILIAL
// ==========================================================================
function openEditInstalledAtModal(printerId) {
  if (AppState.userRole !== 'admin') {
    showToast('Apenas administradores podem alterar a data de instalação física.', 'error');
    return;
  }
  const printer = AppState.printers.find(p => p.id === printerId);
  if (!printer) {
    showToast('Impressora não encontrada.', 'error');
    return;
  }

  DOM.editInstalledPrinterId.value = printer.id;
  DOM.editInstalledDateInput.value = printer.installedAt ? printer.installedAt.split('T')[0] : '';

  if (DOM.installedModalPrinterInfo) {
    DOM.installedModalPrinterInfo.innerHTML = `
      <div class="p-name">${escapeHtml(printer.location || printer.name)}</div>
      <div class="p-meta">
        <span>IP: <code>${escapeHtml(printer.ip)}</code></span>
        <span>Unidade: <strong>${escapeHtml(printer.unitName || 'Sem Unidade')}</strong></span>
      </div>
    `;
  }

  lockBodyScroll('modal');
  DOM.modalEditInstalledAt.classList.add('active');
  setTimeout(() => {
    if (DOM.editInstalledDateInput) DOM.editInstalledDateInput.focus();
  }, 100);
}

function closeEditInstalledAtModal() {
  if (DOM.modalEditInstalledAt) {
    DOM.modalEditInstalledAt.classList.remove('active');
  }
  unlockBodyScroll('modal');
}

async function handleEditInstalledAtSubmit(e) {
  e.preventDefault();
  if (AppState.userRole !== 'admin') {
    showToast('Permissão negada.', 'error');
    return;
  }

  const printerId = DOM.editInstalledPrinterId.value.trim();
  const dateVal = DOM.editInstalledDateInput.value.trim();
  const printer = AppState.printers.find(p => p.id === printerId);
  if (!printer) {
    showToast('Impressora não encontrada.', 'error');
    return;
  }

  const submitBtn = document.getElementById('btn-save-modal-installed');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Salvando...';
  }

  try {
    const newInstalledAt = dateVal ? (dateVal.includes('T') ? dateVal : `${dateVal}T08:00:00.000Z`) : null;
    const res = await API.updatePrinter(printerId, {
      ...printer,
      installedAt: newInstalledAt
    });

    printer.installedAt = newInstalledAt;
    showToast('Data de instalação física atualizada com sucesso!', 'success');
    closeEditInstalledAtModal();
    renderAllViews();

    if (currentDrawerPrinterId === printerId) {
      openPrinterDetailDrawer(printerId);
    }
  } catch (err) {
    showToast('Erro ao atualizar instalação física: ' + (err.message || 'Erro de comunicação'), 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        <span>Salvar Data</span>
      `;
    }
  }
}
window.openEditInstalledAtModal = openEditInstalledAtModal;

// ==========================================================================
// 15. CADASTRO, EDIÇÃO E EXCLUSÃO DE IMPRESSORAS (ADM)
// ==========================================================================
function openAddPrinterModal() {
  if (AppState.userRole !== 'admin') {
    showToast('Apenas administradores podem cadastrar impressoras.', 'error');
    return;
  }
  DOM.formId.value = '';
  document.getElementById('btn-form-replace').style.display = 'none';
  DOM.printerForm.reset();
  if (DOM.formMac) DOM.formMac.value = '';
  if (DOM.formInitialPageCount) DOM.formInitialPageCount.value = '';
  if (DOM.formActivatedAt) DOM.formActivatedAt.value = '';
  if (DOM.formInstalledAt) DOM.formInstalledAt.value = '';
  populateDropdownFilters();
  if (AppState.activeUnitFilter) {
    DOM.formUnitSelect.value = AppState.activeUnitFilter;
  }
  DOM.formCommunity.value = 'public';
  DOM.modalFormTitleText.textContent = 'Cadastrar Nova Impressora';
  lockBodyScroll('modal');
  DOM.modalPrinterForm.classList.add('active');
  setTimeout(() => DOM.formLocation.focus(), 100);
}

function openEditPrinterModal(id) {
  if (AppState.userRole !== 'admin') {
    showToast('Apenas administradores podem editar impressoras.', 'error');
    return;
  }
  const printer = AppState.printers.find(p => p.id === id);
  if (!printer) return;

  populateDropdownFilters();
  DOM.formId.value = printer.id;
  document.getElementById('btn-form-replace').style.display = 'inline-flex';
  DOM.formUnitSelect.value = printer.unitId || '';
  DOM.formLocation.value = printer.location || '';
  DOM.formName.value = printer.name && printer.name !== printer.location ? printer.name : '';
  DOM.formIp.value = isPrinterUnconfigured(printer) ? '' : printer.ip;
  if (isPrinterUnconfigured(printer)) {
    DOM.formIp.placeholder = 'Digite o endereço IP fixo da impressora...';
  } else {
    DOM.formIp.placeholder = 'Ex: 198.18.5.50';
  }
  if (DOM.formMac) {
    DOM.formMac.value = printer.macAddress || '';
  }
  DOM.formCommunity.value = printer.community || 'public';

  if (DOM.formInitialPageCount) {
    DOM.formInitialPageCount.value = (typeof printer.initialPageCount === 'number') ? printer.initialPageCount : '';
  }
  if (DOM.formActivatedAt) {
    const actDate = printer.hefestoActivatedAt || printer.createdAt;
    if (actDate) {
      try {
        const dt = new Date(actDate);
        dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
        DOM.formActivatedAt.value = dt.toISOString().slice(0, 16);
      } catch {
        DOM.formActivatedAt.value = '';
      }
    } else {
      DOM.formActivatedAt.value = '';
    }
  }
  if (DOM.formInstalledAt) {
    DOM.formInstalledAt.value = printer.installedAt ? printer.installedAt.split('T')[0] : '';
  }

  DOM.modalFormTitleText.textContent = 'Editar Impressora';
  lockBodyScroll('modal');
  DOM.modalPrinterForm.classList.add('active');
  setTimeout(() => DOM.formLocation.focus(), 100);
}

function closeModalForm() {
  DOM.modalPrinterForm.classList.remove('active');
  unlockBodyScroll('modal');
}

async function handlePrinterFormSubmit(e) {
  e.preventDefault();
  if (AppState.userRole !== 'admin') {
    showToast('Apenas administradores podem salvar alterações no parque.', 'error');
    return;
  }

  const id = DOM.formId.value.trim();
  const unitId = DOM.formUnitSelect.value;
  const unitObj = AppState.units.find(u => u.id === unitId);
  const unitName = unitObj ? unitObj.name : 'Sem Unidade';

  const location = DOM.formLocation.value.trim();
  const nameInput = DOM.formName.value.trim();
  const name = nameInput || location;
  let ip = DOM.formIp.value.trim();
  if (!ip && id) {
    const orig = AppState.printers.find(p => p.id === id);
    if (orig && orig.ip && orig.ip.startsWith('pendente-')) {
      ip = orig.ip;
    }
  }

  const community = DOM.formCommunity.value.trim() || 'public';

  const initPageCountVal = DOM.formInitialPageCount?.value.trim();
  const initialPageCount = initPageCountVal !== '' ? Number(initPageCountVal) : undefined;
  const activatedAtVal = DOM.formActivatedAt?.value;
  const hefestoActivatedAt = activatedAtVal ? new Date(activatedAtVal).toISOString() : undefined;
  const installedAtVal = DOM.formInstalledAt?.value;
  const installedAt = installedAtVal ? installedAtVal : '';

  if (!location || !ip) {
    showToast('Local/Setor e Endereço IP são obrigatórios!', 'error');
    return;
  }

  const submitBtn = document.getElementById('btn-submit-printer-form');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Salvando...';

  try {
    if (id && initialPageCount !== undefined) {
      const status = AppState.statusData.get(id);
      const liveCount = status?.info?.pageCount;
      if (typeof liveCount === 'number' && liveCount > 0 && initialPageCount > liveCount) {
        showToast(`O marco inicial (${initialPageCount.toLocaleString('pt-BR')} pág.) não pode ser superior ao contador físico do hardware (${liveCount.toLocaleString('pt-BR')} pág.)!`, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Salvar Equipamento';
        return;
      }
    }

    const macAddress = DOM.formMac ? DOM.formMac.value.trim().toUpperCase() : '';
    const payload = { name, ip, unitId, unitName, location, community, macAddress };
    if (initialPageCount !== undefined) payload.initialPageCount = initialPageCount;
    if (hefestoActivatedAt !== undefined) {
      payload.hefestoActivatedAt = hefestoActivatedAt;
      payload.createdAt = hefestoActivatedAt;
    }
    if (installedAt !== undefined) payload.installedAt = installedAt;

    if (id) {
      await API.updatePrinter(id, payload);
      showToast('Impressora atualizada com sucesso!', 'success');
    } else {
      await API.addPrinter(payload);
      showToast('Nova impressora cadastrada com sucesso!', 'success');
    }

    closeModalForm();
    await loadDashboardData(false, true);

  } catch (err) {
    if (err.code === 'REPLACEMENT_REQUIRED') {
      closeModalForm();
      PrinterReplacement.open(id, ip);
    }
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Salvar Impressora';
  }
}

async function handleDetectMacFromForm() {
  const ip = DOM.formIp ? DOM.formIp.value.trim() : '';
  if (!ip || ip.startsWith('pendente-')) {
    showToast('Informe um endereço IP corporativo válido para sondagem física.', 'warning');
    return;
  }
  if (!DOM.btnDetectPrinterMac) return;

  DOM.btnDetectPrinterMac.disabled = true;
  DOM.btnDetectPrinterMac.innerHTML = `<span>Lendo placa...</span>`;

  try {
    const res = await API.detectPrinterMac(ip);
    if (res.success && res.macAddress) {
      if (DOM.formMac) DOM.formMac.value = res.macAddress;
      showToast(`MAC ${res.macAddress} detectado com sucesso na placa!`, 'success');
    } else {
      showToast(res.message || 'Não foi possível ler o MAC da placa via rede.', 'warning');
    }
  } catch (err) {
    showToast(err.message || 'Falha ao consultar endereço MAC', 'error');
  } finally {
    DOM.btnDetectPrinterMac.disabled = false;
    DOM.btnDetectPrinterMac.innerHTML = `<span>Detectar da Placa</span>`;
  }
}

async function confirmDeletePrinter(id, name) {
  if (AppState.userRole !== 'admin') {
    showToast('Apenas administradores podem excluir impressoras.', 'error');
    return;
  }

  if (!confirm(`Deseja realmente remover a impressora "${name}"?`)) return;

  try {
    await API.deletePrinter(id);
    AppState.printers = AppState.printers.filter(p => p.id !== id);
    AppState.statusData.delete(id);
    closePrinterDetailDrawer();
    renderAllViews();
    showToast(`Impressora "${name}" removida com sucesso.`, 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openQuickUnitModal(unitId = null) {
  if (AppState.userRole !== 'admin') {
    showToast('Apenas administradores podem criar ou editar unidades.', 'error');
    return;
  }
  DOM.unitForm.reset();
  if (DOM.unitFormId) DOM.unitFormId.value = '';
  if (DOM.unitRegionSelect) {
    DOM.unitRegionSelect.value = (AppState.activeRegionFilter && AppState.activeRegionFilter !== 'all') ? AppState.activeRegionFilter : 'RJ';
  }

  if (unitId && typeof unitId === 'string') {
    const unit = AppState.units.find(u => u.id === unitId);
    if (unit) {
      if (DOM.unitFormId) DOM.unitFormId.value = unit.id;
      DOM.unitNameInput.value = unit.name;
      DOM.unitDescInput.value = unit.description || '';
      if (DOM.unitRegionSelect) DOM.unitRegionSelect.value = unit.region || 'RJ';
      if (DOM.modalUnitFormTitleText) DOM.modalUnitFormTitleText.textContent = 'Editar Pasta de Unidade';
    }
  } else {
    if (DOM.modalUnitFormTitleText) DOM.modalUnitFormTitleText.textContent = 'Nova Pasta de Unidade';
  }

  lockBodyScroll('modal');
  DOM.modalUnitForm.classList.add('active');
  setTimeout(() => DOM.unitNameInput.focus(), 100);
}

function closeQuickUnitModal() {
  DOM.modalUnitForm.classList.remove('active');
  unlockBodyScroll('modal');
}

async function handleUnitFormSubmit(e) {
  e.preventDefault();
  const id = DOM.unitFormId ? DOM.unitFormId.value.trim() : '';
  const name = DOM.unitNameInput.value.trim();
  const description = DOM.unitDescInput.value.trim();
  const region = DOM.unitRegionSelect ? DOM.unitRegionSelect.value : 'RJ';

  if (!name) {
    showToast('Nome da unidade é obrigatório!', 'error');
    return;
  }

  try {
    if (id) {
      await API.updateUnit(id, { name, description, region });
      AppState.units = await API.getUnits();
      AppState.printers = await API.getPrinters();
      populateDropdownFilters();
      renderAllViews();
      closeQuickUnitModal();
      openManageUnitsModal();
      showToast('Pasta de unidade atualizada com sucesso!', 'success');
    } else {
      const newUnit = await API.addUnit({ name, description, region });
      AppState.units = await API.getUnits();
      populateDropdownFilters();
      if (DOM.formUnitSelect) DOM.formUnitSelect.value = newUnit.id;
      if (DOM.sheetDefaultUnit) DOM.sheetDefaultUnit.value = newUnit.id;
      closeQuickUnitModal();
      showToast('Nova pasta de unidade criada!', 'success');
    }
  } catch (err) {
    showToast(err.message || 'Erro ao salvar pasta', 'error');
  }
}

function openManageUnitsModal() {
  if (AppState.userRole !== 'admin') {
    showToast('Apenas administradores podem gerenciar pastas.', 'error');
    return;
  }
  renderManageUnitsList();
  lockBodyScroll('modal');
  DOM.modalManageUnits.classList.add('active');
}

function closeManageUnitsModal() {
  DOM.modalManageUnits.classList.remove('active');
  unlockBodyScroll('modal');
}

function renderManageUnitsList() {
  if (!DOM.manageUnitsListBody) return;

  if (AppState.units.length === 0) {
    DOM.manageUnitsListBody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
          Nenhuma pasta de unidade cadastrada.
        </td>
      </tr>
    `;
    return;
  }

  DOM.manageUnitsListBody.innerHTML = AppState.units.map(unit => {
    const printerCount = AppState.printers.filter(p => p.unitId === unit.id).length;
    const unitRegion = unit.region || 'RJ';

    return `
      <tr>
        <td>
          <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem; display: flex; align-items: center; gap: 6px;">
            <span>${escapeHtml(unit.name)}</span>
            <span class="state-chip ${unitRegion === 'SP' ? 'sp' : 'rj'}">${escapeHtml(unitRegion)}</span>
          </div>
          ${unit.description ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${escapeHtml(unit.description)}</div>` : ''}
        </td>
        <td style="text-align: center;">
          <span class="unit-current-badge" style="font-size: 0.75rem;">
            ${printerCount} ${printerCount === 1 ? 'impressora' : 'impressoras'}
          </span>
        </td>
        <td style="text-align: center;">
          <div style="display: inline-flex; gap: 0.35rem; justify-content: center;">
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              onclick="openEditUnitModal(${jsArg(unit.id)})"
              title="Editar nome e descrição desta pasta"
            >
              ${Icons.edit}
              <span>Editar</span>
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              style="color: var(--color-danger);"
              onclick="confirmDeleteUnit(${jsArg(unit.id)}, ${jsArg(unit.name)}, ${printerCount})"
              title="Excluir esta pasta"
            >
              ${Icons.trash}
              <span>Excluir</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.openEditUnitModal = function(unitId) {
  closeManageUnitsModal();
  openQuickUnitModal(unitId);
};

async function confirmDeleteUnit(unitId, unitName, printerCount) {
  if (AppState.userRole !== 'admin') {
    showToast('Apenas administradores podem excluir pastas.', 'error');
    return;
  }

  let confirmMsg = `Deseja realmente excluir a pasta "${unitName}"?`;
  if (printerCount > 0) {
    confirmMsg += `\n\nAtenção: Existem ${printerCount} impressoras associadas a esta pasta que ficarão com o status "Sem Unidade".`;
  }

  if (!confirm(confirmMsg)) return;

  try {
    await API.deleteUnit(unitId);
    AppState.units = await API.getUnits();

    if (AppState.activeUnitFilter === unitId) {
      AppState.activeUnitFilter = '';
    }

    renderManageUnitsList();
    populateDropdownFilters();
    renderOverviewTab();
    showToast(`Pasta "${unitName}" excluída com sucesso!`, 'info');
  } catch (err) {
    showToast(err.message || 'Erro ao excluir pasta', 'error');
  }
}

// ==========================================================================
// 15.5 IMPORTAÇÃO DE PLANILHAS (EXCEL / CSV / COLAR CÉLULAS)
// ==========================================================================
function openImportSheetModal() {
  if (AppState.userRole !== 'admin') {
    showToast('Apenas administradores podem importar planilhas.', 'error');
    return;
  }

  AppState.stagedSheetPrinters = [];
  if (DOM.sheetFileInput) DOM.sheetFileInput.value = '';
  if (DOM.sheetPasteInput) DOM.sheetPasteInput.value = '';
  if (DOM.dropzoneTitle) DOM.dropzoneTitle.textContent = 'Arraste a planilha aqui ou clique para selecionar';
  if (DOM.sheetPreviewContainer) DOM.sheetPreviewContainer.style.display = 'none';
  if (DOM.sheetPreviewBody) DOM.sheetPreviewBody.innerHTML = '';
  if (DOM.btnConfirmImportSheet) DOM.btnConfirmImportSheet.disabled = true;

  updateSheetDefaultUnitsDropdown();
  switchSheetEntryTab('file');

  lockBodyScroll('modal');
  DOM.modalImportSheet.classList.add('active');
}

function closeImportSheetModal() {
  DOM.modalImportSheet.classList.remove('active');
  unlockBodyScroll('modal');
  AppState.stagedSheetPrinters = [];
}

function switchSheetEntryTab(tab) {
  if (tab === 'file') {
    DOM.tabSheetFile?.classList.add('active');
    DOM.tabSheetPaste?.classList.remove('active');
    if (DOM.panelSheetFile) DOM.panelSheetFile.style.display = 'block';
    if (DOM.panelSheetPaste) DOM.panelSheetPaste.style.display = 'none';
  } else {
    DOM.tabSheetPaste?.classList.add('active');
    DOM.tabSheetFile?.classList.remove('active');
    if (DOM.panelSheetPaste) DOM.panelSheetPaste.style.display = 'block';
    if (DOM.panelSheetFile) DOM.panelSheetFile.style.display = 'none';
    setTimeout(() => DOM.sheetPasteInput?.focus(), 100);
  }
}

function updateSheetDefaultUnitsDropdown() {
  if (!DOM.sheetDefaultUnit) return;
  const currentVal = DOM.sheetDefaultUnit.value;
  DOM.sheetDefaultUnit.innerHTML = '<option value="">Detectar pela coluna da planilha</option>' +
    AppState.units.map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)}</option>`).join('') +
    '<option value="__NEW_FOLDER__">➕ Criar nova pasta...</option>';
  if (currentVal && currentVal !== '__NEW_FOLDER__') {
    DOM.sheetDefaultUnit.value = currentVal;
  }
}

function handleSheetFile(file) {
  if (!file) return;

  const validExts = ['.xlsx', '.xls', '.csv'];
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (!validExts.includes(ext)) {
    showToast('Formato de arquivo não suportado. Use .xlsx, .xls ou .csv.', 'error');
    return;
  }

  if (DOM.dropzoneTitle) {
    DOM.dropzoneTitle.textContent = `Carregando: ${file.name}...`;
  }

  const reader = new FileReader();

  if (ext === '.csv') {
    reader.onload = function(e) {
      try {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        const matrix = lines.map(line => {
          if (line.includes(';')) return line.split(';').map(c => c.trim().replace(/^["']|["']$/g, ''));
          if (line.includes('\t')) return line.split('\t').map(c => c.trim());
          return line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        });
        if (DOM.dropzoneTitle) DOM.dropzoneTitle.textContent = file.name;
        parseSpreadsheetRows(matrix, file.name);
      } catch (err) {
        showToast('Erro ao processar CSV: ' + err.message, 'error');
      }
    };
    reader.readAsText(file, 'UTF-8');
  } else {
    reader.onload = function(e) {
      try {
        if (typeof XLSX === 'undefined') {
          showToast('Biblioteca SheetJS (xlsx.full.min.js) não foi carregada no navegador.', 'error');
          return;
        }
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          showToast('Nenhuma planilha encontrada no arquivo Excel.', 'error');
          return;
        }
        const worksheet = workbook.Sheets[firstSheetName];
        const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        if (DOM.dropzoneTitle) DOM.dropzoneTitle.textContent = file.name;
        parseSpreadsheetRows(matrix, file.name);
      } catch (err) {
        showToast('Erro ao processar arquivo Excel: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

function handleSheetPaste() {
  const text = (DOM.sheetPasteInput ? DOM.sheetPasteInput.value : '').trim();
  if (!text) {
    showToast('Cole o conteúdo da planilha copiado do Excel na área de texto.', 'warning');
    return;
  }

  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) {
    showToast('Nenhum dado encontrado no texto colado.', 'warning');
    return;
  }

  const matrix = lines.map(line => {
    if (line.includes('\t')) {
      return line.split('\t').map(c => c.trim());
    }
    if (line.includes(';')) {
      return line.split(';').map(c => c.trim().replace(/^["']|["']$/g, ''));
    }
    if (line.includes(',')) {
      return line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    }
    return line.split(/\s{2,}/).map(c => c.trim());
  });

  parseSpreadsheetRows(matrix, 'Células Coladas (Clipboard)');
}

function parseSpreadsheetRows(matrix, sourceName) {
  if (!matrix || matrix.length === 0) {
    showToast('Planilha vazia ou sem dados legíveis.', 'warning');
    return;
  }

  const defaultUnitId = (DOM.sheetDefaultUnit && DOM.sheetDefaultUnit.value !== '__NEW_FOLDER__') ? DOM.sheetDefaultUnit.value : '';
  const defaultUnit = AppState.units.find(u => u.id === defaultUnitId);
  const defaultUnitName = defaultUnit ? defaultUnit.name : '';

  let headerRowIdx = -1;
  let colIp = -1;
  let colName = -1;
  let colSerial = -1;
  let colModel = -1;
  let colLocation = -1;
  let colUnit = -1;
  let colRegion = -1;

  const ipv4Regex = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/;

  // Procura linha de cabeçalho nas primeiras 5 linhas
  for (let r = 0; r < Math.min(matrix.length, 5); r++) {
    const row = matrix[r].map(c => String(c || '').toLowerCase().trim());
    const hasIpHeader = row.some(cell => /^(ip|ip\s*address|endere[çc]o(\s*ip)?|host)$/i.test(cell) || /\bip\b/i.test(cell));
    const hasOtherHeader = row.some(cell => /^(modelo|model|serial|s\/n|setor|local|unidade|filial|regi[aã]o|estado|uf)/i.test(cell));

    if (hasIpHeader || (hasOtherHeader && !row.some(cell => ipv4Regex.test(cell)))) {
      headerRowIdx = r;
      break;
    }
  }

  if (headerRowIdx !== -1) {
    const headerRow = matrix[headerRowIdx].map(c => String(c || '').toLowerCase().trim());
    headerRow.forEach((cell, idx) => {
      if (/^(ip|ip\s*address|endere[çc]o\s*ip|endere[çc]o|host(\s*ip)?)$/i.test(cell) || /\bip\b/i.test(cell)) {
        if (colIp === -1) colIp = idx;
      } else if (/^(serial|s\/n|n[uú]mero\s*de\s*s[eé]rie|ns|n\/s)$/i.test(cell)) {
        if (colSerial === -1) colSerial = idx;
      } else if (/^(modelo|model|marca\/modelo)$/i.test(cell)) {
        if (colModel === -1) colModel = idx;
      } else if (/^(nome|nome\s*da\s*impressora|printer\s*name|equipamento|identifica[çc][aã]o)$/i.test(cell)) {
        if (colName === -1) colName = idx;
      } else if (/^(setor|local|localiza[çc][aã]o|posto|andar|sala)$/i.test(cell)) {
        if (colLocation === -1) colLocation = idx;
      } else if (/^(unidade|filial|pasta|pr[eé]dio|unidade\/filial)$/i.test(cell)) {
        if (colUnit === -1) colUnit = idx;
      } else if (/^(regi[aã]o|estado|uf)$/i.test(cell)) {
        if (colRegion === -1) colRegion = idx;
      }
    });
  }

  // Se não identificou coluna de IP pelo cabeçalho, detecta pela densidade de IPs
  if (colIp === -1) {
    const colStats = [];
    const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
    for (let r = startRow; r < matrix.length; r++) {
      const row = matrix[r];
      row.forEach((cell, idx) => {
        if (!colStats[idx]) colStats[idx] = 0;
        if (ipv4Regex.test(String(cell || '').trim())) {
          colStats[idx]++;
        }
      });
    }
    let maxIps = 0;
    colStats.forEach((count, idx) => {
      if (count > maxIps) {
        maxIps = count;
        colIp = idx;
      }
    });
  }

  const hasEquipmentCols = colSerial !== -1 || colModel !== -1 || colLocation !== -1 || colName !== -1;
  if (colIp === -1 && !hasEquipmentCols) {
    showToast('Não foi possível identificar colunas de IP ou equipamentos na planilha.', 'error');
    return;
  }

  const staged = [];
  const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;

  for (let r = startRow; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row || row.length === 0) continue;

    const rawIpCell = colIp !== -1 ? String(row[colIp] || '').trim() : '';
    const match = rawIpCell.match(ipv4Regex);
    const rawSerial = colSerial !== -1 ? String(row[colSerial] || '').trim() : '';
    const rawModel = colModel !== -1 ? String(row[colModel] || '').trim() : '';
    const rawName = colName !== -1 ? String(row[colName] || '').trim() : '';
    const rawLocation = colLocation !== -1 ? String(row[colLocation] || '').trim() : '';
    const rawUnit = colUnit !== -1 ? String(row[colUnit] || '').trim() : '';
    const rawRegionCell = colRegion !== -1 ? String(row[colRegion] || '').trim().toUpperCase() : '';

    let ip = match ? match[0] : '';
    if (!ip) {
      if (rawSerial && rawSerial !== '-' && !/^(n\/a|desconhecido|null|undefined)$/i.test(rawSerial)) {
        const cleanSerial = rawSerial.toLowerCase().replace(/[^a-z0-9]/g, '');
        ip = `pendente-${cleanSerial}`;
      } else if (rawLocation || rawModel || rawName) {
        const tempKey = Math.random().toString(36).substring(2, 8);
        ip = `pendente-${tempKey}`;
      } else {
        continue;
      }
    }

    // Determinar Unidade
    let itemUnitName = rawUnit || defaultUnitName || 'Sem Unidade';
    let itemUnitId = defaultUnitId || '';
    const matchedUnit = AppState.units.find(u => u.name.toLowerCase() === itemUnitName.toLowerCase());
    if (matchedUnit) {
      itemUnitId = matchedUnit.id;
      itemUnitName = matchedUnit.name;
    }

    // Determinar Região (Coluna > Unidade vinculada > Seletor Padrão > Filtro Ativo > RJ)
    let itemRegion = (rawRegionCell === 'SP' || rawRegionCell === 'RJ') ? rawRegionCell : '';
    if (!itemRegion && matchedUnit && matchedUnit.region) {
      itemRegion = matchedUnit.region;
    }
    if (!itemRegion && DOM.sheetDefaultRegion && DOM.sheetDefaultRegion.value) {
      itemRegion = DOM.sheetDefaultRegion.value;
    }
    if (!itemRegion) {
      itemRegion = (AppState.activeRegionFilter && AppState.activeRegionFilter !== 'all') ? AppState.activeRegionFilter : 'RJ';
    }

    // Construção do Nome amigável
    let finalName = rawName;
    if (!finalName || finalName.toLowerCase() === ip.toLowerCase()) {
      if (rawModel && rawSerial && rawSerial !== '-') {
        finalName = `${rawModel} - ${rawSerial}`;
      } else if (rawModel) {
        finalName = `${rawModel} (${ip})`;
      } else if (rawSerial && rawSerial !== '-') {
        finalName = `Impressora ${rawSerial}`;
      } else if (rawLocation) {
        finalName = rawLocation;
      } else {
        finalName = `Impressora ${ip}`;
      }
    }

    // Checar se já existe no parque (por IP exato ou por número de série)
    const existing = AppState.printers.find(p =>
      p.ip === ip ||
      (rawSerial && rawSerial !== '-' && (
        p.serial === rawSerial ||
        p.name === rawSerial ||
        p.ip === `pendente-${rawSerial.toLowerCase().replace(/[^a-z0-9]/g, '')}` ||
        AppState.statusData.get(p.id)?.info?.serialNumber === rawSerial
      ))
    );
    const isUpdate = Boolean(existing);

    staged.push({
      ip,
      name: finalName,
      serial: rawSerial !== '-' ? rawSerial : '',
      model: rawModel,
      location: rawLocation,
      unitName: itemUnitName,
      unitId: itemUnitId,
      region: itemRegion,
      isUpdate,
      existingId: existing?.id || null
    });
  }

  if (staged.length === 0) {
    showToast('Nenhum equipamento válido identificado na planilha.', 'warning');
    return;
  }

  AppState.stagedSheetPrinters = staged;
  renderSheetPreview(staged, sourceName);
  showToast(`${staged.length} impressoras identificadas para importação!`, 'success');
}

function renderSheetPreview(items, sourceName) {
  if (!DOM.sheetPreviewContainer || !DOM.sheetPreviewBody) return;

  const countNew = items.filter(x => !x.isUpdate).length;
  const countUpdate = items.filter(x => x.isUpdate).length;
  const total = items.length;

  if (DOM.previewFilenameBadge) DOM.previewFilenameBadge.textContent = sourceName;
  if (DOM.previewCountNew) DOM.previewCountNew.textContent = countNew;
  if (DOM.previewCountUpdate) DOM.previewCountUpdate.textContent = countUpdate;
  if (DOM.previewCountTotal) DOM.previewCountTotal.textContent = total;

  DOM.sheetPreviewBody.innerHTML = items.map(item => `
    <tr>
      <td>
        <span class="preview-badge ${item.isUpdate ? 'update' : 'new'}">
          ${item.isUpdate ? 'Atualização' : 'Novo'}
        </span>
      <td>
        ${item.ip.startsWith('pendente-')
          ? '<span class="state-chip warn" style="font-size: 0.72rem; padding: 2px 7px;">Pendente</span>'
          : `<code class="preview-ip">${escapeHtml(item.ip)}</code>`
        }
      </td>
      <td>
        <div style="font-weight: 600; color: var(--text-primary); font-size: 0.85rem;">${escapeHtml(item.name)}</div>
        ${item.serial ? `<div style="font-size: 0.72rem; color: var(--text-muted);">S/N: ${escapeHtml(item.serial)}</div>` : ''}
      </td>
      <td>${escapeHtml(item.model || '—')}</td>
      <td>${escapeHtml(item.location || '—')}</td>
      <td>
        <div style="font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
          <span>${escapeHtml(item.unitName || 'Sem filial')}</span>
          <span class="state-chip ${(item.region || 'RJ') === 'SP' ? 'sp' : 'rj'}">${escapeHtml(item.region || 'RJ')}</span>
        </div>
      </td>
    </tr>
  `).join('');

  DOM.sheetPreviewContainer.style.display = 'block';
  if (DOM.btnConfirmImportSheet) DOM.btnConfirmImportSheet.disabled = false;

  DOM.sheetPreviewContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function confirmImportSheet() {
  if (!AppState.stagedSheetPrinters || AppState.stagedSheetPrinters.length === 0) {
    showToast('Nenhuma impressora para importar.', 'warning');
    return;
  }

  const btn = DOM.btnConfirmImportSheet;
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span>Processando importação...</span>';

  const defaultUnitId = (DOM.sheetDefaultUnit && DOM.sheetDefaultUnit.value !== '__NEW_FOLDER__') ? DOM.sheetDefaultUnit.value : '';
  const defaultUnit = AppState.units.find(u => u.id === defaultUnitId);
  const defaultUnitName = defaultUnit ? defaultUnit.name : '';
  const defaultRegion = DOM.sheetDefaultRegion ? DOM.sheetDefaultRegion.value : '';

  try {
    const result = await API.batchImportPrinters({
      items: AppState.stagedSheetPrinters,
      defaultUnitId,
      defaultUnitName,
      defaultRegion: defaultRegion || undefined
    });

    showToast(result.message || `${AppState.stagedSheetPrinters.length} impressoras importadas com sucesso!`, 'success');
    closeImportSheetModal();

    await loadDashboardData(false, true);
  } catch (err) {
    showToast(err.message || 'Erro durante a importação da planilha.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

// ==========================================================================
// 16. EXPORTAÇÃO DE RELATÓRIOS CSV (PROJETO HEFESTO)
// ==========================================================================
async function exportRechargesReportCsv() {
  try {
    showToast('Gerando relatório de recargas...', 'info');
    const recharges = await API.getRecharges();

    if (recharges.length === 0) {
      showToast('Nenhum registro de recarga encontrado para exportar.', 'warning');
      return;
    }

    const headers = [
      'Data_Hora',
      'Unidade_Filial',
      'Setor_Local',
      'Impressora',
      'IP',
      'Suprimento',
      'Tipo_Suprimento',
      'Nivel_Anterior',
      'Nivel_Instalado',
      'Tipo_Recarga',
      'Contador_Paginas_Total',
      'Paginas_Rodadas_No_Ciclo',
      'Origem_Registro',
      'Tecnico_Responsavel',
      'Observacoes'
    ];

    const rows = recharges.map(r => [
      formatFullDateTime(r.timestamp),
      r.unitName || 'Sem Unidade',
      r.location || '',
      r.printerName || '',
      r.ip || '',
      translateSupplyName(r.supplyName),
      r.supplyType || 'toner',
      r.previousLevel + '%',
      r.newLevel + '%',
      rechargeEvidenceLabel(r),
      r.pageCount || 0,
      r.pagesSinceLastRecharge || 0,
      r.source === 'auto' ? 'Detecção Automática SNMP' : 'Registro Manual',
      r.technician || '',
      (r.notes || '').replace(/[;\n\r]/g, ' ')
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    const compSlug = (AppState.branding?.companyName || 'corporativo').toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `Relatorio_Recargas_Suprimentos_${compSlug}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Relatório de Recargas baixado com sucesso!', 'success');
  } catch (err) {
    showToast('Erro ao exportar relatório: ' + err.message, 'error');
  }
}

async function exportInkReportCsv() {
  try {
    const scopedPrinters = getScopedPrinters();
    if (scopedPrinters.length === 0) {
      showToast('Nenhuma impressora disponível para exportação.', 'warning');
      return;
    }

    const headers = [
      'Unidade_Filial',
      'Setor_Local',
      'Nome_Impressora',
      'IP',
      'Modelo',
      'Numero_Serie',
      'Status_Conexao',
      'Toner_Tinta_Preta',
      'Toner_Ciano',
      'Toner_Magenta',
      'Toner_Amarelo',
      'Menor_Nivel_Atual',
      'Total_Paginas_Impressas',
      'Ultima_Recarga_Data',
      'Ultima_Recarga_Suprimento',
      'Ultima_Recarga_Tipo'
    ];

    const rows = scopedPrinters.map(p => {
      const st = AppState.statusData.get(p.id) || {};
      const info = st.info || {};
      const isOnline = st.online;
      const supplies = st.supplies || [];

      let black = 'N/D', cyan = 'N/D', magenta = 'N/D', yellow = 'N/D';
      let lowestVal = 999;

      supplies.forEach(s => {
        const pct = normalizeSupplyPercentage(s);
        const lower = (s.name || '').toLowerCase();
        if (pct >= 0 && !isWasteSupply(s)) {
          if (pct < lowestVal) lowestVal = pct;
        }

        if (lower.includes('black') || lower.includes('preto') || lower.includes('k cartridge') || lower.includes('bk')) {
          black = pct >= 0 ? `${pct}%` : 'N/D';
        } else if (lower.includes('cyan') || lower.includes('ciano')) {
          cyan = pct >= 0 ? `${pct}%` : 'N/D';
        } else if (lower.includes('magenta')) {
          magenta = pct >= 0 ? `${pct}%` : 'N/D';
        } else if (lower.includes('yellow') || lower.includes('amarelo')) {
          yellow = pct >= 0 ? `${pct}%` : 'N/D';
        }
      });

      const recSummary = AppState.rechargesSummary ? AppState.rechargesSummary[p.id] : null;
      const lastRec = recSummary ? (recSummary.lastFullRecharge || recSummary.lastRecharge) : null;

      return [
        p.unitName || 'Sem Unidade',
        p.location || '',
        p.name || '',
        p.ip || '',
        info.model || 'Desconhecido',
        info.serialNumber || 'N/D',
        isOnline ? 'Online' : 'Offline',
        black,
        cyan,
        magenta,
        yellow,
        lowestVal !== 999 ? `${lowestVal}%` : 'N/D',
        info.pageCount || 0,
        lastRec ? formatFullDateTime(lastRec.timestamp) : 'Sem registro',
        lastRec ? translateSupplyName(lastRec.supplyName) : 'N/D',
        lastRec ? rechargeEvidenceLabel(lastRec) : 'N/D'
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    const compSlug = (AppState.branding?.companyName || 'corporativo').toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `Relatorio_Suprimentos_${compSlug}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Relatório de suprimentos baixado!', 'success');
  } catch (err) {
    showToast('Erro ao exportar relatório: ' + err.message, 'error');
  }
}

// ==========================================================================
// 17. MÓDULO DE VOLUME DE PÁGINAS & PREVISIBILIDADE (PROJETO HEFESTO)
// ==========================================================================
function applyAdminTabVisibility() {
  const tabName = AppState.activeAdminTab;
  for (const [name, button, view] of [
    ['printers', DOM.btnTabPrinters, DOM.tabViewPrinters],
    ['forecast', DOM.btnTabForecast, DOM.tabViewForecast]
  ]) {
    button?.classList.toggle('active', tabName === name);
    if (view) view.style.display = tabName === name ? 'block' : 'none';
  }
  const operationalContainer = document.getElementById('operational-status-cards-container');
  if (operationalContainer) operationalContainer.style.display = tabName === 'printers' ? 'block' : 'none';
  if (DOM.unitRecentRechargesSection && tabName !== 'printers') DOM.unitRecentRechargesSection.style.display = 'none';
}

function setDashboardRegion(region) {
  if (!['all', 'RJ', 'SP'].includes(region) || AppState.activeRegionFilter === region) return;
  AppState.activeRegionFilter = region;
  const unit = AppState.units.find(u => u.id === AppState.activeUnitFilter);
  if (unit && region !== 'all' && (unit.region || 'RJ') !== region) {
    AppState.activeUnitFilter = '';
    AppState.forecastUnitFilter = '';
  }
  AppState.activeFloorFilter = '';
  AppState.locationFilter = '';
  AppState.collapsedFloors.clear();
  updateHeaderRoleAndUnit();
  populateDropdownFilters();
  renderOverviewTab();
  if (AppState.userRole === 'admin' && AppState.activeAdminTab === 'forecast') {
    updateForecastKPIs(AppState.forecastUnitFilter);
    renderForecastTable();
  }
  const label = region === 'all' ? 'Todas as Regiões (RJ + SP)' : `Região ${region}`;
  showToast(`Visualização filtrada por: ${label}`, 'info');
}

function switchAdminTab(tabName) {
  AppState.activeAdminTab = tabName;
  applyAdminTabVisibility();
  if (tabName === 'printers' && AppState.userRole === 'admin') renderUnitRecentRecharges();

  if (tabName === 'forecast') {
    loadAndRenderForecastTab();
  }
}

async function loadAndRenderForecastTab() {
  if (!DOM.tabViewForecast) return;

  try {
    const data = await API.getVolumeForecast();
    AppState.forecastData = data;

    // Se estiver no modo operador ou uma unidade estiver selecionada no escopo
    if (AppState.activeUnitFilter) {
      const u = AppState.units.find(x => x.id === AppState.activeUnitFilter);
      if (u) AppState.forecastUnitFilter = u.id || u.name;
    }

    // Popula dropdown de unidades do forecast (quando em modo admin)
    if (DOM.forecastUnitSelect) {
      const cur = AppState.forecastUnitFilter || '';
      let filteredUnits = AppState.units || [];
      if (AppState.activeRegionFilter && AppState.activeRegionFilter !== 'all') {
        filteredUnits = filteredUnits.filter(u => (u.region || 'RJ') === AppState.activeRegionFilter);
      }
      DOM.forecastUnitSelect.innerHTML = '<option value="">Todas as Unidades</option>' +
        filteredUnits.map(u => {
          const reg = escapeHtml(u.region || 'RJ');
          return `<option value="${escapeHtml(u.id)}" ${matchesUnitFilter({ unitId: u.id, unitName: u.name }, cur) ? 'selected' : ''}>[${reg}] ${escapeHtml(u.name)}</option>`;
        }).join('');
    }

    updateForecastKPIs(AppState.forecastUnitFilter);
    renderForecastTable();
  } catch (err) {
    console.error('[Forecast]', err);
    showToast('Erro ao carregar dados de volume e previsão', 'error');
  }
}

function updateForecastKPIs(unitFilterName) {
  let list = AppState.forecastData || [];

  if (AppState.activeRegionFilter && AppState.activeRegionFilter !== 'all') {
    list = list.filter(p => {
      const printer = AppState.printers.find(x => x.id === p.printerId || x.ip === p.ip);
      const reg = p.region || printer?.region || (AppState.units.find(u => u.name === p.unitName)?.region) || 'RJ';
      return reg === AppState.activeRegionFilter;
    });
  }

  if (unitFilterName) {
    list = list.filter(p => matchesUnitFilter(p, unitFilterName));
  }

  let totalToday = 0;
  let totalWeek = 0;
  let totalMonth = 0;
  let criticalSwaps = 0;
  let partialWeekPrinters = 0;
  let partialMonthPrinters = 0;

  list.forEach(item => {
    totalToday += Number(item.pagesToday) || 0;
    totalWeek += Number(item.pagesThisWeek) || 0;
    totalMonth += Number(item.pagesThisMonth) || 0;
    if (!item.has7DayBaseline) partialWeekPrinters++;
    if (!item.has30DayBaseline) partialMonthPrinters++;
    if (item.criticalSupply && item.criticalSupply.daysRemaining <= 7) {
      criticalSwaps++;
    }
  });

  const measuredToday = list.filter(item => typeof item.pagesToday === 'number').length;
  if (DOM.kpiPagesToday) DOM.kpiPagesToday.textContent = measuredToday ? totalToday.toLocaleString('pt-BR') : '—';
  if (DOM.kpiPagesWeek) DOM.kpiPagesWeek.textContent = totalWeek.toLocaleString('pt-BR');
  if (DOM.kpiPagesMonth) DOM.kpiPagesMonth.textContent = totalMonth.toLocaleString('pt-BR');
  if (DOM.kpiCriticalSwapsCount) DOM.kpiCriticalSwapsCount.textContent = criticalSwaps;

  // Datas exatas dos períodos de contabilização
  const now = new Date();
  const todayStr = now.toLocaleDateString('pt-BR');
  const dWeek = new Date(now.getTime() - 6 * 86400000);
  const weekStartStr = dWeek.toLocaleDateString('pt-BR');
  const dMonth = new Date(now.getTime() - 29 * 86400000);
  const monthStartStr = dMonth.toLocaleDateString('pt-BR');
  const dFuture = new Date(now.getTime() + 7 * 86400000);
  const futureStr = dFuture.toLocaleDateString('pt-BR');

  if (DOM.kpiPeriodToday) DOM.kpiPeriodToday.textContent = `${todayStr} (Hoje)`;
  if (DOM.kpiPeriodWeek) DOM.kpiPeriodWeek.textContent = `${weekStartStr} a ${todayStr} (7d)`;
  if (DOM.kpiPeriodMonth) DOM.kpiPeriodMonth.textContent = `${monthStartStr} a ${todayStr} (30d)`;
  if (DOM.kpiPeriodSwaps) DOM.kpiPeriodSwaps.textContent = `Janela: até ${futureStr} (< 7d)`;

  const weekCoverageNote = partialWeekPrinters > 0 ? ` • histórico parcial: ${partialWeekPrinters} impressora(s)` : '';
  const monthCoverageNote = partialMonthPrinters > 0 ? ` • histórico parcial: ${partialMonthPrinters} impressora(s)` : '';

  // Atualiza legendas dos KPIs conforme o escopo selecionado
  if (unitFilterName) {
    if (DOM.kpiSubPagesToday) DOM.kpiSubPagesToday.textContent = `Hoje na unidade ${unitFilterName}`;
    if (DOM.kpiSubPagesWeek) DOM.kpiSubPagesWeek.textContent = `Últimos 7d na unidade ${unitFilterName}${weekCoverageNote}`;
    if (DOM.kpiSubPagesMonth) DOM.kpiSubPagesMonth.textContent = `Últimos 30d na unidade ${unitFilterName}${monthCoverageNote}`;
    if (DOM.kpiSubCriticalSwaps) DOM.kpiSubCriticalSwaps.textContent = `Perto de acabar na unidade ${unitFilterName}`;
  } else {
    const regNote = AppState.activeRegionFilter === 'RJ' ? ' (RJ)' : (AppState.activeRegionFilter === 'SP' ? ' (SP)' : '');
    if (DOM.kpiSubPagesToday) DOM.kpiSubPagesToday.textContent = `Páginas impressas hoje${regNote}`;
    if (DOM.kpiSubPagesWeek) DOM.kpiSubPagesWeek.textContent = `Últimos 7 dias acumulados${regNote}${weekCoverageNote}`;
    if (DOM.kpiSubPagesMonth) DOM.kpiSubPagesMonth.textContent = `Últimos 30 dias de operação${regNote}${monthCoverageNote}`;
    if (DOM.kpiSubCriticalSwaps) DOM.kpiSubCriticalSwaps.textContent = `Suprimentos perto de acabar na rede${regNote}`;
  }
}

function renderForecastTable() {
  if (!DOM.forecastTableBody) return;

  const q = (AppState.forecastSearch || '').toLowerCase().trim();
  let unitFilter = AppState.forecastUnitFilter;
  if (AppState.activeUnitFilter) {
    const u = AppState.units.find(x => x.id === AppState.activeUnitFilter);
    if (u) unitFilter = u.id || u.name;
  }
  const workloadFilter = AppState.forecastWorkloadFilter;
  const timeFilter = AppState.forecastTimeFilter;

  // Atualiza KPIs para a unidade selecionada
  updateForecastKPIs(unitFilter);

  let list = AppState.forecastData || [];

  // Filtro de Região
  if (AppState.activeRegionFilter && AppState.activeRegionFilter !== 'all') {
    list = list.filter(p => {
      const printer = AppState.printers.find(x => x.id === p.printerId || x.ip === p.ip);
      const reg = p.region || printer?.region || (AppState.units.find(u => u.name === p.unitName)?.region) || 'RJ';
      return reg === AppState.activeRegionFilter;
    });
  }

  // Filtro de busca
  if (q) {
    const cleanQ = q.replace(/[\s-]/g, '');
    list = list.filter(p => {
      const matchName = (p.printerName || '').toLowerCase().includes(q);
      const matchLoc = (p.location || '').toLowerCase().includes(q);
      const matchIp = (p.ip || '').toLowerCase().includes(q);
      const matchModel = (p.model || '').toLowerCase().includes(q);
      const matchUnit = (p.unitName || '').toLowerCase().includes(q);
      const serialStr = (p.serialNumber || p.serial || '').toLowerCase();
      const cleanSerial = serialStr.replace(/[\s-]/g, '');
      const matchSerial = (serialStr && serialStr.includes(q)) || (cleanSerial && cleanSerial.includes(cleanQ));
      const macStr = (p.macAddress || '').toLowerCase();
      const matchMac = macStr.includes(q) || (macStr && macStr.replace(/[:-]/g, '').includes(cleanQ));
      return matchName || matchLoc || matchIp || matchModel || matchUnit || matchSerial || matchMac;
    });
  }

  // Filtro de Unidade
  if (unitFilter) {
    list = list.filter(p => matchesUnitFilter(p, unitFilter));
  }

  // Filtro de Carga de Trabalho
  if (workloadFilter) {
    list = list.filter(p => p.workloadStatus === workloadFilter);
  }

  // Filtro por Janela de Troca
  if (timeFilter) {
    if (timeFilter === 'critical7') {
      list = list.filter(p => p.criticalSupply && p.criticalSupply.daysRemaining <= 7);
    } else if (timeFilter === 'warning15') {
      list = list.filter(p => p.criticalSupply && p.criticalSupply.daysRemaining <= 15);
    } else if (timeFilter === 'normal30') {
      list = list.filter(p => p.criticalSupply && p.criticalSupply.daysRemaining <= 30);
    }
  }

  // Ordena por dias restantes mais urgentes
  list.sort((a, b) => {
    const daysA = a.criticalSupply ? a.criticalSupply.daysRemaining : 999;
    const daysB = b.criticalSupply ? b.criticalSupply.daysRemaining : 999;
    return daysA - daysB;
  });

  if (list.length === 0) {
    DOM.forecastTableBody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; color: var(--text-muted); padding: 2rem;">
          Nenhum equipamento encontrado com os filtros selecionados.
        </td>
      </tr>
    `;
    return;
  }

  DOM.forecastTableBody.innerHTML = list.map(item => {
    const crit = item.criticalSupply;
    const daysRemaining = crit ? crit.daysRemaining : null;
    const pagesRemaining = crit ? crit.pagesRemaining : 0;

    // Status do Prazo
    let tagClass = 'ok';
    let daysText = 'Estável';
    if (daysRemaining !== null) {
      if (daysRemaining <= 7) {
        tagClass = 'urgent';
        daysText = daysRemaining === 1 ? 'Esgota em ~1 dia!' : `Esgota em ~${daysRemaining} dias!`;
      } else if (daysRemaining <= 15) {
        tagClass = 'warn';
        daysText = `Esgota em ~${daysRemaining} dias`;
      } else {
        tagClass = 'ok';
        daysText = `Esgota em ~${daysRemaining} dias`;
      }
    } else {
      daysText = 'Sem telemetria';
    }

    // Formatação da Data Projetada
    let dateFormatted = 'N/D';
    if (crit && crit.depletionDate) {
      const parts = crit.depletionDate.split('-');
      if (parts.length === 3) {
        dateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }

    // Badge de Carga
    let workloadClass = 'ideal';
    let workloadIcon = '✓';
    if (item.workloadStatus === 'high') {
      workloadClass = 'high';
      workloadIcon = '▲';
    } else if (item.workloadStatus === 'low') {
      workloadClass = 'low';
      workloadIcon = '▼';
    }

    // Cor e rótulo do Suprimento
    const supPct = crit ? crit.percentage : 0;
    const isEstimated = crit && (crit.isRefillable || (crit.name && (crit.name.toLowerCase().includes('bottle') || crit.name.toLowerCase().includes('tanque'))));
    const pctDisplay = isEstimated ? `~${supPct}% (Est.)` : `${supPct}%`;

    let supColor = 'var(--color-primary)';
    if (crit) {
      const lowerName = (crit.name || '').toLowerCase();
      if (lowerName.includes('yellow') || lowerName.includes('amarel')) supColor = '#eab308';
      else if (lowerName.includes('magenta')) supColor = '#ec4899';
      else if (lowerName.includes('cyan') || lowerName.includes('ciano')) supColor = '#06b6d4';
      else if (lowerName.includes('black') || lowerName.includes('preto')) supColor = '#3b82f6';
    }

    const itemReg = item.region || AppState.printers.find(x => x.id === item.printerId || x.ip === item.ip)?.region || (AppState.units.find(u => u.name === item.unitName)?.region) || 'RJ';

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem;">
            ${escapeHtml(item.location || item.printerName)}
          </div>
          <div style="font-size: 0.725rem; color: var(--text-muted); display: flex; gap: 0.35rem; align-items: center; margin-top: 0.15rem;">
            <code style="font-family: var(--font-mono); color: var(--color-primary);">${escapeHtml(item.ip)}</code>
            <span>•</span>
            <span>${escapeHtml(item.unitName)}</span>
            <span class="state-chip ${itemReg === 'SP' ? 'sp' : 'rj'}">${escapeHtml(itemReg)}</span>
          </div>
          <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.15rem;">
            ${escapeHtml(item.model)}
          </div>
        </td>

        <td style="text-align: center; font-family: var(--font-mono); font-weight: 700; color: var(--text-primary);">
          ${typeof item.pagesToday === 'number' ? item.pagesToday.toLocaleString('pt-BR') : '—'}
        </td>

        <td style="text-align: center; font-family: var(--font-mono); font-weight: 600; color: var(--text-secondary);">
          ${typeof item.pagesThisWeek === 'number' ? item.pagesThisWeek.toLocaleString('pt-BR') : '—'}
          ${!item.has7DayBaseline ? `<div style="font-family: var(--font-sans); font-size: 0.62rem; font-weight: 600; color: var(--color-warning); margin-top: 2px;" title="Não existe leitura no início da janela móvel de 7 dias. O valor representa apenas o histórico disponível.">Período parcial${item.periodStart7 ? ` • sem leitura em ${item.periodStart7.split('-').reverse().join('/')}` : ''}</div>` : ''}
        </td>

        <td style="text-align: center; font-family: var(--font-mono); font-weight: 600; color: var(--text-secondary);">
          ${typeof item.pagesThisMonth === 'number' ? item.pagesThisMonth.toLocaleString('pt-BR') : '—'}
          ${!item.has30DayBaseline ? `<div style="font-family: var(--font-sans); font-size: 0.62rem; font-weight: 600; color: var(--color-warning); margin-top: 2px;" title="Não existe leitura no início da janela móvel de 30 dias. O valor representa apenas o histórico disponível.">Período parcial${item.periodStart30 ? ` • sem leitura em ${item.periodStart30.split('-').reverse().join('/')}` : ''}</div>` : ''}
        </td>

        <td style="text-align: center; font-family: var(--font-mono); font-weight: 700; color: var(--color-primary);" title="Média calculada sobre ${item.avgPagesPeriodDays || 1} dia(s)-calendário coberto(s) da ${item.avgPagesPeriod === '30d_fallback' ? 'janela de 30d (fallback)' : 'janela de 7d'}.">
          ~${item.avgPagesPerDay || 0}/dia
          <div style="font-family: var(--font-sans); font-size: 0.62rem; font-weight: 600; color: var(--text-muted); margin-top: 2px;">base: ${item.avgPagesPeriodDays || 1}d</div>
        </td>

        <td style="text-align: center;">
          <span class="workload-chip ${workloadClass}" title="Capacidade nominal: ${item.capacityMonthlyNominal?.toLocaleString('pt-BR')} pág/mês (${item.capacityRatio}% utilizada)">
            <span>${workloadIcon}</span>
            <span>${item.workloadLabel}</span>
          </span>
        </td>

        <td>
          ${crit ? `
            <div class="forecast-supply-meter">
              <div class="forecast-supply-info">
                <span style="font-weight: 600; color: var(--text-primary); max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(translateSupplyName(crit.name))}</span>
                <span style="font-family: var(--font-mono); font-weight: 700; color: ${isEstimated ? 'var(--color-success)' : (supPct <= 10 ? 'var(--color-danger)' : (supPct <= 30 ? 'var(--color-warning)' : 'var(--color-success)'))};">${pctDisplay}</span>
              </div>
              <div class="forecast-meter-bar">
                <div class="forecast-meter-fill" style="width: ${supPct}%; background: ${supColor};"></div>
              </div>
              ${(() => {
                const forecastToners = (item.suppliesForecast || []).filter(s =>
                  !s.name.toLowerCase().includes('waste') &&
                  !s.name.toLowerCase().includes('drum') &&
                  !s.name.toLowerCase().includes('imaging') &&
                  !s.name.toLowerCase().includes('transfer') &&
                  !s.name.toLowerCase().includes('adf') &&
                  !s.name.toLowerCase().includes('fuser') &&
                  !s.name.toLowerCase().includes('fusor') &&
                  !s.name.toLowerCase().includes('kit')
                );
                if (forecastToners.length <= 1) return '';
                return `
                  <div style="display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.35rem;" title="Níveis de todos os insumos de impressão">
                    ${forecastToners.map(s => {
                      const dotColor = getSupplyColorByName(s.name);
                      const shortName = translateSupplyName(s.name, s.type)
                        .replace('Toner / Tinta ', '')
                        .replace('Cartucho / Toner ', '')
                        .replace('Bolsa de Tinta ', '');

                      const blackToners = forecastToners.filter(b => /black|preto|k1|k2/i.test(b.name || ''));
                      const hasDual = blackToners.length > 1;
                      const maxBlack = hasDual ? Math.max(...blackToners.map(b => b.percentage)) : 0;
                      const isDualK = hasDual && /k1|k2/i.test(s.name || '');

                      let statusTextSuffix = '';
                      let statusClr = s.percentage <= 10 ? 'var(--color-danger)' : (s.percentage <= 30 ? 'var(--color-warning)' : 'var(--color-success)');

                      if (isDualK) {
                        if (s.percentage > 10) {
                          statusTextSuffix = ' (Ativo)';
                        } else if (maxBlack > 10) {
                          statusTextSuffix = ' (Reserva vazia)';
                          statusClr = 'var(--color-warning)';
                        }
                      }

                      return `
                        <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 0.65rem; font-weight: 700; color: var(--text-secondary); background: var(--bg-input); padding: 1px 4px; border-radius: 3px; border-left: 2px solid ${statusClr};" title="${escapeHtml(translateSupplyName(s.name, s.type))}: ${s.percentage}%${statusTextSuffix} (${s.daysRemainingEstimated ? '~' + s.daysRemainingEstimated + ' dias' : 'Estável'})">
                          <span style="width: 6px; height: 6px; border-radius: 50%; background-color: ${dotColor}; display: inline-block;"></span>
                          <span>${escapeHtml(shortName)}: ${s.percentage}%${statusTextSuffix}</span>
                        </span>
                      `;
                    }).join('')}
                  </div>
                `;
              })()}
            </div>
          ` : '<span style="color: var(--text-muted); font-size: 0.75rem;">Sem dados</span>'}
        </td>

        <td style="text-align: center; font-family: var(--font-mono); font-weight: 700; color: var(--text-primary);">
          ${pagesRemaining ? Number(pagesRemaining).toLocaleString('pt-BR') : '0'} pág.
        </td>

        <td>
          <div class="forecast-date-badge">
            <span class="forecast-days-tag ${tagClass}">${daysText}</span>
            <span class="forecast-projected-date">Previsão: ${dateFormatted}</span>
          </div>
        </td>

        <td style="text-align: center;">
          <button
            type="button"
            class="deck-action-pill"
            onclick="openPrinterDetailDrawer(${jsArg(item.printerId)})"
            title="Ver detalhes da impressora"
          >
            ${Icons.eye}
            <span>Detalhes</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function exportForecastReportCsv() {
  try {
    showToast('Gerando relatório de volume e previsibilidade...', 'info');
    const data = await API.getVolumeForecast();

    if (!data || data.length === 0) {
      showToast('Nenhum dado analítico encontrado para exportar.', 'warning');
      return;
    }

    const headers = [
      'Unidade_Filial',
      'Setor_Localizacao',
      'Nome_Identificacao',
      'Endereco_IP',
      'Modelo_Equipamento',
      'Contador_Total_Paginas',
      'Paginas_Hoje',
      'Paginas_Semana_7d',
      'Paginas_Mes_30d',
      'Media_Paginas_Por_Dia_7d',
      'Dias_Calendario_Base_Media',
      'Status_Carga_Trabalho',
      'Capacidade_Nominal_Mes',
      'Percentual_Utilizacao_Capacidade',
      'Suprimento_Mais_Critico',
      'Nivel_Atual_Percentual',
      'Paginas_Restantes_Estimadas',
      'Dias_Restantes_Estimados',
      'Data_Projetada_Proxima_Troca'
    ];

    const rows = data.map(p => {
      const crit = p.criticalSupply;
      return [
        p.unitName || 'Sem Unidade',
        p.location || '',
        p.printerName || '',
        p.ip || '',
        p.model || '',
        p.pageCount || 0,
        p.pagesToday ?? 'N/D',
        p.pagesThisWeek || 0,
        p.pagesThisMonth || 0,
        p.avgPagesPerDay || 0,
        p.avgPagesPeriodDays || 1,
        p.workloadLabel || '',
        p.capacityMonthlyNominal || 0,
        (p.capacityRatio || 0) + '%',
        crit ? translateSupplyName(crit.name) : 'N/D',
        crit ? (crit.percentage + '%') : 'N/D',
        crit ? crit.pagesRemaining : 0,
        crit ? crit.daysRemaining : 'N/D',
        crit ? crit.depletionDate : 'N/D'
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    const compSlug = (AppState.branding?.companyName || 'corporativo').toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `Relatorio_Volume_Previsibilidade_${compSlug}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Download do relatório de volume e previsão concluído!', 'success');
  } catch (err) {
    showToast('Erro ao exportar relatório CSV', 'error');
  }
}

async function exportInitialIntegrationReportCsv() {
  try {
    const reportData = await API.getInitialIntegrationReport();
    if (!reportData || reportData.length === 0) {
      showToast('Nenhum dado de integração disponível para exportação.', 'warning');
      return;
    }

    const scopedPrinters = getScopedPrinters();
    const scopedIds = new Set(scopedPrinters.map(p => p.id));
    let filtered = reportData;
    if (scopedPrinters.length > 0 && scopedPrinters.length < AppState.printers.length) {
      filtered = reportData.filter(r => scopedIds.has(r.printerId));
    }

    const headers = [
      'Unidade / Filial',
      'Local / Setor',
      'Endereço IP',
      'Modelo da Impressora',
      'Número de Série',
      'Data de Instalação Física (Contrato)',
      'Data de Início do Monitoramento',
      'Contador na Ativação (Páginas)',
      'Contador Atual Vitalício (Páginas)',
      'Páginas Rodadas sob Gestão (Delta)',
      'Status Operacional Atual'
    ];

    const rows = filtered.map(r => [
      r.unitName || 'Sem Unidade',
      r.location || r.name,
      r.ip,
      r.model,
      r.serialNumber,
      r.installedAt ? formatFullDateTime(r.installedAt).split(' ')[0] : 'Não informada',
      formatFullDateTime(r.hefestoActivatedAt || r.createdAt),
      r.initialPageCount || 0,
      r.currentPageCount || 0,
      r.pagesProducedSinceIntegration || 0,
      r.status || (r.online ? 'Operacional' : 'Offline')
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    const compSlug = (AppState.branding?.companyName || 'corporativo').toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `Relatorio_Integracao_Inicial_Rede_${compSlug}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Relatório de Integração Inicial baixado com sucesso!', 'success');
  } catch (err) {
    showToast('Erro ao exportar relatório de integração: ' + err.message, 'error');
  }
}

window.openPrinterDetailDrawer = openPrinterDetailDrawer;
window.openManualRechargeModal = openManualRechargeModal;
window.openMacScannerModal = openMacScannerModal;
window.handleQuickAddDiscovered = handleQuickAddDiscovered;
window.handleDeleteCorporateSubnet = handleDeleteCorporateSubnet;
window.exportRechargesReportCsv = exportRechargesReportCsv;
window.exportInkReportCsv = exportInkReportCsv;
window.exportInitialIntegrationReportCsv = exportInitialIntegrationReportCsv;
window.switchAdminTab = switchAdminTab;
window.setDashboardRegion = setDashboardRegion;
window.exportForecastReportCsv = exportForecastReportCsv;

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const iconHtml = type === 'success' ? Icons.checkCircle : type === 'error' ? Icons.alertOctagon : type === 'warning' ? Icons.alertTriangle : Icons.info;
  toast.innerHTML = `<span>${iconHtml}</span><span>${escapeHtml(message)}</span>`;

  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Argumento string para handler inline (onclick="fn(${jsArg(x)})"): JSON.stringify gera um literal JS seguro
// e escapeHtml protege o atributo (o navegador decodifica as entidades antes de executar o JS).
function jsArg(value) {
  return escapeHtml(JSON.stringify(String(value ?? '')));
}

function updateLastUpdatedTimestamp() {
  AppState.lastUpdated = new Date();
  const timeStr = AppState.lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (DOM.lastUpdatedText) {
    const dates = getScopedPrinters().map(p => Date.parse(AppState.statusData.get(p.id)?.cachedAt)).filter(Number.isFinite);
    const collected = dates.length ? new Date(Math.max(...dates)) : null;
    DOM.lastUpdatedText.textContent = `Tela: ${timeStr} · Coleta mais recente: ${collected ? collected.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'aguardando'}`;
    DOM.lastUpdatedText.title = collected ? `Coleta mais recente recebida: ${collected.toLocaleString('pt-BR')}. Cada equipamento mantém seu próprio horário de leitura.` : 'Ainda não há uma coleta registrada.';
  }
}

// Verificação proativa de reposição de suprimentos em tempo real (Motor Hefesto)
async function checkRecentRechargeEvents() {
  try {
    const events = await API.getRecentRechargeEvents();
    if (!Array.isArray(events) || events.length === 0) return;

    if (AppState.seenRechargeIds.size === 0) {
      // Primeira inicialização: armazena IDs já existentes para evitar disparo em lote
      events.forEach(ev => AppState.seenRechargeIds.add(ev.id));
      return;
    }

    let hasNew = false;
    for (const ev of events) {
      if (!AppState.seenRechargeIds.has(ev.id)) {
        AppState.seenRechargeIds.add(ev.id);
        hasNew = true;
        const supply = translateSupplyName(ev.supplyName || 'Toner/Tinta');
        const printer = ev.printerName || 'Impressora';
        const loc = ev.location ? ` • ${ev.location}` : '';
        const prev = (typeof ev.previousLevel === 'number' && ev.previousLevel >= 0) ? `${ev.previousLevel}% ➔ ` : '';
        showToast(`Suprimento reposto: ${supply} em ${printer}${loc} (${prev}${ev.newLevel}%)`, 'success');
      }
    }

    if (hasNew) {
      const summary = await API.getRechargesSummary();
      AppState.rechargesSummary = summary || {};
      renderOverviewTab();
    }
  } catch (err) {
    console.warn('[Recent Recharge Events] Falha ao verificar eventos de recarga:', err.message);
  }
}


// ==========================================================================
// 17. EVENT LISTENERS & BOOTSTRAP
// ==========================================================================
function setupEventListeners() {
  DOM.btnRefreshAll.addEventListener('click', () => loadDashboardData(false, true));
  DOM.btnAddPrinterHeader.addEventListener('click', openAddPrinterModal);

  if (DOM.btnOpenDiagnoseIp) {
    DOM.btnOpenDiagnoseIp.addEventListener('click', openTestIpModal);
  }
  if (DOM.btnCloseModalTestIp) {
    DOM.btnCloseModalTestIp.addEventListener('click', closeTestIpModal);
  }
  if (DOM.btnCancelModalTestIp) {
    DOM.btnCancelModalTestIp.addEventListener('click', closeTestIpModal);
  }
  if (DOM.formTestIpModal) {
    DOM.formTestIpModal.addEventListener('submit', handleTestIpSubmit);
  }
  if (DOM.btnQuickAddFromTest) {
    DOM.btnQuickAddFromTest.addEventListener('click', handleQuickAddFromTest);
  }

  // Scanner de Rede por MAC Address
  if (DOM.btnOpenMacScanner) {
    DOM.btnOpenMacScanner.addEventListener('click', () => openMacScannerModal());
  }
  if (DOM.btnCloseModalMacScanner) {
    DOM.btnCloseModalMacScanner.addEventListener('click', closeMacScannerModal);
  }
  if (DOM.btnCancelModalMacScanner) {
    DOM.btnCancelModalMacScanner.addEventListener('click', closeMacScannerModal);
  }
  if (DOM.btnToggleSubnetsCatalog) {
    DOM.btnToggleSubnetsCatalog.addEventListener('click', () => {
      if (!DOM.macScannerSubnetsManager) return;
      const isHidden = DOM.macScannerSubnetsManager.style.display === 'none';
      DOM.macScannerSubnetsManager.style.display = isHidden ? 'block' : 'none';
      if (isHidden) {
        renderCorporateSubnetsCatalog();
        if (DOM.inputNewSubnet) DOM.inputNewSubnet.focus();
      }
    });
  }
  if (DOM.btnSaveCorporateSubnet) {
    DOM.btnSaveCorporateSubnet.addEventListener('click', handleSaveCorporateSubnet);
  }
  if (DOM.inputNewSubnet) {
    DOM.inputNewSubnet.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveCorporateSubnet();
      }
    });
  }
  if (DOM.inputNewSubnetDesc) {
    DOM.inputNewSubnetDesc.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveCorporateSubnet();
      }
    });
  }
  if (DOM.formMacScanner) {
    DOM.formMacScanner.addEventListener('submit', handleMacScanSubmit);
  }
  if (DOM.macScanUnitSelect) {
    DOM.macScanUnitSelect.addEventListener('change', (e) => {
      const value = e.target.value;
      if (value === 'global') {
        if (DOM.macScanSubnet) {
          DOM.macScanSubnet.disabled = true;
          DOM.macScanSubnet.value = '';
          DOM.macScanSubnet.placeholder = 'Varredura Global (Todas as Faixas)';
        }
        if (DOM.macScanSubnetRequired) DOM.macScanSubnetRequired.style.display = 'none';
      } else {
        if (DOM.macScanSubnet) {
          DOM.macScanSubnet.disabled = false;
          DOM.macScanSubnet.placeholder = 'Ex: 198.18.5';
        }
        if (DOM.macScanSubnetRequired) DOM.macScanSubnetRequired.style.display = 'inline';
        if (value) {
          const unitPrinters = AppState.printers.filter(p => p.unitId === value && p.ip && !p.ip.startsWith('pendente-'));
          if (unitPrinters.length > 0) {
            const parts = unitPrinters[0].ip.split('.');
            if (parts.length >= 3 && DOM.macScanSubnet) {
              DOM.macScanSubnet.value = parts.slice(0, 3).join('.');
            }
          }
        }
      }
      updateMacScanButtonText();
    });
  }
  if (DOM.macScanTargetMac) {
    DOM.macScanTargetMac.addEventListener('input', updateMacScanButtonText);
  }

  // Modal de Atribuição de IP
  if (DOM.btnCloseModalAssignIp) {
    DOM.btnCloseModalAssignIp.addEventListener('click', closeAssignIpModal);
  }
  if (DOM.btnCancelModalAssignIp) {
    DOM.btnCancelModalAssignIp.addEventListener('click', closeAssignIpModal);
  }
  if (DOM.formAssignIp) {
    DOM.formAssignIp.addEventListener('submit', handleAssignIpSubmit);
  }
  if (DOM.assignTargetPrinterSelect) {
    DOM.assignTargetPrinterSelect.addEventListener('change', updateAssignIpWarning);
  }

  DOM.tabLoginOperator.addEventListener('click', () => {
    DOM.tabLoginOperator.classList.add('active');
    DOM.tabLoginAdmin.classList.remove('active');
    DOM.formLoginUnit.style.display = 'block';
    DOM.formLoginAdmin.style.display = 'none';
    DOM.adminUserInput.value = '';
    DOM.adminPasswordInput.value = '';
    DOM.loginOverlay.classList.remove('admin-mode');
    setLoginMode('operator');
  });

  DOM.tabLoginAdmin.addEventListener('click', () => {
    DOM.tabLoginAdmin.classList.add('active');
    DOM.tabLoginOperator.classList.remove('active');
    DOM.formLoginUnit.style.display = 'none';
    DOM.formLoginAdmin.style.display = 'block';
    DOM.adminUserInput.value = '';
    DOM.adminPasswordInput.value = '';
    DOM.loginOverlay.classList.add('admin-mode');
    setLoginMode('admin');
    setTimeout(() => DOM.adminUserInput.focus(), 100);
  });

  DOM.formLoginUnit.addEventListener('submit', (e) => {
    e.preventDefault();
    const selectedUnit = DOM.loginUnitSelect.value;
    if (!selectedUnit) {
      showToast('Por favor, selecione sua unidade/filial para acessar.', 'error');
      return;
    }

    AppState.userRole = 'operator';
    AppState.activeUnitFilter = selectedUnit;
    AppState.activeFloorFilter = '';
    AppState.locationFilter = '';
    AppState.collapsedFloors.clear();
    sessionStorage.setItem('auth_role', 'operator');
    sessionStorage.setItem('printer_monitor_unit', selectedUnit);

    DOM.loginOverlay.classList.remove('admin-mode');
    DOM.loginOverlay.classList.remove('active');
    renderAllViews();
    showToast('Acesso de Operador iniciado!', 'success');
    window.ReleaseNotes?.onLogin(`operator:${selectedUnit}`);
  });



  // Campo de Busca de Unidade por Nome no Login
  if (DOM.loginUnitSearchInput) {
    DOM.loginUnitSearchInput.addEventListener('input', (e) => {
      AppState.loginUnitSearchQuery = e.target.value;
      if (DOM.loginUnitSearchClear) {
        DOM.loginUnitSearchClear.style.display = e.target.value ? 'inline-flex' : 'none';
      }
      populateLoginUnitSelect();
    });
  }

  // Botão de Limpar Busca no Login
  if (DOM.loginUnitSearchClear) {
    DOM.loginUnitSearchClear.addEventListener('click', () => {
      if (DOM.loginUnitSearchInput) {
        DOM.loginUnitSearchInput.value = '';
        DOM.loginUnitSearchInput.focus();
      }
      DOM.loginUnitSearchClear.style.display = 'none';
      AppState.loginUnitSearchQuery = '';
      populateLoginUnitSelect();
    });
  }

  // Seletor de Região na Tela de Login (Operador)
  if (DOM.loginRegionPills) {
    DOM.loginRegionPills.querySelectorAll('.login-region-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const region = btn.dataset.region || 'all';
        AppState.loginRegionFilter = region;
        DOM.loginRegionPills.querySelectorAll('.login-region-pill').forEach(b => {
          b.classList.toggle('active', (b.dataset.region || 'all') === region);
        });
        populateLoginUnitSelect();
      });
    });
  }

  DOM.formLoginAdmin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = DOM.adminUserInput.value.trim();
    const pass = DOM.adminPasswordInput.value.trim();
    const rememberMe = DOM.adminRememberInput ? DOM.adminRememberInput.checked : true;

    try {
      const authRes = await API.verifyAdmin(user, pass);
      if (authRes.success) {
        AppState.userRole = 'admin';
        AppState.activeUnitFilter = AppState.isEdge ? AppState.edgeUnitName : '';
        AppState.activeFloorFilter = '';
        AppState.locationFilter = '';
        AppState.collapsedFloors.clear();

        sessionStorage.setItem('auth_role', 'admin');
        if (AppState.isEdge) {
          sessionStorage.setItem('printer_monitor_unit', AppState.edgeUnitName);
        } else {
          sessionStorage.removeItem('printer_monitor_unit');
        }

        if (rememberMe) {
          localStorage.setItem('auth_role', 'admin');
          localStorage.setItem('hefesto_remember_username', user);
          if (AppState.isEdge) {
            localStorage.setItem('printer_monitor_unit', AppState.edgeUnitName);
          }
        } else {
          localStorage.removeItem('auth_role');
          localStorage.removeItem('hefesto_remember_username');
        }

        if (!rememberMe) {
          DOM.adminUserInput.value = '';
        }
        DOM.adminPasswordInput.value = '';

        DOM.loginOverlay.classList.remove('admin-mode');
        DOM.loginOverlay.classList.remove('active');
        renderAllViews();
        showToast(AppState.isEdge ? `Bem-vindo, Administrador da Filial (${AppState.edgeUnitName})!` : 'Bem-vindo ao Painel do Administrador!', 'success');
        window.ReleaseNotes?.onLogin(`admin:${user}`);
        return;
      }
    } catch (err) {
      showToast(err.message || 'Usuário ou senha de administrador incorretos!', 'error');
      DOM.adminPasswordInput.value = '';
      DOM.adminPasswordInput.focus();
    }
  });

  if (DOM.btnForceEdgeSync) {
    DOM.btnForceEdgeSync.addEventListener('click', handleForceEdgeSync);
  }

  const handleLogout = async () => {
    window.ReleaseNotes?.onLogout();
    window.DashboardRefresh?.reset();
    window.WorkstationModule?.closeDetail();
    try {
      await API.logout();
    } catch {}
    sessionStorage.clear();
    localStorage.removeItem('auth_role');
    localStorage.removeItem('printer_monitor_unit');
    setAuthToken(null);

    AppState.userRole = 'operator';
    AppState.activeUnitFilter = '';
    AppState.activeFloorFilter = '';
    AppState.locationFilter = '';
    AppState.collapsedFloors.clear();

    const rememberedUser = localStorage.getItem('hefesto_remember_username');
    if (DOM.adminUserInput) DOM.adminUserInput.value = rememberedUser || '';
    if (DOM.adminPasswordInput) DOM.adminPasswordInput.value = '';
    if (DOM.adminRememberInput) DOM.adminRememberInput.checked = Boolean(rememberedUser);

    if (DOM.tabLoginOperator) DOM.tabLoginOperator.classList.add('active');
    if (DOM.tabLoginAdmin) DOM.tabLoginAdmin.classList.remove('active');
    if (DOM.formLoginUnit) DOM.formLoginUnit.style.display = 'block';
    if (DOM.formLoginAdmin) DOM.formLoginAdmin.style.display = 'none';
    if (DOM.loginOverlay) {
      DOM.loginOverlay.classList.remove('admin-mode');
      DOM.loginOverlay.classList.add('active');
      setLoginMode('operator');
    }
    renderAllViews();
    showToast('Sessão encerrada com sucesso.', 'info');
  };

  if (DOM.btnLogout) {
    DOM.btnLogout.addEventListener('click', handleLogout);
  }

  // Menus suspensos (Ferramentas, ações por linha)
  setupMenus();

  if (DOM.btnExportInkCsvHeader) {
    DOM.btnExportInkCsvHeader.addEventListener('click', exportInkReportCsv);
  }

  if (DOM.btnExportRechargesCsvHeader) {
    DOM.btnExportRechargesCsvHeader.addEventListener('click', exportRechargesReportCsv);
  }

  if (DOM.btnExportIntegrationCsvHeader) {
    DOM.btnExportIntegrationCsvHeader.addEventListener('click', exportInitialIntegrationReportCsv);
  }

  if (DOM.overviewUnitFilter) {
    DOM.overviewUnitFilter.addEventListener('change', (e) => {
      AppState.activeUnitFilter = e.target.value;
      AppState.activeFloorFilter = '';
      AppState.locationFilter = '';
      AppState.collapsedFloors.clear();
      const u = AppState.units.find(x => x.id === e.target.value);
      AppState.forecastUnitFilter = u ? u.name : '';
      if (DOM.forecastUnitSelect) DOM.forecastUnitSelect.value = AppState.forecastUnitFilter;
      updateHeaderRoleAndUnit();
      populateDropdownFilters();
      renderOverviewTab();
      if (AppState.userRole === 'admin' && AppState.activeAdminTab === 'forecast') {
        updateForecastKPIs(AppState.forecastUnitFilter);
        renderForecastTable();
      }
    });
  }

  // Seletor de Região no Cabeçalho (Administrador)
  if (DOM.overviewRegionPills) {
    DOM.overviewRegionPills.querySelectorAll('.region-pill').forEach(btn => {
      btn.addEventListener('click', () => setDashboardRegion(btn.dataset.region || 'all'));
    });
  }

  function resetAllFilters() {
    AppState.searchQuery = '';
    AppState.locationFilter = '';
    AppState.activeFloorFilter = '';
    AppState.collapsedFloors.clear();
    AppState.overviewFilter = 'all';
    if (DOM.searchInput) DOM.searchInput.value = '';
    if (DOM.searchClearBtn) DOM.searchClearBtn.style.display = 'none';
    if (DOM.searchKeycap) DOM.searchKeycap.style.display = 'inline-flex';
    if (DOM.filterLocationSelect) DOM.filterLocationSelect.value = '';
    syncOverviewFilterUi();
    showToast('Filtros redefinidos para visualização completa', 'info');
    const scoped = getScopedPrinters();
    renderFloorNavPills(scoped);
    updateLocationFilterOptions();
    renderMyPrinters(scoped);
  }

  // Faixa de status: clicar filtra o inventário; clicar de novo remove o filtro
  document.querySelectorAll('.status-strip-item[data-filter]').forEach(item => {
    item.addEventListener('click', () => {
      const filter = item.dataset.filter;
      AppState.overviewFilter = AppState.overviewFilter === filter ? 'all' : filter;
      syncOverviewFilterUi();
      renderMyPrinters(getScopedPrinters());
    });
  });

  DOM.searchInput.addEventListener('input', (e) => {
    AppState.searchQuery = e.target.value;
    const hasText = e.target.value.trim().length > 0;
    if (DOM.searchClearBtn) DOM.searchClearBtn.style.display = hasText ? 'flex' : 'none';
    if (DOM.searchKeycap) DOM.searchKeycap.style.display = hasText ? 'none' : 'inline-flex';
    renderMyPrinters(getScopedPrinters());
  });

  if (DOM.searchClearBtn) {
    DOM.searchClearBtn.addEventListener('click', () => {
      DOM.searchInput.value = '';
      AppState.searchQuery = '';
      DOM.searchClearBtn.style.display = 'none';
      if (DOM.searchKeycap) DOM.searchKeycap.style.display = 'inline-flex';
      DOM.searchInput.focus();
      renderMyPrinters(getScopedPrinters());
    });
  }

  if (DOM.myPrintersListBody) {
    DOM.myPrintersListBody.addEventListener('click', (e) => {
      const btnClear = e.target.closest('#btn-clear-empty-filters');
      if (btnClear) {
        resetAllFilters();
        return;
      }

      const floorHeader = e.target.closest('.floor-section-header');
      if (floorHeader) {
        const floor = floorHeader.dataset.floor;
        if (floor) {
          if (AppState.collapsedFloors.has(floor)) {
            AppState.collapsedFloors.delete(floor);
          } else {
            AppState.collapsedFloors.add(floor);
          }
          const isCollapsed = AppState.collapsedFloors.has(floor);
          floorHeader.classList.toggle('collapsed', isCollapsed);
          document.querySelectorAll(`tr[data-floor-row="${floor}"]`).forEach(row => {
            row.classList.toggle('floor-row-collapsed', isCollapsed);
          });
        }
      }
    });
  }

  DOM.filterLocationSelect.addEventListener('change', (e) => {
    AppState.locationFilter = e.target.value;
    renderMyPrinters(getScopedPrinters());
  });

  DOM.sortFleetSelect.addEventListener('change', (e) => {
    AppState.sortBy = e.target.value;
    renderMyPrinters(getScopedPrinters());
  });

  if (DOM.btnManageUnitsHeader) {
    DOM.btnManageUnitsHeader.addEventListener('click', openManageUnitsModal);
  }
  if (DOM.btnCloseModalManageUnits) {
    DOM.btnCloseModalManageUnits.addEventListener('click', closeManageUnitsModal);
  }
  if (DOM.btnCloseModalManageUnitsBtn) {
    DOM.btnCloseModalManageUnitsBtn.addEventListener('click', closeManageUnitsModal);
  }
  if (DOM.btnOpenCreateUnitInsideManage) {
    DOM.btnOpenCreateUnitInsideManage.addEventListener('click', () => {
      closeManageUnitsModal();
      openQuickUnitModal();
    });
  }

  DOM.btnCloseModalForm.addEventListener('click', closeModalForm);
  DOM.btnCancelModalForm.addEventListener('click', closeModalForm);
  DOM.printerForm.addEventListener('submit', handlePrinterFormSubmit);

  const btnSyncInitial = document.getElementById('btn-sync-initial-live');
  if (btnSyncInitial) {
    btnSyncInitial.addEventListener('click', () => {
      const printerId = DOM.formId.value.trim();
      const status = AppState.statusData.get(printerId);
      const liveCount = status?.info?.pageCount;
      if (typeof liveCount === 'number' && liveCount > 0) {
        if (DOM.formInitialPageCount) {
          DOM.formInitialPageCount.value = liveCount;
          showToast(`Marco inicial ajustado para o contador físico atual: ${liveCount.toLocaleString('pt-BR')} pág.`, 'info');
        }
      } else {
        showToast('Contador físico da impressora não disponível no momento.', 'warning');
      }
    });
  }

  if (DOM.btnDetectPrinterMac) {
    DOM.btnDetectPrinterMac.addEventListener('click', handleDetectMacFromForm);
  }

  DOM.btnQuickNewUnit.addEventListener('click', openQuickUnitModal);
  DOM.btnCloseModalUnit.addEventListener('click', closeQuickUnitModal);
  DOM.btnCancelModalUnit.addEventListener('click', closeQuickUnitModal);
  DOM.unitForm.addEventListener('submit', async (e) => {
    await handleUnitFormSubmit(e);
    renderManageUnitsList();
  });



  // Modal Subir Planilha de Impressoras
  if (DOM.btnImportSheetHeader) {
    DOM.btnImportSheetHeader.addEventListener('click', openImportSheetModal);
  }
  if (DOM.btnCloseModalSheet) {
    DOM.btnCloseModalSheet.addEventListener('click', closeImportSheetModal);
  }
  if (DOM.btnCancelModalSheet) {
    DOM.btnCancelModalSheet.addEventListener('click', closeImportSheetModal);
  }
  if (DOM.btnConfirmImportSheet) {
    DOM.btnConfirmImportSheet.addEventListener('click', confirmImportSheet);
  }
  if (DOM.tabSheetFile) {
    DOM.tabSheetFile.addEventListener('click', () => switchSheetEntryTab('file'));
  }
  if (DOM.tabSheetPaste) {
    DOM.tabSheetPaste.addEventListener('click', () => switchSheetEntryTab('paste'));
  }
  if (DOM.btnParsePasted) {
    DOM.btnParsePasted.addEventListener('click', handleSheetPaste);
  }

  if (DOM.sheetDropzone) {
    DOM.sheetDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      DOM.sheetDropzone.classList.add('drag-over');
    });
    DOM.sheetDropzone.addEventListener('dragleave', () => {
      DOM.sheetDropzone.classList.remove('drag-over');
    });
    DOM.sheetDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      DOM.sheetDropzone.classList.remove('drag-over');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleSheetFile(files[0]);
      }
    });
    DOM.sheetDropzone.addEventListener('click', (e) => {
      if (e.target !== DOM.sheetFileInput && e.target.id !== 'btn-browse-sheet') {
        DOM.sheetFileInput?.click();
      }
    });
  }
  if (DOM.btnBrowseSheet) {
    DOM.btnBrowseSheet.addEventListener('click', (e) => {
      e.stopPropagation();
      DOM.sheetFileInput?.click();
    });
  }
  if (DOM.sheetFileInput) {
    DOM.sheetFileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleSheetFile(file);
    });
  }
  if (DOM.btnSheetQuickNewUnit) {
    DOM.btnSheetQuickNewUnit.addEventListener('click', () => openQuickUnitModal());
  }
  if (DOM.sheetDefaultUnit) {
    DOM.sheetDefaultUnit.addEventListener('change', (e) => {
      if (e.target.value === '__NEW_FOLDER__') {
        e.target.value = '';
        openQuickUnitModal();
      }
    });
  }

  if (DOM.optRechargeFullCard) {
    DOM.optRechargeFullCard.addEventListener('click', () => setRechargeTypeOption('full'));
  }
  if (DOM.optRechargePartialCard) {
    DOM.optRechargePartialCard.addEventListener('click', () => setRechargeTypeOption('partial'));
  }
  if (DOM.btnCloseModalRecharge) {
    DOM.btnCloseModalRecharge.addEventListener('click', closeManualRechargeModal);
  }
  if (DOM.btnCancelModalRecharge) {
    DOM.btnCancelModalRecharge.addEventListener('click', closeManualRechargeModal);
  }
  if (DOM.formManualRecharge) {
    DOM.formManualRecharge.addEventListener('submit', handleManualRechargeSubmit);
  }

  // Modal Edição Rápida de Instalação Física
  if (DOM.btnCloseModalInstalled) {
    DOM.btnCloseModalInstalled.addEventListener('click', closeEditInstalledAtModal);
  }
  if (DOM.btnCancelModalInstalled) {
    DOM.btnCancelModalInstalled.addEventListener('click', closeEditInstalledAtModal);
  }
  if (DOM.formEditInstalledAt) {
    DOM.formEditInstalledAt.addEventListener('submit', handleEditInstalledAtSubmit);
  }

  if (DOM.toggleUnitRechargesBtn && DOM.unitRecentRechargesList && DOM.btnToggleUnitRechargesText) {
    DOM.toggleUnitRechargesBtn.addEventListener('click', () => {
      const isHidden = DOM.unitRecentRechargesList.style.display === 'none';
      DOM.unitRecentRechargesList.style.display = isHidden ? 'flex' : 'none';
      DOM.btnToggleUnitRechargesText.textContent = isHidden ? 'Ocultar' : 'Mostrar';
      DOM.toggleUnitRechargesBtn.setAttribute('aria-expanded', String(isHidden));
    });
  }

  // Abas Administrativas
  if (DOM.btnTabPrinters) {
    DOM.btnTabPrinters.addEventListener('click', () => switchAdminTab('printers'));
  }
  if (DOM.btnTabForecast) {
    DOM.btnTabForecast.addEventListener('click', () => switchAdminTab('forecast'));
  }

  // Filtros da aba de Previsibilidade
  if (DOM.forecastSearchInput) {
    DOM.forecastSearchInput.addEventListener('input', (e) => {
      AppState.forecastSearch = e.target.value;
      renderForecastTable();
    });
  }
  if (DOM.forecastUnitSelect) {
    DOM.forecastUnitSelect.addEventListener('change', (e) => {
      AppState.forecastUnitFilter = e.target.value;
      renderForecastTable();
    });
  }
  if (DOM.forecastWorkloadSelect) {
    DOM.forecastWorkloadSelect.addEventListener('change', (e) => {
      AppState.forecastWorkloadFilter = e.target.value;
      renderForecastTable();
    });
  }
  if (DOM.forecastTimeFilter) {
    DOM.forecastTimeFilter.addEventListener('change', (e) => {
      AppState.forecastTimeFilter = e.target.value;
      renderForecastTable();
    });
  }
  if (DOM.btnExportForecastCsv) {
    DOM.btnExportForecastCsv.addEventListener('click', exportForecastReportCsv);
  }

  DOM.btnCloseDrawerDetail.addEventListener('click', closePrinterDetailDrawer);
  DOM.btnDetailClose.addEventListener('click', closePrinterDetailDrawer);
  DOM.btnDetailRefresh.addEventListener('click', async () => {
    if (currentDrawerPrinterId) {
      if (DOM.btnDetailRefresh) DOM.btnDetailRefresh.disabled = true;
      try {
        await refreshSinglePrinter(currentDrawerPrinterId);
        openPrinterDetailDrawer(currentDrawerPrinterId);
      } catch (e) {
        // Silencioso se refreshSinglePrinter já exibiu toast
      } finally {
        if (DOM.btnDetailRefresh) DOM.btnDetailRefresh.disabled = false;
      }
    }
  });
  DOM.btnDetailEdit.addEventListener('click', () => {
    if (currentDrawerPrinterId && AppState.userRole === 'admin') {
      openEditPrinterModal(currentDrawerPrinterId);
    }
  });
  DOM.btnDetailDelete.addEventListener('click', () => {
    if (currentDrawerPrinterId && AppState.userRole === 'admin') {
      const p = AppState.printers.find(x => x.id === currentDrawerPrinterId);
      confirmDeletePrinter(currentDrawerPrinterId, p ? (p.location || p.name) : 'Impressora');
    }
  });

  if (DOM.btnScrollTop) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 200) {
        DOM.btnScrollTop.classList.add('visible');
      } else {
        DOM.btnScrollTop.classList.remove('visible');
      }
    }, { passive: true });

    DOM.btnScrollTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Backdrop individual para cada modal e gaveta
  const backdropMap = [
    { el: DOM.modalManualRecharge, close: closeManualRechargeModal },
    { el: DOM.modalPrinterForm, close: closeModalForm },
    { el: DOM.modalUnitForm, close: closeQuickUnitModal },
    { el: DOM.modalTestIp, close: closeTestIpModal },
    { el: DOM.modalManageUnits, close: closeManageUnitsModal },
    { el: DOM.modalImportSheet, close: closeImportSheetModal },
    { el: DOM.drawerPrinterDetail, close: closePrinterDetailDrawer }
  ];

  backdropMap.forEach(({ el, close }) => {
    if (el) {
      el.addEventListener('click', (e) => {
        if (e.target === el) {
          close();
        }
      });
    }
  });

  // Atalhos de Teclado Inteligentes (/ para focar busca, R para sincronizar e ESC em camadas)
  document.addEventListener('keydown', (e) => {
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

    if (e.key === '/' && !isInput) {
      e.preventDefault();
      if (DOM.tabViewForecast && DOM.tabViewForecast.style.display !== 'none' && DOM.forecastSearchInput) {
        DOM.forecastSearchInput.focus();
        DOM.forecastSearchInput.select();
      } else if (DOM.searchInput) {
        DOM.searchInput.focus();
        DOM.searchInput.select();
      }
    } else if ((e.key === 'r' || e.key === 'R') && !isInput && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      loadDashboardData(true, true);
    } else if (e.key === 'Escape') {
      if (closeOpenMenus(true)) {
        // menu suspenso fechado
      } else if (DOM.modalManualRecharge?.classList.contains('active')) {
        closeManualRechargeModal();
      } else if (DOM.modalPrinterForm?.classList.contains('active')) {
        closeModalForm();
      } else if (DOM.modalUnitForm?.classList.contains('active')) {
        closeQuickUnitModal();
      } else if (DOM.modalTestIp?.classList.contains('active')) {
        closeTestIpModal();
      } else if (DOM.modalManageUnits?.classList.contains('active')) {
        closeManageUnitsModal();
      } else if (DOM.modalImportSheet?.classList.contains('active')) {
        closeImportSheetModal();
      } else if (DOM.drawerPrinterDetail?.classList.contains('active')) {
        closePrinterDetailDrawer();
      }
    }
  });
}

/* ==========================================================================
   MENUS SUSPENSOS ACESSÍVEIS (Ferramentas e ações por linha)
   Estrutura: .menu > .menu-toggle + .menu-list[role=menu] > .menu-item[role=menuitem]
   ========================================================================== */
function getMenuItems(menu) {
  return Array.from(menu.querySelectorAll('.menu-list [role="menuitem"]:not([disabled])'));
}

// A lista usa position: fixed para não ser cortada por tabelas com rolagem.
function positionMenu(menu) {
  const toggle = menu.querySelector('.menu-toggle');
  const list = menu.querySelector('.menu-list');
  if (!toggle || !list) return;
  const margin = 8;
  const rect = toggle.getBoundingClientRect();
  const width = list.offsetWidth;
  const height = list.offsetHeight;
  let left = Math.min(rect.right - width, window.innerWidth - width - margin);
  left = Math.max(margin, left);
  let top = rect.bottom + 4;
  if (top + height > window.innerHeight - margin && rect.top - 4 - height >= margin) {
    top = rect.top - 4 - height;
  }
  list.style.left = `${left}px`;
  list.style.top = `${Math.max(margin, top)}px`;
}

function closeOpenMenus(restoreFocus = false) {
  const openMenus = document.querySelectorAll('.menu.open');
  openMenus.forEach(menu => {
    const toggle = menu.querySelector('.menu-toggle');
    const focusInside = menu.contains(document.activeElement);
    menu.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
    if (toggle && (restoreFocus || focusInside)) toggle.focus({ preventScroll: true });
  });
  return openMenus.length > 0;
}

function openMenu(menu, focusItem = null) {
  closeOpenMenus();
  menu.classList.add('open');
  menu.querySelector('.menu-toggle')?.setAttribute('aria-expanded', 'true');
  positionMenu(menu);
  if (focusItem) {
    const items = getMenuItems(menu);
    (focusItem === 'last' ? items[items.length - 1] : items[0])?.focus({ preventScroll: true });
  }
}

function setupMenus() {
  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('.menu-toggle');
    if (toggle) {
      const menu = toggle.closest('.menu');
      if (menu.classList.contains('open')) closeOpenMenus();
      else openMenu(menu, e.detail === 0 ? 'first' : null); // detail 0 = ativado pelo teclado
      return;
    }
    if (e.target.closest('.menu-item') || !e.target.closest('.menu-list')) closeOpenMenus();
  });

  document.addEventListener('keydown', (e) => {
    const menu = document.querySelector('.menu.open');
    if (!menu) {
      const toggle = e.target.closest?.('.menu-toggle');
      if (toggle && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        openMenu(toggle.closest('.menu'), e.key === 'ArrowUp' ? 'last' : 'first');
      }
      return;
    }

    const items = getMenuItems(menu);
    const index = items.indexOf(document.activeElement);
    const focusAt = (i) => items[(i + items.length) % items.length]?.focus({ preventScroll: true });

    if (e.key === 'ArrowDown') { e.preventDefault(); focusAt(index + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusAt(index < 0 ? -1 : index - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusAt(0); }
    else if (e.key === 'End') { e.preventDefault(); focusAt(-1); }
    else if (e.key === 'Tab') closeOpenMenus(true);
  });

  window.addEventListener('resize', () => closeOpenMenus());
  window.addEventListener('scroll', (e) => {
    if (!(e.target instanceof Element) || !e.target.closest('.menu-list')) closeOpenMenus();
  }, true);
}

/* ==========================================================================
   MODO DE ACESSO (OPERADOR / ADMINISTRADOR)
   ========================================================================== */
let currentLoginMode = 'operator'; // 'operator' (Hefesto) ou 'admin' (Hefesto ADM)
const APP_SEMVER = '1.0.0';
let systemVersionLoading = false;

function setLoginMode(mode) {
  currentLoginMode = mode;
  const versionDisplay = `Hefesto v${APP_SEMVER}`;
  DOM.tabLoginOperator?.setAttribute('aria-pressed', String(mode !== 'admin'));
  DOM.tabLoginAdmin?.setAttribute('aria-pressed', String(mode === 'admin'));
  if (mode === 'admin') {
    if (DOM.loginMainTitle) DOM.loginMainTitle.textContent = 'Hefesto';
    if (DOM.loginSystemTag) DOM.loginSystemTag.textContent = versionDisplay;
    if (DOM.loginMainDesc) DOM.loginMainDesc.textContent = 'Painel Administrativo • Gestão Global de Parques';
    document.title = 'Hefesto — Gestão e Administração TI';
  } else {
    if (DOM.loginMainTitle) DOM.loginMainTitle.textContent = 'Hefesto';
    if (DOM.loginSystemTag) DOM.loginSystemTag.textContent = versionDisplay;
    if (DOM.loginMainDesc) DOM.loginMainDesc.textContent = 'Painel de Impressoras • Gestão e Telemetria de Filial';
    document.title = 'Hefesto — Painel de Monitoramento de Impressoras';
  }
}

async function loadSystemVersion() {
  if (systemVersionLoading) return;
  systemVersionLoading = true;
  try {
    const res = await fetch('/api/system/version', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.version) {
        if (DOM.appVersionText) {
          DOM.appVersionText.textContent = `Hefesto v${data.version}`;
        }
        if (DOM.loginSystemTag) DOM.loginSystemTag.textContent = `Hefesto v${data.version}`;
      }
    }
  } catch (err) {
    // Preserva a última publicação conhecida se a conexão estiver indisponível.
  } finally {
    systemVersionLoading = false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await applyBranding();
  loadSystemVersion();
  setInterval(() => { if (!document.hidden) loadSystemVersion(); }, 300000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadSystemVersion(); });
  setupEventListeners();

  // Detecta se o Hefesto está rodando em modo Edge (Filial) ou Hub (Matriz)
  try {
    const sysMode = await API.getSystemMode();
    AppState.systemMode = sysMode.appMode || 'hub';
    AppState.isEdge = Boolean(sysMode.isEdge);
    AppState.edgeUnitName = sysMode.edgeUnitName || '';
    AppState.edgeUnitId = sysMode.edgeUnitId || '';
    AppState.hubUrl = sysMode.hubUrl || '';
    AppState.syncStatus = sysMode.syncStatus || null;

    if (AppState.isEdge) {
      applyEdgeModeUi();
    }
  } catch (err) {
    console.warn('[EdgeMode] Não foi possível consultar modo de operação:', err);
  }

  // Pré-preenche usuário lembrado caso exista no localStorage
  const rememberedUser = localStorage.getItem('hefesto_remember_username');
  if (rememberedUser && DOM.adminUserInput) {
    DOM.adminUserInput.value = rememberedUser;
    if (DOM.adminRememberInput) DOM.adminRememberInput.checked = true;
  }
  if (DOM.adminPasswordInput) DOM.adminPasswordInput.value = '';

  // Valida sessão com o backend antes de assumir papel de admin
  let activeSession = { authenticated: false, role: null };
  try {
    activeSession = await API.checkSession();
  } catch {}

  const savedUnit = sessionStorage.getItem('printer_monitor_unit') || localStorage.getItem('printer_monitor_unit');

  if (activeSession.authenticated && activeSession.role === 'admin') {
    // Administrador com sessão comprovada pelo backend
    AppState.userRole = 'admin';
    AppState.activeUnitFilter = AppState.isEdge ? AppState.edgeUnitName : '';
    AppState.activeFloorFilter = '';
    AppState.locationFilter = '';
    AppState.collapsedFloors.clear();
    sessionStorage.setItem('auth_role', 'admin');
    DOM.loginOverlay.classList.remove('admin-mode');
    DOM.loginOverlay.classList.remove('active');
    window.ReleaseNotes?.onLogin(`admin:${activeSession.username || 'admin'}`);
  } else {
    // Se não há sessão ativa de admin no backend, garante limpeza de flags locais de admin
    sessionStorage.removeItem('auth_role');
    localStorage.removeItem('auth_role');
    setAuthToken(null);

    if (AppState.isEdge && AppState.edgeUnitName) {
      // No modo Edge (Filial), já abre direto na unidade configurada da filial
      AppState.userRole = 'operator';
      AppState.activeUnitFilter = AppState.edgeUnitName;
      sessionStorage.setItem('auth_role', 'operator');
      sessionStorage.setItem('printer_monitor_unit', AppState.edgeUnitName);
      DOM.loginOverlay.classList.remove('active');
      window.ReleaseNotes?.onLogin(`operator:${AppState.edgeUnitName}`);
    } else if (savedUnit) {
      // Operador de filial com unidade selecionada
      AppState.userRole = 'operator';
      AppState.activeUnitFilter = savedUnit;
      sessionStorage.setItem('auth_role', 'operator');
      sessionStorage.setItem('printer_monitor_unit', savedUnit);
      DOM.loginOverlay.classList.remove('active');
      window.ReleaseNotes?.onLogin(`operator:${savedUnit}`);
    } else {
      // Primeiro acesso ou sessão deslogada
      AppState.userRole = 'operator';
      AppState.activeUnitFilter = '';
      DOM.loginOverlay.classList.add('active');
      setLoginMode('operator');
    }
  }

  await loadDashboardData(true);

  // Verificação de fundo rápida para recargas detectadas em tempo real (20 segundos)
  setInterval(() => {
    checkRecentRechargeEvents();
  }, 20000);

  // Se estiver em modo Edge, atualiza periodicamente o status da conexão com a Matriz
  if (AppState.isEdge) {
    setInterval(async () => {
      try {
        const sm = await API.getSystemMode();
        AppState.syncStatus = sm.syncStatus || null;
        updateEdgeSyncUi(AppState.syncStatus);
      } catch {}
    }, 15000);
  }

  window.DashboardRefresh.start({
    state: AppState, request: apiFetch,
    canRefresh: () => !DOM.loginOverlay?.classList.contains('active'),
    render: () => renderOverviewTab(true), timestamp: updateLastUpdatedTimestamp,
    failed: () => { if (DOM.lastUpdatedText) DOM.lastUpdatedText.title = 'Atualização da tela indisponível. As últimas leituras foram mantidas.'; }
  });
});
