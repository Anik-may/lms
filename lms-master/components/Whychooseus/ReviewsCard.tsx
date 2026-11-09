import React from 'react'

const ReviewsCard = ({reviews}:any) => {
  return (
  
    <> 
      {reviews.map((review: any, index: any) => (
        <div key={index} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
        
          <div className="flex items-center gap-4 mb-6">
            <img 
              src={review.image} 
              alt={review.name} 
              className="w-14 h-14 rounded-full border-2 border-blue-50 object-cover"
            />
            <div>
              <h3 className="font-bold text-gray-900 text-lg">{review.name}</h3>
              <p className="text-sm text-gray-500">{review.role}</p>
            </div>
          </div>

          <div className="mb-4">
            <h4 className="text-blue-600 font-semibold text-sm uppercase mb-2">{review.title}</h4>
            <p className="text-gray-600 italic">"{review.description}"</p>
          </div>

          <div className="flex text-yellow-400 text-sm">
            {[...Array(5)].map((_, i) => <span key={i}>★</span>)}
          </div>
        </div>
      ))}
    </>
  )
}

export default ReviewsCard