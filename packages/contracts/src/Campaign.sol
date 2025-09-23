// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

contract Campaign is ReentrancyGuard {
  enum Status {
    Active,
    Successful,
    Failed,
    Cancelled
  }
  address creator; // 创建者
  uint256 goal; // 目标金额
  uint64 deadline; // 截止时间
  Status status; // 状态
  uint256 totalPledged; // 已筹金额
  mapping(address => uint256) pledges; // 出资
  mapping(address => uint256) rewards; // 奖励
  mapping(address => uint256) milestones; // 里程碑
}
