// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

// import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Campaign {
  address creator;
  uint256 goal;
  uint256 deadline;
  uint256 totalPledged;
  uint256 status;
  mapping(address => uint256) pledges;
  mapping(address => uint256) rewards;
  mapping(address => uint256) milestones;
  constructor(address _creator, uint256 _goal, uint256 _deadline) {
    creator = _creator;
    goal = _goal;
    deadline = _deadline;
    totalPledged = 0;
    status = 0;
  }
}
