const EthereumTx = require('ethereumjs-tx');
const privateKeys = require('./truffle-keys').private;
const publicKeys = require('./truffle-keys').public;
const Token = artifacts.require('./Token.sol');

contract('Token (integration)', function(accounts) {
  let contract, owner, web3Contract;

  before(async () => {
    contract = await Token.deployed();
    web3Contract = web3.eth.contract(contract.abi).at(contract.address);
    owner = web3Contract._eth.coinbase;
    const other = web3.eth.accounts[1];

    if (publicKeys[0] !== owner || publicKeys[1] !== other) {
      throw new Error('Use `truffle develop` and `test/truffle-keys.js');
    }
  });

  it('should pass if contract deployed', async function() {
    const name = await contract.name.call();
    assert.strictEqual(name, 'Token');
  });

  it('should return initial token wei balance of 1*10^27', async function() {
    const ownerBalance = await contract.balanceOf.call(owner);
    assert.strictEqual(ownerBalance.toString(), '1e+27');
  });

  it('should properly transfer token', async function() {
    const recipient = web3.eth.accounts[1];
    const tokenWei = 1000000;
    await contract.transferFrom(owner, recipient, tokenWei);
    const ownerBalance = await contract.balanceOf.call(owner);
    const recipientBalance = await contract.balanceOf(recipient);
    assert.strictEqual(ownerBalance.toString(), '9.99999999999999999999e+26');
    assert.strictEqual(recipientBalance.toNumber(), tokenWei);
  });

  it('should properly return the totalSupply of tokens', async function() {
    const totalSupply = await contract.totalSupply.call();
    assert.strictEqual(totalSupply.toString(), '1e+27');
  });

  it('should approve token for transferFrom', async function() {
    const approver = owner;
    const spender = web3.eth.accounts[2];
    const originalAllowance = await contract.allowance.call(approver, spender);
    const tokenWei = 5000000;
    await contract.approve(spender, tokenWei);
    const resultAllowance = await contract.allowance.call(approver, spender);
    assert.strictEqual(originalAllowance.toNumber(), 0);
    assert.strictEqual(resultAllowance.toNumber(), tokenWei);
  });
});