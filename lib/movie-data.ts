// Simplified movie data service to reduce bundle size

// Define movie categories
export const movieCategories = {
  genres: [
    'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
    'Drama', 'Fantasy', 'Horror', 'Musical', 'Mystery', 'Romance',
    'Sci-Fi', 'Thriller', 'Western', 'Family', 'War', 'Biography'
  ],
  actors: [
    'Tom Hanks', 'Meryl Streep', 'Leonardo DiCaprio', 'Denzel Washington',
    'Jennifer Lawrence', 'Brad Pitt', 'Viola Davis', 'Robert Downey Jr.',
    'Charlize Theron', 'Will Smith', 'Scarlett Johansson', 'Morgan Freeman'
  ],
  directors: [
    'Steven Spielberg', 'Christopher Nolan', 'Martin Scorsese', 'Quentin Tarantino',
    'Greta Gerwig', 'Spike Lee', 'James Cameron', 'Kathryn Bigelow',
    'Alfred Hitchcock', 'Stanley Kubrick', 'Bong Joon-ho', 'Jordan Peele'
  ],
  decades: [
    '1920s', '1930s', '1940s', '1950s', '1960s', '1970s',
    '1980s', '1990s', '2000s', '2010s', '2020s'
  ],
  studios: [
    'Warner Bros.', 'Disney', 'Universal', 'Paramount',
    '20th Century Studios', 'Sony Pictures', 'MGM', 'Lionsgate',
    'A24', 'Netflix', 'Amazon Studios', 'Pixar'
  ],
  countries: [
    'USA', 'UK', 'France', 'Japan', 'South Korea', 'India',
    'Italy', 'Germany', 'Spain', 'China', 'Mexico', 'Brazil'
  ],
  awards: [
    'Best Picture Oscar', 'Palme d\'Or', 'Golden Lion', 'Golden Bear',
    'BAFTA Best Film', 'Golden Globe Best Picture'
  ],
  themes: [
    'Coming of Age', 'Revenge', 'Redemption', 'Survival', 'Loss',
    'Love', 'Family', 'Friendship', 'Identity', 'Justice', 'Power'
  ]
};

// Sample list of movies for the game
export const allMovies = [
  {
    title: 'The Shawshank Redemption',
    categories: {
      genres: ['Drama'],
      actors: ['Morgan Freeman'],
      directors: [],
      decades: ['1990s'],
      studios: [],
      countries: ['USA'],
      awards: [],
      themes: ['Redemption', 'Friendship', 'Justice']
    }
  },
  {
    title: 'The Godfather',
    categories: {
      genres: ['Crime', 'Drama'],
      actors: [],
      directors: [],
      decades: ['1970s'],
      studios: ['Paramount'],
      countries: ['USA'],
      awards: ['Best Picture Oscar'],
      themes: ['Family', 'Power']
    }
  },
  {
    title: 'The Dark Knight',
    categories: {
      genres: ['Action', 'Crime', 'Drama'],
      actors: [],
      directors: ['Christopher Nolan'],
      decades: ['2000s'],
      studios: ['Warner Bros.'],
      countries: ['USA'],
      awards: [],
      themes: ['Justice', 'Identity']
    }
  },
  {
    title: 'Pulp Fiction',
    categories: {
      genres: ['Crime', 'Drama'],
      actors: [],
      directors: ['Quentin Tarantino'],
      decades: ['1990s'],
      studios: [],
      countries: ['USA'],
      awards: ['Palme d\'Or'],
      themes: []
    }
  },
  {
    title: 'Forrest Gump',
    categories: {
      genres: ['Drama', 'Romance'],
      actors: ['Tom Hanks'],
      directors: [],
      decades: ['1990s'],
      studios: ['Paramount'],
      countries: ['USA'],
      awards: ['Best Picture Oscar'],
      themes: ['Love', 'Friendship']
    }
  },
  {
    title: 'Inception',
    categories: {
      genres: ['Action', 'Adventure', 'Sci-Fi'],
      actors: ['Leonardo DiCaprio'],
      directors: ['Christopher Nolan'],
      decades: ['2010s'],
      studios: ['Warner Bros.'],
      countries: ['USA'],
      awards: [],
      themes: ['Identity']
    }
  },
  {
    title: 'The Matrix',
    categories: {
      genres: ['Action', 'Sci-Fi'],
      actors: [],
      directors: [],
      decades: ['1990s'],
      studios: ['Warner Bros.'],
      countries: ['USA'],
      awards: [],
      themes: ['Identity', 'Power']
    }
  },
  {
    title: 'Parasite',
    categories: {
      genres: ['Comedy', 'Drama', 'Thriller'],
      actors: [],
      directors: ['Bong Joon-ho'],
      decades: ['2010s'],
      studios: [],
      countries: ['South Korea'],
      awards: ['Best Picture Oscar', 'Palme d\'Or'],
      themes: ['Family', 'Justice']
    }
  },
  {
    title: 'The Lion King',
    categories: {
      genres: ['Animation', 'Adventure', 'Drama'],
      actors: [],
      directors: [],
      decades: ['1990s'],
      studios: ['Disney'],
      countries: ['USA'],
      awards: [],
      themes: ['Family', 'Coming of Age']
    }
  },
  {
    title: 'Titanic',
    categories: {
      genres: ['Drama', 'Romance'],
      actors: ['Leonardo DiCaprio'],
      directors: ['James Cameron'],
      decades: ['1990s'],
      studios: ['Paramount'],
      countries: ['USA'],
      awards: ['Best Picture Oscar'],
      themes: ['Love', 'Survival']
    }
  }
];

// Create a map to quickly look up movies by category
export const movieCategoryMap = new Map<string, string[]>();

// Initialize the category map
for (const categoryType in movieCategories) {
  const categories = movieCategories[categoryType as keyof typeof movieCategories];
  for (const category of categories) {
    movieCategoryMap.set(`${categoryType}:${category}`, []);
  }
}

// Populate the category map
allMovies.forEach(movie => {
  for (const categoryType in movie.categories) {
    const categories = movie.categories[categoryType as keyof typeof movie.categories];
    categories.forEach(category => {
      const key = `${categoryType}:${category}`;
      const currentMovies = movieCategoryMap.get(key) || [];
      currentMovies.push(movie.title);
      movieCategoryMap.set(key, currentMovies);
    });
  }
});

// Function to validate if a movie matches the specified categories
export function validateMovieMatch(movieTitle: string, categories: string[]): boolean {
  const movie = allMovies.find(m => m.title === movieTitle);
  if (!movie) return false;

  // Check if the movie matches all specified categories
  return categories.every(categorySpec => {
    const [categoryType, category] = categorySpec.split(':');
    
    const movieCategories = movie.categories[categoryType as keyof typeof movie.categories] || [];
    return movieCategories.includes(category);
  });
}

// Function to validate if the movie belongs to a specific category
export function validateMovieCategory(
  movieTitle: string, 
  categoryType: keyof typeof movieCategories, 
  category: string
): boolean {
  const movie = allMovies.find(m => m.title === movieTitle);
  if (!movie) return false;

  const movieCategories = movie.categories[categoryType] || [];
  return movieCategories.includes(category);
}

