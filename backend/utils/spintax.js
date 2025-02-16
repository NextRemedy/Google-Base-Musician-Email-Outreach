// spintax.js

// Example sentence-level Spintax templates
const spintaxSentences = [
    "{I hope this email finds you well.|I trust you're doing great.|I wanted to check in with you.}",
    "{Are you currently booking new musicians?|Would you be open to new artist collaborations?|Are you interested in fresh talent?}",
    "{Let me know if you’d like more details.|I’d be happy to provide additional info.|Please reach out if you have any questions.}",
    "{Looking forward to your response.|Hope to hear from you soon.|Excited to connect further.}"
  ];
  
  // Function to randomly replace spintax choices in a sentence
  const processSpintax = (text) => {
    if (!text) return text;
    return text.replace(/\{([^{}]*)\}/g, (match, choices) => {
      const options = choices.split('|');
      return options[Math.floor(Math.random() * options.length)];
    });
  };
  
  // Function to spin entire phrases/sentences in a message
  const spinMessage = (text, spinPercentage = 50) => {
    if (!text) return text;
  
    // Split the text into sentences
    let sentences = text.split(/([.!?])/g).filter(Boolean);
  
    // Determine how many sentences to spin based on the spinPercentage
    const numToSpin = Math.ceil(sentences.length * (spinPercentage / 100));
  
    // Randomly select sentences to spin
    let selectedIndexes = new Set();
    while (selectedIndexes.size < numToSpin) {
      selectedIndexes.add(Math.floor(Math.random() * sentences.length));
    }
  
    // Replace selected sentences with spintax options
    sentences = sentences.map((sentence, index) => 
      selectedIndexes.has(index) && spintaxSentences.length > 0
        ? processSpintax(spintaxSentences[Math.floor(Math.random() * spintaxSentences.length)])
        : sentence
    );
  
    return sentences.join("");
  };
  
  // Function to generate multiple variations of spun messages
  const generateSpintaxVariations = (text, limit = 3) => {
    if (!text) return [];
    
    const variations = new Set();
    for (let i = 0; i < limit * 2 && variations.size < limit; i++) {
      variations.add(spinMessage(text, 50)); // Spins 50% of the sentences
    }
    return Array.from(variations);
  };
  
  // Export functions
  module.exports = { processSpintax, spinMessage, generateSpintaxVariations };
