type Social = {
  label: string;
  link: string;
};

type Presentation = {
  name: string;
  mail: string;
  title: string;
  description: string;
  socials: Social[];
};

const presentation: Presentation = {
  name: "Siddhant Shah",
  mail: "siddhant@siddhants.com",
  title: "Hi, I'm Siddhant",
  // profile: "/profile.webp",
  description:
    'I am an equity research associate. I take the same rigorous framework — build the dataset, name the mechanism, test it, and be honest about what the numbers cannot carry — and point it at whatever is interesting. Usually that is *tokenization, digital assets and AI*; sometimes it is Formula 1 telemetry or a fertility register. This site is where I think out loud about that, in a personal capacity.',
  socials: [
    {
      label: "Email",
      link: "mailto:siddhant@siddhants.com",
    },
    {
      label: "LinkedIn",
      link: "https://www.linkedin.com/in/shah-siddhant/",
    },
    {
      label: "GitHub",
      link: "https://github.com/SidShah2953",
    },
    {
      label: "RSS",
      link: "/blog/rss.xml",
    },
    {
      label: "Resume",
      link: "/Resume.pdf",
    },
  ],
};

export default presentation;
