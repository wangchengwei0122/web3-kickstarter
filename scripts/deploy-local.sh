#!/bin/bash
set -e

cd packages/contracts
export PRIVATE_KEY=0x$(anvil --dump-state | jq -r '.accounts[0].privateKey')
forge script script/Deploy.s.sol:Deploy \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast