pragma solidity 0.4.24;

import "zeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * Token
 *
 * @title a fixed supply ERC20 token
 */
contract Token {
    using SafeMath for uint;

    event Transfer (
      address indexed _from,
      address indexed _to,
      uint _value
    );

    event Approval(
      address indexed _from,
      address indexed _to,
      uint _value
    );

    string public symbol;
    string public name;
    uint8 public decimals;
    uint public totalSupply;

    mapping(address => uint) balances;
    mapping(address => mapping(address => uint)) allowed;

    /**
    * Constructs the Token contract and gives all of the supply to the address
    * that deployed it. The fixed supply is 1 billion tokens with up to 18
    * decimal places.
    */
    constructor() public {
        symbol = "TOK";
        name = "Token";
        decimals = 18;
        totalSupply = 1000000000 * 10**uint(decimals);
        balances[msg.sender] = totalSupply;
        Transfer(address(0), msg.sender, totalSupply);
    }

    /**
    * @dev Fallback function
    */
    function() public payable { revert(); }

    /**
    * Gets the token balance of any wallet.
    * @param _owner Wallet address of the returned token balance.
    * @return The balance of tokens in the wallet.
    */
    function balanceOf(address _owner) public view returns (uint balance) {
        return balances[_owner];
    }

    /**
    * Transfers tokens from senders wallet to specified _to wallet.
    * @param _to Address of the transfers recipient.
    * @param _value Number of tokens to transfer.
    * @return True if transfer succeeded, false if not.
    function transfer(address _to, uint _value) public returns (bool success) {
      balances[msg.sender] = balances[msg.sender].sub(_value);
      balances[_to] = balances[_to].add(_value);
      Transfer(msg.sender, _to, _value);
      return true;
    }

    /**
    * Transfer tokens from any wallet to the specified _to wallet.
    * This only works if the _from wallet has already allocated tokens
    * for the callet keyset using approve. From wallet must have sufficient
    * balance to transfer. Caller must have sufficient allowance for transfer.
    * @param _from Wallet address that the tokens are taken from.
    * @param _to Address of the transfers recipient.
    * @param _value Number of tokens to transfer.
    * @return True if transfer succeeded, false if not.
    */
    function transferFrom(address _from, address _to, uint _value)
      public
      returns (bool success) {
        balances[_from] = balances[_from].sub(_value);
        balances[_to] = balances[_to].add(_value);
        Transfer(_from, _to, _value);
        return true;
    }

    /**
    * Sender allows another wallet to transferFrom tokens from their wallet.
    * @param _spender Address of transferFrom recipient.
    * @param _value Number of tokens to transferFrom.
    * @return True if transfer succeeded, false if not.
    */
    function approve(address _spender, uint _value)
      public
      returns (bool success) {
        allowed[msg.sender][_spender] = _value;
        Approval(msg.sender, _spender, _value);
        return true;
    }

    /**
    * Get the number of tokens that a _owner has approved for a _spender
    * to transfer from.
    * @param _owner Wallet address that tokens can be withdrawn from.
    * @param _spender Wallet address that tokens can be deposited to.
    * @return The number of tokens allowed to be transfered.
    */
    function allowance(address _owner, address _spender)
      public
      view
      returns (uint remaining) {
        return allowed[_owner][_spender];
    }

}
