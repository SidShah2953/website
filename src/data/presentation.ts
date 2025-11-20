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
    '*MS in Applied Data Analytics* student at *Boston University* with a strong foundation in mathematics and computer science. Experienced in developing *trading strategies*, data analysis, and machine learning applications. Currently pursuing the *CFA Level 1* certification and working on research in *cryptocurrency* and *blockchain technologies*.',
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
