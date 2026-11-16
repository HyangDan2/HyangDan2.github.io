/**
 * The diary's category taxonomy. Post frontmatter `category` is matched against
 * these names; anything new becomes a category of its own at build time.
 */
export const CATEGORIES = [
  {
    name: "Devlog",
    slug: "devlog",
    index: "01",
    blurb: "무엇을 만들고 있는지, 무엇이 바뀌었는지.",
    topics: "Builds · Releases · Daily work",
  },
  {
    name: "Architecture",
    slug: "architecture",
    index: "02",
    blurb: "구조를 정하는 결정과 그 이유.",
    topics: "Design · Structure · Trade-offs",
  },
  {
    name: "Troubleshooting",
    slug: "troubleshooting",
    index: "03",
    blurb: "막혔던 지점과 뚫은 방법.",
    topics: "Bugs · Failures · Fixes",
  },
  {
    name: "Notes",
    slug: "notes",
    index: "04",
    blurb: "짧게 적어 두는 생각과 참고거리.",
    topics: "Notes · Links · Ideas",
  },
];

export const DEFAULT_CATEGORY = "Notes";

export function findCategory(value) {
  const needle = String(value ?? "").trim().toLowerCase();
  return CATEGORIES.find((category) => category.slug === needle || category.name.toLowerCase() === needle) ?? null;
}
