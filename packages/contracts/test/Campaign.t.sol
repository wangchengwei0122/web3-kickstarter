// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {CampaignFactory} from "../src/CampaignFactory.sol";
import {Campaign} from "../src/Campaign.sol";

contract CampaignTest is Test {
  CampaignFactory public factory;
  Campaign public campaign;

  address public creator = address(1);
  address public backer1 = address(2);
  address public backer2 = address(3);

  function setUp() public {
    vm.deal(creator, 100 ether);
    vm.deal(backer1, 100 ether);
    vm.deal(backer2, 100 ether);

    factory = new CampaignFactory(address(this), 500);

    vm.startPrank(creator);

    address campaignAddress = factory.createCampaign(
      10 ether,
      uint64(block.timestamp + 1 days),
      "https://campaign.com"
    );
    campaign = Campaign(payable(campaignAddress));

    vm.stopPrank();
  }
  function test_PledgeAndUnpledge() public {
    vm.startPrank(backer1);

    campaign.pledge{value: 3 ether}();
    campaign.unpledge(1 ether);
    vm.stopPrank();

    (, , , , uint256 total, , ) = campaign.getSummary();
    assertEq(total, 2 ether, "totalPledged mismatch");
  }

  function test_FinalizeSuccess() public {
    vm.startPrank(backer1);
    campaign.pledge{value: 8 ether}();
    vm.stopPrank();

    vm.startPrank(backer2);
    campaign.pledge{value: 5 ether}();
    vm.stopPrank();

    vm.warp(block.timestamp + 2 days);
    vm.prank(backer1);
    campaign.finalize();

    assertEq(uint(campaign.status()), uint(Campaign.Status.Successful));

    // 平台费断言（13 ETH * 5% = 0.65 ETH）
    uint256 fee = (13 ether * 500) / 10_000;
    assertEq(address(this).balance, fee, "Treasury fee incorrect");
  }

  function test_RefundAfterFail() public {
    vm.prank(backer1);
    campaign.pledge{value: 2 ether}();

    vm.warp(block.timestamp + 2 days);
    campaign.finalize(); // 达不到 10 ETH -> Failed

    vm.startPrank(backer1);
    uint256 balBefore = backer1.balance;
    campaign.refund();
    vm.stopPrank();

    assertGt(backer1.balance, balBefore, "refund not received");
    assertEq(uint(campaign.status()), uint(Campaign.Status.Failed));
  }

  function test_CancelByCreator() public {
    vm.prank(creator);
    campaign.cancel();
    assertEq(uint(campaign.status()), uint(Campaign.Status.Cancelled));
  }
}
