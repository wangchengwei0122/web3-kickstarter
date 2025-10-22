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

  /// ❌ 未到截止时间 finalize 应失败
  function testCannotFinalizeBeforeDeadline() public {
    vm.expectRevert("Campaign is not over");
    campaign.finalize();
  }

  /// ❌ 重复 finalize 应失败
  function testCannotFinalizeTwice() public {
    vm.prank(backer1);
    campaign.pledge{value: 11 ether}(); // 达标
    vm.warp(block.timestamp + 2 days);
    campaign.finalize();

    vm.expectRevert("ALREADY_FINALIZED");
    campaign.finalize();
  }

  /// ❌ 未出资用户退款应失败
  function testCannotRefundWithoutPledge() public {
    vm.warp(block.timestamp + 2 days);
    campaign.finalize();
    vm.expectRevert("NO_PLEDGE");
    campaign.refund();
  }

  /// ❌ 未达标但没 finalize 时，直接 refund 应自动 finalize -> 失败
  function testRefundAutoFinalizeFailure() public {
    vm.prank(backer1);
    campaign.pledge{value: 1 ether}();

    // 超时但没手动 finalize
    vm.warp(block.timestamp + 2 days);

    // refund 时会自动 finalize -> Failed
    uint256 before = backer1.balance;
    vm.startPrank(backer1);
    campaign.refund();
    vm.stopPrank();

    assertGt(backer1.balance, before, "refund not returned");
    assertEq(uint(campaign.status()), uint(Campaign.Status.Failed));
  }

  /// ❌ 过大 unpledge 应 revert
  function testCannotUnpledgeMoreThanPledged() public {
    vm.prank(backer1);
    campaign.pledge{value: 1 ether}();

    vm.startPrank(backer1);
    vm.expectRevert("AMOUNT_TOO_LARGE");
    campaign.unpledge(2 ether);
    vm.stopPrank();
  }

  /// ❌ 有出资后 Creator 不可取消
  function testCannotCancelAfterPledge() public {
    vm.prank(backer1);
    campaign.pledge{value: 1 ether}();

    vm.prank(creator);
    vm.expectRevert("CAMPAIGN_HAS_PLEDGE");
    campaign.cancel();
  }

  /// ❌ Factory 被暂停后禁止创建
  function testCannotCreateWhenPaused() public {
    factory.setPaused(true);
    vm.expectRevert("PAUSED");
    vm.prank(creator);
    factory.createCampaign(1 ether, uint64(block.timestamp + 1 days), "ipfs://meta");
  }
}
