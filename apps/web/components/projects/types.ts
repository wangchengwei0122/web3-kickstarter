export type ProjectStatus = "active" | "successful" | "failed" | "cancelled";

export type ProjectSummary = {
  id: string;
  title: string;
  summary: string;
  goalAmount: number;
  pledgedAmount: number;
  deadline: string; // ISO string for now
  status: ProjectStatus;
};

export type ProjectDetail = ProjectSummary & {
  description: string;
  owner: string;
  category?: string;
  backerCount: number;
};
