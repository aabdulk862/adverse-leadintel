const SOURCE_NAME = "seed-charlotte-restaurants";
const VERTICAL = "restaurant";
const METRO = "charlotte, nc";

/**
 * V1 seed data: real Charlotte restaurants sourced from public directories.
 * This bypasses anti-bot protections for development. Replace with a live
 * scraper once you have a source that allows automated access.
 */
const SEED_DATA = [
  { business_name: "Midwood Smokehouse", phone: "(704) 295-4227", address: "1401 Central Ave, Charlotte, NC 28205", website: "midwoodsmokehouse.com", specialties: ["BBQ", "Smoked Meats"] },
  { business_name: "Haberdish", phone: "(980) 314-3558", address: "3106 N Davidson St, Charlotte, NC 28205", website: "haberdishclt.com", specialties: ["Southern", "Farm-to-Table"] },
  { business_name: "Leah & Louise", phone: "(980) 365-1840", address: "301 Camp Rd, Charlotte, NC 28206", website: null, specialties: ["Modern Soul Food", "Cocktails"] },
  { business_name: "Optimist Hall Food Court", phone: null, address: "1115 N Brevard St, Charlotte, NC 28206", website: "optimisthall.com", specialties: ["Food Hall"] },
  { business_name: "Sea Level NC", phone: "(704) 997-4360", address: "129 E 5th St, Charlotte, NC 28202", website: null, specialties: ["Seafood", "Raw Bar"] },
  { business_name: "Pho Hoa Vietnamese", phone: "(704) 563-0098", address: "4700 N Tryon St, Charlotte, NC 28213", website: null, specialties: ["Vietnamese", "Pho"] },
  { business_name: "Yamazaru", phone: "(980) 585-2005", address: "3020 N Davidson St, Charlotte, NC 28205", website: "yamazaruclt.com", specialties: ["Ramen", "Japanese"] },
  { business_name: "Supperland", phone: "(704) 714-2700", address: "1212 The Plaza, Charlotte, NC 28205", website: "supperlandclt.com", specialties: ["American", "Wood-Fired"] },
  { business_name: "Kabab Je", phone: "(704) 817-7050", address: "1404 East Blvd, Charlotte, NC 28203", website: null, specialties: ["Lebanese", "Mediterranean"] },
  { business_name: "The Dumpling Lady", phone: "(704) 333-2699", address: "3007 South Blvd, Charlotte, NC 28209", website: null, specialties: ["Dumplings", "Chinese"] },
  { business_name: "Pinky's Westside Grill", phone: "(704) 332-0402", address: "1600 W Morehead St, Charlotte, NC 28208", website: "pinkyswestsidegrill.com", specialties: ["Burgers", "Southern"] },
  { business_name: "La Shish Kabob", phone: "(704) 817-7501", address: "6525 N Tryon St, Charlotte, NC 28213", website: null, specialties: ["Middle Eastern", "Kabob"] },
  { business_name: "Mama Ricotta's", phone: "(704) 343-0148", address: "601 S Kings Dr, Charlotte, NC 28204", website: "mamaricottas.com", specialties: ["Italian", "Pasta"] },
  { business_name: "Seoul Food Meat Company", phone: "(704) 569-6161", address: "5715 N Sharon Amity, Charlotte, NC 28215", website: null, specialties: ["Korean BBQ"] },
  { business_name: "Viva Chicken", phone: "(704) 370-7373", address: "1710 Kenilworth Ave, Charlotte, NC 28203", website: "vivachicken.com", specialties: ["Peruvian", "Rotisserie"] },
  { business_name: "Fern Flavors from the Garden", phone: "(704) 334-4773", address: "1323 Central Ave, Charlotte, NC 28205", website: null, specialties: ["Vegan", "Plant-Based"] },
  { business_name: "The Crunkleton", phone: "(704) 919-0220", address: "1957 E 7th St, Charlotte, NC 28204", website: "thecrunkleton.com", specialties: ["Cocktails", "Small Plates"] },
  { business_name: "Good Food on Montford", phone: "(704) 525-0881", address: "1701 Montford Dr, Charlotte, NC 28209", website: "goodfoodonmontford.com", specialties: ["American", "Tapas"] },
  { business_name: "Bao & Broth", phone: "(704) 625-2685", address: "200 N Tryon St, Charlotte, NC 28202", website: null, specialties: ["Asian Fusion", "Bao Buns"] },
  { business_name: "Zada Jane's Corner Cafe", phone: "(704) 332-3663", address: "1601 Central Ave, Charlotte, NC 28205", website: null, specialties: ["Breakfast", "Brunch"] },
  // ── Batch 2 ──
  { business_name: "Taqueria La Unica", phone: "(704) 536-1254", address: "4301 Central Ave, Charlotte, NC 28205", website: null, specialties: ["Mexican", "Tacos"] },
  { business_name: "Doan's Vietnamese Kitchen", phone: "(704) 531-4545", address: "4600 E Independence Blvd, Charlotte, NC 28212", website: null, specialties: ["Vietnamese", "Banh Mi"] },
  { business_name: "Tacos El Regio", phone: "(704) 536-9817", address: "3520 Central Ave, Charlotte, NC 28205", website: null, specialties: ["Mexican", "Street Tacos"] },
  { business_name: "Jasmine Grill", phone: "(704) 347-8588", address: "2625 Freedom Dr, Charlotte, NC 28208", website: null, specialties: ["Mediterranean", "Halal"] },
  { business_name: "Brooks Sandwich House", phone: "(704) 375-8752", address: "2710 N Brevard St, Charlotte, NC 28206", website: null, specialties: ["Burgers", "Sandwiches"] },
  { business_name: "Price's Chicken Coop", phone: "(704) 333-9866", address: "1614 Camden Rd, Charlotte, NC 28203", website: null, specialties: ["Fried Chicken", "Southern"] },
  { business_name: "Lupie's Cafe", phone: "(704) 374-1232", address: "2718 Monroe Rd, Charlotte, NC 28205", website: null, specialties: ["Chili", "Southern Comfort"] },
  { business_name: "El Pulgarcito", phone: "(704) 568-5959", address: "5617 Albemarle Rd, Charlotte, NC 28212", website: null, specialties: ["Salvadoran", "Pupusas"] },
  { business_name: "Phat Burrito", phone: "(704) 347-2777", address: "1537 Camden Rd, Charlotte, NC 28203", website: null, specialties: ["Burritos", "Mexican"] },
  { business_name: "Diamond Restaurant", phone: "(704) 375-8959", address: "1901 Commonwealth Ave, Charlotte, NC 28205", website: null, specialties: ["Diner", "Breakfast"] },
  { business_name: "Sabor Latin Street Grill", phone: "(704) 333-3188", address: "1205 Thomas Ave, Charlotte, NC 28205", website: "saborlatinstreetgrill.com", specialties: ["Venezuelan", "Arepas"] },
  { business_name: "Lang Van Vietnamese", phone: "(704) 531-9525", address: "3019 Shamrock Dr, Charlotte, NC 28215", website: null, specialties: ["Vietnamese", "Noodles"] },
  { business_name: "Nan & Byron's", phone: "(704) 332-1886", address: "1714 South Blvd, Charlotte, NC 28203", website: null, specialties: ["Sandwiches", "Deli"] },
  { business_name: "Dish", phone: "(704) 344-0343", address: "1220 Thomas Ave, Charlotte, NC 28205", website: null, specialties: ["American", "Brunch"] },
  { business_name: "Thai House", phone: "(704) 332-3199", address: "2209 South Blvd, Charlotte, NC 28203", website: null, specialties: ["Thai", "Curry"] },
  { business_name: "Soul Gastrolounge", phone: "(704) 348-1848", address: "1500 Central Ave, Charlotte, NC 28205", website: "soulgastrolounge.com", specialties: ["Tapas", "Cocktails"] },
  { business_name: "Crispy Banh Mi", phone: "(704) 566-1088", address: "4520 E Independence Blvd, Charlotte, NC 28212", website: null, specialties: ["Vietnamese", "Banh Mi"] },
  { business_name: "El Thrifty Social Club", phone: "(980) 291-0228", address: "1820 Statesville Ave, Charlotte, NC 28206", website: null, specialties: ["Mexican", "Margaritas"] },
  { business_name: "Carnitas Guanajuato", phone: "(704) 536-9955", address: "3300 Central Ave, Charlotte, NC 28205", website: null, specialties: ["Mexican", "Carnitas"] },
  { business_name: "Queen City BBQ", phone: "(704) 906-8622", address: "225 Clanton Rd, Charlotte, NC 28217", website: null, specialties: ["BBQ", "Brisket"] },
  { business_name: "Ru San's", phone: "(704) 333-0133", address: "2440 Park Rd, Charlotte, NC 28203", website: null, specialties: ["Sushi", "Japanese"] },
  { business_name: "Lenny Boy Brewing", phone: "(704) 525-7090", address: "3000 S Tryon St, Charlotte, NC 28217", website: "lennyboy.com", specialties: ["Kombucha", "Brewery"] },
  { business_name: "Passage to India", phone: "(704) 335-1815", address: "6700 N Tryon St, Charlotte, NC 28213", website: null, specialties: ["Indian", "Curry"] },
  { business_name: "Ha Long Bay", phone: "(704) 532-4488", address: "4801 E Independence Blvd, Charlotte, NC 28212", website: null, specialties: ["Vietnamese", "Chinese"] },
  { business_name: "New Wrap City", phone: "(704) 817-7680", address: "1500 W Morehead St, Charlotte, NC 28208", website: null, specialties: ["Wraps", "Healthy"] },
  { business_name: "Taco Mama", phone: "(704) 817-7800", address: "2001 E 7th St, Charlotte, NC 28204", website: null, specialties: ["Mexican", "Tacos"] },
  { business_name: "Three Amigos", phone: "(704) 365-0920", address: "2917 Central Ave, Charlotte, NC 28205", website: null, specialties: ["Mexican", "Margaritas"] },
  { business_name: "Mr Tokyo", phone: "(704) 817-7299", address: "14027 Conlan Cir, Charlotte, NC 28277", website: null, specialties: ["Hibachi", "Japanese"] },
  { business_name: "BBQ King", phone: "(704) 399-8344", address: "2920 N Tryon St, Charlotte, NC 28206", website: null, specialties: ["BBQ", "Southern"] },
  { business_name: "Cabo Fish Taco", phone: "(704) 332-8868", address: "3201 N Davidson St, Charlotte, NC 28205", website: "cabofishburrito.com", specialties: ["Fish Tacos", "Mexican"] },
];

/**
 * Returns seed restaurant data for Charlotte, NC.
 * @returns {Promise<{ data: object[], error: object|null }>}
 */
export async function run() {
  const records = SEED_DATA.map((biz) => ({
    ...biz,
    owner_name: null,
    email: null,
    license_number: null,
    license_status: null,
    specialties: biz.specialties || [],
    source_name: SOURCE_NAME,
    source_url: null,
    vertical: VERTICAL,
    metro: METRO,
  }));

  return { data: records, error: null };
}
