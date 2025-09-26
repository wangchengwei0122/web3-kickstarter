export type ProjectStatus = "active" | "successful" | "failed" | "cancelled";

export type ProjectSummary = {
  id: string;
  title: string;
  summary: string;
  goalAmount: number;
  pledgedAmount: number;
  deadline: string; // ISO string
  status: ProjectStatus;
  creator: string;
  category: string;
  imageUrl: string;
  progress?: number;
  raw?: {
    address: string;
    creator: string;
    goal: string;
    deadline: number;
    status: number;
    totalPledged: string;
    metadataURI: string;
    createdAt: number;
    createdBlock: number;
  };
};

export type ProjectDetail = ProjectSummary & {
  description: string;
  owner: string;
  backerCount: number;
};
