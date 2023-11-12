const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const { uniq } = require('ramda');

const BASE_URL = 'https://twitchtracker.com/channels/ranking?page='; // Replace with the actual URL

function writeGamersPageToFile(gamesLookup, pageNumber, data, totalGamers) {
  const fileName = gamesLookup.join('-').replace(/[ \.]/g, '');

  let output = {
    total: [],
    pages: [],
  };

  try {
    const jsonFile = fs.readFileSync(`./output/${fileName}.json`, 'utf-8');

    output = JSON.parse(jsonFile);
  } catch (error) {
    // file is empty, we start with default object
  }

  // throw if we already have this page
  // this is unexpected, means the check beforehand is not working
  if (output.total.includes(pageNumber)) {
    throw new Error(`Page ${pageNumber} already exists in the file.`);
  }

  // add the page to the list of pages
  output.total.push(pageNumber);

  // add the totalGamers to the list of totalGamers
  output.pages.push({
    page: pageNumber,
    data,
    total_gamers: totalGamers,
  });

  // save the file
  try {
    fs.writeFileSync(`output/${fileName}.json`, JSON.stringify(output, null, 2), 'utf-8');
  } catch (error) {
    console.log('error', error);
  }
}

// return false if we don't have this page in the file
// return the actual values if we do
function readGamersPageFromFile(gamesLookup, pageNumber) {
  const fileName = gamesLookup.join('-').replace(/[ \.]/g, '');

  try {
    const jsonFile = fs.readFileSync(`output/${fileName}.json`, 'utf-8');

    const output = JSON.parse(jsonFile);

    if (!output.total.includes(pageNumber)) {
      return false;
    }

    return output.pages.find((page) => page.page === pageNumber);
  } catch (error) {
    // file is empty, we start with default object
    return false;
  }
}

async function getGamersList(pageNumber = 1) {
  try {
    console.log(`Fetching ${BASE_URL + pageNumber}`);

    const response = await axios.get(BASE_URL + pageNumber);
    const $ = cheerio.load(response.data);
    // Implement logic to extract totalGamers' URLs or identifiers
    // For example, let's assume they are in <a> tags with class .gamer-link
    return uniq(
      $('#channels a')
        .map((i, el) => $(el).attr('href'))
        .get()
        .filter((href) => !href.includes('/channels'))
    );
  } catch (error) {
    console.error('Error fetching totalGamers list:', error.message);
  }
}

async function checkGamerForGame(gamerUrl, gameNames = []) {
  // wait for a bit so we don't get blocked
  await new Promise((r) => setTimeout(r, 2500));

  try {
    const response = await axios.get(`https://twitchtracker.com${gamerUrl}/games`);
    const $ = cheerio.load(response.data);

    // find the list of games
    const gamesList = $('#games td').text();

    // find only the games that are in the list of games we are looking for
    const foundGames = gameNames.filter((gameName) => gamesList.includes(gameName));

    // return string (success, like `FTL, Dota 2`) or false (no games found)
    return foundGames.length > 0 ? foundGames.join(', ') : false;
  } catch (error) {
    console.error(`Error checking gamer's page (${gamerUrl}):`, error.message);
  }
}

const arrayRange = (start, stop, step) =>
Array.from(
        { length: (stop - start) / step + 1},
        (value, index) => start + index * step
        );
async function main() {
  /*
    In sequence:
      1. Fetch the list of totalGamers on current page
      2. For every gamer, fetch list of their games
      3. Try to find the target game in their game list
  */

  // create an array of page numbers (btw one page has 50 totalGamers)
  /*const totalPages = Array(150) // change this 2 to actual number of pages
    .fill()
    .map((_, i) => i + 1);
    */
  const totalPages = arrayRange(1, 200 1);

  // cannot fetch in parallel, otherwise we get blocked
  let totalGamers = 0;
  const gamersWithGame = [];
  const gamesLookup = ['FTL', 'Slay the Spire'];
  for (const pageNumber of totalPages) {
    try {
      // first, skip this page if we already have it
      const existingPage = readGamersPageFromFile(gamesLookup, pageNumber);
      if (existingPage) {
        console.log(`Page ${pageNumber} already exists in the file. Skipping...`);
        gamersWithGame.push(...existingPage.data);
        totalGamers += existingPage.total_gamers;
        continue;
      }

      // fetch the totalGamers list (as their URLs, like `/nickname`)
      const pageGamersList = await getGamersList(pageNumber);
      const pageGamers = [];

      // for every gamer, check if they have the specified games
      for (const gamer of pageGamersList) {
        try {
          const hasGame = await checkGamerForGame(gamer, gamesLookup);
          console.log(`Checking ${gamer}...`);
          if (hasGame) {
            console.log(`Gamer at ${gamer} plays the specified game(s) (${hasGame}).`);

            const record = {
              gamer: gamer.substring(1),
              url: `https://twitchtracker.com${gamer}`,
              games: hasGame,
            };

            // for totals
            gamersWithGame.push(record);

            // for json output
            pageGamers.push(record);
          }
        } catch (error) {
          // error message is already logged in checkGamerForGame
        }
      }

      // when page is finished, save the results in a json file
      writeGamersPageToFile(gamesLookup, pageNumber, pageGamers, pageGamersList.length);

      // just for total number of totalGamers
      totalGamers += pageGamersList.length;
    } catch (error) {
      console.log('error', error);

      // error message is already logged in getGamersList
    }
  }

  console.log('Done. Gamers with the specified game(s):', gamersWithGame);
  console.log(`Total: ${gamersWithGame.length} out of ${totalGamers}`);
}

main();
