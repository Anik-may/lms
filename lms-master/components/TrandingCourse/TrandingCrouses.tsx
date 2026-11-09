import React from 'react'
import TrandingCourseCard from './TrandingCourseCard';

const TrandingCrouses = () => {
  const courses = [
    { 
      id:101,
      title: "Meta iOS UI Development", image: "https://img-s-msn-com.akamaized.net/tenant/amp/entityid/AA1GANVA.img?w=4206&h=2804&m=4&q=30", provider: "Meta", providerLogo: "https://cdn.finam.ru/images/publications/1493852/1280_1_f4fb004435.jpg", type: "Specialization", rating: 4.5 },
    {    id:102,
      title: "Meta iOS UI Development", image: "https://img-s-msn-com.akamaized.net/tenant/amp/entityid/AA1GANVA.img?w=4206&h=2804&m=4&q=30", provider: "Meta", providerLogo: "https://cdn.finam.ru/images/publications/1493852/1280_1_f4fb004435.jpg", type: "Specialization", rating: 4.5 },
    {    id:103,
      title: "Meta iOS UI Development", image: "https://img-s-msn-com.akamaized.net/tenant/amp/entityid/AA1GANVA.img?w=4206&h=2804&m=4&q=30", provider: "Meta", providerLogo: "https://cdn.finam.ru/images/publications/1493852/1280_1_f4fb004435.jpg", type: "Specialization", rating: 4.5 },
    { title: "Google UX Design", image: "https://img-s-msn-com.akamaized.net/tenant/amp/entityid/AA1GANVA.img?w=4206&h=2804&m=4&q=30", provider: "Google", providerLogo: "https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_Logo.png", type: "Specialization", rating: 4.8 },
    { title: "Google UX Design", image: "https://img-s-msn-com.akamaized.net/tenant/amp/entityid/AA1GANVA.img?w=4206&h=2804&m=4&q=30", provider: "Google", providerLogo: "https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_Logo.png", type: "Specialization", rating: 4.8 },
    { title: "Google UX Design", image: "https://img-s-msn-com.akamaized.net/tenant/amp/entityid/AA1GANVA.img?w=4206&h=2804&m=4&q=30", provider: "Google", providerLogo: "https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_Logo.png", type: "Specialization", rating: 4.8 },
      { title: "Google UX Design", image: "https://img-s-msn-com.akamaized.net/tenant/amp/entityid/AA1GANVA.img?w=4206&h=2804&m=4&q=30", provider: "Google", providerLogo: "https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_Logo.png", type: "Specialization", rating: 4.8 }
    ,
      { title: "Google UX Design", image: "https://img-s-msn-com.akamaized.net/tenant/amp/entityid/AA1GANVA.img?w=4206&h=2804&m=4&q=30", provider: "Google", providerLogo: "https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_Logo.png", type: "Specialization", rating: 4.8 }
    ,
      { title: "Google UX Design", image: "https://img-s-msn-com.akamaized.net/tenant/amp/entityid/AA1GANVA.img?w=4206&h=2804&m=4&q=30", provider: "Google", providerLogo: "https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_Logo.png", type: "Specialization", rating: 4.8 }]


  // Ye logic data ko 3-3 ke sets mein divide kar degi
  const chunkSize = 3;
  const courseGroups = [];
  for (let i = 0; i < courses.length; i += chunkSize) {
    courseGroups.push(courses.slice(i, i + chunkSize));
  }

  return (
    <div className='p-12'>
      <h4 className='text-3xl font-bold mb-6'>Trending Courses</h4>

      {courses.length === 0 ? (
        <div className='flex justify-center items-center h-64'>
          <p className='text-gray-400 font-semibold'>No courses found</p>
        </div>
      ) : (
        <div className='flex lg:flex-row flex-col gap-6 overflow-x-auto pb-4'>
          {courseGroups.map((group, index) => (
            <TrandingCourseCard key={index} data={group} />
          ))}
        </div>
      )}
    </div>
  )
}

export default TrandingCrouses;