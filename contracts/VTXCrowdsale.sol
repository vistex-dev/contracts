pragma solidity 0.4.24;

import "zeppelin-solidity/contracts/crowdsale/validation/TimedCrowdsale.sol";
import "zeppelin-solidity/contracts/crowdsale/validation/WhitelistedCrowdsale.sol";
import "zeppelin-solidity/contracts/crowdsale/validation/CappedCrowdsale.sol";

contract VTXCrowdsale is TimedCrowdsale, WhitelistedCrowdsale, CappedCrowdsale {

    constructor(
        uint256 _rate,
        address _wallet,
        ERC20 _token,
        uint256 _openingTime,
        uint256 _closingTime,
        uint256 _cap
    )
        public
        Crowdsale(_rate, _wallet, _token)
        TimedCrowdsale(_openingTime, _closingTime)	
        CappedCrowdsale(_cap)
    {
    }

}