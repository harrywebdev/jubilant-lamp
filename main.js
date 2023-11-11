const axios = require('axios');
const cheerio = require('cheerio');
const { uniq } = require('ramda');

const BASE_URL = 'https://twitchtracker.com/channels/ranking?page='; // Replace with the actual URL

async function getGamersList(pageNumber = 1) {
  try {
    console.log(`Fetching ${BASE_URL + pageNumber}`);

    const response = await axios.get(BASE_URL + pageNumber);
    const $ = cheerio.load(response.data);
    // Implement logic to extract gamers' URLs or identifiers
    // For example, let's assume they are in <a> tags with class .gamer-link
    return uniq(
      $('#channels a')
        .map((i, el) => $(el).attr('href'))
        .get()
        .filter((href) => !href.includes('/channels'))
    );
  } catch (error) {
    console.error('Error fetching gamers list:', error.message);
  }
}

async function checkGamerForGame(gamerUrl, gameNames = []) {
  // wait for a bit so we don't get blocked
  await new Promise((r) => setTimeout(r, 2500));

  try {
    const response = await axios.get(`https://twitchtracker.com${gamerUrl}/games`);
    const $ = cheerio.load(response.data);

    // find the list of games
    const gamesList = $('#games td.cell-slot').text();

    // find only the games that are in the list of games we are looking for
    const foundGames = gameNames.filter((gameName) => gamesList.includes(gameName));

    // return string (success, like `FTL, Dota 2`) or false (no games found)
    return foundGames.length > 0 ? foundGames.join(', ') : false;
  } catch (error) {
    console.error(`Error checking gamer's page (${gamerUrl}):`, error.message);
  }
}

async function main() {
  /*
    First, get a long array with all the gamers (partial URLs like `/nickname`)
    Then, for each gamer, check if they have the specified game in the list of games
  */

  // create an array of page numbers (btw one page has 50 gamers)
  const totalPages = Array(2) // change this 2 to actual number of pages
    .fill()
    .map((_, i) => i + 1);

  // cannot fetch in parallel, otherwise we get blocked
  const gamers = [];
  for (const pageNumber of totalPages) {
    try {
      const page = await getGamersList(pageNumber);

      // wait for a bit to avoid block
      await new Promise((r) => setTimeout(r, 2500));
      gamers.push(...page);
    } catch (error) {
      // error message is already logged in getGamersList
    }
  }

  const gamersWithGame = [];
  const gamesLookup = ['FTL', 'Dota 2'];
  for (const gamer of gamers) {
    try {
      const hasGame = await checkGamerForGame(gamer, gamesLookup);
      console.log(`Checking ${gamer}...`);
      if (hasGame) {
        console.log(`Gamer at ${gamer} plays the specified game(s) (${hasGame}).`);
        gamersWithGame.push(`https://twitchtracker.com${gamer}`);
      }
    } catch (error) {
      // error message is already logged in checkGamerForGame
    }
  }
  console.log('Done. Gamers with the specified game(s):', gamersWithGame);
  console.log(`Total: ${gamersWithGame.length} out of ${gamers.length}`);
}

main();
