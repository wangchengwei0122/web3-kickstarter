// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {Counter} from "../src/Counter.sol";

contract Deploy is Script {
  using stdJson for string;

  function run() external {
    // 从环境变量读取私钥（anvil/测试网都适用）
    // anvil 下可直接填控制台给出的私钥
    uint256 pk = vm.envUint("PRIVATE_KEY");

    vm.startBroadcast(pk);
    Counter counter = new Counter();
    vm.stopBroadcast();

    // 1) 控制台打印地址
    console2.log("Counter deployed at:", address(counter));
    console2.log("ChainId:", block.chainid);

    // 2) 写入 JSON，给前端读取
    //   输出路径：<repo root>/packages/contracts/deployments/<chainId>.json
    string memory root = vm.projectRoot();
    string memory path = string.concat(root, "/deployments/", vm.toString(block.chainid), ".json");

    // 组装 JSON 对象 { "Counter": "0x..." }
    string memory json = vm.serializeAddress("addrs", "Counter", address(counter));
    // 将上面的对象写入到 path（如果已存在会被覆盖）
    vm.writeJson(json, path);

    console2.log("Wrote deployment file:", path);
  }
}
