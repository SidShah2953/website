type Social = {
  label: string;
  link: string;
};

type Presentation = {
  mail: string;
  title: string;
  description: string;
  socials: Social[];
  profile?: string;
};

const presentation: Presentation = {
  mail: "sidshah2953@gmail.com",
  title: "Hi, I’m Siddhant",
  // profile: "/profile.webp",
  description:
    'Hello, I\'m a final year student, pursuing a *B.Sc. in Mathematics and Computer Science* from *Chennai Mathematical Institute (CMI)*. My interests lie in *Machine Learning*, *Data Science* and *Finance*. ',
  socials: [
    {
      label: "LinkedIn",
      link: "https://www.linkedin.com/in/siddhant-d-shah/",
    },
    {
      label: "Github",
      link: "https://github.com/SidShah2953",
    },
  ],
};

export default presentation;
