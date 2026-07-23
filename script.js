/* ============================================================
   NUTRITION AI CHALLENGE — script.js
   Complete game logic, audio, animations, and storage
   ============================================================ */

// ======================== CONFIGURATION ========================
const CONFIG = {
  TOTAL_QUESTIONS: 10,
  TIMER_SECONDS: 20,
  MAX_LIVES: 3,
  POINTS_CORRECT: 100,
  POINTS_TIME_BONUS_MULTIPLIER: 2,
  KEY_COOLDOWN_MS: 600,
};

// ======================== GAME STATE ========================
const state = {
  playerName: '',
  difficulty: '',
  currentQuestionIndex: 0,
  score: 0,
  correctCount: 0,
  wrongCount: 0,
  lives: CONFIG.MAX_LIVES,
  timerSeconds: CONFIG.TIMER_SECONDS,
  timerInterval: null,
  isPaused: false,
  isAnswered: false,
  questions: [],
  usedQuestionIndices: [],
  soundEnabled: true,
  musicEnabled: true,
  darkMode: false,
  keyCooldown: false,
  audioCtx: null,
};

// ======================== AUDIO ENGINE (Web Audio API) ========================
function getAudioContext() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return state.audioCtx;
}

function playTone(freq, duration, type = 'sine', vol = 0.15, ramp = true) {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    if (ramp) gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) { /* Silently fail if audio not supported */ }
}

function sfxClick()      { playTone(800, 0.08, 'sine', 0.1); }
function sfxCorrect()    { playTone(523, 0.12, 'sine', 0.18); setTimeout(() => playTone(659, 0.12, 'sine', 0.18), 120); setTimeout(() => playTone(784, 0.2, 'sine', 0.2), 240); }
function sfxIncorrect()  { playTone(200, 0.25, 'sawtooth', 0.12); }
function sfxHover()      { playTone(600, 0.04, 'sine', 0.06); }
function sfxLevelUp()    { playTone(440, 0.1, 'triangle', 0.15); setTimeout(() => playTone(554, 0.1, 'triangle', 0.15), 100); setTimeout(() => playTone(659, 0.1, 'triangle', 0.15), 200); setTimeout(() => playTone(880, 0.25, 'triangle', 0.18), 300); }
function sfxTick()       { playTone(1000, 0.04, 'sine', 0.06); }
function sfxLoseLife()   { playTone(150, 0.35, 'sawtooth', 0.15); }

// ======================== NAVIGATION ========================
function navigateTo(screenName) {
  sfxClick();

  // Hide all screens
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  // Show target screen
  const screenMap = {
    'home': 'home-screen',
    'registration': 'registration-screen',
    'difficulty': 'difficulty-screen',
    'game': 'game-screen',
    'level-complete': 'level-complete-screen',
  };

  const targetId = screenMap[screenName];
  if (targetId) {
    document.getElementById(targetId).classList.add('active');
  }

  // If going to registration and already has a name, prefill
  if (screenName === 'registration') {
    const savedName = localStorage.getItem('nutritionAi_playerName');
    if (savedName) {
      document.getElementById('player-name-input').value = savedName;
      document.getElementById('welcome-msg').textContent = `Welcome back, ${savedName}! 👋`;
    }
  }

  // If going to difficulty, ensure player is registered
  if (screenName === 'difficulty' && !state.playerName) {
    const savedName = localStorage.getItem('nutritionAi_playerName');
    if (savedName) {
      state.playerName = savedName;
    } else {
      navigateTo('registration');
      return;
    }
  }

  // Close any open modals and overlays
  closeAllModals();
  document.getElementById('pause-overlay').style.display = 'none';
}

// ======================== MODALS ========================
function openModal(modalId) {
  sfxClick();
  document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
  sfxClick();
  document.getElementById(modalId).classList.remove('show');
}

function closeAllModals() {
  document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
}

// Close modals on background click
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal') && e.target.classList.contains('show')) {
    e.target.classList.remove('show');
  }
});

// Close modals on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeAllModals();
    if (state.isPaused) resumeGame();
  }
});

// ======================== PLAYER REGISTRATION ========================
function registerPlayer() {
  const input = document.getElementById('player-name-input');
  const name = input.value.trim();

  if (!name) {
    document.getElementById('welcome-msg').textContent = '⚠️ Please enter your name!';
    document.getElementById('welcome-msg').style.color = 'var(--danger)';
    sfxIncorrect();
    return;
  }

  if (name.length < 2) {
    document.getElementById('welcome-msg').textContent = '⚠️ Name must be at least 2 characters!';
    document.getElementById('welcome-msg').style.color = 'var(--danger)';
    sfxIncorrect();
    return;
  }

  state.playerName = name;
  localStorage.setItem('nutritionAi_playerName', name);

  document.getElementById('welcome-msg').textContent = `✅ Welcome, ${name}! Let's begin!`;
  document.getElementById('welcome-msg').style.color = 'var(--accent)';
  sfxCorrect();

  setTimeout(() => navigateTo('difficulty'), 800);
}

// Allow Enter key to register
document.getElementById('player-name-input')?.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') registerPlayer();
});

// ======================== QUESTION DATABASE (40+ questions, 4 difficulties) ========================
const ALL_QUESTIONS = [
  // ===== EASY (questions 0-9) =====
  {
    difficulty: 'easy',
    situation: 'A Grade 12 student skips breakfast every day and often feels tired during class. What is the best advice?',
    choices: [
      'Drink more coffee in the morning',
      'Eat a balanced breakfast with protein and fiber',
      'Skip lunch too to save time',
      'Exercise on an empty stomach'
    ],
    correct: 1,
    explanation: 'A balanced breakfast with protein and fiber provides sustained energy throughout the morning, improving focus and reducing fatigue.',
    fact: '🍳 Studies show students who eat breakfast perform 20% better on tests!',
    topic: 'Teen nutrition'
  },
  {
    difficulty: 'easy',
    situation: 'Which food group should fill HALF of your plate according to the "Healthy Plate" model?',
    choices: [
      'Meat and protein',
      'Grains and rice',
      'Fruits and vegetables',
      'Dairy products'
    ],
    correct: 2,
    explanation: 'The Healthy Plate model recommends filling half your plate with fruits and vegetables for essential vitamins, minerals, and fiber.',
    fact: '🥗 A colorful plate ensures you get a wide range of nutrients!',
    topic: 'Healthy plate'
  },
  {
    difficulty: 'easy',
    situation: 'A child refuses to eat vegetables. What is the best approach?',
    choices: [
      'Force the child to eat them',
      'Hide vegetables in favorite dishes and make them fun',
      'Give up and serve only fruits',
      'Punish the child for not eating'
    ],
    correct: 1,
    explanation: 'Making vegetables fun (colorful shapes, dips, smoothies) helps children develop healthy eating habits without stress.',
    fact: '🥕 It can take 10-15 exposures for a child to accept a new food!',
    topic: 'Child nutrition'
  },
  {
    difficulty: 'easy',
    situation: 'What is the most important nutrient for building strong bones and teeth?',
    choices: [
      'Vitamin C',
      'Iron',
      'Calcium',
      'Zinc'
    ],
    correct: 2,
    explanation: 'Calcium is essential for bone and teeth development. Dairy, leafy greens, and fortified foods are great sources.',
    fact: '🦴 99% of the body\'s calcium is stored in bones and teeth!',
    topic: 'Calcium'
  },
  {
    difficulty: 'easy',
    situation: 'How many glasses of water should an average person drink daily?',
    choices: [
      '1-2 glasses',
      '3-4 glasses',
      '8-10 glasses',
      '15-20 glasses'
    ],
    correct: 2,
    explanation: 'The general recommendation is 8-10 glasses (about 2-2.5 liters) of water per day for proper hydration.',
    fact: '💧 Your body is about 60% water — stay hydrated!',
    topic: 'Water'
  },
  {
    difficulty: 'easy',
    situation: 'Which vitamin is known as the "sunshine vitamin"?',
    choices: [
      'Vitamin A',
      'Vitamin C',
      'Vitamin D',
      'Vitamin B12'
    ],
    correct: 2,
    explanation: 'Vitamin D is produced by the body when skin is exposed to sunlight. It helps absorb calcium for healthy bones.',
    fact: '☀️ Just 10-30 minutes of midday sun several times a week can boost Vitamin D!',
    topic: 'Vitamins'
  },
  {
    difficulty: 'easy',
    situation: 'What type of food is rice classified as in the Go, Grow, Glow food groups?',
    choices: [
      'Glow food',
      'Grow food',
      'Go food',
      'None of the above'
    ],
    correct: 2,
    explanation: 'Rice is a "Go" food — it provides carbohydrates that give the body energy for daily activities.',
    fact: '⚡ Go foods = energy, Grow foods = body building, Glow foods = protection!',
    topic: 'Go, Grow, Glow foods'
  },
  {
    difficulty: 'easy',
    situation: 'An elderly person has difficulty chewing. Which food preparation method is best?',
    choices: [
      'Serve raw, crunchy vegetables',
      'Offer soft, easy-to-chew foods like soups and purees',
      'Skip meals to avoid discomfort',
      'Serve only liquids'
    ],
    correct: 1,
    explanation: 'Soft, nutrient-dense foods like soups, stews, and purees help elderly individuals get proper nutrition without chewing difficulty.',
    fact: '🍲 Blended soups can pack as many nutrients as a full meal!',
    topic: 'Elderly nutrition'
  },
  {
    difficulty: 'easy',
    situation: 'Which of these is a good source of protein?',
    choices: [
      'Apple',
      'Eggs',
      'White bread',
      'Butter'
    ],
    correct: 1,
    explanation: 'Eggs are an excellent source of complete protein, containing all essential amino acids the body needs.',
    fact: '🥚 One egg contains about 6-7 grams of high-quality protein!',
    topic: 'Protein'
  },
  {
    difficulty: 'easy',
    situation: 'What is the benefit of eating fiber-rich foods?',
    choices: [
      'They make you gain weight',
      'They help with healthy digestion',
      'They decrease energy levels',
      'They weaken the immune system'
    ],
    correct: 1,
    explanation: 'Fiber promotes healthy digestion, prevents constipation, and helps maintain a healthy gut microbiome.',
    fact: '🌾 Adults should aim for 25-30 grams of fiber daily!',
    topic: 'Fiber'
  },

  // ===== MEDIUM (questions 10-19) =====
  {
    difficulty: 'medium',
    situation: 'A teenager wants to build muscle. What is the best nutrition strategy?',
    choices: [
      'Eat only protein and avoid all carbs',
      'Take muscle-building supplements exclusively',
      'Combine adequate protein intake with balanced meals and strength training',
      'Eat large amounts of junk food for calories'
    ],
    correct: 2,
    explanation: 'Building muscle requires a balanced diet with sufficient protein, complex carbohydrates for energy, and proper training — not just supplements.',
    fact: '💪 Post-workout, a 3:1 carb-to-protein ratio helps muscle recovery!',
    topic: 'Teen nutrition'
  },
  {
    difficulty: 'medium',
    situation: 'A pregnant woman asks about iron-rich foods. Which combination is best?',
    choices: [
      'Milk and cheese',
      'Lean red meat, spinach, and vitamin C-rich fruits',
      'White rice and bread',
      'Only iron supplements without food'
    ],
    correct: 1,
    explanation: 'Iron from meat (heme iron) is well-absorbed, and vitamin C enhances iron absorption from plant sources like spinach.',
    fact: '🩸 Vitamin C can increase iron absorption by up to 6 times!',
    topic: 'Iron'
  },
  {
    difficulty: 'medium',
    situation: 'Someone wants to prevent foodborne illness at home. Which practice is most important?',
    choices: [
      'Leaving cooked food at room temperature overnight',
      'Washing hands and separating raw and cooked foods',
      'Using the same cutting board for everything',
      'Eating food past its expiration date'
    ],
    correct: 1,
    explanation: 'Proper handwashing and preventing cross-contamination between raw and cooked foods are the most effective ways to prevent foodborne illness.',
    fact: '🧼 The "danger zone" for bacterial growth is 4°C to 60°C (40°F-140°F)!',
    topic: 'Food safety'
  },
  {
    difficulty: 'medium',
    situation: 'An adult wants to lose weight healthily. What is the best approach?',
    choices: [
      'Skip all meals and only drink water',
      'Follow a balanced, calorie-controlled diet with regular exercise',
      'Eat only one type of food for weeks',
      'Take weight-loss pills and avoid all exercise'
    ],
    correct: 1,
    explanation: 'Sustainable weight loss comes from a balanced diet with a moderate calorie deficit combined with regular physical activity.',
    fact: '🏃 A deficit of 500 calories/day leads to about 0.5kg loss per week — safe and sustainable!',
    topic: 'Adult nutrition'
  },
  {
    difficulty: 'medium',
    situation: 'Which vitamin deficiency causes night blindness?',
    choices: [
      'Vitamin B12 deficiency',
      'Vitamin C deficiency',
      'Vitamin A deficiency',
      'Vitamin E deficiency'
    ],
    correct: 2,
    explanation: 'Vitamin A is essential for eye health. Deficiency can lead to night blindness and other vision problems.',
    fact: '👁️ Carrots, sweet potatoes, and liver are rich in Vitamin A!',
    topic: 'Vitamins'
  },
  {
    difficulty: 'medium',
    situation: 'A person is diagnosed with anemia. Which mineral are they most likely deficient in?',
    choices: [
      'Calcium',
      'Iron',
      'Zinc',
      'Magnesium'
    ],
    correct: 1,
    explanation: 'Iron-deficiency anemia is the most common type of anemia. Iron is needed to make hemoglobin, which carries oxygen in the blood.',
    fact: '🩸 Iron from animal sources (heme iron) is absorbed 2-3 times better than plant iron!',
    topic: 'Iron'
  },
  {
    difficulty: 'medium',
    situation: 'What is the main role of Vitamin C in the body?',
    choices: [
      'Building strong bones',
      'Supporting immune function and collagen production',
      'Improving eyesight',
      'Regulating blood sugar'
    ],
    correct: 1,
    explanation: 'Vitamin C is crucial for immune defense, collagen synthesis (healthy skin/wound healing), and acts as a powerful antioxidant.',
    fact: '🍊 One medium orange provides 70mg of Vitamin C — nearly the full daily requirement!',
    topic: 'Vitamins'
  },
  {
    difficulty: 'medium',
    situation: 'Which is a sign of malnutrition in children?',
    choices: [
      'Rapid weight gain',
      'Stunted growth and frequent infections',
      'Excessive energy',
      'Perfectly clear skin'
    ],
    correct: 1,
    explanation: 'Malnutrition in children often manifests as stunted growth, weakened immunity leading to frequent illness, and developmental delays.',
    fact: '📏 Globally, 149 million children under 5 are stunted due to malnutrition.',
    topic: 'Malnutrition'
  },
  {
    difficulty: 'medium',
    situation: 'What is the best pre-exercise meal timing?',
    choices: [
      'Right before starting exercise',
      '1-3 hours before exercise',
      '6-8 hours before exercise',
      'Exercise is best on a completely empty stomach'
    ],
    correct: 1,
    explanation: 'Eating a balanced meal 1-3 hours before exercise provides energy without causing digestive discomfort during activity.',
    fact: '🍌 A banana 30-60 minutes before exercise gives a quick energy boost!',
    topic: 'Exercise'
  },
  {
    difficulty: 'medium',
    situation: 'Which mineral helps regulate blood pressure?',
    choices: [
      'Iron',
      'Potassium',
      'Zinc',
      'Iodine'
    ],
    correct: 1,
    explanation: 'Potassium helps balance sodium levels and relaxes blood vessel walls, which helps regulate blood pressure.',
    fact: '🥑 One avocado contains more potassium than a banana — about 975mg!',
    topic: 'Minerals'
  },

  // ===== HARD (questions 20-29) =====
  {
    difficulty: 'hard',
    situation: 'A patient with osteoporosis needs to increase bone density. Besides calcium, which other nutrient is critical?',
    choices: [
      'Vitamin C and iron',
      'Vitamin D and magnesium',
      'Vitamin B12 and zinc',
      'Fiber and potassium'
    ],
    correct: 1,
    explanation: 'Vitamin D is needed to absorb calcium, and magnesium helps convert vitamin D into its active form. Both are essential for bone health.',
    fact: '🦴 Weight-bearing exercises combined with calcium + vitamin D can increase bone density!',
    topic: 'Calcium'
  },
  {
    difficulty: 'hard',
    situation: 'A diabetic patient asks about carbohydrate management. What is the most accurate advice?',
    choices: [
      'Eliminate all carbohydrates completely',
      'Choose complex carbohydrates with low glycemic index and monitor portions',
      'Only eat simple sugars at night',
      'Carbohydrates do not affect blood sugar'
    ],
    correct: 1,
    explanation: 'Complex carbohydrates (whole grains, legumes) with low glycemic index release glucose slowly, helping manage blood sugar levels.',
    fact: '📊 Glycemic index: White bread = 75, Lentils = 32 — choose wisely!',
    topic: 'Adult nutrition'
  },
  {
    difficulty: 'hard',
    situation: 'Why is iodine important in the diet, and what happens if deficient?',
    choices: [
      'It builds muscles; deficiency causes weakness',
      'It supports thyroid function; deficiency causes goiter',
      'It improves eyesight; deficiency causes blindness',
      'It enhances taste; deficiency causes loss of smell'
    ],
    correct: 1,
    explanation: 'Iodine is essential for thyroid hormone production. Deficiency can cause goiter (thyroid gland enlargement) and developmental issues.',
    fact: '🧂 Iodized salt is one of the simplest public health interventions preventing iodine deficiency!',
    topic: 'Minerals'
  },
  {
    difficulty: 'hard',
    situation: 'An athlete is experiencing frequent muscle cramps during competition. Which mineral imbalance is the most likely cause?',
    choices: [
      'Excess calcium',
      'Sodium and potassium imbalance',
      'Too much vitamin D',
      'Iron overload'
    ],
    correct: 1,
    explanation: 'Electrolyte imbalances — particularly sodium, potassium, and magnesium losses through sweat — are the most common cause of exercise-associated muscle cramps.',
    fact: '🧂 Athletes can lose 1-3 grams of sodium per liter of sweat during intense exercise!',
    topic: 'Minerals'
  },
  {
    difficulty: 'hard',
    situation: 'A mother is concerned about her toddler being a "picky eater." Which strategy is backed by nutrition science?',
    choices: [
      'Force-feed the child to ensure adequate intake',
      'Use the "division of responsibility" — parent provides healthy options, child decides how much to eat',
      'Only serve the child\'s favorite foods',
      'Withhold food until the child is very hungry'
    ],
    correct: 1,
    explanation: 'The "division of responsibility" (Ellyn Satter model) reduces mealtime stress: parents choose what, when, where; children choose whether and how much.',
    fact: '👶 Trust your child\'s appetite — forcing food can create negative associations!',
    topic: 'Child nutrition'
  },
  {
    difficulty: 'hard',
    situation: 'Which combination maximizes non-heme (plant-based) iron absorption?',
    choices: [
      'Spinach with milk',
      'Lentils with lemon juice',
      'Beans with coffee',
      'Tofu with tea'
    ],
    correct: 1,
    explanation: 'Vitamin C (lemon juice) significantly enhances absorption of non-heme iron from plant sources. Tannins in coffee/tea and calcium inhibit absorption.',
    fact: '🍋 A squeeze of lemon on your spinach salad doubles iron absorption!',
    topic: 'Iron'
  },
  {
    difficulty: 'hard',
    situation: 'What is the difference between soluble and insoluble fiber?',
    choices: [
      'There is no difference; fiber is fiber',
      'Soluble fiber dissolves in water and helps lower cholesterol; insoluble fiber adds bulk to stool',
      'Soluble fiber is only in fruits; insoluble only in grains',
      'Insoluble fiber is more important than soluble fiber'
    ],
    correct: 1,
    explanation: 'Soluble fiber (oats, apples, beans) forms a gel, helping lower cholesterol and blood sugar. Insoluble fiber (whole grains, vegetables) promotes regularity.',
    fact: '🌾 Oatmeal contains beta-glucan, a soluble fiber shown to reduce LDL cholesterol!',
    topic: 'Fiber'
  },
  {
    difficulty: 'hard',
    situation: 'A client wants to follow a balanced vegetarian diet. Which nutrient requires the most attention?',
    choices: [
      'Vitamin C',
      'Vitamin B12',
      'Fiber',
      'Carbohydrates'
    ],
    correct: 1,
    explanation: 'Vitamin B12 is found almost exclusively in animal products. Vegetarians and vegans should consume fortified foods or supplements.',
    fact: '💊 B12 deficiency can cause fatigue and nerve damage — it\'s the #1 supplement for plant-based diets!',
    topic: 'Vitamins'
  },
  {
    difficulty: 'hard',
    situation: 'How does chronic dehydration affect cognitive performance?',
    choices: [
      'It has no effect on the brain',
      'It improves concentration',
      'It impairs short-term memory, attention, and mood',
      'It only affects physical performance'
    ],
    correct: 2,
    explanation: 'Even mild dehydration (1-2% body water loss) can impair cognitive functions including short-term memory, attention, concentration, and mood.',
    fact: '🧠 Just 1% dehydration can reduce cognitive performance by up to 12%!',
    topic: 'Water'
  },
  {
    difficulty: 'hard',
    situation: 'Which food safety principle is described by keeping hot foods hot (above 60°C) and cold foods cold (below 4°C)?',
    choices: [
      'Cross-contamination prevention',
      'Temperature control in the "danger zone"',
      'Proper cleaning and sanitizing',
      'Personal hygiene'
    ],
    correct: 1,
    explanation: 'The "danger zone" (4°C-60°C / 40°F-140°F) is where bacteria multiply rapidly. Keeping food outside this range is critical for safety.',
    fact: '🌡️ Bacteria can double every 20 minutes in the danger zone!',
    topic: 'Food safety'
  },

  // ===== EXPERT (questions 30-39) =====
  {
    difficulty: 'expert',
    situation: 'A patient has celiac disease. Which grains must be strictly avoided?',
    choices: [
      'Rice and corn',
      'Wheat, barley, and rye',
      'Quinoa and millet',
      'Oats and buckwheat'
    ],
    correct: 1,
    explanation: 'Celiac disease requires strict avoidance of gluten found in wheat, barley, and rye. Rice, corn, quinoa, and certified gluten-free oats are safe alternatives.',
    fact: '🌾 About 1% of the global population has celiac disease — many are undiagnosed!',
    topic: 'Adult nutrition'
  },
  {
    difficulty: 'expert',
    situation: 'Which micronutrient deficiency is the most common worldwide?',
    choices: [
      'Vitamin C deficiency',
      'Iron deficiency',
      'Calcium deficiency',
      'Zinc deficiency'
    ],
    correct: 1,
    explanation: 'Iron deficiency is the most prevalent nutritional deficiency globally, affecting over 2 billion people and being the leading cause of anemia.',
    fact: '🌍 Iron deficiency affects approximately 30% of the world\'s population!',
    topic: 'Iron'
  },
  {
    difficulty: 'expert',
    situation: 'An endurance athlete is "carb-loading" before a marathon. What is the correct protocol?',
    choices: [
      'Eat a huge pasta meal the night before only',
      'Gradually increase carbohydrate intake 3-4 days before while tapering exercise',
      'Avoid all carbs until race day',
      'Eat only protein for a week before'
    ],
    correct: 1,
    explanation: 'Proper carb-loading involves increasing carbohydrate intake to 8-12g/kg body weight over 3-4 days while reducing training to maximize glycogen stores.',
    fact: '🏃‍♂️ Carb-loading can increase muscle glycogen stores by 50-100%!',
    topic: 'Exercise'
  },
  {
    difficulty: 'expert',
    situation: 'What is the role of omega-3 fatty acids in cardiovascular health?',
    choices: [
      'They increase bad cholesterol',
      'They reduce inflammation and lower triglyceride levels',
      'They have no proven health benefits',
      'They increase blood clotting'
    ],
    correct: 1,
    explanation: 'Omega-3s (EPA and DHA) reduce inflammation, lower triglycerides, slightly reduce blood pressure, and may decrease the risk of arrhythmias.',
    fact: '🐟 Eating fatty fish twice a week provides sufficient omega-3s for heart health!',
    topic: 'Healthy habits'
  },
  {
    difficulty: 'expert',
    situation: 'In the context of Go, Grow, Glow foods, which combination constitutes a complete meal?',
    choices: [
      'Rice and fried chicken only',
      'Rice (Go), fish (Grow), and steamed vegetables (Glow)',
      'Bread and butter only',
      'Candy and soda for quick energy'
    ],
    correct: 1,
    explanation: 'A complete meal includes Go foods (energy/carbs), Grow foods (body-building/protein), and Glow foods (protective/vitamin-rich vegetables/fruits).',
    fact: '🌈 A balanced plate has all three: Go, Grow, and Glow!',
    topic: 'Go, Grow, Glow foods'
  },
  {
    difficulty: 'expert',
    situation: 'What distinguishes kwashiorkor from marasmus in malnutrition?',
    choices: [
      'They are the same condition',
      'Kwashiorkor involves edema and is protein-deficient; marasmus is overall calorie deficiency',
      'Marasmus only affects adults',
      'Kwashiorkor is caused by vitamin C deficiency'
    ],
    correct: 1,
    explanation: 'Kwashiorkor is protein-energy malnutrition characterized by edema (swelling); marasmus results from severe calorie deficiency causing wasting.',
    fact: '🩺 Kwashiorkor often occurs when a child is weaned onto a low-protein diet after breastfeeding ends.',
    topic: 'Malnutrition'
  },
  {
    difficulty: 'expert',
    situation: 'A nutrition label says "0g trans fat" but ingredients list "partially hydrogenated oil." What does this mean?',
    choices: [
      'The product is completely trans fat free',
      'The product may contain up to 0.5g trans fat per serving — regulations allow rounding down',
      'The label is definitely wrong',
      'Partially hydrogenated oil is always healthy'
    ],
    correct: 1,
    explanation: 'FDA regulations allow products with less than 0.5g trans fat per serving to be labeled "0g." Partially hydrogenated oils always contain trans fats.',
    fact: '📋 Always check ingredient lists — "partially hydrogenated" = trans fats are present!',
    topic: 'Food safety'
  },
  {
    difficulty: 'expert',
    situation: 'Which population group is at highest risk for vitamin B12 deficiency, and why?',
    choices: [
      'Athletes because they burn through B12 quickly',
      'Older adults and vegans — due to decreased absorption and lack of dietary sources',
      'Teenagers because of rapid growth',
      'Pregnant women because the baby consumes all B12'
    ],
    correct: 1,
    explanation: 'Older adults often have reduced stomach acid needed to absorb B12 from food. Vegans/vegetarians lack dietary sources since B12 is mainly in animal products.',
    fact: '👴 Up to 20% of adults over 60 may have B12 deficiency!',
    topic: 'Vitamins'
  },
  {
    difficulty: 'expert',
    situation: 'How does the body regulate hydration at the cellular level?',
    choices: [
      'Through random water movement only',
      'Through electrolyte balance and osmosis — sodium and potassium control water distribution',
      'The liver alone controls all hydration',
      'Bones absorb excess water'
    ],
    correct: 1,
    explanation: 'Electrolytes (especially sodium and potassium) create osmotic gradients that control water movement between intracellular and extracellular compartments via the sodium-potassium pump.',
    fact: '⚡ The sodium-potassium pump uses about 30% of your body\'s ATP energy!',
    topic: 'Water'
  },
  {
    difficulty: 'expert',
    situation: 'A nutritionist is designing a diet for someone with hypertension. Beyond reducing sodium, what else is recommended?',
    choices: [
      'Increase saturated fat intake',
      'Follow the DASH diet — rich in potassium, magnesium, calcium from fruits, vegetables, and low-fat dairy',
      'Eliminate all fats',
      'Increase caffeine consumption'
    ],
    correct: 1,
    explanation: 'The DASH (Dietary Approaches to Stop Hypertension) diet emphasizes potassium, magnesium, and calcium-rich foods which help lower blood pressure alongside sodium reduction.',
    fact: '❤️ The DASH diet can lower blood pressure in just 2 weeks!',
    topic: 'Minerals'
  },
];

// ======================== GAME INITIALIZATION ========================
function startGame(difficulty) {
  if (!state.playerName) {
    const savedName = localStorage.getItem('nutritionAi_playerName');
    if (savedName) {
      state.playerName = savedName;
    } else {
      navigateTo('registration');
      return;
    }
  }

  sfxClick();
  state.difficulty = difficulty;

  // Filter and shuffle questions
  const pool = ALL_QUESTIONS.filter(q => q.difficulty === difficulty);
  state.questions = shuffleArray([...pool]).slice(0, CONFIG.TOTAL_QUESTIONS);
  state.usedQuestionIndices = [];

  // Reset game state
  state.currentQuestionIndex = 0;
  state.score = 0;
  state.correctCount = 0;
  state.wrongCount = 0;
  state.lives = CONFIG.MAX_LIVES;
  state.isAnswered = false;
  state.isPaused = false;

  // Update UI
  updateLivesDisplay();
  updateScoreDisplay();
  updateStatsDisplay();
  document.getElementById('progress-bar').style.setProperty('--progress', '0%');
  document.getElementById('progress-bar').querySelector('::after')?.style?.setProperty?.('width', '0%');
  document.querySelector('.progress-bar').style.setProperty('--w', '0%');

  navigateTo('game');
  renderQuestion();
}

// Progress bar update using background style
function updateProgressBar() {
  const pct = ((state.currentQuestionIndex) / CONFIG.TOTAL_QUESTIONS) * 100;
  const bar = document.querySelector('.progress-bar');
  bar.style.background = `linear-gradient(90deg, var(--accent) ${pct}%, transparent ${pct}%)`;
  bar.style.setProperty('--pct', pct + '%');
  // Simpler: use a child element approach
  const inner = bar.querySelector('::after');
  document.getElementById('progress-text').textContent = `${Math.min(state.currentQuestionIndex + 1, CONFIG.TOTAL_QUESTIONS)}/${CONFIG.TOTAL_QUESTIONS}`;
}

// Better progress bar
function setProgressWidth(pct) {
  const bar = document.querySelector('.progress-bar');
  // Use background-size trick
  bar.style.background = `linear-gradient(to right, var(--accent, #00e676) 0%, var(--accent2, #00b0ff) ${pct}%, rgba(255,255,255,0.15) ${pct}%, rgba(255,255,255,0.15) 100%)`;
}

// ======================== RENDER QUESTION ========================
function renderQuestion() {
  if (state.currentQuestionIndex >= CONFIG.TOTAL_QUESTIONS || state.lives <= 0) {
    endLevel();
    return;
  }

  state.isAnswered = false;
  const question = state.questions[state.currentQuestionIndex];

  // Update progress
  const progressPct = (state.currentQuestionIndex / CONFIG.TOTAL_QUESTIONS) * 100;
  setProgressWidth(progressPct);
  document.getElementById('progress-text').textContent = `${state.currentQuestionIndex + 1}/${CONFIG.TOTAL_QUESTIONS}`;

  // Situation text
  document.getElementById('situation-text').textContent = question.situation;

  // Choices
  const choicesGrid = document.getElementById('choices-grid');
  choicesGrid.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];

  question.choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = `<span class="choice-letter">${letters[i]}</span> ${choice}`;
    btn.addEventListener('click', () => selectAnswer(i));
    btn.addEventListener('mouseenter', () => sfxHover());
    choicesGrid.appendChild(btn);
  });

  // Hide feedback
  document.getElementById('feedback-area').style.display = 'none';
  document.getElementById('next-btn').style.display = 'none';

  // Reset timer
  resetTimer();
  startTimer();

  // AI robot message
  setAiMessage(getRandomAiMessage('thinking'));

  // Update stats display
  updateStatsDisplay();
  updateLivesDisplay();
  updateScoreDisplay();
}

// ======================== ANSWER SELECTION ========================
function selectAnswer(choiceIndex) {
  if (state.isAnswered || state.keyCooldown) return;

  state.isAnswered = true;
  state.keyCooldown = true;
  setTimeout(() => { state.keyCooldown = false; }, CONFIG.KEY_COOLDOWN_MS);

  clearInterval(state.timerInterval);

  const question = state.questions[state.currentQuestionIndex];
  const choiceButtons = document.querySelectorAll('.choice-btn');

  // Disable all buttons
  choiceButtons.forEach(btn => btn.classList.add('disabled'));

  // Highlight correct answer
  choiceButtons[question.correct].classList.add('correct');

  const isCorrect = choiceIndex === question.correct;

  if (isCorrect) {
    // Calculate points with time bonus
    const timeBonus = Math.floor(state.timerSeconds * CONFIG.POINTS_TIME_BONUS_MULTIPLIER);
    const points = CONFIG.POINTS_CORRECT + timeBonus;
    state.score += points;
    state.correctCount++;
    sfxCorrect();
    setAiMessage(getRandomAiMessage('correct'));
    showFeedback(true, question.explanation, question.fact);
  } else {
    choiceButtons[choiceIndex].classList.add('incorrect');
    state.wrongCount++;
    state.lives--;
    sfxIncorrect();
    sfxLoseLife();
    setAiMessage(getRandomAiMessage('incorrect'));
    showFeedback(false, question.explanation, question.fact);
    updateLivesDisplay();

    // Check game over
    if (state.lives <= 0) {
      setTimeout(() => endLevel(), 2000);
      return;
    }
  }

  updateScoreDisplay();
  updateStatsDisplay();
  document.getElementById('next-btn').style.display = 'flex';
  document.getElementById('next-btn').focus();
}

// ======================== FEEDBACK ========================
function showFeedback(isCorrect, explanation, fact) {
  const area = document.getElementById('feedback-area');
  area.style.display = 'block';
  area.className = 'feedback-area ' + (isCorrect ? 'correct-fb' : 'incorrect-fb');
  document.getElementById('feedback-icon').textContent = isCorrect ? '✅' : '❌';
  document.getElementById('feedback-text').textContent = isCorrect
    ? 'Correct! Great nutrition knowledge!'
    : 'Incorrect. Learn from this!';
  document.getElementById('nutrition-fact').textContent = '💡 ' + fact;
}

// ======================== NEXT QUESTION ========================
function nextQuestion() {
  sfxClick();
  state.currentQuestionIndex++;

  if (state.currentQuestionIndex >= CONFIG.TOTAL_QUESTIONS || state.lives <= 0) {
    endLevel();
  } else {
    renderQuestion();
    document.getElementById('next-btn').style.display = 'none';
  }
}

// ======================== TIMER ========================
function resetTimer() {
  state.timerSeconds = CONFIG.TIMER_SECONDS;
  const timerDisplay = document.getElementById('timer-display');
  timerDisplay.textContent = `⏱ ${state.timerSeconds}`;
  timerDisplay.classList.remove('urgent');
}

function startTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    if (state.isPaused) return;
    state.timerSeconds--;
    const timerDisplay = document.getElementById('timer-display');
    timerDisplay.textContent = `⏱ ${state.timerSeconds}`;

    if (state.timerSeconds <= 5) {
      timerDisplay.classList.add('urgent');
      sfxTick();
    }

    if (state.timerSeconds <= 0) {
      clearInterval(state.timerInterval);
      // Auto-fail: treat as incorrect
      if (!state.isAnswered) {
        state.isAnswered = true;
        state.wrongCount++;
        state.lives--;
        sfxIncorrect();
        sfxLoseLife();
        setAiMessage('⏰ Time\'s up! Be faster next time.');
        const question = state.questions[state.currentQuestionIndex];
        const choiceButtons = document.querySelectorAll('.choice-btn');
        choiceButtons.forEach(btn => btn.classList.add('disabled'));
        choiceButtons[question.correct].classList.add('correct');
        showFeedback(false, question.explanation, '⏰ Speed comes with practice! ' + question.fact.replace('💡 ', ''));
        updateScoreDisplay();
        updateStatsDisplay();
        updateLivesDisplay();
        document.getElementById('next-btn').style.display = 'flex';

        if (state.lives <= 0) {
          setTimeout(() => endLevel(), 2000);
        }
      }
    }
  }, 1000);
}

// ======================== PAUSE / RESUME ========================
function pauseGame() {
  if (!document.getElementById('game-screen').classList.contains('active')) return;
  state.isPaused = true;
  clearInterval(state.timerInterval);
  document.getElementById('pause-overlay').style.display = 'flex';
  sfxClick();
}

function resumeGame() {
  state.isPaused = false;
  document.getElementById('pause-overlay').style.display = 'none';
  if (!state.isAnswered) startTimer();
  sfxClick();
}

function restartGame() {
  clearInterval(state.timerInterval);
  state.isPaused = false;
  document.getElementById('pause-overlay').style.display = 'none';
  sfxClick();
  startGame(state.difficulty);
}

// ======================== END LEVEL ========================
function endLevel() {
  clearInterval(state.timerInterval);
  sfxLevelUp();

  const totalAnswered = state.correctCount + state.wrongCount;
  const accuracy = totalAnswered > 0 ? Math.round((state.correctCount / totalAnswered) * 100) : 0;

  // Calculate stars
  let stars = 1;
  if (accuracy >= 90) stars = 3;
  else if (accuracy >= 60) stars = 2;

  // Performance rating
  let rating = 'Keep Practicing!';
  if (accuracy >= 90) rating = 'Outstanding! 🏆';
  else if (accuracy >= 75) rating = 'Great Job! 👏';
  else if (accuracy >= 60) rating = 'Good Effort! 💪';
  else if (accuracy >= 40) rating = 'Nice Try! 📚';

  // Badge
  const badge = getBadge(stars, state.difficulty);

  // Update progress bar to 100%
  setProgressWidth(100);

  // Update UI
  document.getElementById('stars-display').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
  document.getElementById('final-score').textContent = state.score;
  document.getElementById('final-accuracy').textContent = accuracy + '%';
  document.getElementById('performance-rating').textContent = rating;
  document.getElementById('badge-earned').textContent = badge.icon + ' ' + badge.name;

  // Save to leaderboard
  saveToLeaderboard(state.playerName, state.difficulty, state.score, accuracy);

  // Trigger confetti if good performance
  if (accuracy >= 60) {
    triggerConfetti();
  }

  navigateTo('level-complete');
}

// ======================== BADGES ========================
function getBadge(stars, difficulty) {
  const badges = {
    easy: [
      { icon: '🌱', name: 'Healthy Beginner' },
      { icon: '🌿', name: 'Nutrition Explorer' },
      { icon: '🌳', name: 'Healthy Thinker' },
    ],
    medium: [
      { icon: '🌿', name: 'Nutrition Explorer' },
      { icon: '🌳', name: 'Healthy Thinker' },
      { icon: '🏅', name: 'Nutrition Expert' },
    ],
    hard: [
      { icon: '🌳', name: 'Healthy Thinker' },
      { icon: '🏅', name: 'Nutrition Expert' },
      { icon: '🤖', name: 'AI Nutrition Master' },
    ],
    expert: [
      { icon: '🏅', name: 'Nutrition Expert' },
      { icon: '🤖', name: 'AI Nutrition Master' },
      { icon: '👑', name: 'AI Nutrition Master' },
    ],
  };

  const tier = badges[difficulty] || badges.easy;
  return tier[Math.min(stars - 1, tier.length - 1)];
}

// ======================== NEXT LEVEL ========================
function nextLevel() {
  sfxClick();
  const levels = ['easy', 'medium', 'hard', 'expert'];
  const currentIdx = levels.indexOf(state.difficulty);
  if (currentIdx < levels.length - 1) {
    startGame(levels[currentIdx + 1]);
  } else {
    // Already at expert, go to difficulty selection
    navigateTo('difficulty');
    setAiMessage('🏆 You\'ve mastered all difficulties! Try again for a higher score.');
  }
}

// ======================== AI ROBOT MESSAGES ========================
const AI_MESSAGES = {
  thinking: [
    'Analyzing the situation... 🤔',
    'Think carefully! 🧠',
    'What would a nutrition expert do? 💭',
    'Consider all the options... 🔍',
    'Use your nutrition knowledge! 📚',
    'Take your time, but the clock is ticking! ⏰',
    'You can do this! 💪',
    'Trust your instincts! ✨',
  ],
  correct: [
    'Excellent nutrition knowledge! 🌟',
    'Great decision! You really know your stuff! 🎯',
    'Perfect! The AI approves! 🤖✅',
    'Outstanding choice! Keep it up! 🏆',
    'You\'re becoming a nutrition expert! 📈',
    'Brilliant! That was spot on! 💡',
    'The data confirms: you\'re amazing! 📊',
    'Nutrition level: EXPERT! 🥇',
  ],
  incorrect: [
    'Not quite — but now you know better! 📖',
    'Every mistake is a learning opportunity! 🌱',
    'Keep learning — nutrition is a journey! 🚶',
    'Almost there! Review and try again! 🔄',
    'Don\'t give up! Knowledge grows with practice! 🌿',
    'The AI sees potential in you! 🤖💚',
    'Mistakes help us improve! 📈',
    'Stay curious — you\'re getting there! 🔍',
  ],
};

function getRandomAiMessage(type) {
  const messages = AI_MESSAGES[type] || AI_MESSAGES.thinking;
  return messages[Math.floor(Math.random() * messages.length)];
}

function setAiMessage(msg) {
  const typingEl = document.querySelector('#ai-message .typing-text');
  typingEl.textContent = '';
  // Typing animation
  let i = 0;
  const interval = setInterval(() => {
    if (i < msg.length) {
      typingEl.textContent += msg[i];
      i++;
    } else {
      clearInterval(interval);
    }
  }, 30);
}

// ======================== DISPLAY UPDATES ========================
function updateLivesDisplay() {
  const hearts = '❤️'.repeat(Math.max(0, state.lives)) + '🖤'.repeat(Math.max(0, CONFIG.MAX_LIVES - state.lives));
  document.getElementById('lives-display').textContent = hearts;

  if (state.lives <= 1) {
    document.getElementById('lives-display').style.animation = 'timerShake 0.5s ease infinite';
  } else {
    document.getElementById('lives-display').style.animation = '';
  }
}

function updateScoreDisplay() {
  document.getElementById('score-display').textContent = state.score;
}

function updateStatsDisplay() {
  document.getElementById('correct-count').textContent = state.correctCount;
  document.getElementById('wrong-count').textContent = state.wrongCount;
  const total = state.correctCount + state.wrongCount;
  const acc = total > 0 ? Math.round((state.correctCount / total) * 100) : 0;
  document.getElementById('accuracy-display').textContent = acc;
}

// ======================== CONFETTI ========================
function triggerConfetti() {
  const container = document.getElementById('confetti-container');
  const colors = ['#ff6d00', '#00e676', '#00b0ff', '#e040fb', '#ffd700', '#ff1744', '#76ff03', '#18ffff'];

  for (let i = 0; i < 80; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.top = -(Math.random() * 20) + '%';
    piece.style.width = (Math.random() * 10 + 6) + 'px';
    piece.style.height = (Math.random() * 10 + 6) + 'px';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (Math.random() * 2 + 2.5) + 's';
    piece.style.animationDelay = Math.random() * 1.5 + 's';
    container.appendChild(piece);

    // Clean up
    setTimeout(() => piece.remove(), 4000);
  }
}

// ======================== PARTICLES ========================
function createParticles() {
  const container = document.getElementById('particles-container');
  const colors = ['rgba(255,255,255,0.4)', 'rgba(0,230,118,0.3)', 'rgba(0,176,255,0.3)', 'rgba(224,64,251,0.3)'];

  for (let i = 0; i < 50; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.width = (Math.random() * 5 + 2) + 'px';
    particle.style.height = particle.style.width;
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];
    particle.style.animationDuration = (Math.random() * 10 + 8) + 's';
    particle.style.animationDelay = Math.random() * 10 + 's';
    container.appendChild(particle);
  }
}

// ======================== LEADERBOARD ========================
function saveToLeaderboard(name, difficulty, score, accuracy) {
  const leaderboard = getLeaderboard();
  leaderboard.push({
    name,
    difficulty,
    score,
    accuracy,
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
  });

  // Sort by score desc, keep top 10
  leaderboard.sort((a, b) => b.score - a.score);
  const top10 = leaderboard.slice(0, 10);
  localStorage.setItem('nutritionAi_leaderboard', JSON.stringify(top10));
}

function getLeaderboard() {
  try {
    const data = localStorage.getItem('nutritionAi_leaderboard');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function showLeaderboard() {
  sfxClick();
  const leaderboard = getLeaderboard();
  const tbody = document.getElementById('leaderboard-body');
  const emptyMsg = document.getElementById('leaderboard-empty');

  tbody.innerHTML = '';

  if (leaderboard.length === 0) {
    emptyMsg.style.display = 'block';
  } else {
    emptyMsg.style.display = 'none';
    leaderboard.forEach((entry, i) => {
      const tr = document.createElement('tr');
      let rankClass = '';
      let rankDisplay = (i + 1).toString();
      if (i === 0) { rankClass = 'rank-1'; rankDisplay = '🥇'; }
      else if (i === 1) { rankClass = 'rank-2'; rankDisplay = '🥈'; }
      else if (i === 2) { rankClass = 'rank-3'; rankDisplay = '🥉'; }

      tr.innerHTML = `
        <td class="${rankClass}">${rankDisplay}</td>
        <td>${escapeHtml(entry.name)}</td>
        <td>${capitalize(entry.difficulty)}</td>
        <td><strong>${entry.score}</strong></td>
        <td>${entry.accuracy}%</td>
        <td>${entry.date}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  openModal('leaderboard-modal');
}

function resetLeaderboard() {
  if (confirm('Are you sure you want to reset the entire leaderboard? This cannot be undone.')) {
    localStorage.removeItem('nutritionAi_leaderboard');
    sfxIncorrect();
    alert('Leaderboard has been reset.');
  }
}

// ======================== SETTINGS ========================
function toggleMusic() {
  state.musicEnabled = document.getElementById('music-toggle').checked;
  localStorage.setItem('nutritionAi_music', state.musicEnabled);
  sfxClick();
}

function toggleSound() {
  state.soundEnabled = document.getElementById('sound-toggle').checked;
  localStorage.setItem('nutritionAi_sound', state.soundEnabled);
  if (state.soundEnabled) sfxClick();
}

function toggleDarkMode() {
  state.darkMode = document.getElementById('darkmode-toggle').checked;
  document.documentElement.setAttribute('data-theme', state.darkMode ? 'dark' : 'light');
  localStorage.setItem('nutritionAi_darkMode', state.darkMode);
  sfxClick();
}

function loadSettings() {
  // Sound
  const soundSetting = localStorage.getItem('nutritionAi_sound');
  if (soundSetting !== null) {
    state.soundEnabled = soundSetting === 'true';
    document.getElementById('sound-toggle').checked = state.soundEnabled;
  }

  // Music
  const musicSetting = localStorage.getItem('nutritionAi_music');
  if (musicSetting !== null) {
    state.musicEnabled = musicSetting === 'true';
    document.getElementById('music-toggle').checked = state.musicEnabled;
  }

  // Dark mode
  const darkSetting = localStorage.getItem('nutritionAi_darkMode');
  if (darkSetting === 'true') {
    state.darkMode = true;
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('darkmode-toggle').checked = true;
  }
}

// ======================== UTILITY FUNCTIONS ========================
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ======================== KEYBOARD SUPPORT ========================
document.addEventListener('keydown', function(e) {
  // If in game screen and not answered
  const gameActive = document.getElementById('game-screen').classList.contains('active');

  if (gameActive && !state.isPaused) {
    // Answer keys 1-4
    if (!state.isAnswered && !state.keyCooldown) {
      const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3 };
      if (keyMap[e.key] !== undefined) {
        selectAnswer(keyMap[e.key]);
        return;
      }
    }

    // Next: N or Enter or Space
    if (state.isAnswered && (e.key === 'n' || e.key === 'N' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      nextQuestion();
      return;
    }

    // Pause: P or Escape
    if (e.key === 'p' || e.key === 'P') {
      if (state.isPaused) resumeGame();
      else pauseGame();
      return;
    }
  }

  // Pause overlay keyboard
  if (state.isPaused) {
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      resumeGame();
      return;
    }
  }
});

// ======================== INITIALIZATION ========================
function init() {
  createParticles();
  loadSettings();

  // If player name exists, prefill
  const savedName = localStorage.getItem('nutritionAi_playerName');
  if (savedName) {
    state.playerName = savedName;
  }

  // Initial navigation
  navigateTo('home');

  // Welcome message on registration screen
  if (savedName) {
    document.getElementById('player-name-input').value = savedName;
    document.getElementById('welcome-msg').textContent = `Welcome back, ${savedName}! 👋`;
  }

  console.log('🤖 Nutrition AI Challenge initialized!');
  console.log('💡 Tips: Use keys 1-4 to answer, N for next, P to pause, Esc to close modals.');
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);

// ======================== HANDLE BEFORE UNLOAD (save state) ========================
window.addEventListener('beforeunload', function() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
  }
});
