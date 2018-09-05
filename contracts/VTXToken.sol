pragma solidity 0.4.24;

import "zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";

contract VTXToken is MintableToken {
    string public constant name = "My Token";
    string public constant symbol = "MYT";
    uint8 public constant decimals = 18;
}