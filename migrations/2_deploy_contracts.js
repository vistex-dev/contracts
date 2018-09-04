const TokenWithCrowdsale = artifacts.require('TokenWithCrowdsale');

module.exports = (deployer) => {
  deployer.deploy(TokenWithCrowdsale);
};