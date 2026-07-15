// ---------------------------------------------------------------------------
// 獨立驗證腳本：只測 eSIM Access 批發 API，完全不碰 ECPay / 金流。
//
// 用法：
//   node scripts/checkWholesale.js list                我可以拿到方案清單嗎？
//   node scripts/checkWholesale.js order <packageCode>  下一筆真實測試訂單（會真的扣錢！）
//   node scripts/checkWholesale.js query <orderNo>      查剛剛那筆訂單的 QR/LPA
//   node scripts/checkWholesale.js balance              查錢包餘額
//
// 執行前先確認 .env 裡已經填好 ESIMACCESS_ACCESS_CODE
// ---------------------------------------------------------------------------
require('dotenv').config();
const esim = require('../src/esimAccessClient');

const [, , cmd, arg] = process.argv;

function printResult(label, data) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  if (!process.env.ESIMACCESS_ACCESS_CODE) {
    console.error('❌ ESIMACCESS_ACCESS_CODE 未設定，先去 .env 填入後台拿到的 Access Code');
    process.exit(1);
  }

  try {
    if (cmd === 'list') {
      console.log('呼叫 listPackages() ...(驗證 Access Code 是否有效、/package/list 路徑是否正確)');
      const packages = await esim.listPackages();
      printResult('可用方案', packages);
      console.log(`\n✅ 成功！共取得 ${Array.isArray(packages) ? packages.length : '未知數量'} 筆方案資料。`);
      console.log('把你要賣的方案的 packageCode 跟實際批發價，貼回 src/catalog.js。');

    } else if (cmd === 'balance') {
      const balance = await esim.getBalance();
      printResult('錢包餘額', balance);

    } else if (cmd === 'order') {
      if (!arg) {
        console.error('❌ 用法: node scripts/checkWholesale.js order <packageCode>');
        process.exit(1);
      }
      console.log(`⚠️  這會下一筆「真實」訂單，會真的扣掉你錢包裡的餘額！`);
      console.log(`   packageCode = ${arg}`);
      const transactionId = `test-${Date.now()}`;
      const result = await esim.orderPackage({ transactionId, packageCode: arg, count: 1 });
      printResult('下單結果', result);
      console.log(`\n✅ 下單成功！orderNo = ${result.orderNo}`);
      console.log(`接著跑: node scripts/checkWholesale.js query ${result.orderNo}`);

    } else if (cmd === 'query') {
      if (!arg) {
        console.error('❌ 用法: node scripts/checkWholesale.js query <orderNo>');
        process.exit(1);
      }
      const details = await esim.queryEsim({ orderNo: arg });
      printResult('eSIM 詳情', details);
      if (details.qrCode || details.ac) {
        console.log('\n✅ 成功拿到 QR/LPA！代表下單 → 查詢這條路全部打通了。');
      }

    } else {
      console.log(`用法:
  node scripts/checkWholesale.js list
  node scripts/checkWholesale.js order <packageCode>
  node scripts/checkWholesale.js query <orderNo>
  node scripts/checkWholesale.js balance`);
    }
  } catch (err) {
    console.error('\n❌ 失敗:', err.message);
    if (err.raw) console.error('原始回應:', JSON.stringify(err.raw, null, 2));
    process.exit(1);
  }
}

main();
