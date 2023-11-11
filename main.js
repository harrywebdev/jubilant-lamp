const axios = require('axios');
const cheerio = require('cheerio');
const { uniq } = require('ramda');

const BASE_URL = 'https://twitchtracker.com/channels/ranking?page='; // Replace with the actual URL

async function getGamersList(pageNumber = 1) {
  try {
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
    console.error('Error fetching gamers list:', error);
  }
}

async function checkGamerForGame(gamerUrl, gameName) {
  try {
    const response = await axios.get(`https://twitchtracker.com${gamerUrl}/games`);
    const $ = cheerio.load(response.data);
    // Implement logic to search for the game in the gamer's page
    // This depends on how the game information is structured in the HTML
    return $('#games td.cell-slot').text().includes(gameName);
  } catch (error) {
    console.error(`Error checking gamer's page (${gamerUrl}):`, error);
  }
}

async function main() {
  // TODO: implement pagination, reducer that does first 100 pages or so
  const gamers = await getGamersList();
  const gamersWithGame = [];
  for (const gamer of gamers) {
    const hasGame = await checkGamerForGame(gamer, 'FTL');
    if (hasGame) {
      console.log(`Gamer at ${gamer} plays the specified game.`);
      gamersWithGame.push(gamer);
    }
  }
}

main();
