import type { Abi } from "viem";
import campaignArtifact from "@packages/contracts/abi/Campaign.json";
import campaignFactoryArtifact from "@packages/contracts/abi/CampaignFactory.json";

export const campaignAbi = campaignArtifact.abi as Abi;
export const campaignFactoryAbi = campaignFactoryArtifact.abi as Abi;

export type CampaignAbi = typeof campaignAbi;
export type CampaignFactoryAbi = typeof campaignFactoryAbi;
