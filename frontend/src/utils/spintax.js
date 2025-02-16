// spintax.js

// Helper function to identify sentence boundaries
const getSentenceBoundaries = (text) => {
  const boundaries = [];
  const regex = /[.!?](?=\s|$)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const prevWord = text.slice(Math.max(0, match.index - 3), match.index);
    if (!prevWord.match(/Mr|Dr|Ms|Mrs|vs|etc|i.e|e.g/i)) {
      boundaries.push(match.index + 1);
    }
  }

  return boundaries;
};

// Helper function to identify phrase boundaries
const getPhraseBoundaries = (text) => {
  const boundaries = [];
  const regex = /[,;](?=\s)|(?<=\s)(?:and|or|but|because|however|therefore)(?=\s)/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    boundaries.push(match.index);
  }

  return boundaries;
};

// Generate variations for a phrase while preserving whitespace
const generatePhraseVariations = (phrase) => {
  const leadingSpace = phrase.match(/^\s*/)[0]; // Capture leading spaces
  const trailingSpace = phrase.match(/\s*$/)[0]; // Capture trailing spaces
  const cleanPhrase = phrase.trim(); // Remove surrounding spaces for processing

  // Generate natural variations with proper spacing
  const variations = [
    cleanPhrase,
    cleanPhrase.replace(/^I am/, "I'm").replace(/^We are/, "We're"),
    cleanPhrase.replace(/^I would/, "I'd").replace(/^We would/, "We'd"),
    `actually, ${cleanPhrase}`,
    `basically, ${cleanPhrase}`,
    `you see, ${cleanPhrase}`,
    `you know, ${cleanPhrase}`,
  ].filter((v, i, arr) => arr.indexOf(v) === i); // Remove duplicates

  // Return the variations in spintax format with spaces intact
  return `${leadingSpace}{${variations.join('|')}}${trailingSpace}`;
};

// Convert text to spintax by spinning approximately 50% of phrases and sentences
export const convertToSpintax = (text) => {
  if (!text) return text;

  const sentenceBoundaries = getSentenceBoundaries(text);
  const phraseBoundaries = getPhraseBoundaries(text);
  const allBoundaries = [...new Set([0, ...sentenceBoundaries, ...phraseBoundaries, text.length])].sort((a, b) => a - b);

  const units = [];
  for (let i = 0; i < allBoundaries.length - 1; i++) {
    const unit = text.slice(allBoundaries[i], allBoundaries[i + 1]);
    if (unit.trim()) {
      units.push(unit);
    }
  }

  const unitsToSpin = new Set();
  const targetCount = Math.ceil(units.length * 0.5);
  while (unitsToSpin.size < targetCount) {
    const randomIndex = Math.floor(Math.random() * units.length);
    unitsToSpin.add(randomIndex);
  }

  return units.map((unit, index) =>
    unitsToSpin.has(index) ? generatePhraseVariations(unit) : unit
  ).join('');
};

// Process spintax to get a random variation
export const processSpintax = (text) => {
  if (!text) return text;
  
  return text.replace(/\{([^{}]*)\}/g, (match, choices) => {
    const options = choices.split('|');
    return options[Math.floor(Math.random() * options.length)];
  });
};

// Generate multiple variations from spintax text
export const generateSpintaxVariations = (text, limit = 3) => {
  const variations = new Set();
  for (let i = 0; i < limit * 2 && variations.size < limit; i++) {
    variations.add(processSpintax(text));
  }
  return Array.from(variations);
};

// Preview spintax variations
export const previewSpintaxVariations = (content, count = 3) => {
  const spintaxText = convertToSpintax(content);
  return {
    spintaxText,
    variations: generateSpintaxVariations(spintaxText, count)
  };
};
