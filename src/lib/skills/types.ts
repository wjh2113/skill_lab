export type SkillScope = "personal" | "project";

export type SkillFile = {
  path: string;
  name: string;
  type: "file" | "directory";
  children?: SkillFile[];
};

export type SkillSummary = {
  id: string;
  name: string;
  description: string;
  scope: SkillScope;
  path: string;
  files: SkillFile[];
  lineCount: number;
  disableModelInvocation?: boolean;
  warnings: string[];
  source?: {
    source: string;
    sourceType: string;
    skillPath?: string;
    installedAt?: string;
  };
};

export type CreateSkillInput = {
  name: string;
  description: string;
  scope: SkillScope;
  includeReference?: boolean;
};

export type ImportSkillInput = {
  repoUrl: string;
  skillPath?: string;
  targetScope: SkillScope;
  overwrite?: boolean;
};
