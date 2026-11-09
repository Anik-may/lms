import FeatureCards from '@/components/landingPage/FeatureCards'
import PartnerLogos from '@/components/landingPage/PartnerLogos'
import TrandingCrouses from '@/components/TrandingCourse/TrandingCrouses'
import TrandingCourseCard from '@/components/TrandingCourse/TrandingCourseCard'

import React from 'react'
import OfferShowCase from '@/components/OfferShowCases/OfferShowCase'
import Whychooseus from '@/components/Whychooseus/Whychooseus'

function page() {
  return (
    <div>
      <FeatureCards />
      <PartnerLogos />
      <TrandingCrouses/>
<OfferShowCase/>
<Whychooseus/>
    </div>
  )
}

export default page