import { CommunityProjectCategory } from '@/types';

export interface CommunityTemplate {
    id: string;
    title: string;
    description: string;
    category: CommunityProjectCategory;
    suggestedGoal: number;
    locationPlaceholder: string;
}

export const COMMUNITY_TEMPLATES: CommunityTemplate[] = [
    {
        id: 'neighborhood-garden',
        title: 'Neighborhood Community Garden',
        description: 'Transform an unused lot into a thriving community garden with raised beds, tool storage, composting stations, and a gathering area. Residents can grow fresh produce, learn sustainable gardening practices, and build neighborhood connections.',
        category: 'Parks & Recreation',
        suggestedGoal: 15000,
        locationPlaceholder: 'Your Neighborhood, City',
    },
    {
        id: 'street-lighting',
        title: 'Safer Streets Lighting Initiative',
        description: 'Install solar-powered LED streetlights along poorly lit corridors, parks, and pedestrian walkways. Improve nighttime visibility and safety for residents, reduce crime, and create a more welcoming neighborhood after dark.',
        category: 'Infrastructure',
        suggestedGoal: 25000,
        locationPlaceholder: 'Your Street or District',
    },
    {
        id: 'little-free-library',
        title: 'Little Free Library Network',
        description: 'Build and install a network of little free library boxes throughout the neighborhood. Stock them with donated books for all ages, create a community reading culture, and provide free access to literature for families.',
        category: 'Education',
        suggestedGoal: 5000,
        locationPlaceholder: 'Your Neighborhood',
    },
    {
        id: 'public-mural',
        title: 'Community Mural Project',
        description: 'Commission local artists to design and paint vibrant murals on blank walls and underpasses. Celebrate the neighborhood\'s history and culture, deter vandalism, and create Instagram-worthy landmarks that draw visitors to local businesses.',
        category: 'Arts & Culture',
        suggestedGoal: 12000,
        locationPlaceholder: 'Downtown or Arts District',
    },
    {
        id: 'tree-planting',
        title: 'Urban Tree Canopy Expansion',
        description: 'Plant native shade trees along streets, in parks, and around schools to combat urban heat islands. Reduce summer temperatures, improve air quality, increase property values, and create natural habitats for local wildlife.',
        category: 'Environment',
        suggestedGoal: 20000,
        locationPlaceholder: 'Your City or District',
    },
    {
        id: 'crosswalk-safety',
        title: 'School Zone Crosswalk Safety',
        description: 'Install high-visibility crosswalks, flashing pedestrian signals, and speed reduction measures near schools. Add reflective signage and painted curb extensions to slow traffic and protect children walking to and from school.',
        category: 'Public Safety',
        suggestedGoal: 18000,
        locationPlaceholder: 'Near Your Local School',
    },
    {
        id: 'community-workspace',
        title: 'Neighborhood Co-Working Space',
        description: 'Convert an underused community building into a shared workspace with high-speed internet, meeting rooms, and a maker area. Give remote workers, freelancers, and small business owners an affordable place to work and collaborate.',
        category: 'Community Spaces',
        suggestedGoal: 35000,
        locationPlaceholder: 'Your Community Center',
    },
    {
        id: 'open-source-civic',
        title: 'Open-Source Civic Dashboard',
        description: 'Build an open-source web dashboard that tracks local government spending, infrastructure projects, and community metrics in real time. Make public data accessible and easy to understand so residents can hold officials accountable.',
        category: 'Open Source',
        suggestedGoal: 8000,
        locationPlaceholder: 'Your City',
    },
    {
        id: 'playground-renovation',
        title: 'Inclusive Playground Renovation',
        description: 'Renovate an aging playground with modern, ADA-accessible equipment that children of all abilities can enjoy. Add rubberized surfacing, sensory play elements, shaded seating for caregivers, and a water splash pad for summer.',
        category: 'Parks & Recreation',
        suggestedGoal: 45000,
        locationPlaceholder: 'Your Local Park',
    },
    {
        id: 'bike-lane-network',
        title: 'Protected Bike Lane Pilot',
        description: 'Fund a pilot program to install protected bike lanes connecting residential areas to schools, transit stops, and commercial districts. Include bike repair stations, secure parking racks, and wayfinding signage to encourage car-free commuting.',
        category: 'Infrastructure',
        suggestedGoal: 30000,
        locationPlaceholder: 'Your Main Corridor',
    },
];
