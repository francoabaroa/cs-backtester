const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ExchangeSchema = new Schema({
  name: {type: String, unique: true},
  currenciesSupported: [Schema.Types.Mixed],
});

module.exports = mongoose.model('Exchange', ExchangeSchema);

// https://api.pro.coinbase.com/products - DONE

// https://www.binance.com/api/v1/exchangeInfo - DONE
// https://www.binance.com/api/v3/ticker/price - DONE

// https://bittrex.com/api/v1.1/public/getcurrencies - DONE
// https://api.bitfinex.com/v1/symbols - DONE
// https://api.hitbtc.com/api/2/public/currency - DONE
// https://api.kucoin.com/v1/market/open/symbols - DONE
// https://api.huobi.pro/v1/common/currencys - DONE
// https://www.cryptopia.co.nz/api/GetCurrencies - DONE
// https://poloniex.com/public?command=returnCurrencies