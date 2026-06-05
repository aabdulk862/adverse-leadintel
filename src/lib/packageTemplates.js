/**
 * Package templates for demo generation.
 * These are the section structures from adamsverse packages that demoGen clones
 * and personalizes with opportunity data.
 *
 * Only includes the structure (section keys + field shapes), not the actual content.
 * Synced from adamsverse/src/data/packages.js — update when new packages are added.
 */

export const PACKAGE_TEMPLATES = {
  restaurant: {
    category: "Food & Hospitality",
    sections: {
      hero: { headline: "", subheadline: "", ctaText: "", heroImage: "" },
      services: { heading: "", items: [] },
      gallery: { heading: "", images: [] },
      testimonials: { heading: "", items: [] },
      cta: { heading: "", body: "", buttonText: "" },
    },
  },
  "cafe-coffee-shop": {
    category: "Food & Hospitality",
    sections: {
      hero: { headline: "", subheadline: "", ctaText: "", heroImage: "" },
      services: { heading: "", items: [] },
      gallery: { heading: "", images: [] },
      testimonials: { heading: "", items: [] },
      cta: { heading: "", body: "", buttonText: "" },
    },
  },
  "hotel-bnb": {
    category: "Food & Hospitality",
    sections: {
      hero: { headline: "", subheadline: "", ctaText: "", heroImage: "" },
      services: { heading: "", items: [] },
      gallery: { heading: "", images: [] },
      testimonials: { heading: "", items: [] },
      cta: { heading: "", body: "", buttonText: "" },
    },
  },
  "lash-studio": {
    category: "Beauty & Wellness",
    sections: {
      hero: { headline: "", subheadline: "", ctaText: "", heroImage: "" },
      services: { heading: "", items: [] },
      gallery: { heading: "", images: [] },
      testimonials: { heading: "", items: [] },
      cta: { heading: "", body: "", buttonText: "" },
    },
  },
  "hair-salon": {
    category: "Beauty & Wellness",
    sections: {
      hero: { headline: "", subheadline: "", ctaText: "", heroImage: "" },
      services: { heading: "", items: [] },
      gallery: { heading: "", images: [] },
      testimonials: { heading: "", items: [] },
      cta: { heading: "", body: "", buttonText: "" },
    },
  },
  "auto-repair": {
    category: "Home Services",
    sections: {
      hero: { headline: "", subheadline: "", ctaText: "", heroImage: "" },
      services: { heading: "", items: [] },
      gallery: { heading: "", images: [] },
      testimonials: { heading: "", items: [] },
      cta: { heading: "", body: "", buttonText: "" },
    },
  },
  "cleaning-service": {
    category: "Home Services",
    sections: {
      hero: { headline: "", subheadline: "", ctaText: "", heroImage: "" },
      services: { heading: "", items: [] },
      gallery: { heading: "", images: [] },
      testimonials: { heading: "", items: [] },
      cta: { heading: "", body: "", buttonText: "" },
    },
  },
  landscaping: {
    category: "Home Services",
    sections: {
      hero: { headline: "", subheadline: "", ctaText: "", heroImage: "" },
      services: { heading: "", items: [] },
      gallery: { heading: "", images: [] },
      testimonials: { heading: "", items: [] },
      cta: { heading: "", body: "", buttonText: "" },
    },
  },
  "gym-trainer": {
    category: "Professional",
    sections: {
      hero: { headline: "", subheadline: "", ctaText: "", heroImage: "" },
      services: { heading: "", items: [] },
      gallery: { heading: "", images: [] },
      testimonials: { heading: "", items: [] },
      cta: { heading: "", body: "", buttonText: "" },
    },
  },
  "real-estate-agent": {
    category: "Professional",
    sections: {
      hero: { headline: "", subheadline: "", ctaText: "", heroImage: "" },
      services: { heading: "", items: [] },
      gallery: { heading: "", images: [] },
      testimonials: { heading: "", items: [] },
      cta: { heading: "", body: "", buttonText: "" },
    },
  },
  photographer: {
    category: "Professional",
    sections: {
      hero: { headline: "", subheadline: "", ctaText: "", heroImage: "" },
      services: { heading: "", items: [] },
      gallery: { heading: "", images: [] },
      testimonials: { heading: "", items: [] },
      cta: { heading: "", body: "", buttonText: "" },
    },
  },
  attorney: {
    category: "Professional",
    sections: {
      hero: { headline: "", subheadline: "", ctaText: "", heroImage: "" },
      services: { heading: "", items: [] },
      testimonials: { heading: "", items: [] },
      cta: { heading: "", body: "", buttonText: "" },
    },
  },
};

/**
 * Maps vertical (from opportunity record) to package slug.
 */
export const VERTICAL_TO_SLUG = {
  restaurant: "restaurant",
  cafe: "cafe-coffee-shop",
  bakery: "cafe-coffee-shop",
  hotel: "hotel-bnb",
  bnb: "hotel-bnb",
  lash: "lash-studio",
  esthetician: "lash-studio",
  salon: "hair-salon",
  barber: "hair-salon",
  auto: "auto-repair",
  mechanic: "auto-repair",
  cleaning: "cleaning-service",
  janitorial: "cleaning-service",
  landscaping: "landscaping",
  lawn: "landscaping",
  trainer: "gym-trainer",
  gym: "gym-trainer",
  fitness: "gym-trainer",
  realtor: "real-estate-agent",
  "real-estate": "real-estate-agent",
  photographer: "photographer",
  videographer: "photographer",
  attorney: "attorney",
  lawyer: "attorney",
  "law-firm": "attorney",
};
