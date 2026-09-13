const cardsData = [
  {
    type: 'housing',
    title: 'My VU dorm room tour',
    meta: 'Vilnius · 3 min video',
    quote: '“The room is basic, but the location and social life are why I stayed.”',
    author: 'Ana',
    role: 'current resident',
    rating: '★ 4.8',
    search: 'vu dormitory dorm housing'
  },
  {
    type: 'neighborhood',
    title: 'A student’s Naujamiestis',
    meta: 'Vilnius · 5 min walk-through',
    quote: '“Here’s my route to the bus stop, supermarket, gym and the place I usually study.”',
    author: 'Maks',
    role: 'lives nearby',
    rating: '★ 4.7',
    search: 'naujamiestis vilnius neighborhood supermarket transport'
  },
  {
    type: 'university',
    title: 'My first semester at VU',
    meta: 'Vilnius · student guide',
    quote: '“What surprised me, how classes work, and what I would do differently before arriving.”',
    author: 'Sara',
    role: 'VU student',
    rating: '★ 4.9',
    search: 'vilnius university vu campus classes exams'
  },
  {
    type: 'community',
    title: 'I tried a Lithuanian language club',
    meta: 'Vilnius · 2 min video',
    quote: '“I was nervous going alone. Here’s what the first session actually felt like.”',
    author: 'Emil',
    role: 'international student',
    rating: '★ 4.6',
    search: 'lithuanian language club speaking vilnius meetup'
  },
  {
    type: 'housing',
    title: 'Dorm vs. private room in Kaunas',
    meta: 'Kaunas · comparison',
    quote: '“I lived in both. Here’s what changed in price, privacy, commute and social life.”',
    author: 'Davit',
    role: 'former resident',
    rating: '★ 4.8',
    search: 'kaunas dorm apartment rent housing'
  },
  {
    type: 'community',
    title: 'Where I met people after moving',
    meta: 'Vilnius · community guide',
    quote: '“Three places where I actually made friends instead of just saving an event on a calendar.”',
    author: 'Lina',
    role: 'local contributor',
    rating: '★ 4.9',
    search: 'international students meetup friends vilnius'
  }
];

const state = {
  selectedCountry: 'Lithuania',
  selectedPath: 'Student',
  activeFilter: 'all'
};

const cardsContainer = document.getElementById('cards');
const searchInput = document.getElementById('searchInput');
const countryButtons = [...document.querySelectorAll('[data-country]')];
const pathButtons = [...document.querySelectorAll('[data-path]')];
const continueBtn = document.getElementById('continueBtn');
const resetSelection = document.getElementById('resetSelection');
const submitBtn = document.getElementById('searchButton');
const contributeBtn = document.getElementById('contributeBtn');
const videoPlaceholder = document.querySelector('.video-placeholder');

function buildCardMarkup(card) {
  return `
    <article class="card" data-type="${card.type}">
      <div class="thumb">
        <div class="tag">${card.type.toUpperCase()} · ${card.type === 'housing' ? 'VIDEO' : card.type === 'university' ? 'GUIDE' : card.type === 'community' ? 'GUIDE' : 'VIDEO'}</div>
        <div class="play">▶</div>
      </div>
      <div class="cardbody">
        <h3>${card.title}</h3>
        <div class="meta">${card.meta}</div>
        <div class="quote">${card.quote}</div>
        <div class="person">
          <div class="avatar">${card.author.charAt(0)}</div>
          <div>
            <b>${card.author}</b><br />
            <span>${card.role}</span>
          </div>
          <div class="rating">${card.rating}</div>
        </div>
      </div>
    </article>
  `;
}

function renderCards() {
  const query = (searchInput.value || '').trim().toLowerCase();

  const filteredCards = cardsData.filter((card) => {
    const matchesFilter = state.activeFilter === 'all' || card.type === state.activeFilter;
    const haystack = `${card.search} ${card.title} ${card.meta} ${card.quote} ${card.author} ${card.role}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    return matchesFilter && matchesQuery;
  });

  cardsContainer.innerHTML = filteredCards.map(buildCardMarkup).join('');
}

function updateLandings() {
  continueBtn.disabled = !state.selectedCountry || !state.selectedPath;
  continueBtn.textContent = state.selectedCountry === 'Lithuania' ? 'Explore Lithuania' : 'Continue';
}

function applyCountrySelection(selectedCountry) {
  state.selectedCountry = selectedCountry;
  countryButtons.forEach((button) => {
    button.classList.toggle('selected', button.dataset.country === selectedCountry);
  });
  updateLandings();
}

function applyPathSelection(selectedPath) {
  state.selectedPath = selectedPath;
  pathButtons.forEach((button) => {
    button.classList.toggle('selected', button.dataset.path === selectedPath);
  });
  updateLandings();
}

countryButtons.forEach((button) => {
  button.addEventListener('click', () => applyCountrySelection(button.dataset.country));
});

pathButtons.forEach((button) => {
  button.addEventListener('click', () => applyPathSelection(button.dataset.path));
});

continueBtn.addEventListener('click', () => {
  if (state.selectedCountry === 'Lithuania') {
    document.body.classList.add('landed');
    return;
  }

  alert(`${state.selectedCountry} is coming soon. Lithuania is available right now.`);
});

resetSelection.addEventListener('click', () => {
  applyCountrySelection('Lithuania');
  applyPathSelection('Student');
});

submitBtn.addEventListener('click', () => {
  renderCards();
  document.getElementById('explore').scrollIntoView({ behavior: 'smooth' });
});

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    renderCards();
    document.getElementById('explore').scrollIntoView({ behavior: 'smooth' });
  }
});

document.querySelectorAll('.pill').forEach((pill) => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.pill').forEach((button) => button.classList.remove('active'));
    pill.classList.add('active');
    state.activeFilter = pill.dataset.filter;
    renderCards();
  });
});

contributeBtn.addEventListener('click', () => {
  alert('Prototype: contributor onboarding would open here.');
});

videoPlaceholder.addEventListener('click', () => {
  alert('Prototype: this would open the full resident video.');
});

videoPlaceholder.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    alert('Prototype: this would open the full resident video.');
  }
});

updateLandings();
renderCards();
