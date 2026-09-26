/**
 * Degrees and licences, in one place. The Education page renders them and the
 * agent-facing Markdown (/about.md, /llms-full.txt) reads them, so the two can
 * never disagree.
 */
export type Degree = {
  title: string; organization: string; organizationUrl?: string;
  dateRange: string; items: string[];
};

export const DEGREES: Degree[] = [
  {
    title: "Master of Science - Applied Data Analytics",
    organization: "Boston University",
    organizationUrl: "https://www.bu.edu",
    dateRange: "Boston | January 2026",
    items: [
      "Analytics and Data Visualization in R",
      "Advanced Machine Learning",
      "Big Data Analytics",
      "Web Mining & Graph Analytics",
    ],
  },
  {
    title: "Bachelor of Science (Honors) - Mathematics and Computer Science",
    organization: "Chennai Mathematical Institute",
    organizationUrl: "https://www.cmi.ac.in",
    dateRange: "Chennai | July 2024",
    items: [
      "Linear Algebra",
      "Fourier Analysis",
      "Data Structures and Algorithms",
      "Probability Theory & Statistics",
      "Stochastic Processes",
      "Statistical Inference",
      "Financial Modelling",
      "Economics",
    ],
  },
  {
    title: "Grade 12 (Maharashtra HSC) - Science",
    organization: "PACE Junior Science College",
    dateRange: "Mumbai | September 2021",
    items: [
      "Percentage: 94.5% (12th Grade, HSC Maharashtra Board)",
      "JEE Mains (All India Rank 5274) & Advanced (All India Rank 4690)",
    ],
  },
];

export const LICENSES = [
  { title: "Series 7: General Securities Representative", issuer: "FINRA" },
  { title: "Series 63: Uniform Securities Agent State Law", issuer: "FINRA" },
];
