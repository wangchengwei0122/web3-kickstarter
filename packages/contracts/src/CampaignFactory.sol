// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.30;
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import {Campaign} from "./Campaign.sol";

contract CampaignFactory is Ownable {
  event CampaignCreated(address campaign, address indexed creator, uint256 indexed id);
  event FeeBpsUpdated(uint16 oldFee, uint16 newFee);
  event TreasuryUpdated(address oldTreasury, address newTreasury);
  event Paused(bool paused);
  event CreatorBanned(address indexed creator, bool banned);

  address public treasury; // 资金库
  uint16 public feeBps; // 平台费
  bool public paused;
  address[] public campaigns;
  mapping(address => bool) public bannedCreators;
  mapping(address => address[]) public userCampaigns;

  constructor(address _treasury, uint16 _feeBps) Ownable(msg.sender) {
    require(_treasury != address(0), "INVALID_TREASURY");
    require(_feeBps <= 10_000, "FEE_TOO_HIGH");

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

  function setPaused(bool _p) external onlyOwner {
    paused = _p;
    emit Paused(_p);
  }

  function setBanned(address creator, bool banned) external onlyOwner {
    bannedCreators[creator] = banned;
    emit CreatorBanned(creator, banned);
  }

  function createCampaign(
    uint256 goal,
    uint64 deadline,
    string memory metadataURI
  ) external returns (address campaign) {
    require(!paused, "PAUSED");
    require(!bannedCreators[msg.sender], "CREATOR_BANNED");
    require(goal > 0, "INVALID_GOAL");
    require(deadline > block.timestamp, "INVALID_DEADLINE");
    require(bytes(metadataURI).length > 0, "INVALID_METADATA_URI");

    campaign = address(new Campaign(msg.sender, address(this), goal, deadline, metadataURI));
    campaigns.push(campaign);
    userCampaigns[msg.sender].push(campaign);

    emit CampaignCreated(campaign, msg.sender, campaigns.length - 1);
  }

  function campaignsLength() external view returns (uint256) {
    return campaigns.length;
  }

  function getUserCampaigns(address user) external view returns (address[] memory) {
    return userCampaigns[user];
  }
}
