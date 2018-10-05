import ether from './helpers/ether';
import EVMRevert from './helpers/EVMRevert';
import { increaseTimeTo, duration } from './helpers/increaseTime';
import latestTime from './helpers/latestTime';

const BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const VTXToken = artifacts.require('VTXToken');
const VTXTokenCrowdsale = artifacts.require('VTXTokenCrowdsale');
const RefundVault = artifacts.require('./RefundVault');
const TokenTimelock = artifacts.require('./TokenTimelock');

contract('VTXTokenCrowdsale', function([_, wallet, investor1, investor2, foundersFund]) {

  before(async function() {
    // Transfer extra ether to investor1's account for testing
    await web3.eth.sendTransaction({ from: _, to: investor1, value: ether(25) })
  });

  beforeEach(async function () {
    // Token config
    this.name = "VTX Token";
    this.symbol = "VTX";
    this.decimals = 18;

    // Deploy Token
    this.token = await VTXToken.new(
      this.name,
      this.symbol,
      this.decimals
    );

    // Crowdsale config
    this.wallet = wallet;
    this.cap = ether(100);
    this.openingTime = latestTime() + duration.weeks(1);
    this.closingTime = this.openingTime + duration.weeks(1);
    this.goal = ether(50);
    this.foundersFund = foundersFund;
    this.releaseTime = this.closingTime + duration.years(1);

    // Investor caps
    this.investorMinCap = ether(0.002);
    this.inestorHardCap = ether(50);

    // ICO Stages
    this.preIcoStage = 0;
    this.preIcoRate = 500;
    this.icoStage = 1;
    this.icoRate = 250;

    // Token Distribution
    this.tokenSalePercentage = 80;
    this.foundersPercentage = 20;

    this.crowdsale = await VTXTokenCrowdsale.new(
      this.preIcoRate,
      this.icoRate,
      this.wallet,
      this.token.address,
      this.cap,
      this.openingTime,
      this.closingTime,
      this.goal,
      this.investorMinCap,
      this.foundersFund,
      this.foundersPercentage,
      this.releaseTime
    );

    // Pause Token
    await this.token.pause();

    // Transfer token ownership to crowdsale
    await this.token.transferOwnership(this.crowdsale.address);

    // Add investors to whitelist
    await this.crowdsale.addManyToWhitelist([investor1, investor2]);

    // Track refund vault
    this.vaultAddress = await this.crowdsale.vault();
    this.vault = RefundVault.at(this.vaultAddress);

    // Advance time to crowdsale start
    await increaseTimeTo(this.openingTime + 1);
  });

  describe('Crowdsale', function() {
    it('tracks the rate', async function() {
      const rate = await this.crowdsale.rate();
      rate.should.be.bignumber.equal(this.preIcoRate);
    });

    it('tracks the wallet', async function() {
      const wallet = await this.crowdsale.wallet();
      wallet.should.equal(this.wallet);
    });

    it('tracks the token', async function() {
      const token = await this.crowdsale.token();
      token.should.equal(this.token.address);
    });
  });

  describe('Minted crowdsale', function() {
    it('mints tokens after purchase', async function() {
      const originalTotalSupply = await this.token.totalSupply();
      await this.crowdsale.sendTransaction({ value: ether(1), from: investor1 });
      const newTotalSupply = await this.token.totalSupply();
      assert.isTrue(newTotalSupply > originalTotalSupply);
    });
  });

  describe('Capped crowdsale', async function() {
    it('has the correct hard cap', async function() {
      const cap = await this.crowdsale.cap();
      cap.should.be.bignumber.equal(this.cap);
    });
  });

  describe('Timed crowdsale', function() {
    it('is open', async function() {
      const isClosed = await this.crowdsale.hasClosed();
      isClosed.should.be.false;
    });
  });

  describe('Whitelisted crowdsale', function() {
    it('rejects contributions from non-whitelisted investors', async function() {
      const notWhitelisted = _;
      await this.crowdsale.buyTokens(notWhitelisted, { value: ether(1), from: notWhitelisted }).should.be.rejectedWith(EVMRevert);
    });
  });

  describe('Refundable crowdsale', function() {
    beforeEach(async function() {
      await this.crowdsale.buyTokens(investor1, { value: ether(1), from: investor1 });
    });

    describe('during crowdsale', function() {
      it('prevents the investor from claiming refund', async function() {
        await this.vault.refund(investor1, { from: investor1 }).should.be.rejectedWith(EVMRevert);
      });
    });

    describe('when the crowdsale stage is PreICO', function() {
      beforeEach(async function () {
        // Crowdsale stage is already PreICO by default
        await this.crowdsale.buyTokens(investor1, { value: ether(1), from: investor1 });
      });

      it('forwards funds to the wallet', async function () {
        const balance = await web3.eth.getBalance(this.wallet);
        expect(balance.toNumber()).to.be.above(ether(100).toNumber());
      });
    });

    describe('when the crowdsale stage is ICO', function() {
      beforeEach(async function () {
        await this.crowdsale.setCrowdsaleStage(this.icoStage, { from: _ });
        await this.crowdsale.buyTokens(investor1, { value: ether(1), from: investor1 });
      });

      it('forwards funds to the refund vault', async function () {
        const balance = await web3.eth.getBalance(this.vaultAddress);
        expect(balance.toNumber()).to.be.above(0);
      });
    });
  });

  describe('Crowdsale stages', function() {

    it('it starts in PreICO', async function () {
      const stage = await this.crowdsale.stage();
      stage.should.be.bignumber.equal(this.preIcoStage);
    });

    it('starts at the preICO rate', async function () {
      const rate = await this.crowdsale.rate();
      rate.should.be.bignumber.equal(this.preIcoRate);
    });

    it('allows admin to update the stage & rate', async function() {
      await this.crowdsale.setCrowdsaleStage(this.icoStage, { from: _ });
      const stage = await this.crowdsale.stage();
      stage.should.be.bignumber.equal(this.icoStage);
      const rate = await this.crowdsale.rate();
      rate.should.be.bignumber.equal(this.icoRate);
    });

    it('prevents non-admin from updating the stage', async function () {
      await this.crowdsale.setCrowdsaleStage(this.icoStage, { from: investor1 }).should.be.rejectedWith(EVMRevert);
    });
  });

  describe('Accepting payments', function() {
    it('should accept payments', async function() {
      const value = ether(1);
      const purchaser = investor2;
      await this.crowdsale.sendTransaction({ value: value, from: investor1 }).should.be.fulfilled;
      await this.crowdsale.buyTokens(investor1, { value: value, from: purchaser }).should.be.fulfilled;
    });
  });

  describe('Buying tokens', function() {
    describe('when the contribution is less than the minimum cap', function() {
      it('rejects the transaction', async function() {
        const value = this.investorMinCap - 1;
        await this.crowdsale.buyTokens(investor2, { value: value, from: investor2 }).should.be.rejectedWith(EVMRevert);
      });
    });

    describe('when the investor has already met the minimum cap', function() {
      it('allows the investor to contribute below the minimum cap', async function() {
        // First contribution is valid
        const value1 = ether(1);
        await this.crowdsale.buyTokens(investor1, { value: value1, from: investor1 });
        // Second contribution is less than investor cap
        const value2 = 1; // wei
        await this.crowdsale.buyTokens(investor1, { value: value2, from: investor1 }).should.be.fulfilled;
      });
    });
  });

  describe('When the total contributions exceed the investor hard cap', function () {
    it('rejects the transaction', async function () {
      // First contribution is in valid range
      const value1 = ether(2);
      await this.crowdsale.buyTokens(investor1, { value: value1, from: investor1 });
      // Second contribution sends total contributions over investor hard cap
      const value2 = ether(49);
      await this.crowdsale.buyTokens(investor1, { value: value2, from: investor1 }).should.be.rejectedWith(EVMRevert);
    });
  });

  describe('When the contribution is within the valid range', function () {
    const value = ether(2);
    it('succeeds & updates the contribution amount', async function () {
      await this.crowdsale.buyTokens(investor2, { value: value, from: investor2 }).should.be.fulfilled;
      const contribution = await this.crowdsale.getUserContribution(investor2);
      contribution.should.be.bignumber.equal(value);
    });
  });

  describe('Token transfers', function () {
    it('does not allow investors to transfer tokens during crowdsale', async function () {
      // Buy some tokens first
      await this.crowdsale.buyTokens(investor1, { value: ether(1), from: investor1 });
      // Attempt to transfer tokens during crowdsale
      await this.token.transfer(investor2, 1, { from: investor1 }).should.be.rejectedWith(EVMRevert);
    });
  });

  describe('Finalizing the crowdsale', function() {
    describe('when the goal is not reached', function() {
      beforeEach(async function () {
        // Do not meet the toal
        await this.crowdsale.buyTokens(investor2, { value: ether(1), from: investor2 });
        // Fastforward past end time
        await increaseTimeTo(this.closingTime + 1);
        // Finalize the crowdsale
        await this.crowdsale.finalize({ from: _ });
      });

      it('allows the investor to claim refund', async function () {
        await this.vault.refund(investor2, { from: investor2 }).should.be.fulfilled;
      });
    });

    describe('when the goal is reached', function() {
      beforeEach(async function () {
        // track current wallet balance
        this.walletBalance = await web3.eth.getBalance(wallet);

        // Meet the goal
        await this.crowdsale.buyTokens(investor1, { value: ether(26), from: investor1 });
        await this.crowdsale.buyTokens(investor2, { value: ether(26), from: investor2 });
        // Fastforward past end time
        await increaseTimeTo(this.closingTime + 1);
        // Finalize the crowdsale
        await this.crowdsale.finalize({ from: _ });
      });

      it('handles goal reached', async function () {
        // Tracks goal reached
        const goalReached = await this.crowdsale.goalReached();
        goalReached.should.be.true;

        // Finishes minting token
        const mintingFinished = await this.token.mintingFinished();
        mintingFinished.should.be.true;

        // Unpauses the token
        const paused = await this.token.paused();
        paused.should.be.false;

        // Enables token transfers
        await this.token.transfer(investor2, 1, { from: investor2 }).should.be.fulfilled;

        let totalSupply = await this.token.totalSupply();
        totalSupply = totalSupply.toString();

        // Founders
        const foundersTimelockAddress = await this.crowdsale.foundersTimelock();
        let foundersTimelockBalance = await this.token.balanceOf(foundersTimelockAddress);
        foundersTimelockBalance = foundersTimelockBalance.toString();
        foundersTimelockBalance = foundersTimelockBalance / (10 ** this.decimals);

        let foundersAmount = totalSupply / (100 / this.foundersPercentage);
        foundersAmount = foundersAmount.toString();
        foundersAmount = foundersAmount / (10 ** this.decimals);

        assert.equal(foundersTimelockBalance.toString(), foundersAmount.toString());

        // Can't withdraw from timelocks
        const foundersTimelock = await TokenTimelock.at(foundersTimelockAddress);
        await foundersTimelock.release().should.be.rejectedWith(EVMRevert);

        // Can withdraw from timelocks
        await increaseTimeTo(this.releaseTime + 1);

        await foundersTimelock.release().should.be.fulfilled;

        // Funds now have balances

        // Founders
        let foundersBalance = await this.token.balanceOf(this.foundersFund);
        foundersBalance = foundersBalance.toString();
        foundersBalance = foundersBalance / (10 ** this.decimals);

        assert.equal(foundersBalance.toString(), foundersAmount.toString());

        // Transfers ownership to the wallet
        const owner = await this.token.owner();
        owner.should.equal(this.wallet);

        // Prevents investor from claiming refund
        await this.vault.refund(investor1, { from: investor1 }).should.be.rejectedWith(EVMRevert);
      });
    });
  });

  describe('Token distribution', function() {
    it('tracks token distribution correctly', async function () {
      const tokenSalePercentage = await this.crowdsale.tokenSalePercentage();
      tokenSalePercentage.should.be.bignumber.eq(this.tokenSalePercentage, 'has correct tokenSalePercentage');
      const foundersPercentage = await this.crowdsale.foundersPercentage();
      foundersPercentage.should.be.bignumber.eq(this.foundersPercentage, 'has correct foundersPercentage');
    });

    it('is a valid percentage breakdown', async function () {
      const tokenSalePercentage = await this.crowdsale.tokenSalePercentage();
      const foundersPercentage = await this.crowdsale.foundersPercentage();

      const total = tokenSalePercentage.toNumber() + foundersPercentage.toNumber();
      total.should.equal(100);
    });
  });
});
