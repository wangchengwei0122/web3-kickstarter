// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface ICampaignFactory {
  function createCampaign(
    uint256 goal,
    uint64 deadline,
    string memory metadataURI
  ) external returns (address campaign);

  function setFeeBps(uint16 _bps) external;

  // function feeBps() external view returns (uint16);
  //   function treasury() external view returns (address);
}
