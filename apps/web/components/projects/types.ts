export type ProjectStatus = "active" | "successful" | "failed" | "cancelled";

export type ProjectSummary = {
  id: string;
  title: string;
  summary: string;
  goalAmount: number;
  pledgedAmount: number;
  deadline: string; // ISO string for now
  status: ProjectStatus;
  creator: string;
  category: string;
  imageUrl: string;
};

export type ProjectDetail = ProjectSummary & {
  description: string;
  owner: string;
  backerCount: number;
};
