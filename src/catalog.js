// ---------------------------------------------------------------------------
// Your shop's plan catalog: maps a simple planId you control to the exact
// eSIM Access packageCode + wholesale price you'll be charged.
//
// Get real packageCode / price values by calling listPackages() (see
// esimAccessClient.js) once you have a live reseller account, or from the
// eSIM Access management portal. The values below are placeholders.
//
// price/amount are in eSIM Access's smallest currency unit convention seen
// in their docs (e.g. USD cents x 100 => "70000" = $7.00). Confirm the exact
// unit for your account before going live - it's shown next to each package
// when you call listPackages().
// ---------------------------------------------------------------------------
const CATALOG = {
  jp_5gb_8d: {
    name: '日本標準流量 5GB / 8天',
    packageCode: 'JP_5_8',   // <-- replace with the real packageCode from eSIM Access
    wholesalePriceTwd: 130,   // what eSIM Access charges you
    retailPriceTwd: 180,      // what you charge the customer
    region: 'jp', regionLabel: '日本', flag: '🇯🇵', gb: '5', days: '8',
  },
  jp_10gb_30d: {
    name: '日本長天期 10GB / 30天',
    packageCode: 'JP_10_30',
    wholesalePriceTwd: 290,
    retailPriceTwd: 390,
    region: 'jp', regionLabel: '日本', flag: '🇯🇵', gb: '10', days: '30',
  },
  jp_unlimited_15d: {
    name: '日本吃到飽 不限量(FUP 2GB/日) / 15天',
    packageCode: 'JP_UNL_15',
    wholesalePriceTwd: 340,
    retailPriceTwd: 450,
    region: 'jp', regionLabel: '日本', flag: '🇯🇵', gb: 'unlimited', days: '15',
  },
  kr_5gb_8d: {
    name: '韓國標準流量 5GB / 8天',
    packageCode: 'KR_5_8',
    wholesalePriceTwd: 120,
    retailPriceTwd: 170,
    region: 'kr', regionLabel: '韓國', flag: '🇰🇷', gb: '5', days: '8',
  },
  kr_10gb_20d: {
    name: '韓國長天期 10GB / 20天',
    packageCode: 'KR_10_20',
    wholesalePriceTwd: 270,
    retailPriceTwd: 360,
    region: 'kr', regionLabel: '韓國', flag: '🇰🇷', gb: '10', days: '20',
  },
  kr_unlimited_10d: {
    name: '韓國吃到飽 不限量(FUP 1.5GB/日) / 10天',
    packageCode: 'KR_UNL_10',
    wholesalePriceTwd: 300,
    retailPriceTwd: 400,
    region: 'kr', regionLabel: '韓國', flag: '🇰🇷', gb: 'unlimited', days: '10',
  },
  sea_10gb_30d: {
    name: '東南亞多國通用 10GB / 30天',
    packageCode: 'SEA_10_30',
    wholesalePriceTwd: 320,
    retailPriceTwd: 420,
    region: 'sea', regionLabel: '東南亞', flag: '🌏', gb: '10', days: '30',
  },
  th_5gb_15d: {
    name: '泰國單國流量 5GB / 15天',
    packageCode: 'TH_5_15',
    wholesalePriceTwd: 160,
    retailPriceTwd: 220,
    region: 'sea', regionLabel: '東南亞', flag: '🇹🇭', gb: '5', days: '15',
  },
  vn_5gb_15d: {
    name: '越南單國流量 5GB / 15天',
    packageCode: 'VN_5_15',
    wholesalePriceTwd: 155,
    retailPriceTwd: 210,
    region: 'sea', regionLabel: '東南亞', flag: '🇻🇳', gb: '5', days: '15',
  },
};

function getPlan(planId) {
  return CATALOG[planId] || null;
}

// Safe, public-facing view of the catalog for the storefront - only what the
// frontend needs to render plan cards, never wholesalePriceTwd or packageCode.
function listPublicPlans() {
  return Object.entries(CATALOG).map(([planId, p]) => ({
    planId,
    name: p.name,
    region: p.region,
    regionLabel: p.regionLabel,
    flag: p.flag,
    gb: p.gb,
    days: p.days,
    priceTwd: p.retailPriceTwd,
  }));
}

module.exports = { CATALOG, getPlan, listPublicPlans };
