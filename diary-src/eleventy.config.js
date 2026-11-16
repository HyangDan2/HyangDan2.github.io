import markdownIt from "markdown-it";
import hljs from "highlight.js";
import { CATEGORIES, DEFAULT_CATEGORY, findCategory } from "./lib/categories.js";
import { displayDate, htmlDate, koreanDate, relativeDate, slugify, postSlugFromPath } from "./lib/utils.js";

const LINE_NUMBERS = false;

const md = markdownIt({
  html: true,
  linkify: true,
  typographer: false,
  highlight(code, language) {
    const lang = (language || "").trim().toLowerCase();
    if (lang && hljs.getLanguage(lang)) {
      try {
        const highlighted = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
        return wrapCode(highlighted, lang);
      } catch {
        /* fall through to plain output */
      }
    }
    return wrapCode(md.utils.escapeHtml(code), lang || "text");
  },
});

function wrapCode(inner, lang) {
  const label = lang || "text";
  const lines = LINE_NUMBERS ? `<span class="code-lines" aria-hidden="true"></span>` : "";
  return `<pre class="code-block" data-lang="${md.utils.escapeHtml(label)}"><code class="hljs language-${md.utils.escapeHtml(label)}">${inner}</code></pre>`;
}

export default function (eleventyConfig) {
  /* ---------- passthrough ---------- */
  eleventyConfig.addPassthroughCopy({ assets: "assets" });
  eleventyConfig.addWatchTarget("./assets/");

  /* ---------- markdown ---------- */
  eleventyConfig.setLibrary("md", md);
  eleventyConfig.amendLibrary("md", (lib) => {
    // Tables get a scroll container so wide tables never break the layout.
    lib.renderer.rules.table_open = () => '<div class="table-wrap"><table>';
    lib.renderer.rules.table_close = () => "</table></div>";
    // External links open in a new tab; internal ones stay put.
    const defaultLinkOpen = lib.renderer.rules.link_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
    lib.renderer.rules.link_open = (tokens, idx, options, env, self) => {
      const href = tokens[idx].attrGet("href") || "";
      if (/^https?:/i.test(href)) {
        tokens[idx].attrSet("target", "_blank");
        tokens[idx].attrSet("rel", "noopener noreferrer");
        tokens[idx].attrJoin("class", "external-link");
      }
      return defaultLinkOpen(tokens, idx, options, env, self);
    };
  });

  /* ---------- filters ---------- */
  eleventyConfig.addFilter("slugify", slugify);
  eleventyConfig.addFilter("displayDate", displayDate);
  eleventyConfig.addFilter("htmlDate", htmlDate);
  eleventyConfig.addFilter("koreanDate", koreanDate);
  eleventyConfig.addFilter("relativeDate", relativeDate);
  eleventyConfig.addFilter("limit", (array = [], count = array.length) => array.slice(0, count));
  eleventyConfig.addFilter("categoryName", (value) => findCategory(value)?.name ?? (value || DEFAULT_CATEGORY));
  eleventyConfig.addFilter("categorySlug", (value) => findCategory(value)?.slug ?? (slugify(value) || slugify(DEFAULT_CATEGORY)));
  eleventyConfig.addFilter("readingTime", (html = "") => {
    const text = String(html).replace(/<[^>]+>/g, " ");
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 350));
  });
  eleventyConfig.addFilter("tagList", (value) => {
    if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean);
    if (typeof value === "string") return value.split(",").map((tag) => tag.trim()).filter(Boolean);
    return [];
  });

  /* ---------- collections ---------- */
  const postGlob = "./posts/*.md";

  eleventyConfig.addCollection("diaryPosts", (collectionApi) =>
    collectionApi.getFilteredByGlob(postGlob).sort((a, b) => b.date - a.date),
  );

  eleventyConfig.addCollection("diaryCategories", (collectionApi) => {
    const posts = collectionApi.getFilteredByGlob(postGlob).sort((a, b) => b.date - a.date);
    const groups = new Map();

    CATEGORIES.forEach((definition, order) => {
      groups.set(definition.slug, { ...definition, order, posts: [] });
    });

    posts.forEach((post) => {
      const raw = post.data.category || DEFAULT_CATEGORY;
      const known = findCategory(raw);
      const slug = known?.slug ?? (slugify(raw) || slugify(DEFAULT_CATEGORY));
      if (!groups.has(slug)) {
        groups.set(slug, {
          name: known?.name ?? String(raw),
          slug,
          index: String(groups.size + 1).padStart(2, "0"),
          blurb: "",
          topics: "",
          order: 90 + groups.size,
          posts: [],
        });
      }
      groups.get(slug).posts.push(post);
    });

    return [...groups.values()]
      .map((group) => ({
        ...group,
        count: group.posts.length,
        latest: group.posts[0]?.date ?? null,
      }))
      .sort((a, b) => a.order - b.order);
  });

  /* ---------- config ---------- */
  return {
    pathPrefix: "/diary/",
    dir: {
      input: ".",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    templateFormats: ["njk", "md", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
