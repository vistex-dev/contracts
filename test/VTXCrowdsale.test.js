const EVMRevert = require("./helpers/EVMRevert")
const chaiAsPromised = require("chai-as-promised")
const { advanceBlock } = require("./helpers/advanceToBlock")
const BigNumber = web3.BigNumber;

require("chai")
  .use(chaiAsPromised)
  .should()

const Crowdsale = artifacts.require("VTXCrowdsale")
const Token = artifacts.require("VTXToken")

contract("Generic Whitelisted Crowdsale", async function([
  creator,
  payee0,
  payee1,
  purchaser,
  investor,
  ...addresses
]) {
  this.timeout = 10000

  before(async function() {
    // await advanceBlock()
  })

  beforeEach(async function() {
    const rate = new BigNumber(1)
    const decimals = new BigNumber(18)
    const totalSupplyWholeDigits = new BigNumber(21000000)

    this.totalSupply = totalSupplyWholeDigits.mul(new BigNumber(10).pow(decimals))
    this.token = await Token.new("VTXWhitelistedToken", "VTX", decimals, totalSupplyWholeDigits)
    this.crowdsale = await Crowdsale.new(rate, creator, this.token.address)
    await this.token.transfer(this.crowdsale.address, this.totalSupply)
  })

  describe("inheritance", function() {
    it("should inherit from WhitelistedCrowdsale", function() {
      expect(this.crowdsale.addAddressToWhitelist).to.be.a("function")
      expect(this.crowdsale.addAddressesToWhitelist).to.be.a("function")
      expect(this.crowdsale.removeAddressFromWhitelist).to.be.a("function")
      expect(this.crowdsale.removeAddressesFromWhitelist).to.be.a("function")
      expect(this.crowdsale.whitelist).to.be.a("function")
    })
  })

  describe("check defaults", async function() {
    it("should have the total supply assigned to the crowdsale", async function() {
      const crowdsaleBalance = await this.token.balanceOf(this.crowdsale.address)
      expect(crowdsaleBalance.eq(this.totalSupply)).to.be.true
    })

    it("no addresses should be whitelisted by default", async function() {
      const isAddressWhitelisted = await this.crowdsale.whitelist(creator)
      isAddressWhitelisted.should.be.false
    })
  })

  describe("whitelisted crowdsale behaviours", async function() {
    it("should reject purchases for non-whitelisted address", async function() {
      const value = web3.toWei(new BigNumber(1), "ether")
      this.crowdsale.sendTransaction({ from: purchaser, value }).should.be.rejectedWith(EVMRevert)
    })

    it("should whitelist an address", async function() {
      const addressToWhitelist = purchaser
      this.crowdsale.addAddressToWhitelist(addressToWhitelist).should.be.fulfilled
      const isWhitelisted = await this.crowdsale.whitelist(addressToWhitelist)
      isWhitelisted.should.be.true
    })

    it("should allow purchases for whitelisted address", async function() {
      const addressToWhitelist = purchaser
      this.crowdsale.addAddressToWhitelist(addressToWhitelist).should.be.fulfilled
      const value = web3.toWei(new BigNumber(1), "ether")
      this.crowdsale.sendTransaction({ from: purchaser, value }).should.be.fulfilled
      const whitelistedBalance = await this.token.balanceOf(purchaser)
      await advanceBlock(web3)
      expect(whitelistedBalance.eq(value)).to.be.true
    })
 })

  describe("integration tests", async function() {
    it("should survive a series of calls", async function() {
      const toWhitelist = [payee0, payee1, purchaser, investor]
      const blacklisted = [...addresses]

      const value = web3.toWei(new BigNumber(1), "ether")

      // someone gets whitelisted
      await this.crowdsale.addAddressToWhitelist(toWhitelist[0])

      // someone else tries to send money when not whitelisted
      this.crowdsale.sendTransaction({ from: blacklisted[0], value }).should.be.rejectedWith(EVMRevert)

      // whitelisted address sends funds
      this.crowdsale.sendTransaction({ from: toWhitelist[0], value }).should.be.fulfilled

      // check that tokens were issued
      const whitelistedOneBalance = await this.token.balanceOf(toWhitelist[0])
      await advanceBlock(web3)
      expect(whitelistedOneBalance.eq(value)).to.be.true

      // whitelisted several addresses
      await this.crowdsale.addAddressesToWhitelist(toWhitelist.slice(1))

      // send funds
      this.crowdsale.sendTransaction({ from: toWhitelist[1], value }).should.be.fulfilled
      this.crowdsale.sendTransaction({ from: toWhitelist[2], value }).should.be.fulfilled
      this.crowdsale.sendTransaction({ from: toWhitelist[3], value }).should.be.fulfilled
      await advanceBlock(web3)

      const b1 = await this.token.balanceOf(toWhitelist[1])
      const b2 = await this.token.balanceOf(toWhitelist[2])
      const b3 = await this.token.balanceOf(toWhitelist[3])

      expect(b1.eq(value)).to.be.true
      expect(b2.eq(value)).to.be.true
      expect(b3.eq(value)).to.be.true

      // remove someone from the whitelist
      this.crowdsale.removeAddressFromWhitelist(toWhitelist[1])

      // that address sends funds
      this.crowdsale.sendTransaction({ from: toWhitelist[1], value }).should.be.rejectedWith(EVMRevert)
    })
  })
})