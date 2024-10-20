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
  mail: "sidshah2953@gmail.com",
  title: "Hi, I'm Siddhant",
  // profile: "/profile.webp",
  description:
    'I\'m a graduate student, pursuing an *MS in Applied Data Analytics* from *Boston University*. My interests lie in *Machine Learning*, *Data Science* and *Finance*.',
  socials: [
    {
      label: "Email",
      link: "mailto:sidshah2953@gmail.com",
    },
    {
      label: "LinkedIn",
      link: "https://www.linkedin.com/in/shah-siddhant/",
    },
    {
      label: "Github",
      link: "https://github.com/SidShah2953",
    },
    {
      label: "Resume",
      link: "/Resume.pdf",
    },
  ],
};

export default presentation;
