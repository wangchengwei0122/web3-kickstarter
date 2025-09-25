// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface ICampaignFactory {
  function feeBps() external view returns (uint16);
  function treasury() external view returns (address);
}
