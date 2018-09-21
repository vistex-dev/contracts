const BigNumber = web3.BigNumber;

const VTXToken = artifacts.require('VTXToken');

require('chai')
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract('VTXToken', accounts => {
  const _name = 'VTX Token';
  const _symbol = 'VTX';
  const _decimals = 18;

  beforeEach(async function () {
    this.token = await VTXToken.new(_name, _symbol, _decimals);
  });

  describe('Check token attributes', function() {
    it('has the correct name', async function() {
      const name = await this.token.name();
      name.should.equal(_name);
    });

    it('has the correct symbol', async function() {
      const symbol = await this.token.symbol();
      symbol.should.equal(_symbol);
    });

    it('has the correct decimals', async function() {
      const decimals = await this.token.decimals();
      decimals.should.be.bignumber.equal(_decimals);
    });
  });
});