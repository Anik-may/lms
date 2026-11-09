"use client"

import React from 'react';
import { Flag, Award, GraduationCap } from 'lucide-react';

const FeatureCards = () => {
  const cards = [
    {
      title: "Launch a new career",
      icon: <Flag className="w-8 h-8 text-secondary" />,
    },
    {
      title: "Gain in-demand skills",
      icon: <Award className="w-8 h-8 text-secondary" />,
    },
    {
      title: "Earn a degree",
      icon: <GraduationCap className="w-8 h-8 text-secodnary" />,
    },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-4 p-6 bg-white">
      {cards.map((card, index) => (
        <div
          key={index}
          className="relative flex-1 flex items-center justify-between p-8 rounded-2xl bg-gradient-to-r from-[#f0f4f9] to-[#f8f6ff] border border-transparent hover:border-blue-100 transition-all cursor-pointer overflow-hidden group"
        >
          {/* The Text */}
          <h3 className="text-lg font-bold text-gray-900 z-10">
            {card.title}
          </h3>

          {/* Icon Container with decorative "brush" background */}
          <div className="relative flex items-center justify-center">
            {/* Decorative purple shape (The 'brush stroke' effect) */}
            <div className="absolute w-16 h-16 bg-[#e9e3ff] rotate-12 rounded-lg opacity-60 -z-0 group-hover:scale-110 transition-transform duration-300" />
            
            {/* The Icon */}
            <div className="relative z-10 translate-x-1">
              {card.icon}
            </div>
          </div>
        </div>
      ))}
      
    </div>
    
  );
};

export default FeatureCards;