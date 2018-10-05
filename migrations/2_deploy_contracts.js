const VTXToken = artifacts.require("./VTXToken.sol");
const VTXTokenCrowdsale = artifacts.require("./VTXTokenCrowdsale.sol");

const ether = (n) => new web3.BigNumber(web3.toWei(n, 'ether'));

const duration = {
  seconds: function (val) { return val; },
  minutes: function (val) { return val * this.seconds(60); },
  hours: function (val) { return val * this.minutes(60); },
  days: function (val) { return val * this.hours(24); },
  weeks: function (val) { return val * this.days(7); },
  years: function (val) { return val * this.days(365); },
};

module.exports = async function(deployer, network, accounts) {
  const _name = "VTX Token";
  const _symbol = "VTX";
  const _decimals = 18;

  await deployer.deploy(VTXToken, _name, _symbol, _decimals);
  const deployedToken = await VTXToken.deployed();

  const latestTime = (new Date).getTime();

  const _rate = 500;
  const _wallet = accounts[0]; // TODO: Replace me
  const _token = deployedToken.address;
  const _openingTime = latestTime + duration.minutes(1);
  const _closingTime = _openingTime + duration.weeks(1);
  const _cap = ether(100);
  const _goal = ether(50);
  const _investorMinCap = ether(0.002);
  const _investorHardCap = ether(50);
  const _foundersFund = accounts[0]; // TODO: Replace me
  const _foundersPercentage = 20;
  const _releaseTime = _closingTime + duration.days(1);

  await deployer.deploy(
    VTXTokenCrowdsale,
    _rate,
    _wallet,
    _token,
    _cap,
    _openingTime,
    _closingTime,
    _goal,
    _investorMinCap,
    _foundersFund,
    _foundersPercentage,
    _releaseTime
  );

  return true;
};
