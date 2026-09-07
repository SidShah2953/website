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
    'Siddhant Shah is an Equity Research Associate at Rosenblatt Securities in New York, He writes here about the things he is building and trying to understand, mostly technology. Previously quantitative research at Boston University, published in Stocks & Commodities and MDPI journals. Written in a personal capacity.',
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
