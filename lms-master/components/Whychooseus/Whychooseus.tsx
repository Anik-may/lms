import React from 'react'
import ReviewsCard from './ReviewsCard';

const Whychooseus = () => {
const reviews = [
  {
    name: "Aman Sharma",
    role: "Student",
    title: "Best Instructors",
    description: "Our instructors are experts in their fields and are passionate about teaching.",
    image: "https://i.pravatar.cc/150?u=1"
  },
  {
    name: "Sanya Verma",
    role: "Web Developer",
    title: "Best Instructors",
    description: "Our instructors are experts in their fields and are passionate about teaching.",
    image: "https://i.pravatar.cc/150?u=2"
  },
  {
    name: "Rahul Gupta",
    role: "UI/UX Designer",
    title: "Best Instructors",
    description: "Our instructors are experts in their fields and are passionate about teaching.",
    image: "https://i.pravatar.cc/150?u=3"
  },
  {
    name: "Priya Das",
    role: "Data Scientist",
    title: "Best Instructors",
    description: "Our instructors are experts in their fields and are passionate about teaching.",
    image: "https://i.pravatar.cc/150?u=4"
  },
  {
    name: "Vikram Singh",
    role: "Cloud Architect",
    title: "Best Instructors",
    description: "Our instructors are experts in their fields and are passionate about teaching.",
    image: "https://i.pravatar.cc/150?u=5"
  },
  {
    name: "Neha Kapoor",
    role: "Product Manager",
    title: "Best Instructors",
    description: "Our instructors are experts in their fields and are passionate about teaching.",
    image: "https://i.pravatar.cc/150?u=6"
  }
];
  return (
    <div className='p-12'>
        <h3 className='text-2xl ps-3 font-bold mb-1'>Why people choose us</h3>
        {
            reviews.length==0?(<div className='flex justify-center items-center h-64'>
          <p className='text-gray-400 font-semibold'>No reviews found</p>
        </div>):(
            <section className=" py-16 px-4">
  <div className="max-w-7xl mx-auto">
   

    {/* Review Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
   <ReviewsCard reviews={reviews}/>
    </div>
  </div>
</section>
        )
        }
    </div>
  )
}

export default Whychooseus