// Classificação técnica de modelos. Nenhum preço ou contrato é distribuído.
const models = [
  [
    "Lexmark",
    "MX522",
    "mono"
  ],
  [
    "Lexmark",
    "MX622",
    "mono"
  ],
  [
    "Lexmark",
    "MX611",
    "mono"
  ],
  [
    "Lexmark",
    "MS421",
    "mono"
  ],
  [
    "Lexmark",
    "MS610",
    "mono"
  ],
  [
    "Lexmark",
    "MS622",
    "mono"
  ],
  [
    "Lexmark",
    "MX421",
    "mono"
  ],
  [
    "Lexmark",
    "MX711",
    "mono"
  ],
  [
    "Lexmark",
    "MS521",
    "mono"
  ],
  [
    "Lexmark",
    "MX722",
    "mono"
  ],
  [
    "Lexmark",
    "MS415",
    "mono"
  ],
  [
    "Lexmark",
    "XM3250",
    "mono"
  ],
  [
    "Lexmark",
    "XM3350",
    "mono"
  ],
  [
    "Lexmark",
    "XM1246",
    "mono"
  ],
  [
    "Lexmark",
    "M3350",
    "mono"
  ],
  [
    "Lexmark",
    "MS431",
    "mono"
  ],
  [
    "Brother",
    "HL L6412",
    "mono"
  ],
  [
    "Brother",
    "HL L6912",
    "mono"
  ],
  [
    "Brother",
    "HL-L5212",
    "mono"
  ],
  [
    "Epson",
    "M1180",
    "mono"
  ],
  [
    "Epson",
    "WF-M5799",
    "mono"
  ],
  [
    "Epson",
    "WF-M5899",
    "mono"
  ],
  [
    "Lexmark",
    "CX522",
    "color"
  ],
  [
    "Lexmark",
    "CX725",
    "color"
  ],
  [
    "Lexmark",
    "C950",
    "color"
  ],
  [
    "Lexmark",
    "X952",
    "color"
  ]
];
export const PRINTING_COST_REFERENCE = Object.freeze({
  name: 'Configuração local', period: null, status: 'unconfigured', units: []
});
export const PRINTING_COST_CATALOG = Object.freeze(models.map(([brand,model,type]) => Object.freeze({
  id: `model-${model.toLowerCase().replace(/[^a-z0-9]/g,'')}`, brand, model, type,
  pageRate: null, monthlyRent: null, referencePeriod: null,
  billingRule: type === 'color' ? 'unresolved' : 'single'
})));
const normalize = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
export function referenceForModel(value) {
  const text = String(value || '').toUpperCase().replace(/[^A-Z0-9\s]/g,'').trim();
  const entry = PRINTING_COST_CATALOG.find(c => {
    const token = normalize(c.model).replace(/^HLL/,'HL\\s*L').replace(/^WFM/,'WF\\s*M');
    return new RegExp(`^(?:(?:LEXMARK|BROTHER|EPSON)\\s*)?${token}(?![0-9])`).test(text);
  });
  if (!entry) return null;
  return {model: `${entry.brand} ${entry.model}`, deviceType: entry.type,
    pageRateUnits: null, monthlyRentCents: null, monthlyRentMinCents: null,
    monthlyRentMaxCents: null, source: 'Classificação do modelo; preços não configurados',
    generalMonoReference: false};
}
