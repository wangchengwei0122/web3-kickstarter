import type { Abi } from "viem";
import campaignArtifact from "./Campaign.json";
import campaignFactoryArtifact from "./CampaignFactory.json";

export const campaignAbi = campaignArtifact.abi as Abi;
export const campaignFactoryAbi = campaignFactoryArtifact.abi as Abi;

export type CampaignAbi = typeof campaignAbi;
export type CampaignFactoryAbi = typeof campaignFactoryAbi;
