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
    'I am an equity research associate. I write about how companies actually make money and what they are worth — accounting rules, unit economics, valuation, derivatives — and what changes when those questions move onchain. The method came from statistics and machine learning before it came from markets, and it still travels: occasionally it gets pointed at Formula 1 telemetry or a fertility register instead. The rest of the site is side quests \u2014 things I am learning in public, and whatever else has my attention. Written in a personal capacity.',
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
  ],
};

export default presentation;
