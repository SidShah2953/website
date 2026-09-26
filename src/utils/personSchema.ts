/**
 * The Person node, shared by PersonSchema (home, /about) and the ProfilePage on
 * /about, so the entity is described once. Its @id is what Article and
 * ScholarlyArticle point their author at.
 */
import { SITE_URL } from "@/data/config";
import presentation from "@/data/presentation";

// Profiles the site links visibly, plus ones kept in structured data only.
const schemaOnlyProfiles = ["https://x.com/SiddhantShah29_"];

const socialLinks = [
  ...new Set([
    ...presentation.socials
      .filter(s => s.link.startsWith('http'))
      .map(s => s.link),
    ...schemaOnlyProfiles
  ])
];

export const PERSON_ID = `${SITE_URL}/#person`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/** The one Person entity every page resolves to. */
export const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": PERSON_ID,
  "name": presentation.name,
  "url": SITE_URL,
  "email": presentation.mail,
  "description": presentation.description.replace(/\*/g, ''),
  "jobTitle": "Equity Research Associate",
  "worksFor": {
    "@type": "Organization",
    "name": "Rosenblatt Securities",
    "url": "https://www.rblt.com"
  },
  "alumniOf": [
    {
      "@type": "CollegeOrUniversity",
      "name": "Boston University",
      "sameAs": "https://www.bu.edu"
    },
    {
      "@type": "CollegeOrUniversity",
      "name": "Chennai Mathematical Institute",
      "sameAs": "https://www.cmi.ac.in"
    }
  ],
  "knowsAbout": [
    "Equity Research",
    "Financial Technology",
    "Digital Assets",
    "Financial Modelling",
    "Valuation",
    "Quantitative Finance",
    "Portfolio Optimization",
    "Data Analytics",
    "Machine Learning",
    "Python"
  ],
  "sameAs": socialLinks
};
