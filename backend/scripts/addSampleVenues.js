const admin = require('firebase-admin');
const serviceAccount = require('../config/serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const sampleVenues = {
  "London": [
    { name: "O2 Academy Brixton", email: "booking@o2academybrixton.co.uk", capacity: 4921 },
    { name: "The Roundhouse", email: "events@roundhouse.org.uk", capacity: 1700 },
    { name: "The Jazz Cafe", email: "bookings@thejazzcafelondon.com", capacity: 420 }
  ],
  "Manchester": [
    { name: "Albert Hall", email: "booking@alberthallmanchester.com", capacity: 2000 },
    { name: "Band on the Wall", email: "events@bandonthewall.org", capacity: 500 },
    { name: "The Deaf Institute", email: "bookings@thedeafinstitute.co.uk", capacity: 260 }
  ],
  "Birmingham": [
    { name: "O2 Institute Birmingham", email: "booking@o2institutebirmingham.co.uk", capacity: 1500 },
    { name: "The Sunflower Lounge", email: "events@thesunflowerlounge.com", capacity: 120 },
    { name: "Hare & Hounds", email: "bookings@hareandhoundskingsheath.co.uk", capacity: 250 }
  ],
  "Glasgow": [
    { name: "Barrowland Ballroom", email: "booking@barrowland-ballroom.co.uk", capacity: 1900 },
    { name: "King Tut's Wah Wah Hut", email: "events@kingtuts.co.uk", capacity: 300 },
    { name: "The Garage", email: "bookings@garageglasgow.co.uk", capacity: 700 }
  ],
  "Liverpool": [
    { name: "The Cavern Club", email: "booking@cavernclub.org", capacity: 350 },
    { name: "O2 Academy Liverpool", email: "events@o2academyliverpool.co.uk", capacity: 1200 },
    { name: "The Zanzibar Club", email: "bookings@thezanzibarclub.co.uk", capacity: 300 }
  ],
  "Edinburgh": [
    { name: "The Liquid Room", email: "booking@theliquidroom.com", capacity: 800 },
    { name: "Sneaky Pete's", email: "events@sneakypetes.co.uk", capacity: 100 },
    { name: "The Mash House", email: "bookings@themashhouse.co.uk", capacity: 200 }
  ],
  "Bristol": [
    { name: "Thekla", email: "booking@theklabristol.co.uk", capacity: 400 },
    { name: "O2 Academy Bristol", email: "events@o2academybristol.co.uk", capacity: 1600 },
    { name: "The Fleece", email: "bookings@thefleece.co.uk", capacity: 450 }
  ],
  "Leeds": [
    { name: "Brudenell Social Club", email: "booking@brudenellsocialclub.co.uk", capacity: 400 },
    { name: "O2 Academy Leeds", email: "events@o2academyleeds.co.uk", capacity: 2300 },
    { name: "The Wardrobe", email: "bookings@thewardrobe.co.uk", capacity: 400 }
  ],
  "Brighton": [
    { name: "Concorde 2", email: "booking@concorde2.co.uk", capacity: 600 },
    { name: "The Haunt", email: "events@thehauntbrighton.co.uk", capacity: 375 },
    { name: "Patterns", email: "bookings@patternsbrighton.com", capacity: 300 }
  ],
  "Newcastle": [
    { name: "O2 Academy Newcastle", email: "booking@o2academynewcastle.co.uk", capacity: 2000 },
    { name: "The Cluny", email: "events@thecluny.com", capacity: 300 },
    { name: "Riverside", email: "bookings@riversidenewcastle.co.uk", capacity: 1100 }
  ]
};

async function addSampleVenues() {
  try {
    // Clear existing venues
    const venuesRef = db.collection('venues');
    const snapshot = await venuesRef.get();
    const batch = db.batch();
    
    // Delete existing venues
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    // Add new venues
    for (const [city, venues] of Object.entries(sampleVenues)) {
      for (const venue of venues) {
        await venuesRef.add({
          ...venue,
          city,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
    
    console.log('Sample venues added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error adding sample venues:', error);
    process.exit(1);
  }
}

addSampleVenues();