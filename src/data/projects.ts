export type Project = {
  title: string;
  techs: string[];
  link: string;
  isComingSoon?: boolean;
};

const projects: Project[] = [
  {
    title: "Probabilistic Programming",
    techs: ["Pyro (Python)"],
    link: "",
    isComingSoon: true,
  },
];

export default projects;
