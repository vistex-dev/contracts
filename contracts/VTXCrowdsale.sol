pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/WhitelistedCrowdsale.sol";

contract VTXCrowdsale is WhitelistedCrowdsale {
  constructor
  (
    uint256 _rate,
    address _wallet,
    ERC20 _token
  )
    Crowdsale(_rate, _wallet, _token)
    public
  {}
}