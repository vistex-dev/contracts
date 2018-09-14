pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";

contract VTXToken is MintableToken {
  string public constant name = "VTX Crowdsale Token";
  string public constant symbol = "VTX";
  uint8 public constant decimals = 18;
}
