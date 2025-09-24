// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

contract Campaign is ReentrancyGuard {
  event Pledged(address indexed backer, uint256 amount);
  event Finalized(bool success);
  event Refunded(address indexed backer, uint256 amount);
  event Cancelled();
  event Unpledged(address indexed backer, uint256 amount);

  enum Status {
    Active,
    Successful,
    Failed,
    Cancelled
  }
  address creator; // 创建者
  address public immutable factory; // 工厂
  string public metadataURI;
  uint256 goal; // 目标金额
  uint64 deadline; // 截止时间
  Status status; // 状态
  uint256 totalPledged; // 已筹金额
  mapping(address => uint256) pledges; // 出资
  mapping(address => uint256) rewards; // 奖励
  mapping(address => uint256) milestones; // 里程碑

  modifier onlyCreator() {
    require(msg.sender == creator, "Only creator can call this function");
    _;
  }

  modifier onlyActive() {
    require(status == Status.Active, "Campaign is not active");
    _;
  }

  modifier beforeDeadline() {
    require(block.timestamp < deadline, "Campaign is over");
    _;
  }

  modifier afterDeadline() {
    require(block.timestamp >= deadline, "Campaign is not over");
    _;
  }

  constructor(
    address _creator,
    address _factory,
    uint256 _goal,
    uint64 _deadline,
    string memory _metadataURI
  ) {
    require(_creator != address(0), "Creator is required");
    require(_goal > 0, "Goal is required");
    require(_deadline > block.timestamp, "BAD_DEADLINE");
    require(bytes(_metadataURI).length > 0, "INVALID_METADATA_URI");
    require(_factory != address(0), "Factory is required");

    creator = _creator;
    factory = _factory;
    goal = _goal;
    deadline = _deadline;
    status = Status.Active;
    totalPledged = 0;
    metadataURI = _metadataURI;
  }

  // 出资
  function pledge() external payable onlyActive beforeDeadline nonReentrant {
    require(msg.value > 0, "Amount is required");
    pledges[msg.sender] += msg.value;
    totalPledged += msg.value;
    emit Pledged(msg.sender, msg.value);
  }

  function finalize() external onlyCreator afterDeadline nonReentrant {
    bool success = totalPledged >= goal;
    if (success) {
      status = Status.Successful;
      (bool ok, ) = payable(creator).call{value: address(this).balance}("");
      require(ok, "CREATOR_XFER_FAIL");
      emit Finalized(true);
    } else {
      status = Status.Failed;
      emit Finalized(false);
    }
  }

  function refund() external nonReentrant {
    require(status == Status.Failed, "CAMPAIGN_NOT_FAILED");
    uint256 amount = pledges[msg.sender];
    require(amount > 0, "NO_PLEDGE");
    totalPledged = totalPledged - amount;
    pledges[msg.sender] = 0;
    (bool ok, ) = payable(msg.sender).call{value: amount}("");
    require(ok, "REFUND_FAIL");
    emit Refunded(msg.sender, amount);
  }

  function cancel() external onlyCreator nonReentrant {
    require(status == Status.Active, "CAMPAIGN_NOT_ACTIVE");
    require(totalPledged == 0, "CAMPAIGN_HAS_PLEDGE");
    status = Status.Cancelled;
    emit Cancelled();
  }

  function unpledge(uint256 _amount) external onlyActive beforeDeadline nonReentrant {
    require(_amount > 0, "NO_PLEDGE");
    require(_amount <= pledges[msg.sender], "AMOUNT_TOO_LARGE");
    totalPledged -= _amount;
    pledges[msg.sender] = pledges[msg.sender] - _amount;
    emit Unpledged(msg.sender, _amount);
    (bool ok, ) = payable(msg.sender).call{value: _amount}("");
    require(ok, "UNPLEDGE_FAIL");
  }

  function getSummary()
    external
    view
    returns (
      address _creator,
      uint256 _goal,
      uint64 _deadline,
      Status _status,
      uint256 _totalPledged
    )
  {
    return (creator, goal, deadline, status, totalPledged);
  }

  receive() external payable {
    revert("USE_PLEDGE");
  }
  fallback() external payable {
    revert("USE_PLEDGE");
  }
}
