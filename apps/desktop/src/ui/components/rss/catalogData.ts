export interface CatalogFeed {
  label: string;
  url: string;
  category: string;
  description?: string;
}

export interface CatalogSource {
  name: string;
  lang: "fr" | "en" | "mixed";
  feeds: CatalogFeed[];
}

export const RSS_CATALOG: CatalogSource[] = [
  // ── FR ──────────────────────────────────────────────
  {
    name: "Actu Tech & Numerique",
    lang: "fr",
    feeds: [
      { label: "Les Numeriques", url: "https://www.lesnumeriques.com/rss.xml", category: "Tech", description: "Actu, tests et dossiers" },
      { label: "Numerama", url: "https://www.numerama.com/feed/", category: "Tech", description: "Tech, science et societe numerique" },
      { label: "Next (ex-NextINpact)", url: "https://www.next.ink/feed/", category: "Tech", description: "Actu tech et numerique" },
      { label: "Journal du Geek", url: "https://www.journaldugeek.com/feed/", category: "Tech", description: "High-tech, science, geek culture" },
      { label: "Clubic", url: "https://www.clubic.com/feed/news.rss", category: "Tech", description: "Actu tech et bons plans" },
    ],
  },
  {
    name: "Les Numeriques — Categories",
    lang: "fr",
    feeds: [
      { label: "LN — Bons plans", url: "https://www.lesnumeriques.com/rss-gooddeals.xml", category: "Bons plans" },
      { label: "LN — Tests & Dossiers", url: "https://www.lesnumeriques.com/rss-tests.xml", category: "Tech" },
      { label: "LN — Actu", url: "https://www.lesnumeriques.com/rss-news.xml", category: "Tech" },
      { label: "LN — Audio", url: "https://www.lesnumeriques.com/audio/rss.xml", category: "Tech" },
      { label: "LN — Auto & Moto", url: "https://www.lesnumeriques.com/voitures-co/rss.xml", category: "Auto" },
      { label: "LN — Gaming", url: "https://www.lesnumeriques.com/gaming/rss.xml", category: "Gaming" },
      { label: "LN — Informatique", url: "https://www.lesnumeriques.com/informatique/rss.xml", category: "Tech" },
      { label: "LN — Intelligence Artificielle", url: "https://www.lesnumeriques.com/intelligence-artificielle/rss.xml", category: "IA" },
      { label: "LN — Loisirs", url: "https://www.lesnumeriques.com/loisirs/rss.xml", category: "Loisirs" },
      { label: "LN — Maison", url: "https://www.lesnumeriques.com/electromenager/rss.xml", category: "Maison" },
      { label: "LN — Photo", url: "https://www.lesnumeriques.com/photo/rss.xml", category: "Photo" },
      { label: "LN — Pro", url: "https://www.lesnumeriques.com/pro/rss.xml", category: "Pro" },
      { label: "LN — Sante & Sport", url: "https://www.lesnumeriques.com/sante-sport/rss.xml", category: "Sante" },
      { label: "LN — Science & Espace", url: "https://www.lesnumeriques.com/science-espace/rss.xml", category: "Science" },
      { label: "LN — Societe numerique", url: "https://www.lesnumeriques.com/societe-numerique/rss.xml", category: "Tech" },
      { label: "LN — Telephonie", url: "https://www.lesnumeriques.com/mobilite-c17/rss.xml", category: "Tech" },
      { label: "LN — TV", url: "https://www.lesnumeriques.com/tv-video/rss.xml", category: "Tech" },
      { label: "LN — Velos & Trottinettes", url: "https://www.lesnumeriques.com/velos-trottinettes/rss.xml", category: "Mobilite" },
    ],
  },
  {
    name: "Developpement & Veille technique",
    lang: "fr",
    feeds: [
      { label: "Journal du Hacker", url: "https://www.journalduhacker.net/rss", category: "Dev", description: "Agregateur de liens dev francophone" },
      { label: "Alsacreations", url: "https://www.alsacreations.com/rss/actualites.xml", category: "Dev", description: "Web, HTML, CSS, accessibilite" },
      { label: "Developpez.com", url: "https://www.developpez.com/index/rss", category: "Dev", description: "Actu dev et IT francophone" },
    ],
  },
  // ── EN ──────────────────────────────────────────────
  {
    name: "News & Dev Communities",
    lang: "en",
    feeds: [
      { label: "Hacker News", url: "https://news.ycombinator.com/rss", category: "Dev", description: "Top stories — Y Combinator" },
      { label: "DEV.to", url: "https://dev.to/feed", category: "Dev", description: "Developer articles and discussions" },
      { label: "Hashnode", url: "https://hashnode.com/rss", category: "Dev", description: "Developer blogs and articles" },
      { label: "The New Stack", url: "https://thenewstack.io/blog/feed/", category: "Dev", description: "Cloud Native, Kubernetes, architecture" },
      { label: "InfoQ", url: "https://feed.infoq.com/", category: "Dev", description: "Enterprise architecture & software engineering" },
    ],
  },
  {
    name: "Engineering Blogs",
    lang: "en",
    feeds: [
      { label: "Cloudflare Blog", url: "https://blog.cloudflare.com/rss/", category: "Engineering", description: "Network, security, edge computing" },
      { label: "GitHub Engineering", url: "https://github.blog/category/engineering/feed/", category: "Engineering", description: "GitHub platform engineering" },
      { label: "Netflix Tech Blog", url: "https://netflixtechblog.com/feed", category: "Engineering", description: "Scalability, backend, distributed systems" },
      { label: "Uber Engineering", url: "https://www.uber.com/en-FR/blog/engineering/rss/", category: "Engineering", description: "Large-scale systems and data" },
      { label: "Discord Engineering", url: "https://discord.com/blog/categories/engineering/rss.xml", category: "Engineering", description: "Real-time infrastructure at scale" },
    ],
  },
  {
    name: "Blogs d'Experts & Langages",
    lang: "en",
    feeds: [
      { label: "Josh W. Comeau", url: "https://www.joshwcomeau.com/rss.xml", category: "Dev", description: "Web, React, CSS" },
      { label: "Martin Fowler", url: "https://martinfowler.com/feed.atom", category: "Dev", description: "Software architecture, patterns" },
      { label: "Overreacted (Dan Abramov)", url: "https://overreacted.io/rss.xml", category: "Dev", description: "React, JavaScript, systems thinking" },
      { label: "Kent C. Dodds", url: "https://kentcdodds.com/blog/rss.xml", category: "Dev", description: "Testing, JavaScript, React" },
      { label: "Smashing Magazine", url: "https://www.smashingmagazine.com/feed/", category: "Dev", description: "Web design and front-end" },
      { label: "Rust Blog", url: "https://blog.rust-lang.org/feed.xml", category: "Langages", description: "Rust language news" },
      { label: "Go Blog", url: "https://go.dev/blog/feed.xml", category: "Langages", description: "Go official blog" },
      { label: "Python (Official)", url: "https://www.python.org/static/community_logos/python-feed.xml", category: "Langages", description: "Python news and releases" },
    ],
  },
  // ── Mixte ───────────────────────────────────────────
  {
    name: "Intelligence Artificielle",
    lang: "mixed",
    feeds: [
      { label: "OpenAI News", url: "https://openai.com/news/rss.xml", category: "IA", description: "Announcements and research" },
      { label: "Google AI Blog", url: "https://blog.google/technology/ai/rss/", category: "IA", description: "AI research and announcements" },
      { label: "Apple Machine Learning", url: "https://machinelearning.apple.com/rss.xml", category: "IA", description: "ML research at Apple" },
    ],
  },
];
