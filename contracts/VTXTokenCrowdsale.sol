pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/PausableToken.sol";
import "openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "openzeppelin-solidity/contracts/token/ERC20/TokenTimelock.sol";
import "openzeppelin-solidity/contracts/crowdsale/Crowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/emission/MintedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/CappedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/TimedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/WhitelistedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/distribution/RefundableCrowdsale.sol";

contract VTXTokenCrowdsale is Crowdsale, MintedCrowdsale, CappedCrowdsale, TimedCrowdsale, WhitelistedCrowdsale, RefundableCrowdsale {

    // Track investor contributions
    uint256 public investorMinCap = 2000000000000000; // 0.002 ether
    uint256 public investorHardCap = 50000000000000000000; // 50 ether
    mapping(address => uint256) public contributions;

    // Crowdsale Stages
    enum CrowdsaleStage { PreICO, ICO }
    mapping (uint => uint256) stageRate;
    uint8 numberOfStages = 2;
    // Default to presale stage
    CrowdsaleStage public stage = CrowdsaleStage.PreICO;

    // Token Distribution
    uint8 public tokenSalePercentage = 80;
    uint8 public foundersPercentage = 20;

    // Token reserve funds
    address public foundersFund;

    // Token time lock
    uint256 public releaseTime;
    address public foundersTimelock;

    constructor(
      uint256 _preIcoRate,
      uint256 _IcoRate,
      address _wallet,
      ERC20 _token,
      uint256 _cap,
      uint256 _openingTime,
      uint256 _closingTime,
      uint256 _goal,
      uint256 _investorMinCap,
      address _foundersFund,
      uint8 _foundersPercentage,
      uint256 _releaseTime
    )
      Crowdsale(_preIcoRate, _wallet, _token)
      CappedCrowdsale(_cap)
      TimedCrowdsale(_openingTime, _closingTime)
      RefundableCrowdsale(_goal)
      public
    {
        require(_goal <= _cap);
        investorMinCap = _investorMinCap;
        foundersFund = _foundersFund;
        foundersPercentage = _foundersPercentage;
        tokenSalePercentage = 100 - foundersPercentage;
        releaseTime = _releaseTime;
        setStageRate(CrowdsaleStage.PreICO, _preIcoRate);
        setStageRate(CrowdsaleStage.ICO, _IcoRate);
    }

    /**
    * @dev Returns the rate for a given stage
    * @param _stage CrowdsaleStage that we want the rate for
    * @return rate for the given stage
    */
    function getStageRate(CrowdsaleStage _stage) private view returns (uint256) {
        return stageRate[uint(_stage)];
    }

    /**
    * @dev Sets the rate for a given stage
    * @param _stage CrowdsaleStage that we want to set the rate for
    * @param _rate uint256 rate that we want to set for the given stage
    */
    function setStageRate(CrowdsaleStage _stage, uint256 _rate) private {
        stageRate[uint(_stage)] = _rate;
    }

    /**
    * @dev Returns the amount contributed so far by a sepecific user.
    * @param _beneficiary Address of contributor
    * @return User contribution so far
    */
    function getUserContribution(address _beneficiary)
      public view returns (uint256)
    {
        return contributions[_beneficiary];
    }

    /**
    * @dev Allows admin to update the crowdsale stage
    * @param _stage Crowdsale stage
    */
    function setCrowdsaleStage(uint _stage) public onlyOwner {
        require(uint(_stage) <= numberOfStages);
        stage = CrowdsaleStage(_stage);
        rate = getStageRate(stage);
    }

    /**
    * @dev forwards funds to the wallet during the PreICO stage, then the refund vault during ICO stage
    */
    function _forwardFunds() internal {
        if(stage == CrowdsaleStage.PreICO) {
            wallet.transfer(msg.value);
        } else if (stage == CrowdsaleStage.ICO) {
            super._forwardFunds();
        }
    }

    /**
    * @dev Extend parent behavior requiring purchase to respect investor min/max funding cap.
    * @param _beneficiary Token purchaser
    * @param _weiAmount Amount of wei contributed
    */
    function _preValidatePurchase(
        address _beneficiary,
        uint256 _weiAmount
    )
      internal
    {
        super._preValidatePurchase(_beneficiary, _weiAmount);
        uint256 _existingContribution = contributions[_beneficiary];
        uint256 _newContribution = _existingContribution.add(_weiAmount);
        require(_newContribution >= investorMinCap && _newContribution <= investorHardCap);
        contributions[_beneficiary] = _newContribution;
    }


    /**
    * @dev enables token transfers, called when owner calls finalize()
    */
    function finalization() internal {
        if(goalReached()) {
            MintableToken _mintableToken = MintableToken(token);
            uint256 _alreadyMinted = _mintableToken.totalSupply();
            uint256 _finalTotalSupply = _alreadyMinted.div(tokenSalePercentage).mul(100);

            foundersTimelock = new TokenTimelock(token, foundersFund, releaseTime);

            _mintableToken.mint(foundersTimelock, _finalTotalSupply.div(100 / foundersPercentage));
            _mintableToken.finishMinting();

            // Unpause the token
            PausableToken _pausableToken = PausableToken(token);
            _pausableToken.unpause();
            _pausableToken.transferOwnership(wallet);
        }
        super.finalization();
    }
}
