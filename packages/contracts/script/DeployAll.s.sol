// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

import {CampaignFactory} from "../src/CampaignFactory.sol";

contract DeployAll is Script {
  using stdJson for string;

  function run() external {
    // 环境变量（请在 .env 或外部 export）
    uint256 pk = vm.envUint("PRIVATE_KEY"); // 必填：部署私钥
    address treasury = vm.envAddress("TREASURY"); // 必填：资金库地址
    uint16 feeBps = uint16(vm.envUint("FEE_BPS")); // 必填：平台费 bps，0~10000

    // 可选：创建一个示例 Campaign 的参数（不想示例就别设置或别调用创建）
    uint256 goal = vm.envOr("GOAL", uint256(0)); // 0 表示不创建
    uint64 deadline = uint64(vm.envOr("DEADLINE", uint256(0))); // 时间戳
    string memory metadataUri = vm.envOr("METADATA_URI", string(""));

    vm.startBroadcast(pk);

    // 1) 部署 Factory
    CampaignFactory factory = new CampaignFactory(treasury, feeBps);
    console2.log("CampaignFactory:", address(factory));

    // 2) （可选）创建一个示例 Campaign（通过工厂）
    address campaignAddr = address(0);
    if (goal > 0 && deadline > block.timestamp && bytes(metadataUri).length > 0) {
      campaignAddr = factory.createCampaign(goal, deadline, metadataUri);
      console2.log("Sample Campaign:", campaignAddr);
    }

    vm.stopBroadcast();

    // 3) 将地址写入 deployments/<chainId>.json
    string memory root = vm.projectRoot();
    string memory path = string.concat(root, "/deployments/", vm.toString(block.chainid), ".json");

    // 组织 JSON：{ "chainId": "31337", "factory": "0x..", "deployBlock": "12345", "SampleCampaign": "0x.." }
    string memory json;
    json = vm.serializeUint("deployment", "chainId", block.chainid);
    json = vm.serializeAddress("deployment", "factory", address(factory));
    json = vm.serializeUint("deployment", "deployBlock", block.number);
    if (campaignAddr != address(0)) {
      json = vm.serializeAddress("deployment", "SampleCampaign", campaignAddr);
    }
    vm.writeJson(json, path);

    console2.log("Wrote deployment file:", path);
  }
}
