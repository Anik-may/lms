import { Star } from 'lucide-react'
import React from 'react'

const TrandingCourseCard = ({ data }: any) => {
  return (
    <div className='bg-[#E6EFFF] p-5 lg:w-4/12 rounded-sm w-full'>
      <h3 className='text-gray-950 font-semibold text-xl mb-4'>Top Courses</h3>

      <ul className='flex flex-col gap-3'>
        {data.map((item: any, index: number) => (
    
                <li className='bg-white flex gap-2 p-5 rounded-lg my-1'>
       <div className='w-2/12'><img  className='w-full h-full object-cover rounded-lg' src={item.image} alt="" /></div>
        <h1>{item.id}</h1>
       <div>
        <span className='text-gray-400 font-semibold flex items-center gap-2'><img className='w-5 h-5' src={item.providerLogo} alt="" /> {item.provider}</span>
        <h2 className='text-gray-950 font-semibold mb-1'>{item.title}</h2>
<div className='flex gap-2'>
    <span className='text-gray-400 font-semibold'>
{item.type}
</span> 
<span className='text-gray-40 flex gap-1 items-center text-gray-400 font-semibold'>

  <Star className='text-black fill-black w-3 h-3  inline-block' /> 
  {item.rating}
</span>
</div>

</div>
    </li>
        ))}
      </ul>
    </div>
  )
}

export default TrandingCourseCard;