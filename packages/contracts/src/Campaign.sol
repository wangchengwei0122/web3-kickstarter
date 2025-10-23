// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.30;

import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {ICampaignFactory} from "./ICampaignFactory.sol";

contract Campaign is ReentrancyGuard {
  enum Status {
    Active,
    Successful,
    Failed,
    Cancelled
  }
  event Pledged(address indexed backer, uint256 amount);
  event Finalized(bool success);
  event Refunded(address indexed backer, uint256 amount);
  event Cancelled();
  event Unpledged(address indexed backer, uint256 amount);
  event StatusChanged(Status newStatus);

  address public immutable creator; // 创建者
  address public immutable factory; // 工厂
  string public metadataURI;
  uint256 public goal; // 目标金额
  uint64 public deadline; // 截止时间
  Status public status; // 状态
  uint256 public totalPledged; // 已筹金额
  mapping(address => uint256) public pledges; // 出资

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
  modifier notPaused() {
    require(!ICampaignFactory(factory).paused(), "FACTORY_PAUSED");
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
  function pledge() external payable onlyActive beforeDeadline notPaused nonReentrant {
    require(msg.value > 0, "Amount is required");
    pledges[msg.sender] += msg.value;
    totalPledged += msg.value;
    emit Pledged(msg.sender, msg.value);
  }

  function _finalizeInternal() internal {
    require(status == Status.Active, "ALREADY_FINALIZED");

    bool success = totalPledged >= goal;
    status = success ? Status.Successful : Status.Failed;
    emit Finalized(success);
    emit StatusChanged(status);

    if (success) {
      ICampaignFactory fac = ICampaignFactory(factory);
      uint16 bps = fac.feeBps();
      address tre = fac.treasury();

      uint256 bal = address(this).balance;
      uint256 fee = (bps == 0) ? 0 : (bal * bps) / 10_000;

      if (fee > 0) {
        (bool okF, ) = payable(tre).call{value: fee}("");
        require(okF, "FEE_XFER_FAIL");
        bal -= fee;
      }

      (bool okC, ) = payable(creator).call{value: bal}("");
      require(okC, "CREATOR_XFER_FAIL");
    }
  }

  function finalize() public afterDeadline nonReentrant {
    _finalizeInternal();
  }

  function refund() external nonReentrant {
    if (status == Status.Active && block.timestamp >= deadline) {
      _finalizeInternal(); // auto finalize if campaign is active and deadline is reached
    }

    require(status == Status.Failed, "CAMPAIGN_NOT_FAILED");
    uint256 amount = pledges[msg.sender];
    require(amount > 0, "NO_PLEDGE");

    totalPledged = totalPledged - amount;
    pledges[msg.sender] = 0;

    (bool ok, ) = payable(msg.sender).call{value: amount}("");
    require(ok, "REFUND_FAIL");

    emit Refunded(msg.sender, amount);
  }

  function cancel() external onlyCreator onlyActive {
    require(totalPledged == 0, "CAMPAIGN_HAS_PLEDGE");

    status = Status.Cancelled;

    emit StatusChanged(status);
    emit Cancelled();
  }

  function unpledge(uint256 _amount) external onlyActive beforeDeadline notPaused nonReentrant {
    require(_amount > 0, "NO_PLEDGE");
    require(_amount <= pledges[msg.sender], "AMOUNT_TOO_LARGE");

    totalPledged -= _amount;
    pledges[msg.sender] = pledges[msg.sender] - _amount;

    (bool ok, ) = payable(msg.sender).call{value: _amount}("");
    require(ok, "UNPLEDGE_FAIL");

    emit Unpledged(msg.sender, _amount);
  }

  function getSummary()
    external
    view
    returns (
      address _creator,
      uint256 _goal,
      uint64 _deadline,
      Status _status,
      uint256 _totalPledged,
      string memory _metadataURI,
      address _factory
    )
  {
    return (creator, goal, deadline, status, totalPledged, metadataURI, factory);
  }

  receive() external payable {
    revert("USE_PLEDGE");
  }
  fallback() external payable {
    revert("USE_PLEDGE");
  }
}
