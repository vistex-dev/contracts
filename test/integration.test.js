const rawTransaction = require('./helpers/rawTransaction').rawTransaction;
const wait = require('./helpers/wait').wait;
const privateKeys = require('./helpers/truffle-keys').private;
const publicKeys = require('./helpers/truffle-keys').public;
const Token = artifacts.require('./Token.sol');

contract('Token', function(accounts) {
  let contract, owner, web3Contract, eventCounter = {};

  before(async () => {
    contract = await Token.deployed();
    web3Contract = web3.eth.contract(contract.abi).at(contract.address);
    owner = web3Contract._eth.coinbase;
    const other = publicKeys[1];

    if (publicKeys[0] !== owner || publicKeys[1] !== other) {
      throw new Error('Use `truffle develop` and /test/truffle-keys.js');
    }

    // Counts every event that solidity functions fire.
    // TODO: Confirm individual event contents in each test.
    contract.allEvents({}, (error, details) => {
      if (error) {
        console.error(error);
      } else {
        let count = eventCounter[details.event];
        eventCounter[details.event] = count ? count + 1 : 1;
      }
    });
  });

  it('should pass if contract is deployed', async function() {
    const name = await contract.name.call();
    assert.strictEqual(name, 'Token');
  });

  it('should return inital token wei balance of 1*10^27', async function() {
    const ownerBalance = await contract.balanceOf.call(owner);
    assert.strictEqual(ownerBalance.toString(), '1e+27');
  });

  it('should properly [transfer] token', async function() {
    const recipient = publicKeys[1];
    const tokenWei = 1000000;

    await contract.transfer(recipient, tokenWei);
    
    const ownerBalance = await contract.balanceOf.call(owner);
    const recipientBalance = await contract.balanceOf.call(recipient);

    assert.strictEqual(ownerBalance.toString(), '9.99999999999999999999e+26');
    assert.strictEqual(recipientBalance.toNumber(), tokenWei);
  });

  it('should properly between non-owners [transfer] token', async function() {
    const sender = publicKeys[1];
    const senderPrivateKey = privateKeys[1];
    const recipient = publicKeys[2];
    const tokenWei = 500000;
    
    const data = web3Contract.transfer.getData(recipient, tokenWei);

    const result = await rawTransaction(
      sender,
      senderPrivateKey,
      contract.address,
      data,
      0
    );

    const senderBalance = await contract.balanceOf.call(sender);
    const recipientBalance = await contract.balanceOf.call(recipient);

    assert.strictEqual(senderBalance.toNumber(), tokenWei);
    assert.strictEqual(recipientBalance.toNumber(), tokenWei);
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should fail to [transfer] token too much token', async function() {
    const sender = publicKeys[1];
    const senderPrivateKey = privateKeys[1];
    const recipient = publicKeys[2];
    const tokenWei = 50000000;
    
    const data = web3Contract.transfer.getData(recipient, tokenWei);

    let errorMessage;
    try {
      await rawTransaction(
        sender,
        senderPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    assert.strictEqual(
      errorMessage,
      'VM Exception while processing transaction: invalid opcode'
    );

    const senderBalance = await contract.balanceOf.call(sender);
    const recipientBalance = await contract.balanceOf.call(recipient);

    assert.strictEqual(senderBalance.toNumber(), 500000);
    assert.strictEqual(recipientBalance.toNumber(), 500000);
  });

  it('should properly return the [totalSupply] of tokens', async function() {
    const totalSupply = await contract.totalSupply.call();
    assert.strictEqual(totalSupply.toString(), '1e+27');
  });

  it('should [approve] token for [transferFrom]', async function() {
    const approver = owner;
    const spender = publicKeys[2];

    const originalAllowance = await contract.allowance.call(approver, spender);

    const tokenWei = 5000000;
    await contract.approve(spender, tokenWei);

    const resultAllowance = await contract.allowance.call(approver, spender);

    assert.strictEqual(originalAllowance.toNumber(), 0);
    assert.strictEqual(resultAllowance.toNumber(), tokenWei);
  });

  it('should fail to [transferFrom] more than allowed', async function() {
    const from = owner;
    const to = publicKeys[2];
    const spenderPrivateKey = privateKeys[2];
    const tokenWei = 10000000;

    await contract.allowance.call(from, to);

    const data = web3Contract.transferFrom.getData(from, to, tokenWei);

    let errorMessage;
    try {
      await rawTransaction(
        to,
        spenderPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    assert.strictEqual(
      errorMessage,
      'VM Exception while processing transaction: invalid opcode'
    );
  });

  it('should [transferFrom] approved tokens', async function() {
    const from = owner;
    const to = publicKeys[2];
    const spenderPrivateKey = privateKeys[2];
    const tokenWei = 5000000;

    const allowance = await contract.allowance.call(from, to);
    const ownerBalance = await contract.balanceOf.call(from);
    const spenderBalance = await contract.balanceOf.call(to);

    const data = web3Contract.transferFrom.getData(from, to, tokenWei);

    const result = await rawTransaction(
      to,
      spenderPrivateKey,
      contract.address,
      data,
      0
    );

    const allowanceAfter = await contract.allowance.call(from, to);
    const ownerBalanceAfter = await contract.balanceOf.call(from);
    const spenderBalanceAfter = await contract.balanceOf.call(to);

    // Correct account balances
    // toString() numbers that are too large for js
    assert.strictEqual(
      ownerBalance.toString(),
      ownerBalanceAfter.add(tokenWei).toString()
    );
    assert.strictEqual(
      spenderBalance.add(tokenWei).toString(),
      spenderBalanceAfter.toString()
    );

    // Proper original allowance
    assert.strictEqual(allowance.toNumber(), tokenWei);

    // All of the allowance should have been used
    assert.strictEqual(allowanceAfter.toNumber(), 0);

    // Normal transaction hash, not an error.
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should fail [changeTokenName] for non-owner', async function() {
    const notOwner = publicKeys[2];
    const notOwnerPrivateKey = privateKeys[2];

    const data = web3Contract.changeTokenName.getData('NewName');

    let errorMessage;
    try {
      await rawTransaction(
        notOwner,
        notOwnerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    const expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should properly [changeTokenName] by the owner', async function() {
    const ownerPrivateKey = privateKeys[0];
    const oldName = await contract.name.call();

    // attempt to `changeTokenName` 
    const data = web3Contract.changeTokenName.getData('NewName');

    const result = await rawTransaction(
      owner,
      ownerPrivateKey,
      contract.address,
      data,
      0
    );

    const newName = await contract.name.call();

    assert.strictEqual(oldName, 'Token');
    assert.strictEqual(newName, 'NewName');
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should fail [changeTokenSymbol] for not the owner', async function() {
    const notOwner = publicKeys[3];
    const notOwnerPrivateKey = privateKeys[3];

    const data = web3Contract.changeTokenSymbol.getData('XYZ');

    let errorMessage;
    try {
      await rawTransaction(
        notOwner,
        notOwnerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    const expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should properly [changeTokenSymbol] by the owner', async function() {
    const ownerPrivateKey = privateKeys[0];
    const oldSymbol = await contract.symbol.call();

    // attempt to `changeTokenName` 
    const data = web3Contract.changeTokenSymbol.getData('ABC');

    const result = await rawTransaction(
      owner,
      ownerPrivateKey,
      contract.address,
      data,
      0
    );

    const newSymbol = await contract.symbol.call();

    assert.strictEqual(oldSymbol, 'TOK');
    assert.strictEqual(newSymbol, 'ABC');
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should properly [createCrowdsale] for owner', async function() {
    const ownerPrivateKey = privateKeys[0];

    const open = await contract.crowdsaleIsOpen.call('crowdsale1');

    // attempt to `createCrowdsale` that is open and happening now
    const data = web3Contract.createCrowdsale.getData(
      'crowdsale1', /* name */
      true, /* open */
      50000, /* initialTokenSupply */
      400, /* exchangeRate */
      Math.floor(new Date().getTime() / 1000 - 5), /* startTime */
      Math.floor(new Date().getTime() / 1000 + 1000), /* endTime */
    );

    const result = await rawTransaction(
      owner,
      ownerPrivateKey,
      contract.address,
      data,
      0
    );

    const openAfter = await contract.crowdsaleIsOpen.call('crowdsale1');

    assert.strictEqual(open, false);
    assert.strictEqual(openAfter, true);
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should [createCrowdsale] when passing 0 endTime', async function() {
    const ownerPrivateKey = privateKeys[0];

    const open = await contract.crowdsaleIsOpen.call('crowdsale2');

    // attempt to `createCrowdsale` with a max int end time
    const data = web3Contract.createCrowdsale.getData(
      'crowdsale2', /* name */
      true, /* open */
      50000, /* initialTokenSupply */
      400, /* exchangeRate */
      Math.floor(new Date().getTime() / 1000 - 5), /* startTime */
      0, /* endTime */
    );

    const result = await rawTransaction(
      owner,
      ownerPrivateKey,
      contract.address,
      data,
      0
    );

    const openAfter = await contract.crowdsaleIsOpen.call('crowdsale1');

    assert.strictEqual(open, false);
    assert.strictEqual(openAfter, true);
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should fail to [createCrowdsale] with existing name', async function() {
    const ownerPrivateKey = privateKeys[0];

    const open = await contract.crowdsaleIsOpen.call('crowdsale1');

    // attempt to `createCrowdsale` that is already existing
    const data = web3Contract.createCrowdsale.getData(
      'crowdsale1', /* name */
      true, /* open */
      50000, /* initialTokenSupply */
      400, /* exchangeRate */
      Math.floor(new Date().getTime() / 1000 - 5), /* startTime */
      Math.floor(new Date().getTime() / 1000 + 1000), /* endTime */
    );

    let errorMessage;
    try {
      await rawTransaction(
        owner,
        ownerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    const expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should fail to [createCrowdsale] bad exchangeRate', async function() {
    const ownerPrivateKey = privateKeys[0];

    const data = web3Contract.createCrowdsale.getData(
      'crowdsale3', /* name */
      true, /* open */
      50000, /* initialTokenSupply */
      0, /* exchangeRate */
      Math.floor(new Date().getTime() / 1000 - 5), /* startTime */
      Math.floor(new Date().getTime() / 1000 + 1000), /* endTime */
    );

    let errorMessage;
    try {
      await rawTransaction(
        owner,
        ownerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    const expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should fail to [createCrowdsale] bad dates', async function() {
    const ownerPrivateKey = privateKeys[0];

    const data = web3Contract.createCrowdsale.getData(
      'crowdsale3', /* name */
      true, /* open */
      50000, /* initialTokenSupply */
      123, /* exchangeRate */
      Math.floor(new Date().getTime() / 1000 + 1000), /* startTime */
      Math.floor(new Date().getTime() / 1000 - 5) /* endTime */
    );

    let errorMessage;
    try {
      await rawTransaction(
        owner,
        ownerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    const expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('[crowdsaleIsOpen] should fail for non-existing cs', async function() {
    const open = await contract.crowdsaleIsOpen.call('crowdsale3');
    assert.strictEqual(open, false);
  });

  it('should fail to [createCrowdsale] bad name', async function() {
    const ownerPrivateKey = privateKeys[0];

    const data = web3Contract.createCrowdsale.getData(
      '', /* name */
      true, /* open */
      50000, /* initialTokenSupply */
      123, /* exchangeRate */
      Math.floor(new Date().getTime() / 1000 - 5), /* startTime */
      Math.floor(new Date().getTime() / 1000 + 1000) /* endTime */
    );

    let errorMessage;
    try {
      await rawTransaction(
        owner,
        ownerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    const expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('[crowdsaleIsOpen] should return true for open cs', async function() {
    const open = await contract.crowdsaleIsOpen.call('crowdsale1');
    assert.strictEqual(open, true);
  });

  it('should fail to [closeCrowdsale] for non-owner', async function() {
    const notOwner = publicKeys[2];
    const notOwnerPrivateKey = privateKeys[2];

    const open = await contract.crowdsaleIsOpen.call('crowdsale1');

    // attempt to close the crowdsale
    const data = web3Contract.closeCrowdsale.getData('crowdsale1');

    let errorMessage;
    try {
      await rawTransaction(
        notOwner,
        notOwnerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    const openAfter = await contract.crowdsaleIsOpen.call('crowdsale1');

    assert.strictEqual(open, true);
    assert.strictEqual(openAfter, true);

    const expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should [closeCrowdsale] for owner only', async function() {
    const ownerPrivateKey = privateKeys[0];

    const open = await contract.crowdsaleIsOpen.call('crowdsale1');

    // attempt to close the crowdsale
    const data = web3Contract.closeCrowdsale.getData('crowdsale1');

    const result = await rawTransaction(
      owner,
      ownerPrivateKey,
      contract.address,
      data,
      0
    );

    const openAfter = await contract.crowdsaleIsOpen.call('crowdsale1');

    assert.strictEqual(open, true);
    assert.strictEqual(openAfter, false);
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('[crowdsaleIsOpen] should return false for closed cs', async function() {
    const open = await contract.crowdsaleIsOpen.call('crowdsale1');
    assert.strictEqual(open, false);
  });

  it('should fail to [openCrowdsale] for non-owner', async function() {
    const notOwner = publicKeys[2];
    const notOwnerPrivateKey = privateKeys[2];

    const open = await contract.crowdsaleIsOpen.call('crowdsale1');

    const data = web3Contract.openCrowdsale.getData('crowdsale1');

    let errorMessage;
    try {
      await rawTransaction(
        notOwner,
        notOwnerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    const openAfter = await contract.crowdsaleIsOpen.call('crowdsale1');

    assert.strictEqual(open, false);
    assert.strictEqual(openAfter, false);

    const expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should [openCrowdsale] for owner only', async function() {
    const ownerPrivateKey = privateKeys[0];

    const open = await contract.crowdsaleIsOpen.call('crowdsale1');

    const data = web3Contract.openCrowdsale.getData('crowdsale1');

    const result = await rawTransaction(
      owner,
      ownerPrivateKey,
      contract.address,
      data,
      0
    );

    const openAfter = await contract.crowdsaleIsOpen.call('crowdsale1');

    assert.strictEqual(open, false);
    assert.strictEqual(openAfter, true);
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should fail to [crowdsaleAddTokens] for non-owner', async function() {
    const notOwner = publicKeys[1];
    const notOwnerPrivateKey = privateKeys[1];

    const crowdsaleTokens = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    const ownerTokens = await contract.balanceOf.call(owner);
    const notOwnerTokens = await contract.balanceOf.call(notOwner);

    const data = web3Contract.crowdsaleAddTokens.getData(
      'crowdsale1',
      web3.toBigNumber('100')
    );

    let errorMessage;
    try {
      await rawTransaction(
        notOwner,
        notOwnerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    const crowdsaleTokensAfter = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    const ownerTokensAfter = await contract.balanceOf.call(owner);
    const notOwnerTokensAfter = await contract.balanceOf.call(notOwner);

    assert.strictEqual(crowdsaleTokens.toString(), crowdsaleTokensAfter.toString());
    assert.strictEqual(ownerTokens.toString(), ownerTokensAfter.toString());
    assert.strictEqual(notOwnerTokens.toString(), notOwnerTokensAfter.toString());

    const expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should fail to [crowdsaleAddTokens] too many tokens', async function() {
    const ownerPrivateKey = privateKeys[0];

    const crowdsaleTokens = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    const ownerTokens = await contract.balanceOf.call(owner);

    const data = web3Contract.crowdsaleAddTokens.getData(
      'crowdsale1',
      web3.toBigNumber('1e+50')
    );

    let errorMessage;
    try {
      await rawTransaction(
        owner,
        ownerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    const crowdsaleTokensAfter = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    const ownerTokensAfter = await contract.balanceOf.call(owner);

    assert.strictEqual(crowdsaleTokens.toString(), crowdsaleTokensAfter.toString());
    assert.strictEqual(ownerTokens.toString(), ownerTokensAfter.toString());

    const expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should [crowdsaleAddTokens] for owner only', async function() {
    const ownerPrivateKey = privateKeys[0];

    const crowdsaleTokens = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    const ownerTokens = await contract.balanceOf.call(owner);

    const data = web3Contract.crowdsaleAddTokens.getData(
      'crowdsale1',
      web3.toBigNumber('5000')
    );

    const result = await rawTransaction(
      owner,
      ownerPrivateKey,
      contract.address,
      data,
      0
    );

    const crowdsaleTokensAfter = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    const ownerTokensAfter = await contract.balanceOf.call(owner);

    assert.strictEqual(crowdsaleTokens.toString(), '50000');
    assert.strictEqual(ownerTokens.toString(), '9.999999999999999999939e+26');
    assert.strictEqual(crowdsaleTokensAfter.toString(), '55000');
    assert.strictEqual(ownerTokensAfter.toString(), '9.99999999999999999993895e+26');
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should fail to [crowdsaleRemoveTokens] for non-owner', async function() {
    const notOwner = publicKeys[1];
    const notOwnerPrivateKey = privateKeys[1];

    const crowdsaleTokens = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    const ownerTokens = await contract.balanceOf.call(owner);
    const notOwnerTokens = await contract.balanceOf.call(notOwner);

    const data = web3Contract.crowdsaleRemoveTokens.getData(
      'crowdsale1',
      web3.toBigNumber('100')
    );

    let errorMessage;
    try {
      await rawTransaction(
        notOwner,
        notOwnerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    const crowdsaleTokensAfter = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    const ownerTokensAfter = await contract.balanceOf.call(owner);
    const notOwnerTokensAfter = await contract.balanceOf.call(notOwner);

    assert.strictEqual(crowdsaleTokens.toString(), crowdsaleTokensAfter.toString());
    assert.strictEqual(ownerTokens.toString(), ownerTokensAfter.toString());
    assert.strictEqual(notOwnerTokens.toString(), notOwnerTokensAfter.toString());

    const expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should fail [crowdsaleRemoveTokens] too many tokens', async function() {
    const ownerPrivateKey = privateKeys[0];

    const crowdsaleTokens = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    const ownerTokens = await contract.balanceOf.call(owner);

    const data = web3Contract.crowdsaleRemoveTokens.getData(
      'crowdsale1',
      web3.toBigNumber('1e+50')
    );

    let errorMessage;
    try {
      await rawTransaction(
        owner,
        ownerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    const crowdsaleTokensAfter = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    const ownerTokensAfter = await contract.balanceOf.call(owner);

    assert.strictEqual(crowdsaleTokens.toString(), crowdsaleTokensAfter.toString());
    assert.strictEqual(ownerTokens.toString(), ownerTokensAfter.toString());

    const expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should [crowdsaleRemoveTokens] for owner only', async function() {
    const ownerPrivateKey = privateKeys[0];

    const crowdsaleTokens = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    const ownerTokens = await contract.balanceOf.call(owner);

    const data = web3Contract.crowdsaleRemoveTokens.getData(
      'crowdsale1',
      web3.toBigNumber('5000')
    );

    const result = await rawTransaction(
      owner,
      ownerPrivateKey,
      contract.address,
      data,
      0
    );

    const crowdsaleTokensAfter = 
      await contract.crowdsaleTokenBalance.call('crowdsale1');
    const ownerTokensAfter = await contract.balanceOf.call(owner);

    assert.strictEqual(crowdsaleTokens.toString(), '55000');
    assert.strictEqual(ownerTokens.toString(), '9.99999999999999999993895e+26');
    assert.strictEqual(crowdsaleTokensAfter.toString(), '50000');
    assert.strictEqual(ownerTokensAfter.toString(), '9.999999999999999999939e+26');
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should fail [crowdsaleUpdateExchangeRate] for non-owner', async function() {
    const notOwner = publicKeys[2];
    const notOwnerPrivateKey = privateKeys[2];

    const csDetails = await contract.getCrowdsaleDetails.call('crowdsale1');
    const exchangeRate = csDetails[4].toNumber();

    const data = web3Contract.crowdsaleUpdateExchangeRate.getData(
      'crowdsale1',
      5
    );

    let errorMessage;
    try {
      await rawTransaction(
        notOwner,
        notOwnerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    const csDetailsAfter = await contract.getCrowdsaleDetails.call('crowdsale1');
    const exchangeRateAfter = csDetailsAfter[4].toNumber();

    assert.strictEqual(exchangeRate.toString(), exchangeRateAfter.toString());

    const expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should fail [crowdsaleUpdateExchangeRate] bad name', async function() {
    const ownerPrivateKey = privateKeys[0];

    const csDetails = await contract.getCrowdsaleDetails.call('crowdsale1');
    const exchangeRate = csDetails[4].toNumber();

    const data = web3Contract.crowdsaleUpdateExchangeRate.getData(
      'badnameforcrowdsale',
      5
    );

    let errorMessage;
    try {
      await rawTransaction(
        owner,
        ownerPrivateKey,
        contract.address,
        data,
        0
      );
    } catch (error) {
      errorMessage = error.message;
    }

    const csDetailsAfter = await contract.getCrowdsaleDetails.call('crowdsale1');
    const exchangeRateAfter = csDetailsAfter[4].toNumber();

    assert.strictEqual(exchangeRate.toString(), exchangeRateAfter.toString());

    const expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should [crowdsaleUpdateExchangeRate] for owner only', async function() {
    const ownerPrivateKey = privateKeys[0];

    const csDetails = await contract.getCrowdsaleDetails.call('crowdsale1');
    const exchangeRate = csDetails[4].toNumber();

    const data = web3Contract.crowdsaleUpdateExchangeRate.getData(
      'crowdsale1',
      500
    );

    const result = await rawTransaction(
      owner,
      ownerPrivateKey,
      contract.address,
      data,
      0
    );

    const csDetailsAfter = await contract.getCrowdsaleDetails.call('crowdsale1');
    const exchangeRateAfter = csDetailsAfter[4].toNumber();

    assert.strictEqual(exchangeRate.toString(), '400');
    assert.strictEqual(exchangeRateAfter.toString(), '500');
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should fail [crowdsalePurchase] purchase too large', async function() {
    const ownerPrivateKey = privateKeys[0];

    const ownerBalance = await contract.balanceOf.call(owner);
    const csDetails = await contract.getCrowdsaleDetails.call('crowdsale1');
    const csTokenBalance = csDetails[3];
    const value = 500000;

    const data = web3Contract.crowdsalePurchase.getData('crowdsale1', owner);

    let errorMessage;
    try {
      await rawTransaction(
        owner,
        ownerPrivateKey,
        contract.address,
        data,
        value
      );
    } catch (error) {
      errorMessage = error.message;
    }

    const ownerBalanceAfter = await contract.balanceOf.call(owner);
    const csDetailsAfter = await contract.getCrowdsaleDetails.call('crowdsale1');
    const csTokenBalanceAfter = csDetailsAfter[3];

    assert.strictEqual(ownerBalance.toString(), ownerBalanceAfter.toString());
    assert.strictEqual(csTokenBalance.toString(), csTokenBalanceAfter.toString());

    const expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should fail [crowdsalePurchase] for bad name', async function() {
    const ownerPrivateKey = privateKeys[0];

    const ownerBalance = await contract.balanceOf.call(owner);
    const csDetails = await contract.getCrowdsaleDetails.call('crowdsale1');
    const csTokenBalance = csDetails[3];
    const value = 5;

    const data = web3Contract.crowdsalePurchase.getData(
      'notacrowdsalename',
      owner
    );

    let errorMessage;
    try {
      await rawTransaction(
        owner,
        ownerPrivateKey,
        contract.address,
        data,
        value
      );
    } catch (error) {
      errorMessage = error.message;
    }

    const ownerBalanceAfter = await contract.balanceOf.call(owner);
    const csTokenBalanceAfter =
      await contract.crowdsaleTokenBalance.call('crowdsale1');

    assert.strictEqual(ownerBalance.toString(), ownerBalanceAfter.toString());
    assert.strictEqual(csTokenBalance.toString(), csTokenBalanceAfter.toString());

    const expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should fail [crowdsalePurchase] for empty name', async function() {
    const ownerPrivateKey = privateKeys[0];

    const ownerBalance = await contract.balanceOf.call(owner);
    const csDetails = await contract.getCrowdsaleDetails.call('crowdsale1');
    const csTokenBalance = csDetails[3];
    const value = 5;

    const data = web3Contract.crowdsalePurchase.getData('', owner);

    let errorMessage;
    try {
      await rawTransaction(
        owner,
        ownerPrivateKey,
        contract.address,
        data,
        value
      );
    } catch (error) {
      errorMessage = error.message;
    }

    const ownerBalanceAfter = await contract.balanceOf.call(owner);
    const csTokenBalanceAfter =
      await contract.crowdsaleTokenBalance.call('crowdsale1');

    assert.strictEqual(ownerBalance.toString(), ownerBalanceAfter.toString());
    assert.strictEqual(csTokenBalance.toString(), csTokenBalanceAfter.toString());

    const expected = 'VM Exception while processing transaction: revert';
    assert.strictEqual(errorMessage, expected);
  });

  it('should properly [crowdsalePurchase] for owner', async function() {
    const ownerPrivateKey = privateKeys[0];

    const ownerBalance = await contract.balanceOf.call(owner);
    const csDetails = await contract.getCrowdsaleDetails.call('crowdsale1');
    const csTokenBalance = csDetails[3];
    const value = 5;

    const data = web3Contract.crowdsalePurchase.getData('crowdsale1', owner);

    const result = await rawTransaction(
      owner,
      ownerPrivateKey,
      contract.address,
      data,
      value
    );

    const ownerBalanceAfter = await contract.balanceOf.call(owner);
    const csTokenBalanceAfter =
      await contract.crowdsaleTokenBalance.call('crowdsale1');

    assert.strictEqual(ownerBalance.toString(), '9.999999999999999999939e+26');
    assert.strictEqual(ownerBalanceAfter.toString(), '9.999999999999999999939025e+26');
    assert.strictEqual(csTokenBalance.toString(), '50000');
    assert.strictEqual(csTokenBalanceAfter.toString(), '47500');
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should properly [crowdsalePurchase] for non-owner', async function() {
    const beneficiary = publicKeys[3];
    const notOwner = publicKeys[1];
    const notOwnerPrivateKey = privateKeys[1];

    const beneficiaryBalance = await contract.balanceOf.call(beneficiary);
    const notOwnerBalance = await contract.balanceOf.call(notOwner);
    const csDetails = await contract.getCrowdsaleDetails.call('crowdsale1');
    const csTokenBalance = csDetails[3];
    const value = 5;

    const data = web3Contract.crowdsalePurchase.getData(
      'crowdsale1', 
      beneficiary
    );

    const result = await rawTransaction(
      notOwner,
      notOwnerPrivateKey,
      contract.address,
      data,
      value
    );

    const beneficiaryBalanceAfter = await contract.balanceOf.call(beneficiary);
    const notOwnerBalanceAfter = await contract.balanceOf.call(notOwner);
    const csTokenBalanceAfter =
      await contract.crowdsaleTokenBalance.call('crowdsale1');

    assert.strictEqual(notOwnerBalance.toString(), notOwnerBalanceAfter.toString());
    assert.strictEqual(beneficiaryBalance.toString(), '0');
    assert.strictEqual(beneficiaryBalanceAfter.toString(), '2500');
    assert.strictEqual(csTokenBalance.toString(), '47500');
    assert.strictEqual(csTokenBalanceAfter.toString(), '45000');
    assert.strictEqual(0, result.indexOf('0x'));
  });

  it('should account for every [event] execution', function(done) {
    wait(5000).then(() => {
      assert.strictEqual(eventCounter.Transfer, 7);
      assert.strictEqual(eventCounter.Approval, 1);
      assert.strictEqual(eventCounter.TokenNameChanged, 1);
      assert.strictEqual(eventCounter.TokenSymbolChanged, 1);
      assert.strictEqual(eventCounter.CrowdsaleDeployed, 2);
      done();
    });
  });
});