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
    'Siddhant Shah is an Equity Research Associate at Rosenblatt Securities in New York, supporting FinTech and Digital Assets coverage. He came to markets from mathematics and data. Written in a personal capacity.',
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
      label: "ORCID",
      link: "https://orcid.org/0009-0008-1161-3001",
    },
  ],
};

export default presentation;
