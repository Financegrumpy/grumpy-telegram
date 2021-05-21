const express = require('express')
const bodyParser = require('body-parser')
const fetch = require('node-fetch')
const fileSystem = require('fs')
const path = require('path')
const TelegramBot = require('node-telegram-bot-api')
const app = express()
const port = process.env.PORT || 3000

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

const telegramToken = process.env.TELEGRAM_BOT_TOKEN
const ethplorerApiKey = process.env.ETHPLORER_API_KEY

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(telegramToken, {polling: false})

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.get('/public-key', (req, res) => {
  const filePath = path.join(__dirname, 'crt.pem');
  const stat = fileSystem.statSync(filePath);
  res.writeHead(200, {
    'Content-Type': 'application/x-x509-ca-cert',
    'Content-Length': stat.size
  });
  const readStream = fileSystem.createReadStream(filePath);
  readStream.pipe(res);
})

const production  = 'https://grumpy-telegram.herokuapp.com';
const development = 'tunneled url goes here';
const url = (process.env.NODE_ENV ? production : development);
bot.setWebHook(url, {
  certificate: '/crt.pem', // Path to your crt.pem
});

const getGrumpyPrice = (priceInfo) => {
  const numDecimals = 9
  return Number.parseFloat(priceInfo.rate).toFixed(numDecimals)
}

// could be useful in the future so I am leaving this here for now
// const numberWithCommas = (number) => {
//   return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
// }

const getDateFromTimestamp = (timestamp) => {
  const milliseconds = timestamp * 1000
  const date = new Date(milliseconds)
  return date.toLocaleString("en-US", {timeZoneName: "short"})
}

let recentlySeenMessageIds = []

const haveNotSeenMessageBefore = (message) => {
  console.log('Have I seen this before?')
  console.log(recentlySeenMessageIds.includes(message.message_id))
  if (recentlySeenMessageIds.includes(message.message_id)) return false
  recentlySeenMessageIds.push(message.message_id)
  return true
}


app.post('/', async (req, res) => {
  const payload = req.body
  if (payload.message && payload.message.text && payload.message.text.startsWith('/price') && haveNotSeenMessageBefore(payload.message)) {
    const msg = payload.message
    const chatId = msg.chat.id
    
    const grumpyTokenContract = '0x93b2fff814fcaeffb01406e80b4ecd89ca6a021b'
    let resp, tokenInfo, botMsgSent
    
    try {
      let tokenInfoRequest = await fetch(`https://api.ethplorer.io/getTokenInfo/${grumpyTokenContract}?apiKey=${ethplorerApiKey}`)
      tokenInfo = await tokenInfoRequest.json()
    } catch (err) {
      console.log('error', err)
      return botMsgSent = await bot.sendMessage(chatId, "🙅 There were problems fetching the latest $GRUMPY token info. Figures...");
    }
    
    resp = '💵 Price: ' + getGrumpyPrice(tokenInfo.price) + '\n' +
           '💎 🤘 Holders: ' + tokenInfo.holdersCount + '\n' +
           '⏰ Last Updated: ' + getDateFromTimestamp(tokenInfo.lastUpdated)
    try {
      botMsgSent = await bot.sendMessage(chatId, resp);
    } catch (err) {
      console.log('error', err)
    }
  }
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})