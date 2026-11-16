import { DEFAULT_CATEGORY, findCategory } from "../lib/categories.js";
import { postSlugFromPath, slugify } from "../lib/utils.js";

/**
 * Applies to every file in posts/. A post only needs frontmatter:
 * title, date, category, summary, tags, layout.
 */
export default {
  layout: "post.njk",
  eleventyComputed: {
    postSlug: (data) => postSlugFromPath(data.page.inputPath),
    permalink: (data) => `/posts/${postSlugFromPath(data.page.inputPath)}/`,
    categoryName: (data) => {
      const raw = data.category || DEFAULT_CATEGORY;
      return findCategory(raw)?.name ?? raw;
    },
    categorySlug: (data) => {
      const raw = data.category || DEFAULT_CATEGORY;
      return findCategory(raw)?.slug ?? (slugify(raw) || slugify(DEFAULT_CATEGORY));
    },
    newerPost: (data) => sibling(data, -1),
    olderPost: (data) => sibling(data, 1),
  },
};

/** Neighbours in the date-descending list of all posts. */
function sibling(data, offset) {
  const posts = data.collections?.diaryPosts ?? [];
  if (!posts.length) return null;
  const url = `/posts/${postSlugFromPath(data.page.inputPath)}/`;
  const index = posts.findIndex((post) => post.url === url);
  if (index === -1) return null;
  return posts[index + offset] ?? null;
}
