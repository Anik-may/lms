import React from 'react';

const CourseDirectory = () => {
  const sections = [
    {
      title: "Explore roles",
      links: ["Data Analyst", "Project Manager", "Cyber Security Analyst", "Data Scientist", "Business Intelligence Analyst", "Digital Marketing Specialist", "UI / UX Designer", "Machine Learning Engineer", "Social Media Specialist", "Computer Support Specialist"],
      footerLink: "View All"
    },
    {
      title: "Explore categories",
      links: ["Artificial Intelligence", "Business", "Data Science", "Information Technology", "Computer Science", "Healthcare", "Physical Science and Engineering", "Personal Development", "Social Sciences", "Language Learning", "Arts and Humanities"],
      footerLink: "View All"
    },
    {
      title: "Earn a Professional Certificate",
      links: ["Business", "Computer Science", "Data Science", "Information Technology"],
      footerLink: "View all",
      subSection: {
        title: "Earn an online degree",
        links: ["Bachelor's Degrees", "Master's Degrees", "Postgraduate Programs"],
        footerLink: "View all"
      }
    },
    {
      title: "Explore trending skills",
      links: ["Python", "Artificial Intelligence", "Excel", "Machine Learning", "SQL", "Project Management", "Power BI", "Marketing"],
      subSection: {
        title: "Prepare for a certification exam",
        links: [],
        footerLink: "View all"
      }
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 font-sans text-[#1f1f1f] no-scrollbar">
      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
        {sections.map((section, index) => (
          <div key={index} className="flex flex-col">
            <h3 className="font-bold text-base mb-4">{section.title}</h3>
            <ul className="space-y-2">
              {section.links.map((link, i) => (
                <li key={i}>
                  <a href="#" className="text-[0.95rem] hover:underline text-gray-800">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
            
            {/* Conditional footer link for primary sections */}
            {section.footerLink && !section.subSection && (
              <a href="#" className="mt-3 text-[0.95rem] font-medium underline">
                {section.footerLink}
              </a>
            )}

            {/* Nested Sub-sections */}
            {section.subSection && (
              <div className="mt-10">
                <h3 className="font-bold text-base mb-4">{section.subSection.title}</h3>
                <ul className="space-y-2">
                  {section.subSection.links.map((link, i) => (
                    <li key={i}>
                      <a href="#" className="text-[0.95rem] hover:underline text-gray-800">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
                <a href="#" className="mt-3 inline-block text-[0.95rem] font-medium underline">
                  {section.subSection.footerLink}
                </a>
              </div>
            )}
          </div>
        ))}
      </div>

      <hr className="border-gray-300 mb-6" />

      {/* Bottom Text Footer */}
      <div className="text-[0.95rem]">
        <p>
          Not sure where to begin?{" "}
          <a href="#" className="text-[#0056d2] underline">Browse free courses</a>
          {" or "}
          <a href="#" className="text-[#0056d2] underline">
            Learn more about <span className="font-bold bg-[#0056d2] text-white px-1 ml-1 text-sm rounded-sm">Wholcare</span>
          </a>
        </p>
      </div>
    </div>
  );
};

export default CourseDirectory;