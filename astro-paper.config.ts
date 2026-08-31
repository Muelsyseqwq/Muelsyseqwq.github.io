import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://muelsyseqwq.github.io/",
    title: "Muelsyse",
    description: "A student from Beijing Forestry University.",
    author: "Muelsyse",
    profile: "https://github.com/Muelsyseqwq",
    ogImage: "site-og.png",
    lang: "zh-CN",
    timezone: "Asia/Shanghai",
    dir: "ltr",
  },
  posts: {
    perPage: 4,
    perIndex: 4,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: false,
    showArchives: true,
    showBackButton: true,
    editPost: { enabled: false },
    search: "pagefind",
  },
  socials: [
    {
      name: "github",
      url: "https://github.com/Muelsyseqwq",
      linkTitle: "Muelsyse on GitHub",
    },
    {
      name: "mail",
      url: "mailto:yanghaotian.bjfu@gmail.com",
      linkTitle: "Send an email to Muelsyse",
    },
  ],
  shareLinks: [],
});
