pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/crowdsale/validation/CappedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/emission/MintedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/distribution/RefundableCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/WhitelistedCrowdsale.sol";
import "openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";

contract VTXCrowdsale is WhitelistedCrowdsale, CappedCrowdsale, RefundableCrowdsale, MintedCrowdsale {
    constructor
    (
        uint256 openingTime,
        uint256 closingTime,
        uint256 rate,
        address wallet,
        uint256 cap,
        MintableToken token,
        uint256 goal
    )
        public
        Crowdsale(rate, wallet, token)
        CappedCrowdsale(cap)
        TimedCrowdsale(openingTime, closingTime)
        RefundableCrowdsale(goal)
    {
        require(goal <= cap);
    }
}
