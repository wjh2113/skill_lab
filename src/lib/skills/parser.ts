import matter from "gray-matter";

export type ParsedSkillFrontmatter = {
  name?: string;
  description?: string;
  disableModelInvocation?: boolean;
};

export function parseSkillMarkdown(content: string): {
  frontmatter: ParsedSkillFrontmatter;
  body: string;
} {
  const { data, content: body } = matter(content);
  return {
    frontmatter: {
      name: typeof data.name === "string" ? data.name : undefined,
      description: typeof data.description === "string" ? data.description : undefined,
      disableModelInvocation:
        data["disable-model-invocation"] === true ||
        data.disableModelInvocation === true,
    },
    body,
  };
}

export function validateSkillName(name: string): string | null {
  if (!name) return "名称不能为空";
  if (name.length > 64) return "名称不能超过 64 个字符";
  if (!/^[a-z0-9-]+$/.test(name)) {
    return "名称只能包含小写字母、数字和连字符";
  }
  return null;
}
