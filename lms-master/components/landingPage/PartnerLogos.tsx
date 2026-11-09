"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";

const partners = [
  { name: "Google", logo: "https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg" },
  { name: "IBM", logo: "https://upload.wikimedia.org/wikipedia/commons/5/51/IBM_logo.svg" },
  { name: "Microsoft", logo: "https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" },
  { name: "OpenAI", logo: "https://upload.wikimedia.org/wikipedia/commons/4/4d/OpenAI_Logo.svg" },
  { name: "Meta", logo: "https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg" },
  { name: "Amazon", logo: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg" },
];

const PartnerLogos = () => {
  const marqueeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Create an infinite loop animation
      // We assume the content is duplicated to allow seamless looping
      const totalWidth = marqueeRef.current?.scrollWidth || 0;
      const contentWidth = totalWidth / 2; // Since we duplicated the list

      gsap.to(marqueeRef.current, {
        x: -contentWidth,
        duration: 40, // Adjust speed here (higher = slower)
        ease: "linear",
        repeat: -1,
      });
    }, marqueeRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="w-full bg-white py-16 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 mb-10 text-center">
        <h2 className="text-xl md:text-3xl font-bold text-gray-900 tracking-tight">
          We collaborate with <span className="text-secondary">350+ leading universities and companies</span>
        </h2>
      </div>

      <div className="relative w-full overflow-hidden mask-gradient-sides">
        {/* Gradient Masks for smooth fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-white z-10 pointer-events-none"></div>
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-white z-10 pointer-events-none"></div>

        {/* Marquee Container */}
        <div
          ref={marqueeRef}
          className="flex items-center w-fit gap-12 pl-12 "
        // Start slightly offset if needed, or rely on GSAP setup
        >
          {/* First Set */}
          {partners.map((partner, index) => (
            <div
              key={`p1-${index}`}
              className="flex-shrink-0 flex items-center justify-center grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-300 cursor-pointer"
            >
              <img
                src={partner.logo}
                alt={partner.name}
                className="h-10 md:h-12 w-auto object-contain max-w-[150px]"
              />
            </div>
          ))}

          {/* Duplicated Set for Infinite Loop */}
          {partners.map((partner, index) => (
            <div
              key={`p2-${index}`}
              className="flex-shrink-0 flex items-center justify-center grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-300 cursor-pointer"
            >
              <img
                src={partner.logo}
                alt={partner.name}
                className="h-10 md:h-12 w-auto object-contain max-w-[150px]"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PartnerLogos;

