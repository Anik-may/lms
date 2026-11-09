"use client"
import Image from 'next/image'
import Link from 'next/link'
import React, { useState } from 'react'
import { Search, ChevronDown, Menu } from 'lucide-react'
import CourseDirectory from './CourseDirectory'

function Navbar() {
    const [openCourseDirectory, setOpenCourseDirectory] = useState(false)

    return (
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 font-sans">
            <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-[64px] gap-4">

                    {/* Left Section: Logo & Explore */}
                    <div className="flex items-center gap-4 lg:gap-6 flex-shrink-0">
                        <Link href="/" className="flex-shrink-0 flex items-center">
                            <Image
                                src="https://res.cloudinary.com/dj6y31jyx/image/upload/v1770050410/institute_xofz2u.png"
                                alt="logo"
                                width={140}
                                height={35}
                                className="w-28 sm:w-32 lg:w-40 h-auto object-contain"
                                priority
                            />
                        </Link>

                        <button onClick={() => setOpenCourseDirectory(prev => !prev)} className="hidden text-black md:flex items-center gap-1  hover:bg-blue-600/20 px-3 py-1.5 rounded-[4px]  text-sm transition-colors cursor-pointer">
                            Explore
                            <ChevronDown className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Middle Section: Search Bar */}
                    <div className="hidden md:flex flex-1 max-w-2xl mx-4">
                        <div className="relative w-full">
                            <input
                                type="text"
                                placeholder="What do you want to learn?"
                                className="w-full pl-4 pr-10 py-2 rounded-full border border-gray-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-sm placeholder:text-gray-500 shadow-sm"
                            />
                            <button className="absolute right-1 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 p-1.5 rounded-full text-white transition-colors">
                                <Search className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Right Section: Links & Auth */}
                    <div className="flex items-center gap-2 lg:gap-4">
                        {/* Desktop Links */}
                        <div className="hidden xl:flex items-center gap-6 text-sm font-medium text-gray-600">
                            <Link href="#" className="hover:text-black transition-colors">Find your New Career</Link>
                        </div>



                        {/* Separator before Auth */}
                        <div className="hidden lg:block w-px h-6 bg-gray-300 mx-2"></div>

                        {/* Auth Buttons */}
                        <div className="flex items-center gap-2">
                            <Link href="/courses" className="hidden sm:block text-blue-600 font-bold text-sm hover:bg-blue-50 px-4 py-2 rounded-[4px] transition-colors">
                                Courses
                            </Link>
                            <Link href="/teach" className="hidden sm:block text-blue-600 font-bold text-sm hover:bg-blue-50 px-4 py-2 rounded-[4px] transition-colors">
                                Teach
                            </Link>
                            <Link href="/login" className="hidden sm:block text-blue-600 font-bold text-sm hover:bg-blue-50 px-4 py-2 rounded-[4px] transition-colors">
                                Log In
                            </Link>
                            <button className="border-2 border-blue-600 text-blue-600 px-5 py-2 rounded-lg font-bold text-sm hover:bg-blue-600/10 transition-colors whitespace-nowrap">
                                Join for Free
                            </button>
                        </div>

                        {/* Mobile Menu Icon */}
                        <button className="md:hidden text-gray-700 p-2">
                            <Menu className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>
            {openCourseDirectory && (
                <div className="absolute top-[64px] left-0 w-full bg-white border-t border-gray-200 shadow-xl h-[calc(100vh-64px)] overflow-y-auto no-scrollbar">
                    <CourseDirectory />
                </div>
            )}

            {/* Mobile Search - Visible under navbar on small screens */}
            <div className="md:hidden px-4 pb-3 border-t border-gray-100 pt-3">
                <div className="relative w-full">
                    <input
                        type="text"
                        placeholder="What do you want to learn?"
                        className="w-full pl-4 pr-10 py-2.5 rounded-full border border-gray-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-sm shadow-sm"
                    />
                    <button className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-blue-600 p-1.5 rounded-full text-white">
                        <Search className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </nav>
    )
}

export default Navbar