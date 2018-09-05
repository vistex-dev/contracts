const { ether } = require('./helpers/ether');
const { advanceBlock } = require('./helpers/advanceToBlock');
const { increaseTimeTo, duration } = require('./helpers/increaseTime');
const { latestTime } = require('./helpers/latestTime');
const { EVMRevert } = require('./helpers/EVMRevert');

const VTXToken = artifacts.require('./VTXToken.sol');
const VTXCrowdsale = artifacts.require("./VTXCrowdsale.sol");

const BigNumber = web3.BigNumber;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

contract('VTXCrowdsale', function ([owner, wallet, investor]) {
  const RATE = new BigNumber(1);
  const CAP = ether(2);
  
  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
    await advanceBlock();
  });

  beforeEach(async function () {
    this.openingTime = latestTime() + duration.weeks(1);
    this.closingTime = this.openingTime + duration.weeks(1);
    this.afterClosingTime = this.closingTime + duration.seconds(1);

    this.token = await VTXToken.new({ from: owner });
    this.crowdsale = await VTXCrowdsale.new(
      RATE, wallet, this.token.address, this.openingTime, this.closingTime, CAP
    );
    const totalSupply = await this.token.totalSupply();
    await this.token.transfer(this.crowdsale.address, totalSupply, { from: owner })
  });

  it('should create crowdsale with correct parameters', async function () {
    this.crowdsale.should.exist;
    this.token.should.exist;

    const rate = await this.crowdsale.rate();
    const walletAddress = await this.crowdsale.wallet();
    const openingTime = await this.crowdsale.openingTime();
    const closingTime = await this.crowdsale.closingTime();
    const cap = await this.crowdsale.cap();

    rate.should.be.bignumber.equal(RATE);
    walletAddress.should.be.equal(wallet);	
    openingTime.should.be.bignumber.equal(this.openingTime);
    closingTime.should.be.bignumber.equal(this.closingTime);
    cap.should.be.bignumber.equal(CAP);
  });

  it('should not accept non-whitelisted payments before start', async function () {
    await this.crowdsale.buyTokens(investor, { from: investor, value: ether(1) }).should.be.rejectedWith(EVMRevert);
  });

  it('should not accept whitelisted payments before start', async function () {
    await this.crowdsale.addAddressToWhitelist(investor);
    await this.crowdsale.buyTokens(investor, { from: investor, value: ether(1) }).should.be.rejectedWith(EVMRevert);
  });

  it('should not accept non-whitelisted payments during the sale', async function () {
    const investmentAmount = ether(1);
    const expectedTokenAmount = RATE.mul(investmentAmount);

    await increaseTimeTo(this.openingTime);
    await this.crowdsale.buyTokens(investor, { from: investor, value: ether(1) }).should.be.rejectedWith(EVMRevert);	
  });

  it('should accept whitelisted payments during the sale', async function () {
    const investmentAmount = ether(1);
    const expectedTokenAmount = RATE.mul(investmentAmount);

    await this.crowdsale.addAddressToWhitelist(investor);
    await increaseTimeTo(this.openingTime);

    console.log('buying tokens)');
    await this.crowdsale.buyTokens(investor, { value: investmentAmount, from: investor }).should.be.fulfilled;
    console.log('tokens purchased');

    (await this.token.balanceOf(investor)).should.be.bignumber.equal(expectedTokenAmount);
  });

  it('should not accept whitelisted payments over cap', async function () {
    await this.crowdsale.addAddressToWhitelist(investor);	
    await increaseTimeTo(this.openingTime);
    await this.crowdsale.buyTokens(investor, { value: CAP, from: investor }).should.be.fulfilled;
    await this.crowdsale.buyTokens(investor, { from: investor, value: ether(1) }).should.be.rejectedWith(EVMRevert);
  });

  it('should not accept non-whitelisted payments after end', async function () {
    await increaseTimeTo(this.afterClosingTime);
    await this.crowdsale.buyTokens(investor, { from: investor, value: ether(1) }).should.be.rejectedWith(EVMRevert);
  });

  it('should not accept whitelisted payments after end', async function () {
    await increaseTimeTo(this.afterClosingTime);
    await this.crowdsale.addAddressToWhitelist(investor);
    await this.crowdsale.buyTokens(investor, { from: investor, value: ether(1) }).should.be.rejectedWith(EVMRevert);
  });

});