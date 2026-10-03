import type { SkillSummary } from "@/lib/skills/types";

export type SkillMatchResult = {
  skillId: string;
  name: string;
  scope: string;
  score: number;
  matchedTerms: string[];
  description: string;
  selected: boolean;
};

const TRIGGER_MAP: Record<string, string[]> = {
  "english-blog-translate": [
    "translate",
    "translation",
    "blog",
    "url",
    "markdown",
    "archive",
    "翻译",
    "博客",
    "英文",
  ],
  "resume-optimizer": [
    "resume",
    "cv",
    "jd",
    "job",
    "简历",
    "求职",
    "岗位",
  ],
  pdf: ["pdf", "PDF", "文档", "整理"],
  docx: ["docx", "word", "文档", "doc"],
};

function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const english = lower.match(/[a-z0-9-]+/g) ?? [];
  const chinese = text.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  return [...english, ...chinese.map((c) => c.toLowerCase())];
}

function extractUrlHost(prompt: string): string | null {
  const match = prompt.match(/https?:\/\/([^/\s]+)/i);
  return match?.[1]?.replace(/^www\./, "") ?? null;
}

export function scoreSkillsAgainstPrompt(
  prompt: string,
  skills: SkillSummary[],
  forcedSkillId?: string
): SkillMatchResult[] {
  const promptTokens = new Set(tokenize(prompt));
  const urlHost = extractUrlHost(prompt);

  const results = skills.map((skill) => {
    const descTokens = tokenize(skill.description + " " + skill.name);
    const matchedTerms: string[] = [];

    for (const token of descTokens) {
      if (token.length < 2) continue;
      if (promptTokens.has(token)) {
        matchedTerms.push(token);
      }
    }

    const triggers = TRIGGER_MAP[skill.name] ?? [];
    for (const trigger of triggers) {
      if (
        prompt.toLowerCase().includes(trigger.toLowerCase()) &&
        !matchedTerms.includes(trigger)
      ) {
        matchedTerms.push(trigger);
      }
    }

    if (urlHost && skill.name.includes("blog") && prompt.includes("http")) {
      matchedTerms.push(`url:${urlHost}`);
    }

    let score = Math.min(100, matchedTerms.length * 12 + (matchedTerms.length > 0 ? 20 : 0));

    if (skill.description && prompt.length > 10) {
      const descLower = skill.description.toLowerCase();
      const promptLower = prompt.toLowerCase();
      if (descLower.split(" ").some((w) => w.length > 4 && promptLower.includes(w))) {
        score += 15;
      }
    }

    if (forcedSkillId && skill.id === forcedSkillId) {
      score = 100;
      if (!matchedTerms.includes("实验室指定")) {
        matchedTerms.unshift("实验室指定");
      }
    }

    score = Math.min(100, score);

    return {
      skillId: skill.id,
      name: skill.name,
      scope: skill.scope,
      score,
      matchedTerms: [...new Set(matchedTerms)],
      description: skill.description,
      selected: false,
    };
  });

  return results.sort((a, b) => b.score - a.score);
}

export function pickBestMatch(
  results: SkillMatchResult[],
  forcedSkillId?: string
): SkillMatchResult | null {
  if (forcedSkillId) {
    const forced = results.find((r) => r.skillId === forcedSkillId);
    if (forced) return { ...forced, selected: true, score: 100 };
  }
  const best = results[0];
  if (!best || best.score === 0) return null;
  return { ...best, selected: true };
}
