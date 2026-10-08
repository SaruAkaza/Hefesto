// Curated manufacturer evidence. No inferred code ranges or firmware repairs.
const guide = (family, title, revision, modelReference) => ({
  title, revision, reviewedAt: '2026-10-08', modelReference,
  url: `https://publications.lexmark.com/publications/lexmark_hardware/${family}/UG/html/en/printer-error-codes-topic.html`
});
const smtp = { id: 'smtp-unconfigured', codes: ['72.01'], component: 'Configuração de e-mail',
  meaning: 'O envio de e-mail SMTP não foi configurado.',
  actions: ['Configurar o envio de e-mail conforme o guia. Se a função não for utilizada, o guia permite ocultar esse aviso; isso não configura o serviço.'] };
const clock = { id: 'printer-time', codes: ['71.4'], component: 'Data e hora',
  meaning: 'O relógio da impressora está incorreto.', actions: ['Conferir Data e hora nas preferências do dispositivo.'] };
const imaging = (component, recommendedCodes, requiredCodes) => [
  { id: 'imaging-life', codes: recommendedCodes, component,
    meaning: 'A vida recomendada foi ultrapassada; a mensagem recomenda substituição.',
    actions: ['Consultar o procedimento de substituição do componente no guia.'] },
  { id: 'imaging-resume', codes: requiredCodes, component,
    meaning: 'A mensagem solicita substituição para retomar a impressão.',
    actions: ['Consultar o procedimento de substituição do componente no guia.'] }
];

export const diagnosticCatalogData = {
  version: '1.0.0', reviewedAt: '2026-10-08', profiles: [
    { id: 'lexmark-xm3250', manufacturer: 'Lexmark', source: 'lexmark_ews', models: ['XM3250'],
      reference: {
        title: 'MB2650, MX622, XM3250 MFPs — User’s Guide', revision: 'September 2023', reviewedAt: '2026-10-08',
        url: 'https://publications.lexmark.com/publications/lexmark_hardware/MB2650_MX622_XM3250/UG/pdf/Lexmark_MB2650_MX622_XM3250_UserGuide_en.pdf#page=113',
        section: 'Understanding the printer menus — E-mail, pp. 111–113; Notifications, p. 76',
        sha256: 'f8254c0550179e5f78324e809dc4fa8cf0cfefd170be0c4b91a553d94abd38a7'
      },
      entries: [{ ...smtp, evidence: 'message_documented',
        messages: ['SMTP server not configured', 'SMTP server not set up', 'E-mail SMTP server not set up', 'Servidor SMTP não configurado',
          'E-mail SMTP server not set up. Contact system administrator', 'E-mail servidor SMTP não configurado. Contate o administrador do sistema'],
        limitation: 'O guia descreve o aviso e a configuração SMTP, mas não associa numericamente 72.01. A orientação exige também o texto observado; o código permanece sem interpretação numérica certificada.' }]
    },
    { id: 'lexmark-xm3350', manufacturer: 'Lexmark', source: 'lexmark_ews', models: ['XM3350'],
      reference: guide('MX53x_MX63x', 'MX532adwe, MX632adwe, XM3146, XM3346, XM3350 — User’s Guide', 'April 2026',
        'https://support.lexmark.com/content/dam/support/collateral/lexmark_hardware/mx53x_mx63x/ug/pdf/Lexmark_MX532_MX632_XM3350_XM3146_XM3346_UserGuide_en.pdf'),
      entries: [smtp, clock, ...imaging('Unidade de imagem', ['84.31', '84.32', '84.33'], ['84.41', '84.42', '84.43'])]
    },
    { id: 'lexmark-cx532', manufacturer: 'Lexmark', source: 'lexmark_ews', models: ['CX532', 'CX532ADWE'],
      reference: guide('CX53x_CX63x', 'CX532, CX635, XC2335 — User’s Guide', 'HTML; edição não indicada',
        'https://publications.lexmark.com/publications/lexmark_hardware/CX53x_CX63x/UG/html/en/wireless-support-topic.html'),
      entries: [smtp, clock, ...imaging('Kit de imagem', ['84.31', '84.33'], ['84.41', '84.43', '84.48'])]
    },
    { id: 'lexmark-cx735', manufacturer: 'Lexmark', source: 'lexmark_ews', models: ['CX735', 'CX735ADSE'],
      reference: guide('CX73x', 'CX730, CX735, CX737, XC4342, XC4352 — User’s Guide', 'July 2024',
        'https://support.lexmark.com/content/dam/support/collateral/lexmark_hardware/cx73x/ug/pdf/Lexmark_CX730_CX735_CX737_XC4342_XC4352_UserGuide_en.pdf#page=343'),
      entries: [smtp, { id: 'maintenance-life', codes: ['80.31'], component: 'Kit de manutenção do fusor',
        meaning: 'A vida recomendada do kit de manutenção foi ultrapassada.',
        actions: ['Consultar o kit compatível e o procedimento do fabricante.'] }]
    }
  ]
};
