// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

struct Campaign {
  address creator; // 创建者
  uint256 goal; //目标金额
  uint256 deadline; // 截止时间
  uint256 totalPledged; // 已筹金额
  uint256 status; // 状态
  mapping(address => uint256) pledges; // 出资
  mapping(address => uint256) rewards; // 奖励
  mapping(address => uint256) milestones; // 里程碑
}

contract CampaignFactory {
  address owner;
  Campaign[] campaigns;
  address treasury; // 资金库
  uint256 feeBps; // 平台费

  constructor() {
    owner = msg.sender;
  }

  function createCampaign(uint256 goal, uint256 deadline) public returns (address) {
    // Campaign campaign = new Campaign(msg.sender, goal, deadline);
    // campaigns.push(campaign);
    // return address(campaign);
  }
}
