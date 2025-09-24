// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import {Campaign} from "./Campaign.sol";

// struct Campaign {
//   address creator; // 创建者
//   uint256 goal; //目标金额
//   uint256 deadline; // 截止时间
//   uint256 totalPledged; // 已筹金额
//   uint256 status; // 状态
//   mapping(address => uint256) pledges; // 出资
//   mapping(address => uint256) rewards; // 奖励
//   mapping(address => uint256) milestones; // 里程碑
// }

contract CampaignFactory is Ownable {
  address treasury; // 资金库
  uint16 feeBps; // 平台费

  address[] public campaigns;

  event CampaignCreated(address campaign, address indexed creator, uint256 indexed id);
  event FeeBpsUpdated(uint16 oldFee, uint16 newFee);
  event TreasuryUpdated(address oldTreasury, address newTreasury);

  constructor(address _treasury, uint16 _feeBps) Ownable(msg.sender) {
    require(_treasury != address(0), "INVALID_TREASURY");
    require(_feeBps > 0 && _feeBps <= 10000, "INVALID_FEE_BPS");

    treasury = _treasury;
    feeBps = _feeBps;
  }

  function setTreasury(address _treasury) external onlyOwner {
    require(_treasury != address(0), "INVALID_TREASURY");
    emit TreasuryUpdated(treasury, _treasury);
    treasury = _treasury;
  }

  function setFeeBps(uint16 _bps) external onlyOwner {
    require(_bps <= 10_000, "FEE_TOO_HIGH");
    emit FeeBpsUpdated(feeBps, _bps);
    feeBps = _bps;
  }

  function campaignsLength() external view returns (uint256) {
    return campaigns.length;
  }

  function createCampaign(
    uint256 goal,
    uint64 deadline,
    string memory metadataURI
  ) external returns (address campaign) {
    require(goal > 0, "INVALID_GOAL");
    require(deadline > block.timestamp, "INVALID_DEADLINE");
    require(bytes(metadataURI).length > 0, "INVALID_METADATA_URI");
    campaign = address(new Campaign(msg.sender, address(this), goal, deadline, metadataURI));
    campaigns.push(campaign);
    emit CampaignCreated(campaign, msg.sender, campaigns.length - 1);
  }
}
