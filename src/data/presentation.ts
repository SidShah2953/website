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
    'I develop systematic approaches to investment challenges—designing momentum strategies, optimizing sector portfolios, and building institutional AI platforms that integrate research, risk, and portfolio governance in real time. My work spans quantitative research, financial modeling, emerging markets, and AI/ML in capital markets, bridging precision analytics with business insight. Skilled in *Python, SQL, Bloomberg*, and advanced portfolio modeling, I craft data-driven solutions that accelerate smarter investment decisions.',
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
      label: "Github",
      link: "https://github.com/SidShah2953",
    },
    {
      label: "Medium",
      link: "https://medium.com/@siddhantshah29",
    },
    {
      label: "Paragraph",
      link: "https://paragraph.com/@siddhantshah29",
    },
    {
      label: "Resume",
      link: "/Resume.pdf",
    },
  ],
};

export default presentation;
