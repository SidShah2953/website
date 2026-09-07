/**
 * Roles, in one place. The About page counts these and the Experience page
 * renders them, so the number on the card can never drift from the list.
 */
export type Role = {
  organization: string; organizationUrl?: string; subtitle?: string;
  dateRange: string; location?: string; items: string[]; skills?: string;
};

export const ROLES: Role[] = [
  {
    organization: "Rosenblatt Securities",
    organizationUrl: "https://www.rblt.com",
    subtitle: "Equity Research Associate",
    dateRange: "Mar 2026 - Present",
    location: "New York, NY",
    skills: "Equity Research, Financial Modelling, Valuation, Financial Statement Analysis",
    items: [
      "Support FinTech, digital assets and high-performance-computing infrastructure coverage, reporting to the senior analyst on the franchise.",
    ],
  },
  {
    organization: "Boston University, Metropolitan College",
    organizationUrl: "https://www.bu.edu",
    subtitle: "Visiting Researcher",
    dateRange: "Feb 2026 - Mar 2026",
    location: "Boston, MA",
    skills: "Python, Market Microstructure, Event Studies, Research",
    items: [
      "Studied the market microstructure of decentralised-finance perpetual futures, building a multi-exchange dataset of 17 crypto, tokenised-equity and tokenised-commodity perpetuals and an endogenous event-detection method for markets with no opening bell. Published in the International Journal of Financial Studies (DOI:10.3390/ijfs14070178).",
      "Compared robust risk proxies in constrained portfolio construction across nine U.S. sector ETFs and 27 years of data. Accepted at Risks (MDPI).",
    ],
  },
  {
    organization: "Boston University, Department of Computer Science",
    organizationUrl: "https://www.bu.edu",
    subtitle: "Research Assistant",
    dateRange: "Oct 2024 - Jan 2026",
    location: "Boston, MA",
    skills: "Python, scikit-learn, Pandas, NumPy, PyTorch, TensorFlow, R, SQL, Git, Back-testing, Research",
    items: [
      "Developed and back-tested proprietary trading strategies comparing Mean Absolute Deviation (MAD) vs. Markowitz mean-variance optimization across 9 sector ETFs, implementing risk-constrained portfolio construction and rebalancing algorithms with associated performance analytics including Sharpe ratios, MDD, and transaction cost analysis for alpha generation.",
      "Conducted research on momentum-based trading strategies in crude oil ETFs and futures, developing long-short models yielding up to 19.9% annualized returns over an 18-year testing period. Published in Stocks & Commodities Magazine (September 2025).",
      "Developed a strategy leveraging overnight silver returns to predict Bitcoin price movements, exhibiting lower drawdowns in a 10-year backtest. Published in Stocks & Commodities Magazine (June 2025).",
      "Developed probabilistic framework to reduce computational overhead in model fine-tuning, using various distributions to estimate Random Forest performance, achieving less than 3% relative error size across varying configurations. Published as 'Estimating the Accuracy of a Bagged Ensemble' (DOI:10.5121/mlaij.2025.12106).",
    ],
  },
  {
    organization: "Raising A Mathematician Foundation",
    organizationUrl: "https://www.mathscircle.org",
    subtitle: "Program Operations Intern",
    dateRange: "Jul 2024 - Aug 2024",
    location: "Mumbai, India",
    skills: "Python, Microsoft Office (Excel, Word, PowerPoint), Jira, Confluence, Leadership",
    items: [
      "Spearheaded the Maths Circle Initiative by RAM Foundation in India, leading a team of five overlooking data-driven business expansion and leveraging analysis of applicant data to identify high-potential markets for educational programs.",
      "Implemented project management infrastructure using Jira, Confluence, and Slack to streamline task tracking, documentation, and communication between cross-functional teams.",
    ],
  },
  {
    organization: "Fino Payments Bank",
    organizationUrl: "https://www.finobank.com",
    subtitle: "Data Science Intern",
    dateRange: "May 2023 - Jul 2023",
    location: "Mumbai, India",
    skills: "Python (PySpark), R, SQL, Microsoft Office (Advanced Excel & VBA, Word, PowerPoint), Stakeholder Communication",
    items: [
      "Built a database of 6,000+ government-sponsored financial schemes, leveraging PySpark and pattern recognition on customer-level transaction data, to generate analytical insights and presented a revenue growth strategy that could 2x revenue.",
    ],
  },
  {
    organization: "Greater Mumbai Science Teachers' Association",
    organizationUrl: "https://www.mathscircle.org",
    subtitle: "Mathematics & Physics Teacher",
    dateRange: "May 2023 - Jul 2023",
    location: "Mumbai, India",
    skills: "Quantitative Reasoning, Data Interpretation, Scientific Communication, Leadership and Mentorship",
    items: [
      "Helped students prepare for the various stages leading up to the International Junior Science Olympiad.",
    ],
  },
];
