'use strict'
const Promise = require('bluebird')

require('util').inherits(SteamBot, require('events').EventEmitter)

module.exports = SteamBot

SteamBot.ESteamBotStatus = require('./ESteamBotStatus')

function SteamBot(options) {
  this.options = options || {}

  const defaultOptions = {
    domain: 'example.com',
    loginTimeout: 1000 * 60,
    loginCheckInterval: 1000 * 60 * 10,
    lang: 'en'
  }

  for (const i in defaultOptions) {
    if (!defaultOptions.hasOwnProperty(i)) {
      continue
    }

    if (typeof this.options[i] === 'undefined') {
      this.options[i] = defaultOptions[i]
    }
  }

  this.steamid = null
  this.account = this.options.account
  this.password = this.options.password
  this.personaname = null

  this.status = SteamBot.ESteamBotStatus.Initialed

  this.client = new Object()
  this.store = new Object()

  this._bindClientHandler()
}

SteamBot.prototype._bindClientHandler = function() {
  this.client.on('loggedOn', () => {
    this.steamid = this.client.steamID.getSteamID64()
    this.status = SteamBot.ESteamBotStatus.LoggedOn
    this.client.setPersona(SteamUser.Steam.EPersonaState.Online)
    this.emit('steamConnected', this.steamid)
  })

  this.client.on('error', err => {
    this.status = SteamBot.ESteamBotStatus.LoggedError
    this.emit('clientError', err)
  })
}

SteamBot.prototype.logOn = function() {

  const logOnOptions = {
    accountName: this.account,
    password: this.password
  }

  this.client.logOn(logOnOptions)
}

SteamBot.prototype.logOff = function() {
  this.client.logOff()
}

SteamBot.prototype.addFriend = function(steamid) {
  this.client.addFriend(steamid)
}

SteamBot.prototype.removeFriends = function(steamids) {
  for (let i = 0; i < steamids.length; i++) {
    this.client.removeFriend(steamids[i])
  }
}

SteamBot.prototype.checkoutR6Pay = function(checkoutUrl) {
  return this.store.checkoutR6Pay(checkoutUrl)
}

SteamBot.prototype.payOrder = function(transactionId, returnurl) {
  return this.store.payOrder(transactionId, returnurl)
}

SteamBot.prototype.addToCart = function(subid) {
  return this.store.addToCart(subid)
}

SteamBot.prototype.checkoutGiftCart = function(cart, steamid) {
  return this.store.checkoutGiftCart(cart, steamid)
}

SteamBot.prototype.initTransaction = function(
  cart,
  steamid,
  giftMessage,
  gifteeName,
  signature,
  sentiment,
  country
) {
  return this.store.initTransaction(
    cart,
    steamid,
    giftMessage,
    gifteeName,
    signature,
    sentiment,
    country
  )
}

SteamBot.prototype.getFinalPrice = function(cart, transId) {
  return this.store.getFinalPrice(cart, transId)
}

SteamBot.prototype.finalizeTransaction = function(transId) {
  return this.store.finalizeTransaction(transId)
}

SteamBot.prototype.getTransactionStatus = function(transId) {
  return this.store.getTransactionStatus(transId)
}

SteamBot.prototype.forgetCart = function() {
  return this.store.forgetCart()
}

SteamBot.prototype.getFriendRelationship = function(steamid) {
  if (this.client.myFriends.hasOwnProperty(steamid)) {
    return this.client.myFriends[steamid]
  }
  return null
}

SteamBot.prototype.addBundleToCart = function(subid) {
  return this.store.addBundleToCart(subid)
}

SteamBot.prototype.changeWalletCountry = function(country) {
  return this.store.changeWalletCountry(country)
}

SteamBot.prototype.sendGift = async function(
  subids,
  bundles,
  steamid,
  giftMessage,
  gifteeName,
  signature,
  sentiment
) {
  let cart = null
  try {
    this.forgetCart()
    for (let i = 0; i < subids.length; i++) {
      if (subids[i]) {
        cart = await this.addToCart(subids[i])
      }
    }
    for (let n = 0; n < bundles.length; n++) {
      if (bundles[n]) {
        cart = await this.addBundleToCart(bundles[n])
      }
    }
    if (!cart) {
      throw new Error('Cart Error')
    }

    await this.checkoutGiftCart(cart, steamid)
    const transId = await this.initTransaction(
      cart,
      steamid,
      giftMessage,
      gifteeName,
      signature,
      sentiment
    )

    await this.finalizeTransaction(transId)
    await Promise.delay(2000)
    const transStatus = await this.getTransactionStatus(transId)
 
    if (
      transStatus.hasOwnProperty('success') &&
      (transStatus['success'] === 1 || transStatus['success'] === 22)
    ) {
      return true
    }
    this.forgetCart()
    await Promise.delay(500)
    throw new Error('Gift Error')
  } catch (err) {
    this.forgetCart()
    throw err
  }
}
